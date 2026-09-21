import React, { Suspense } from 'react';
import { cookies } from 'next/headers';
import ClientApp from '@/ClientApp';

export const dynamic = 'force-dynamic';

export default async function CatchAllPage() {
  const cookieStore = await cookies();
  const hasLoaded = cookieStore.get('jsg_initial_load')?.value === 'true';
  const initialSidebarCollapsed = cookieStore.get('isSidebarCollapsed')?.value === 'true';

  return (
    <Suspense fallback={null}>
      <ClientApp serverInitialLoadComplete={hasLoaded} initialSidebarCollapsed={initialSidebarCollapsed} />
    </Suspense>
  );
}
