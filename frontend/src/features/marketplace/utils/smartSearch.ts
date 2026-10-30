/**
 * Smart Marketplace Query Parser for Frontend
 * Parses natural language queries such as:
 * - "Printers below 2000" / "Printers under 2,000" -> keywords: "Printers", maxPrice: 2000
 * - "Laptops under 50k" / "Laptops below ₹50,000" -> keywords: "Laptops", maxPrice: 50000
 * - "Helmets between 500 and 1500" -> keywords: "Helmets", minPrice: 500, maxPrice: 1500
 * - "Drill machine less than 3000" -> keywords: "Drill machine", maxPrice: 3000
 * - "Steel pipes above 1000" -> keywords: "Steel pipes", minPrice: 1000
 * - "Cables 500 or less" -> keywords: "Cables", maxPrice: 500
 * - "HP printer under ₹2.5k" -> keywords: "HP printer", maxPrice: 2500
 * - "Heavy lathes 50,000 to 1,50,000" -> keywords: "Heavy lathes", minPrice: 50000, maxPrice: 150000
 * - "CNC Machine 2-5 lakh" -> keywords: "CNC Machine", minPrice: 200000, maxPrice: 500000
 */

export interface SmartSearchParsed {
    rawQuery: string;
    cleanQuery: string;
    tokens: string[];
    tokenVariants: string[][];
    minPrice?: number;
    maxPrice?: number;
}

export function parseMultiplier(valStr: string | undefined): number | undefined {
    if (!valStr) return undefined;
    let s = valStr.toLowerCase().replace(/,/g, '').replace(/₹|rs\.?|inr|\$|\/-|\+/gi, '').trim();
    let mult = 1;
    if (s.endsWith('cr') || s.endsWith('crore') || s.endsWith('crores')) {
        mult = 10000000;
        s = s.replace(/(?:crores?|cr)$/, '');
    } else if (s.endsWith('lakh') || s.endsWith('lacs') || s.endsWith('lac') || s.endsWith('lakhs')) {
        mult = 100000;
        s = s.replace(/(?:lakhs?|lacs?)$/, '');
    } else if (s.endsWith('thousand')) {
        mult = 1000;
        s = s.replace(/thousand$/, '');
    } else if (s.endsWith('k')) {
        mult = 1000;
        s = s.slice(0, -1);
    }
    const n = parseFloat(s.trim());
    return isNaN(n) ? undefined : Math.round(n * mult);
}

export function getTokenVariants(token: string): string[] {
    const lower = token.toLowerCase().trim();
    if (!lower) return [];
    const variants = new Set<string>([lower]);

    // Handle common English singular/plural rules
    if (lower.endsWith('ies') && lower.length > 4) {
        variants.add(lower.slice(0, -3) + 'y'); // batteries -> battery
    } else if (lower.endsWith('es') && lower.length > 3) {
        variants.add(lower.slice(0, -2)); // boxes -> box
        variants.add(lower.slice(0, -1)); // valves -> valve
    } else if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 3) {
        variants.add(lower.slice(0, -1)); // printers -> printer
    } else if (lower.endsWith('y') && lower.length > 2) {
        variants.add(lower.slice(0, -1) + 'ies'); // battery -> batteries
    } else if (lower.length > 2) {
        variants.add(lower + 's'); // printer -> printers
        variants.add(lower + 'es'); // box -> boxes
    }

    return Array.from(variants);
}

const STOP_WORDS = new Set([
    'for', 'in', 'with', 'at', 'the', 'a', 'an', 'and', 'or', 'of', 'from', 'to', 'by', 'near', 'on'
]);

const NUM_REGEX_STR = '(?:(?:rs\\.?|inr|₹|\\$)\\s*)?((?:\\d{1,3}(?:,\\d{2,3})+|\\d+)(?:\\.\\d+)?\\s*(?:k|thousand|lakhs?|lacs?|crores?|cr)?)(?:\\s*(?:rs\\.?|inr|₹|\\$|\\/-))?';

