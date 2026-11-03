'use client';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/hooks/useAuth';
import { AccessibilityProvider } from '@/providers/AccessibilityProvider';
import { Toaster } from 'sonner';
import React, { useState } from 'react';
import { getQueryClient } from '@/lib/queryClient';
import { CookieConsentBanner } from '@/components/compliance/CookieConsentBanner';
import { SessionTimeoutDialog } from '@/components/layout/SessionTimeoutDialog';

export const Providers = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(getQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <AccessibilityProvider>
        <AuthProvider>
          {children}
          <Toaster position="top-center" richColors closeButton expand={true} />
          <CookieConsentBanner />
          <SessionTimeoutDialog />
        </AuthProvider>
      </AccessibilityProvider>
    </QueryClientProvider>
  );
};
