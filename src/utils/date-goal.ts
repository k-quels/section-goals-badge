import { t } from '../lang/helpers';
import { DateCycle, DateCycleUnit, DateProgressInfo, DateReferenceMode, PluginSettings } from '../types';

/**
 * Parses a cycle string such as '1d', '2w', '1m', '1y' into a structured DateCycle object.
 */
export function parseCycle(cycleStr: string | undefined | null): DateCycle | null {
	if (!cycleStr) return null;
	const match = cycleStr.trim().match(/^(\d+)\s*([dwmy]|day|days|week|weeks|month|months|year|years)$/i);
	if (!match) return null;

	const value = parseInt(match[1]!, 10);
	if (isNaN(value) || value <= 0) return null;

	const unitStr = match[2]!.toLowerCase();
	let unit: DateCycleUnit;
	if (unitStr.startsWith('d')) {
		unit = 'day';
	} else if (unitStr.startsWith('w')) {
		unit = 'week';
	} else if (unitStr.startsWith('m')) {
		unit = 'month';
	} else if (unitStr.startsWith('y')) {
		unit = 'year';
	} else {
		return null;
	}

	return { value, unit };
}

/**
 * Formats a DateCycle object into a compact string like '1d', '2w', '1m', '1y'.
 */
export function formatCycle(cycle: DateCycle | null | undefined): string {
	if (!cycle || cycle.value <= 0) return '';
	const unitChar = cycle.unit === 'day' ? 'd' : cycle.unit === 'week' ? 'w' : cycle.unit === 'month' ? 'm' : 'y';
	return `${cycle.value}${unitChar}`;
}

/**
 * Formats a Date object to 'YYYY-MM-DD' string in local time.
 */
export function formatDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/**
 * Normalizes user input into standard 'HH:mm' time format.
 * Supports:
 * - 'HH:mm' or 'H:mm' (e.g. '9:30' -> '09:30')
 * - 4 digits: 'HHmm' (e.g. '2100' -> '21:00', '0930' -> '09:30')
 * - 3 digits: 'Hmm' (e.g. '900' -> '09:00', '930' -> '09:30')
 * - 1-2 digits: 'HH' (e.g. '21' -> '21:00', '9' -> '09:00')
 */
export function normalizeTimeInput(timeStr: string | undefined | null): string | undefined {
	if (!timeStr) return undefined;
	const trimmed = timeStr.trim();
	if (!trimmed) return undefined;

	// 'HH:mm' or 'H:mm'
	const colonMatch = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
	if (colonMatch) {
		return `${colonMatch[1]!.padStart(2, '0')}:${colonMatch[2]!}`;
	}

	// 4 digits: 'HHmm'
	const fourDigitMatch = trimmed.match(/^([01]?\d|2[0-3])([0-5]\d)$/);
	if (fourDigitMatch) {
		return `${fourDigitMatch[1]!.padStart(2, '0')}:${fourDigitMatch[2]!}`;
	}

	// 3 digits: 'Hmm'
	const threeDigitMatch = trimmed.match(/^([0-9])([0-5]\d)$/);
	if (threeDigitMatch) {
		return `0${threeDigitMatch[1]!}:${threeDigitMatch[2]!}`;
	}

	// 1-2 digits: 'HH'
	const hourMatch = trimmed.match(/^([01]?\d|2[0-3])$/);
	if (hourMatch) {
		return `${hourMatch[1]!.padStart(2, '0')}:00`;
	}

	return undefined;
}

/**
 * Checks whether a string is a valid time in 'HH:mm' format (00:00 - 23:59).
 */
export function isValidTimeString(timeStr: string | undefined | null): boolean {
	if (!timeStr) return false;
	const trimmed = timeStr.trim();
	return /^([01]?\d|2[0-3]):[0-5]\d$/.test(trimmed);
}

/**
 * Normalizes a 'YY-MM-DD', 'YYYY-MM-DD', 'YYYY/MM/DD', or pure digit 'YYYYMMDD', 'YYMMDD' string to standard 'YYYY-MM-DD'.
 */
export function normalizeDateInput(dateStr: string | undefined | null): string {
	if (!dateStr) return '';
	const trimmed = dateStr.trim();

	// Check with hyphen or slash separator: YYYY-MM-DD, YY-MM-DD, YYYY/MM/DD, YY/MM/DD
	const matchSep = trimmed.match(/^(\d{2,4})[-/](\d{1,2})[-/](\d{1,2})$/);
	if (matchSep) {
		let year = parseInt(matchSep[1]!, 10);
		if (year < 100) year += 2000;
		const mm = matchSep[2]!.padStart(2, '0');
		const dd = matchSep[3]!.padStart(2, '0');
		return `${year}-${mm}-${dd}`;
	}

	// Check 8 digits: YYYYMMDD (e.g. 20261008)
	const match8 = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
	if (match8) {
		const year = match8[1]!;
		const mm = match8[2]!;
		const dd = match8[3]!;
		return `${year}-${mm}-${dd}`;
	}

	// Check 6 digits: YYMMDD (e.g. 261008)
	const match6 = trimmed.match(/^(\d{2})(\d{2})(\d{2})$/);
	if (match6) {
		const year = parseInt(match6[1]!, 10) + 2000;
		const mm = match6[2]!;
		const dd = match6[3]!;
		return `${year}-${mm}-${dd}`;
	}

	return trimmed;
}

/**
 * Formats a date string to short 'YY-MM-DD' display format.
 */
export function formatShortDate(dateStr: string | undefined | null): string {
	if (!dateStr) return '';
	const normalized = normalizeDateInput(dateStr);
	const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return '';
	const yy = match[1]!.slice(2);
	const mm = match[2]!;
	const dd = match[3]!;
	return `${yy}-${mm}-${dd}`;
}

/**
 * Extracts normalized date (YYYY-MM-DD) and optional time (HH:mm) from a date/datetime string.
 */
export function extractDateAndTime(dateTimeStr: string | undefined | null): { date: string; time?: string } {
	if (!dateTimeStr) return { date: '' };
	const trimmed = dateTimeStr.trim();

	// Check if string contains only time (HH:mm or numeric time e.g. 2100)
	const timeOnly = normalizeTimeInput(trimmed);
	if (timeOnly && !/^\d{6,8}$/.test(trimmed) && !/[-/]/.test(trimmed)) {
		return { date: '', time: timeOnly };
	}

	const parts = trimmed.split(/\s+/);
	const datePart = normalizeDateInput(parts[0]);
	let timePart: string | undefined;

	if (parts.length > 1) {
		timePart = normalizeTimeInput(parts[1]);
	}

	return { date: datePart, time: timePart };
}

/**
 * Combines date string and time string into standard format.
 * If time is provided, returns 'YYYY-MM-DD HH:mm'. Otherwise returns 'YYYY-MM-DD'.
 * If date is empty but time is provided, returns 'HH:mm'.
 */
