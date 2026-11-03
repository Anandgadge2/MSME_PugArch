/**
 * VPAT / WCAG 2.1 & 2.2 AA Accessibility Utilities
 * Provides focus management, live region announcements, and contrast helpers.
 */

/**
 * Automatically moves keyboard and screen reader focus to the first invalid field
 * upon form validation failure (WCAG 2.4.3 Focus Order & 3.3.1 Error Identification).
 */
export function focusFirstError(container: HTMLElement | Document = typeof document !== 'undefined' ? document : (null as any)): boolean {
  if (typeof document === 'undefined' || !container) return false;

  const selector = [
    '[aria-invalid="true"]',
    'input:invalid',
    'select:invalid',
    'textarea:invalid',
    '[data-error="true"]',
    '[role="alert"]'
  ].join(', ');

  const firstErrorElement = container.querySelector<HTMLElement>(selector);

  if (firstErrorElement) {
    firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    firstErrorElement.focus({ preventScroll: true });
    return true;
  }

  return false;
}

/**
 * Dispatches an accessible message to screen readers via a dynamic live region
 * (WCAG 4.1.3 Status Messages - Level AA).
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  if (typeof document === 'undefined' || !message.trim()) return;

  const regionId = priority === 'assertive' ? 'a11y-assertive-region' : 'a11y-polite-region';
  let liveRegion = document.getElementById(regionId);

  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = regionId;
    liveRegion.setAttribute('role', priority === 'assertive' ? 'alert' : 'status');
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    document.body.appendChild(liveRegion);
  }

  // Clear and update with microtask to ensure screen reader picks up the mutation
  liveRegion.textContent = '';
  setTimeout(() => {
    if (liveRegion) {
      liveRegion.textContent = message;
    }
  }, 50);
}

/**
 * Calculates WCAG 2.1 relative luminance and contrast ratio between two hex colors.
 */
export function getContrastRatio(fgHex: string, bgHex: string): number {
  const parseRgb = (hex: string) => {
    const cleanHex = hex.replace('#', '');
    const num = parseInt(cleanHex, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return [r, g, b].map((val) => {
      const s = val / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
  };

  try {
    const [r1, g1, b1] = parseRgb(fgHex);
    const [r2, g2, b2] = parseRgb(bgHex);
    const lum1 = 0.2126 * r1 + 0.7152 * g1 + 0.0722 * b1;
    const lum2 = 0.2126 * r2 + 0.7152 * g2 + 0.0722 * b2;
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  } catch {
    return 4.5;
  }
}

