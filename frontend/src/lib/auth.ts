let memoryToken: string | null = null;
export const COOKIE_SESSION_TOKEN = 'cookie-session';

export const getStoredToken = () => {
  if (typeof window === 'undefined') return null;
  const token = memoryToken || localStorage.getItem('token');
  if (!token || token === 'null' || token === 'undefined') return null;
  return token;
};

export const getStoredRefreshToken = () => {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('refreshToken');
  if (!token || token === 'null' || token === 'undefined') return null;
  return token;
};

export const setStoredToken = (token?: string | null, refreshToken?: string | null) => {
  const safeToken = token && token !== 'null' && token !== 'undefined' ? token : null;
  memoryToken = safeToken;
  if (typeof window !== 'undefined') {
    if (safeToken) {
      localStorage.setItem('token', safeToken);
    } else {
      localStorage.removeItem('token');
    }
    if (refreshToken && refreshToken !== 'null' && refreshToken !== 'undefined') {
      localStorage.setItem('refreshToken', refreshToken);
    } else if (refreshToken === null) {
      localStorage.removeItem('refreshToken');
    }
  }
};

let memoryCsrfToken: string | null = null;

export const getStoredCsrfToken = () => {
  if (typeof window === 'undefined') return memoryCsrfToken || '';
  const token = memoryCsrfToken || localStorage.getItem('csrfToken');
  if (!token || token === 'null' || token === 'undefined') return '';
  return token;
};

export const setStoredCsrfToken = (token?: string | null) => {
  const safeToken = token && token !== 'null' && token !== 'undefined' ? token : null;
  memoryCsrfToken = safeToken;
  if (typeof window !== 'undefined') {
    if (safeToken) {
      localStorage.setItem('csrfToken', safeToken);
    } else {
      localStorage.removeItem('csrfToken');
    }
  }
};

export const clearStoredToken = () => {
  memoryToken = null;
  memoryCsrfToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('csrfToken');
  }
};

export const getCookieValue = (name: string) => {
  if (typeof document === 'undefined') return '';
  const match = document.cookie
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
};

export const clearAuthCookie = () => {
  if (typeof document === 'undefined') return;
  document.cookie = 'token=; path=/; max-age=0; SameSite=Strict';
  document.cookie = 'refreshToken=; path=/; max-age=0; SameSite=Strict';
  document.cookie = 'csrfToken=; path=/; max-age=0; SameSite=Strict';
};