export function combineDateAndTime(dateStr: string | undefined | null, timeStr: string | undefined | null): string {
	const normalized = normalizeDateInput(dateStr);
	const validTime = normalizeTimeInput(timeStr);

	if (!normalized) {
		return validTime || '';
	}
	if (!validTime) {
		return normalized;
	}
	return `${normalized} ${validTime}`;
}

/**
 * Formats a Date object and original string representation, preserving time if originally present.
 */
function formatWithOriginalTime(date: Date, originalStr: string | undefined | null): string {
	const { time } = extractDateAndTime(originalStr);
	return combineDateAndTime(formatDate(date), time);
}

/**
 * Parses a 'YYYY-MM-DD' or 'YY-MM-DD' string with optional time into a Date object.
 * If time is omitted in string, uses defaultTime (e.g. '00:00' or '23:59').
 */
export function parseDateTime(dateTimeStr: string | undefined | null, defaultTime = '00:00'): Date | null {
	if (!dateTimeStr) return null;
	const { date, time } = extractDateAndTime(dateTimeStr);
	if (!date) return null;

	const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return null;

	const year = parseInt(match[1]!, 10);
	const month = parseInt(match[2]!, 10) - 1;
	const day = parseInt(match[3]!, 10);

	const effectiveTime = time || defaultTime;
	const timeMatch = effectiveTime.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
	const hour = timeMatch ? parseInt(timeMatch[1]!, 10) : 0;
	const minute = timeMatch ? parseInt(timeMatch[2]!, 10) : 0;

	const d = new Date(year, month, day, hour, minute, 0, 0);
	if (isNaN(d.getTime())) return null;
	if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
		return null;
	}
	return d;
}

/**
 * Parses a 'YYYY-MM-DD' or 'YY-MM-DD' string into a Date object at midnight local time.
 */
export function parseDate(dateStr: string | undefined | null): Date | null {
	if (!dateStr) return null;
	const { date } = extractDateAndTime(dateStr);
	if (!date) return null;
	const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return null;

	const year = parseInt(match[1]!, 10);
	const month = parseInt(match[2]!, 10) - 1;
	const day = parseInt(match[3]!, 10);

	const d = new Date(year, month, day, 0, 0, 0, 0);
	if (isNaN(d.getTime())) return null;
	if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
		return null;
	}
	return d;
}

/**
 * Checks whether a date string is a valid, existing calendar date in 'YYYY-MM-DD' or 'YY-MM-DD' format.
 */
export function isValidDateString(dateStr: string | undefined | null): boolean {
	if (!dateStr) return false;
	const { date } = extractDateAndTime(dateStr);
	return parseDate(date) !== null;
}

/**
 * Checks whether a string is a valid date, a valid date + time, or a valid time-only string.
 */
export function isValidDateOrTimeString(dateTimeStr: string | undefined | null): boolean {
	if (!dateTimeStr) return false;
	const { date, time } = extractDateAndTime(dateTimeStr);
	const hasValidDate = Boolean(date && parseDate(date) !== null);
	const hasValidTime = Boolean(time && isValidTimeString(time));
	if (hasValidDate) return true;
	if (hasValidTime && !date) return true;
	return false;
}

/**
 * Helper to advance a date by a given cycle.
 */
export function addCycle(date: Date, cycle: DateCycle, count = 1): Date {
	const res = new Date(date.getTime());
	const amount = cycle.value * count;
	switch (cycle.unit) {
		case 'day':
			res.setDate(res.getDate() + amount);
			break;
		case 'week':
			res.setDate(res.getDate() + amount * 7);
			break;
		case 'month':
			res.setMonth(res.getMonth() + amount);
			break;
		case 'year':
			res.setFullYear(res.getFullYear() + amount);
			break;
	}
	return res;
}

/**
 * Helper to subtract a cycle from a date.
 */
export function subtractCycle(date: Date, cycle: DateCycle, count = 1): Date {
	const res = new Date(date.getTime());
	const amount = cycle.value * count;
	switch (cycle.unit) {
		case 'day':
			res.setDate(res.getDate() - amount);
			break;
		case 'week':
			res.setDate(res.getDate() - amount * 7);
			break;
		case 'month':
			res.setMonth(res.getMonth() - amount);
			break;
		case 'year':
			res.setFullYear(res.getFullYear() - amount);
			break;
	}
	return res;
}

/**
 * Calculates dynamic cycle dates based on the base start and target dates and current date.
 * If targetDate is set and cycle is present, shifts the cycle forward until currentTarget >= today.
 */
export function calculateDynamicCycleDates(
	startDateStr: string | undefined | null,
	targetDateStr: string | undefined | null,
	cycleStr: string | undefined | null,
	today: Date = new Date(),
	defaultStartTime = '00:00',
	defaultTargetTime = '23:59',
): { currentStart?: string; currentTarget?: string } {
	const parsedTarget = parseDateTime(targetDateStr, defaultTargetTime);
	if (!parsedTarget) {
		return {
			currentStart: startDateStr ?? undefined,
			currentTarget: targetDateStr ?? undefined,
		};
	}

	const cycle = parseCycle(cycleStr);
	if (!cycle) {
		return {
			currentStart: startDateStr ?? undefined,
			currentTarget: targetDateStr ?? undefined,
		};
	}

	const parsedStart = parseDateTime(startDateStr, defaultStartTime);

	let curTarget = new Date(parsedTarget.getTime());
	let curStart = parsedStart ? new Date(parsedStart.getTime()) : null;

	// If today is past the target date, advance cycle until curTarget >= today.
	// Fast-forward fixed-duration cycles (day, week) in O(1) to avoid allocating hundreds of Dates.
	if (curTarget.getTime() < today.getTime()) {
		if (cycle.unit === 'day' || cycle.unit === 'week') {
			const cycleMs = cycle.value * (cycle.unit === 'day' ? 1 : 7) * 24 * 60 * 60 * 1000;
			const diffMs = today.getTime() - curTarget.getTime();
			const skipCount = Math.floor(diffMs / cycleMs);
			if (skipCount > 0) {
				curTarget = addCycle(curTarget, cycle, skipCount);
				if (curStart) {
					curStart = addCycle(curStart, cycle, skipCount);
				}
			}
		}
	}

	let iterations = 0;
	const maxIterations = 5000;
	while (curTarget.getTime() < today.getTime() && iterations < maxIterations) {
		curTarget = addCycle(curTarget, cycle, 1);
		if (curStart) {
			curStart = addCycle(curStart, cycle, 1);
		}
		iterations++;
	}

	// For repeating cycle goals, ensure a valid preceding start date:
	// If no start date was explicitly given, or if start date is >= target date,
	// automatically derive start date as exactly one cycle period prior to curTarget.
	if (!curStart || curStart.getTime() >= curTarget.getTime()) {
		curStart = subtractCycle(curTarget, cycle, 1);
	}

	return {
		currentStart: curStart ? formatWithOriginalTime(curStart, startDateStr) : undefined,
		currentTarget: formatWithOriginalTime(curTarget, targetDateStr),
	};
}

/**
 * Calculates date progress info given start, target, cycle and reference today.
 */
