

import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const VIDEO_DIR = path.join(__dirname, 'video');
if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });

// ═════════════════════════════════════════════════════════════════════════
// 🎬 VIDÉO DU MENU — C'EST ICI QUE ÇA SE PASSE, C'EST TOUT SIMPLE
// ═════════════════════════════════════════════════════════════════════════
// On utilise EXACTEMENT la même vidéo que celle envoyée par le /start
// Telegram (dossier "video", fichier messi.mp4), pour que .menu sur
// WhatsApp affiche la même vidéo que /start sur Telegram.
const MENU_LOCAL_VIDEO = path.join(VIDEO_DIR, 'code.mp4');

// ─────────────────────────────────────────────────────────────────────────────
// CORE CONFIG
// ─────────────────────────────────────────────────────────────────────────────
export const PREFIX   = '.';
// Tous les préfixes acceptés pour appeler le bot
export const PREFIXES = ['.', '/', '!', '🧃', '🍁', '#', ',', '+'];
export const BOT_NAME = '𝐊𝐈𝐋𝐋𝐔𝐀 𝗠𝗗';
export const DEV_NAME = '𝐊𝐈𝐋𝐋𝐔𝐀';

export const MENU_IMAGE   = 'https://files.catbox.moe/srbmwy.jpg';
export const MENU_IMAGE_2 = 'https://files.catbox.moe/f7hyrr.jpg';
export const MENU_IMAGES  = [MENU_IMAGE, MENU_IMAGE_2];
export const NEWSLETTER_JID  = '120363406589060879@newsletter'; //<== No change 
export const NEWSLETTER_NAME = '𝐊𝐈𝐋𝐋𝐔𝐀 𝐓𝐄𝐀𝐌';

// ─── OWNER INFO (édite ces valeurs avec tes vraies infos) ───────────────────
export const OWNER_NUMBER  = process.env.OWNER_NUMBER || ''; // sans +, sans espaces
export const OWNER_NAME    = '𝐊𝐈𝐋𝐋𝐔𝐀';
export const OWNER_WA      = '*https://wa.me/243906905464*';
export const OWNER_TG      = '*https://t.mecabrinox*';
export const OWNER_GITHUB  = '*https://github.com/cabrin21*';
export const REPO_URL      = '*https://github.com/cabrin21/bolth*';
export const BOT_VERSION   = 'V4.0.0';

export const WA_CHANNELS = [
  'https://whatsapp.com/channel/0029VbCHB1eDjiOUGG4OCS2t',
  
];

export const WA_GROUPS = [
  '*https://chat.whatsapp.com/CNEdkcT1U1w5TRP86pFPoB?s=cl&p=a&mlu=4*',
];

