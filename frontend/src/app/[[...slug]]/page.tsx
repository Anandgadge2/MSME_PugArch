import React, { Suspense } from 'react';
import App from '@/App';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function CatchAllPage() {
  const cookieStore = await cookies();
  const hasLoaded = cookieStore.get('jsg_initial_load')?.value === 'true';

  return (
    <Suspense fallback={null}>
      <App serverInitialLoadComplete={hasLoaded} />
    </Suspense>
  );
}