export function calculateDateProgress(
	startDateStr: string | undefined | null,
	targetDateStr: string | undefined | null,
	cycleStr: string | undefined | null,
	today: Date = new Date(),
	isFallback = false,
	defaultStartTime = '00:00',
	defaultTargetTime = '23:59',
): DateProgressInfo | null {
	if (!targetDateStr && !startDateStr) {
		return null;
	}

	const { currentStart, currentTarget } = calculateDynamicCycleDates(
		startDateStr,
		targetDateStr,
		cycleStr,
		today,
		defaultStartTime,
		defaultTargetTime,
	);

	const parsedTarget = parseDateTime(currentTarget, defaultTargetTime);
	if (!parsedTarget) {
		return null;
	}

	const diffMs = parsedTarget.getTime() - today.getTime();
	const isOverdue = diffMs < 0;

	const msInHour = 1000 * 60 * 60;
	const msInDay = 24 * msInHour;

	const targetMidnight = new Date(parsedTarget.getFullYear(), parsedTarget.getMonth(), parsedTarget.getDate(), 0, 0, 0, 0);
	const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
	const calendarDaysDiff = Math.round((targetMidnight.getTime() - todayMidnight.getTime()) / msInDay);

	let remainingDays: number;
	let remainingHours: number;

	if (!isOverdue) {
		if (diffMs < msInDay) {
			remainingDays = 0;
			remainingHours = Math.ceil(diffMs / msInHour);
		} else {
			remainingDays = Math.floor(diffMs / msInDay);
			remainingHours = Math.floor((diffMs % msInDay) / msInHour);
		}
	} else {
		const absMs = Math.abs(diffMs);
		if (calendarDaysDiff === 0) {
			// Target was today, but time passed earlier today
			remainingDays = 0;
			remainingHours = -Math.ceil(absMs / msInHour);
		} else {
			// Target date was yesterday or earlier
			const daysOverdue = Math.max(1, Math.abs(calendarDaysDiff));
			remainingDays = -daysOverdue;
			remainingHours = Math.floor((absMs % msInDay) / msInHour);
		}
	}

	// Percentage calculation
	let percentage: number | undefined;
	const parsedStart = parseDateTime(currentStart, defaultStartTime);
	if (parsedStart) {
		const totalSpan = parsedTarget.getTime() - parsedStart.getTime();
		const elapsedSpan = today.getTime() - parsedStart.getTime();

		if (totalSpan <= 0) {
			percentage = 100;
		} else if (elapsedSpan <= 0) {
			percentage = 0;
		} else {
			percentage = Math.round((elapsedSpan / totalSpan) * 1000) / 10; // 1 decimal place
		}
	}

	return {
		targetDate: targetDateStr ?? undefined,
		startDate: startDateStr ?? undefined,
		cycle: cycleStr ?? undefined,
		currentCycleStart: currentStart,
		currentCycleTarget: currentTarget,
		remainingDays,
		remainingHours,
		percentage,
		isOverdue,
		isFallback,
	};
}

/**
 * Gets color for date progress according to settings thresholds.
 */
export function getDateProgressColor(
	info: DateProgressInfo,
	settings: PluginSettings,
): string {
	const warnThreshold = settings.dateThresholdWarn ?? 50;
	const urgentThreshold = settings.dateThresholdUrgent ?? 75;
	const overdueThreshold = settings.dateThresholdOverdue ?? 100;

	if (info.isOverdue) {
		return settings.dateColorOverdue;
	}

	if (info.percentage !== undefined) {
		if (info.percentage >= overdueThreshold) {
			return settings.dateColorOverdue;
		}
		if (info.percentage >= urgentThreshold) {
			return settings.dateColorUrgent;
		}
		if (info.percentage >= warnThreshold) {
			return settings.dateColorWarn;
		}
		return settings.dateColorNormal;
	}

	// When start date is missing and percentage is undefined,
	// rely on remaining days
	if (info.remainingDays !== undefined) {
		if (info.remainingDays <= 0) {
			return settings.dateColorOverdue;
		}
		if (info.remainingDays <= 1) {
			return settings.dateColorUrgent;
		}
		if (info.remainingDays <= 3) {
			return settings.dateColorWarn;
		}
	}

	return settings.dateColorNormal;
}

const WEEKDAY_KEYS = [
	'WEEKDAY_SUN',
	'WEEKDAY_MON',
	'WEEKDAY_TUE',
	'WEEKDAY_WED',
	'WEEKDAY_THU',
	'WEEKDAY_FRI',
	'WEEKDAY_SAT',
] as const;

/**
 * Returns a short weekday label for a given date string using the active locale.
 */
export function getWeekdayLabel(dateStr: string | undefined | null): string | null {
	if (!dateStr) return null;
	const d = parseDate(dateStr);
	if (!d) return null;
	const dayIdx = d.getDay();
	const key = WEEKDAY_KEYS[dayIdx];
	return key ? t(key) : null;
}

export interface ResolvedSectionDateGoal {
	heading: string;
	target?: string;
	start?: string;
	cycle?: string;
	effectiveCycle?: string;
	isTargetChained: boolean;
	isStartChained: boolean;
	isFallback: boolean;
	effectiveTargetTime?: string;
	effectiveStartTime?: string;
}

export interface SectionHeadingItem {
	heading: string;
	level?: number;
}

/**
 * Builds a parent index map from a flat list of sections using their heading level.
 * parentIndexMap.get(i) returns the index of the parent section, or null if root.
 */
export function buildParentIndexMap(
	sections: Array<{ level?: number }>,
): Map<number, number | null> {
	const parentIndexMap = new Map<number, number | null>();
	const stack: Array<{ level: number; index: number }> = [];

	for (let i = 0; i < sections.length; i++) {
		const sec = sections[i]!;
		const level = sec.level ?? 1;
		while (stack.length > 0 && stack[stack.length - 1]!.level >= level) {
			stack.pop();
		}
		parentIndexMap.set(i, stack.length > 0 ? stack[stack.length - 1]!.index : null);
		stack.push({ level, index: i });
	}

	return parentIndexMap;
}

/**
 * Determines which anchor section (or root 0) a given section inherits its schedule from.
 * Returns the anchor section index, or null if dateReference is 'none' or cycle is explicitly disabled.
 */
