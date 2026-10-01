import DOMPurify from 'dompurify';

/**
 * Sanitizes untrusted user-supplied HTML strings to prevent XSS.
 * Safe for client-side rendering with dangerouslySetInnerHTML.
 */
export const sanitizeHtml = (dirty: string): string => {
  if (typeof window === 'undefined') {
    return dirty ? dirty.replace(/<[^>]*>?/gm, '') : '';
  }
  return String(DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'ol', 'li', 'span', 'br', 'code', 'pre', 'h1', 'h2', 'h3', 'h4'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'title']
  }));
};