// Forwarded-from-channel context (makes messages look forwarded from newsletter)
export function forwardedContext() {
  return {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
      newsletterJid: NEWSLETTER_JID,
      newsletterName: NEWSLETTER_NAME,
      serverMessageId: -1,
    },
    externalAdReply: {
      title: BOT_NAME,
      body: `𝗗𝗘𝗩 𝗕𝗬 : ${DEV_NAME}`,
      thumbnailUrl: MENU_IMAGE,
      sourceUrl: WA_CHANNELS[0],
      mediaType: 1,
      renderLargerThumbnail: false,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENT STATE (sudo list, banned, settings…)
// ─────────────────────────────────────────────────────────────────────────────
const STATE_FILE = path.join(DATA_DIR, 'state.json');
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}
function saveState(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }
function getState() {
  const s = loadState();
  s.sudo       ??= [];
  s.banned     ??= [];
  s.blocked    ??= [];
  s.antilink   ??= {};   // groupJid -> true/false
  // Public by default. Older releases saved 'self', which silently ignored commands.
  // Migrate that old default once so existing deployments become usable.
  if (!s._modeMigrationV2) {
    s.mode = 'public';
    s._modeMigrationV2 = true;
  }
  s.mode       ??= 'public'; // public | self
  s.autoread   ??= false;
  s.autobio    ??= false;
  s.autorecord ??= false;
  s.autotyping ??= false;
  s.autoviewsts ??= false;
  s.autoreact  ??= false;
  s.welcome    ??= {};   // groupJid -> true/false
  s.goodbye    ??= {};   // groupJid -> true/false
  s.welcomeConfig ??= {}; // groupJid -> { message, image }
  s.goodbyeConfig ??= {}; // groupJid -> { message, image }
  s.antibot    ??= {};   // groupJid -> true/false (anti-flood/automation guard)
  s.antispam   ??= {};   // groupJid -> true/false
  s.account    ??= '';
  s.warns      ??= {};   // jidGroup -> { userJid: count }
  s.afks       ??= {};   // userJid  -> { reason, since }
  s.prefix     ??= '.';
  return s;
}
function updateState(fn) { const s = getState(); fn(s); saveState(s); return s; }

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const RAND = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function getMessageText(msg) {
  if (!msg?.message) return '';
  const m = msg.message;
  const inner =
    m.ephemeralMessage?.message ||
    m.viewOnceMessage?.message ||
    m.viewOnceMessageV2?.message?.message ||
    m.documentWithCaptionMessage?.message ||
    null;
  const src = inner || m;
  return (
    src.conversation ||
    src.extendedTextMessage?.text ||
    src.imageMessage?.caption ||
    src.videoMessage?.caption ||
    src.documentMessage?.caption ||
    src.buttonsResponseMessage?.selectedDisplayText ||
    src.templateButtonReplyMessage?.selectedDisplayText ||
    src.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ''
  ).trim();
}

function isGroup(jid) { return jid?.endsWith('@g.us'); }

// In-memory cache for group metadata (60s TTL) — huge speed win
const _groupMetaCache = new Map(); // jid -> { meta, exp }
const GROUP_META_TTL = 5 * 1000; // permissions can change quickly; don't keep stale admin data

function bareJid(value = '') {
  return String(value || '').trim().toLowerCase().replace(/:.*?(?=@)/, '');
}

function jidNumber(value = '') {
  const s = bareJid(value);
  return normalizeNumber(s.split('@')[0]);
}

function sameParticipant(a, b) {
  if (!a || !b) return false;
  const aa = bareJid(a), bb = bareJid(b);
  if (aa && aa === bb) return true;
  const an = jidNumber(aa), bn = jidNumber(bb);
  return !!an && !!bn && an === bn;
}

function botMatchesParticipant(p, natsu) {
  if (!p) return false;
  const ids = [natsu.user?.id, natsu.user?.lid, natsu.user?.jid, natsu.user?.phoneNumber].filter(Boolean);
  const pIds = [p.id, p.lid, p.phoneNumber].filter(Boolean);
  return ids.some(a => pIds.some(b => sameParticipant(a, b)));
}

async function getGroupAdmins(natsu, jid, forceFresh = false) {
  try {
    const now = Date.now();
    const cached = _groupMetaCache.get(jid);
    const meta = !forceFresh && cached && cached.exp > now
      ? cached.meta
      : await natsu.groupMetadata(jid);
    _groupMetaCache.set(jid, { meta, exp: now + GROUP_META_TTL });

    const participants = meta?.participants || [];
    const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin' || !!p.admin)
      .map(p => p.id).filter(Boolean);

    // WhatsApp Multi-Device can represent the same account as a phone JID,
    // LID, or a device-qualified JID. Compare all available identities instead
    // of assuming natsu.user.id === participant.id.
    const rawId = natsu.user?.id || '';
    const lidId = natsu.user?.lid || '';
    const botIds = new Set([rawId, lidId, natsu.user?.jid, natsu.user?.phoneNumber].filter(Boolean));
    const botParticipant = participants.find(p => botMatchesParticipant(p, natsu));
    const botIsAdmin = !!botParticipant && (botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin' || !!botParticipant.admin);
    return { meta, admins, botIsAdmin, botJid: botParticipant?.id || rawId, botIds, botParticipant };
  } catch {
    return { meta: null, admins: [], botIsAdmin: false, botJid: '', botIds: new Set(), botParticipant: null };
  }
}

// Invalidate cache when a group changes
export function invalidateGroupCache(jid) { _groupMetaCache.delete(jid); }

// Check if a given JID is a group admin (handles both regular & LID format)
function isGroupAdmin(adminsList, userJid, meta = null) {
  if (!userJid) return false;
  if (adminsList.includes(userJid)) return true;
  const phone = normalizeNumber(userJid.split('@')[0].split(':')[0]);
  if (!phone) return false;
  return (meta?.participants || []).some(p => {
    if (!p.admin) return false;
    if (p.id === userJid || p.lid === userJid) return true;
    const pPhone = normalizeNumber(p.phoneNumber || p.id?.split('@')[0]?.split(':')[0] || '');
    return pPhone && pPhone === phone;
  });
}

function sender(msg) {
  return msg.key.participant || msg.key.remoteJid;
}

function senderNumber(msg) {
  const candidates = [
    msg.key?.participantAlt,
    msg.key?.senderPn,
    msg.key?.participant,
    msg.key?.remoteJidAlt,
    msg.key?.remoteJid,
  ].filter(Boolean);
  for (const value of candidates) {
    const n = normalizeNumber(String(value).split('@')[0].split(':')[0]);
    // WhatsApp LIDs are often long numeric IDs; participantAlt/senderPn is preferred.
    if (n) return n;
  }
  return '';
}

function normalizeNumber(value = '') {
  return String(value).replace(/\D/g, '').replace(/^0+/, '');
}

function isOwnerOrSudo(msg, state, senderNum) {
  if (msg.key?.fromMe) return true;
  const owner = normalizeNumber(OWNER_NUMBER);
  const sender = normalizeNumber(senderNum);
  return !!sender && ((owner && sender === owner) || state.sudo.includes(sender));
}

async function requireGroupAdmin(natsu, jid, msg, senderJid, reply) {
  if (!isGroup(jid)) { await reply('*❌ ɢʀᴏᴜᴘ ᴏɴʟʏ.*'); return null; }

  let info = await getGroupAdmins(natsu, jid);
  if (!info.meta) { await reply('*❌ ɪᴍᴘᴏssɪʙʟᴇ ᴅᴇ ʟɪʀᴇ ʟᴇ ɢʀᴏᴜᴘᴇ.*'); return null; }

  // Do not locally block on botIsAdmin. WhatsApp may expose the bot as
  // PN/LID/JID differently. The actual group operation will be rejected by
  // WhatsApp if the bot truly lacks the required permission.

  // Check the sender's actual group role after resolving phone/LID.
  // Bot's own messages are allowed only because they are generated by the bot.
  if (!msg.key?.fromMe && !isGroupAdmin(info.admins, senderJid, info.meta)) {
    await reply('*❌ ᴀᴅᴍɪɴs ᴏɴʟʏ.*');
    return null;
  }
  return info;
}

// Group-member gate: harmless group utilities are available to every member.
// Moderation/settings commands must use requireGroupAdmin/requireGroupOwnerOrCreator.
async function requireGroupMember(natsu, jid, reply) {
  if (!isGroup(jid)) { await reply('*❌ ɢʀᴏᴜᴘ ᴏɴʟʏ.*'); return null; }
  const info = await getGroupAdmins(natsu, jid);
  if (!info.meta) { await reply('*❌ ɪᴍᴘᴏssɪʙʟᴇ ᴅᴇ ʟɪʀᴇ ʟᴇ ɢʀᴏᴜᴘᴇ.*'); return null; }
  return info;
}

function quotedMsg(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  return ctx?.quotedMessage ? { quoted: ctx.quotedMessage, participant: ctx.participant } : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE HELPERS — .url / .rmbg
// ─────────────────────────────────────────────────────────────────────────────
async function getQuotedImageBuffer(msg) {
  const q = quotedMsg(msg);
  const imageMessage = q?.quoted?.imageMessage;
  if (!imageMessage) return null;

  const { downloadContentFromMessage } = await import('@whiskeysockets/baileys');
  const stream = await downloadContentFromMessage(imageMessage, 'image');
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function uploadImageUrl(buffer, filename = 'image.jpg') {
  // ImgBB gives the exact i.ibb.co style direct URL when an API key is set.
  const imgbbKey = process.env.IMGBB_API_KEY?.trim();
  if (imgbbKey) {
    const body = new URLSearchParams({
      key: imgbbKey,
      image: buffer.toString('base64'),
      name: filename.replace(/[^a-zA-Z0-9._-]/g, '_'),
    });
    const r = await axios.post('https://api.imgbb.com/1/upload', body.toString(), {
      timeout: 30000,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const url = r.data?.data?.url || r.data?.data?.display_url;
    if (url) return { url, provider: 'ImgBB' };
    throw new Error('ImgBB n’a pas retourné de lien.');
  }

  // No key? Use Catbox as a working fallback so .url still works.
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', new Blob([buffer], { type: 'image/jpeg' }), filename);
  const r = await axios.post('https://catbox.moe/user/api.php', form, {
    timeout: 45000,
    headers: { ...Object.fromEntries(form.entries()) },
    transformRequest: [(data, headers) => data],
    maxBodyLength: 20 * 1024 * 1024,
  });
  const url = String(r.data || '').trim();
  if (!/^https?:\/\//i.test(url)) throw new Error('Aucun lien direct reçu.');
  return { url, provider: 'Catbox' };
}

async function removeImageBackground(buffer) {
  const key = process.env.REMOVE_BG_API_KEY?.trim();
  if (!key) {
    throw new Error('REMOVE_BG_API_KEY manquante. Ajoute ta clé remove.bg dans .env.');
  }

  const form = new FormData();
  form.append('image_file', new Blob([buffer], { type: 'image/jpeg' }), 'image.jpg');
  form.append('size', 'auto');

  const r = await axios.post('https://api.remove.bg/v1.0/removebg', form, {
    timeout: 60000,
    headers: {
      'X-Api-Key': key,
      ...Object.fromEntries(form.entries()),
    },
    responseType: 'arraybuffer',
    transformRequest: [(data, headers) => data],
    maxBodyLength: 20 * 1024 * 1024,
  });
  return Buffer.from(r.data);
}

// Generic HTTP fallback over multiple free AI / download endpoints
// Timeout reduced from 10000ms to 6000ms — fail fast, try next URL sooner
async function tryFetch(urls) {
  for (const u of urls) {
    try {
      const r = await axios.get(u, { timeout: 6000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (r.data) return r.data;
    } catch {}
  }
  return null;
}

// AI gateway helper — faster: shorter timeouts + race the first two providers
async function askAI(prompt, model = 'gpt') {
  const q = encodeURIComponent(prompt);
  const map = {
    gemini: 'gemini', gpt: 'openai', gpt4: 'openai', gpt5: 'openai-large',
    metaai: 'llama', deepseek: 'deepseek', qwen: 'qwen-coder',
    'grok-ai': 'openai', grok: 'openai', codeai: 'qwen-coder',
    story: 'openai', trivia: 'openai',
  };
  const m = map[model] || 'openai';
  const urls = [];
  const pollenKey = process.env.POLLINATIONS_API_KEY || '';
  if (pollenKey) urls.push(`https://gen.pollinations.ai/text/${q}?model=${m}&key=${encodeURIComponent(pollenKey)}`);
  const parse = (d) => {
    if (typeof d === 'string' && d.trim().startsWith('{')) {
      try { d = JSON.parse(d); } catch {}
    }
    return (typeof d === 'string')
      ? d
      : (d?.BK9 || d?.result || d?.response || d?.data?.response || d?.data?.message ||
         d?.message || d?.answer || d?.gpt4 || d?.result?.prompt || null);
  };
  const call = (u) => axios.get(u, { timeout: 15000, responseType: 'text', transformResponse: [(d) => d], headers: pollenKey ? { Authorization: `Bearer ${pollenKey}` } : {} })
    .then(r => parse(r.data)).then(a => a && String(a).trim() ? String(a).trim() : Promise.reject('empty'));
  if (urls.length) { try { const a = await call(urls[0]); if (a) return a; } catch {} }
  return pollenKey
    ? `🐐 *${model.toUpperCase()}* indisponible pour le moment. Réessaie dans quelques secondes.`
    : `⚠️ *${model.toUpperCase()}* nécessite POLLINATIONS_API_KEY dans .env.`;
}

// Image search / fetch helper — timeout reduced from 12s to 7s
async function fetchAnyImage(urls) {
  for (const u of urls) {
    try {
      const r = await axios.get(u, { timeout: 7000 });
      const d = r.data;
      const url =
        d?.url || d?.image || d?.message ||
        d?.result?.url || d?.result?.[0]?.url ||
        d?.results?.[0]?.url ||
        d?.data?.[0]?.url ||
        d?.data?.[0]?.images?.jpg?.image_url ||
        (Array.isArray(d?.images) && (typeof d.images[0] === 'string' ? d.images[0] : d.images[0]?.url)) ||
        (typeof d === 'string' && d.startsWith('http') ? d : null);
      if (url) return url;
    } catch {}
  }
  return null;
}

// Image cache (avoid re-downloading the menu picture on every call)
const _imgCache = new Map(); // url -> Buffer
async function getImageBuffer(url) {
  if (_imgCache.has(url)) return _imgCache.get(url);
  try {
    const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 12000 });
    const buf = Buffer.from(r.data);
    _imgCache.set(url, buf);
    return buf;
  } catch { return null; }
}

// Send image with forwarded context (uses cached buffer when possible)
async function sendImage(natsu, jid, url, caption, msg) {
  const buf = await getImageBuffer(url);
  const image = buf ? buf : { url };
  return natsu.sendMessage(jid,
    { image, caption: caption || '', contextInfo: forwardedContext() },
    { quoted: msg }
  );
}
async function sendText(natsu, jid, text, msg) {
  return natsu.sendMessage(jid,
    { text, contextInfo: forwardedContext() },
    { quoted: msg }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GAMES — in-memory state
// ─────────────────────────────────────────────────────────────────────────────
const games = {
  tictactoe: new Map(), hangman: new Map(), guess: new Map(),
  math: new Map(), emoji: new Map(),
};
const HANGMAN_WORDS = ['javascript','whatsapp','queen','baileys','telegram','africa','python','kingdom'];

// ─────────────────────────────────────────────────────────────────────────────
// MENU BUILDER
// ─────────────────────────────────────────────────────────────────────────────
const MENU_GROUPS = {
  '🏠 ᴘʀɪɴᴄɪᴘᴀʟ': {
    emoji: '🏠',
    cmds: ['menu','help','list','ping','alive','runtime','uptime','prefix','test','botstatus','status','botinfo','owner','repo']
  },
  '👥 ɢʀᴏᴜᴘ': {
    emoji: '👥',
    cmds: ['groupinfo','groupid','groupname','members','membercount','admins','myrole','memberinfo','groupadmins','listadmins','tagall','hidetag','tagadmins','rules','poll','vcf','listonline','groupstatus','settings']
  },
  '🛡️ ɢʀᴏᴜᴘ — ᴀᴅᴍɪɴ': {
    emoji: '🛡️',
    cmds: ['welcome','goodbye','promote','demote','add','kick','mute','unmute','grouplink','resetlink','closegc','opengc','lock','unlock','antilink','antilinkstatus','antibot','antispam','warn','warns','resetwarn','kickadmins','kickall','setrules','opentime','closetime','left']
  },
  '📥 ᴅᴏᴡɴʟᴏᴀᴅ': {
    emoji: '📥',
    cmds: ['play','song','yt','yta','ytmp3','ytv','tiktok','instagram','insta','facebook','fb','spotify','video','mp4','apk','git','gitclone','mega','pint','edit']
  },
  '🛠️ ᴏᴜᴛɪʟs': {
    emoji: '🛠️',
    cmds: ['weatherwiki','currency','time','mediastatus','qrcode','readqr','shorturl','myip','iplookup','jid','getpp','github','npm','dictionary','recipe','book','remind','calculate','mathfact','sciencefact','translate','lyrics','afk','removebg','upscale','savestatus','react-ch','apistatus']
  },
  '🎨 ᴍᴇᴅɪᴀ': {
    emoji: '🎨',
    cmds: ['sticker','stiker','telegraph','url','rmbg','toimg','take','steal','wm','qc','tts','say','bass','blown','deep','earrape','fast','nightcore','reverse','robot','slow','smooth','squirrel']
  },
  '😂 ғᴜɴ': {
    emoji: '😂',
    cmds: ['truth','dare','joke','meme','ship','rate','flirt','roast','compliment','wouldyou','8balladvice','urban','moviequote','triviafact','inspire','ascii','progquote','dadjoke','funfact','paptt']
  },
  '🎮 ᴊᴇᴜx': {
    emoji: '🎮',
    cmds: ['rps','rpsls','dice','coin','coinbattle','numberbattle','numbattle','hangman','tictactoe','guess','math','emojiquiz','gamefact']
  },
  '🖼️ ɪᴍᴀɢᴇ': {
    emoji: '🖼️',
    cmds: ['sfw','moe','aipic','chinagirl','bluearchive','boypic','carimage','random-girl','hijab-girl','indonesia-girl','japan-girl','korean-girl','malaysia-girl','profile-pictures','tiktokgirl']
  },
  '🧠 ᴀɪ': {
    emoji: '🧠',
    cmds: ['ai','gpt','gpt4','gpt5','gemini','deepseek','qwen','grok-ai','metaai','codeai','photoai','storyai','triviaai']
  },
  '💮 ᴀɴɪᴍᴇ': {
    emoji: '💮',
    cmds: ['achar','aquote','arecommend','asearch','maid','megumin','neko','shinobu','waifu']
  },
  '🎧 ᴍᴜsɪᴄ': {
    emoji: '🎧',
    cmds: ['bass','blown','deep','earrape','fast','nightcore','reverse','robot','slow','smooth','squirrel']
  },
  '👑 ᴏᴡɴᴇʀ & sʏsᴛᴇᴍ': {
    emoji: '👑',
    cmds: ['self','public','mode','setprefix','setpp','restart','eval','ban','unban','block','unblock','delete','addsudo','delsudo','listsudo','fixowner','getbot','broadcast','autoread','autobio','autorecording','autotyping','autoviewstatus','autoreact']
  },
  '🔗 ᴄᴏɴɴᴇxɪᴏɴ': {
    emoji: '🔗',
    cmds: ['pair','connect','bot']
  },
  '📧 ᴛᴇᴍᴘᴍᴀɪʟ': {
    emoji: '📧',
    cmds: ['newmail','tempmail','readmail','inbox','deltmp','delmail','tempmail2','tempmail-inbox']
  }
};

// Set de toutes les commandes connues — sert au déclenchement sans préfixe
export const KNOWN_CMDS = (() => {
  const s = new Set(['menu','help','list','ping','alive','runtime','uptime','del','prefix','test','status','botinfo','groupstatus','settings','antilinkstatus','antibot','antispam']);
  for (const group of Object.values(MENU_GROUPS)) for (const c of group.cmds) s.add(c.toLowerCase());
  return s;
})();

function buildMenu(userName = '') {
  const state = getState();
  const activePrefix = state.prefix || PREFIX;
  const commandCount = [...KNOWN_CMDS].length;
  const up = Math.floor(process.uptime());
  const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60);
  let body = '';

  for (const [title, group] of Object.entries(MENU_GROUPS)) {
    body += `\n╭━━〔 ${group.emoji} *${title.replace(/^[^ ]+\s+/, '').toUpperCase()}* 〕━━╮\n`;
    body += `│ 📌 ${group.cmds.length} commandes\n`;
    for (const command of group.cmds) body += `│ ◈ ${activePrefix}${command}\n`;
    body += `╰━━━━━━━━━━━━━━━━━━━━╯\n`;
  }

  return `╭━━━〔 *${BOT_NAME}* 〕━━━╮
│ 👤 User   : ${userName || 'You'}
│ 👑 Dev    : ${DEV_NAME}
│ ⚡ Prefix : ${activePrefix}
│ 📦 Version: ${BOT_VERSION}
│ 📚 Cmds   : ${commandCount}
│ ⏱️ Uptime : ${h}h ${m}m
│ 🌐 Mode   : ${state.mode}
╰━━━━━━━━━━━━━━━━━━━━╯

${body}
╭━━━〔 *KILLUA MD* 〕━━━╮
│ 🟢 Online • 
│ 👑 Powered by ${DEV_NAME}
╰━━━━━━━━━━━━━━━━━━━━╯`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GROUP WELCOME / GOODBYE (ALWAYS ENABLED — no toggle needed)
// Triggered automatically on every join/leave detection in any group.
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// 👋 GROUP WELCOME / GOODBYE V2
// Supports: ON/OFF, custom messages, variables, test, safe error handling.
// Variables: @user @group @members @bot @prefix
// ─────────────────────────────────────────────────────────────────────────────

function renderGroupMessage(template, {
  userJid,
  groupName,
  members,
  botName = BOT_NAME,
  prefix = PREFIX,
  goodbye = false,
} = {}) {
  const number = String(userJid || '').split('@')[0].replace(/\D/g, '');
  const safeGroup = groupName || 'ce groupe';

  const fallback = goodbye
    ? `╭━━━〔 👋 *GOODBYE* 〕━━━╮

┃ 😢 *Au revoir @user*
┃
┃ Tu quittes :
┃ 『 *${safeGroup}* 』
┃
┃ 💙 Merci d'avoir fait partie
┃ de notre communauté.
┃
┃ 👥 Membres restants : *${Math.max((members || 1) - 1, 0)}*

╰━━━━━━━━━━━━━━━━━━━━━━╯

> ⚡ *${botName}*
> 👑 Powered by : *${DEV_NAME}*`
    : `╭━━━〔 👋 *WELCOME* 〕━━━╮

┃ ✨ *Bienvenue @user !*
┃
┃ 🎉 Bienvenue dans :
┃ 『 *${safeGroup}* 』
┃
┃ 👥 Membres : *${members || 0}*
┃
┃ 🤖 *${botName}* est là pour vous aider.
┃
┃ 📚 Tape *${prefix}menu*
┃ pour découvrir toutes les commandes.

╰━━━━━━━━━━━━━━━━━━━━━━╯

> ⚡ *${botName}*
> 👑 Powered by : *${DEV_NAME}*`;

  return String(template || fallback)
    .replaceAll('@user', `@${number}`)
    .replaceAll('@group', safeGroup)
    .replaceAll('@members', String(members || 0))
    .replaceAll('@bot', botName)
    .replaceAll('@prefix', prefix);
}

function getGroupGreetingConfig(state, key, jid) {
  const config = state?.[`${key}Config`]?.[jid];
  return config && typeof config === 'object' ? config : {};
}

export async function handleGroupWelcome(natsu, update = {}) {
  const { id, participants = [], action } = update;

  if (!id || !String(id).endsWith('@g.us')) return;
  if (!Array.isArray(participants) || participants.length === 0) return;

  const act = String(action || '').trim().toLowerCase();
  const isJoin = ['add', 'invite', 'join'].includes(act);
  const isLeave = ['remove', 'leave', 'kick'].includes(act);

  if (!isJoin && !isLeave) return;

  const state = getState() || {};
  const key = isJoin ? 'welcome' : 'goodbye';

  // ON par défaut ; seul false désactive.
  if (state?.[key]?.[id] === false) return;

  let metadata = null;
  try {
    metadata = await natsu.groupMetadata(id);
  } catch (error) {
    console.error(
      `[${key.toUpperCase()}] groupMetadata failed:`,
      error?.message || error
    );
  }

  const groupName = metadata?.subject || 'ce groupe';
  const groupSize = metadata?.participants?.length || 0;
  const config = getGroupGreetingConfig(state, key, id);
  const imageUrl = config.image || MENU_IMAGE;

  for (const raw of participants) {
    const jidP = typeof raw === 'string'
      ? raw
      : (raw?.id || raw?.jid || raw?.lid || '');

    if (!jidP) continue;

    const participantJid = String(jidP).includes('@')
      ? String(jidP)
      : `${jidP}@s.whatsapp.net`;

    const number = participantJid.split('@')[0].replace(/\D/g, '');
    if (!number) continue;

    const caption = renderGroupMessage(config.message, {
      userJid: participantJid,
      groupName,
      members: groupSize,
      botName: BOT_NAME,
      prefix: getState().prefix || PREFIX,
      goodbye: isLeave,
    });

    try {
      await natsu.sendMessage(id, {
        image: { url: imageUrl },
        caption,
        mentions: [participantJid],
        contextInfo: forwardedContext(),
      });
    } catch (error) {
      console.error(
        `[${key.toUpperCase()}] sendMessage failed in ${id}:`,
        error?.message || error
      );

      // Fallback texte si l'image distante échoue.
      try {
        await natsu.sendMessage(id, {
          text: caption,
          mentions: [participantJid],
          contextInfo: forwardedContext(),
        });
      } catch (fallbackError) {
        console.error(
          `[${key.toUpperCase()}] text fallback failed:`,
          fallbackError?.message || fallbackError
        );
      }
    }
  }
}

function pIsBot(jid, meta, botIds = new Set()) {
  if (!jid) return false;
  if ([...botIds].some(id => sameParticipant(id, jid))) return true;
  const p = findParticipant(meta, jid);
  if (!p) return false;
  return [...botIds].some(id => [p.id, p.lid, p.phoneNumber].filter(Boolean).some(pid => sameParticipant(id, pid)));
}
function findParticipant(meta, jid) {
  if (!jid || !meta?.participants) return null;
  const phone = normalizeNumber(String(jid).split('@')[0].split(':')[0]);
  return meta.participants.find(p =>
    p.id === jid || p.lid === jid ||
    (phone && normalizeNumber(p.phoneNumber || String(p.id || '').split('@')[0].split(':')[0]) === phone)
  ) || null;
}

function participantRole(meta, jid) {
  const p = findParticipant(meta, jid);
  if (!p) return 'member';
  if (p.admin === 'superadmin') return 'owner';
  if (p.admin) return 'admin';
  return 'member';
}

function roleRank(role) {
  return role === 'owner' ? 3 : role === 'admin' ? 2 : 1;
}

function isProtectedTarget(meta, target, state) {
  const p = findParticipant(meta, target);
  if (!p) return { protected: false, participant: null, role: 'member' };
  const role = participantRole(meta, p.id);
  const phone = normalizeNumber(p.phoneNumber || String(p.id || '').split('@')[0].split(':')[0]);
  const owner = normalizeNumber(OWNER_NUMBER);
  const protectedByOwner = !!phone && (phone === owner || state.sudo.includes(phone));
  return { protected: protectedByOwner || role === 'owner', participant: p, role };
}

async function requireGroupOwnerOrCreator(natsu, jid, msg, senderJid, reply) {
  const info = await requireGroupAdmin(natsu, jid, msg, senderJid, reply);
  if (!info) return null;
  const role = participantRole(info.meta, senderJid);
  const state = getState();
  const creator = isOwnerOrSudo(msg, state, senderNumber(msg));
  if (role !== 'owner' && !creator) {
    await reply('*❌ ᴄᴇᴛᴛᴇ ᴄᴏᴍᴍᴀɴᴅᴇ ʀᴇ́sᴇʀᴠᴇ́ᴇ ᴀᴜ ᴘʀᴏᴘʀɪᴇ́ᴛᴀɪʀᴇ ᴅᴜ ɢʀᴏᴜᴘᴇ ᴏᴜ ᴀᴜ ᴏᴡɴᴇʀ ᴅᴜ ʙᴏᴛ.*');
    return null;
  }
  return info;
}

// ─────────────────────────────────────────────────────────────────────────────
// ANTI-SPAM / ANTI-BOT TRACKERS (in-memory, per process)
// ─────────────────────────────────────────────────────────────────────────────
const _spamTracker = new Map(); // key -> { times, lastText, repeats }
function trackFlood(key, text) {
  const now = Date.now();
  const item = _spamTracker.get(key) || { times: [], lastText: '', repeats: 0 };
  item.times = item.times.filter(t => now - t < 8000);
  item.times.push(now);
  if (text && text === item.lastText) item.repeats += 1;
  else item.repeats = 1;
  item.lastText = text || '';
  _spamTracker.set(key, item);
  return { count: item.times.length, repeats: item.repeats };
}

function clearFlood(key) { _spamTracker.delete(key); }

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DISPATCHER
// ─────────────────────────────────────────────────────────────────────────────
export async function handleCommand(natsu, msg) {
  const jid = msg.key?.remoteJid;
  if (!jid) return;

  const state = getState();
  const senderJid = sender(msg);
  const senderNum = senderNumber(msg);
  const isCreator = isOwnerOrSudo(msg, state, senderNum);

  // Auto-react
  if (state.autoreact) {
    try { await natsu.sendMessage(jid, { react: { text: RAND(['🌹','✨','💫','🔥','⚡','💖']), key: msg.key } }); } catch {}
  }
  // Auto-read
  if (state.autoread) { try { await natsu.readMessages([msg.key]); } catch {} }
  if (state.autorecord) { try { await natsu.sendPresenceUpdate('recording', jid); setTimeout(() => natsu.sendPresenceUpdate('paused', jid).catch(() => {}), 1800); } catch {} }
  if (state.autotyping) { try { await natsu.sendPresenceUpdate('composing', jid); } catch {} }
  // Auto view status
  if (state.autoviewsts && jid === 'status@broadcast') {
    try { await natsu.readMessages([msg.key]); } catch {}
  }

  const text = getMessageText(msg);
  if (!text) return;

  // ── SMART ANTI-SPAM / ANTI-BOT ───────────────────────────────────────────
  // Admins/owner are exempt. This is behavioral protection, not a claim that
  // WhatsApp exposes a reliable 'bot account' flag.
  if (isGroup(jid) && !isCreator) {
    let senderIsAdmin = false;
    try {
      const info = await getGroupAdmins(natsu, jid);
      senderIsAdmin = isGroupAdmin(info.admins, senderJid, info.meta);
    } catch {}
    if (!senderIsAdmin) {
      const stats = trackFlood(`${jid}:${senderJid}`, text);
      if (state.antibot[jid] && (stats.count >= 8 || stats.repeats >= 5)) {
        clearFlood(`${jid}:${senderJid}`);
        try { await natsu.sendMessage(jid, { delete: msg.key }); } catch {}
        try { await natsu.groupParticipantsUpdate(jid, [senderJid], 'remove'); } catch {}
        await sendText(natsu, jid, `*🤖 ᴀɴᴛɪʙᴏᴛ / ᴀɴᴛɪғʟᴏᴏᴅ*\n@${senderNum} ᴇxᴄᴇssɪᴠᴇ ᴀᴄᴛɪᴠɪᴛʏ ᴅᴇᴛᴇᴄᴛᴇᴅ.`, msg);
        return;
      }
      if (state.antispam[jid] && stats.count >= 6) {
        try { await natsu.sendMessage(jid, { delete: msg.key }); } catch {}
        if (stats.count >= 9) clearFlood(`${jid}:${senderJid}`);
        return;
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
// 🚫 ANTITAG HANDLER
// ═══════════════════════════════════════════════════════════════════════

if (isGroup(jid) && state.antitag?.[jid] && state.antitag[jid] !== 'off') {
  try {
    const mentionedJids =
      msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
      msg.message?.conversation?.contextInfo?.mentionedJid ||
      [];

    // Minimum de personnes mentionnées
    const ANTITAG_LIMIT = 5;

    if (mentionedJids.length >= ANTITAG_LIMIT) {

      // Vérifier si l'auteur est administrateur
      let senderIsAdmin = false;

      try {
        const info = await getGroupAdmins(natsu, jid);

        senderIsAdmin = isGroupAdmin(
          info.admins,
          senderJid,
          info.meta
        );
      } catch (err) {
        console.error('❌ ANTITAG admin check:', err);
      }

      // Les administrateurs ne sont pas concernés
      if (!senderIsAdmin && !isCreator) {

        const mode = state.antitag[jid];

        // Supprimer le message
        try {
          await natsu.sendMessage(jid, {
            delete: msg.key
          });
        } catch (err) {
          console.error('❌ ANTITAG delete:', err);
        }

        // ─────────────────────────────────────────────────────────────
        // MODE KICK
        // ─────────────────────────────────────────────────────────────

        if (mode === 'kick') {

          await sendText(
            natsu,
            jid,
            `🚫 *ᴀɴᴛɪᴛᴀɢ*\n\n` +
            `@${senderNum} a utilisé une mention massive.\n` +
            `👢 Expulsion en cours...`,
            msg,
            [senderJid]
          );

          try {
            const info = await getGroupAdmins(natsu, jid);

            const botIsAdmin = isGroupAdmin(
              info.admins,
              natsu.user?.id,
              info.meta
            );

            if (botIsAdmin) {

              await natsu.groupParticipantsUpdate(
                jid,
                [senderJid],
                'remove'
              );

            } else {

              await sendText(
                natsu,
                jid,
                `⚠️ Je dois être administrateur pour expulser @${senderNum}.`,
                msg,
                [senderJid]
              );

            }

          } catch (err) {
            console.error('❌ ANTITAG kick:', err);

            await sendText(
              natsu,
              jid,
              `❌ Impossible d'expulser @${senderNum}.`,
              msg,
              [senderJid]
            );
          }

        } else {

          // ─────────────────────────────────────────────────────────────
          // MODE ON
          // ─────────────────────────────────────────────────────────────

          await sendText(
            natsu,
            jid,
            `🚫 *ᴀɴᴛɪᴛᴀɢ*\n\n` +
            `@${senderNum}, les mentions massives sont interdites dans ce groupe.\n\n` +
            `👥 Mentions détectées : ${mentionedJids.length}`,
            msg,
            [senderJid]
          );
        }

        // Ne pas continuer le traitement du message
        return;
      }
    }

  } catch (error) {
    console.error('❌ Erreur ANTITAG:', error);
  }
}
  // ── AFK : si l'auteur est AFK, on l'enlève. Si quelqu'un mentionné est AFK, on prévient.
  try {
    if (state.afks?.[senderJid]) {
      const info = state.afks[senderJid];
      const mins = Math.floor((Date.now() - info.since) / 60000);
      updateState(s => { delete s.afks[senderJid]; });
      await natsu.sendMessage(jid, {
        text: `👋 ʙᴏɴ ʀᴇᴛᴏᴜʀ @${senderNum} ! ᴛᴜ éᴛᴀɪs ᴀғᴋ ᴅᴇᴘᴜɪs ${mins} ᴍɪɴ (${info.reason || 'ᴀᴜᴄᴜɴᴇ ʀᴀɪsᴏɴ'}).`,
        mentions: [senderJid], contextInfo: forwardedContext(),
      }, { quoted: msg });
    }
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    for (const mj of mentioned) {
      if (state.afks?.[mj]) {
        const info = state.afks[mj];
        await natsu.sendMessage(jid, {
          text: `*💤 @${mj.split('@')[0]} ᴇsᴛ ᴀғᴋ — *${info.reason || 'sᴀɴs ʀᴀɪsᴏɴ'}*`,
          mentions: [mj], contextInfo: forwardedContext(),
        }, { quoted: msg });
      }
    }
  } catch {}

  // Détection du préfixe (plusieurs supportés) OU déclenchement sans préfixe
  // si le premier mot correspond à une commande connue.
  let usedPrefix = false;
  let raw = text;
  const activePrefixes = [...new Set([state.prefix || PREFIX, ...PREFIXES])];
  if (activePrefixes.includes(raw[0])) {
    raw = raw.slice(1).trim();
    usedPrefix = true;
  }
  const firstWord = raw.split(/\s+/)[0]?.toLowerCase() || '';
  const noPrefixMatch = !usedPrefix && KNOWN_CMDS.has(firstWord);

  if (!usedPrefix && !noPrefixMatch) {
    // ── ANTILINK ─────────────────────────────────────────────────────────────
    // Matches ANY URL (http/https, wa.me, t.me, chat.whatsapp.com, tiktok,
    // youtube, instagram, etc.) so it actually catches what users post.
    const LINK_RE = /(https?:\/\/\S+|www\.\S+|wa\.me\/\S+|t\.me\/\S+|chat\.whatsapp\.com\/\S+|\b[\w-]+\.(com|net|org|io|me|tv|gg|xyz|link|app|dev|co)\b\/?\S*)/i;

const antiLinkMode = state?.antilink?.[jid];

if (isGroup(jid) && antiLinkMode && LINK_RE.test(text)) {
  const { admins, meta } = await getGroupAdmins(natsu, jid);
  const senderIsAdmin = isGroupAdmin(admins, senderJid, meta);

  // Les admins sont ignorés
  if (!senderIsAdmin) {

    // ─────────────────────────────────────────────────────────────
    // 🗑️ SUPPRESSION DU MESSAGE
    // ─────────────────────────────────────────────────────────────

    try {
      await natsu.sendMessage(jid, {
        delete: msg.key
      });
    } catch (e) {
      console.error(
        '[ANTILINK] Delete error:',
        e?.message || e
      );
    }

    // ─────────────────────────────────────────────────────────────
    // 🔨 KICK MODE
    // ─────────────────────────────────────────────────────────────

    if (antiLinkMode === 'kick') {

      try {
        await natsu.groupParticipantsUpdate(
          jid,
          [senderJid],
          'remove'
        );

        await sendText(
          natsu,
          jid,
          `╭━━━〔 🔗 *ANTILINK* 〕━━━╮

⛔ @${senderNum}

🔗 Lien détecté.
🗑️ Message supprimé.
🔨 Utilisateur expulsé du groupe.

╰━━━━━━━━━━━━━━━━━━━━━━╯`,
          msg
        );

      } catch (e) {

        console.error(
          '[ANTILINK] Kick error:',
          e?.message || e
        );

        await sendText(
          natsu,
          jid,
          `⛔ @${senderNum} *Lien détecté et message supprimé, mais l'expulsion a échoué.*`,
          msg
        );
      }

    // ─────────────────────────────────────────────────────────────
    // 🟢 ON MODE
    // ─────────────────────────────────────────────────────────────

    } else {

      await sendText(
        natsu,
        jid,
        `╭━━━〔 🔗 *ANTILINK* 〕━━━╮

⚠️ @${senderNum}

🔗 Lien détecté.
🗑️ Message supprimé.

📌 Le mode *KICK* n'est pas activé.

╰━━━━━━━━━━━━━━━━━━━━━━╯`,
        msg
      );
    }

    return;
  }
}

return;
  }

  const body  = raw;
  if (!body) return;
  const parts = body.split(/\s+/);
  const cmd   = parts[0].toLowerCase();
  const arg   = parts.slice(1).join(' ');
  const args  = parts.slice(1);

  // ── MODE ALWAYS PUBLIC ────────────────────────────────────────────────────
  // The bot is PUBLIC everywhere: groups AND private chats.
  // Everyone can use menu, fun, games, AI, downloads, etc.
  // Only group-management commands (promote/kick/ban/etc.) keep their own
  // admin check below — that's intentional and independent of this setting.
  // The 'self' mode command still exists for the owner to switch, but groups
  // are ALWAYS public regardless (self only restricts private chats).
  if (state.mode === 'self' && !isGroup(jid)) {
    const fromMe = msg.key.fromMe;
    const isSudo = state.sudo.includes(senderNum);
    if (!fromMe && !isSudo) return;
  }
  // Banned users are silently ignored
  if (state.banned.includes(senderNum)) return;

  const reply = (t) => sendText(natsu, jid, t, msg);
  const img   = (u, c) => sendImage(natsu, jid, u, c, msg);

  try {
    switch (cmd) {

      // ═════════════════════════════════════════════════════════════════════
      // MENU / HELP
      // ═════════════════════════════════════════════════════════════════════
      case 'menu': case 'help': case 'list': {
        const name = msg.pushName || '';
        let buf = null;
        try { buf = fs.readFileSync(MENU_LOCAL_VIDEO); } catch {}
        if (!buf) {
          await reply(`❌ Vidéo introuvable : place *messi.mp4* dans le dossier *video* à côté de commands.js.`);
          break;
        }
        await natsu.sendMessage(jid, {
          video: buf,
          mimetype: 'video/mp4',
          caption: buildMenu(name),
          contextInfo: forwardedContext(),
        }, { quoted: msg });
        break;
      }

      // ═════════════════════════════════════════════════════════════════════
      // CONNECT MENU — generate a pairing code so ANOTHER WhatsApp user
      // can link their number through this active bot (no Telegram needed)
      // ═════════════════════════════════════════════════════════════════════
      case 'pair': case 'connect': case 'bot': {
        const rawNumber = (arg || '').trim();
        if (!rawNumber) {
          await reply(
`╭━━━〔 ${BOT_NAME} 〕━━━╮

*🔗 ᴘᴀɪʀ ᴀ ɴᴇᴡ ᴡʜᴀᴛsᴀᴘᴘ ɴᴜᴍʙᴇʀ*

> *📱 ᴜsᴀɢᴇ:*
➜ *${PREFIX}${cmd} 242xxxxxxxx*
> *ᴇxᴀᴍᴘʟᴇ:*
➜ *${PREFIX}${cmd} 243906905464*
━━━━━━━━━━━━━━━━━━
> *ʀᴜʟᴇs:*
*• ᴜsᴇ ɪɴᴛᴇʀɴᴀᴛɪᴏɴᴀʟ ғᴏʀᴍᴀᴛ*
*• ɴᴏ "+" sɪɢɴ*
*• ɴᴏ ʟᴇᴀᴅɪɴɢ "0"*
> *ʏᴏᴜ ᴡɪʟʟ ʀᴇᴄᴇɪᴠᴇ:*
> *ᴀɴ 8-ᴅɪɢɪᴛ ᴄᴏᴅᴇ*
> *ғᴏʀᴍᴀᴛ: ᴀʙᴏᴠ-ᴇᴀʟʟ*

> *👑 ᴘᴏᴡᴇʀᴇᴅ ʙʏ : ${DEV_NAME}*`);
          break;
        }
        const phone = rawNumber.replace(/\D/g, '');
        if (phone.length < 7 || phone.length > 15) {
          await reply(`*❌ ɪɴᴠᴀʟɪᴅ ɴᴜᴍʙᴇʀ. ᴜsᴇ ɪɴᴛᴇʀɴᴀᴛɪᴏɴᴀʟ ғᴏʀᴍᴀᴛ ᴡɪᴛʜᴏᴜᴛ \`+\`."*`);
          break;
        }
        if (phone.startsWith('0')) {
          await reply(`*❌ ʀᴇᴍᴏᴠᴇ ᴛʜᴇ ʟᴇᴀᴅɪɴɢ 0. ᴇx: ${PREFIX}${cmd} 243xxxx*`);
          break;
        }
        await reply(`*⏳ ɢᴇɴᴇʀᴀᴛɪɴɢ ᴘᴀɪʀɪɴɢ ᴄᴏᴅᴇ ғᴏʀ +${phone}...*`);
        try {
          const { createSession } = await import('./whatsapp.js');
          const { code } = await createSession(phone);
          if (code) {
            await reply(
`╭━━〔 *ᴘᴀɪʀɪɴɢ ᴄᴏᴅᴇ* 〕━━╮

> *📱 ɴᴜᴍʙᴇʀ:*
➜ +${phone}
> *🔑 ᴄᴏᴅᴇ:*
➜ ${code}
> *⏳ ᴇxᴘɪʀᴇs:*
➜ 2 ᴍɪɴᴜᴛᴇs
━━━━━━━━━━━━━━━━━━
*✅ ᴄᴏɴɴᴇᴄᴛɪᴏɴ ᴡɪʟʟ ʙᴇ ᴄᴏᴍᴘʟᴇᴛᴇᴅ ᴀᴜᴛᴏᴍᴀᴛɪᴄᴀʟʟʏ.*

╰━━〔 *killua ᴍᴅ* 〕━━╯
> *ʏᴏᴜʀ ғᴀsᴛ ʙᴏᴛ*
> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ : ${DEV_NAME}*`);
          } else {
            await reply(`*✅ +${phone} ɪs ᴀʟʀᴇᴀᴅʏ ᴄᴏɴɴᴇᴄᴛᴇᴅ ᴛᴏ ${BOT_NAME}!*`);
          }
        } catch (err) {
          await reply(`*❌ ᴇʀʀᴏʀ: ${err.message}*`);
        }
        break;
      }
      // ═════════════════════════════════════════════════════════════════════
      case 'ai': case 'gpt': case 'gpt4': case 'gpt5': case 'metaai':
      case 'deepseek': case 'grok-ai': case 'grok': case 'qwen': case 'gemini': {
        if (!arg) { await reply(`❌ 𝗨𝘀𝗮𝗴𝗲: *${PREFIX}${cmd} <𝗽𝗿𝗼𝗺𝗽𝘁>*`); break; }
        const ans = await askAI(arg, cmd);
        await reply(`🐐 *${cmd.toUpperCase()}*\n\n${ans}`);
        break;
       } 
      case 'codeai': {
        if (!arg) { await reply(`❌ 𝗨𝘀𝗮𝗴𝗲: *${PREFIX}codeai <𝘁𝗮𝘀𝗸>*`); break; }
        const ans = await askAI(`You are a senior software engineer. Write clean code for: ${arg}`, 'codeai');
        await reply(`💻 *𝗖𝗢𝗗𝗘 𝗔𝗜*\n\n${ans}`);
        break;
      }
      case 'photoai': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}photoai <description>*`); break; }
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(arg)}?width=768&height=768&nologo=true`;
        await img(url, `🎨 *𝗣𝗛𝗢𝗧𝗢 𝗔𝗜*\n📝 ${arg}`);
        break;
      }
      case 'storyai': {
        if (!arg) { await reply(`❌ 𝗨𝘀𝗮𝗴𝗲: *${PREFIX}storyai <𝘁𝗵𝗲𝗺𝗲>*`); break; }
        const ans = await askAI(`Write a short engaging story (~300 words) about: ${arg}`, 'story');
        await reply(`📖 *𝗦𝗧𝗢𝗥𝗬 𝗔𝗜*\n\n${ans}`);
        break;
      }
      case 'triviaai': {
        const ans = await askAI('Give me one interesting trivia question with the answer in parentheses.', 'trivia');
        await reply(`🧠 *𝗧𝗥𝗜𝗩𝗜𝗔 𝗔𝗜*\n\n${ans}`);
        break;
      }

      // ═════════════════════════════════════════════════════════════════════
      // GROUP MENU
      // ═════════════════════════════════════════════════════════════════════
      case 'botinfo': case 'status': {
        const up = Math.floor(process.uptime());
        const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60), sec = up % 60;
        const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
        await reply(`╭━━━〔 *${BOT_NAME}* 〕━━━╮\n│ 🟢 Status  : ONLINE\n│ 👑 Dev     : ${DEV_NAME}\n│ ⚡ Prefix  : ${getState().prefix || PREFIX}\n│ 📦 Version : ${BOT_VERSION}\n│ 📚 Commands: ${KNOWN_CMDS.size}\n│ ⏱️ Uptime  : ${h}h ${m}m ${sec}s\n│ 💾 RAM     : ${mem} MB\n│ 🌐 Mode    : ${getState().mode}\n╰━━━━━━━━━━━━━━━━━━━━╯`);
        break;
      }
      case 'groupstatus': case 'settings': {
        if (!isGroup(jid)) { await reply('*❌ ɢʀᴏᴜᴘ ᴏɴʟʏ.*'); break; }
        const meta = await natsu.groupMetadata(jid);
        const st = getState();
        await reply(`╭━━〔 *ɢʀᴏᴜᴘ sᴇᴛᴛɪɴɢs* 〕━━╮\n│ 📛 ${meta.subject}\n│ 👥 Members : ${meta.participants.length}\n│ 🔗 AntiLink: ${st.antilink[jid] ? 'ON' : 'OFF'}\n│ 🤖 AntiBot : ${st.antibot[jid] ? 'ON' : 'OFF'}\n│ 🚫 AntiSpam: ${st.antispam[jid] ? 'ON' : 'OFF'}\n│ 👋 Welcome : ${st.welcome[jid] === false ? 'OFF' : 'ON'}\n│ 👋 Goodbye : ${st.goodbye[jid] === false ? 'OFF' : 'ON'}\n╰━━━━━━━━━━━━━━━━━━━━╯`);
        break;
      }
      case 'antilinkstatus': {
        if (!isGroup(jid)) { await reply('*❌ ɢʀᴏᴜᴘ ᴏɴʟʏ.*'); break; }
        const st = getState();
        await reply(`🔗 *ANTILINK* : ${st.antilink[jid] ? '🟢 ON' : '🔴 OFF'}\n🤖 *ANTIBOT* : ${st.antibot[jid] ? '🟢 ON' : '🔴 OFF'}\n🚫 *ANTISPAM* : ${st.antispam[jid] ? '🟢 ON' : '🔴 OFF'}`);
        break;
      }
     case 'antitag': {
  try {

    // ═══════════════════════════════════════════════════════════════════
    // ANTITAG
    // ═══════════════════════════════════════════════════════════════════

    if (!isGroup(jid)) {
      await reply('❌ Cette commande est utilisable uniquement dans les groupes.');
      break;
    }

    // Vérifier que l'utilisateur est administrateur
    const info = await requireGroupAdmin(
      natsu,
      jid,
      msg,
      senderJid,
      reply
    );

    if (!info) break;

    const currentState =
      getState()?.antitag?.[jid] || 'off';

    // ─────────────────────────────────────────────────────────────────
    // Aucun argument
    // ─────────────────────────────────────────────────────────────────

    if (!arg) {

      await reply(
        `╭━━━〔 🚫 ANTITAG 〕━━━╮
┃
┃ 📊 État :
┃ ${currentState === 'off'
    ? '🔴 OFF'
    : '🟢 ' + currentState.toUpperCase()}
┃
┃ 👥 Seuil : 5 mentions
┃
┃ Commandes :
┃
┃ • ${PREFIX}antitag on
┃ • ${PREFIX}antitag off
┃ • ${PREFIX}antitag kick
┃ • ${PREFIX}antitag status
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯`
      );

      break;
    }

    const action = arg.trim().toLowerCase();

    // ─────────────────────────────────────────────────────────────────
    // STATUS
    // ─────────────────────────────────────────────────────────────────

    if (
      action === 'status' ||
      action === 'state' ||
      action === 'info'
    ) {

      await reply(
        `╭━━━〔 🚫 ANTITAG STATUS 〕━━━╮
┃
┃ 📊 État :
┃ ${currentState === 'off'
    ? '🔴 OFF'
    : '🟢 ' + currentState.toUpperCase()}
┃
┃ 👥 Seuil : 5 mentions
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯`
      );

      break;
    }

    // ─────────────────────────────────────────────────────────────────
    // ON
    // ─────────────────────────────────────────────────────────────────

    if (
      action === 'on' ||
      action === 'enable' ||
      action === '1' ||
      action === 'true'
    ) {

      updateState(st => {

        if (!st.antitag) {
          st.antitag = {};
        }

        st.antitag[jid] = 'on';

      });

      await reply(
        `✅ *ANTITAG ACTIVÉ* 🟢\n\n` +
        `👥 Les mentions massives de 5 personnes ou plus seront bloquées.`
      );

      break;
    }

    // ─────────────────────────────────────────────────────────────────
    // KICK
    // ─────────────────────────────────────────────────────────────────

    if (
      action === 'kick' ||
      action === 'remove'
    ) {

      updateState(st => {

        if (!st.antitag) {
          st.antitag = {};
        }

        st.antitag[jid] = 'kick';

      });

      await reply(
        `✅ *ANTITAG KICK ACTIVÉ* 🟢\n\n` +
        `🚫 Les mentions massives seront supprimées.\n` +
        `👢 Leur auteur sera expulsé.`
      );

      break;
    }

    // ─────────────────────────────────────────────────────────────────
    // OFF
    // ─────────────────────────────────────────────────────────────────

    if (
      action === 'off' ||
      action === 'disable' ||
      action === '0' ||
      action === 'false'
    ) {

      updateState(st => {

        if (!st.antitag) {
          st.antitag = {};
        }

        st.antitag[jid] = 'off';

      });

      await reply(
        `❌ *ANTITAG DÉSACTIVÉ* 🔴`
      );

      break;
    }

    // ─────────────────────────────────────────────────────────────────
    // OPTION INVALIDE
    // ─────────────────────────────────────────────────────────────────

    await reply(
      `❌ Option inconnue.\n\n` +
      `Utilise :\n` +
      `• ${PREFIX}antitag on\n` +
      `• ${PREFIX}antitag off\n` +
      `• ${PREFIX}antitag kick\n` +
      `• ${PREFIX}antitag status`
    );

  } catch (error) {

    console.error('❌ Erreur commande ANTITAG:', error);

    await reply(
      `❌ Une erreur est survenue avec ANTITAG.`
    );

  }

  break;
}
      case 'antibot': case 'antispam': {
        const info = await requireGroupAdmin(natsu, jid, msg, senderJid, reply);
        if (!info) break;
        const key = cmd === 'antibot' ? 'antibot' : 'antispam';
        if (!arg) { await reply(`🛡️ *${cmd.toUpperCase()}* : ${getState()[key][jid] ? 'ON' : 'OFF'}\nUsage: ${PREFIX}${cmd} on/off`); break; }
        const on = /^(on|1|true)$/i.test(arg.trim());
        updateState(st => { st[key][jid] = on; });
        clearFlood(`${jid}:${senderJid}`);
        await reply(`✅ *${cmd.toUpperCase()}* → ${on ? 'ON 🟢' : 'OFF 🔴'}`);
        break;
      }
      case 'welcome':
      case 'goodbye': {
        const key = cmd === 'welcome' ? 'welcome' : 'goodbye';
        const info = await requireGroupAdmin(natsu, jid, msg, senderJid, reply);
        if (!info) break;

        const state = getState();
        const configKey = `${key}Config`;
        const currentState = state?.[key]?.[jid] !== false;
        const config = state?.[configKey]?.[jid] || {};
        const action = arg.trim();

        if (!action) {
          await reply(
`╭━━━〔 ${key === 'welcome' ? '👋 WELCOME V2' : '🚪 GOODBYE V2'} 〕━━━╮
┃
┃ 📊 État : ${currentState ? '🟢 ON' : '🔴 OFF'}
┃ 🖼️ Image : ${config.image ? '✅ Personnalisée' : '🖼️ Défaut'}
┃ 💬 Message : ${config.message ? '✏️ Personnalisé' : '📋 Défaut'}
┃
┃ Commandes :
┃ • ${PREFIX}${cmd} on
┃ • ${PREFIX}${cmd} off
┃ • ${PREFIX}${cmd} status
┃ • ${PREFIX}${cmd} test
┃ • ${PREFIX}${cmd} msg <texte>
┃ • ${PREFIX}${cmd} reset
┃
┃ Variables :
┃ @user  @group  @members
┃ @bot   @prefix
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯`
          );
          break;
        }

        const [sub, ...rest] = action.split(/\s+/);
        const value = rest.join(' ').trim();
        const subLower = sub.toLowerCase();

        if (['status', 'state', 'info'].includes(subLower)) {
          await reply(
`╭━━━〔 ⚙️ ${key.toUpperCase()} STATUS 〕━━━╮
┃ 📊 État : ${currentState ? '🟢 ON' : '🔴 OFF'}
┃ 🖼️ Image : ${config.image ? 'PERSONNALISÉE' : 'DÉFAUT'}
┃ 💬 Message : ${config.message ? 'PERSONNALISÉ' : 'DÉFAUT'}
┃
┃ Groupe : ${jid}
╰━━━━━━━━━━━━━━━━━━━━━━╯`
          );
          break;
        }

        if (['test', 'try'].includes(subLower)) {
          const fakeJid = senderJid || `${senderNum}@s.whatsapp.net`;
          const groupName = info.meta?.subject || 'ce groupe';
          const members = info.meta?.participants?.length || 0;

          const caption = renderGroupMessage(config.message, {
            userJid: fakeJid,
            groupName,
            members,
            botName: BOT_NAME,
            prefix: state.prefix || PREFIX,
            goodbye: key === 'goodbye',
          });

          try {
            await natsu.sendMessage(jid, {
              image: { url: config.image || MENU_IMAGE },
              caption,
              mentions: [fakeJid],
              contextInfo: forwardedContext(),
            }, { quoted: msg });
          } catch {
            await reply(caption);
          }
          break;
        }

        const enable = ['on', '1', 'true', 'enable', 'enabled', 'yes', 'oui', 'active', 'activé'];
        const disable = ['off', '0', 'false', 'disable', 'disabled', 'no', 'non', 'desactive', 'désactivé'];

        if (enable.includes(subLower) || disable.includes(subLower)) {
          const newState = enable.includes(subLower);

          if (currentState === newState) {
            await reply(`ℹ️ *${cmd.toUpperCase()}* est déjà ${newState ? '🟢 ON' : '🔴 OFF'}.`);
            break;
          }

          updateState(st => {
            st[key] ??= {};
            st[key][jid] = newState;
          });

          await reply(
`╭━━━〔 ⚙️ ${key.toUpperCase()} 〕━━━╮
┃ 📊 État : ${newState ? '🟢 ACTIVÉ' : '🔴 DÉSACTIVÉ'}
┃ 👥 Groupe configuré avec succès.
╰━━━━━━━━━━━━━━━━━━━━━━╯`
          );
          break;
        }

        if (['msg', 'message', 'setmsg', 'set'].includes(subLower)) {
          if (!value) {
            await reply(
`❌ Usage :
${PREFIX}${cmd} msg Bienvenue @user dans @group 🎉

Variables :
@user @group @members @bot @prefix`
            );
            break;
          }

          if (value.length > 1500) {
            await reply('❌ Le message est trop long. Maximum : 1500 caractères.');
            break;
          }

          updateState(st => {
            st[configKey] ??= {};
            st[configKey][jid] ??= {};
            st[configKey][jid].message = value;
          });

          await reply(
`✅ *${key.toUpperCase()}* personnalisé.

💬 ${value}

Variables :
@user • @group • @members • @bot • @prefix`
          );
          break;
        }

        if (['reset', 'default', 'clear'].includes(subLower)) {
          updateState(st => {
            st[configKey] ??= {};
            delete st[configKey][jid];
          });

          await reply(`✅ *${key.toUpperCase()}* remis à sa configuration par défaut.`);
          break;
        }

        await reply(
`❌ Option inconnue.

Utilise :
• ${PREFIX}${cmd} on
• ${PREFIX}${cmd} off
• ${PREFIX}${cmd} status
• ${PREFIX}${cmd} test
• ${PREFIX}${cmd} msg <texte>
• ${PREFIX}${cmd} reset`
        );
        break;
      }
      case 'admins': case 'groupadmins': {
        if (!isGroup(jid)) { await reply('*❌ ɢʀᴏᴜᴘ ᴏɴʟʏ.*'); break; }
        const { meta } = await getGroupAdmins(natsu, jid);
        if (!meta) { await reply('*❌ ɪᴍᴘᴏssɪʙʟᴇ ᴅᴇ ʟɪʀᴇ ʟᴇ ɢʀᴏᴜᴘᴇ.*'); break; }
        const admins = meta.participants.filter(p => p.admin);
        const mentions = admins.map(p => p.id);
        const text = `👑 *ADMINS — ${meta.subject}*\n\n${admins.map((p,i) => `◈ ${i+1}. @${p.id.split('@')[0]} ${p.admin === 'superadmin' ? '👑' : '⭐'}`).join('\n')}`;
        await natsu.sendMessage(jid, { text, mentions, contextInfo: forwardedContext() }, { quoted: msg });
        break;
      }
      case 'rules': {
        if (!isGroup(jid)) { await reply('*❌ ɢʀᴏᴜᴘ ᴏɴʟʏ.*'); break; }
        const rules = getState().rules?.[jid] || 'Aucune règle définie. Les admins peuvent utiliser .setrules <règles>.';
        await reply(`📜 *RÈGLES DU GROUPE*\n\n${rules}`);
        break;
      }
      case 'setrules': {
        const info = await requireGroupAdmin(natsu, jid, msg, senderJid, reply);
        if (!info) break;
        if (!arg) { await reply(`❌ Usage: ${PREFIX}setrules <texte>`); break; }
        updateState(s => { s.rules ??= {}; s.rules[jid] = arg.slice(0, 5000); });
        await reply('✅ *Règles du groupe mises à jour.*');
        break;
      }
      case 'poll': {
        if (!isGroup(jid)) { await reply('*❌ ɢʀᴏᴜᴘ ᴏɴʟʏ.*'); break; }
        const pieces = arg.split('|').map(x => x.trim()).filter(Boolean);
        if (pieces.length < 3) { await reply(`❌ Usage: ${PREFIX}poll Question | Option 1 | Option 2`); break; }
        const [question, ...values] = pieces.slice(0, 13);
        try { await natsu.sendMessage(jid, { poll: { name: question, values, selectableCount: 1 } }, { quoted: msg }); }
        catch (e) { await reply(`❌ Poll : ${e.message}`); }
        break;
      }
      case 'groupinfo': case 'ginfo': case 'groupid': case 'groupname': {
        if (!isGroup(jid)) { await reply('❌ Group only.'); break; }
        const meta = await natsu.groupMetadata(jid);
        if (cmd === 'groupid') { await reply(`🆔 *GROUP ID*\n\n${jid}`); break; }
        if (cmd === 'groupname') { await reply(`📛 *GROUP NAME*\n\n${meta.subject}`); break; }
        const admins = meta.participants.filter(p => p.admin).length;
        await reply(`👥 *GROUP INFO*\n\n📛 ${meta.subject}\n👤 Members: ${meta.participants.length}\n👑 Admins: ${admins}\n🆔 ${jid}`);
        break;
      }
      case 'members': case 'membercount': {
        if (!isGroup(jid)) { await reply('❌ Group only.'); break; }
        const meta = await natsu.groupMetadata(jid);
        await reply(`👥 *${meta.subject}*\nMembers: *${meta.participants.length}*`);
        break;
      }
      case 'myrole': {
        const info = await requireGroupMember(natsu, jid, reply);
        if (!info) break;
        const role = participantRole(info.meta, senderJid);
        const label = role === 'owner' ? '👑 Group owner' : role === 'admin' ? '🛡️ Admin' : '👤 Member';
        await reply(`🎖️ *YOUR ROLE*\n\n${label}`);
        break;
      }
      case 'memberinfo': {
        const info = await requireGroupMember(natsu, jid, reply);
        if (!info) break;
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const target = mentioned[0] || msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (!target) { await reply(`❌ Usage: ${PREFIX}memberinfo @user`); break; }
        const found = findParticipant(info.meta, target);
        if (!found) { await reply('❌ Member not found in this group.'); break; }
        const role = participantRole(info.meta, found.id);
        const label = role === 'owner' ? '👑 Group owner' : role === 'admin' ? '🛡️ Admin' : '👤 Member';
        await natsu.sendMessage(jid, { text: `👤 *MEMBER INFO*\n\n@${found.id.split('@')[0]}\n🎖️ ${label}`, mentions: [found.id], contextInfo: forwardedContext() }, { quoted: msg });
        break;
      }
      case 'botstatus': case 'status': {
        const up = Math.floor(process.uptime());
        const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60), sec = up % 60;
        await reply(`🤖 *${BOT_NAME}*\n🟢 Online\n⏱️ ${h}h ${m}m ${sec}s\n📦 Node ${process.version}`);
        break;
      }
      case 'tagall': {
        const info = await requireGroupMember(natsu, jid, reply);
        if (!info) break;
        const { meta } = info;
        if (!meta) break;
        const mentions = meta.participants.map(p => p.id);
        const txt = `*📢 ᴛᴀɢᴀʟʟ — ${arg || 'ʜᴇʟʟᴏ ᴀʟʟ ᴍᴇᴍʙᴇʀs😻!*'}\n\n` +
          mentions.map((m, i) => `├🔖${i + 1}. @${m.split('@')[0]}`).join('\n');
        await natsu.sendMessage(jid, { text: txt, mentions, contextInfo: forwardedContext() }, { quoted: msg });
        break;
      }
      case 'hidetag': {
        const info = await requireGroupMember(natsu, jid, reply);
        if (!info) break;
        const { meta } = info;
        if (!meta) break;
        await natsu.sendMessage(jid, {
          text: arg || '▢',
          mentions: meta.participants.map(p => p.id),
          contextInfo: forwardedContext(),
        });
        break;
      }
      case 'promote': case 'demote': case 'kick': case 'add': {
        const info = await requireGroupAdmin(natsu, jid, msg, senderJid, reply);
        if (!info) break;
        const { meta } = info;
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const mention = mentioned[0];
        const numArg = normalizeNumber(arg);
        let target = mention || (numArg ? `${numArg}@s.whatsapp.net` : null);
        if (!target) { await reply(`*❌ ᴜsᴀɢᴇ: ${PREFIX}${cmd} @ᴜsᴇʀ ᴏᴜ ${PREFIX}${cmd} 243xxxxxxxxx*`); break; }

        // Resolve LID/phone to the exact participant JID whenever possible.
        const found = findParticipant(meta, target);
        if (found?.id) target = found.id;

        const stateNow = getState();
        const senderRole = participantRole(meta, senderJid);
        const targetInfo = isProtectedTarget(meta, target, stateNow);
        const targetRole = targetInfo.role;

        if (cmd !== 'add' && !found) {
          await reply('*❌ ᴜᴛɪʟɪsᴀᴛᴇᴜʀ ɴᴏɴ ᴛʀᴏᴜᴠᴇ́ ᴅᴀɴs ʟᴇ ɢʀᴏᴜᴘᴇ.*');
          break;
        }
        if (cmd === 'add') {
          try {
            await natsu.groupParticipantsUpdate(jid, [target], 'add');
            invalidateGroupCache(jid);
            await reply(`✅ *ADD* → @${target.split('@')[0]}`);
          } catch (e) { await reply(`❌ *add* échoué : ${e?.message || e}`); }
          break;
        }

        // Hierarchy: a normal admin may manage members, but cannot modify
        // another admin, the group owner, the bot, or the bot owner/sudo.
        if (pIsBot(target, meta, info.botIds)) { await reply('*❌ ɪᴍᴘᴏssɪʙʟᴇ ᴅᴇ ᴍᴏᴅɪғɪᴇʀ ʟᴇ ʙᴏᴛ.*'); break; }
        if (targetInfo.protected) { await reply('*❌ ᴄᴇᴛ ᴜᴛɪʟɪsᴀᴛᴇᴜʀ ᴇsᴛ ᴘʀᴏᴛᴇ́ɢᴇ́.*'); break; }
        if (!isCreator && senderRole !== 'owner' && roleRank(targetRole) >= roleRank(senderRole)) {
          await reply('*❌ ʜɪᴇ́ʀᴀʀᴄʜɪᴇ ɪɴsᴜғғɪsᴀɴᴛᴇ : ᴛᴜ ɴᴇ ᴘᴇᴜx ᴘᴀs ᴍᴏᴅɪғɪᴇʀ ᴜɴ ᴀᴅᴍɪɴ.*');
          break;
        }
        if (cmd === 'promote' && targetRole !== 'member') { await reply('*ℹ️ ᴄᴇᴛ ᴜᴛɪʟɪsᴀᴛᴇᴜʀ ᴇsᴛ ᴅᴇ́ᴊᴀ̀ ᴀᴅᴍɪɴ.*'); break; }
        if (cmd === 'demote' && targetRole === 'member') { await reply("*ℹ️ ᴄᴇᴛ ᴜᴛɪʟɪsᴀᴛᴇᴜʀ ɴ'ᴇsᴛ ᴘᴀs ᴀᴅᴍɪɴ.*"); break; }

        const action = cmd === 'kick' ? 'remove' : cmd;
        try {
          await natsu.groupParticipantsUpdate(jid, [target], action);
          invalidateGroupCache(jid);
          await new Promise(r => setTimeout(r, 500));
          await natsu.sendMessage(jid, { text: `✅ *${cmd.toUpperCase()}* → @${target.split('@')[0]}`, mentions: [target], contextInfo: forwardedContext() }, { quoted: msg });
        } catch (e) { await reply(`❌ *${cmd}* échoué : ${e?.message || e}`); }
        break;
      }
      case 'mute': case 'unmute': case 'closegc': case 'opengc': case 'lock': case 'unlock': {
        const info = await requireGroupAdmin(natsu, jid, msg, senderJid, reply);
        if (!info) break;
        const setting = (['mute','closegc','lock'].includes(cmd)) ? 'announcement' : 'not_announcement';
        try { await natsu.groupSettingUpdate(jid, setting); await reply(`*✅ ɢʀᴏᴜᴘ ${cmd}*`); }
        catch (e) { await reply(`❌ ${e.message}`); }
        break;
      }
      case 'left': {
        const info = await requireGroupAdmin(natsu, jid, msg, senderJid, reply);
        if (!info) break;
        await reply('👋 ʟᴇᴀᴠɪɴɢ ɢʀᴏᴜᴘ...*');
        try { await natsu.groupLeave(jid); } catch {}
        break;
      }
      case 'grouplink': {
        const info = await requireGroupAdmin(natsu, jid, msg, senderJid, reply);
        if (!info) break;
        try { const code = await natsu.groupInviteCode(jid); await reply(`*🔗 https://chat.whatsapp.com/${code}*`); }
        catch (e) { await reply(`*❌ ${e.message}*`); }
        break;
      }
      case 'resetlink': {
        const info = await requireGroupAdmin(natsu, jid, msg, senderJid, reply);
        if (!info) break;
        try { const code = await natsu.groupRevokeInvite(jid); await reply(`*✅ ɴᴇᴡ ʟɪɴᴋ: https://chat.whatsapp.com/${code}*`); }
        catch (e) { await reply(`❌ ${e.message}`); }
        break;
      }
      case 'kickadmins': case 'kickall': {
        const info = await requireGroupOwnerOrCreator(natsu, jid, msg, senderJid, reply);
        if (!info) break;
        const { meta, botIds } = info;
        const targets = (cmd === 'kickall')
          ? meta.participants.filter(p => !pIsBot(p.id, meta, botIds) && p.admin !== 'superadmin').map(p => p.id)
          : meta.participants.filter(p => p.admin === 'admin' && !pIsBot(p.id, meta, botIds)).map(p => p.id);
        for (const t of targets) { try { await natsu.groupParticipantsUpdate(jid, [t], 'remove'); } catch {} await new Promise(r => setTimeout(r, 700)); }
        invalidateGroupCache(jid);
        await reply(`*✅ ʀᴇᴍᴏᴠᴇᴅ ${targets.length} ᴍᴇᴍʙʀᴇ(s).*`);
        break;
      }
      case 'listadmins': {
        if (!isGroup(jid)) { await reply('*❌ ɢʀᴏᴜᴘ ᴏɴʟʏ.*'); break; }
        const { admins } = await getGroupAdmins(natsu, jid);
        await reply(`*👑 ᴀᴅᴍɪɴs (${admins.length})*\n\n${admins.map((a, i) => ` *${i + 1}*. *+${a.split('@')[0]}*`).join('\n')}`);
        break;
      }
      case 'listonline': {
        if (!isGroup(jid)) { await reply('*❌ ɢʀᴏᴜᴘ ᴏɴʟʏ.*'); break; }
        await reply('*ℹ️ ᴡʜᴀᴛsᴀᴘᴘ ʀᴇsᴛʀɪᴄᴛs ᴏɴ ᴏɴʟɪɴᴇ ᴘʀᴇsᴇɴᴄᴇ ᴠɪsɪʙɪʟɪᴛʏ — ᴏɴʟᴜʟʏ ᴄᴏɴᴛᴀᴄᴛs ʏᴏᴜ ᴍᴇssᴀɢᴇ ᴄᴀɴ ʙᴇ ᴛʀᴀᴄᴋᴇᴅ.*');
        break;
      }
      case 'opentime': case 'closetime': {
        const info = await requireGroupAdmin(natsu, jid, msg, senderJid, reply);
        if (!info) break;
        const mins = parseInt(arg) || 0;
        if (!mins || mins < 1 || mins > 1440) { await reply(`*❌ ᴜsᴀɢᴇ: ${PREFIX}${cmd} <1-1440 ᴍɪɴ>*`); break; }
        await reply(`*⏰ ɢʀᴏᴜᴘ ᴡɪʟʟ ${cmd === 'opentime' ? 'open' : 'close'} ɪɴ ${mins} ᴍɪɴ.*`);
        setTimeout(async () => {
          try { await natsu.groupSettingUpdate(jid, cmd === 'opentime' ? 'not_announcement' : 'announcement'); } catch {}
        }, mins * 60000);
        break;
      }
      case 'antilink': {
  const info = await requireGroupAdmin(
    natsu,
    jid,
    msg,
    senderJid,
    reply
  );

  if (!info) break;

  const state = getState() || {};
  state.antilink ??= {};

  const current = state.antilink[jid];

  if (!arg || !arg.trim()) {
    const currentLabel =
      current === 'kick'
        ? '🔨 KICK'
        : current === true
          ? '🟢 ON'
          : '🔴 OFF';

    await reply(
`╭━━━〔 🔗 *ANTILINK* 〕━━━╮
┃
┃ 📊 Mode actuel : ${currentLabel}
┃
┃ 🟢 ${PREFIX}antilink on
┃ 🔴 ${PREFIX}antilink off
┃ 🔨 ${PREFIX}antilink kick
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯`
    );

    break;
  }

  const action = arg.trim().toLowerCase();

  if (!['on', 'off', 'kick'].includes(action)) {
    await reply(
`❌ *Option invalide.*

Utilise :

🟢 ${PREFIX}antilink on
🔴 ${PREFIX}antilink off
🔨 ${PREFIX}antilink kick`
    );

    break;
  }

  const value =
    action === 'on'
      ? true
      : action === 'kick'
        ? 'kick'
        : false;

  updateState(st => {
    st.antilink ??= {};
    st.antilink[jid] = value;
  });

  await reply(
`╭━━━〔 🔗 *ANTILINK* 〕━━━╮
┃
┃ 📊 Protection :
┃ ${
  action === 'on'
    ? '🟢 ACTIVÉE'
    : action === 'kick'
      ? '🔨 KICK ACTIVÉ'
      : '🔴 DÉSACTIVÉE'
}
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯`
  );

  break;
}
      case 'vcf': {
        if (!isGroup(jid)) { await reply('*❌ ɢʀᴏᴜᴘ ᴏɴʟʏ.*'); break; }
        const { meta } = await getGroupAdmins(natsu, jid);
        if (!meta) break;
        let vcf = '';
        meta.participants.forEach((p, i) => {
          const num = p.id.split('@')[0];
          vcf += `BEGIN:VCARD\nVERSION:3.0\nFN:Member ${i + 1}\nTEL;type=CELL;type=VOICE;waid=${num}:+${num}\nEND:VCARD\n`;
        });
        await natsu.sendMessage(jid, {
          document: Buffer.from(vcf), fileName: 'contacts.vcf',
          mimetype: 'text/vcard', contextInfo: forwardedContext(),
        }, { quoted: msg });
        break;
      }
      case 'creategroup': {
        if (!isCreator) { await reply('*❌ ᴏᴡɴᴇʀ / sᴜᴅᴏ ᴏɴʟʏ.*'); break; }
        if (!arg) { await reply(`*❌ ᴜsᴀɢᴇ: *${PREFIX}ᴄʀᴇᴀᴛᴇɢʀᴏᴜᴘ <ɴᴀᴍᴇ>*`); break; }
        try { const g = await natsu.groupCreate(arg, [senderJid]); await reply(`*✅ ɢʀᴏᴜᴘ ᴄʀᴇᴀᴛᴇᴅ: ${g.subject}*`); }
        catch (e) { await reply(`*❌ ${e.message}*`); }
        break;
      }
      case 'join': {
        if (!isCreator) { await reply('*❌ ᴏᴡɴᴇʀ / sᴜᴅᴏ ᴏɴʟʏ.*'); break; }
        if (arg.includes('chat.whatsapp.com/')) {
          const code = arg.split('chat.whatsapp.com/').pop().trim();
          try { await natsu.groupAcceptInvite(code); await reply('*✅ ᴊᴏɪɴᴇᴅ ɢʀᴏᴜᴘ!*'); }
          catch (e) { await reply(`❌ ${e.message}`); }
        } else {
          const ch = WA_CHANNELS.map((l, i) => `*📡 ᴄʜᴀɴɴᴇʟ ${i + 1}: ${l}*`).join('\n');
          const gr = WA_GROUPS.map((l, i) => `*👥 ɢʀᴏᴜᴘ ${i + 1}: ${l}*`).join('\n');
          await reply(`*🔗 ᴊᴏɪɴ ${BOT_NAME} ᴄᴏᴍᴍᴜɴɪᴛʏ\n\n${ch}\n\n${gr}*`);
        }
        break;
      }

      // ═════════════════════════════════════════════════════════════════════
      // OWNER MENU
      // ═════════════════════════════════════════════════════════════════════
      case 'setpp': {
        if (!isCreator) { await reply('*❌ ᴏᴡɴᴇʀ / sᴜᴅᴏ ᴏɴʟʏ.*'); break; }
        try {
          const buf = (await axios.get(MENU_IMAGE, { responseType: 'arraybuffer' })).data;
          await natsu.updateProfilePicture(natsu.user.id, Buffer.from(buf));
          await reply('*✅ ᴘʀᴏғɪʟᴇ ᴘɪᴄᴛᴜʀᴇ ᴜᴘᴅᴀᴛᴇᴅ*');
        } catch (e) { await reply(`❌ ${e.message}`); }
        break;
      }
      case 'ban': case 'unban': {
        if (!isCreator) { await reply('*❌ ᴏᴡɴᴇʀ / sᴜᴅᴏ ᴏɴʟʏ.*'); break; }
        const num = arg.replace(/\D/g, '');
        if (!num) { await reply(`*❌ ᴜsᴀɢᴇ: ${PREFIX}${cmd} <ɴᴜᴍʙᴇʀ>*`); break; }
        updateState(s => {
          s.banned = cmd === 'ban' ? [...new Set([...s.banned, num])] : s.banned.filter(n => n !== num);
        });
        await reply(`*✅ ${cmd} +${num}*`);
        break;
      }
      case 'self': case 'public': {
        if (!isCreator) { await reply('*❌ ᴏᴡɴᴇʀ / sᴜᴅᴏ ᴏɴʟʏ.*'); break; }
        updateState(s => { s.mode = cmd; });
        await reply(`*✅ ᴍᴏᴅᴇ → ${cmd}*`);
        break;
      }
      case 'autoread': case 'autobio': case 'autorecording': case 'autotyping':
      case 'autoviewstatus': case 'autoreact': {
        if (!isCreator) { await reply('*❌ ᴏᴡɴᴇʀ / sᴜᴅᴏ ᴏɴʟʏ.*'); break; }
        const map = { autoread: 'autoread', autobio: 'autobio', autorecording: 'autorecord',
          autotyping: 'autotyping', autoviewstatus: 'autoviewsts', autoreact: 'autoreact' };
        const key = map[cmd];
        const on = /on|1|true/i.test(arg);
        updateState(s => { s[key] = on; });
        await reply(`*✅ ${cmd} → ${on ? 'ON' : 'OFF'}*`);
        break;
      }
      case 'block': case 'unblock': {
        if (!isCreator) { await reply('*❌ ᴏᴡɴᴇʀ / sᴜᴅᴏ ᴏɴʟʏ.*'); break; }
        const num = (arg.replace(/\D/g, '')) || senderNum;
        try { await natsu.updateBlockStatus(`${num}@s.whatsapp.net`, cmd); await reply(`*✅ ${cmd} +${num}*`); }
        catch (e) { await reply(`*❌ ${e.message}*`); }
        break;
      }
      case 'delete': case 'del': {
        const q = msg.message?.extendedTextMessage?.contextInfo;
        if (!q?.stanzaId) { await reply('*❌ ʀᴇᴘʟʏ ᴛᴏ ᴀ ᴍᴇssᴀɢᴇ.*'); break; }
        try {
          await natsu.sendMessage(jid, { delete: { remoteJid: jid, fromMe: false, id: q.stanzaId, participant: q.participant } });
        } catch (e) { await reply(`❌ ${e.message}`); }
        break;
      }
      case 'setaccount': {
        if (!isCreator) { await reply('*❌ ᴏᴡɴᴇʀ / sᴜᴅᴏ ᴏɴʟʏ.*'); break; }
        if (!arg) { await reply(`❌ 𝗨𝘀𝗮𝗴𝗲: *${PREFIX}𝘀𝗲𝘁𝗮𝗰𝗰𝗼𝘂𝗻𝘁 <details>*`); break; }
        updateState(s => { s.account = arg; });
        await reply('✅ 𝗣𝗮𝘆𝗺𝗲𝗻𝘁 𝗮𝗰𝗰𝗼𝘂𝗻𝘁 𝘀𝗮𝘃𝗲𝗱.');
        break;
      }
      case 'addsudo': case 'delsudo': {
        if (!isCreator) { await reply('*❌ ᴏᴡɴᴇʀ / sᴜᴅᴏ ᴏɴʟʏ.*'); break; }
        const num = arg.replace(/\D/g, '');
        if (!num) { await reply(`❌ 𝗨𝘀𝗮𝗴𝗲: *${PREFIX}${cmd} <number>*`); break; }
        updateState(s => {
          s.sudo = cmd === 'addsudo' ? [...new Set([...s.sudo, num])] : s.sudo.filter(n => n !== num);
        });
        await reply(`✅ ${cmd} +${num}`);
        break;
      }
      case 'listsudo': {
        if (!isCreator) { await reply('*❌ ᴏᴡɴᴇʀ / sᴜᴅᴏ ᴏɴʟʏ.*'); break; }
        const s = getState();
        await reply(`👑 *𝗦𝘂𝗱𝗼 𝗹𝗶𝘀𝘁 (${s.sudo.length})*\n\n${s.sudo.map(n => `• +${n}`).join('\n') || '(empty)'}`);
        break;
      }
      case 'fixowner': { if (!isCreator) { await reply('*❌ ᴏᴡɴᴇʀ / sᴜᴅᴏ ᴏɴʟʏ.*'); break; } await reply(`👑 𝗢𝘄𝗻𝗲𝗿: *${DEV_NAME}*\n📞 𝗕𝗼𝘁: +${(natsu.user?.id || '').split(':')[0]}`); break; }
      case 'getbot': { await reply(`🤖 *${BOT_NAME}* 𝗼𝗻𝗹𝗶𝗻𝗲\nID: ${natsu.user?.id}\n𝗗𝗲𝘃: ${DEV_NAME}`); break; }
      case 'broadcast': {
        if (!isCreator) { await reply('*❌ ᴏᴡɴᴇʀ / sᴜᴅᴏ ᴏɴʟʏ.*'); break; }
        if (!arg) { await reply(`❌ 𝗨𝘀𝗮𝗴𝗲: *${PREFIX}𝗯𝗿𝗼𝗮𝗱𝗰𝗮𝘀𝘁 <msg>*`); break; }
        await reply('📢 𝗕𝗿𝗼𝗮𝗱𝗰𝗮𝘀𝘁𝗶𝗻𝗴...');
        try {
          const chats = await natsu.groupFetchAllParticipating();
          let ok = 0;
          for (const id of Object.keys(chats)) {
            try {
              await natsu.sendMessage(id, {
                text: `📢 *𝗕𝗥𝗢𝗔𝗗𝗖𝗔𝗦𝗧*\n\n${arg}\n\n> ${BOT_NAME}`,
                contextInfo: forwardedContext(),
              });
              ok++;
              await new Promise(r => setTimeout(r, 1200));
            } catch {}
          }
          await reply(`✅ 𝗦𝗲𝗻𝘁 𝘁𝗼 ${ok} 𝗴𝗿𝗼𝘂𝗽𝘀.`);
        } catch (e) { await reply(`❌ ${e.message}`); }
        break;
      }
      case 'prefix': {
        await reply(`🔱 *Prefix principal:* ${getState().prefix || PREFIX}\n📌 *Préfixes acceptés:* ${[getState().prefix || PREFIX, ...PREFIXES.filter(p => p !== (getState().prefix || PREFIX))].join(' ')}`);
        break;
      }
      case 'mode': {
        if (!isCreator) { await reply('*❌ ᴏᴡɴᴇʀ / sᴜᴅᴏ ᴏɴʟʏ.*'); break; } const s = getState(); await reply(`⚙️ 𝗠𝗼𝗱𝗲: *${s.mode}*`); break; }
      case 'test': {
        const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
        await reply(`✅ *KILLUA MD TEST OK*\n\n🟢 Commandes: actives\n⚙️ Mode: ${getState().mode}\n💾 RAM: ${mem} MB\n📡 Chat: ${isGroup(jid) ? 'Groupe' : 'Privé'}`);
        break;
      }
      case 'ping': {
        const start = Date.now();
        await reply(`🏓 *𝗣𝗼𝗻𝗴!* ⚡ ${Date.now() - start}ms`);
        break;
      }
      case 'alive': case 'runtime': case 'uptime': {
        const up = process.uptime();
        const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60), s = Math.floor(up % 60);
        const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        await img(MENU_IMAGE,
`╭━━━〔 ${BOT_NAME} 〕━━━╮

🟢 𝗦𝘁𝗮𝘁𝘂𝘀: 𝗢𝗻𝗹𝗶𝗻𝗲 & 𝗔𝗰𝘁𝗶𝘃𝗲
> ⏱️ 𝗨𝗽𝘁𝗶𝗺𝗲:
➜ ${h}𝗵 ${m}𝗺 ${s}𝘀
> 💾 𝗠𝗲𝗺𝗼𝗿𝘂:
➜ ${mem} 𝗠𝗕
> 👑 𝗗𝗘𝗩 𝗕𝗬 :
➜ ${DEV_NAME}
━━━━━━━━━━━━━━━━━━

╰━━━〔 𝗣𝗨𝗟𝗚𝗔 〕━━━╯`);
        break;
      }

      // ═════════════════════════════════════════════════════════════════════
      // FUN MENU
      // ═════════════════════════════════════════════════════════════════════
      case 'truth': {
        const arr = ['What\'s your biggest secret?','Have you ever lied to your best friend?','What is your worst habit?','Have you ever cheated on a test?','What\'s the most embarrassing thing you\'ve done?'];
        await reply(`💭 *TRUTH*\n\n${RAND(arr)}`); break;
      }
      case 'dare': {
        const arr = ['Send a selfie right now 📸','Sing a song in voice note 🎤','Text your crush a compliment 💌','Do 10 push-ups and record it 💪','Change your bio to "I love bugs 🐛" for 24h'];
        await reply(`🔥 *DARE*\n\n${RAND(arr)}`); break;
      }
      case 'joke': {
        const jokes = [
          ['Pourquoi le développeur aime les pauses ?', 'Parce que son code avait besoin de respirer.'],
          ['Pourquoi le serveur est calme ?', 'Parce qu’il garde toujours son cache.'],
          ['Pourquoi JavaScript ne dort jamais ?', 'Parce qu’il attend toujours une promesse.']
        ];
        const j = RAND(jokes); await reply(`😂 *Joke*\n\n${j[0]}\n— ${j[1]}`); break;
      }
      case 'meme': {
        try { const r = await axios.get('https://meme-api.com/gimme', { timeout: 5000 });
          await img(r.data.url, `😆 ${r.data.title}`); }
        catch { await reply('❌ Meme unavailable.'); }
        break;
      }
      case 'ship': {
        const p = arg.split(/\s+and\s+|\s+&\s+|,\s*/);
        if (p.length < 2) { await reply(`❌ Usage: *${PREFIX}ship NameA and NameB*`); break; }
        await reply(`💞 *SHIP*\n${p[0]} ❤️ ${p[1]}\nCompatibility: *${Math.floor(Math.random() * 100)}%*`);
        break;
      }
      case 'rate': { await reply(`⭐ *RATE*\n${arg || 'You'} → *${Math.floor(Math.random()*10)+1}/10*`); break; }
      case 'flirt': {
        const f = ['Are you Wi-Fi? Because I\'m feeling a connection. 💞','Did it hurt when you fell from heaven? 😇','You must be a magician — every time I look at you, everyone else disappears. ✨'];
        await reply(`💋 *FLIRT*\n\n${RAND(f)}`); break;
      }
      case 'roast': {
        const r = ['You bring everyone so much joy… when you leave the room. 😂','You\'re proof that even God makes mistakes sometimes.','You\'re not stupid; you just have bad luck thinking.'];
        await reply(`🔥 *ROAST* ${arg || ''}\n\n${RAND(r)}`); break;
      }
      case 'compliment': {
        const c = ['You light up every room you enter. ✨','Your smile could power a city. 💖','You\'re the human version of sunshine. ☀️'];
        await reply(`💖 *COMPLIMENT* ${arg || ''}\n\n${RAND(c)}`); break;
      }
      case 'wouldyou': {
        const arr = ['Would you rather fly or read minds?','Would you rather be invisible or super strong?','Would you rather have unlimited money or unlimited time?'];
        await reply(`🤔 *WOULD YOU RATHER*\n\n${RAND(arr)}`); break;
      }
      case '8balladvice': case '8ball': {
        const a = ['Yes, absolutely.','No way.','Ask again later.','Outlook good.','Don\'t count on it.','It is certain.'];
        await reply(`🎱 *8-BALL*\n\n${RAND(a)}`); break;
      }
      case 'urban': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}urban <word>*`); break; }
        try { const r = await axios.get(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(arg)}`, { timeout: 5000 });
          const d = r.data.list?.[0]; if (!d) throw 0;
          await reply(`📕 *URBAN — ${arg}*\n\n${d.definition.replace(/[[\]]/g,'')}\n\n_Ex:_ ${d.example.replace(/[[\]]/g,'')}`); }
        catch { await reply('❌ Not found.'); }
        break;
      }
      case 'moviequote': {
        const q = RAND([
          ['Le Seigneur des anneaux','Même les plus petites personnes peuvent changer le cours de l’avenir.'],
          ['Star Wars','Que la Force soit avec toi.'],
          ['Harry Potter','Ce sont nos choix qui montrent ce que nous sommes vraiment.']
        ]);
        await reply(`🎬 *MOVIE QUOTE*\n\n“${q[1]}”\n— ${q[0]}`); break;
      }
      case 'triviafact': case 'funfact': case 'fact': {
        try { const r = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', { timeout: 5000 });
          await reply(`🧠 *FUN FACT*\n\n${r.data.text}`); }
        catch { await reply('🧠 Octopuses have 3 hearts. 🐙'); }
        break;
      }
      case 'inspire': {
        const q = RAND([
          ['Chaque petite étape compte.','KILLUA MD'],
          ['La constance transforme les idées en résultats.','KILLUA MD'],
          ['Commence petit, améliore chaque jour.','KILLUA MD']
        ]);
        await reply(`✨ *INSPIRE*\n\n“${q[0]}”\n— ${q[1]}`); break;
      }
      case 'ascii': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}ascii <text>*`); break; }
        const clean = arg.replace(/[^\x20-\x7E]/g, '').slice(0, 120);
        await reply('```\n' + clean + '\n```'); break;
      }
      case 'progquote': {
        const q = RAND([
          ['Le code doit être simple à lire et facile à corriger.','KILLUA MD'],
          ['Un bon programme explique ses intentions.','KILLUA MD'],
          ['Teste tôt, corrige vite.','KILLUA MD']
        ]);
        await reply(`💻 *PROG QUOTE*\n\n“${q[0]}”\n— ${q[1]}`); break;
      }
      case 'dadjoke': {
        try { const r = await axios.get('https://icanhazdadjoke.com/', { headers: { Accept: 'application/json' }, timeout: 5000 });
          await reply(`👨 *DAD JOKE*\n\n${r.data.joke}`); }
        catch { await reply('👨 I don\'t trust stairs. They\'re always up to something.'); }
        break;
      }
      case 'paptt': { await reply('🎤 PAPTT — feature coming soon. (Requires ffmpeg pipeline.)'); break; }

      // ═════════════════════════════════════════════════════════════════════
      // GAMES
      // ═════════════════════════════════════════════════════════════════════
      case 'rps': {
        const ch = ['rock','paper','scissors']; const u = arg.toLowerCase(); const b = RAND(ch);
        if (!ch.includes(u)) { await reply(`❌ Usage: *${PREFIX}rps rock|paper|scissors*`); break; }
        const r = u === b ? 'Draw' : ((u==='rock'&&b==='scissors')||(u==='paper'&&b==='rock')||(u==='scissors'&&b==='paper')) ? 'You win!' : 'Bot wins!';
        await reply(`🎮 You: ${u}\n🤖 Bot: ${b}\n→ *${r}*`); break;
      }
      case 'rpsls': {
        const ch = ['rock','paper','scissors','lizard','spock']; const u = arg.toLowerCase(); const b = RAND(ch);
        if (!ch.includes(u)) { await reply(`❌ Usage: *${PREFIX}rpsls <${ch.join('|')}>*`); break; }
        const win = { rock:['scissors','lizard'], paper:['rock','spock'], scissors:['paper','lizard'], lizard:['paper','spock'], spock:['rock','scissors'] };
        const r = u===b ? 'Draw' : win[u].includes(b) ? 'You win!' : 'Bot wins!';
        await reply(`🎮 You: ${u}\n🤖 Bot: ${b}\n→ *${r}*`); break;
      }
      case 'dice': { await reply(`🎲 *DICE*\nResult: *${Math.floor(Math.random()*6)+1}*`); break; }
      case 'coin': case 'coinbattle': { await reply(`🪙 *COIN*\n→ *${RAND(['Heads','Tails'])}*`); break; }
      case 'numberbattle': case 'numbattle': {
        const u = parseInt(arg) || Math.floor(Math.random()*100);
        const b = Math.floor(Math.random()*100);
        await reply(`🔢 You: ${u}\n🤖 Bot: ${b}\n→ *${u>b?'You win!':u<b?'Bot wins!':'Draw'}*`); break;
      }
      case 'hangman': {
        const key = jid;
        if (arg.length === 1) {
          const g = games.hangman.get(key);
          if (!g) { await reply(`❌ Start one first: *${PREFIX}hangman*`); break; }
          if (g.word.includes(arg.toLowerCase())) { g.guessed.add(arg.toLowerCase()); }
          else g.tries--;
          const masked = g.word.split('').map(c => g.guessed.has(c) ? c : '_').join(' ');
          if (!masked.includes('_')) { games.hangman.delete(key); await reply(`🎉 You won! Word: *${g.word}*`); break; }
          if (g.tries <= 0) { games.hangman.delete(key); await reply(`💀 Lost. Word: *${g.word}*`); break; }
          await reply(`🪢 *HANGMAN*\n${masked}\nTries left: ${g.tries}`);
        } else {
          const word = RAND(HANGMAN_WORDS);
          games.hangman.set(key, { word, guessed: new Set(), tries: 6 });
          await reply(`🪢 *HANGMAN started!*\n${'_ '.repeat(word.length).trim()}\nGuess: *${PREFIX}hangman <letter>*`);
        }
        break;
      }
      case 'tictactoe': { await reply('⭕ TicTacToe is being polished — multiplayer board coming soon.'); break; }
      case 'guess': {
        const key = jid;
        if (arg) {
          const g = games.guess.get(key); if (!g) { await reply(`❌ Start: *${PREFIX}guess*`); break; }
          const n = parseInt(arg); if (isNaN(n)) { await reply('❌ Number please.'); break; }
          if (n === g.n) { games.guess.delete(key); await reply(`🎯 Correct! It was *${g.n}*.`); }
          else await reply(n < g.n ? '⬆️ Higher!' : '⬇️ Lower!');
        } else {
          games.guess.set(key, { n: Math.floor(Math.random()*100)+1 });
          await reply(`🎯 *GUESS 1–100*\nReply: *${PREFIX}guess <number>*`);
        }
        break;
      }
      case 'math': {
        const key = jid;
        if (arg) {
          const g = games.math.get(key); if (!g) { await reply(`❌ Start: *${PREFIX}math*`); break; }
          const n = parseFloat(arg); games.math.delete(key);
          await reply(n === g.r ? `🎉 Correct! ${g.q} = ${g.r}` : `❌ Wrong. ${g.q} = ${g.r}`);
        } else {
          const a = Math.floor(Math.random()*20)+1, b = Math.floor(Math.random()*20)+1;
          const op = RAND(['+','-','*']); const r = eval(`${a}${op}${b}`);
          games.math.set(key, { q: `${a}${op}${b}`, r });
          await reply(`🧮 *MATH*\n${a} ${op} ${b} = ?\nReply: *${PREFIX}math <answer>*`);
        }
        break;
      }
      case 'emojiquiz': {
        const arr = [{q:'🍔🍟',a:'fast food'},{q:'🎬🍿',a:'cinema'},{q:'🚗💨',a:'fast & furious'},{q:'👑🐛',a:'queen bug'}];
        const p = RAND(arr); await reply(`🎲 *EMOJI QUIZ*\n${p.q}\n_Answer:_ ||${p.a}||`); break;
      }
      case 'gamefact': { await reply(`🎮 *GAME FACT*\nThe first video game was created in 1958: "Tennis for Two".`); break; }
      case 'toimg': case 'take': case 'steal': case 'wm': case 'qc': {
        await reply(`🖼️ *${cmd.toUpperCase()}* — sticker tooling requires ffmpeg/sharp pipeline. Send a sticker/image as a reply once enabled on your panel.`);
        break;
      }

      // ═════════════════════════════════════════════════════════════════════
      // SOUND MENU (ffmpeg-based — graceful placeholders for now)
      // ═════════════════════════════════════════════════════════════════════
      case 'bass': case 'blown': case 'deep': case 'earrape': case 'fast':
      case 'nightcore': case 'reverse': case 'robot': case 'slow':
      case 'smooth': case 'squirrel': {
        await reply(`🔊 *${cmd.toUpperCase()}*\nReply to an audio. (Requires ffmpeg on Pterodactyl egg — install via \`apt-get install ffmpeg\`.)`);
        break;
      }
      case 'tts': case 'say': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}tts <text>*`); break; }
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(arg)}&tl=en&client=tw-ob`;
        try {
          const r = await axios.get(url, { responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 });
          await natsu.sendMessage(jid, { audio: Buffer.from(r.data), mimetype: 'audio/mpeg', ptt: true, contextInfo: forwardedContext() }, { quoted: msg });
        } catch (e) { await reply(`❌ ${e.message}`); }
        break;
      }

      // ═════════════════════════════════════════════════════════════════════
      // TEMP MAIL MENU
      // ═════════════════════════════════════════════════════════════════════
      case 'newmail': case 'tempmail': case 'tempmail2': {
        try {
          const login = `killua${Math.random().toString(36).slice(2,10)}`;
          const password = `${Math.random().toString(36).slice(2)}K9!`;
          const domains = await axios.get('https://api.mail.tm/domains?page=1', { timeout: 10000 });
          const domain = domains.data?.['hydra:member']?.find(d => d.isActive)?.domain;
          if (!domain) throw new Error('aucun domaine disponible');
          const email = `${login}@${domain}`;
          const acc = await axios.post('https://api.mail.tm/accounts', { address: email, password }, { timeout: 10000 });
          const token = (await axios.post('https://api.mail.tm/token', { address: email, password }, { timeout: 10000 })).data?.token;
          if (!token) throw new Error('token indisponible');
          updateState(s => { s.tempmailByChat ??= {}; s.tempmailByChat[jid] = { email, provider: 'mail.tm', token, accountId: acc.data?.id, password }; s.tempmail = email; });
          await reply(`╭━━〔 📧 *TEMPMAIL* 〕━━╮\n│ ✉️ ${email}\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n◈ ${PREFIX}readmail\n◈ ${PREFIX}deltmp`);
        } catch (e) { await reply(`❌ TempMail indisponible.\n_${e.message}_`); }
        break;
      }
      case 'readmail': case 'inbox': case 'tempmail-inbox': {
        const account = getState().tempmailByChat?.[jid];
        const email = account?.email || getState().tempmail;
        if (!email) { await reply(`❌ Génère d'abord une adresse avec *${PREFIX}newmail*.`); break; }
        try {
          if (account?.provider === 'mail.tm' && account.token) {
            const r = await axios.get('https://api.mail.tm/messages', { headers: { Authorization: `Bearer ${account.token}` }, timeout: 10000 });
            const messages = r.data?.['hydra:member'] || [];
            if (!messages.length) { await reply(`📭 Inbox vide pour *${email}*`); break; }
            let out = `📬 *INBOX — ${email}*\n\n`;
            for (const m of messages.slice(0,5)) out += `📨 *${m.subject || '(sans sujet)'}*\n👤 ${m.from?.address || 'unknown'}\n🆔 ${m.id}\n\n`;
            await reply(out);
          } else {
            await reply(`❌ Cette adresse n'utilise plus un fournisseur compatible. Crée une nouvelle adresse avec *${PREFIX}newmail*.`);
          }
        } catch (e) { await reply(`❌ Impossible de lire l'inbox : ${e.message}`); }
        break;
      }
      case 'deltmp': case 'delmail': {
        const account = getState().tempmailByChat?.[jid];
        try { if (account?.provider === 'mail.tm' && account.accountId && account.token) await axios.delete(`https://api.mail.tm/accounts/${account.accountId}`, { headers: { Authorization: `Bearer ${account.token}` }, timeout: 10000 }); } catch {}
        updateState(s => { if (s.tempmailByChat) delete s.tempmailByChat[jid]; if (s.tempmail && !s.tempmailByChat?.[jid]) delete s.tempmail; });
        await reply('🗑️ *TempMail supprimé pour cette conversation.*');
        break;
      }

      // ═════════════════════════════════════════════════════════════════════
      // OTHER MENU
      // ═════════════════════════════════════════════════════════════════════
      case 'mediastatus': {
        const checks = [];
        try { await execFileAsync('ffmpeg', ['-version'], { timeout: 5000 }); checks.push('🟢 ffmpeg'); } catch { checks.push('🔴 ffmpeg'); }
        try { await execFileAsync('yt-dlp', ['--version'], { timeout: 5000 }); checks.push('🟢 yt-dlp'); } catch { checks.push('🟡 yt-dlp absent — les APIs de secours seront utilisées'); }
        await reply(`🎬 *MEDIA STATUS*\n\n${checks.join('\n')}`); break;
      }
      case 'apistatus': {
        const checks = [
          ['Mail.tm', 'https://api.mail.tm/domains'],
          ['Open-Meteo', 'https://geocoding-api.open-meteo.com/v1/search?name=Kinshasa&count=1'],
          ['Frankfurter', 'https://api.frankfurter.dev/v2/rate/USD/EUR'],
          ['LRCLIB', 'https://lrclib.net/api/search?q=hello'],
          ['Jikan', 'https://api.jikan.moe/v4/anime?q=naruto&limit=1'],
          ['Waifu.pics', 'https://api.waifu.pics/sfw/waifu'],
        ];
        const out = [];
        for (const [name, url] of checks) {
          const t = Date.now();
          try { const r = await axios.get(url, { timeout: 5000 }); out.push(`🟢 ${name} — ${r.status} (${Date.now()-t}ms)`); }
          catch { out.push(`🔴 ${name} — OFFLINE/ERROR`); }
        }
        await reply(`🩺 *API STATUS*\n\n${out.join('\n')}`);
        break;
      }
      case 'weatherwiki': case 'weather': {
        if (!arg) { await reply(`❌ 𝗨𝘀𝗮𝗴𝗲: *${PREFIX}weather <city>*`); break; }
        try {
          const geo = await axios.get('https://geocoding-api.open-meteo.com/v1/search', { params: { name: arg, count: 1, language: 'fr', format: 'json' }, timeout: 7000 });
          const g = geo.data?.results?.[0];
          if (!g) throw new Error('ville introuvable');
          const r = await axios.get('https://api.open-meteo.com/v1/forecast', { params: { latitude: g.latitude, longitude: g.longitude, current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m', timezone: 'auto' }, timeout: 7000 });
          const c = r.data?.current;
          if (!c) throw new Error('météo indisponible');
          const labels = {0:'☀️ Ciel dégagé',1:'🌤️ Principalement dégagé',2:'⛅ Partiellement nuageux',3:'☁️ Couvert',45:'🌫️ Brouillard',48:'🌫️ Brouillard givrant',51:'🌦️ Bruine légère',53:'🌦️ Bruine',55:'🌧️ Bruine forte',61:'🌦️ Pluie légère',63:'🌧️ Pluie',65:'🌧️ Forte pluie',71:'🌨️ Neige légère',73:'🌨️ Neige',75:'❄️ Forte neige',80:'🌦️ Averses',81:'🌧️ Averses',82:'⛈️ Fortes averses',95:'⛈️ Orage',96:'⛈️ Orage + grêle',99:'⛈️ Orage + forte grêle'};
          await reply(`🌍 *${g.name}, ${g.country}*\n${labels[c.weather_code] || '🌡️ Conditions actuelles'}\n🌡️ ${c.temperature_2m}°C (ressenti ${c.apparent_temperature}°C)\n💧 ${c.relative_humidity_2m}% • 💨 ${c.wind_speed_10m} km/h`);
        } catch (e) { await reply(`❌ 𝗪𝗲𝗮𝘁𝗵𝗲𝗿 : ${e.message}`); }
        break;
      }
      case 'currency': {
        const p = arg.split(/\s+/); if (p.length < 3) { await reply(`❌ 𝗨𝘀𝗮𝗴𝗲: *${PREFIX}𝗰𝘂𝗿𝗿𝗲𝗻𝗰𝘆 100 𝗨𝗦𝗗 𝗘𝗨𝗥*`); break; }
        const [amt, from, to] = p;
        try { const r = await axios.get(`https://api.frankfurter.dev/v2/rate/${from.toUpperCase()}/${to.toUpperCase()}`, { timeout: 7000 });
          const v = (parseFloat(amt) * Number(r.data.rate)).toFixed(2);
          await reply(`💱 ${amt} ${from.toUpperCase()} = *${v} ${to.toUpperCase()}*\n📅 ${r.data.date}`); }
        catch (e) { await reply(`❌ 𝗥𝗮𝘁𝗲 𝘂𝗻𝗮𝘃𝗮𝗶𝗹𝗮𝗯𝗹𝗲 : ${e.message}`); }
        break;
      }
      case 'time': {
        const d = new Date();
        await reply(`🕐 ${d.toLocaleString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit', timeZoneName:'short' })}`);
        break;
      }
      case 'qrcode': {
        if (!arg) { await reply(`❌ 𝗨𝘀𝗮𝗴𝗲: *${PREFIX}𝗾𝗿𝗰𝗼𝗱𝗲 <text>*`); break; }
        await img(`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(arg)}`, `📱 𝗤𝗥 𝗳𝗼𝗿: ${arg}`);
        break;
      }
      case 'readqr': { await reply('🔍 𝗥𝗲𝗽𝗹𝘆 𝘁𝗼 𝗮 𝗤𝗥 𝗶𝗺𝗮𝗴𝗲 (feature requires sharp/jimp — coming soon).'); break; }
      case 'shorturl': {
        if (!arg) { await reply(`❌ 𝗨𝘀𝗮𝗴𝗲: *${PREFIX}𝘀𝗵𝗼𝗿𝘁𝘂𝗿𝗹 <url>*`); break; }
        try { const r = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(arg)}`, { timeout: 5000 });
          await reply(`🔗 ${r.data}`); }
        catch { await reply('❌ Error.'); }
        break;
      }
      case 'myip': {
        try { const r = await axios.get('https://api.ipify.org?format=json', { timeout: 5000 });
          await reply(`🌐 𝗕𝗼𝘁 𝗜𝗣: *${r.data.ip}*`); }
        catch { await reply('❌ 𝗘𝗿𝗿𝗼𝗿.'); }
        break;
      }
      case 'iplookup': {
        if (!arg) { await reply(`❌ 𝗨𝘀𝗮𝗴𝗲: *${PREFIX}𝗶𝗽𝗹𝗼𝗼𝗸𝘂𝗽 <ip>*`); break; }
        try { const r = await axios.get(`https://ipapi.co/${arg}/json/`, { timeout: 5000 });
          const d = r.data; await reply(`🌐 *${d.ip}*\n📍 ${d.city}, ${d.region}, ${d.country_name}\n🏢 ${d.org}\n🕐 ${d.timezone}`); }
        catch { await reply('❌ 𝗟𝗼𝗼𝗸𝘂𝗽 𝗳𝗮𝗶𝗹𝗲𝗱.'); }
        break;
      }
      case 'jid': { await reply(`🆔 *𝗖𝗵𝗮𝘁 𝗝𝗜𝗗:* ${jid}\n👤 *𝗦𝗲𝗻𝗱𝗲𝗿:* ${senderJid}`); break; }
      case 'getpp': {
        const tgt = arg.replace(/\D/g, '') ? `${arg.replace(/\D/g,'')}@s.whatsapp.net` : senderJid;
        try { const url = await natsu.profilePictureUrl(tgt, 'image'); await img(url, `📸 PP of +${tgt.split('@')[0]}`); }
        catch { await reply('❌ 𝗡𝗼 𝗽𝗿𝗼𝗳𝗶𝗹𝗲 𝗽𝗶𝗰𝘁𝘂𝗿𝗲 𝗮𝘃𝗮𝗶𝗹𝗮𝗯𝗹𝗲.'); }
        break;
      }
      case 'github': {
        if (!arg) { await reply(`❌ 𝗨𝘀𝗮𝗴𝗲: *${PREFIX}𝗴𝗶𝘁𝗵𝘂𝗯 <user>*`); break; }
        try { const r = await axios.get(`https://api.github.com/users/${arg}`, { timeout: 5000 });
          const u = r.data;
          await img(u.avatar_url, `🐙 *${u.login}*\n${u.name || ''}\n${u.bio || ''}\n👥 Followers: ${u.followers}\n📦 𝗥𝗲𝗽𝗼𝘀: ${u.public_repos}\n🔗 ${u.html_url}`); }
        catch { await reply('❌ 𝗨𝘀𝗲𝗿 𝗻𝗼𝘁 𝗳𝗼𝘂𝗻𝗱.'); }
        break;
      }
      case 'npm': case 'npmstalk': {
        if (!arg) { await reply(`❌ 𝗨𝘀𝗮𝗴𝗲: *${PREFIX}𝗻𝗽𝗺 <package>*`); break; }
        try { const r = await axios.get(`https://registry.npmjs.org/${arg}`, { timeout: 5000 });
          const d = r.data; await reply(`📦 *${d.name}*\n${d.description || ''}\nLatest: ${d['dist-tags']?.latest}\nLi+cense: ${d.license || 'N/A'}\nHome: ${d.homepage || ''}`); }
        catch { await reply('❌ 𝗣𝗮𝗰𝗸𝗮𝗴𝗲 𝗻𝗼𝘁 𝗳𝗼𝘂𝗻𝗱.'); }
        break;
      }
      case 'ffstalk': {
        if (!arg) { await reply(`❌ 𝗨𝘀𝗮𝗴𝗲: *${PREFIX}𝗳𝗳𝘀𝘁𝗮𝗹𝗸 <FreeFireID>*`); break; }
        const d = await tryFetch([`https://api.giftedtech.web.id/api/stalk/ffstalk?apikey=gifted&id=${arg}`]);
        if (!d) { await reply('❌ Stalk failed.'); break; }
        await reply(`🎮 *Free Fire*\n${JSON.stringify(d.result || d, null, 2).slice(0, 1500)}`);
        break;
      }
      case 'imbd': case 'imdb': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}imdb <title>*`); break; }
        const d = await tryFetch([`https://api.giftedtech.web.id/api/search/imdb?apikey=gifted&query=${encodeURIComponent(arg)}`]);
        if (!d) { await reply('❌ Not found.'); break; }
        const r = d.result || d;
        await reply(`🎬 *${r.title || arg}*\n${r.plot || r.description || ''}\n⭐ ${r.rating || ''}\n📅 ${r.year || ''}`);
        break;
      }
      case 'dictionary': case 'dict': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}dict <word>*`); break; }
        try {
          const r = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(arg)}`, { timeout: 5000 });
          const e = r.data[0]; let t = `📖 *${e.word}* ${e.phonetic||''}\n\n`;
          for (const m of e.meanings.slice(0,2)) { t += `*${m.partOfSpeech}*\n• ${m.definitions[0].definition}\n\n`; }
          await reply(t.trim());
        } catch { await reply('❌ Not found.'); }
        break;
      }
      case 'recipe': case 'recipe-ingredient': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}recipe <dish>*`); break; }
        try { const r = await axios.get(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(arg)}`, { timeout: 6000 });
          const m = r.data.meals?.[0]; if (!m) throw 0;
          let ing = ''; for (let i=1;i<=20;i++) { const n=m[`strIngredient${i}`], q=m[`strMeasure${i}`]; if (n) ing+=`• ${q} ${n}\n`; }
          await img(m.strMealThumb, `🍲 *${m.strMeal}*\n📍 ${m.strArea}\n\n*Ingredients:*\n${ing}\n*Instructions:*\n${m.strInstructions.slice(0,800)}...`); }
        catch { await reply('❌ Recipe not found.'); }
        break;
      }
      case 'book': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}book <title>*`); break; }
        try { const r = await axios.get(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(arg)}&maxResults=3`, { timeout: 6000 });
          let t = `📚 *Books — ${arg}*\n\n`;
          for (const b of r.data.items || []) { const v=b.volumeInfo; t += `📖 ${v.title}\n👤 ${(v.authors||[]).join(', ')}\n🔗 ${v.infoLink}\n\n`; }
          await reply(t); }
        catch { await reply('❌ Error.'); }
        break;
      }
      case 'remind': {
        const m = arg.match(/^(\d+)\s+(.+)/);
        if (!m) { await reply(`❌ Usage: *${PREFIX}remind <minutes> <text>*`); break; }
        const [, mins, txt] = m; await reply(`⏰ Reminder set in ${mins} min.`);
        setTimeout(() => sendText(natsu, jid, `⏰ *REMINDER:* ${txt}`, msg), parseInt(mins) * 60000);
        break;
      }
      case 'calculate': case 'calc': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}calc <expr>*`); break; }
        try { const safe = arg.replace(/[^0-9+\-*/().%\s]/g,''); const r = Function(`"use strict"; return (${safe})`)();
          await reply(`🧮 ${safe} = *${r}*`); } catch { await reply('❌ Invalid expression.'); }
        break;
      }
      case 'mathfact': {
        const n = parseInt(arg) || Math.floor(Math.random()*100);
        try { const r = await axios.get(`http://numbersapi.com/${n}/math`, { timeout: 5000 });
          await reply(`🔢 *MATH FACT*\n${r.data}`); }
        catch { await reply('❌ Error.'); }
        break;
      }
      case 'sciencefact': {
        const f = ['Light from the Sun takes 8 minutes to reach Earth.','Bananas are radioactive (a tiny bit).','A teaspoon of neutron star weighs ~6 billion tons.'];
        await reply(`🔬 *SCIENCE FACT*\n${RAND(f)}`); break;
      }
      case 'horoscope': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}horoscope <sign>*`); break; }
        const d = await tryFetch([`https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${arg.toLowerCase()}&day=TODAY`]);
        if (!d) { await reply('❌ Error.'); break; }
        await reply(`🔮 *${arg.toUpperCase()} — TODAY*\n\n${d.description || d.data?.horoscope_data || JSON.stringify(d).slice(0,500)}`);
        break;
      }
      case 'password': case 'genpass': {
        const len = parseInt(arg) || 16;
        const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let p = ''; for (let i=0;i<len;i++) p += c[Math.floor(Math.random()*c.length)];
        await reply(`🔐 *Password*\n\n\`${p}\``); break;
      }
      case 'readmore': { await reply('📜 readmore — use the invisible character \u200E (already supported in long messages).'); break; }
      case 'lidch': case 'idch': { await reply(`📡 Channel JID: ${NEWSLETTER_JID}`); break; }
      case 'react-ch': { await reply('💞 Reactions on channels require channel admin access.'); break; }

      // ═// ═══════════════════════════════════════════════════════════════════════
