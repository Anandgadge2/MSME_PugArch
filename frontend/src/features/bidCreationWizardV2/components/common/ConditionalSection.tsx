import React from 'react';

export default function ConditionalSection({ showWhen, children }: { showWhen: boolean; children: React.ReactNode }) {
  if (!showWhen) return null;
  return <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-4">{children}</div>;
}
