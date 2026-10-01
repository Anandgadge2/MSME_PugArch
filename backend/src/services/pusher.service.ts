import Pusher from 'pusher';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const pusherAppId = process.env.PUSHER_APP_ID || '';
const pusherKey = process.env.PUSHER_KEY || process.env.NEXT_PUBLIC_PUSHER_KEY || '';
const pusherSecret = process.env.PUSHER_SECRET || '';
const pusherCluster = process.env.PUSHER_CLUSTER || process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap2';

let pusherInstance: Pusher | null = null;

if (pusherAppId && pusherKey && pusherSecret) {
  try {
    pusherInstance = new Pusher({
      appId: pusherAppId,
      key: pusherKey,
      secret: pusherSecret,
      cluster: pusherCluster,
      useTLS: true
    });
    logger.info(`[Pusher] Server initialized successfully (cluster: ${pusherCluster})`);
  } catch (err) {
    logger.error({ err }, '[Pusher] Failed to initialize Pusher server instance');
  }
} else {
  logger.info('[Pusher] Credentials not present in environment; defaulting to local WebSocket fallback mode');
}

let pusherDailyCount = 0;
let pusherDayKey = '';
const PUSHER_DAILY_LIMIT = 180_000; // 90% of free tier 200k limit to safely throttle before exhaustion

export const trackPusherMessage = () => {
  const today = new Date().toISOString().slice(0, 10);
  if (pusherDayKey !== today) {
    pusherDayKey = today;
    pusherDailyCount = 0;
  }
  pusherDailyCount++;
};

export const getPusherHealth = () => {
  const today = new Date().toISOString().slice(0, 10);
  if (pusherDayKey !== today) {
    pusherDayKey = today;
    pusherDailyCount = 0;
  }
  return {
    configured: isPusherConfigured(),
    cluster: pusherCluster,
    dailyCount: pusherDailyCount,
    dailyLimit: PUSHER_DAILY_LIMIT,
    isThrottled: pusherDailyCount >= PUSHER_DAILY_LIMIT,
    remaining: Math.max(0, PUSHER_DAILY_LIMIT - pusherDailyCount),
  };
};

export const isPusherConfigured = (): boolean => pusherInstance !== null;

export const getPusherServer = (): Pusher | null => pusherInstance;

export const publishDisputeEvent = async (disputeId: number, event: any): Promise<boolean> => {
  if (!pusherInstance) return false;
  if (getPusherHealth().isThrottled) {
    logger.warn('[Pusher] Quota throttle reached; bypassing Pusher publish for dispute');
    return false;
  }
  try {
    const channel = `private-dispute-${disputeId}`;
    await pusherInstance.trigger(channel, event.type, event);
    trackPusherMessage();
    logger.info(`[Pusher] Triggered ${event.type} on channel ${channel}`);
    return true;
  } catch (err) {
    logger.error({ err, disputeId, eventType: event.type }, '[Pusher] Failed to trigger dispute event');
    return false;
  }
};

export const publishConversationEvent = async (conversationId: number, event: any): Promise<boolean> => {
  if (!pusherInstance) return false;
  if (getPusherHealth().isThrottled) {
    logger.warn('[Pusher] Quota throttle reached; bypassing Pusher publish for conversation');
    return false;
  }
  try {
    const channel = `private-conversation-${conversationId}`;
    await pusherInstance.trigger(channel, event.type, event);
    trackPusherMessage();
    logger.info(`[Pusher] Triggered ${event.type} on channel ${channel}`);
    return true;
  } catch (err) {
    logger.error({ err, conversationId, eventType: event.type }, '[Pusher] Failed to trigger conversation event');
    return false;
  }
};

export const publishProcurementEvent = async (procurementId: number | string, event: any): Promise<boolean> => {
  if (!pusherInstance) return false;
  if (getPusherHealth().isThrottled) {
    logger.warn('[Pusher] Quota throttle reached; bypassing Pusher publish for procurement');
    return false;
  }
  try {
    const channel = `procurement-${procurementId}`;
    await pusherInstance.trigger(channel, event.type, event);
    trackPusherMessage();
    logger.info(`[Pusher] Triggered ${event.type} on channel ${channel}`);
    return true;
  } catch (err) {
    logger.error({ err, procurementId, eventType: event.type }, '[Pusher] Failed to trigger procurement event');
    return false;
  }
};

export const publishAuctionEvent = async (auctionId: number | string, event: any): Promise<boolean> => {
  if (!pusherInstance) return false;
  if (getPusherHealth().isThrottled) {
    logger.warn('[Pusher] Quota throttle reached; bypassing Pusher publish for auction');
    return false;
  }
  try {
    const channel = `auction-${auctionId}`;
    await pusherInstance.trigger(channel, event.type, event);
    trackPusherMessage();
    logger.info(`[Pusher] Triggered ${event.type} on channel ${channel}`);
    return true;
  } catch (err) {
    logger.error({ err, auctionId, eventType: event.type }, '[Pusher] Failed to trigger auction event');
    return false;
  }
};

export const publishUserEvent = async (userId: number, event: any): Promise<boolean> => {
  if (!pusherInstance) return false;
  if (getPusherHealth().isThrottled) {
    logger.warn('[Pusher] Quota throttle reached; bypassing Pusher publish for user');
    return false;
  }
  try {
    const channel = `private-user-${userId}`;
    await pusherInstance.trigger(channel, event.type, event);
    trackPusherMessage();
    logger.info(`[Pusher] Triggered ${event.type} on channel ${channel}`);
    return true;
  } catch (err) {
    logger.error({ err, userId, eventType: event.type }, '[Pusher] Failed to trigger user event');
    return false;
  }
};

export const authorizePusherChannel = (socketId: string, channelName: string, data?: any) => {
  if (!pusherInstance) {
    throw new Error('Pusher server is not configured');
  }
  return pusherInstance.authorizeChannel(socketId, channelName, data);
};