// 🖼️ IMAGE COMMANDS V3 — KILLUA MD
// Compatible avec fetchAnyImage() + img() existants
// ═══════════════════════════════════════════════════════════════════════

case 'sfw':
case 'moe':
case 'aipic': {

  const sources = [
    'https://api.waifu.pics/sfw/waifu',
    'https://api.waifu.pics/sfw/neko',
    'https://nekos.best/api/v2/neko'
  ];

  try {

    const url = await fetchAnyImage(sources);

    if (!url) {
      await reply(
`╭━━━〔 ❌ *${cmd.toUpperCase()}* 〕━━━╮

Aucune image disponible actuellement.

🔄 Réessaie dans quelques secondes.

╰━━━━━━━━━━━━━━━━━━━━━━╯`
      );
      break;
    }

    await img(
      url,
`╭━━━〔 🖼️ *${cmd.toUpperCase()}* 〕━━━╮

✨ Image trouvée avec succès !

📸 Type : *SFW*
⚡ KILLUA MD

╰━━━━━━━━━━━━━━━━━━━━━━╯`
    );

  } catch (error) {

    console.error(
      `[IMAGE:${cmd.toUpperCase()}]`,
      error?.message || error
    );

    await reply(
`╭━━━〔 ❌ *IMAGE ERROR* 〕━━━╮

Impossible de récupérer l'image.

🔄 Réessaie plus tard.

╰━━━━━━━━━━━━━━━━━━━━━━╯`
    );
  }

  break;
}


