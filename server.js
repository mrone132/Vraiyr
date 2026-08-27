import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createSession,
  deleteSession,
  getAllSessions,
  getSession,
  loadExistingSessions,
} from './whatsapp.js';
import { BOT_NAME, DEV_NAME } from './commands.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── In-memory cache of the last generated code, so the frontend can poll
// while requestPairingCode() does its thing on the WhatsApp side.
const pendingCodes = new Map();

// ── POST /api/pair — generates (or returns) a pairing code for a number ────
app.post('/api/pair', async (req, res) => {
  const raw = String(req.body?.number || '').replace(/\D/g, '');

  if (!raw || raw.length < 8) {
    return res.status(400).json({ ok: false, error: 'Numéro invalide. Format: indicatif + numéro, sans le +.' });
  }

  const existing = getSession(raw);
  if (existing?.connected) {
    return res.status(409).json({ ok: false, error: 'Ce numéro est déjà connecté à MINI KILLUA MD.' });
  }

  try {
    const { code } = await createSession(raw);
    if (!code) {
      return res.status(409).json({ ok: false, error: 'Session déjà enregistrée pour ce numéro.' });
    }
    pendingCodes.set(raw, code);
    return res.json({ ok: true, number: raw, code });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Impossible de générer le code.' });
  }
});

// ── GET /api/status/:number — check whether pairing succeeded ──────────────
app.get('/api/status/:number', (req, res) => {
  const number = String(req.params.number || '').replace(/\D/g, '');
  const session = getSession(number);
  res.json({
    ok: true,
    connected: !!session?.connected,
    exists: !!session,
  });
});

// ── DELETE /api/pair/:number — unpair a number ──────────────────────────────
app.delete('/api/pair/:number', (req, res) => {
  const number = String(req.params.number || '').replace(/\D/g, '');
  const removed = deleteSession(number);
  pendingCodes.delete(number);
  res.json({ ok: true, removed });
});

// ── GET /api/sessions — list active sessions ────────────────────────────────
app.get('/api/sessions', (_req, res) => {
  res.json({ ok: true, sessions: getAllSessions() });
});

// ── GET /api/info — branding info for the frontend ──────────────────────────
app.get('/api/info', (_req, res) => {
  res.json({ ok: true, name: BOT_NAME, dev: DEV_NAME });
});

app.listen(PORT, () => {
  console.log('');
  console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃         🍁 𝗠𝗜𝗡𝗜 𝐊𝐈𝐋𝐋𝐔𝐀 𝗠𝗗 🍁          ┃');
  console.log('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫');
  console.log(`┃ ◉ 𝗪𝗘𝗕 𝗦𝗘𝗥𝗩𝗘𝗥 ➜ http://localhost:${PORT}`.padEnd(41) + '┃');
  console.log('┃ ◉ 𝗠𝗢𝗗𝗘       ➜ 𝗠𝗨𝗟𝗧𝗜 𝗗𝗘𝗩𝗜𝗖𝗘         ┃');
  console.log('┃ ◉ 𝗗𝗘𝗩𝗘𝗟𝗢𝗣𝗘𝗥  ➜ 𝐊𝐈𝐋𝐋𝐔𝐀 𝐓𝐄𝐀𝐌             ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
  console.log('');
  loadExistingSessions().catch((e) => console.error('❌ loadExistingSessions:', e.message));
});