export function getSectionScheduleAnchor(
	index: number,
	normalizedSections: Array<{ heading: string; level: number }>,
	parentIndexMap: Map<number, number | null>,
	goalsMap: Map<string | number, { start?: string; target?: string; cycle?: string }>,
	dateReference: 'parent' | 'note' | 'none',
	fileTargetDate?: string | null,
	fileCycle?: string | null,
): number | null {
	if (dateReference !== 'parent') {
		return null;
	}

	const hasIndexMapping = Array.from(goalsMap.keys()).some((k) => typeof k === 'number');
	const getGoal = (idx: number) =>
		hasIndexMapping ? goalsMap.get(idx) : (goalsMap.get(idx) ?? goalsMap.get(normalizedSections[idx]!.heading));

	const currentGoal = getGoal(index);
	const rawCycle = currentGoal?.cycle?.trim();

	// If this section explicitly disables cycle, it belongs to no schedule chain
	if (rawCycle === 'none') {
		return null;
	}

	const isAnchorSection = (idx: number): boolean => {
		const g = getGoal(idx);
		const c = g?.cycle?.trim();
		if (c === 'none') return false;
		const hasC = Boolean(c && parseCycle(c));
		if (hasC) return true;

		// Explicit target date without explicit cycle:
		// Sub-headings (e.g. H2 with child H3s) act as local sub-anchors for their descendants.
		// Root H1 headings without explicit cycle belong to the overall note schedule chain (anchor 0).
		const hasT = Boolean(g?.target && g.target.trim() !== '');
		if (hasT && idx > 0) {
			const pIdx = parentIndexMap.get(idx);
			if (pIdx !== null && pIdx !== undefined) {
				return true;
			}
		}

		if (idx === 0) {
			const hasFileDate = Boolean(fileTargetDate && fileTargetDate.trim() !== '');
			const hasFileC = Boolean(fileCycle && parseCycle(fileCycle));
			return hasFileDate || hasFileC;
		}
		return false;
	};

	// 1. If this section is itself an anchor, it is its own anchor
	if (isAnchorSection(index)) {
		return index;
	}

	// 2. Look up parent heading hierarchy (ancestors) for an anchor
	let curP = parentIndexMap.get(index);
	while (curP !== null && curP !== undefined) {
		const pGoal = getGoal(curP);
		if (pGoal?.cycle?.trim() === 'none') {
			return null;
		}
		if (isAnchorSection(curP)) {
			return curP;
		}
		curP = parentIndexMap.get(curP);
	}

	// 3. Fallback: inherits from root anchor (0) if root is an anchor
	if (isAnchorSection(0)) {
		return 0;
	}

	return null;
}

/**
 * Resolves the effective cycle inherited from parent section or note for a specific section index.
 */
export function getSectionEffectiveParentCycle(
	index: number,
	normalizedSections: Array<{ heading: string; level: number }>,
	parentIndexMap: Map<number, number | null>,
	goalsMap: Map<string | number, { cycle?: string }>,
	fileCycle: string | undefined | null,
	dateReference: 'parent' | 'note' | 'none',
	_fileTargetDate?: string | null,
): string | undefined {
	if (index === 0 || dateReference === 'none') {
		return undefined;
	}
	if (dateReference === 'note') {
		return fileCycle && parseCycle(fileCycle) ? fileCycle : undefined;
	}

	const hasIndexMapping = Array.from(goalsMap.keys()).some((k) => typeof k === 'number');
	const getGoal = (idx: number) =>
		hasIndexMapping ? goalsMap.get(idx) : (goalsMap.get(idx) ?? goalsMap.get(normalizedSections[idx]!.heading));

	// Look up parent heading hierarchy (ancestors) for an inherited cycle
	let curP = parentIndexMap.get(index);
	while (curP !== null && curP !== undefined) {
		const pGoal = getGoal(curP);
		const pCycle = pGoal?.cycle?.trim();
		if (pCycle === 'none') {
			return undefined;
		}
		if (pCycle && parseCycle(pCycle)) {
			return pCycle;
		}
		curP = parentIndexMap.get(curP);
	}

	// Fallback to root section (0) or note cycle if no ancestor has an explicit cycle
	const rootGoal = getGoal(0);
	const rootCycle = rootGoal?.cycle?.trim();
	if (rootCycle === 'none') {
		return undefined;
	}
	if (rootCycle && parseCycle(rootCycle)) {
		return rootCycle;
	}

	return fileCycle && parseCycle(fileCycle) ? fileCycle : undefined;
}

/**
 * Matches document sections with frontmatter section date goals.
 * Handles duplicate headings, 1-to-1 unique match fallback for renamed headings,
 * and exact occurrence index matching.
 */
export function matchSectionDateGoals<
	S extends { heading: string },
	G extends { heading: string; index?: number; occurrence?: number }
