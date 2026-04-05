import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import http from 'http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { randomUUID } from 'crypto';

const PORT = Number(process.env.PORT || 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const WORLD_WIDTH = Number(process.env.WORLD_WIDTH || 1800);
const WORLD_HEIGHT = Number(process.env.WORLD_HEIGHT || 1200);
const PROXIMITY_RADIUS = Number(process.env.PROXIMITY_RADIUS || 180);
const EFFECTIVE_PROXIMITY_RADIUS = Math.max(PROXIMITY_RADIUS, 240);
const MONGODB_URI = process.env.MONGODB_URI || '';
const SERVER_WORLD_BROADCAST_INTERVAL_MS = 33;
const SERVER_MOVE_MIN_DISTANCE = 0.6;
const ALLOWED_AVATARS = new Set(['🧑‍🚀', '👩‍🚀', '🛸', '🤖', '🐱', '🦊', '🐼', '🐸']);
const ALLOWED_STICKERS = new Set(['😀', '😎', '🔥', '✨', '💯', '👋', '🎉', '🚀', '💫', '❤️']);
const ALLOWED_CHANNELS = new Set(['general-chat', 'doubts-discussion', 'design-room']);
const ROOM_ZONES = [
  { id: 'room-1', name: 'Room 1', x: 100, y: 110, w: 390, h: 260 },
  { id: 'room-2', name: 'Room 2', x: 540, y: 110, w: 400, h: 260 },
  { id: 'room-3', name: 'Room 3', x: 980, y: 110, w: 430, h: 260 },
];

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

const userPresenceSchema = new mongoose.Schema(
  {
    userId: { type: String, unique: true, index: true },
    name: String,
    socketId: String,
    avatarEmoji: String,
    x: Number,
    y: Number,
    isOnline: Boolean,
  },
  {
    timestamps: true,
  },
);

const UserPresence = mongoose.model('UserPresence', userPresenceSchema);
const usersBySocketId = new Map();
let lastWorldBroadcastAt = 0;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeName(name) {
  const cleaned = String(name || '').trim();
  if (!cleaned) {
    return `Pilot-${Math.floor(Math.random() * 9000 + 1000)}`;
  }

  return cleaned.slice(0, 24);
}

function normalizeAvatarEmoji(value) {
  const candidate = String(value || '').trim();
  if (ALLOWED_AVATARS.has(candidate)) {
    return candidate;
  }

  return '🧑‍🚀';
}

function normalizeSticker(value) {
  const candidate = String(value || '').trim();
  if (ALLOWED_STICKERS.has(candidate)) {
    return candidate;
  }

  return '';
}

function normalizePosition(position) {
  const centerX = WORLD_WIDTH / 2;
  const centerY = WORLD_HEIGHT / 2;
  const randomX = Math.floor(centerX + (Math.random() - 0.5) * 300);
  const randomY = Math.floor(centerY + (Math.random() - 0.5) * 220);

  const x = clamp(Number(position?.x ?? randomX), 20, WORLD_WIDTH - 20);
  const y = clamp(Number(position?.y ?? randomY), 20, WORLD_HEIGHT - 20);

  return { x, y };
}

function serializeUser(user) {
  return {
    socketId: user.socketId,
    userId: user.userId,
    name: user.name,
    avatarEmoji: user.avatarEmoji,
    x: user.x,
    y: user.y,
    roomId: user.roomId,
    roomName: user.roomName,
  };
}

function listUsers() {
  return [...usersBySocketId.values()].map(serializeUser);
}

function pairKey(userIdA, userIdB) {
  return [userIdA, userIdB].sort().join(':');
}

function socketRoomForPair(userIdA, userIdB) {
  return `pair:${pairKey(userIdA, userIdB)}`;
}

function socketRoomForZone(zoneId) {
  return `room:${zoneId}`;
}

function resolveRoomFromPosition(x, y) {
  for (const zone of ROOM_ZONES) {
    if (x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h) {
      return zone;
    }
  }

  return null;
}

function getUserByUserId(userId) {
  for (const user of usersBySocketId.values()) {
    if (user.userId === userId) {
      return user;
    }
  }

  return null;
}

function distanceBetween(userA, userB) {
  const dx = userA.x - userB.x;
  const dy = userA.y - userB.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function emitWorldUpdate(force = false) {
  const now = Date.now();
  if (!force && now - lastWorldBroadcastAt < SERVER_WORLD_BROADCAST_INTERVAL_MS) {
    return;
  }

  lastWorldBroadcastAt = now;
  io.emit('world:update', {
    users: listUsers(),
  });
}

function emitConnectionsForUser(user) {
  const socket = io.sockets.sockets.get(user.socketId);
  if (!socket) {
    return;
  }

  const activeConnectionsByPeer = new Map();

  if (user.roomId) {
    const roomMembers = [...usersBySocketId.values()].filter(
      (candidate) =>
        candidate.socketId !== user.socketId &&
        candidate.roomId === user.roomId,
    );

    for (const peer of roomMembers) {
      activeConnectionsByPeer.set(peer.userId, {
        roomId: socketRoomForZone(user.roomId),
        roomName: user.roomName,
        peerUserId: peer.userId,
        peerName: peer.name,
        peerAvatarEmoji: peer.avatarEmoji,
        roomMemberCount: roomMembers.length + 1,
        linkType: 'room',
      });
    }
  }

  for (const peerUserId of user.proximityPeerIds) {
    if (activeConnectionsByPeer.has(peerUserId)) {
      continue;
    }

    const peer = getUserByUserId(peerUserId);
    if (!peer) {
      continue;
    }

    activeConnectionsByPeer.set(peerUserId, {
      roomId: socketRoomForPair(user.userId, peerUserId),
      roomName: 'Nearby',
      peerUserId: peer.userId,
      peerName: peer.name,
      peerAvatarEmoji: peer.avatarEmoji,
      roomMemberCount: 2,
      linkType: 'radius',
    });
  }

  const activeConnections = [...activeConnectionsByPeer.values()];

  socket.emit('connections:update', {
    activeConnections,
  });
}

function connectProximityPair(userA, userB) {
  if (userA.proximityPeerIds.has(userB.userId)) {
    return;
  }

  userA.proximityPeerIds.add(userB.userId);
  userB.proximityPeerIds.add(userA.userId);

  const pairRoomId = socketRoomForPair(userA.userId, userB.userId);
  const socketA = io.sockets.sockets.get(userA.socketId);
  const socketB = io.sockets.sockets.get(userB.socketId);

  socketA?.join(pairRoomId);
  socketB?.join(pairRoomId);
}

function disconnectProximityPair(userA, userB) {
  if (!userA.proximityPeerIds.has(userB.userId)) {
    return;
  }

  userA.proximityPeerIds.delete(userB.userId);
  userB.proximityPeerIds.delete(userA.userId);

  const pairRoomId = socketRoomForPair(userA.userId, userB.userId);
  const socketA = io.sockets.sockets.get(userA.socketId);
  const socketB = io.sockets.sockets.get(userB.socketId);

  socketA?.leave(pairRoomId);
  socketB?.leave(pairRoomId);
}

function syncProximityForUser(user) {
  for (const other of usersBySocketId.values()) {
    if (other.socketId === user.socketId) {
      continue;
    }

    const inRange = distanceBetween(user, other) < EFFECTIVE_PROXIMITY_RADIUS;
    if (inRange) {
      connectProximityPair(user, other);
    } else {
      disconnectProximityPair(user, other);
    }
  }
}

function cleanupProximityForUser(user) {
  const userSocket = io.sockets.sockets.get(user.socketId);

  for (const peerUserId of [...user.proximityPeerIds]) {
    const peer = getUserByUserId(peerUserId);
    if (!peer) {
      continue;
    }

    const pairRoomId = socketRoomForPair(user.userId, peer.userId);
    peer.proximityPeerIds.delete(user.userId);
    user.proximityPeerIds.delete(peer.userId);

    const peerSocket = io.sockets.sockets.get(peer.socketId);
    userSocket?.leave(pairRoomId);
    peerSocket?.leave(pairRoomId);
  }
}

function syncRoomMembership(user) {
  const socket = io.sockets.sockets.get(user.socketId);
  const nextRoom = resolveRoomFromPosition(user.x, user.y);
  const nextRoomId = nextRoom?.id || '';
  const previousRoomId = user.roomId || '';

  if (socket && previousRoomId && previousRoomId !== nextRoomId) {
    socket.leave(socketRoomForZone(previousRoomId));
  }

  if (socket && nextRoomId) {
    const nextSocketRoom = socketRoomForZone(nextRoomId);
    if (!socket.rooms.has(nextSocketRoom)) {
      socket.join(nextSocketRoom);
    }
  }

  user.roomId = nextRoomId;
  user.roomName = nextRoom?.name || '';
}

function emitConnectionsForAllUsers() {
  for (const user of usersBySocketId.values()) {
    emitConnectionsForUser(user);
  }
}

function relayRtcEvent(eventName, socket, payload = {}) {
  const sender = usersBySocketId.get(socket.id);
  if (!sender) {
    return;
  }

  const roomId = String(payload.roomId || '');
  const targetUserId = String(payload.targetUserId || '');
  if (!roomId || !targetUserId || !socket.rooms.has(roomId)) {
    return;
  }

  const targetUser = getUserByUserId(targetUserId);
  if (!targetUser) {
    return;
  }

  const targetSocket = io.sockets.sockets.get(targetUser.socketId);
  if (!targetSocket || !targetSocket.rooms.has(roomId)) {
    return;
  }

  targetSocket.emit(eventName, {
    roomId,
    fromUserId: sender.userId,
    fromName: sender.name,
    fromAvatarEmoji: sender.avatarEmoji,
    sdp: payload.sdp,
    candidate: payload.candidate,
  });
}

async function persistUser(user, isOnline) {
  if (!MONGODB_URI) {
    return;
  }

  await UserPresence.updateOne(
    { userId: user.userId },
    {
      $set: {
        userId: user.userId,
        name: user.name,
        avatarEmoji: user.avatarEmoji,
        socketId: user.socketId,
        x: user.x,
        y: user.y,
        isOnline,
      },
    },
    { upsert: true },
  );
}

app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    usersOnline: usersBySocketId.size,
    world: {
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
      proximityRadius: EFFECTIVE_PROXIMITY_RADIUS,
    },
    mongodbEnabled: Boolean(MONGODB_URI),
  });
});

