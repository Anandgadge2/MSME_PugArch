'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/hooks/useAuth';
import { Toaster } from 'sonner';
import React from 'react';

const queryClient = new QueryClient();

export const Providers = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      {children}
      <Toaster position="top-center" richColors />
    </AuthProvider>
  </QueryClientProvider>
);
