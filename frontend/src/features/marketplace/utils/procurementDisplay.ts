import { formatDate } from '../../shared/format';

const dayMs = 24 * 60 * 60 * 1000;

export type ProcurementStatusCode =
    | 'OPEN'
    | 'CLOSING_SOON'
    | 'CLOSING_TODAY'
    | 'CLOSED'
    | 'UNDER_EVALUATION'
    | 'AWARDED'
    | 'CANCELLED';

export function parseDisplayDate(date?: string | Date | null, isDeadline: boolean = false) {
    if (!date) return null;
    let parsed = date instanceof Date ? new Date(date.getTime()) : new Date(date);
    if (Number.isNaN(parsed.getTime())) return null;

    if (isDeadline) {
        const isDateOnlyStr = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim());
        const isUtcMidnight = parsed.getUTCHours() === 0 && parsed.getUTCMinutes() === 0 && parsed.getUTCSeconds() === 0;
        if (isDateOnlyStr || isUtcMidnight) {
            parsed.setHours(23, 59, 59, 999);
        }
    }
    return parsed;
}

export function formatDateIN(date?: string | Date | null) {
    const parsed = parseDisplayDate(date);
    if (!parsed) return 'Not specified';
    const formatted = formatDate(parsed);
    return formatted === '—' ? 'Not specified' : formatted;
}

export function getDaysRemaining(date?: string | Date | null) {
    const parsed = parseDisplayDate(date, true);
    if (!parsed) return null;
    return Math.max(0, Math.ceil((parsed.getTime() - Date.now()) / dayMs));
}

function isSameLocalDate(date: Date) {
    const today = new Date();
    return date.getFullYear() === today.getFullYear()
        && date.getMonth() === today.getMonth()
        && date.getDate() === today.getDate();
}

export function getDeadlineLabel(date?: string | Date | null) {
    const parsed = parseDisplayDate(date, true);
    if (!parsed) return 'No deadline';
    const diff = parsed.getTime() - Date.now();
    if (diff <= 0) return 'Closed';
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    if (hours < 24 && isSameLocalDate(parsed)) {
        if (hours > 0) return `${hours}h ${mins}m left`;
        return `${mins}m left`;
    }
    const days = Math.ceil(diff / dayMs);
    if (days <= 1) return '1d left';
    return `${days}d left`;
}

export function getProcurementStatus(item: { status?: string | null; computedStatus?: string | null; statusLabel?: string | null; dueDate?: string | Date | null; isUrgent?: boolean | null }) {
    const raw = String(item.computedStatus || item.statusLabel || item.status || '').toUpperCase().replace(/\s+/g, '_');
    const dueDate = parseDisplayDate(item.dueDate, true);
    const days = getDaysRemaining(dueDate);
    const deadlineLabel = getDeadlineLabel(item.dueDate);

    let code: ProcurementStatusCode = 'OPEN';
    let label = 'Open';

    if (raw.includes('AWARDED')) {
        code = 'AWARDED';
        label = 'Awarded';
    } else if (raw.includes('CANCELLED') || raw.includes('REJECTED')) {
        code = 'CANCELLED';
        label = raw.includes('REJECTED') ? 'Rejected' : 'Cancelled';
    } else if (raw.includes('CLOSED') || deadlineLabel === 'Closed') {
        code = 'CLOSED';
        label = 'Closed';
    } else if (raw.includes('EVALUATION') || raw.includes('UNDER_REVIEW') || raw.includes('L1_GENERATED') || raw.includes('AWARD_RECOMMENDED')) {
        code = 'UNDER_EVALUATION';
        label = 'Under Evaluation';
    } else if (dueDate && isSameLocalDate(dueDate) && dueDate.getTime() > Date.now()) {
        code = 'CLOSING_TODAY';
        label = 'Closing Today';
    } else if (raw.includes('CLOSING_SOON') || item.isUrgent || (days !== null && days <= 7)) {
        code = 'CLOSING_SOON';
        label = 'Closing Soon';
    }

    return { code, label, daysRemaining: days, deadlineLabel };
}

export function getStatusBadgeClass(code: ProcurementStatusCode) {
    if (code === 'AWARDED') return 'bg-emerald-50 text-emerald-700 border-emerald-200/90 font-black';
    if (code === 'UNDER_EVALUATION') return 'bg-indigo-50 text-indigo-700 border-indigo-200/90 font-black';
    if (code === 'CLOSING_SOON') return 'bg-amber-50 text-amber-700 border-amber-200/90 font-black';
    if (code === 'CLOSING_TODAY') return 'bg-rose-50 text-rose-700 border-rose-200/90 font-black';
    if (code === 'CANCELLED') return 'bg-rose-50 text-rose-700 border-rose-200/90 font-black';
    if (code === 'CLOSED') return 'bg-slate-100 text-slate-500 border-slate-200/90 font-bold';
    return 'bg-blue-50 text-blue-700 border-blue-200/90 font-black';
}

export function formatBudgetRange(min?: number | string | null, max?: number | string | null) {
    if ((min === undefined || min === null || min === '') && (max === undefined || max === null || max === '')) {
        return 'Budget not disclosed';
    }
    const first = min ?? max;
    const second = max ?? min;
    const firstLabel = `Rs. ${Number(first).toLocaleString('en-IN')}`;
    if (first !== undefined && first !== null && second !== undefined && second !== null && Number(first) !== Number(second)) {
        return `${firstLabel} - Rs. ${Number(second).toLocaleString('en-IN')}`;
    }
    return firstLabel;
}

export function formatSingleBudget(value?: number | string | null) {
    return formatBudgetRange(value, value);
}