>(
	sections: S[],
	goals: G[],
	occurrenceOverrides?: Map<number, number>,
): Map<number, G> {
	const result = new Map<number, G>();
	if (!sections || sections.length === 0 || !goals || goals.length === 0) {
		return result;
	}

	// Group document section indices by heading name
	const docSectionsByHeading = new Map<string, number[]>();
	for (let i = 0; i < sections.length; i++) {
		const h = sections[i]!.heading;
		const list = docSectionsByHeading.get(h) ?? [];
		list.push(i);
		docSectionsByHeading.set(h, list);
	}

	// Group frontmatter goals by heading name
	const fmGoalsByHeading = new Map<string, G[]>();
	for (const item of goals) {
		const list = fmGoalsByHeading.get(item.heading) ?? [];
		list.push(item);
		fmGoalsByHeading.set(item.heading, list);
	}

	for (const [h, docIndices] of docSectionsByHeading.entries()) {
		const fmItems = fmGoalsByHeading.get(h);
		if (!fmItems || fmItems.length === 0) continue;

		// Rule 1: 1-to-1 unique match
		// If exactly 1 heading exists in the document and 1 in frontmatter, match them unconditionally
		// even if occurrence/index numbers mismatch due to previous renames or additions.
		if (docIndices.length === 1 && fmItems.length === 1) {
			result.set(docIndices[0]!, fmItems[0]!);
			continue;
		}

		// Rule 2: Multiple headings
		// Determine explicit or inferred occurrence for each frontmatter item:
		// If index/occurrence is omitted, assign available positive integer occurrences starting from 1.
		const fmItemOccurrences: number[] = new Array<number>(fmItems.length);
		const assignedOccs = new Set<number>();
		for (let fmIdx = 0; fmIdx < fmItems.length; fmIdx++) {
			const item = fmItems[fmIdx]!;
			const explicitOcc = item.index ?? item.occurrence;
			if (typeof explicitOcc === 'number') {
				fmItemOccurrences[fmIdx] = explicitOcc;
				assignedOccs.add(explicitOcc);
			}
		}
		let nextDefaultOcc = 1;
		for (let fmIdx = 0; fmIdx < fmItems.length; fmIdx++) {
			if (fmItemOccurrences[fmIdx] === undefined) {
				while (assignedOccs.has(nextDefaultOcc)) {
					nextDefaultOcc++;
				}
				fmItemOccurrences[fmIdx] = nextDefaultOcc;
				assignedOccs.add(nextDefaultOcc);
			}
		}

		const executeMatch = (useOverrides: boolean): Map<number, G> => {
			const subResult = new Map<number, G>();
			const usedFmIndices = new Set<number>();
			const matchedDocIndices = new Set<number>();

			// Pass 1: Explicit occurrenceOverrides match ONLY
			if (useOverrides && occurrenceOverrides && occurrenceOverrides.size > 0) {
				for (let occIdx = 0; occIdx < docIndices.length; occIdx++) {
					const targetDocIdx = docIndices[occIdx]!;
					const overrideOcc = occurrenceOverrides.get(targetDocIdx);
					if (overrideOcc !== undefined) {
						for (let fmIdx = 0; fmIdx < fmItems.length; fmIdx++) {
							if (usedFmIndices.has(fmIdx)) continue;
							const itemOcc = fmItemOccurrences[fmIdx]!;
							if (itemOcc === overrideOcc) {
								subResult.set(targetDocIdx, fmItems[fmIdx]!);
								usedFmIndices.add(fmIdx);
								matchedDocIndices.add(targetDocIdx);
								break;
							}
						}
					}
				}
			}

			// Pass 2: Exact occurrence/index match
			for (let occIdx = 0; occIdx < docIndices.length; occIdx++) {
				const targetDocIdx = docIndices[occIdx]!;
				if (matchedDocIndices.has(targetDocIdx)) continue;

				if (useOverrides && occurrenceOverrides && occurrenceOverrides.has(targetDocIdx)) {
					continue;
				}

				const occ = occIdx + 1;
				for (let fmIdx = 0; fmIdx < fmItems.length; fmIdx++) {
					if (usedFmIndices.has(fmIdx)) continue;
					const itemOcc = fmItemOccurrences[fmIdx]!;
					if (itemOcc === occ) {
						subResult.set(targetDocIdx, fmItems[fmIdx]!);
						usedFmIndices.add(fmIdx);
						matchedDocIndices.add(targetDocIdx);
						break;
					}
				}
			}

			// Pass 3: Match unindexed goals
			for (let occIdx = 0; occIdx < docIndices.length; occIdx++) {
				const targetDocIdx = docIndices[occIdx]!;
				if (matchedDocIndices.has(targetDocIdx)) continue;

				if (useOverrides && occurrenceOverrides && occurrenceOverrides.has(targetDocIdx)) {
					continue;
				}

				for (let fmIdx = 0; fmIdx < fmItems.length; fmIdx++) {
					if (usedFmIndices.has(fmIdx)) continue;
					const item = fmItems[fmIdx]!;
					const itemOcc = item.index ?? item.occurrence;
					if (itemOcc === undefined) {
						subResult.set(targetDocIdx, item);
						usedFmIndices.add(fmIdx);
						matchedDocIndices.add(targetDocIdx);
						break;
					}
				}
			}

			// Pass 4: Fallback match ONLY when overrides are not active
			if (!useOverrides && usedFmIndices.size < fmItems.length) {
				for (let occIdx = 0; occIdx < docIndices.length; occIdx++) {
					const targetDocIdx = docIndices[occIdx]!;
					if (matchedDocIndices.has(targetDocIdx)) continue;

					for (let fmIdx = 0; fmIdx < fmItems.length; fmIdx++) {
						if (usedFmIndices.has(fmIdx)) continue;
						const item = fmItems[fmIdx]!;
						const itemOcc = item.index ?? item.occurrence;
						if (typeof itemOcc === 'number' && itemOcc > docIndices.length) {
							continue;
						}
						subResult.set(targetDocIdx, item);
						usedFmIndices.add(fmIdx);
						matchedDocIndices.add(targetDocIdx);
						break;
					}
					if (usedFmIndices.size >= fmItems.length) break;
				}
			}

			return subResult;
		};

		let chosenMatch = executeMatch(Boolean(occurrenceOverrides && occurrenceOverrides.size > 0));

		// If overrides are present, check if natural physical matching preserves strictly MORE frontmatter goals.
		// When a cut section is restored via Undo, historical overrides can become stale and cause valid goals
		// to be dropped or shifted. Natural matching rescues all restored goals seamlessly.
		if (occurrenceOverrides && occurrenceOverrides.size > 0) {
			const naturalMatch = executeMatch(false);
			if (naturalMatch.size > chosenMatch.size) {
				chosenMatch = naturalMatch;
			}
		}

		for (const [k, v] of chosenMatch.entries()) {
			result.set(k, v);
		}
	}

	return result;
}

/**
 * Normalizes a section goal item from either `{ [heading]: goal }` or `{ heading, goal?, index?, target-date?, ... }`
 * into a standardized structure.
 */
export function normalizeSectionGoalItem(
	item: unknown,
): { heading: string; goal?: number; index?: number; occurrence?: number; target?: string; start?: string; cycle?: string } | null {
	if (!item || typeof item !== 'object') return null;
	if ('heading' in item && typeof item.heading === 'string') {
		const typed = item as Record<string, unknown>;
		const heading = String(typed.heading);
		const goal = typeof typed.goal === 'number' && typed.goal > 0 ? typed.goal : undefined;
		const index = typeof typed.index === 'number' && typed.index > 0
			? typed.index
			: typeof typed.occurrence === 'number' && typed.occurrence > 0
				? typed.occurrence
				: undefined;
		const target = typeof typed['target-date'] === 'string'
			? typed['target-date'].trim()
			: typeof typed['target-date'] === 'number'
				? String(typed['target-date'])
				: typeof typed.target === 'string'
					? typed.target.trim()
					: typeof typed.target === 'number'
						? String(typed.target)
						: undefined;
		const start = typeof typed['start-date'] === 'string'
			? typed['start-date'].trim()
			: typeof typed['start-date'] === 'number'
				? String(typed['start-date'])
				: typeof typed.start === 'string'
					? typed.start.trim()
					: typeof typed.start === 'number'
						? String(typed.start)
						: undefined;
		const cycle = typeof typed.cycle === 'string' ? typed.cycle.trim() : undefined;

		return {
			heading,
			goal,
			index,
			occurrence: index,
			target,
			start,
			cycle,
		};
	}
	const entries = Object.entries(item as Record<string, unknown>);
	if (entries.length > 0) {
		const [h, g] = entries[0]!;
		if (typeof g === 'number') {
			return { heading: h, goal: g };
		}
	}
	return null;
}

/**
 * Matches document sections with section character count goals.
 * Supports both HeadingGoalItem (`{ "Heading": 1500 }`) and SectionGoalItem (`{ heading, goal, index }`).
 */
export function matchSectionGoals<S extends { heading: string }>(
	sections: S[],
	goals: unknown[],
	occurrenceOverrides?: Map<number, number>,
): Map<number, { heading: string; goal?: number; index?: number; occurrence?: number }> {
	const normalizedGoals: Array<{ heading: string; goal?: number; index?: number; occurrence?: number }> = [];
	if (Array.isArray(goals)) {
		for (const g of goals) {
			const norm = normalizeSectionGoalItem(g);
			if (norm && (norm.goal !== undefined || norm.target !== undefined)) {
				normalizedGoals.push(norm);
			}
		}
	}
	return matchSectionDateGoals(sections, normalizedGoals, occurrenceOverrides);
}

/**
 * Resolves chained target dates across document sections sequentially.
 * If a section doesn't specify an explicit target date and a cycle/chain interval is defined,
 * its target date is automatically advanced from the previous section's target date (or base target date).
 */
