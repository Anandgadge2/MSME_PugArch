import React from 'react';
import { usePermissions } from '../../hooks/useOrgRole';

interface PermissionGuardProps {
  permission: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGuard({ permission, fallback = null, children }: PermissionGuardProps) {
  const { hasPermission, loading } = usePermissions();

  if (loading) return null;
  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export default PermissionGuard;
