/**
 * File-backed store for MusicTrack + MomentMusic.
 * Works without Supabase; survives process restarts on persistent disk.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = process.env.MUSIC_DATA_DIR
  || path.join(process.cwd(), "data", "music");
const TRACKS_FILE = path.join(DATA_DIR, "music_tracks.json");
const MOMENT_MUSIC_FILE = path.join(DATA_DIR, "moment_music.json");
const AUDIO_DIR = path.join(DATA_DIR, "audio");

function ensureDirs() {
  for (const d of [DATA_DIR, AUDIO_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
  if (!fs.existsSync(TRACKS_FILE)) fs.writeFileSync(TRACKS_FILE, "[]");
  if (!fs.existsSync(MOMENT_MUSIC_FILE)) fs.writeFileSync(MOMENT_MUSIC_FILE, "[]");
}

function readJson(file) {
  ensureDirs();
  try {
    return JSON.parse(fs.readFileSync(file, "utf8") || "[]");
  } catch {
    return [];
  }
}

function writeJson(file, data) {
  ensureDirs();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function uuid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");
}

function nowIso() {
  return new Date().toISOString();
}

/** @returns {Array} */
function listTracks({ publicOnly = false, userId = null } = {}) {
  let rows = readJson(TRACKS_FILE);
  if (publicOnly) {
    rows = rows.filter((t) => t.isPublic !== false);
  }
  if (userId) {
    rows = rows.filter(
      (t) => t.isPublic !== false || t.createdByUserId === userId,
    );
  }
  return rows.sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
  );
}

function getTrack(id) {
  return listTracks().find((t) => t.id === id) || null;
}

function searchTracks(q, { limit = 30, userId = null } = {}) {
  const n = String(q || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  let rows = listTracks({ userId });
  if (n) {
    rows = rows.filter((t) => {
      const hay = `${t.title || ""} ${t.artist || ""}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return hay.includes(n);
    });
  }
  return rows.slice(0, Math.min(100, Math.max(1, Number(limit) || 30)));
}

function createTrack(input) {
  const rows = readJson(TRACKS_FILE);
  const row = {
    id: uuid(),
    title: String(input.title || "Untitled").slice(0, 200),
    artist: String(input.artist || "").slice(0, 200),
    audioUrl: String(input.audioUrl || ""),
    duration: Number(input.duration) || 0,
    coverUrl: String(input.coverUrl || ""),
    source: String(input.source || "upload"),
    isPublic: input.isPublic !== false,
    createdByUserId: input.createdByUserId || null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  if (!row.audioUrl) throw Object.assign(new Error("audioUrl required"), { status: 400 });
  rows.push(row);
  writeJson(TRACKS_FILE, rows);
  return row;
}

function saveAudioFile(buffer, ext = "mp3") {
  ensureDirs();
  const id = uuid();
  const safeExt = String(ext || "mp3").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "mp3";
  const filename = `${id}.${safeExt}`;
  const filePath = path.join(AUDIO_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  return { id, filename, filePath, relativePath: `audio/${filename}` };
}

function getAudioAbsolutePath(filename) {
  ensureDirs();
  const base = path.basename(filename);
  const p = path.join(AUDIO_DIR, base);
  if (!fs.existsSync(p)) return null;
  return p;
}

function upsertMomentMusic(input) {
  const rows = readJson(MOMENT_MUSIC_FILE);
  const momentId = String(input.momentId || "");
  if (!momentId) throw Object.assign(new Error("momentId required"), { status: 400 });
  if (!input.musicTrackId) {
    throw Object.assign(new Error("musicTrackId required"), { status: 400 });
  }
  const track = getTrack(input.musicTrackId);
  if (!track) throw Object.assign(new Error("music track not found"), { status: 404 });

  let row = rows.find((r) => r.momentId === momentId);
  if (row) {
    row.musicTrackId = input.musicTrackId;
    row.startTime = Number(input.startTime) || 0;
    row.endTime = Number(input.endTime) || track.duration || 0;
    row.volume = clamp01(input.volume, 1);
    row.originalVideoVolume = clamp01(input.originalVideoVolume, 1);
    row.updatedAt = nowIso();
  } else {
    row = {
      id: uuid(),
      momentId,
      musicTrackId: input.musicTrackId,
      startTime: Number(input.startTime) || 0,
      endTime: Number(input.endTime) || track.duration || 0,
      volume: clamp01(input.volume, 1),
      originalVideoVolume: clamp01(input.originalVideoVolume, 1),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    rows.push(row);
  }
  writeJson(MOMENT_MUSIC_FILE, rows);
  return { ...row, track };
}

function getMomentMusic(momentId) {
  const rows = readJson(MOMENT_MUSIC_FILE);
  const row = rows.find((r) => r.momentId === String(momentId));
  if (!row) return null;
  const track = getTrack(row.musicTrackId);
  return { ...row, track };
}

function deleteMomentMusic(momentId) {
  const rows = readJson(MOMENT_MUSIC_FILE);
  const next = rows.filter((r) => r.momentId !== String(momentId));
  writeJson(MOMENT_MUSIC_FILE, next);
  return { deleted: rows.length - next.length };
}

function clamp01(v, fallback = 1) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

module.exports = {
  listTracks,
  getTrack,
  searchTracks,
  createTrack,
  saveAudioFile,
  getAudioAbsolutePath,
  upsertMomentMusic,
  getMomentMusic,
  deleteMomentMusic,
  AUDIO_DIR,
  DATA_DIR,
};