app.get('/', (_, res) => {
  res.json({
    status: 'ok',
    message: 'Virtual Cosmos backend is running. Use /health for service status.',
  });
});

io.on('connection', (socket) => {
  socket.on('user:register', async (payload = {}, callback) => {
    const name = normalizeName(payload.name);
    const avatarEmoji = normalizeAvatarEmoji(payload.avatarEmoji);
    const { x, y } = normalizePosition(payload.position);

    const user = {
      socketId: socket.id,
      userId: randomUUID(),
      name,
      avatarEmoji,
      x,
      y,
      roomId: '',
      roomName: '',
      proximityPeerIds: new Set(),
      lastMoveProcessedAt: 0,
    };

    usersBySocketId.set(socket.id, user);
    syncRoomMembership(user);
    syncProximityForUser(user);

    socket.emit('world:init', {
      you: serializeUser(user),
      users: listUsers(),
      world: {
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT,
      },
      radius: EFFECTIVE_PROXIMITY_RADIUS,
    });

    emitConnectionsForAllUsers();
    emitWorldUpdate(true);

    try {
      await persistUser(user, true);
    } catch (error) {
      console.error('Mongo persistence failed on register:', error.message);
    }

    if (typeof callback === 'function') {
      callback({ ok: true, userId: user.userId });
    }
  });

  socket.on('user:move', async (payload = {}) => {
    const user = usersBySocketId.get(socket.id);
    if (!user) {
      return;
    }

    const x = clamp(Number(payload.x), 20, WORLD_WIDTH - 20);
    const y = clamp(Number(payload.y), 20, WORLD_HEIGHT - 20);

    if (Number.isNaN(x) || Number.isNaN(y)) {
      return;
    }

    const now = Date.now();
    if (now - user.lastMoveProcessedAt < SERVER_WORLD_BROADCAST_INTERVAL_MS) {
      return;
    }

    const dx = x - user.x;
    const dy = y - user.y;
    if (Math.hypot(dx, dy) < SERVER_MOVE_MIN_DISTANCE) {
      return;
    }

    user.lastMoveProcessedAt = now;

    user.x = x;
    user.y = y;

    syncRoomMembership(user);
    syncProximityForUser(user);
    emitConnectionsForAllUsers();
    emitWorldUpdate();

    try {
      await persistUser(user, true);
    } catch (error) {
      console.error('Mongo persistence failed on move:', error.message);
    }
  });

  socket.on('chat:send', (payload = {}) => {
    const user = usersBySocketId.get(socket.id);
    if (!user) {
      return;
    }

    const roomId = String(payload.roomId || '');
    const incomingChannel = String(payload.channel || 'general-chat').trim();
    const channel = ALLOWED_CHANNELS.has(incomingChannel)
      ? incomingChannel
      : 'general-chat';
    const type = payload.type === 'sticker' ? 'sticker' : 'text';
    const text =
      type === 'sticker'
        ? normalizeSticker(payload.text)
        : String(payload.text || '').trim();

    if (!roomId || !text || text.length > 280 || !socket.rooms.has(roomId)) {
      return;
    }

    io.to(roomId).emit('chat:message', {
      roomId,
      channel,
      type,
      text,
      senderUserId: user.userId,
      senderName: user.name,
      senderAvatarEmoji: user.avatarEmoji,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('rtc:offer', (payload = {}) => {
    relayRtcEvent('rtc:offer', socket, payload);
  });

  socket.on('rtc:call-request', (payload = {}) => {
    relayRtcEvent('rtc:call-request', socket, payload);
  });

  socket.on('rtc:call-accept', (payload = {}) => {
    relayRtcEvent('rtc:call-accept', socket, payload);
  });

  socket.on('rtc:call-reject', (payload = {}) => {
    relayRtcEvent('rtc:call-reject', socket, payload);
  });

  socket.on('rtc:answer', (payload = {}) => {
    relayRtcEvent('rtc:answer', socket, payload);
  });

  socket.on('rtc:ice-candidate', (payload = {}) => {
    relayRtcEvent('rtc:ice-candidate', socket, payload);
  });

  socket.on('rtc:hangup', (payload = {}) => {
    relayRtcEvent('rtc:hangup', socket, payload);
  });

  socket.on('disconnect', async () => {
    const user = usersBySocketId.get(socket.id);
    if (!user) {
      return;
    }

    cleanupProximityForUser(user);
    usersBySocketId.delete(socket.id);
    emitConnectionsForAllUsers();
    emitWorldUpdate(true);

    try {
      await persistUser(user, false);
    } catch (error) {
      console.error('Mongo persistence failed on disconnect:', error.message);
    }
  });
});

async function bootstrap() {
  if (MONGODB_URI) {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('MongoDB connected.');
    } catch (error) {
      console.error('MongoDB connection failed:', error.message);
    }
  } else {
    console.log('MONGODB_URI not set, running with in-memory state only.');
  }

  server.listen(PORT, () => {
    console.log(`Virtual Cosmos server listening on http://localhost:${PORT}`);
  });
}

bootstrap();