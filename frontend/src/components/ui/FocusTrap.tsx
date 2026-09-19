import React, { useEffect, useRef } from 'react';

export interface FocusTrapProps {
  children: React.ReactNode;
  active?: boolean;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  autoFocus?: boolean;
  onEscape?: () => void;
  className?: string;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';

export function FocusTrap({
  children,
  active = true,
  returnFocusRef,
  autoFocus = true,
  onEscape,
  className,
}: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;
  const returnFocusRefStable = useRef(returnFocusRef);
  returnFocusRefStable.current = returnFocusRef;

  // Track if initial focus was already executed for this trap session
  const hasFocusedRef = useRef(false);

  useEffect(() => {
    if (!active) {
      hasFocusedRef.current = false;
      return;
    }

    // 1. Capture previously focused element to return focus on unmount
    if (!previousActiveElementRef.current) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
    }

    const container = containerRef.current;
    if (!container) return;

    // 2. Initial focus - only once per active session, and only if focus is not already inside container
    if (autoFocus && !hasFocusedRef.current) {
      hasFocusedRef.current = true;
      const currentActive = document.activeElement;
      if (!currentActive || !container.contains(currentActive)) {
        const explicitAutoFocus = container.querySelector<HTMLElement>('[autofocus], [data-autofocus]');
        if (explicitAutoFocus && typeof explicitAutoFocus.focus === 'function') {
          explicitAutoFocus.focus();
        } else {
          const focusableElements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
          if (focusableElements.length > 0) {
            focusableElements[0].focus();
          } else {
            container.focus();
          }
        }
      }
    }

    // 3. Tab cycling and Escape listener
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscapeRef.current) {
        e.stopPropagation();
        onEscapeRef.current();
        return;
      }

      if (e.key !== 'Tab') return;

      const currentContainer = containerRef.current;
      if (!currentContainer) return;

      const focusables = Array.from(
        currentContainer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(el => el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0);

      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const firstElement = focusables[0];
      const lastElement = focusables[focusables.length - 1];
      const activeElement = document.activeElement;

      if (e.shiftKey) {
        // Shift + Tab: if on first element, wrap to last
        if (activeElement === firstElement || !currentContainer.contains(activeElement)) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: if on last element, wrap to first
        if (activeElement === lastElement || !currentContainer.contains(activeElement)) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // 4. Return focus on cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      const retRef = returnFocusRefStable.current;
      if (retRef?.current && typeof retRef.current.focus === 'function') {
        retRef.current.focus();
      } else if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
      previousActiveElementRef.current = null;
      hasFocusedRef.current = false;
    };
  }, [active, autoFocus]);

  return (
    <div ref={containerRef} tabIndex={-1} className={className} style={{ outline: 'none' }}>
      {children}
    </div>
  );
}
