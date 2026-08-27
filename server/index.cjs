const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { Pool } = require('pg');
const { Server } = require('socket.io');

const ROOMS = [
  { id: 'general', name: 'みんなの広場', description: 'チーム全体のお知らせと雑談' },
  { id: 'projects', name: 'プロジェクト', description: '進行中の作業について話す場所' },
  { id: 'lounge', name: 'ラウンジ', description: '気軽な会話と音声通話' },
];

function cleanText(value, max = 2000) {
  return String(value || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
}

function keysMatch(received, expected) {
  const receivedBuffer = Buffer.from(String(received || ''));
  const expectedBuffer = Buffer.from(String(expected || ''));
  return receivedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

function createJsonMessageStore(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'messages.json');
  let messages = [];
  try {
    messages = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(messages)) messages = [];
  } catch {
    messages = [];
  }

  function persist() {
    const temporary = `${file}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(messages.slice(-1000), null, 2), 'utf8');
    fs.renameSync(temporary, file);
  }

  return {
    type: 'json',
    async initialize() {},
    async forRoom(roomId) {
      return messages.filter((item) => item.roomId === roomId).slice(-100);
    },
    async add(message) {
      messages.push(message);
      if (messages.length > 1000) messages = messages.slice(-1000);
      persist();
    },
    async close() {},
  };
}

function createPostgresMessageStore(connectionString) {
  const pool = new Pool({
    connectionString,
    ssl: /localhost|127\.0\.0\.1/.test(connectionString) || process.env.PGSSLMODE === 'disable'
      ? false
      : { rejectUnauthorized: false },
    max: 4,
    idleTimeoutMillis: 30_000,
  });

  return {
    type: 'postgres',
    async initialize() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS halo_messages (
          id UUID PRIMARY KEY,
          room_id VARCHAR(40) NOT NULL,
          sender_id VARCHAR(120) NOT NULL,
          sender_name VARCHAR(32) NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS halo_messages_room_time ON halo_messages (room_id, created_at DESC)');
    },
    async forRoom(roomId) {
      const result = await pool.query(
        `SELECT id, room_id AS "roomId", sender_id AS "senderId", sender_name AS "senderName",
                content, created_at AS "createdAt"
         FROM (
           SELECT * FROM halo_messages WHERE room_id = $1 ORDER BY created_at DESC LIMIT 100
         ) recent
         ORDER BY created_at ASC`,
        [roomId],
      );
      return result.rows;
    },
    async add(message) {
      await pool.query(
        `INSERT INTO halo_messages (id, room_id, sender_id, sender_name, content, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [message.id, message.roomId, message.senderId, message.senderName, message.content, message.createdAt],
      );
    },
    async close() {
      await pool.end();
    },
  };
}

