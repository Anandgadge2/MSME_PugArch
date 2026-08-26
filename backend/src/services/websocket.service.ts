import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { verifyAccessToken, type AccessTokenPayload } from './token.service.js';
import prisma from '../lib/prisma.js';
import { logger } from '../config/logger.js';

type AuthenticatedWebSocket = InstanceType<typeof WebSocket> & {
  user?: Partial<AccessTokenPayload>;
  isAlive: boolean;
  subscriptions: Set<string>;
};

export type DisputeSocketEvent =
  | { type: 'DISPUTE_MESSAGE_CREATED'; disputeId: number; message: any }
  | { type: 'DISPUTE_STATUS_CHANGED'; disputeId: number; status: string; previousStatus: string; updatedBy: string }
  | { type: 'DISPUTE_UPDATED'; disputeId: number; dispute: any }
  | { type: 'DISPUTE_EVIDENCE_ADDED'; disputeId: number; evidence: any };

const wss = new WebSocketServer({ noServer: true });

// Map of roomId (e.g. 'dispute:123') to Set of sockets
const rooms = new Map<string, Set<AuthenticatedWebSocket>>();

const joinRoom = (socket: AuthenticatedWebSocket, roomId: string) => {
  socket.subscriptions.add(roomId);
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  rooms.get(roomId)!.add(socket);
  logger.info(`[WS] Socket joined room ${roomId}. Total in room: ${rooms.get(roomId)?.size}`);
};

const leaveRoom = (socket: AuthenticatedWebSocket, roomId: string) => {
  socket.subscriptions.delete(roomId);
  const room = rooms.get(roomId);
  if (room) {
    room.delete(socket);
    if (room.size === 0) rooms.delete(roomId);
  }
};

const extractTokenFromCookie = (cookieHeader: string | undefined): string => {
  if (!cookieHeader) return '';
  const match = cookieHeader
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith('token='));
  if (!match) return '';
  try {
    return decodeURIComponent(match.slice(6));
  } catch {
    return match.slice(6);
  }
};

const handleAuth = (socket: AuthenticatedWebSocket, token: string) => {
  try {
    const payload = verifyAccessToken(token);
    if (!payload || !payload.id) {
      logger.warn('[WS] Authentication failed: Invalid token payload');
      socket.send(JSON.stringify({ type: 'ERROR', message: 'Invalid token' }));
      return false;
    }
    socket.user = payload;
    logger.info(`[WS] User ${payload.id} (${payload.role}) authenticated successfully via HttpOnly cookie`);
    socket.send(JSON.stringify({ type: 'AUTH_SUCCESS' }));
    return true;
  } catch (err) {
    logger.error({ err }, '[WS] Authentication error');
    socket.send(JSON.stringify({ type: 'ERROR', message: 'Authentication failed' }));
    return false;
  }
};

const handleSubscribe = async (socket: AuthenticatedWebSocket, disputeId: number) => {
  if (!socket.user) {
    socket.send(JSON.stringify({ type: 'ERROR', message: 'Not authenticated' }));
    return;
  }
  
  try {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      select: { buyerId: true, sellerId: true, againstOrgId: true }
    });

    if (!dispute) {
      socket.send(JSON.stringify({ type: 'ERROR', message: 'Dispute not found' }));
      return;
    }

    const isAdmin = ['admin', 'master_admin'].includes(socket.user.role || '');
    const isParticipant =
      socket.user.id === dispute.buyerId ||
      socket.user.id === dispute.sellerId ||
      (socket.user.organizationId && socket.user.organizationId === dispute.againstOrgId);

    if (!isAdmin && !isParticipant) {
      socket.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized for this dispute' }));
      return;
    }

    joinRoom(socket, `dispute:${disputeId}`);
    socket.send(JSON.stringify({ type: 'SUBSCRIBE_SUCCESS', disputeId }));
  } catch (error) {
    socket.send(JSON.stringify({ type: 'ERROR', message: 'Subscription failed' }));
  }
};

wss.on('connection', (socket: AuthenticatedWebSocket, req) => {
  logger.info(`[WS] New connection from ${req.socket.remoteAddress}`);
  socket.isAlive = true;
  socket.subscriptions = new Set();
  
  // Authenticate immediately using HttpOnly cookie from handshake headers
  const token = extractTokenFromCookie(req.headers.cookie);
  if (!token) {
    logger.warn('[WS] Authentication failed: No token cookie found during handshake');
    socket.send(JSON.stringify({ type: 'ERROR', message: 'Authentication failed: Missing token' }));
    socket.close();
    return;
  }
  
  const isAuthenticated = handleAuth(socket, token);
  if (!isAuthenticated) {
    socket.close();
    return;
  }

  socket.on('pong', () => {
    socket.isAlive = true;
  });

  socket.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      switch (message.type) {
        case 'SUBSCRIBE':
          if (message.disputeId) {
            await handleSubscribe(socket, Number(message.disputeId));
          }
          break;
        case 'UNSUBSCRIBE':
          if (message.disputeId) {
            leaveRoom(socket, `dispute:${message.disputeId}`);
          }
          break;
        case 'PING':
          socket.send(JSON.stringify({ type: 'PONG' }));
          break;
        default:
          logger.warn(`[WS] Unknown message type: ${message.type}`);
      }
    } catch (err) {
      logger.warn({ err }, 'WebSocket message handling failed');
    }
  });

  socket.on('close', () => {
    logger.info(`[WS] Connection closed for user ${socket.user?.id || 'unknown'}`);
    socket.subscriptions.forEach((roomId) => leaveRoom(socket, roomId));
  });
});

const pingInterval = setInterval(() => {
  wss.clients.forEach((client) => {
    const socket = client as AuthenticatedWebSocket;
    if (socket.isAlive === false) return socket.terminate();
    socket.isAlive = false;
    socket.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(pingInterval);
});

export const handleUpgrade = (request: IncomingMessage, socket: any, head: Buffer) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
};

import { publishDisputeEvent } from './pusher.service.js';

export const broadcastToDispute = (disputeId: number, event: DisputeSocketEvent) => {
  // Always push to Pusher if configured (serverless compatible)
  void publishDisputeEvent(disputeId, event);

  const roomId = `dispute:${disputeId}`;
  const room = rooms.get(roomId);
  
  if (!room) {
    logger.info(`[WS] Event ${event.type} dropped for local room ${roomId} - no active local WS subscribers`);
    return;
  }

  const message = JSON.stringify(event);
  let sentCount = 0;
  room.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sentCount++;
    }
  });
  
  logger.info(`[WS] Broadcasted ${event.type} to ${sentCount} clients in ${roomId}`);
};
