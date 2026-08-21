import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { COOKIE_SESSION_TOKEN, clearAuthCookie, clearStoredToken, getCookieValue, getStoredToken, setStoredToken } from '../lib/auth';
import { clearGuestCart } from '../features/marketplace/hooks/useGuestCart';

interface User {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  role: 'seller' | 'buyer' | 'shg' | 'admin' | 'master_admin' | 'financier';
  accountType?: 'MASTER_ADMIN' | 'SUPERADMIN' | 'SELLER' | 'BUYER' | 'SHG' | 'FINANCIER';
  accountTypeId?: number;
  isDualRole?: boolean;
  registrationStatus?: 'incomplete' | 'completed';
  onboardingStatus: 'pending' | 'pending_validation' | 'under_compliance_review' | 'resubmission_required' | 'approved_for_procurement' | 'approved' | 'rejected';
  status?: string;
  emailVerified?: boolean;
  mobileVerified?: boolean;
  twoFactorEnabled?: boolean;
  adminFeedback?: string;
  permissions?: string[];
  enabledFeatures?: string[];
  sellerProfile?: any;
  buyerProfile?: any;
  organizationId?: number;
  districtId?: number | null;
  activeScope?: { scopeType: string; scopeId: string | null };
  organization?: {
    id: number;
    organizationName: string;
    verificationStatus: string;
    isBlacklisted: boolean;
  } | null;
  registrationDetails?: {
    userId?: string;
    selectedDocuments?: string[];
    [key: string]: any;
  };
  sectionStatus?: {
    basic: string;
    business: string;
    compliance: string;
    bank: string;
    documents: string;
  };
  sectionRejectionReasons?: {
    basic?: string;
    business?: string;
    compliance?: string;
    bank?: string;
    documents?: string;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isLoggingIn: boolean;
  isLoggingOut: boolean;
  setIsLoggingIn: React.Dispatch<React.SetStateAction<boolean>>;
  setIsLoggingOut: React.Dispatch<React.SetStateAction<boolean>>;
  login: (token: string, user: User, refreshToken?: string, redirectPath?: string) => Promise<void> | void;
  logout: (redirectPath?: string | any) => Promise<void>;
  refreshUser: (options?: { skipCache?: boolean }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('msme_user_cache');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
        setLoading(false);
      }
    } catch {
      // ignore
    }
  }, []);

  const clearLocalSession = useCallback(() => {
    clearStoredToken();
    localStorage.removeItem('msme_user_cache');
    clearAuthCookie();
    setToken(null);
    setUser(null);
    setLoading(false);
    api.invalidate();
  }, []);

  const logout = useCallback(async (redirectPath?: string | any) => {
    const target = typeof redirectPath === 'string' ? redirectPath : '/';
    setIsLoggingOut(true);
    try {
      // Do not generate a predictable 401 for visitors who never had a
      // session. A real cookie session always has the readable CSRF marker.
      if (getCookieValue('csrfToken') || getStoredToken()) {
        await api.post('/api/auth/logout', {}).catch(() => undefined);
      }
    } finally {
      clearLocalSession();
      router.replace(target);
    }
  }, [clearLocalSession, router]);

  const refreshUser = useCallback(async (options?: { skipCache?: boolean }) => {
    const headers = {};
    const hasCachedUser = Boolean(localStorage.getItem('msme_user_cache'));
    const hasSessionMarker = Boolean(getCookieValue('csrfToken'));
    const hasStoredSession = Boolean(getStoredToken());

    // The public marketplace is intentionally usable without authentication.
    // If the browser has no evidence of a session, do not probe /me, attempt a
    // refresh, call logout, or redirect the visitor to /login.
    if (!hasCachedUser && !hasSessionMarker && !hasStoredSession) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }
    
    if (!options?.skipCache) {
      const cachedMe = api.peek('/api/auth/me', { headers });
      if (cachedMe?.user) {
        setUser(cachedMe.user);
        localStorage.setItem('msme_user_cache', JSON.stringify(cachedMe.user));
        setLoading(false);
      }
    }

    try {
      const res = await api.fetch('/api/auth/me', { headers, skipCache: options?.skipCache });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setStoredToken(COOKIE_SESSION_TOKEN);
        setToken(COOKIE_SESSION_TOKEN);
        localStorage.setItem('msme_user_cache', JSON.stringify(data.user));
      } else {
        if (![401, 403].includes(res.status)) return;

        // A stale local cache/token without the cookie marker cannot be
        // refreshed. Clear it silently and keep public pages public.
        if (!getCookieValue('csrfToken')) {
          clearLocalSession();
          return;
        }

        const refreshRes = await api.post('/api/auth/refresh', {});
        if (!refreshRes.ok) {
          clearLocalSession();
          return;
        }
        const refreshData = await refreshRes.json();
        const currentToken = refreshData.accessToken || refreshData.token || COOKIE_SESSION_TOKEN;
        setStoredToken(currentToken);
        setToken(currentToken);

        const retry = await api.fetch('/api/auth/me', { headers: { Authorization: `Bearer ${currentToken}` }, skipCache: true });
        if (!retry.ok) {
          clearLocalSession();
          return;
        }
        const data = await retry.json();
        setUser(data.user);
        localStorage.setItem('msme_user_cache', JSON.stringify(data.user));
      }
    } catch (err) {
      console.error('Failed to refresh user session:', err);
    } finally {
      setLoading(false);
    }
  }, [clearLocalSession]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [logout]);

  const login = useCallback(async (token: string, user: User, _refreshToken?: string, redirectPath?: string) => {
    setIsLoggingIn(true);
    setStoredToken(token || COOKIE_SESSION_TOKEN);
    localStorage.removeItem('refreshToken');
    localStorage.setItem('msme_user_cache', JSON.stringify(user));
    setToken(token || COOKIE_SESSION_TOKEN);
    setUser(user);
    setLoading(false);
    const guestCartToken = localStorage.getItem('jsg_guest_cart_token');
    const localGuestCart = (() => {
      try {
        const raw = localStorage.getItem('jsg_guest_cart');
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.map((item: any) => ({ id: item.id, type: item.type, quantity: item.quantity || 1 })) : [];
      } catch {
        return [];
      }
    })();
    if (user.role === 'buyer' && (guestCartToken || localGuestCart.length > 0)) {
      void api.post('/api/cart/merge-guest', { cartToken: guestCartToken || undefined, items: localGuestCart }, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        if (res.ok) {
          localStorage.removeItem('jsg_guest_cart_token');
          localStorage.removeItem('jsg_guest_cart');
          clearGuestCart();
          api.invalidate('/api/cart');
        }
      }).catch(() => undefined);
    }

    const isShg = user.role === 'shg' || user.accountType === 'SHG';
    const targetUrl = redirectPath || (
      user.role === 'master_admin' ? '/master-admin' : isShg ? '/shg/onboarding' : '/dashboard'
    );

    router.replace(targetUrl);
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, token, loading, isLoggingIn, isLoggingOut, setIsLoggingIn, setIsLoggingOut, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
