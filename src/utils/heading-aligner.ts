/**
 * Fast alignment to track heading occurrences across edits without file I/O.
 * Leverages physical line number shifts (new.line <= old.line during deletions) and LCS.
 * Highly optimized for mobile performance (< 0.05ms execution).
 */

export interface SimpleHeading {
	heading: string;
	level: number;
	line?: number;
	charCount?: number;
	preview?: string;
	assignedOccurrence?: number;
}

/**
 * Computes an alignment map from new heading indices to their original 1-based occurrence number
 * in the old heading list. Persists assignedOccurrence across recalculations.
 */
export function computeHeadingOccurrenceOverrides(
	oldHeadings: SimpleHeading[],
	newHeadings: SimpleHeading[],
	cursorLine?: number,
): Map<number, number> {
	const overrides = new Map<number, number>();
	if (!oldHeadings || oldHeadings.length === 0 || !newHeadings || newHeadings.length === 0) {
		return overrides;
	}

	// Calculate occurrence counts for both old and new headings
	const oldOccCounts = new Map<string, number>();
	const oldOccurrences: number[] = new Array<number>(oldHeadings.length);
	for (let i = 0; i < oldHeadings.length; i++) {
		const h = oldHeadings[i]!.heading;
		const occ = (oldOccCounts.get(h) ?? 0) + 1;
		oldOccCounts.set(h, occ);
		oldOccurrences[i] = occ;
	}

	const newOccCounts = new Map<string, number>();
	for (let j = 0; j < newHeadings.length; j++) {
		const h = newHeadings[j]!.heading;
		newOccCounts.set(h, (newOccCounts.get(h) ?? 0) + 1);
	}

	// Helper to determine if two headings can be safely anchored in prefix/suffix trim.
	// Only safe if identical non-empty preview, OR if heading is unique in both documents.
	const canTrimMatch = (oldH: SimpleHeading, newH: SimpleHeading): boolean => {
		if (oldH.heading !== newH.heading || oldH.level !== newH.level) {
			return false;
		}
		if (oldH.preview && newH.preview && oldH.preview.trim().length >= 3 && oldH.preview === newH.preview) {
			return true;
		}
		const oldTotal = oldOccCounts.get(oldH.heading) ?? 0;
		const newTotal = newOccCounts.get(newH.heading) ?? 0;
		if (oldTotal === 1 && newTotal === 1) {
			return true;
		}
		// If both headings are at the exact same line strictly above cursorLine, they are unchanged pre-existing headings
		if (
			oldH.line !== undefined &&
			newH.line !== undefined &&
			oldH.line === newH.line &&
			cursorLine !== undefined &&
			oldH.line < cursorLine
		) {
			return true;
		}
		return false;
	};

	const hasAnyDocAssigned = oldHeadings.some((o) => o.assignedOccurrence !== undefined);

	// Step 0: Fast Prefix & Suffix trim across whole document heading sequence
	let start = 0;
	while (
		start < oldHeadings.length &&
		start < newHeadings.length &&
		canTrimMatch(oldHeadings[start]!, newHeadings[start]!)
	) {
		const targetOcc = oldHeadings[start]!.assignedOccurrence ?? (hasAnyDocAssigned ? undefined : oldOccurrences[start]!);
		if (targetOcc !== undefined) {
			overrides.set(start, targetOcc);
			newHeadings[start]!.assignedOccurrence = targetOcc;
		}
		start++;
	}

	let oldEnd = oldHeadings.length - 1;
	let newEnd = newHeadings.length - 1;
	while (
		oldEnd >= start &&
		newEnd >= start &&
		canTrimMatch(oldHeadings[oldEnd]!, newHeadings[newEnd]!)
	) {
		const targetOcc = oldHeadings[oldEnd]!.assignedOccurrence ?? (hasAnyDocAssigned ? undefined : oldOccurrences[oldEnd]!);
		if (targetOcc !== undefined) {
			overrides.set(newEnd, targetOcc);
			newHeadings[newEnd]!.assignedOccurrence = targetOcc;
		}
		oldEnd--;
		newEnd--;
	}

	if (start > newEnd || start > oldEnd) {
		return overrides;
	}

	// Group remaining middle headings by heading name
	const oldGroups = new Map<
		string,
		Array<{
			index: number;
			level: number;
			line?: number;
			charCount?: number;
			preview?: string;
			occ: number;
			assignedOccurrence?: number;
		}>
	>();
	for (let i = start; i <= oldEnd; i++) {
		const item = oldHeadings[i]!;
		const key = item.heading;
		const list = oldGroups.get(key) ?? [];
		list.push({
			index: i,
			level: item.level,
			line: item.line,
			charCount: item.charCount,
			preview: item.preview,
			occ: oldOccurrences[i]!,
			assignedOccurrence: item.assignedOccurrence,
		});
		oldGroups.set(key, list);
	}

	const newGroups = new Map<
		string,
		Array<{
			index: number;
			level: number;
			line?: number;
			charCount?: number;
			preview?: string;
		}>
	>();
	for (let j = start; j <= newEnd; j++) {
		const item = newHeadings[j]!;
		const key = item.heading;
		const list = newGroups.get(key) ?? [];
		list.push({
			index: j,
			level: item.level,
			line: item.line,
			charCount: item.charCount,
			preview: item.preview,
		});
		newGroups.set(key, list);
	}

	for (const [key, newItems] of newGroups.entries()) {
		const oldItems = oldGroups.get(key);
		if (!oldItems || oldItems.length === 0) continue;

		if (newItems.length === 1 && oldItems.length === 1) {
			const targetOcc = oldItems[0]!.assignedOccurrence;
			if (targetOcc !== undefined) {
				overrides.set(newItems[0]!.index, targetOcc);
				newHeadings[newItems[0]!.index]!.assignedOccurrence = targetOcc;
			}
			continue;
		}

		const hasAnyAssigned = oldItems.some((o) => o.assignedOccurrence !== undefined);

		// When count matches exactly, maintain 1-to-1 mapping unless preview suggests otherwise
		if (newItems.length === oldItems.length) {
			let allPreviewsMatch = true;
			for (let k = 0; k < newItems.length; k++) {
				const n = newItems[k]!;
				const o = oldItems[k]!;
				if (n.preview && o.preview && n.preview !== o.preview) {
					allPreviewsMatch = false;
					break;
				}
			}
			if (allPreviewsMatch) {
				for (let k = 0; k < newItems.length; k++) {
					const targetOcc = hasAnyAssigned
						? oldItems[k]!.assignedOccurrence
						: oldItems[k]!.occ;
					if (targetOcc !== undefined) {
						overrides.set(newItems[k]!.index, targetOcc);
						newHeadings[newItems[k]!.index]!.assignedOccurrence = targetOcc;
					}
				}
				continue;
			}
		}

		// When count differs or previews differ (headings inserted, deleted, or reordered)
		const usedOld = new Set<number>();
		const usedNew = new Set<number>();

		// Step 1: Match by identical body preview (high-confidence identity match)
		for (let nIdx = 0; nIdx < newItems.length; nIdx++) {
			const nItem = newItems[nIdx]!;
			if (!nItem.preview || nItem.preview.trim().length < 3) continue;

			let bestOldIdx = -1;
			let bestScore = -1;

			for (let oIdx = 0; oIdx < oldItems.length; oIdx++) {
				if (usedOld.has(oIdx)) continue;
				const oItem = oldItems[oIdx]!;
				if (!oItem.preview || oItem.preview.trim().length < 3) continue;

				if (nItem.preview === oItem.preview) {
					let score = 1000;
					if (nItem.level === oItem.level) {
						score += 100;
					}
					if (oItem.assignedOccurrence !== undefined) {
						score += 100;
					}
					if (typeof nItem.charCount === 'number' && typeof oItem.charCount === 'number') {
						score -= Math.min(200, Math.abs(nItem.charCount - oItem.charCount));
					}
					if (typeof nItem.line === 'number' && typeof oItem.line === 'number') {
						score -= Math.min(200, Math.abs(nItem.line - oItem.line));
					}
					if (score > bestScore) {
						bestScore = score;
						bestOldIdx = oIdx;
					}
				}
			}

			if (bestOldIdx !== -1) {
				const oItem = oldItems[bestOldIdx]!;
				const targetOcc = oItem.assignedOccurrence ?? (hasAnyAssigned ? undefined : oItem.occ);
				if (targetOcc !== undefined) {
					overrides.set(nItem.index, targetOcc);
					newHeadings[nItem.index]!.assignedOccurrence = targetOcc;
				}
				usedOld.add(bestOldIdx);
				usedNew.add(nIdx);
			}
		}

		// Step 2: Match by closest charCount for substantial bodies
		for (let nIdx = 0; nIdx < newItems.length; nIdx++) {
			if (usedNew.has(nIdx)) continue;
			const nItem = newItems[nIdx]!;
			if (typeof nItem.charCount !== 'number' || nItem.charCount <= 20) continue;

			let bestOldIdx = -1;
			let bestDiff = Infinity;
			for (let oIdx = 0; oIdx < oldItems.length; oIdx++) {
				if (usedOld.has(oIdx)) continue;
				const oItem = oldItems[oIdx]!;
				if (typeof oItem.charCount === 'number' && oItem.charCount > 20) {
					const diff = Math.abs(oItem.charCount - nItem.charCount);
					const effectiveDiff = oItem.assignedOccurrence !== undefined ? diff : diff + 50;
					if (effectiveDiff < bestDiff) {
						bestDiff = effectiveDiff;
						bestOldIdx = oIdx;
					}
				}
			}

			if (bestOldIdx !== -1 && (bestDiff < 30 || bestDiff < nItem.charCount * 0.1)) {
				const oItem = oldItems[bestOldIdx]!;
				const targetOcc = oItem.assignedOccurrence ?? (hasAnyAssigned ? undefined : oItem.occ);
				if (targetOcc !== undefined) {
					overrides.set(nItem.index, targetOcc);
					newHeadings[nItem.index]!.assignedOccurrence = targetOcc;
				}
				usedOld.add(bestOldIdx);
				usedNew.add(nIdx);
			}
		}

		// Step 3: Monotonic sequence alignment for remaining unmatched items (DP)
		const remainingOldIndices: number[] = [];
		for (let oIdx = 0; oIdx < oldItems.length; oIdx++) {
			if (!usedOld.has(oIdx)) remainingOldIndices.push(oIdx);
		}

		const remainingNewIndices: number[] = [];
		for (let nIdx = 0; nIdx < newItems.length; nIdx++) {
			if (!usedNew.has(nIdx)) remainingNewIndices.push(nIdx);
		}

		if (remainingOldIndices.length > 0 && remainingNewIndices.length > 0) {
			const M = remainingOldIndices.length;
			const N = remainingNewIndices.length;
			const scoreMatrix: number[][] = Array.from({ length: M }, () => new Array<number>(N).fill(0));

			for (let i = 0; i < M; i++) {
				const oItem = oldItems[remainingOldIndices[i]!]!;
				for (let j = 0; j < N; j++) {
					const nItem = newItems[remainingNewIndices[j]!]!;
					let score = 20; // Base match score for same heading name
					if (nItem.level === oItem.level) {
						score += 40;
					}

					// Strongly prioritize preserving confirmed historical headings
					if (oItem.assignedOccurrence !== undefined) {
						score += 150;
					} else if (newItems.length < oldItems.length) {
						score -= 50; // In deletions, penalize matching temporary unassigned insertions
					}

					// Index proximity in heading list
					if (cursorLine === undefined || newItems.length === oldItems.length) {
						const indexDist = Math.abs(nItem.index - oItem.index);
						score += Math.max(0, 40 - indexDist * 8);
					}

					if (typeof oItem.line === 'number' && typeof nItem.line === 'number') {
						if (cursorLine !== undefined) {
							if (newItems.length < oldItems.length) {
								// Deletion: old item nearest to cursorLine was the deleted one!
								const distToCursor = Math.abs(oItem.line - cursorLine);
								if (distToCursor <= 1) {
									score -= 200; // Strongly penalize matching the deleted old item
								} else if (oItem.line > cursorLine) {
									// Old items below deletion point shifted up
									if (nItem.line <= oItem.line) {
										score += 50;
									} else {
										score -= 30;
									}
								} else {
									// Old items above deletion point remained at same line
									const lineDist = Math.abs(nItem.line - oItem.line);
									score += Math.max(0, 100 - lineDist);
								}
							} else if (newItems.length > oldItems.length) {
								// Insertion: new item nearest to cursorLine was the inserted one!
								const distToCursor = Math.abs(nItem.line - cursorLine);
								if (distToCursor <= 1) {
									score -= 200; // Strongly penalize matching newly inserted item to old items
								} else if (nItem.line > cursorLine) {
									// Items below insertion point shifted down
									if (nItem.line >= oItem.line) {
										score += 50;
									} else {
										score -= 30;
									}
								} else {
									// Items above insertion point remained at same line
									const lineDist = Math.abs(nItem.line - oItem.line);
									score += Math.max(0, 100 - lineDist);
								}
							} else {
								const lineDist = Math.abs(nItem.line - oItem.line);
								score += Math.max(0, 100 - lineDist);
							}
						} else {
							const lineDist = Math.abs(nItem.line - oItem.line);
							score += Math.max(0, 100 - lineDist);

							// Shift direction consistency
							if (newItems.length > oldItems.length) {
								if (nItem.line >= oItem.line) {
									score += 30;
								} else {
									score -= 20;
								}
							} else if (newItems.length < oldItems.length) {
								if (nItem.line <= oItem.line) {
									score += 30;
								} else {
									score -= 20;
								}
							}
						}
					}

					if (typeof oItem.charCount === 'number' && typeof nItem.charCount === 'number') {
						const charDist = Math.abs(nItem.charCount - oItem.charCount);
						score += Math.max(0, 50 - charDist);
					}

					scoreMatrix[i]![j] = score;
				}
			}

			const dp: number[][] = Array.from({ length: M + 1 }, () => new Array<number>(N + 1).fill(0));

			for (let i = 1; i <= M; i++) {
				for (let j = 1; j <= N; j++) {
					const matchScore = (dp[i - 1]![j - 1] ?? 0) + (scoreMatrix[i - 1]![j - 1] ?? 0);
					const skipOld = dp[i - 1]![j] ?? 0;
					const skipNew = dp[i]![j - 1] ?? 0;
					dp[i]![j] = Math.max(matchScore, skipOld, skipNew);
				}
			}

			let i = M;
			let j = N;
			const matchedPairs: Array<[number, number]> = [];

			while (i > 0 && j > 0) {
				const current = dp[i]![j]!;
				const matchScore = (dp[i - 1]![j - 1] ?? 0) + (scoreMatrix[i - 1]![j - 1] ?? 0);
				if (current === matchScore && (scoreMatrix[i - 1]![j - 1] ?? 0) > 0) {
					matchedPairs.push([remainingOldIndices[i - 1]!, remainingNewIndices[j - 1]!]);
					i--;
					j--;
				} else if (current === (dp[i - 1]![j] ?? 0)) {
					i--;
				} else {
					j--;
				}
			}

			for (const [oIdx, nIdx] of matchedPairs) {
				const oItem = oldItems[oIdx]!;
				const nItem = newItems[nIdx]!;
				const targetOcc = oItem.assignedOccurrence ?? (hasAnyAssigned ? undefined : oItem.occ);
				if (targetOcc !== undefined) {
					overrides.set(nItem.index, targetOcc);
					newHeadings[nItem.index]!.assignedOccurrence = targetOcc;
				}
				usedOld.add(oIdx);
				usedNew.add(nIdx);
			}
		}

		// Note: Unmatched items in newItems are genuinely new insertions and are intentionally NOT assigned
		// old occurrences. This prevents new headings from stealing goals from existing headings.
	}

	return overrides;
}
