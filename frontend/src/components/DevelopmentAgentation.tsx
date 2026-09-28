'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const AgentationWidget = dynamic(
  () => import('agentation').then((mod) => mod.Agentation),
  { ssr: false }
);

export function DevelopmentAgentation() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (typeof window !== 'undefined' && sessionStorage.getItem('agentation_unavailable') === 'true') {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 200);

    fetch('http://localhost:4747/health', { signal: controller.signal })
      .then((response) => setReady(response.ok))
      .catch(() => {
        setReady(false);
        try {
          sessionStorage.setItem('agentation_unavailable', 'true');
        } catch {
          // ignore
        }
      })
      .finally(() => window.clearTimeout(timer));

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  if (!ready) return null;
  return <AgentationWidget endpoint="http://localhost:4747" />;
}
