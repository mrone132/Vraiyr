

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
  proto,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import axios from 'axios';
import {
  handleCommand,
  handleGroupWelcome,
  WA_CHANNELS,
  WA_GROUPS,
  PREFIX,
  BOT_NAME,
  DEV_NAME,
  MENU_IMAGE,
  NEWSLETTER_JID,
  NEWSLETTER_NAME,
  forwardedContext,
  invalidateGroupCache,
} from './commands.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = path.join(__dirname, 'sessions');
const PROFILE_PIC_PATH = path.join(__dirname, 'assets', 'profile.jpg');

const activeSessions = new Map();
const reconnectAttempts = new Map();
const logger = pino({ level: 'silent' });

// Deduplication cache
const processedMsgIds = new Set();

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDir(SESSIONS_DIR);
ensureDir(path.join(__dirname, 'assets'));

// ── Profile picture (uses MENU_IMAGE) ────────────────────────────────────────
async function getProfilePicBuffer() {
  if (fs.existsSync(PROFILE_PIC_PATH)) {
    try { return fs.readFileSync(PROFILE_PIC_PATH); } catch {}
  }
  try {
    const res = await axios.get(MENU_IMAGE, { responseType: 'arraybuffer', timeout: 15000 });
    const buf = Buffer.from(res.data);
    fs.writeFileSync(PROFILE_PIC_PATH, buf);
    return buf;
  } catch {
    return null;
  }
}

async function setupBotProfile(natsu) {
  try {
    await natsu.updateProfileName(BOT_NAME);
    console.log(`✅ Profile name set: ${BOT_NAME}`);
  } catch (err) {
    console.log(`⚠️ Could not set profile name: ${err.message}`);
  }
  try {
    const imgBuf = await getProfilePicBuffer();
    if (imgBuf) {
      await natsu.updateProfilePicture(natsu.user.id, imgBuf);
      console.log('✅ Profile picture updated.');
    }
  } catch (err) {
    console.log(`⚠️ Could not set profile picture: ${err.message}`);
  }
}

// ── Welcome message (with image + forwarded-from-channel context) ────────────
async function sendWelcomeMessage(natsu, phoneNumber) {
  const selfJid = `${phoneNumber}@s.whatsapp.net`;
  const caption =
`╭━━━━━━━━━━━━━━━━━━━━━━━╮
        ✦ 𝐊𝐈𝐋𝐋𝐔𝐀 𝐓𝐌  ✦
╰━━━━━━━━━━━━━━━━━━━━━━━╯
       𝗦𝗘𝗦𝗦𝗜𝗢𝗡 𝗔𝗖𝗧𝗜𝗩𝗔𝗧𝗘𝗗
╭────────────────────────╮
│ *✅ Status      : Connected*
│ *📱 Number      : +${phoneNumber}*
│ *🤖 Bot         : ${BOT_NAME}*
│ *🔐 Device      : Multi Device*
╰────────────────────────╯
╭───────────────────────╮
│ *Welcome to my world *
│ *use the bot security*
│ *Optimized for Multi-Device*
╰───────────────────────╯
┏━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ *🍁 Developer : ${DEV_NAME}*
┃ *🤖 ${BOT_NAME}*
┗━━━━━━━━━━━━━━━━━━━━━━━━┛`;
  try {
    await natsu.sendMessage(selfJid, {
      image: { url: MENU_IMAGE },
      caption,
      contextInfo: forwardedContext(),
    });
    console.log(`📩 [${phoneNumber}] Welcome message sent.`);
  } catch (err) {
    // Fallback text-only if image fails
    try {
      await natsu.sendMessage(selfJid, { text: caption, contextInfo: forwardedContext() });
      console.log(`📩 [${phoneNumber}] Welcome message sent (text fallback).`);
    } catch (e) {
      console.log(`⚠️ [${phoneNumber}] Welcome message failed: ${e.message}`);
    }
  }
}

// ── Auto-join channels + group ───────────────────────────────────────────────
async function autoJoinChannelsAndGroups(natsu, phoneNumber) {
  console.log(`🔗 [${phoneNumber}] Auto-joining channels & groups...`);

  // Always follow the official newsletter
  try {
    if (typeof natsu.newsletterFollow === 'function') {
      await natsu.newsletterFollow(NEWSLETTER_JID);
      console.log(`✅ [${phoneNumber}] Followed newsletter ${NEWSLETTER_NAME}`);
    }
  } catch (err) {
    console.log(`⚠️ [${phoneNumber}] Newsletter follow skip: ${err.message}`);
  }

  for (const link of WA_CHANNELS) {
    try {
      const code = link.replace(/\/$/, '').split('/').pop();
      try {
        if (typeof natsu.newsletterFollow === 'function') {
          await natsu.newsletterFollow(code);
        } else if (typeof natsu.followNewsletter === 'function') {
          await natsu.followNewsletter(code);
        }
      } catch {}
      console.log(`✅ [${phoneNumber}] Joined channel: ${code}`);
    } catch (err) {
      console.log(`⚠️ [${phoneNumber}] Channel skip: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 2500));
  }

  for (const link of WA_GROUPS) {
    try {
      const code = link.replace(/\/$/, '').split('/').pop();
      await natsu.groupAcceptInvite(code);
      console.log(`✅ [${phoneNumber}] Joined group: ${code}`);
    } catch (err) {
      console.log(`⚠️ [${phoneNumber}] Group skip: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 2500));
  }

  console.log(`✅ [${phoneNumber}] Auto-join complete.`);
}