async function startChatServer(options = {}) {
  const host = options.host || process.env.HALO_CHAT_HOST || '0.0.0.0';
  const port = Number(options.port || process.env.PORT || process.env.HALO_CHAT_PORT || 3020);
  const dataDir = options.dataDir || process.env.HALO_CHAT_DATA || path.join(process.cwd(), '.halo-chat-data');
  const distDir = options.distDir || path.join(__dirname, '..', 'dist');
  const accessKey = options.accessKey ?? process.env.HALO_CHAT_ACCESS_KEY ?? '';
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL ?? '';
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: true, credentials: false },
    maxHttpBufferSize: 1e6,
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });
  const store = databaseUrl ? createPostgresMessageStore(databaseUrl) : createJsonMessageStore(dataDir);
  const people = new Map();

  await store.initialize();

  app.disable('x-powered-by');
  app.get('/health', (_request, response) => {
    response.json({
      ok: true,
      service: 'halo-chat',
      rooms: ROOMS.length,
      storage: store.type,
      protected: Boolean(accessKey),
    });
  });
  app.get('/api/rooms', (_request, response) => response.json(ROOMS));

  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir, { maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));
    app.use((request, response, next) => {
      if (request.method !== 'GET' || request.path.startsWith('/api/') || request.path.startsWith('/socket.io/') || !request.accepts('html')) return next();
      return response.sendFile(path.join(distDir, 'index.html'));
    });
  }

  io.use((socket, next) => {
    if (!accessKey || keysMatch(socket.handshake.auth?.accessKey, accessKey)) return next();
    const error = new Error('ACCESS_DENIED');
    error.data = { code: 'ACCESS_DENIED' };
    return next(error);
  });

  function peopleInRoom(roomId) {
    return [...people.entries()]
      .filter(([, person]) => person.roomId === roomId)
      .map(([id, person]) => ({ id, name: person.name, status: 'online', inVoice: Boolean(person.voiceRoom) }));
  }

  function broadcastPresence(roomId) {
    io.to(`room:${roomId}`).emit('presence:update', peopleInRoom(roomId));
  }

  function leaveVoice(socket) {
    const person = people.get(socket.id);
    if (!person?.voiceRoom) return;
    const roomId = person.voiceRoom;
    person.voiceRoom = null;
    socket.leave(`voice:${roomId}`);
    socket.to(`voice:${roomId}`).emit('voice:peer-left', { id: socket.id });
    broadcastPresence(person.roomId);
  }

  io.on('connection', (socket) => {
    socket.on('session:join', async (payload = {}, reply = () => {}) => {
      try {
        const name = cleanText(payload.name, 32) || 'ゲスト';
        const requestedRoom = cleanText(payload.roomId, 40);
        const roomId = ROOMS.some((room) => room.id === requestedRoom) ? requestedRoom : ROOMS[0].id;

        people.set(socket.id, { name, roomId, voiceRoom: null });
        socket.join(`room:${roomId}`);
        reply({
          ok: true,
          socketId: socket.id,
          rooms: ROOMS,
          roomId,
          messages: await store.forRoom(roomId),
          members: peopleInRoom(roomId),
        });
        broadcastPresence(roomId);
      } catch (error) {
        reply({ ok: false, error: 'MESSAGE_STORE_ERROR' });
        console.error('session:join failed', error);
      }
    });

    socket.on('room:switch', async (payload = {}, reply = () => {}) => {
      try {
        const person = people.get(socket.id);
        const roomId = cleanText(payload.roomId, 40);
        if (!person || !ROOMS.some((room) => room.id === roomId)) return reply({ ok: false });
        const previousRoom = person.roomId;
        leaveVoice(socket);
        socket.leave(`room:${previousRoom}`);
        person.roomId = roomId;
        socket.join(`room:${roomId}`);
        reply({ ok: true, roomId, messages: await store.forRoom(roomId), members: peopleInRoom(roomId) });
        broadcastPresence(previousRoom);
        broadcastPresence(roomId);
      } catch (error) {
        reply({ ok: false, error: 'MESSAGE_STORE_ERROR' });
        console.error('room:switch failed', error);
      }
    });

    socket.on('message:send', async (payload = {}, reply = () => {}) => {
      try {
        const person = people.get(socket.id);
        const content = cleanText(payload.content);
        if (!person || !content) return reply({ ok: false });
        const message = {
          id: crypto.randomUUID(),
          roomId: person.roomId,
          senderId: socket.id,
          senderName: person.name,
          content,
          createdAt: new Date().toISOString(),
        };
        await store.add(message);
        io.to(`room:${person.roomId}`).emit('message:new', message);
        reply({ ok: true, id: message.id });
      } catch (error) {
        reply({ ok: false, error: 'MESSAGE_STORE_ERROR' });
        console.error('message:send failed', error);
      }
    });

    socket.on('typing:set', (payload = {}) => {
      const person = people.get(socket.id);
      if (!person) return;
      socket.to(`room:${person.roomId}`).emit('typing:update', {
        id: socket.id,
        name: person.name,
        active: Boolean(payload.active),
      });
    });

    socket.on('voice:join', (_payload = {}, reply = () => {}) => {
      const person = people.get(socket.id);
      if (!person) return reply({ ok: false });
      leaveVoice(socket);
      const voiceRoom = person.roomId;
      const peers = [...people.entries()]
        .filter(([id, candidate]) => id !== socket.id && candidate.voiceRoom === voiceRoom)
        .map(([id, candidate]) => ({ id, name: candidate.name }));
      person.voiceRoom = voiceRoom;
      socket.join(`voice:${voiceRoom}`);
      socket.to(`voice:${voiceRoom}`).emit('voice:peer-joined', { id: socket.id, name: person.name });
      reply({ ok: true, peers });
      broadcastPresence(person.roomId);
    });

    socket.on('voice:leave', () => leaveVoice(socket));

    socket.on('voice:signal', (payload = {}) => {
      const person = people.get(socket.id);
      const targetId = cleanText(payload.targetId, 80);
      const target = people.get(targetId);
      if (!person?.voiceRoom || target?.voiceRoom !== person.voiceRoom) return;
      io.to(targetId).emit('voice:signal', {
        fromId: socket.id,
        fromName: person.name,
        signal: payload.signal,
      });
    });

    socket.on('disconnect', () => {
      const person = people.get(socket.id);
      if (!person) return;
      const roomId = person.roomId;
      leaveVoice(socket);
      people.delete(socket.id);
      broadcastPresence(roomId);
    });
  });

  return new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    httpServer.once('error', onError);
    httpServer.listen(port, host, () => {
      httpServer.off('error', onError);
      if (!options.quiet) {
        console.log(`Halo Chat server listening on http://${host}:${port} (${store.type}, ${accessKey ? 'protected' : 'open'})`);
      }
      resolve({
        port,
        host,
        close: () => new Promise((done) => {
          io.close(async () => {
            if (httpServer.listening) httpServer.close();
            await store.close();
            done();
          });
        }),
      });
    });
  });
}

if (require.main === module) {
  startChatServer().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { startChatServer };
