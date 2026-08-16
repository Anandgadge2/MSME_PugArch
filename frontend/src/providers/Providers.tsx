'use client';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/hooks/useAuth';
import { Toaster } from 'sonner';
import React from 'react';
import { queryClient } from '@/lib/queryClient';

export const Providers = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      {children}
      <Toaster position="top-center" richColors closeButton expand={true} />
    </AuthProvider>
  </QueryClientProvider>
);
