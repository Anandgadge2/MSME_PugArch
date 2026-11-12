/**
 * Unified toast helper and global deduplication patch for JsgSmile MSME Portal.
 * Wraps and patches `sonner` so that duplicate toasts from rage clicks, rapid re-renders,
 * or concurrent identical events are gracefully suppressed or updated in-place.
 */

import { toast as sonner } from 'sonner';

export interface RunOptions {
    loading?: string;
    success?: string | ((result: unknown) => string);
    error?: string | ((err: unknown) => string);
}

const errorMessage = (err: unknown, fallback = 'Something went wrong') => {
    if (err instanceof Error) return err.message || fallback;
    if (typeof err === 'string' && err.trim()) return err;
    return fallback;
};

interface RecentToast {
    id: string | number;
    time: number;
}

const activeToastMap = new Map<string, RecentToast>();
const TOAST_DEBOUNCE_MS = 350; // Drop identical toasts within 350ms (rage-clicks)
const TOAST_UPDATE_WINDOW_MS = 1500; // Update existing toast if fired within 1500ms

function getMessageKey(message: unknown, type: string): string {
    if (typeof message === 'string') return `${type}:${message.trim()}`;
    if (typeof message === 'number') return `${type}:${message}`;
    try {
        return `${type}:${JSON.stringify(message)}`;
    } catch {
        return `${type}:${String(message)}`;
    }
}

function deduplicateToast<T extends (message: any, data?: any) => any>(
    originalFn: T,
    type: string
): T {
    const wrapped = function (message: any, data?: any) {
        // If caller explicitly passed an id, respect it
        if (data?.id !== undefined) {
            return originalFn(message, data);
        }

        const key = getMessageKey(message, type);
        const now = Date.now();
        const existing = activeToastMap.get(key);

        if (existing) {
            // Drop rapid duplicate clicks within 350ms
            if (now - existing.time < TOAST_DEBOUNCE_MS) {
                return existing.id;
            }
            // Update in-place if fired within 1500ms
            if (now - existing.time < TOAST_UPDATE_WINDOW_MS) {
                existing.time = now;
                return originalFn(message, { ...data, id: existing.id });
            }
        }

        const newId = originalFn(message, data);
        activeToastMap.set(key, { id: newId, time: now });

        // Memory cleanup
        if (activeToastMap.size > 150) {
            const cutoff = now - 30_000;
            for (const [k, v] of activeToastMap.entries()) {
                if (v.time < cutoff) activeToastMap.delete(k);
            }
        }

        return newId;
    };
    return wrapped as unknown as T;
}

// Global patch applied once to Sonner singleton so that direct `import { toast } from 'sonner'`
// across the entire portal automatically benefits from duplicate suppression.
if (typeof window !== 'undefined' && !(sonner as any).__jsg_dedupe_patched) {
    try {
        (sonner as any).__jsg_dedupe_patched = true;
        sonner.success = deduplicateToast(sonner.success.bind(sonner), 'success');
        sonner.error = deduplicateToast(sonner.error.bind(sonner), 'error');
        sonner.info = deduplicateToast(sonner.info.bind(sonner), 'info');
        sonner.warning = deduplicateToast(sonner.warning.bind(sonner), 'warning');
        sonner.loading = deduplicateToast(sonner.loading.bind(sonner), 'loading');
    } catch (e) {
        console.warn('[Toast] Could not patch sonner methods:', e);
    }
}

export const notify = {
    success(message: string, options?: { description?: string; duration?: number; id?: string | number }) {
        return sonner.success(message, options);
    },
    error(message: string, options?: { description?: string; duration?: number; id?: string | number }) {
        return sonner.error(message, { duration: 6000, ...options });
    },
    info(message: string, options?: { description?: string; duration?: number; id?: string | number }) {
        return sonner.info(message, options);
    },
    warning(message: string, options?: { description?: string; duration?: number; id?: string | number }) {
        return sonner.warning(message, { duration: 6000, ...options });
    },
    loading(message: string, options?: { id?: string | number }) {
        return sonner.loading(message, options);
    },
    dismiss(id?: string | number) {
        sonner.dismiss(id);
    }
};

/**
 * Runs an async operation with toast feedback.
 * Uses a single toast ID to transition from loading -> success/error smoothly
 * without ever spawning duplicate or abandoned toast cards.
 */
export const runWithToast = async <T>(
    task: () => Promise<T>,
    options: RunOptions = {}
): Promise<T> => {
    const id = sonner.loading(options.loading || 'Working...');
    try {
        const result = await task();
        const message =
            typeof options.success === 'function' ? options.success(result) : options.success || 'Done';
        sonner.success(message, { id });
        return result;
    } catch (err) {
        const message =
            typeof options.error === 'function' ? options.error(err) : options.error || errorMessage(err);
        sonner.error(message, { id, duration: 6000 });
        throw err;
    }
};

export { errorMessage, sonner as toast };
