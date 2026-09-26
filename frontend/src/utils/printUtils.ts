/**
 * Utility to print HTML content safely via a hidden iframe.
 * Modern browsers block window.open() popup windows by default,
 * triggering "Please allow popups" errors.
 * Using an isolated iframe allows seamless native printing without popup permissions.
 */

export const printHtmlContent = (htmlContent: string): void => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  // Remove any stale print frame from previous print jobs
  const existingFrame = document.getElementById('msme-print-frame');
  if (existingFrame && existingFrame.parentNode) {
    existingFrame.parentNode.removeChild(existingFrame);
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'msme-print-frame';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';

  document.body.appendChild(iframe);

  const cleanup = () => {
    setTimeout(() => {
      const frame = document.getElementById('msme-print-frame');
      if (frame && frame.parentNode) {
        frame.parentNode.removeChild(frame);
      }
    }, 2000);
  };

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc || !iframe.contentWindow) {
    // Fallback: If iframe is somehow unavailable or blocked by strict sandbox
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 300);
    }
    return;
  }

  iframeDoc.open();
  iframeDoc.write(htmlContent);
  iframeDoc.close();

  // Allow styles and DOM layout inside the iframe to calculate before invoking print
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error('Failed to trigger print dialog:', err);
    } finally {
      cleanup();
    }
  }, 350);
};