export function parseSmartSearchQuery(raw: string | undefined): SmartSearchParsed {
    if (!raw || typeof raw !== 'string') {
        return {
            rawQuery: '',
            cleanQuery: '',
            tokens: [],
            tokenVariants: []
        };
    }

    let working = raw.trim();
    let minPrice: number | undefined = undefined;
    let maxPrice: number | undefined = undefined;

    // Pattern 1: between X and Y / from X to Y
    const betweenPattern = new RegExp(`\\b(?:between|from)\\s+${NUM_REGEX_STR}\\s*(?:and|to|-)\\s*${NUM_REGEX_STR}\\b`, 'i');
    let match = working.match(betweenPattern);
    if (match) {
        minPrice = parseMultiplier(match[1]);
        maxPrice = parseMultiplier(match[2]);
        working = working.replace(match[0], ' ');
    }

    // Pattern 1b: standalone direct range "X to Y" or "X - Y"
    if (minPrice === undefined && maxPrice === undefined) {
        const directRangePattern = new RegExp(`\\b${NUM_REGEX_STR}\\s*(?:to|-)\\s*${NUM_REGEX_STR}\\b`, 'i');
        match = working.match(directRangePattern);
        if (match) {
            minPrice = parseMultiplier(match[1]);
            maxPrice = parseMultiplier(match[2]);
            working = working.replace(match[0], ' ');
        }
    }

    // Pattern 2: below / under / less than / upto / up to / within / max / <= X
    if (maxPrice === undefined) {
        const belowPattern = new RegExp(`\\b(?:below|under|less\\s+than|upto|up\\s+to|within|max(?:imum)?|<=?)\\s+${NUM_REGEX_STR}\\b`, 'i');
        match = working.match(belowPattern);
        if (match) {
            maxPrice = parseMultiplier(match[1]);
            working = working.replace(match[0], ' ');
        }
    }

    // Pattern 3: X or less / X and below / X or below / X and under
    if (maxPrice === undefined) {
        const orLessPattern = new RegExp(`\\b${NUM_REGEX_STR}\\s*(?:or\\s+less|and\\s+below|or\\s+below|and\\s+under|or\\s+under|or\\s+lower)\\b`, 'i');
        match = working.match(orLessPattern);
        if (match) {
            maxPrice = parseMultiplier(match[1]);
            working = working.replace(match[0], ' ');
        }
    }

    // Pattern 4: above / over / more than / greater than / min / >= X
    if (minPrice === undefined) {
        const abovePattern = new RegExp(`\\b(?:above|over|more\\s+than|greater\\s+than|min(?:imum)?|>=?)\\s+${NUM_REGEX_STR}\\b`, 'i');
        match = working.match(abovePattern);
        if (match) {
            minPrice = parseMultiplier(match[1]);
            working = working.replace(match[0], ' ');
        }
    }

    // Pattern 5: X and above / X or above / X or more / X+
    if (minPrice === undefined) {
        const andAbovePattern = new RegExp(`\\b${NUM_REGEX_STR}\\s*(?:and\\s+above|or\\s+above|or\\s+more|and\\s+more|or\\s+higher)\\b|${NUM_REGEX_STR}\\+`, 'i');
        match = working.match(andAbovePattern);
        if (match) {
            const captured = match[1] || match[2];
            minPrice = parseMultiplier(captured);
            working = working.replace(match[0], ' ');
        }
    }

    // Range inheritance: e.g. "2-5 lakh" -> min: 200,000, max: 500,000
    if (maxPrice !== undefined && minPrice !== undefined) {
        if (maxPrice >= 100000 && minPrice < 100 && minPrice > 0) {
            minPrice = minPrice * 100000;
        } else if (maxPrice >= 1000 && maxPrice < 100000 && minPrice < 100 && minPrice > 0) {
            minPrice = minPrice * 1000;
        }
    }

    // Clean remaining standalone currency symbols / punctuation
    working = working.replace(/\b(?:rs\.?|inr|usd)\b|₹|\$|\/-/gi, ' ');
    working = working.replace(/[,_]/g, ' ').replace(/\s+/g, ' ').trim();

    const rawTokens = working.split(/\s+/).filter(Boolean);
    const tokens = rawTokens.filter(t => !STOP_WORDS.has(t.toLowerCase()) || rawTokens.length === 1);
    const tokenVariants = tokens.map(getTokenVariants);

    return {
        rawQuery: raw,
        cleanQuery: working,
        tokens,
        tokenVariants,
        minPrice,
        maxPrice
    };
}
