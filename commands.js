

import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
export const PREFIXES = ['.', '/', '!', '#', ',', '+'];
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
export const BOT_VERSION   = 'V1.0';

export const WA_CHANNELS = [
  'https://whatsapp.com/channel/0029VbCHB1eDjiOUGG4OCS2t',
  
];

export const WA_GROUPS = [
  '*https://chat.whatsapp.com/Ht2NmJr9DoC0RyrnKvS5w*',
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
  s.antilink   ??= true;   // groupJid -> true/false
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
  s.autotyping ??= true;
  s.autoviewsts ??= true;
  s.autoreact  ??= false;
  s.welcome    ??= {};   // groupJid -> true/false
  s.goodbye    ??= {};   // groupJid -> true/false
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
const GROUP_META_TTL = 60 * 1000;

async function getGroupAdmins(natsu, jid) {
  try {
    const now = Date.now();
    const cached = _groupMetaCache.get(jid);
    let meta;
    if (cached && cached.exp > now) {
      meta = cached.meta;
    } else {
      meta = await natsu.groupMetadata(jid);
      _groupMetaCache.set(jid, { meta, exp: now + GROUP_META_TTL });
    }
    const admins = meta.participants.filter(p => p.admin).map(p => p.id);
    const rawId = natsu.user?.id || '';
    const lidId = natsu.user?.lid || '';
    const botPhone = rawId.split(':')[0].split('@')[0];
    const botJid = botPhone ? `${botPhone}@s.whatsapp.net` : '';
    const botLid = lidId ? lidId.split(':')[0].split('@')[0] + '@lid' : '';
    const botIsAdmin =
      admins.includes(botJid) ||
      (botLid && admins.includes(botLid)) ||
      meta.participants.some(p => p.admin && (p.id === botJid || p.id === botLid));
    return { meta, admins, botIsAdmin, botJid };
  } catch { return { meta: null, admins: [], botIsAdmin: false, botJid: '' }; }
}

// Invalidate cache when a group changes
export function invalidateGroupCache(jid) { _groupMetaCache.delete(jid); }

// Check if a given JID is a group admin (handles both regular & LID format)
function isGroupAdmin(adminsList, userJid) {
  if (!userJid) return false;
  const phone = userJid.split('@')[0].split(':')[0];
  return adminsList.some(a => {
    const aPhone = a.split('@')[0].split(':')[0];
    return a === userJid || aPhone === phone;
  });
}

function sender(msg) {
  return msg.key.participant || msg.key.remoteJid;
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
  const info = await getGroupAdmins(natsu, jid);
  if (!info.meta) { await reply('*❌ ɪᴍᴘᴏssɪʙʟᴇ ᴅᴇ ʟɪʀᴇ ʟᴇ ɢʀᴏᴜᴘᴇ.*'); return null; }
  if (!info.botIsAdmin) { await reply('*❌ ʟᴇ ʙᴏᴛ ᴅᴏɪᴛ ᴇ̂ᴛʀᴇ ᴀᴅᴍɪɴ.*'); return null; }
  if (!msg.key?.fromMe && !isGroupAdmin(info.admins, senderJid)) { await reply('*❌ ᴀᴅᴍɪɴs ᴏɴʟʏ.*'); return null; }
  return info;
}

function quotedMsg(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  return ctx?.quotedMessage ? { quoted: ctx.quotedMessage, participant: ctx.participant } : null;
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
  const urls = [
    `https://text.pollinations.ai/${q}?model=${m}`,
    `https://text.pollinations.ai/${q}`,
    `https://api.dreaded.site/api/chatgpt?text=${q}`,
  ];
  const parse = (d) => {
    if (typeof d === 'string' && d.trim().startsWith('{')) {
      try { d = JSON.parse(d); } catch {}
    }
    return (typeof d === 'string')
      ? d
      : (d?.BK9 || d?.result || d?.response || d?.data?.response || d?.data?.message ||
         d?.message || d?.answer || d?.gpt4 || d?.result?.prompt || null);
  };
  const call = (u) => axios.get(u, { timeout: 6000, responseType: 'text', transformResponse: [(d) => d] })
    .then(r => parse(r.data)).then(a => a && String(a).trim() ? String(a).trim() : Promise.reject('empty'));
  try {
    return await Promise.any(urls.slice(0, 2).map(call));
  } catch {}
  for (const u of urls.slice(2)) {
    try { const a = await call(u); if (a) return a; } catch {}
  }
  return `🐐 *${model.toUpperCase()}* ᴇsᴛ ᴇɴ ᴘᴀᴜsᴇ. ʀéᴇssᴀɪᴇ ᴅᴀɴs ᴜɴ ɪɴsᴛᴀɴᴛ.`;
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
        (Array.isArray(d?.images) && d.images[0]) ||
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
    cmds: ['menu','help','list','ping','alive','runtime','prefix','test','botstatus','owner','repo']
  },
  '🧠 ᴀɪ & ᴄʜᴀᴛ': {
    emoji: '🧠',
    cmds: ['ai','gpt','gpt4','gpt5','gemini','deepseek','qwen','grok-ai','metaai','codeai','photoai','storyai','triviaai']
  },
  '👥 ɢʀᴏᴜᴘᴇ & ᴀᴅᴍɪɴ': {
    emoji: '👥',
    cmds: ['welcome','goodbye','groupinfo','members','tagall','hidetag','tagadmins','listadmins','promote','demote','add','kick','mute','unmute','grouplink','resetlink','closegc','opengc','antilink','warn','warns','resetwarn','left']
  },
  '👑 ᴏᴡɴᴇʀ & sʏsᴛᴇᴍ': {
    emoji: '👑',
    cmds: ['self','public','mode','setprefix','setpp','restart','eval','ban','unban','block','unblock','delete','addsudo','delsudo','listsudo','fixowner','getbot','broadcast','autoread','autobio','autorecording','autotyping','autoviewstatus','autoreact']
  },
  '📥 ᴛᴇ́ʟᴇ́ᴄʜᴀʀɢᴇᴍᴇɴᴛ': {
    emoji: '📥',
    cmds: ['play','song','yt','yta','ytmp3','ytv','tiktok','instagram','insta','facebook','fb','spotify','video','mp4','apk','git','gitclone','mega','pint','edit']
  },
  '🛠️ ᴏᴜᴛɪʟs & ᴜᴛɪʟɪᴛᴀɪʀᴇs': {
    emoji: '🛠️',
    cmds: ['weatherwiki','currency','time','qrcode','readqr','shorturl','myip','iplookup','jid','getpp','github','npm','dictionary','recipe','book','remind','calculate','mathfact','sciencefact','translate','lyrics','afk','removebg','upscale','savestatus','react-ch']
  },
  '🕵️ ᴛʀᴀᴄᴋ & ɪɴғᴏ': {
    emoji: '🕵️',
    cmds: ['ffstalk','npmstalk','github','lidch','listonline','vcf']
  },
  '🎨 ᴍᴇ́ᴅɪᴀ & ᴄᴏɴᴠᴇʀᴛɪssᴇᴜʀ': {
    emoji: '🎨',
    cmds: ['sticker','stiker','telegraph','url','toimg','take','steal','wm','qc','tts','say']
  },
  '🎧 ᴇғғᴇᴛs ᴀᴜᴅɪᴏ': {
    emoji: '🎧',
    cmds: ['bass','blown','deep','earrape','fast','nightcore','reverse','robot','slow','smooth','squirrel']
  },
  '🎮 ᴊᴇᴜx': {
    emoji: '🎮',
    cmds: ['rps','rpsls','dice','coin','coinbattle','numberbattle','numbattle','hangman','tictactoe','guess','math','emojiquiz','gamefact']
  },
  '😂 ғᴜɴ & ᴅɪᴠᴇʀᴛɪssᴇᴍᴇɴᴛ': {
    emoji: '😂',
    cmds: ['truth','dare','joke','meme','ship','rate','flirt','roast','compliment','wouldyou','8balladvice','urban','moviequote','triviafact','inspire','ascii','progquote','dadjoke','funfact','paptt']
  },
  '💮 ᴀɴɪᴍᴇ': {
    emoji: '💮',
    cmds: ['achar','aquote','arecommend','asearch','maid','megumin','neko','shinobu','waifu']
  },
  '🖼️ ɪᴍᴀɢᴇs': {
    emoji: '🖼️',
    cmds: ['sfw','moe','aipic','chinagirl','bluearchive','boypic','carimage','random-girl','hijab-girl','indonesia-girl','japan-girl','korean-girl','malaysia-girl','profile-pictures','tiktokgirl']
  },
  '🔗 ᴄᴏɴɴᴇxɪᴏɴ': {
    emoji: '🔗',
    cmds: ['pair','connect','bot']
  },
  '📧 ᴛᴇᴍᴘᴍᴀɪʟ': {
    emoji: '📧',
    cmds: ['newmail','readmail','deltmp','tempmail2','tempmail-inbox']
  },
  '💰 ᴄᴏᴍᴘᴛᴇ & ᴘᴀɪᴇᴍᴇɴᴛ': {
    emoji: '💰',
    cmds: ['aza','account','setaccount']
  }
};