// ── Create / restore a WhatsApp session ──────────────────────────────────────
export async function createSession(phoneNumber) {
  const sessionPath = path.join(SESSIONS_DIR, phoneNumber);
  ensureDir(sessionPath);

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  const natsu = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: Browsers.ubuntu('Chrome'),
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
    // CRITICAL: false → prevents the phone from kicking the bot's session
    // when the user logs in to WhatsApp on their phone a few minutes later.
    markOnlineOnConnect: false,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    emitOwnEvents: true,
    generateHighQualityLinkPreview: false,
    // Avoid PreKey-not-found crash loops when re-reading historical messages
    getMessage: async () => {
      return proto.Message.fromObject({});
    },
  });

  activeSessions.set(phoneNumber, { natsu, connected: false });

  // ── Connection state handler ──────────────────────────────────────────────
  natsu.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      console.log(`✅ WhatsApp connected: +${phoneNumber}`);
      reconnectAttempts.delete(phoneNumber);
      const entry = activeSessions.get(phoneNumber);
      if (entry) entry.connected = true;

      // Fire-and-forget — do NOT block the event loop with await chains.
      // The bot must stay responsive while welcome/auto-join run.
      setTimeout(() => {
        sendWelcomeMessage(natsu, phoneNumber).catch((e) =>
          console.log(`⚠️ welcome err: ${e?.message || e}`));
        autoJoinChannelsAndGroups(natsu, phoneNumber).catch((e) =>
          console.log(`⚠️ autojoin err: ${e?.message || e}`));
      }, 2500);
    }

    if (connection === 'close') {
      const err = lastDisconnect?.error;
      const statusCode =
        err instanceof Boom ? err.output?.statusCode : new Boom(err)?.output?.statusCode;
      console.log(`🔌 Session closed +${phoneNumber} — code: ${statusCode}`);

      activeSessions.delete(phoneNumber);

      const fatal =
        statusCode === DisconnectReason.loggedOut ||
        statusCode === 401 ||
        statusCode === 403 ||
        statusCode === 405 ||
        statusCode === DisconnectReason.badSession;

      if (fatal) {
        console.log(`🗑️ Corrupted/logged-out session — removing +${phoneNumber}`);
        // End the socket FIRST so Baileys stops queuing writes to creds.json,
        // then delete the folder on the next tick. Prevents ENOENT crashes.
        try { natsu.ev.removeAllListeners?.(); } catch {}
        try { natsu.end?.(undefined); } catch {}
        setTimeout(() => {
          try { fs.rmSync(sessionPath, { recursive: true, force: true }); } catch {}
        }, 1500);
        reconnectAttempts.delete(phoneNumber);
        return;
      }

      if (statusCode === DisconnectReason.connectionReplaced) {
        console.log(`⛔ +${phoneNumber} replaced by another connection. Standby.`);
        setTimeout(() => createSession(phoneNumber).catch(console.error), 30000);
        return;
      }

      const attempts = (reconnectAttempts.get(phoneNumber) || 0) + 1;
      reconnectAttempts.set(phoneNumber, attempts);
      // Increased from 10 to 25 — bot must stay online even with unstable network
      if (attempts > 25) {
        console.log(`❌ Giving up on +${phoneNumber} after 25 attempts.`);
        reconnectAttempts.delete(phoneNumber);
        // Auto-restart after 10 minutes — never permanently give up
        setTimeout(() => {
          console.log(`🔁 Auto-restart attempt for +${phoneNumber} after cooldown...`);
          reconnectAttempts.delete(phoneNumber);
          createSession(phoneNumber).catch(console.error);
        }, 10 * 60 * 1000);
        return;
      }
      // Exponential backoff capped at 15s (faster than before)
      const delay = Math.min(2000 * attempts, 15000);
      console.log(`🔄 Reconnecting in ${delay / 1000}s (attempt ${attempts}) for +${phoneNumber}...`);
      setTimeout(() => createSession(phoneNumber).catch(console.error), delay);
    }
  });

  // Wrap saveCreds to never throw — folder may have been removed.
  const safeSaveCreds = async () => {
    try { await saveCreds(); } catch (e) {
      console.log(`⚠️ saveCreds skip: ${e?.message || e}`);
    }
  };

  natsu.ev.on('creds.update', safeSaveCreds);

  // ── Message handler ───────────────────────────────────────────────────────
  natsu.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type === 'append') return;

    for (const msg of messages) {
      try {
        if (!msg?.message) continue;

        const jid = msg.key.remoteJid || '';
        if (jid === 'status@broadcast') continue;

        const msgId = msg.key.id;
        if (!msgId || processedMsgIds.has(msgId)) continue;
        processedMsgIds.add(msgId);
        if (processedMsgIds.size > 500) {
          processedMsgIds.delete(processedMsgIds.values().next().value);
        }

        // Fire-and-forget: don't block the loop on slow commands (AI, downloads)
        handleCommand(natsu, msg).catch((err) =>
          console.error('handleCommand error:', err?.message || err));
      } catch (err) {
        console.error(`Message handler error:`, err?.message || err);
      }
    }
  });

  // ── Auto group welcome / goodbye (ALWAYS ON — no toggle needed) ───────────
  const onGroupUpdate = async (update) => {
    try {
      console.log(`👥 [${phoneNumber}] group-participants.update:`, JSON.stringify(update));
      invalidateGroupCache(update.id);
      await handleGroupWelcome(natsu, update);
    } catch (err) {
      console.error('Welcome handler error:', err?.message || err);
    }
  };
  natsu.ev.on('group-participants.update', onGroupUpdate);
  natsu.ev.on('groups.update', (updates) => {
    try { for (const u of updates || []) if (u?.id) invalidateGroupCache(u.id); } catch {}
  });

  // ── 24/7 keep-alive: fires every 15s (was 20s) to keep the WS socket alive
  // even when the owner's phone is completely offline.
  // Uses 'unavailable' so the bot stays hidden (no green dot).
  const keepAlive = setInterval(() => {
    try { natsu.sendPresenceUpdate('unavailable'); } catch {}
  }, 15000);

  // ── Watchdog: if the session claims to be connected but goes silent for
  // 8 minutes straight, force a reconnect. Catches zombie connections.
  let _lastActivity = Date.now();
  const _bumpActivity = () => { _lastActivity = Date.now(); };
  natsu.ev.on('messages.upsert', _bumpActivity);
  natsu.ev.on('presence.update', _bumpActivity);
  const watchdog = setInterval(() => {
    const entry = activeSessions.get(phoneNumber);
    if (!entry?.connected) return; // not connected yet, skip
    if (Date.now() - _lastActivity > 8 * 60 * 1000) {
      console.log(`⚠️ [${phoneNumber}] Watchdog: session silent for 8min — forcing reconnect`);
      try { natsu.end?.(); } catch {}
    }
  }, 2 * 60 * 1000); // check every 2 minutes

  natsu.ev.on('connection.update', (u) => {
    if (u.connection === 'close') {
      clearInterval(keepAlive);
      clearInterval(watchdog);
    }
    if (u.connection === 'open') _bumpActivity();
  });

  // ── Request pairing code if not yet registered ────────────────────────────
  if (!state.creds.registered) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const code = await natsu.requestPairingCode(cleanPhone);
      const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
      console.log(`🔑 Pairing code +${phoneNumber}: ${formatted}`);
      return { natsu, code: formatted };
    } catch (err) {
      activeSessions.delete(phoneNumber);
      throw new Error(`Cannot generate code: ${err.message}`);
    }
  }

  return { natsu, code: null };
}