export function resolveChainedDateGoals(
	sections: Array<string | SectionHeadingItem>,
	fileStartDate: string | undefined | null,
	fileTargetDate: string | undefined | null,
	fileCycle: string | undefined | null,
	sectionDateGoals:
		| Map<string | number, { start?: string; target?: string; cycle?: string }>
		| Array<{ heading: string; index?: number; occurrence?: number; start?: string; target?: string; cycle?: string }>
		| undefined,
	defaultStartTime = '00:00',
	defaultTargetTime = '23:59',
	dateReference: DateReferenceMode = 'parent',
	occurrenceOverrides?: Map<number, number>,
): Map<string | number, ResolvedSectionDateGoal> {
	const resolvedMap = new Map<string | number, ResolvedSectionDateGoal>();

	const normalizedSections: Array<{ heading: string; level: number }> = sections.map((s) => {
		if (typeof s === 'string') {
			return { heading: s, level: 1 };
		}
		return { heading: s.heading, level: s.level ?? 1 };
	});

	// Normalize section goals into a Map with index and heading keys (occurrence and queue support for duplicate headings)
	const goalsMap = new Map<string | number, { start?: string; target?: string; cycle?: string }>();
	let hasIndexMapping = false;
	if (sectionDateGoals) {
		if (sectionDateGoals instanceof Map) {
			for (const [k, v] of sectionDateGoals.entries()) {
				goalsMap.set(k, v);
				if (typeof k === 'number') {
					hasIndexMapping = true;
				}
			}
		} else if (Array.isArray(sectionDateGoals)) {
			hasIndexMapping = true;
			const matched = matchSectionDateGoals(normalizedSections, sectionDateGoals, occurrenceOverrides);
			for (const [idx, item] of matched.entries()) {
				goalsMap.set(idx, item);
			}
		}
	}

	// Build parent index map using stack
	const parentIndexMap = buildParentIndexMap(normalizedSections);

	const fileTargetExt = extractDateAndTime(fileTargetDate);
	const fileStartExt = extractDateAndTime(fileStartDate);
	const baseTargetTime = fileTargetExt.time;
	const baseStartTime = fileStartExt.time;

	const baseTarget = fileTargetExt.date ? parseDateTime(fileTargetDate, defaultTargetTime) : null;
	const baseStart = fileStartExt.date ? parseDateTime(fileStartDate, defaultStartTime) : null;
	const defaultCycle = parseCycle(fileCycle);

	let lastTargetDate = baseTarget ? new Date(baseTarget.getTime()) : null;
	let lastStartDate = baseStart ? new Date(baseStart.getTime()) : null;
	let prevHadExplicitTargetOnly = false;

	for (let i = 0; i < normalizedSections.length; i++) {
		const sec = normalizedSections[i]!;
		const heading = sec.heading;
		const isFirstSection = (i === 0);

		const existing = hasIndexMapping ? goalsMap.get(i) : (goalsMap.get(i) ?? goalsMap.get(heading));
		const rawTarget = existing?.target?.trim() || undefined;
		const rawStart = existing?.start?.trim() || undefined;
		const rawCycle = existing?.cycle?.trim();

		const rawTargetExt = extractDateAndTime(rawTarget);
		const rawStartExt = extractDateAndTime(rawStart);

		const hasExplicitTargetDate = Boolean(rawTargetExt.date && isValidDateString(rawTargetExt.date));
		const explicitTargetTime = rawTargetExt.time;

		const hasExplicitStartDate = Boolean(rawStartExt.date && isValidDateString(rawStartExt.date));
		const explicitStartTime = rawStartExt.time;

		const hasExplicitCycle = Boolean(rawCycle !== undefined && rawCycle !== '');

		// Determine effective cycle based on dateReference
		let effectiveCycle: DateCycle | null = null;
		if (!isFirstSection) {
			if (hasExplicitCycle) {
				effectiveCycle = rawCycle !== 'none' ? parseCycle(rawCycle) : null;
			} else if (dateReference === 'none') {
				effectiveCycle = null;
			} else if (dateReference === 'parent') {
				const parentIdx = parentIndexMap.get(i);
				if (parentIdx === null || parentIdx === undefined) {
					// Root section: follow note setting
					effectiveCycle = defaultCycle;
				} else {
					// Child section: follow parent section's state
					const parentSec = normalizedSections[parentIdx];
					if (!parentSec) {
						effectiveCycle = defaultCycle;
					} else {
						const parentHeading = parentSec.heading;
						const parentResolved = resolvedMap.get(parentIdx) ?? resolvedMap.get(parentHeading);
						const parentExisting = goalsMap.get(parentIdx) ?? goalsMap.get(parentHeading);
						const parentExplicitCycle = parentExisting?.cycle?.trim();
						const parentHasExplicitNoCycle = parentExplicitCycle === 'none';
						const parentHasDate = Boolean(parentResolved && (parentResolved.target || parentExisting?.target));

						if (!parentHasDate || parentHasExplicitNoCycle) {
							// Parent has no deadline or explicitly disabled cycle -> child has NO cycle / NO date
							effectiveCycle = null;
						} else {
							// Parent has deadline -> inherit cycle from parent chain or note
							const inheritedCycleStr = getSectionEffectiveParentCycle(
								i,
								normalizedSections,
								parentIndexMap,
								goalsMap,
								fileCycle,
								dateReference,
								fileTargetDate,
							);
							effectiveCycle = inheritedCycleStr ? parseCycle(inheritedCycleStr) : null;
						}
					}
				}
			} else {
				// dateReference === 'note': flat chain from note cycle
				effectiveCycle = defaultCycle;
			}
		}

		// Resolve inherited times
		let inheritedTargetTime: string | undefined;
		let inheritedStartTime: string | undefined;
		if (dateReference === 'none') {
			inheritedTargetTime = undefined;
			inheritedStartTime = undefined;
		} else if (dateReference === 'parent') {
			const parentIdx = parentIndexMap.get(i);
			if (parentIdx === null || parentIdx === undefined) {
				// Root section (no parent): inherits from note-level total times
				inheritedTargetTime = baseTargetTime;
				inheritedStartTime = baseStartTime;
			} else {
				// Child section: traverse up parent chain to find explicit or resolved times
				let curP: number | null | undefined = parentIdx;
				let foundTargetTime: string | undefined;
				let foundStartTime: string | undefined;
				while (curP !== null && curP !== undefined) {
					const pSec = normalizedSections[curP];
					if (pSec) {
						const pResolved = resolvedMap.get(curP) ?? resolvedMap.get(pSec.heading);
						if (!foundTargetTime && pResolved?.target) {
							const pt = extractDateAndTime(pResolved.target).time;
							if (pt) foundTargetTime = pt;
						}
						if (!foundStartTime && pResolved?.start) {
							const ps = extractDateAndTime(pResolved.start).time;
							if (ps) foundStartTime = ps;
						}
						const pGoal = goalsMap.get(curP) ?? goalsMap.get(pSec.heading);
						if (!foundTargetTime && pGoal?.target) {
							const pt = extractDateAndTime(pGoal.target).time;
							if (pt) foundTargetTime = pt;
						}
						if (!foundStartTime && pGoal?.start) {
							const ps = extractDateAndTime(pGoal.start).time;
							if (ps) foundStartTime = ps;
						}
					}
					if (foundTargetTime && foundStartTime) break;
					curP = parentIndexMap.get(curP);
				}
				inheritedTargetTime = foundTargetTime || baseTargetTime;
				inheritedStartTime = foundStartTime || baseStartTime;
			}
		} else {
			// dateReference === 'note': always reference note-level total times directly
			inheritedTargetTime = baseTargetTime;
			inheritedStartTime = baseStartTime;
		}

		const currentTargetTime = explicitTargetTime || inheritedTargetTime;
		const currentStartTime = explicitStartTime || inheritedStartTime;

		let target: string | undefined;
		let isTargetChained = false;
		let prevAnchorTargetForStart: Date | null = null;

		// 1. Resolve Target Date
		if (hasExplicitTargetDate) {
			target = combineDateAndTime(rawTargetExt.date, currentTargetTime);
			isTargetChained = false;
			const parsed = parseDateTime(target, currentTargetTime);
			if (parsed) {
				lastTargetDate = new Date(parsed.getTime());
			}
		} else if (effectiveCycle && lastTargetDate) {
			prevAnchorTargetForStart = new Date(lastTargetDate.getTime());

			const nextTargetDate = addCycle(lastTargetDate, effectiveCycle, 1);
			target = combineDateAndTime(formatDate(nextTargetDate), currentTargetTime);
			isTargetChained = true;

			const parsed = parseDateTime(target, currentTargetTime);
			if (parsed) {
				lastTargetDate = new Date(parsed.getTime());
			}
		} else {
			// No explicit target date and no cycle calculation:
			const hasExplicitNoCycle = rawCycle === 'none';

			if (hasExplicitNoCycle) {
				target = undefined;
			} else if (dateReference === 'note') {
				if (fileTargetExt.date) {
					target = combineDateAndTime(fileTargetExt.date, currentTargetTime);
				}
			} else if (dateReference === 'parent') {
				const parentIdx = parentIndexMap.get(i);
				if (parentIdx === null || parentIdx === undefined) {
					// Root section: inherits from note target date
					if (fileTargetExt.date) {
						target = combineDateAndTime(fileTargetExt.date, currentTargetTime);
					}
				} else {
					// Child section: inherits from parent section's resolved target date
					const parentSec = normalizedSections[parentIdx];
					if (parentSec) {
						const parentResolved = resolvedMap.get(parentIdx) ?? resolvedMap.get(parentSec.heading);
						if (parentResolved?.target) {
							const ptExt = extractDateAndTime(parentResolved.target);
							if (ptExt.date) {
								target = combineDateAndTime(ptExt.date, currentTargetTime);
							}
						}
					}
				}
			} else {
				// dateReference === 'none': do not inherit from fileTargetDate
				target = undefined;
			}

			if (target) {
				const parsed = parseDateTime(target, currentTargetTime);
				if (parsed) {
					lastTargetDate = new Date(parsed.getTime());
				}
			}
			isTargetChained = false;
		}

		// 2. Resolve Start Date
		let start: string | undefined;
		let isStartChained = false;

		if (hasExplicitStartDate) {
			start = combineDateAndTime(rawStartExt.date, currentStartTime);
			isStartChained = false;
		} else if (isTargetChained) {
			if (!prevHadExplicitTargetOnly && lastStartDate && effectiveCycle) {
				const nextStartDate = addCycle(lastStartDate, effectiveCycle, 1);
				start = combineDateAndTime(formatDate(nextStartDate), currentStartTime);
				isStartChained = true;
			} else if (prevAnchorTargetForStart) {
				// Fallback when no explicit/base start date exists or previous section explicitly set target date only
				start = combineDateAndTime(formatDate(prevAnchorTargetForStart), currentStartTime);
				isStartChained = true;
			}
		} else if (target) {
			// When target date is resolved/inherited without cycle chaining
			if (dateReference === 'note') {
				if (fileStartExt.date) {
					start = combineDateAndTime(fileStartExt.date, currentStartTime);
				}
			} else if (dateReference === 'parent') {
				const parentIdx = parentIndexMap.get(i);
				if (parentIdx === null || parentIdx === undefined) {
					// Root section inherits from note start date
					if (fileStartExt.date) {
						start = combineDateAndTime(fileStartExt.date, currentStartTime);
					}
				} else {
					// Child section inherits from parent section's resolved start date
					const parentSec = normalizedSections[parentIdx];
					if (parentSec) {
						const parentResolved = resolvedMap.get(parentIdx) ?? resolvedMap.get(parentSec.heading);
						if (parentResolved?.start) {
							const psExt = extractDateAndTime(parentResolved.start);
							if (psExt.date) {
								start = combineDateAndTime(psExt.date, currentStartTime);
							}
						}
					}
				}
			} else {
				// dateReference === 'none': do not inherit from fileStartDate
				start = undefined;
			}
			isStartChained = false;
		} else {
			start = undefined;
			isStartChained = false;
		}

		if (start) {
			const parsedStart = parseDateTime(start, currentStartTime);
			if (parsedStart) {
				lastStartDate = new Date(parsedStart.getTime());
			}
		}

		prevHadExplicitTargetOnly = hasExplicitTargetDate && !hasExplicitStartDate;

		const isFallback = !hasExplicitTargetDate && !hasExplicitStartDate && !hasExplicitCycle && !isTargetChained;

		const effectiveCycleStr =
			rawCycle && rawCycle !== 'none' && parseCycle(rawCycle)
				? rawCycle
				: effectiveCycle
					? formatCycle(effectiveCycle)
					: undefined;

		const resolvedItem: ResolvedSectionDateGoal = {
			heading,
			target,
			start,
			cycle: rawCycle,
			effectiveCycle: effectiveCycleStr,
			isTargetChained,
			isStartChained,
			isFallback,
			effectiveTargetTime: currentTargetTime,
			effectiveStartTime: currentStartTime,
		};
		resolvedMap.set(i, resolvedItem);
		if (!resolvedMap.has(heading)) {
			resolvedMap.set(heading, resolvedItem);
		}
	}

	return resolvedMap;
}