// Set de toutes les commandes connues — sert au déclenchement sans préfixe
export const KNOWN_CMDS = (() => {
  const s = new Set(['menu','help','list','ping','alive','runtime','uptime','del','prefix','test']);
  for (const group of Object.values(MENU_GROUPS)) for (const c of group.cmds) s.add(c.toLowerCase());
  return s;
})();

function buildMenu(userName = '') {
  const activePrefix = getState().prefix || PREFIX;
  let body = '';
  let category = 0;

  for (const [title, group] of Object.entries(MENU_GROUPS)) {
    category++;
    const cmds = group.cmds;
    body += `\n╭━━〔 ${group.emoji} *${title}* 〕━━╮\n`;

    for (let i = 0; i < cmds.length; i += 2) {
      const left = `${activePrefix}${cmds[i]}`;
      const right = cmds[i + 1] ? `${activePrefix}${cmds[i + 1]}` : '';
      body += right
        ? `│ ${group.emoji} ${left}   │ ${right}\n`
        : `│ ${group.emoji} ${left}\n`;
    }
    body += `╰━━━━━━━━━━━━━━━━━━━━╯\n`;
  }

  return `╭━━━🍁 𝐊𝐈𝐋𝐋𝐔𝐀 - 𝗠𝗗 🍁━━━╮
│ 👤 𝐔𝐒𝐄𝐑 : ${userName || 'You'}
│ 👑 𝐃𝐄𝐕 : ${DEV_NAME}
│ 🔱 𝐏𝐑𝐄𝐅𝐈𝐗 : ${activePrefix}
╰━━━━━━━━━━━━━━━━━━━━╯

🌌 *« Le GOAT ne parle pas, il laisse ses actions répondre. »*

${body}
╭━━〔 🍁 𝗞𝗜𝗟𝗟𝗨𝗔 𝗠𝗗 〕━━╮
│ ⚡ Fast • Stable • Intelligent
│ 👑 Powered by ${DEV_NAME}
╰━━━━━━━━━━━━━━━━━━╯`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GROUP WELCOME / GOODBYE (ALWAYS ENABLED — no toggle needed)
// Triggered automatically on every join/leave detection in any group.
// ─────────────────────────────────────────────────────────────────────────────
export async function handleGroupWelcome(natsu, update = {}) {
  const { id, participants = [], action } = update;
  if (!id || !String(id).endsWith('@g.us')) return;
  if (!participants.length) return;

  // Normalize action (Baileys may emit 'add'|'remove'|'promote'|'demote'|'leave')
  const act = String(action || '').toLowerCase();
  const isJoin = act === 'add' || act === 'invite' || act === 'join';
  const isLeave = act === 'remove' || act === 'leave' || act === 'kick';
  if (!isJoin && !isLeave) return;

  const state = getState();
  const enabled = isJoin ? state.welcome[id] !== false : state.goodbye[id] !== false;
  if (!enabled) return;

  let groupName = '';
  try { groupName = (await natsu.groupMetadata(id))?.subject || ''; } catch {}

  for (const raw of participants) {
    const jidP = typeof raw === 'string' ? raw : (raw?.id || raw?.jid || '');
    if (!jidP) continue;
    const number = jidP.split('@')[0];
    try {
      if (isJoin) {
        await natsu.sendMessage(id, {
          image: { url: MENU_IMAGE },
          caption:
`╭━━━〔 *ᴡᴇʟᴄᴏᴍᴇ* 〕━━━╮

*ʜᴇʏ @${number} !*
*ᴡᴇʟᴄᴏᴍᴇ ᴛᴏ ${groupName || 'ᴛʜɪs ɢʀᴏᴜᴘ'}*

*ᴇɴᴊᴏʏ ʏᴏᴜʀ, sᴛᴀᴛʏ ᴀɴᴅ ʜᴀᴠᴇ ғᴜɴ!*
*ᴛʏᴘᴇ ${PREFIX}ᴍᴇɴᴜ ᴛᴏ ᴇxᴘʟᴏʀᴇ ᴀʟʟ ᴄᴏᴍᴍᴀɴᴅs.*

╰━━━〔 *killua ᴍᴅ* 〕━━━╯
> *ʏᴏᴜʀ ғᴀsᴛ ʙᴏᴛ*
> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ : ${DEV_NAME}*`,
          mentions: [jidP],
          contextInfo: forwardedContext(),
        }); 
      } else if (isLeave) {
        await natsu.sendMessage(id, {
          text: `╭━━━〔 *ɢᴏᴏᴅʙʏᴇ* 〕━━━╮

*ғᴀʀᴇᴡᴇʟʟ @${number}*

*ᴛʜᴀɴᴋs ғᴏʀ ʙᴇɪɴɢ ᴡɪᴛʜ ᴜs.*
*ᴡᴇ ᴡɪsʜ ʏᴏᴜ ᴛʜᴇ ʙᴇsᴛ!*

╰━━━〔 *killua ᴍᴅ* 〕━━━╯
> *ʏᴏᴜʀ ғᴀsᴛ ʙᴏᴛ*
> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ : ${DEV_NAME}*`,
          mentions: [jidP],
          contextInfo: forwardedContext(),
        });
      }
    } catch (e) {}
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DISPATCHER
// ─────────────────────────────────────────────────────────────────────────────
export async function handleCommand(natsu, msg) {
  const jid = msg.key?.remoteJid;
  if (!jid) return;

  const state = getState();
  const senderJid = sender(msg);
  const senderNum = senderJid.split('@')[0];
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
    if (isGroup(jid) && state.antilink[jid] && LINK_RE.test(text)) {
      const { admins } = await getGroupAdmins(natsu, jid);
      const senderIsAdmin = isGroupAdmin(admins, senderJid);
      if (!senderIsAdmin) {
        try { await natsu.sendMessage(jid, { delete: msg.key }); }
        catch (e) {}
        try { await natsu.groupParticipantsUpdate(jid, [senderJid], 'remove'); }
        catch (e) {}
        return sendText(natsu, jid, `*⛔ @${senderNum} ʟɪɴᴋ ᴅᴇᴛᴇᴄᴛᴇᴅ — ᴍᴇssᴀɢᴇ ʀᴇᴍᴏᴠᴇᴅ.*`, msg);
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
      case 'welcome': case 'goodbye': {
        const info = await requireGroupAdmin(natsu, jid, msg, senderJid, reply);
        if (!info) break;
        const key = cmd === 'welcome' ? 'welcome' : 'goodbye';
        if (!arg) { await reply(`📌 *${cmd}* → ${getState()[key][jid] === false ? 'OFF' : 'ON'}\nUsage: ${PREFIX}${cmd} on/off`); break; }
        const on = /^(on|1|true)$/i.test(arg.trim());
        updateState(st => { st[key][jid] = on; });
        await reply(`✅ *${cmd}* → ${on ? 'ON' : 'OFF'}`);
        break;
      }
      case 'groupinfo': case 'ginfo': {
        if (!isGroup(jid)) { await reply('❌ Group only.'); break; }
        const meta = await natsu.groupMetadata(jid);
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
      case 'botstatus': case 'status': {
        const up = Math.floor(process.uptime());
        const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60), sec = up % 60;
        await reply(`🤖 *${BOT_NAME}*\n🟢 Online\n⏱️ ${h}h ${m}m ${sec}s\n📦 Node ${process.version}`);
        break;
      }
      case 'tagall': {
        const info = await requireGroupAdmin(natsu, jid, msg, senderJid, reply);
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
        const info = await requireGroupAdmin(natsu, jid, msg, senderJid, reply);
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
        const { admins } = info;
        const mention = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        const numArg  = arg.replace(/\D/g, '');
        const target  = mention || (numArg ? `${numArg}@s.whatsapp.net` : null);
        if (!target) { await reply(`*❌ ᴜsᴀɢᴇ: ${PREFIX}${cmd} @ᴜsᴇʀ ᴏʀ ɴᴜᴍʙᴇʀ*`); break; }
        const action = cmd === 'kick' ? 'remove' : cmd; // promote|demote|add|remove
        try {
          await natsu.groupParticipantsUpdate(jid, [target], action);
          await reply(`✅ ${cmd} → @${target.split('@')[0]}`);
        } catch (e) { await reply(`❌ Failed: ${e.message}`); }
        break;
      }
      case 'mute': case 'unmute': case 'closegc': case 'opengc': {
        const info = await requireGroupAdmin(natsu, jid, msg, senderJid, reply);
        if (!info) break;
        const setting = (cmd === 'mute' || cmd === 'closegc') ? 'announcement' : 'not_announcement';
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
        const info = await requireGroupAdmin(natsu, jid, msg, senderJid, reply);
        if (!info) break;
        const { meta, admins, botJid } = info;
        const targets = (cmd === 'kickall')
          ? meta.participants.map(p => p.id).filter(j => !admins.includes(j) && j !== botJid)
          : admins.filter(j => j !== botJid);
        for (const t of targets) { try { await natsu.groupParticipantsUpdate(jid, [t], 'remove'); } catch {} await new Promise(r => setTimeout(r, 800)); }
        await reply(`*✅ ʀᴇᴍᴏᴠᴇᴅ ${targets.length} ᴍᴇᴍʙᴇʀ(s).*`);
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
        const info = await requireGroupAdmin(natsu, jid, msg, senderJid, reply);
        if (!info) break;
        const on = /on|1|true/i.test(arg);
        updateState(s => { s.antilink[jid] = on; });
        await reply(`*🔗 ᴀɴᴛɪʟɪɴᴋ ${on ? 'enabled' : 'disabled'} ɪɴ ᴛʜɪs ɢʀᴏᴜᴘ.*`);
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
> 𝗧𝗵𝗲 𝗚𝗼𝗮𝘁 𝗢𝗳 𝗕𝗼𝘁𝘀

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
        try { const r = await axios.get('https://official-joke-api.appspot.com/random_joke', { timeout: 6000 });
          await reply(`😂 *Joke*\n\n${r.data.setup}\n— ${r.data.punchline}`); }
        catch { await reply(`😂 ${RAND(['Why did the dev quit? No arrays.','I told a UDP joke, you might not get it.'])}`); }
        break;
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
        try { const r = await axios.get('https://api.quotable.io/random?tags=famous-quotes', { timeout: 5000 });
          await reply(`🎬 *MOVIE QUOTE*\n\n"${r.data.content}"\n— ${r.data.author}`); }
        catch { await reply('🎬 "May the Force be with you." — Star Wars'); }
        break;
      }
      case 'triviafact': case 'funfact': case 'fact': {
        try { const r = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', { timeout: 5000 });
          await reply(`🧠 *FUN FACT*\n\n${r.data.text}`); }
        catch { await reply('🧠 Octopuses have 3 hearts. 🐙'); }
        break;
      }
      case 'inspire': {
        try { const r = await axios.get('https://api.quotable.io/random?tags=inspirational', { timeout: 5000 });
          await reply(`✨ *INSPIRE*\n\n"${r.data.content}"\n— ${r.data.author}`); }
        catch { await reply('✨ "The best way out is always through." — Robert Frost'); }
        break;
      }
      case 'ascii': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}ascii <text>*`); break; }
        try { const r = await axios.get(`https://artii.herokuapp.com/make?text=${encodeURIComponent(arg)}`, { timeout: 5000 });
          await reply('```' + r.data + '```'); }
        catch { await reply('❌ Service down.'); }
        break;
      }
      case 'progquote': {
        try { const r = await axios.get('https://programming-quotesapi.vercel.app/api/random', { timeout: 5000 });
          const q = r.data; await reply(`💻 *PROG QUOTE*\n\n"${q.quote || q.en}"\n— ${q.author}`); }
        catch { await reply('💻 "Talk is cheap. Show me the code." — Linus Torvalds'); }
        break;
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
      case 'newmail': case 'tempmail2': {
        try {
          const r = await axios.get('https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1', { timeout: 6000 });
          updateState(s => { s.tempmail = r.data[0]; });
          await reply(`📧 *Temp mail*\n\n\`${r.data[0]}\`\nRead with: *${PREFIX}readmail*`);
        } catch (e) { await reply(`❌ ${e.message}`); }
        break;
      }
      case 'readmail': case 'tempmail-inbox': {
        const s = getState(); if (!s.tempmail) { await reply(`❌ 𝗚𝗲𝗻𝗲𝗿𝗮𝘁𝗲 𝗼𝗻𝗲: *${PREFIX}newmail*`); break; }
        const [login, domain] = s.tempmail.split('@');
        try {
          const r = await axios.get(`https://www.1secmail.com/api/v1/?action=getMessages&login=${login}&domain=${domain}`, { timeout: 6000 });
          if (!r.data.length) { await reply(`📭 Inbox empty for \`${s.tempmail}\``); break; }
          let out = `📬 *𝗜𝗻𝗯𝗼𝘅 — ${s.tempmail}*\n\n`;
          for (const m of r.data.slice(0, 5)) {
            const det = await axios.get(`https://www.1secmail.com/api/v1/?action=readMessage&login=${login}&domain=${domain}&id=${m.id}`, { timeout: 6000 });
            out += `📨 *${det.data.subject}*\nFrom: ${det.data.from}\n${(det.data.textBody||det.data.body||'').slice(0,300)}\n\n`;
          }
          await reply(out);
        } catch (e) { await reply(`❌ ${e.message}`); }
        break;
      }
      case 'deltmp': { updateState(s => { delete s.tempmail; }); await reply('🗑️ 𝗧𝗲𝗺𝗽 𝗺𝗮𝗶𝗹 𝗱𝗲𝗹𝗲𝘁𝗲𝗱.'); break; }

      // ═════════════════════════════════════════════════════════════════════
      // OTHER MENU
      // ═════════════════════════════════════════════════════════════════════
      case 'weatherwiki': case 'weather': {
        if (!arg) { await reply(`❌ 𝗨𝘀𝗮𝗴𝗲: *${PREFIX}𝘄𝗲𝗮𝘁𝗵𝗲𝗿 <city>*`); break; }
        try {
          const r = await axios.get(`https://wttr.in/${encodeURIComponent(arg)}?format=j1`, { timeout: 5000 });
          const c = r.data.current_condition[0], a = r.data.nearest_area[0];
          await reply(`🌍 *${a.areaName[0].value}, ${a.country[0].value}*\n☀️ ${c.temp_C}°C — ${c.weatherDesc[0].value}\n💧 ${c.humidity}% • 💨 ${c.windspeedKmph} km/h`);
        } catch { await reply('❌ 𝗪𝗲𝗮𝘁𝗵𝗲𝗿 𝗲𝗿𝗿𝗼𝗿.'); }
        break;
      }
      case 'currency': {
        const p = arg.split(/\s+/); if (p.length < 3) { await reply(`❌ 𝗨𝘀𝗮𝗴𝗲: *${PREFIX}𝗰𝘂𝗿𝗿𝗲𝗻𝗰𝘆 100 𝗨𝗦𝗗 𝗘𝗨𝗥*`); break; }
        const [amt, from, to] = p;
        try { const r = await axios.get(`https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`, { timeout: 5000 });
          const v = (parseFloat(amt) * r.data.rates[to.toUpperCase()]).toFixed(2);
          await reply(`💱 ${amt} ${from.toUpperCase()} = *${v} ${to.toUpperCase()}*`); }
        catch { await reply('❌ 𝗥𝗮𝘁𝗲 𝘂𝗻𝗮𝘃𝗮𝗶𝗹𝗮𝗯𝗹𝗲.'); }
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
        const d = await tryFetch([`https://aztro.sameerkumar.website/?sign=${arg.toLowerCase()}&day=today`,
          `https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${arg.toLowerCase()}&day=TODAY`]);
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

      // ═════════════════════════════════════════════════════════════════════
      // RANDOM IMAGE
      // ═════════════════════════════════════════════════════════════════════
      case 'sfw': case 'moe': case 'aipic': {
        const url = await fetchAnyImage([
          'https://api.waifu.pics/sfw/waifu',
          'https://nekos.best/api/v2/neko',
        ]);
        if (url) await img(url, `🖼️ *${cmd.toUpperCase()}*`); else await reply('❌ Error.');
        break;
      }
      case 'hentai': case 'loli': {
        await reply('❌ Cette commande est désactivée.');
        break;
      }

      case 'chinagirl': case 'bluearchive': case 'boypic': case 'carimage':
      case 'random-girl': case 'hijab-girl': case 'indonesia-girl':
      case 'japan-girl': case 'korean-girl': case 'malaysia-girl':
      case 'profile-pictures': case 'tiktokgirl': {
        const url = await fetchAnyImage([
          `https://api.giftedtech.web.id/api/sfw/${cmd.replace('-','')}?apikey=gifted`,
          `https://api.giftedtech.web.id/api/anime/${cmd.replace('-','')}?apikey=gifted`,
          'https://api.waifu.pics/sfw/waifu',
        ]);
        if (url) await img(url, `🖼️ *${cmd.toUpperCase()}*`); else await reply('❌ Try again later.');
        break;
      }

      // ═════════════════════════════════════════════════════════════════════
      // PAYMENT MENU
      // ═════════════════════════════════════════════════════════════════════
      case 'aza': case 'account': {
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
        const d = await tryFetch(['https://animechan.io/api/v1/quotes/random']);
        const q = d?.data; if (!q) { await reply(`💬 "I'll become the Pirate King!" — Luffy`); break; }
        await reply(`💬 *${q.character?.name}* (${q.anime?.name})\n\n"${q.content}"`); break;
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
        const url = await fetchAnyImage([`https://api.waifu.pics/sfw/${cmd}`, `https://nekos.best/api/v2/${cmd}`]);
        if (url) await img(url, `🌸 *${cmd.toUpperCase()}*`); else await reply('❌ Try again.');
        break;
      }

      // ═════════════════════════════════════════════════════════════════════
      // CONVERTER
      // ═════════════════════════════════════════════════════════════════════
      case 'telegraph': { await reply('📝 Telegraph upload requires reply to image/text (will be enabled with multipart upload pipeline).'); break; }
      case 'url': { await reply(`🔗 ${PREFIX}url — short an URL: ${PREFIX}shorturl <url>`); break; }

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

      async function youtubeMp3(url) {
        // Current documented public converter. Returns a temporary direct URL.
        try {
          const body = new URLSearchParams({ youtube_url: url, quality: '192' });
          const r = await axios.post('https://ytmp3.ge/api/convert', body.toString(), {
            timeout: 30000,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
          });
          if (r.data?.success && r.data?.downloadUrl) return r.data;
        } catch {}

        // GiftedTech fallback used by older Killua releases.
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
        return null;
      }
      case 'apk': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}apk <app name>*`); break; }
        const d = await tryFetch([`https://api.giftedtech.web.id/api/download/apkdl?apikey=gifted&appName=${encodeURIComponent(arg)}`]);
        const r = d?.result; if (!r?.dllink) { await reply('❌ Not found.'); break; }
        await reply(`📲 *${r.name}*\n📦 ${r.size}\n🔗 ${r.dllink}`); break;
      }
      case 'fb': case 'insta': case 'pint': case 'mp4': case 'video':
      case 'yta': case 'ytv': case 'ytmp3': case 'yt': case 'play': case 'song': {
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
        if (['play', 'song'].includes(cmd)) {
          const ytUrl = await resolveYouTubeUrl(arg);
          if (ytUrl) {
            const mp3 = await youtubeMp3(ytUrl);
            r = mp3;
            url = mp3?.downloadUrl;
          }
        } else {
          const d = await tryFetch(endpoints[cmd] || []);
          r = d?.result || d;
          url = r?.download_url || r?.dl_url || r?.url || r?.audio || r?.video || r?.[0]?.url;
        }
        if (!url) { await reply(`❌ *${cmd}* indisponible pour le moment.\n\nVérifie le lien/nom puis réessaie dans quelques secondes.`); break; }
        const isAudio = ['yta','ytmp3','play','song'].includes(cmd);
        try {
          if (isAudio) await natsu.sendMessage(jid, { audio: { url }, mimetype: 'audio/mpeg', contextInfo: forwardedContext() }, { quoted: msg });
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
        if (!isGroup(jid)) { await reply('❌ Group only.'); break; }
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
        const d = await tryFetch([`https://api.popcat.xyz/translate?to=${lang}&text=${encodeURIComponent(txt)}`]);
        await reply(d?.translated ? `🌐 (${lang}) ${d.translated}` : '❌ Échec.');
        break;
      }
      case 'lyrics': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}lyrics <titre>*`); break; }
        const d = await tryFetch([`https://api.popcat.xyz/lyrics?song=${encodeURIComponent(arg)}`]);
        if (!d?.lyrics) { await reply('❌ Pas trouvé.'); break; }
        await reply(`🎵 *${d.title}* — ${d.artist}\n\n${String(d.lyrics).slice(0, 3500)}`);
        break;
      }
      case 'removebg': {
        const q = quotedMsg(msg);
        if (!q?.quoted?.imageMessage) { await reply('❌ Réponds à une image.'); break; }
        await reply('⏳ Removing background…');
        await reply('⚠️ removebg nécessite une clé API (remove.bg). Ajoute REMOVE_BG_KEY puis active le pipeline upload.');
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