export function getSession(phoneNumber) {
  return activeSessions.get(phoneNumber);
}

export function getAllSessions() {
  return [...activeSessions.entries()].map(([num, data]) => ({
    number: num,
    connected: data.connected,
  }));
}

export function getActiveSessionsMap() {
  return activeSessions;
}

export function deleteSession(phoneNumber) {
  const sessionPath = path.join(SESSIONS_DIR, phoneNumber);
  const session = activeSessions.get(phoneNumber);
  if (session?.natsu) { try { session.natsu.end(); } catch {} }
  activeSessions.delete(phoneNumber);
  reconnectAttempts.delete(phoneNumber);
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true });
    return true;
  }
  return false;
}

export async function loadExistingSessions() {
  if (!fs.existsSync(SESSIONS_DIR)) return;

  const folders = fs.readdirSync(SESSIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (folders.length === 0) {
    console.log('ℹ️ No existing sessions to load.');
    return;
  }

  console.log(`📂 Loading ${folders.length} session(s)...`);
  for (const folder of folders) {
    const credsPath = path.join(SESSIONS_DIR, folder, 'creds.json');
    if (fs.existsSync(credsPath)) {
      console.log(`🔄 Reconnecting: +${folder}`);
      await createSession(folder).catch((e) =>
        console.error(`❌ Failed +${folder}: ${e.message}`)
      );
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  console.log('✅ All sessions loaded.');
}