// ═══════════════════════════════════════════════════════════════════════
// 🚫 COMMANDES DÉSACTIVÉES
// ═══════════════════════════════════════════════════════════════════════

case 'hentai':
case 'loli': {

  await reply(
`╭━━━〔 🚫 *COMMANDE DÉSACTIVÉE* 〕━━━╮

❌ Cette commande est actuellement indisponible.

🔒 Contenu non disponible sur KILLUA MD.

╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`
  );

  break;
}


// ═══════════════════════════════════════════════════════════════════════
// 👤 🚗 IMAGE CATEGORIES
// ═══════════════════════════════════════════════════════════════════════

case 'chinagirl':
case 'bluearchive':
case 'boypic':
case 'carimage':
case 'random-girl':
case 'hijab-girl':
case 'indonesia-girl':
case 'japan-girl':
case 'korean-girl':
case 'malaysia-girl':
case 'profile-pictures':
case 'tiktokgirl': {

  const imageConfig = {

    chinagirl: {
      prompt: 'adult Chinese woman portrait, elegant fashion, realistic photography, safe for work',
      fallback: [
        'https://api.waifu.pics/sfw/waifu',
        'https://api.waifu.pics/sfw/neko'
      ]
    },

    bluearchive: {
      prompt: 'Blue Archive inspired anime character, blue aesthetic, high quality anime art, safe for work',
      fallback: [
        'https://api.waifu.pics/sfw/waifu',
        'https://nekos.best/api/v2/waifu'
      ]
    },

    boypic: {
      prompt: 'handsome adult anime boy portrait, stylish profile picture, high quality, safe for work',
      fallback: [
        'https://api.waifu.pics/sfw/waifu',
        'https://nekos.best/api/v2/neko'
      ]
    },

    carimage: {
      prompt: 'cinematic luxury sports car photography, realistic, 4k, dramatic lighting',
      fallback: [
        'https://images.unsplash.com/photo-1503376780353-7e6692767b70',
        'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7',
        'https://images.unsplash.com/photo-1503736334956-4c8f8e92946d'
      ]
    },

    'random-girl': {
      prompt: 'adult woman aesthetic portrait, beautiful profile picture, realistic photography, safe for work',
      fallback: [
        'https://api.waifu.pics/sfw/waifu',
        'https://api.waifu.pics/sfw/neko'
      ]
    },

    'hijab-girl': {
      prompt: 'adult woman wearing an elegant hijab, beautiful portrait photography, modest fashion, safe for work',
      fallback: [
        'https://api.waifu.pics/sfw/waifu'
      ]
    },

    'indonesia-girl': {
      prompt: 'adult Indonesian woman portrait, elegant traditional modern fashion, realistic photography, safe for work',
      fallback: [
        'https://api.waifu.pics/sfw/waifu'
      ]
    },

    'japan-girl': {
      prompt: 'adult Japanese woman portrait, elegant Japanese fashion, realistic photography, safe for work',
      fallback: [
        'https://api.waifu.pics/sfw/waifu'
      ]
    },

    'korean-girl': {
      prompt: 'adult Korean woman portrait, Korean fashion style, realistic photography, safe for work',
      fallback: [
        'https://api.waifu.pics/sfw/waifu'
      ]
    },

    'malaysia-girl': {
      prompt: 'adult Malaysian woman portrait, elegant fashion, realistic photography, safe for work',
      fallback: [
        'https://api.waifu.pics/sfw/waifu'
      ]
    },

    'profile-pictures': {
      prompt: 'cool aesthetic profile picture, premium digital art, high quality avatar',
      fallback: [
        'https://api.waifu.pics/sfw/waifu',
        'https://api.waifu.pics/sfw/neko'
      ]
    },

    tiktokgirl: {
      prompt: 'adult woman modern social media profile picture, trendy aesthetic, realistic photography, safe for work',
      fallback: [
        'https://api.waifu.pics/sfw/waifu'
      ]
    }

  };

  try {

    const config = imageConfig[cmd];

    if (!config) {
      await reply(`❌ Catégorie d'image inconnue : *${cmd}*`);
      break;
    }

    let url = null;

    // ───────────────────────────────────────────────────────────────
    // 🚗 CARIMAGE
    // Utilise directement les images réelles
    // ───────────────────────────────────────────────────────────────

    if (cmd === 'carimage') {

      url = config.fallback[
        Math.floor(Math.random() * config.fallback.length)
      ];

    } else {

      // ─────────────────────────────────────────────────────────────
      // 🎨 Tentative génération AI
      // ─────────────────────────────────────────────────────────────

      const aiUrl =
        `https://image.pollinations.ai/prompt/` +
        `${encodeURIComponent(config.prompt)}` +
        `?width=768&height=768&nologo=true`;

      try {

        const response = await axios.get(aiUrl, {
          timeout: 12000,
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        });

        if (response.status >= 200 && response.status < 300) {
          url = aiUrl;
        }

      } catch (aiError) {

        console.warn(
          `[IMAGE-AI:${cmd}]`,
          aiError?.message || aiError
        );

      }

      // ─────────────────────────────────────────────────────────────
      // 🔄 FALLBACK API
      // ─────────────────────────────────────────────────────────────

      if (!url) {
        url = await fetchAnyImage(config.fallback);
      }
    }

    if (!url) {

      await reply(
`╭━━━〔 ❌ *${cmd.toUpperCase()}* 〕━━━╮

Aucune image disponible actuellement.

🔄 Réessaie dans quelques secondes.

╰━━━━━━━━━━━━━━━━━━━━━━╯`
      );

      break;
    }

    // ───────────────────────────────────────────────────────────────
    // 📤 ENVOI IMAGE
    // ───────────────────────────────────────────────────────────────

    await img(
      url,
`╭━━━〔 🖼️ *${cmd.toUpperCase()}* 〕━━━╮

✨ Image disponible !

📌 Catégorie : *${cmd}*
🤖 KILLUA MD

╰━━━━━━━━━━━━━━━━━━━━━━╯`
    );

  } catch (error) {

    console.error(
      `[IMAGE:${cmd.toUpperCase()}]`,
      error?.stack || error?.message || error
    );

    await reply(
`╭━━━〔 ❌ *IMAGE ERROR* 〕━━━╮

Une erreur est survenue
pendant la récupération de l'image.

🔄 Réessaie plus tard.

╰━━━━━━━━━━━━━━━━━━━━━━╯`
    );
  }

  break;
}

      // ═════════════════════════════════════════════════════════════════════
      // PAYMENT MENU
      // ═════════════════════════════════════════════════════════════════════
      case 'visa': case 'bank': {
        const s = getState();
        await reply(`💳 *Account*\n\n${s.account || `Not set. Use *${PREFIX}setaccount <details>*`}`); break;
      }

      // ═════════════════════════════════════════════════════════════════════
      // ANIME
      // ═════════════════════════════════════════════════════════════════════
      case 'achar': {
        const d = await tryFetch([`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(arg||'naruto')}&limit=1`]);
        const c = d?.data?.[0]; if (!c) { await reply('❌ Not found.'); break; }
        await img(c.images?.jpg?.image_url, `🎌 *${c.name}*\n${c.about?.slice(0,800) || ''}`); break;
      }
      case 'aquote': {
        const q = RAND([
          ['Naruto Uzumaki','La persévérance compte plus que le talent quand on continue d’avancer.'],
          ['Edward Elric','Même une petite avancée reste une avancée.'],
          ['Monkey D. Luffy','Je n’abandonne pas ce que j’ai décidé de faire.'],
          ['Tanjiro Kamado','La gentillesse et la détermination peuvent aller ensemble.']
        ]);
        await reply(`💬 *${q[0]}*\n\n“${q[1]}”`); break;
      }
      case 'arecommend': {
        const d = await tryFetch(['https://api.jikan.moe/v4/recommendations/anime']);
        const r = d?.data?.[0]?.entry?.[0]; if (!r) { await reply('❌ Error.'); break; }
        await img(r.images?.jpg?.image_url, `🎌 Recommended: *${r.title}*\n🔗 ${r.url}`); break;
      }
      case 'asearch': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}asearch <anime>*`); break; }
        const d = await tryFetch([`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(arg)}&limit=1`]);
        const a = d?.data?.[0]; if (!a) { await reply('❌ Not found.'); break; }
        await img(a.images?.jpg?.image_url, `🎌 *${a.title}*\n⭐ ${a.score}\n📅 ${a.year}\n📺 ${a.episodes} ep\n\n${a.synopsis?.slice(0,600)}`);
        break;
      }
      case 'maid': case 'megumin': case 'neko': case 'shinobu': case 'waifu': {
        const url = await fetchAnyImage([
          `https://api.waifu.pics/sfw/${cmd}`,
          `https://nekos.best/api/v2/${cmd}`,
          `https://image.pollinations.ai/prompt/${encodeURIComponent(`safe for work ${cmd} anime character`)}?width=768&height=768&nologo=true`
        ]);
        if (url) await img(url, `🌸 *${cmd.toUpperCase()}*`); else await reply('❌ Anime indisponible, réessaie.');
        break;
      }

      // ═════════════════════════════════════════════════════════════════════
      // CONVERTER
      // ═════════════════════════════════════════════════════════════════════
      case 'telegraph': { await reply('📝 Telegraph upload requires reply to image/text (will be enabled with multipart upload pipeline).'); break; }
      case 'url': {
        const q = quotedMsg(msg);
        const imageMessage = q?.quoted?.imageMessage;
        if (!imageMessage) {
          await reply(`❌ Réponds à une image avec *${PREFIX}url*.`);
          break;
        }
        try {
          await reply('⏳ Upload de l’image en cours…');
          const buffer = await getQuotedImageBuffer(msg);
          const result = await uploadImageUrl(buffer, `killua-${Date.now()}.jpg`);
          await reply(
            `╭━━〔 🖼️ *IMAGE UPLOADED* 〕━━╮\n` +
            `│ 📦 Size: ${(buffer.length / 1024).toFixed(2)} KB\n` +
            `│ ☁️ Host: ${result.provider}\n` +
            `│ 🔗 URL: ${result.url}\n` +
            `╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +
            `📋 Copie le lien ci-dessus.`
          );
        } catch (e) {
          await reply(`❌ Upload échoué.\n_${e?.message || e}_`);
        }
        break;
      }

      // ═════════════════════════════════════════════════════════════════════
      // DOWNLOADER
      // ═════════════════════════════════════════════════════════════════════
      // Resolve a search query to a YouTube URL, then convert it to MP3.
      // Several public search mirrors are tried because free endpoints can
      // temporarily disappear. Direct YouTube URLs skip the search step.
      async function resolveYouTubeUrl(query) {
        if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(query)) return query;
        const instances = [
          'https://pipedapi.adminforge.de',
          'https://pipedapi.kavin.rocks',
          'https://pipedapi.reallyaweso.me',
        ];
        for (const base of instances) {
          try {
            const r = await axios.get(`${base}/search`, {
              params: { q: query, filter: 'videos' }, timeout: 7000,
              headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const item = (r.data?.items || []).find(x => x?.url?.includes('/watch?v='));
            if (item?.url) return item.url.startsWith('http') ? item.url : `https://www.youtube.com${item.url}`;
          } catch {}
        }
        // Last search fallback: YouTube result HTML. We only extract the first video ID.
        try {
          const r = await axios.get('https://www.youtube.com/results', {
            params: { search_query: query }, timeout: 9000,
            headers: { 'User-Agent': 'Mozilla/5.0' },
            responseType: 'text', transformResponse: [(d) => d]
          });
          const html = String(r.data || '');
          const m = html.match(/\"videoId\":\"([A-Za-z0-9_-]{11})\"/);
          if (m?.[1]) return `https://www.youtube.com/watch?v=${m[1]}`;
        } catch {}
        return null;
      }

      async function youtubeMp3Local(url) {
        try {
          const { stdout } = await execFileAsync('yt-dlp', ['--no-playlist','--no-warnings','-x','--audio-format','mp3','--audio-quality','128K','-o','-','--',url], { maxBuffer: 40 * 1024 * 1024, timeout: 90000 });
          const buf = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout, 'binary');
          if (buf.length < 4096) throw new Error('audio local vide');
          return { buffer: buf, title: 'audio' };
        } catch { return null; }
      }

      async function youtubeMp3(url) {
        const candidates = [
          async () => {
            const body = new URLSearchParams({ youtube_url: url, quality: '192' });
            const r = await axios.post('https://ytmp3.ge/api/convert', body.toString(), {
              timeout: 30000,
              headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
            });
            if (r.data?.success && r.data?.downloadUrl) return r.data;
            throw new Error('converter returned no URL');
          },
          async () => {
            for (const host of ['api.giftedtech.my.id', 'api.giftedtech.web.id']) {
              try {
                const r = await axios.get(`https://${host}/api/download/dlmp3`, {
                  params: { apikey: 'gifted', url }, timeout: 20000,
                  headers: { 'User-Agent': 'Mozilla/5.0' },
                });
                const d = r.data?.result || r.data;
                const downloadUrl = d?.download_url || d?.dl_url || d?.url || d?.audio;
                if (downloadUrl) return { downloadUrl, title: d?.title || d?.name || '' };
              } catch {}
            }
            throw new Error('all converters failed');
          }
        ];
        try { return await Promise.any(candidates.map(fn => fn())); } catch { return null; }
      }

      async function downloadMediaBuffer(url, maxBytes = 35 * 1024 * 1024) {
        const r = await axios.get(url, {
          responseType: 'arraybuffer', timeout: 60000,
          maxContentLength: maxBytes, maxBodyLength: maxBytes,
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' },
        });
        const buf = Buffer.from(r.data);
        if (!buf.length) throw new Error('fichier vide');
        if (buf.length > maxBytes) throw new Error('fichier trop volumineux');
        return buf;
      }

      case 'apk': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}apk <app name>*`); break; }
        const d = await tryFetch([`https://api.giftedtech.web.id/api/download/apkdl?apikey=gifted&appName=${encodeURIComponent(arg)}`]);
        const r = d?.result; if (!r?.dllink) { await reply('❌ Not found.'); break; }
        await reply(`📲 *${r.name}*\n📦 ${r.size}\n🔗 ${r.dllink}`); break;
      }
      case 'fb': case 'facebook': case 'insta': case 'instagram': case 'pint': case 'mp4': case 'video':
      case 'download': case 'yta': case 'ytv': case 'ytmp3': case 'yt': case 'play': case 'song': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}${cmd} <url or query>*`); break; }
        await reply(`⏳ Downloading via *${cmd}*...`);
        const endpoints = {
          fb:    [`https://api.giftedtech.web.id/api/download/facebook?apikey=gifted&url=${encodeURIComponent(arg)}`, `https://api.giftedtech.my.id/api/download/facebook?apikey=gifted&url=${encodeURIComponent(arg)}`],
          insta: [`https://api.giftedtech.web.id/api/download/instagram?apikey=gifted&url=${encodeURIComponent(arg)}`, `https://api.giftedtech.my.id/api/download/instagram?apikey=gifted&url=${encodeURIComponent(arg)}`],
          pint:  [`https://api.giftedtech.web.id/api/download/pinterestdl?apikey=gifted&url=${encodeURIComponent(arg)}`, `https://api.giftedtech.my.id/api/download/pinterestdl?apikey=gifted&url=${encodeURIComponent(arg)}`],
          mp4:   [`https://api.giftedtech.web.id/api/download/ytmp4?apikey=gifted&url=${encodeURIComponent(arg)}`, `https://api.giftedtech.my.id/api/download/ytmp4?apikey=gifted&url=${encodeURIComponent(arg)}`],
          video: [`https://api.giftedtech.web.id/api/download/ytmp4?apikey=gifted&url=${encodeURIComponent(arg)}`, `https://api.giftedtech.my.id/api/download/ytmp4?apikey=gifted&url=${encodeURIComponent(arg)}`],
          ytv:   [`https://api.giftedtech.web.id/api/download/ytmp4?apikey=gifted&url=${encodeURIComponent(arg)}`, `https://api.giftedtech.my.id/api/download/ytmp4?apikey=gifted&url=${encodeURIComponent(arg)}`],
          yt:    [`https://api.giftedtech.web.id/api/download/ytmp4?apikey=gifted&url=${encodeURIComponent(arg)}`, `https://api.giftedtech.my.id/api/download/ytmp4?apikey=gifted&url=${encodeURIComponent(arg)}`],
          yta:   [`https://api.giftedtech.web.id/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(arg)}`, `https://api.giftedtech.my.id/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(arg)}`],
          ytmp3: [`https://api.giftedtech.web.id/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(arg)}`, `https://api.giftedtech.my.id/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(arg)}`],
        };

        let r = null;
        let url = null;
        const downloadCmd = cmd === 'facebook' ? 'fb' : (cmd === 'instagram' ? 'insta' : (cmd === 'download' ? 'song' : cmd));
        let localAudio = null;
        if (['download', 'play', 'song'].includes(cmd)) {
          const ytUrl = await resolveYouTubeUrl(arg);
          if (ytUrl) {
            localAudio = await youtubeMp3Local(ytUrl);
            if (!localAudio) {
              const mp3 = await youtubeMp3(ytUrl);
              r = mp3;
              url = mp3?.downloadUrl;
            } else { r = { title: localAudio.title }; }
          }
        } else {
          const d = await tryFetch(endpoints[downloadCmd] || []);
          r = d?.result || d;
          url = r?.download_url || r?.dl_url || r?.url || r?.audio || r?.video || r?.[0]?.url;
        }
        if (!url) { await reply(`❌ *${cmd}* indisponible pour le moment.\n\nVérifie le lien/nom puis réessaie dans quelques secondes.`); break; }
        const isAudio = ['download','yta','ytmp3','play','song'].includes(cmd);
        try {
          if (isAudio) {
            // Prefer the real local yt-dlp bytes; otherwise download the converter URL.
            const audioBuf = localAudio?.buffer || await downloadMediaBuffer(url);
            await natsu.sendMessage(jid, { audio: audioBuf, mimetype: 'audio/mpeg', ptt: false, fileName: `${(r?.title || 'audio').replace(/[^a-z0-9_-]+/gi,'_').slice(0,60)}.mp3`, contextInfo: forwardedContext() }, { quoted: msg });
          }
          else await natsu.sendMessage(jid, { video: { url }, caption: `🎬 ${r.title || ''}`, contextInfo: forwardedContext() }, { quoted: msg });
        } catch (e) { await reply(`🔗 ${url}\n(direct send failed: ${e.message})`); }
        break;
      }
      case 'git': case 'github-dl': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}git <user/repo>*`); break; }
        await reply(`📦 ZIP: https://github.com/${arg}/archive/refs/heads/main.zip`); break;
      }
      case 'gitclone': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}gitclone <repo url>*`); break; }
        const m = arg.match(/github\.com\/([^/]+\/[^/]+)/);
        if (!m) { await reply('❌ Invalid github URL.'); break; }
        const zip = `https://github.com/${m[1].replace(/\.git$/,'')}/archive/refs/heads/main.zip`;
        try { await natsu.sendMessage(jid, { document: { url: zip }, fileName: `${m[1].split('/').pop()}.zip`, mimetype: 'application/zip', contextInfo: forwardedContext() }, { quoted: msg }); }
        catch { await reply(`🔗 ${zip}`); }
        break;
      }
      case 'mega': {
        if (!arg) { await reply(`❌ Usage: ${PREFIX}mega <url>`); break; }
        await reply(`🔗 *MEGA*\n${arg}\n\nLe lien a été reçu. Le téléchargement direct dépend du fournisseur de lien.`);
        break;
      }
      case 'edit': {
        await reply(`🛠️ *EDIT*\nRéponds à une image/vidéo puis utilise ${PREFIX}sticker pour les images. Les effets audio/vidéo nécessitent ffmpeg sur le serveur.`);
        break;
      }

      // ═════════════════════════════════════════════════════════════════════
      // EXISTING LIGHTWEIGHT COMMANDS KEPT
      // ═════════════════════════════════════════════════════════════════════
      case 'info': {
        const up = process.uptime(); const h = Math.floor(up/3600), m = Math.floor((up%3600)/60);
        await img(MENU_IMAGE,
`ℹ️ *${BOT_NAME} ɪɴғᴏ*
🛠️ ʟɪʙʀᴀʀʏ: ʙᴀɪʟᴇʏs + ᴛᴇʟᴇɢʀᴀғ
📞 ᴘᴀɪʀɪɴɢ ᴄᴏᴅᴇ (8 digits)
🟢 ᴀᴄᴛɪᴠᴇ • ⏱️ ${h}h ${m}m
👑 ᴅᴇᴠ: ${DEV_NAME}`);
        break;
      }
      case 'cat': {
        try { const r = await axios.get('https://api.thecatapi.com/v1/images/search', { timeout: 5000 });
          await img(r.data[0].url, '🐱 Cute cat!'); } catch { await reply('❌'); } break;
      }
      case 'dog': {
        try { const r = await axios.get('https://dog.ceo/api/breeds/image/random', { timeout: 5000 });
          await img(r.data.message, '🐶 Cute dog!'); } catch { await reply('❌'); } break;
      }
      case 'crypto': {
        const coin = (arg || 'bitcoin').toLowerCase();
        try { const r = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
          params: { ids: coin, vs_currencies: 'usd,eur', include_24hr_change: true }, timeout: 5000 });
          const d = r.data[coin]; if (!d) throw 0;
          await reply(`💰 *${coin.toUpperCase()}*\n💵 $${d.usd}\n💶 €${d.eur}\n📈 24h: ${Number(d.usd_24h_change).toFixed(2)}%`);
        } catch { await reply('❌'); } break;
      }

      // ═════════════════════════════════════════════════════════════════════
      // OWNER / INFO
      // ═════════════════════════════════════════════════════════════════════
      case 'owner': {
        try {
          const vcard =
`BEGIN:VCARD
VERSION:3.0
FN:${OWNER_NAME}
TEL;type=CELL;type=VOICE;waid=${OWNER_NUMBER}:+${OWNER_NUMBER}
END:VCARD`;
          await natsu.sendMessage(jid, {
            contacts: { displayName: OWNER_NAME, contacts: [{ vcard }] },
            contextInfo: forwardedContext(),
          }, { quoted: msg });
        } catch {}
        await img(RAND(MENU_IMAGES),
`👑 *ᴏᴡɴᴇʀ — ${OWNER_NAME}*
📞 +${ownerDisplay}
💬 *ᴡʜᴀᴛsᴀᴘᴘ : ${OWNER_WA}*
✈️ *ᴛᴇʟᴇɢʀᴀᴍ : ${OWNER_TG}*
🐙 *ɢɪᴛʜᴜʙ   : ${OWNER_GITHUB}*

🤖 *${BOT_NAME}* ${BOT_VERSION}
> ᴅᴇᴠ: ${DEV_NAME}`);
        break;
      }
      case 'repo': {
        await reply(`📦 *${BOT_NAME}* ${BOT_VERSION}\n🔗 ${REPO_URL}\n👑 ${DEV_NAME}`);
        break;
      }
      case 'setprefix': {
        if (!isCreator) { await reply('*❌ ᴏᴡɴᴇʀ / sᴜᴅᴏ ᴏɴʟʏ.*'); break; }
        if (!msg.key.fromMe && !state.sudo.includes(senderNum)) { await reply('❌ Owner/sudo only.'); break; }
        const np = (arg || '').trim()[0];
        if (!np) { await reply(`❌ Usage: *${PREFIX}setprefix <char>*`); break; }
        updateState(s => { s.prefix = np; });
        await reply(`✅ Préfixe principal mis à *${np}* (les autres préfixes restent actifs : ${PREFIXES.join(' ')}).`);
        break;
      }
      case 'restart': {
        if (!isCreator) { await reply('*❌ ᴏᴡɴᴇʀ / sᴜᴅᴏ ᴏɴʟʏ.*'); break; }
        if (!msg.key.fromMe && !state.sudo.includes(senderNum)) { await reply('❌ Owner/sudo only.'); break; }
        await reply('♻️ Restart…');
        setTimeout(() => process.exit(0), 800);
        break;
      }
      case 'eval': {
        if (!isCreator) { await reply('*❌ ᴏᴡɴᴇʀ / sᴜᴅᴏ ᴏɴʟʏ.*'); break; }
        if (!msg.key.fromMe) { await reply('❌ Owner only.'); break; }
        if (!arg) { await reply(`❌ Usage: *${PREFIX}eval <code>*`); break; }
        try {
          // eslint-disable-next-line no-eval
          let out = await eval(`(async()=>{ ${arg.includes('return')?arg:'return '+arg} })()`);
          if (typeof out !== 'string') out = JSON.stringify(out, null, 2);
          await reply(`📤 ${String(out).slice(0, 3500)}`);
        } catch (e) { await reply(`❌ ${e.message}`); }
        break;
      }
      // ═════════════════════════════════════════════════════════════════════
      // GROUP — tagadmins / warn system
      // ═════════════════════════════════════════════════════════════════════
      case 'tagadmins': {
        const info = await requireGroupMember(natsu, jid, reply);
        if (!info) break;
        const { admins } = await getGroupAdmins(natsu, jid);
        if (!admins.length) { await reply('❌ No admins.'); break; }
        const txt = `👮 *ADMINS*\n\n${admins.map(a => `• @${a.split('@')[0]}`).join('\n')}\n\n${arg || ''}`;
        await natsu.sendMessage(jid, { text: txt, mentions: admins, contextInfo: forwardedContext() }, { quoted: msg });
        break;
      }
      case 'warn': {
        const info = await requireGroupAdmin(natsu, jid, msg, senderJid, reply);
        if (!info) break;
        const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                    || msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (!target) { await reply(`❌ Usage : reply or @mention.`); break; }
        let kicked = false;
        updateState(s => {
          s.warns[jid] ??= {};
          s.warns[jid][target] = (s.warns[jid][target] || 0) + 1;
          if (s.warns[jid][target] >= 3) { kicked = true; delete s.warns[jid][target]; }
        });
        if (kicked) {
          try { await natsu.groupParticipantsUpdate(jid, [target], 'remove'); } catch {}
          await natsu.sendMessage(jid, { text: `⛔ @${target.split('@')[0]} kické (3/3 warns).`, mentions: [target], contextInfo: forwardedContext() });
        } else {
          const c = getState().warns[jid][target];
          await natsu.sendMessage(jid, { text: `⚠️ @${target.split('@')[0]} averti (${c}/3). ${arg || ''}`, mentions: [target], contextInfo: forwardedContext() }, { quoted: msg });
        }
        break;
      }
      case 'warns': {
        if (!isGroup(jid)) { await reply('❌ Group only.'); break; }
        const w = getState().warns[jid] || {};
        const entries = Object.entries(w);
        if (!entries.length) { await reply('✅ Aucun warn dans ce groupe.'); break; }
        const txt = `⚠️ *WARNS*\n\n${entries.map(([u,c]) => `• @${u.split('@')[0]} → ${c}/3`).join('\n')}`;
        await natsu.sendMessage(jid, { text: txt, mentions: entries.map(([u]) => u), contextInfo: forwardedContext() });
        break;
      }
      case 'resetwarn': {
        const info = await requireGroupAdmin(natsu, jid, msg, senderJid, reply);
        if (!info) break;
        const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        updateState(s => {
          if (target) { if (s.warns[jid]) delete s.warns[jid][target]; }
          else { s.warns[jid] = {}; }
        });
        await reply(`✅ Warns reset${target ? ` pour @${target.split('@')[0]}` : ''}.`);
        break;
      }

      // ═════════════════════════════════════════════════════════════════════
      // AFK
      // ═════════════════════════════════════════════════════════════════════
      case 'afk': {
        updateState(s => { s.afks[senderJid] = { reason: arg || 'pas de raison', since: Date.now() }; });
        await reply(`💤 @${senderNum} est maintenant AFK : *${arg || 'pas de raison'}*`);
        break;
      }

      // ═════════════════════════════════════════════════════════════════════
      // UTILS — translate / lyrics / removebg / upscale / savestatus / sticker
      // ═════════════════════════════════════════════════════════════════════
      case 'translate': case 'trans': {
        const m = arg.match(/^([a-z]{2})\s+(.+)/i);
        if (!m) { await reply(`❌ Usage: *${PREFIX}translate <lang> <texte>* (ex: fr Hello)`); break; }
        const [, lang, txt] = m;
        const d = await tryFetch([`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(txt)}`]);
        const translated = Array.isArray(d) ? d[0]?.map(x => x?.[0]).filter(Boolean).join('') : '';
        await reply(translated ? `🌐 (${lang}) ${translated}` : '❌ Échec.')
        break;
      }
      case 'lyrics': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}lyrics <titre>*`); break; }
        try {
          const r = await axios.get('https://lrclib.net/api/search', { params: { q: arg }, headers: { 'User-Agent': 'KILLUA-MD/1.0 (WhatsApp bot)' }, timeout: 9000 });
          const d = r.data?.find(x => x?.plainLyrics && !x.instrumental) || r.data?.[0];
          if (!d?.plainLyrics) throw new Error('paroles introuvables');
          await reply(`🎵 *${d.trackName || arg}* — ${d.artistName || 'Unknown'}\n\n${String(d.plainLyrics).slice(0, 3500)}`);
        } catch (e) { await reply(`❌ Lyrics : ${e.message}`); }
        break;
      }
      case 'removebg': case 'rmbg': {
        const q = quotedMsg(msg);
        if (!q?.quoted?.imageMessage) {
          await reply(`❌ Réponds à une image avec *${PREFIX}rmbg*.`);
          break;
        }
        try {
          await reply('⏳ Suppression du fond en cours…');
          const buffer = await getQuotedImageBuffer(msg);
          const output = await removeImageBackground(buffer);
          await natsu.sendMessage(jid, {
            image: output,
            mimetype: 'image/png',
            caption: '✨ *BACKGROUND REMOVED*\n🖼️ Image PNG avec fond transparent.\n© KILLUA MD',
            contextInfo: forwardedContext(),
          }, { quoted: msg });
        } catch (e) {
          await reply(`❌ rmbg échoué.\n_${e?.message || e}_`);
        }
        break;
      }
      case 'upscale': {
        const q = quotedMsg(msg);
        if (!q?.quoted?.imageMessage) { await reply('❌ Réponds à une image.'); break; }
        await reply('🔍 Upscale en cours — endpoint upscale activé une fois l\'upload media branché.');
        break;
      }
      case 'savestatus': {
        const q = quotedMsg(msg);
        if (!q?.quoted) { await reply('❌ Réponds à un statut.'); break; }
        try {
          await natsu.sendMessage(jid, { forward: { key: { remoteJid: 'status@broadcast', participant: q.participant }, message: q.quoted } }, { quoted: msg });
        } catch (e) { await reply(`❌ ${e.message}`); }
        break;
      }
      case 'sticker': case 'stiker': {
        const q = quotedMsg(msg);
        const im = q?.quoted?.imageMessage;
        if (!im) { await reply(`❌ Réponds à une image avec *${PREFIX}sticker*.`); break; }
        try {
          const { downloadContentFromMessage } = await import('@whiskeysockets/baileys');
          const sharp = (await import('sharp')).default;
          const stream = await downloadContentFromMessage(im, 'image');
          const chunks = [];
          for await (const chunk of stream) chunks.push(chunk);
          const input = Buffer.concat(chunks);
          const webp = await sharp(input)
            .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .webp({ quality: 85 })
            .toBuffer();
          await natsu.sendMessage(jid, { sticker: webp }, { quoted: msg });
        } catch (e) {
          console.error('sticker error:', e);
          await reply(`❌ Sticker impossible: ${e?.message || e}`);
        }
        break;
      }

      // ═════════════════════════════════════════════════════════════════════
      // DOWNLOADER additions
      // ═════════════════════════════════════════════════════════════════════
      case 'tiktok': case 'tt': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}tiktok <url>*`); break; }
        await reply('⏳ TikTok…');
        const d = await tryFetch([
          `https://api.giftedtech.web.id/api/download/tiktokdl?apikey=gifted&url=${encodeURIComponent(arg)}`,
          `https://api.dreaded.site/api/tiktok?url=${encodeURIComponent(arg)}`,
          `https://api.bk9.dev/download/tiktok?url=${encodeURIComponent(text)}`,
        ]);
        const r = d?.result || d?.tiktok || d;
        const url = r?.video || r?.no_watermark || r?.download_url || r?.url;
        if (!url) { await reply('❌ Échec.'); break; }
        try { await natsu.sendMessage(jid, { video: { url }, caption: `🎵 ${r?.title || 'TikTok'}`, contextInfo: forwardedContext() }, { quoted: msg }); }
        catch { await reply(`🔗 ${url}`); }
        break;
      }
      case 'spotify': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}spotify <titre ou url>*`); break; }
        const d = await tryFetch([`https://api.giftedtech.web.id/api/download/spotifydl?apikey=gifted&url=${encodeURIComponent(arg)}`,
                                  `https://api.giftedtech.web.id/api/search/spotify?apikey=gifted&query=${encodeURIComponent(arg)}`]);
        const r = d?.result || d;
        const url = r?.download_url || r?.audio || r?.url || r?.[0]?.url;
        if (!url) { await reply('❌ Échec Spotify.'); break; }
        try { await natsu.sendMessage(jid, { audio: { url }, mimetype: 'audio/mpeg', contextInfo: forwardedContext() }, { quoted: msg }); }
        catch { await reply(`🔗 ${url}`); }
        break;
      }

      // ─────────────────────────────────────────────────────────────────────
      default:
        // silent — unknown command
        break;
    }
  } catch (err) {
    console.error(`[cmd ${cmd}]`, err?.message || err);
    try { await reply(`❌ Error: ${err.message || 'unknown'}`); } catch {}
  }
}
