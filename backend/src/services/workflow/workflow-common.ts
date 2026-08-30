import prisma from '../../lib/prisma.js';
import { auditLog } from '../../modules/audit/audit.service.js';
import { notificationService } from '../notification.service.js';
import { randomToken } from '../../utils/crypto.js';
import { maskSensitive } from '../../utils/maskSensitive.js';

export const db = prisma as any;

export type WorkflowActor = {
  id: number;
  role: string;
  ipAddress?: string;
  userAgent?: string;
};

export const numberSeries = (prefix: string, id?: number | string) => {
  if (id != null && !isNaN(Number(id))) {
    return `${prefix.toUpperCase()}-${String(Math.abs(Number(id))).padStart(5, '0')}`;
  }
  const seq = Math.floor(10000 + Math.random() * 90000);
  return `${prefix.toUpperCase()}-${seq}`;
};

export const roundMoney = (value: number) => Number((Math.round(value * 100) / 100).toFixed(2));

export const auditWorkflow = (actor: WorkflowActor, action: string, entityType: string, entityId?: number | string, metadata?: Record<string, unknown>) =>
  auditLog({
    actorUserId: actor.id,
    actorRole: actor.role,
    action,
    entityType,
    entityId,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    metadata: maskSensitive(metadata || {})
  });

export const auditWorkflowSoon = (actor: WorkflowActor, action: string, entityType: string, entityId?: number | string, metadata?: Record<string, unknown>) => {
  void auditWorkflow(actor, action, entityType, entityId, metadata).catch(error => {
    console.warn('[WorkflowAudit] Background audit failed', error instanceof Error ? error.message : error);
  });
};

export const notifyWorkflow = async (
  userId: number,
  title: string,
  message: string,
  type: string,
  redirectUrl = '/dashboard',
  attachments?: Array<{
    filename: string;
    content?: Buffer | string;
    path?: string;
    contentType?: string;
  }>
) => {
  await notificationService.notifyWithEmail(userId, {
    title,
    message,
    type,
    priority: 'medium',
    redirectUrl,
    attachments
  });
};

export const notifyWorkflowSoon = (
  userId: number,
  title: string,
  message: string,
  type: string,
  redirectUrl = '/dashboard',
  attachments?: Array<{
    filename: string;
    content?: Buffer | string;
    path?: string;
    contentType?: string;
  }>
) => {
  void notifyWorkflow(userId, title, message, type, redirectUrl, attachments).catch(error => {
    console.warn('[WorkflowNotify] Background notification failed', error instanceof Error ? error.message : error);
  });
};

export const assertRole = (actor: WorkflowActor, roles: string[]) => {
  if (!roles.includes(actor.role)) {
    const error = new Error('Access denied') as Error & { statusCode?: number; code?: string };
    error.statusCode = 403;
    error.code = 'ACCESS_DENIED';
    throw error;
  }
};