export type ChainConnectorState =
	| 'none'
	| 'start'
	| 'start-dotted-down'
	| 'middle'
	| 'middle-dotted-down'
	| 'middle-dotted-up'
	| 'middle-dotted-both'
	| 'end'
	| 'end-dotted-up'
	| 'pass-through'
	| 'pass-through-dotted';

/**
 * Computes visual bracket connector states for sections participating in recurring schedule date calculations.
 * Reflects schedule inheritance relationships across sections: contiguous inherited sections form a continuous
 * chain, while interruptions by explicit sub-anchors are rendered with dotted connections, and skipped sections
 * with resumed schedules pass through vertically without horizontal branches.
 * Does not display connectors when referencing the entire note ('note' or 'none').
 */
export function computeChainConnectorStates(
	sections: Array<{ heading: string; level: number }>,
	parentIndexMap: Map<number, number | null>,
	goalsMap: Map<string | number, { start?: string; target?: string; cycle?: string }>,
	resolvedMap: Map<string | number, ResolvedSectionDateGoal>,
	dateReference: DateReferenceMode,
	inheritedSet?: Set<string | number>,
	fileTargetDate?: string | null,
	fileCycle?: string | null,
): Map<string | number, ChainConnectorState> {
	const connectorMap = new Map<string | number, ChainConnectorState>();
	for (let i = 0; i < sections.length; i++) {
		connectorMap.set(i, 'none');
		connectorMap.set(sections[i]!.heading, 'none');
	}

	if (dateReference !== 'parent') {
		return connectorMap;
	}

	const effectiveFileTarget = fileTargetDate ?? resolvedMap.get(0)?.target ?? goalsMap.get(0)?.target;
	const effectiveFileCycle = fileCycle ?? resolvedMap.get(0)?.effectiveCycle ?? goalsMap.get(0)?.cycle;

	// Group active nodes by their schedule anchor using unified getSectionScheduleAnchor
	const anchorGroups = new Map<number, number[]>();

	for (let i = 0; i < sections.length; i++) {
		const res = resolvedMap.get(i) ?? resolvedMap.get(sections[i]!.heading);
		const hasDate = Boolean(res && (res.target || res.start));
		if (!hasDate) {
			// No concrete date resolved (e.g. YY-MM-DD placeholder) -> cannot be active connector node
			continue;
		}

		const anchorIdx = getSectionScheduleAnchor(
			i,
			sections,
			parentIndexMap,
			goalsMap,
			dateReference,
			effectiveFileTarget,
			effectiveFileCycle,
		);
		if (anchorIdx === null) {
			continue;
		}

		const isChained = Boolean(res?.isTargetChained || res?.isStartChained);
		let isActiveNode = isChained;

		if (!isActiveNode) {
			// Check if this unchained section with a concrete date acts as the starting anchor/base
			// for subsequent chained sections in the same schedule anchor group.
			for (let next = i + 1; next < sections.length; next++) {
				const nextAnchor = getSectionScheduleAnchor(
					next,
					sections,
					parentIndexMap,
					goalsMap,
					dateReference,
					effectiveFileTarget,
					effectiveFileCycle,
				);
				if (nextAnchor === anchorIdx) {
					const nextRes = resolvedMap.get(next) ?? resolvedMap.get(sections[next]!.heading);
					const nextHasDate = Boolean(nextRes && (nextRes.target || nextRes.start));
					const nextIsChained = Boolean(nextRes?.isTargetChained || nextRes?.isStartChained);

					if (nextIsChained) {
						isActiveNode = true;
						break;
					}
					if (nextHasDate && !nextIsChained) {
						// Hit another explicit unchained date section in the same anchor group
						break;
					}
				}
			}
		}

		if (isActiveNode) {
			const group = anchorGroups.get(anchorIdx) ?? [];
			group.push(i);
			anchorGroups.set(anchorIdx, group);
		}
	}

	// Sort anchors: deeper hierarchy first, root anchor (0) last
	const sortedAnchors = Array.from(anchorGroups.keys()).sort((a, b) => {
		if (a === 0) return 1;
		if (b === 0) return -1;
		return sections[b]!.level - sections[a]!.level;
	});

	const occupied = new Set<number>();

	for (const anchorIdx of sortedAnchors) {
		const nodes = anchorGroups.get(anchorIdx)!;
		if (nodes.length < 2) {
			continue;
		}

		// Determine pass-through nodes and segment connections between consecutive active nodes
		const passThroughNodes: number[] = [];
		const upDotted = new Set<number>();
		const downDotted = new Set<number>();

		for (let k = 0; k < nodes.length - 1; k++) {
			const currentIdx = nodes[k]!;
			const nextIdx = nodes[k + 1]!;

			if (nextIdx === currentIdx + 1) {
				// Directly consecutive: solid connection
				continue;
			}

			// Intermediate nodes exist between currentIdx and nextIdx
			let isInterruptedBySubAnchor = false;
			const candidatePassThrough: number[] = [];

			for (let m = currentIdx + 1; m < nextIdx; m++) {
				if (occupied.has(m)) {
					isInterruptedBySubAnchor = true;
					break;
				}
				const mAnchor = getSectionScheduleAnchor(
					m,
					sections,
					parentIndexMap,
					goalsMap,
					dateReference,
					effectiveFileTarget,
					effectiveFileCycle,
				);
				if (mAnchor !== null && mAnchor !== anchorIdx) {
					isInterruptedBySubAnchor = true;
					break;
				}
				candidatePassThrough.push(m);
			}

			if (isInterruptedBySubAnchor) {
				// Interrupted by explicit sub-anchor: jump over with dotted line
				downDotted.add(currentIdx);
				upDotted.add(nextIdx);
			} else {
				// No sub-anchor interruption: pass-through vertically with solid line
				for (const m of candidatePassThrough) {
					passThroughNodes.push(m);
				}
			}
		}

		const allConnectedIndices = new Set([...nodes, ...passThroughNodes]);
		const allSortedNodes = Array.from(allConnectedIndices).sort((a, b) => a - b);
		const activeSet = new Set(nodes);
		const firstActive = nodes[0]!;
		const lastActive = nodes[nodes.length - 1]!;

		for (const idx of allSortedNodes) {
			const heading = sections[idx]!.heading;
			const isActive = activeSet.has(idx);

			const hasUp = (idx > firstActive);
			const hasDown = (idx < lastActive);

			let upType: 'none' | 'solid' | 'dotted' = 'none';
			if (hasUp) {
				upType = upDotted.has(idx) ? 'dotted' : 'solid';
			}

			let downType: 'none' | 'solid' | 'dotted' = 'none';
			if (hasDown) {
				downType = downDotted.has(idx) ? 'dotted' : 'solid';
			}

			let state: ChainConnectorState = 'none';

			if (!isActive) {
				state = 'pass-through';
			} else if (upType === 'none') {
				state = (downType === 'dotted') ? 'start-dotted-down' : 'start';
			} else if (downType === 'none') {
				state = (upType === 'dotted') ? 'end-dotted-up' : 'end';
			} else {
				if (upType === 'solid' && downType === 'solid') {
					state = 'middle';
				} else if (upType === 'solid' && downType === 'dotted') {
					state = 'middle-dotted-down';
				} else if (upType === 'dotted' && downType === 'solid') {
					state = 'middle-dotted-up';
				} else {
					state = 'middle-dotted-both';
				}
			}

			connectorMap.set(idx, state);
			const existingHeadingState = connectorMap.get(heading);
			if (!existingHeadingState || existingHeadingState === 'none') {
				connectorMap.set(heading, state);
			}
			occupied.add(idx);
		}
	}

	return connectorMap;
}

