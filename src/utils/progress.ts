import { MAX_OVERFLOW_SEGMENTS, OVERFLOW_SEGMENT_RANGE } from './constants';

/**
 * Calculates the segmented overflow progress bars for a given progress percentage.
 * When percentage <= 100, returns empty array (no overflow).
 * When 101 <= percentage <= 200, returns 1 segment (e.g. 150% -> [50], 200% -> [100]).
 * When 201 <= percentage <= 300, returns 2 segments (e.g. 250% -> [100, 50]).
 * When exceeding maxSegments * segmentRange + 100, caps at maxSegments with 100% each.
 */
export function calculateOverflowSegments(
	percentage: number,
	maxSegments: number = MAX_OVERFLOW_SEGMENTS,
	segmentRange: number = OVERFLOW_SEGMENT_RANGE,
): number[] {
	if (percentage <= 100) {
		return [];
	}

	const overflowAmount = percentage - 100;
	const requiredSegments = Math.ceil(overflowAmount / segmentRange);
	const numSegments = Math.min(requiredSegments, maxSegments);

	const segments: number[] = [];
	for (let i = 0; i < numSegments; i++) {
		if (i < numSegments - 1) {
			segments.push(100);
		} else {
			if (requiredSegments > maxSegments) {
				segments.push(100);
			} else {
				const currentSegmentProgress = ((overflowAmount - 1) % segmentRange) + 1;
				segments.push(Math.round(currentSegmentProgress));
			}
		}
	}

	return segments;
}
