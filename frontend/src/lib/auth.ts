export const getStoredToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};

export const setStoredToken = (token: string) => {
  if (typeof window !== 'undefined') localStorage.setItem('token', token);
};

export const clearStoredToken = () => {
  if (typeof window !== 'undefined') localStorage.removeItem('token');
};
