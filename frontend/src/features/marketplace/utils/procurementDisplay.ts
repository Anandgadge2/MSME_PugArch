const dayMs = 24 * 60 * 60 * 1000;

export type ProcurementStatusCode =
    | 'OPEN'
    | 'CLOSING_SOON'
    | 'CLOSING_TODAY'
    | 'CLOSED'
    | 'UNDER_EVALUATION'
    | 'AWARDED'
    | 'CANCELLED';

export function parseDisplayDate(date?: string | Date | null) {
    if (!date) return null;
    const parsed = date instanceof Date ? date : new Date(date);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateIN(date?: string | Date | null) {
    const parsed = parseDisplayDate(date);
    if (!parsed) return 'Not specified';
    return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function getDaysRemaining(date?: string | Date | null) {
    const parsed = parseDisplayDate(date);
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
    const parsed = parseDisplayDate(date);
    if (!parsed) return 'No deadline';
    const diff = parsed.getTime() - Date.now();
    if (diff <= 0) return isSameLocalDate(parsed) ? 'Closing Today' : 'Closed';
    const days = Math.ceil(diff / dayMs);
    if (days <= 1) return '1d left';
    return `${days}d left`;
}

export function getProcurementStatus(item: { status?: string | null; computedStatus?: string | null; statusLabel?: string | null; dueDate?: string | Date | null; isUrgent?: boolean | null }) {
    const raw = String(item.computedStatus || item.statusLabel || item.status || '').toUpperCase().replace(/\s+/g, '_');
    const dueDate = parseDisplayDate(item.dueDate);
    const days = getDaysRemaining(dueDate);
    const deadlineLabel = getDeadlineLabel(dueDate);

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
    } else if (deadlineLabel === 'Closing Today') {
        code = 'CLOSING_TODAY';
        label = 'Closing Today';
    } else if (raw.includes('CLOSING_SOON') || item.isUrgent || (days !== null && days <= 7)) {
        code = 'CLOSING_SOON';
        label = 'Closing Soon';
    }

    return { code, label, daysRemaining: days, deadlineLabel };
}

export function getStatusBadgeClass(code: ProcurementStatusCode) {
    if (code === 'AWARDED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (code === 'UNDER_EVALUATION') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (code === 'CLOSING_SOON') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (code === 'CLOSING_TODAY') return 'bg-red-50 text-red-700 border-red-200';
    if (code === 'CANCELLED') return 'bg-red-50 text-red-700 border-red-200';
    if (code === 'CLOSED') return 'bg-slate-100 text-slate-500 border-slate-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
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
