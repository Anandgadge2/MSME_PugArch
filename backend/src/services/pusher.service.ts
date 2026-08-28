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

export const isPusherConfigured = (): boolean => pusherInstance !== null;

export const getPusherServer = (): Pusher | null => pusherInstance;

export const publishDisputeEvent = async (disputeId: number, event: any): Promise<boolean> => {
  if (!pusherInstance) return false;
  try {
    const channel = `private-dispute-${disputeId}`;
    await pusherInstance.trigger(channel, event.type, event);
    logger.info(`[Pusher] Triggered ${event.type} on channel ${channel}`);
    return true;
  } catch (err) {
    logger.error({ err, disputeId, eventType: event.type }, '[Pusher] Failed to trigger dispute event');
    return false;
  }
};

export const publishConversationEvent = async (conversationId: number, event: any): Promise<boolean> => {
  if (!pusherInstance) return false;
  try {
    const channel = `private-conversation-${conversationId}`;
    await pusherInstance.trigger(channel, event.type, event);
    logger.info(`[Pusher] Triggered ${event.type} on channel ${channel}`);
    return true;
  } catch (err) {
    logger.error({ err, conversationId, eventType: event.type }, '[Pusher] Failed to trigger conversation event');
    return false;
  }
};

export const authorizePusherChannel = (socketId: string, channelName: string, data?: any) => {
  if (!pusherInstance) {
    throw new Error('Pusher server is not configured');
  }
  return pusherInstance.authorizeChannel(socketId, channelName, data);
};
