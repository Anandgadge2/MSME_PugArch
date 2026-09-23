'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const App = dynamic(() => import('@/App'), { ssr: false });

interface ClientAppProps {
  serverInitialLoadComplete?: boolean;
  initialSidebarCollapsed?: boolean;
}

export default function ClientApp({ serverInitialLoadComplete, initialSidebarCollapsed }: ClientAppProps) {
  return <App serverInitialLoadComplete={serverInitialLoadComplete} initialSidebarCollapsed={initialSidebarCollapsed} />;
}
