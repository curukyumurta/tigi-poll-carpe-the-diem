import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import { nanoid } from "nanoid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

// Static client
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true }
});

// rooms map
const rooms = new Map();

function now() {
  return Date.now();
}

function clearRoomTimers(room) {
  if (room.timers?.voteTimeout) clearTimeout(room.timers.voteTimeout);
  if (room.timers?.revealTimeout) clearTimeout(room.timers.revealTimeout);
  room.timers = { voteTimeout: null, revealTimeout: null };
}

function computeWinner(counts) {
  if (counts.A > counts.B) return "A";
  if (counts.B > counts.A) return "B";
  return "TIE";
}

function startRound(roomId, durationMs = 10_000, revealMs = 900) {
  const room = rooms.get(roomId);
  if (!room) return;

  clearRoomTimers(room);

  room.phase = "VOTING";
  room.endsAt = now() + durationMs;
  room.counts = { A: 0, B: 0 };
  room.voted = new Set();

  io.to(roomId).emit("round_started", {
    level: room.level,
    endsAt: room.endsAt
  });

  room.timers.voteTimeout = setTimeout(() => endRound(roomId, revealMs), durationMs + 50);
}

function endRound(roomId, revealMs = 900) {
  const room = rooms.get(roomId);
  if (!room) return;
  if (room.phase !== "VOTING") return;

  room.phase = "REVEAL";
  const winner = computeWinner(room.counts);

  io.to(roomId).emit("round_ended", {
    winner,
    counts: room.counts
  });

  room.timers.revealTimeout = setTimeout(() => {
    // reset state + level up
    room.level += 1;
    room.phase = "IDLE";
    room.endsAt = null;
    room.counts = { A: 0, B: 0 };
    room.voted = new Set();

    io.to(roomId).emit("round_reset", {
      level: room.level
    });
  }, revealMs);
}

// API: create room
app.post("/api/create-room", (req, res) => {
  const roomId = nanoid(6).toUpperCase();
  const hostToken = nanoid(16);

  rooms.set(roomId, {
    hostToken,
    level: 1,
    phase: "IDLE",
    endsAt: null,
    counts: { A: 0, B: 0 },
    voted: new Set(),
    timers: { voteTimeout: null, revealTimeout: null }
  });

  res.json({ roomId, hostToken });
});

io.on("connection", (socket) => {
  socket.on("join", ({ roomId, role, hostToken }) => {
    const room = rooms.get(roomId);
    if (!room) return socket.emit("error_msg", "Room not found");

    const isHost = role === "host" && hostToken && hostToken === room.hostToken;

    socket.join(roomId);

    socket.emit("state", {
      roomId,
      role: isHost ? "host" : "player",
      level: room.level,
      phase: room.phase,
      endsAt: room.endsAt,
      counts: room.counts,
      online: io.sockets.adapter.rooms.get(roomId)?.size || 0
    });

    io.to(roomId).emit("online", io.sockets.adapter.rooms.get(roomId)?.size || 0);
  });

  socket.on("host_start", ({ roomId, hostToken }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (hostToken !== room.hostToken) return;
    if (room.phase === "VOTING") return;

    startRound(roomId, 10_000, 900);
  });

  socket.on("vote", ({ roomId, choice, playerId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.phase !== "VOTING") return;

    if (!playerId || typeof playerId !== "string") return;
    if (room.voted.has(playerId)) return;
    room.voted.add(playerId);

    if (choice !== "A" && choice !== "B") return;

    room.counts[choice] += 1;

    // Spawn pixel: 0..1 relative coords, 3 green tones
    const x = Math.random();
    const y = Math.random();
    const colorIndex = Math.floor(Math.random() * 3);

    io.to(roomId).emit("spawn", { choice, x, y, colorIndex });

    // counts broadcast (şimdilik UI göstermiyor ama lazım olursa var)
    io.to(roomId).emit("counts", room.counts);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Listening on 0.0.0.0:${PORT}`);
});

