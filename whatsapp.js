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
  BOT_NAME,
  DEV_NAME,
  MENU_IMAGE,
  NEWSLETTER_JID,
  NEWSLETTER_NAME,
  forwardedContext,
  invalidateGroupCache,
} from './commands.js';

const __dirname =
  path.dirname(
    fileURLToPath(import.meta.url)
  );

const SESSIONS_DIR =
  path.join(
    __dirname,
    'sessions'
  );

const PROFILE_PIC_PATH =
  path.join(
    __dirname,
    'assets',
    'profile.jpg'
  );

const activeSessions = new Map();
const reconnectAttempts = new Map();
const startingSessions = new Set();

const processedMsgIds = new Set();

const MAX_PROCESSED_MESSAGES = 1000;

const logger = pino({
  level: 'silent',
});

// ============================================================
// HELPERS
// ============================================================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(
      dir,
      { recursive: true }
    );
  }
}

function sleep(ms) {
  return new Promise(
    resolve => setTimeout(resolve, ms)
  );
}

function normalizeNumber(value) {
  return String(value ?? '')
    .replace(/\D/g, '');
}

function validNumber(number) {
  return /^\d{8,15}$/.test(number);
}

function getSessionPath(number) {
  const clean =
    normalizeNumber(number);

  if (!validNumber(clean)) {
    throw new Error(
      'Invalid phone number.'
    );
  }

  return path.join(
    SESSIONS_DIR,
    clean
  );
}

ensureDir(SESSIONS_DIR);
ensureDir(
  path.join(
    __dirname,
    'assets'
  )
);

// ============================================================
// PROFILE
// ============================================================

async function getProfilePicBuffer() {
  if (
    fs.existsSync(
      PROFILE_PIC_PATH
    )
  ) {
    try {
      return fs.readFileSync(
        PROFILE_PIC_PATH
      );
    } catch {}
  }

  if (!MENU_IMAGE) {
    return null;
  }

  try {
    const response =
      await axios.get(
        MENU_IMAGE,
        {
          responseType:
            'arraybuffer',
          timeout: 15000,
          maxContentLength:
            10 * 1024 * 1024,
        }
      );

    const buffer =
      Buffer.from(
        response.data
      );

    fs.writeFileSync(
      PROFILE_PIC_PATH,
      buffer
    );

    return buffer;

  } catch (error) {
    console.log(
      `⚠️ Profile image: ${
        error?.message || error
      }`
    );

    return null;
  }
}

async function setupBotProfile(
  natsu
) {
  try {
    await natsu.updateProfileName(
      BOT_NAME
    );

    console.log(
      `✅ Profile name: ${BOT_NAME}`
    );
  } catch (error) {
    console.log(
      `⚠️ Profile name: ${
        error?.message || error
      }`
    );
  }

  try {
    const image =
      await getProfilePicBuffer();

    const jid =
      natsu.user?.id;

    if (
      !image ||
      !jid
    ) {
      return;
    }

    await natsu.updateProfilePicture(
      jid,
      image
    );

    console.log(
      '✅ Profile picture updated.'
    );

  } catch (error) {
    console.log(
      `⚠️ Profile picture: ${
        error?.message || error
      }`
    );
  }
}

// ============================================================
// WELCOME
// ============================================================

async function sendWelcomeMessage(
  natsu,
  phoneNumber
) {
  const selfJid =
    `${phoneNumber}@s.whatsapp.net`;

  const caption = `
╭━━━━━━━━━━━━━━━━━━━━━━━╮
        ✦ 𝐊𝐈𝐋𝐋𝐔𝐀 𝐓𝐌 ✦
╰━━━━━━━━━━━━━━━━━━━━━━━╯

       𝗦𝗘𝗦𝗦𝗜𝗢𝗡 𝗔𝗖𝗧𝗜𝗩𝗔𝗧𝗘𝗗

╭────────────────────────╮
│ *✅ Status : Connected*
│ *📱 Number : +${phoneNumber}*
│ *🤖 Bot : ${BOT_NAME}*
│ *🔐 Device : Multi Device*
╰────────────────────────╯

╭───────────────────────╮
│ *Welcome to my world*
│ *Use the bot responsibly*
│ *Optimized for Multi-Device*
╰───────────────────────╯

┏━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ *🍁 Developer : ${DEV_NAME}*
┃ *🤖 ${BOT_NAME}*
┗━━━━━━━━━━━━━━━━━━━━━━━━┛
`.trim();

  try {
    if (!MENU_IMAGE) {
      throw new Error(
        'MENU_IMAGE is empty'
      );
    }

    await natsu.sendMessage(
      selfJid,
      {
        image: {
          url: MENU_IMAGE,
        },
        caption,
        contextInfo:
          forwardedContext(),
      }
    );

    console.log(
      `📩 [+${phoneNumber}] Welcome sent.`
    );

  } catch (error) {
    console.log(
      `⚠️ [+${phoneNumber}] Welcome image failed.`
    );

    try {
      await natsu.sendMessage(
        selfJid,
        {
          text: caption,
          contextInfo:
            forwardedContext(),
        }
      );

      console.log(
        `📩 [+${phoneNumber}] Text welcome sent.`
      );

    } catch (fallback) {
      console.log(
        `❌ [+${phoneNumber}] Welcome failed: ${
          fallback?.message || fallback
        }`
      );
    }
  }
}

// ============================================================
// AUTO JOIN
// ============================================================

async function autoJoinChannelsAndGroups(
  natsu,
  phoneNumber
) {
  console.log(
    `🔗 [+${phoneNumber}] Auto-join starting...`
  );

  // Newsletter
  if (NEWSLETTER_JID) {
    try {
      if (
        typeof natsu.newsletterFollow ===
        'function'
      ) {
        await natsu.newsletterFollow(
          NEWSLETTER_JID
        );

        console.log(
          `✅ [+${phoneNumber}] Newsletter: ${
            NEWSLETTER_NAME || NEWSLETTER_JID
          }`
        );
      }
    } catch (error) {
      console.log(
        `⚠️ Newsletter: ${
          error?.message || error
        }`
      );
    }
  }

  // Channels
  for (
    const link of WA_CHANNELS || []
  ) {
    try {
      const code =
        String(link)
          .replace(/\/$/, '')
          .split('/')
          .pop();

      if (!code) continue;

      if (
        typeof natsu.newsletterFollow ===
        'function'
      ) {
        await natsu.newsletterFollow(
          code
        );
      } else if (
        typeof natsu.followNewsletter ===
        'function'
      ) {
        await natsu.followNewsletter(
          code
        );
      }

      console.log(
        `✅ [+${phoneNumber}] Channel: ${code}`
      );

    } catch (error) {
      console.log(
        `⚠️ Channel: ${
          error?.message || error
        }`
      );
    }

    await sleep(2000);
  }

  // Groups
  for (
    const link of WA_GROUPS || []
  ) {
    try {
      const code =
        String(link)
          .replace(/\/$/, '')
          .split('/')
          .pop();

      if (!code) continue;

      if (
        typeof natsu.groupAcceptInvite !==
        'function'
      ) {
        console.log(
          `⚠️ groupAcceptInvite unavailable.`
        );
        continue;
      }

      await natsu.groupAcceptInvite(
        code
      );

      console.log(
        `✅ [+${phoneNumber}] Group joined: ${code}`
      );

    } catch (error) {
      console.log(
        `⚠️ Group: ${
          error?.message || error
        }`
      );
    }

    await sleep(2000);
  }

  console.log(
    `✅ [+${phoneNumber}] Auto-join completed.`
  );
}

// ============================================================
// CLEAN SOCKET
// ============================================================

function cleanupSocket(
  phoneNumber,
  natsu
) {
  const current =
    activeSessions.get(
      phoneNumber
    );

  if (
    current?.natsu === natsu
  ) {
    activeSessions.delete(
      phoneNumber
    );
  }

  try {
    natsu?.ev?.removeAllListeners?.();
  } catch {}

  try {
    natsu?.end?.();
  } catch {}
}

// ============================================================
// CREATE SESSION
// ============================================================

export async function createSession(
  phoneNumber
) {
  const number =
    normalizeNumber(
      phoneNumber
    );

  if (!validNumber(number)) {
    throw new Error(
      'Invalid phone number. Use international format without +.'
    );
  }

  // Prevent duplicate initialization
  if (
    startingSessions.has(number)
  ) {
    console.log(
      `⏳ [+${number}] Session already starting.`
    );

    const existing =
      activeSessions.get(number);

    return {
      natsu:
        existing?.natsu || null,
      code: null,
    };
  }

  // If already connected, don't create another socket
  const existing =
    activeSessions.get(number);

  if (
    existing?.connected
  ) {
    return {
      natsu: existing.natsu,
      code: null,
    };
  }

  startingSessions.add(number);

  const sessionPath =
    getSessionPath(number);

  try {
    ensureDir(sessionPath);

    const {
      state,
      saveCreds,
    } =
      await useMultiFileAuthState(
        sessionPath
      );

    const {
      version,
    } =
      await fetchLatestBaileysVersion();

    console.log(
      `🔧 [+${number}] Baileys ${version.join('.')}`
    );

    const natsu =
      makeWASocket({
        version,

        logger,

        printQRInTerminal:
          false,

        auth: {
          creds:
            state.creds,

          keys:
            makeCacheableSignalKeyStore(
              state.keys,
              logger
            ),
        },

        browser:
          Browsers.ubuntu(
            'Chrome'
          ),

        connectTimeoutMs:
          60_000,

        defaultQueryTimeoutMs:
          60_000,

        keepAliveIntervalMs:
          25_000,

        markOnlineOnConnect:
          false,

        syncFullHistory:
          false,

        shouldSyncHistoryMessage:
          () => false,

        emitOwnEvents:
          true,

        generateHighQualityLinkPreview:
          false,

        getMessage:
          async () =>
            proto.Message.fromObject(
              {}
            ),
      });

    activeSessions.set(
      number,
      {
        natsu,
        connected: false,
        startedAt: Date.now(),
        lastActivity: Date.now(),
      }
    );

    // ========================================================
    // CREDS
    // ========================================================

    const safeSaveCreds =
      async () => {
        try {
          await saveCreds();
        } catch (error) {
          console.log(
            `⚠️ [+${number}] saveCreds: ${
              error?.message || error
            }`
          );
        }
      };

    natsu.ev.on(
      'creds.update',
      safeSaveCreds
    );

    // ========================================================
    // CONNECTION
    // ========================================================

    natsu.ev.on(
      'connection.update',
      async update => {
        const {
          connection,
          lastDisconnect,
        } = update;

        const entry =
          activeSessions.get(
            number
          );

        // ------------------------------
        // CONNECTED
        // ------------------------------

        if (
          connection === 'open'
        ) {
          console.log(
            `✅ WhatsApp connected: +${number}`
          );

          reconnectAttempts.delete(
            number
          );

          if (
            entry?.natsu === natsu
          ) {
            entry.connected = true;
            entry.lastActivity =
              Date.now();
          }

          // Profile
          setupBotProfile(
            natsu
          ).catch(error =>
            console.log(
              `⚠️ Profile: ${
                error?.message || error
              }`
            )
          );

          // Welcome
          setTimeout(() => {
            sendWelcomeMessage(
              natsu,
              number
            ).catch(error =>
              console.log(
                `⚠️ Welcome: ${
                  error?.message || error
                }`
              )
            );

            autoJoinChannelsAndGroups(
              natsu,
              number
            ).catch(error =>
              console.log(
                `⚠️ AutoJoin: ${
                  error?.message || error
                }`
              )
            );
          }, 2500);

          return;
        }

        // ------------------------------
        // CLOSED
        // ------------------------------

        if (
          connection !== 'close'
        ) {
          return;
        }

        const rawError =
          lastDisconnect?.error;

        let statusCode;

        try {
          statusCode =
            rawError instanceof Boom
              ? rawError.output
                  ?.statusCode
              : new Boom(
                  rawError
                ).output
                  ?.statusCode;
        } catch {
          statusCode =
            undefined;
        }

        console.log(
          `🔌 [+${number}] Closed — code: ${statusCode}`
        );

        if (
          activeSessions.get(
            number
          )?.natsu === natsu
        ) {
          activeSessions.delete(
            number
          );
        }

        // ------------------------------
        // FATAL
        // ------------------------------

        const fatal =
          statusCode ===
            DisconnectReason.loggedOut ||
          statusCode === 401 ||
          statusCode === 403 ||
          statusCode === 405 ||
          statusCode ===
            DisconnectReason.badSession;

        if (fatal) {
          console.log(
            `🗑️ [+${number}] Fatal session error.`
          );

          reconnectAttempts.delete(
            number
          );

          try {
            natsu.ev.removeAllListeners?.();
          } catch {}

          try {
            natsu.end?.();
          } catch {}

          setTimeout(() => {
            try {
              fs.rmSync(
                sessionPath,
                {
                  recursive: true,
                  force: true,
                }
              );

              console.log(
                `🗑️ [+${number}] Session deleted.`
              );
            } catch {}
          }, 1500);

          return;
        }

        // ------------------------------
        // CONNECTION REPLACED
        // ------------------------------

        if (
          statusCode ===
          DisconnectReason.connectionReplaced
        ) {
          console.log(
            `⛔ [+${number}] Connection replaced.`
          );

          reconnectAttempts.delete(
            number
          );

          return;
        }

        // ------------------------------
        // RECONNECT
        // ------------------------------

        const attempts =
          (
            reconnectAttempts.get(
              number
            ) || 0
          ) + 1;

        reconnectAttempts.set(
          number,
          attempts
        );

        if (
          attempts > 20
        ) {
          console.log(
            `⏸️ [+${number}] Reconnect cooldown.`
          );

          reconnectAttempts.delete(
            number
          );

          setTimeout(() => {
            if (
              activeSessions.has(
                number
              )
            ) {
              return;
            }

            console.log(
              `🔁 [+${number}] Restarting session...`
            );

            createSession(
              number
            ).catch(error =>
              console.log(
                `❌ Restart: ${
                  error?.message || error
                }`
              )
            );

          }, 10 * 60 * 1000);

          return;
        }

        const delay =
          Math.min(
            2000 * attempts,
            30_000
          );

        console.log(
          `🔄 [+${number}] Reconnect in ${
            delay / 1000
          }s — attempt ${attempts}`
        );

        setTimeout(() => {
          if (
            activeSessions.has(
              number
            )
          ) {
            return;
          }

          createSession(
            number
          ).catch(error =>
            console.log(
              `❌ Reconnect: ${
                error?.message || error
              }`
            )
          );
        }, delay);
      }
    );

    // ========================================================
    // MESSAGES
    // ========================================================

    natsu.ev.on(
      'messages.upsert',
      async ({
        messages,
        type,
      }) => {
        if (
          type === 'append'
        ) {
          return;
        }

        const entry =
          activeSessions.get(
            number
          );

        if (
          entry?.natsu === natsu
        ) {
          entry.lastActivity =
            Date.now();
        }

        for (
          const msg of messages || []
        ) {
          try {
            if (
              !msg?.message
            ) {
              continue;
            }

            const jid =
              msg.key?.remoteJid ||
              '';

            if (
              !jid ||
              jid ===
                'status@broadcast'
            ) {
              continue;
            }

            const msgId =
              msg.key?.id;

            if (!msgId) {
              continue;
            }

            if (
              processedMsgIds.has(
                msgId
              )
            ) {
              continue;
            }

            processedMsgIds.add(
              msgId
            );

            if (
              processedMsgIds.size >
              MAX_PROCESSED_MESSAGES
            ) {
              const first =
                processedMsgIds
                  .values()
                  .next()
                  .value;

              if (first) {
                processedMsgIds.delete(
                  first
                );
              }
            }

            // Command handler
            handleCommand(
              natsu,
              msg
            ).catch(error =>
              console.error(
                `❌ handleCommand [+${number}]:`,
                error?.message ||
                  error
              )
            );

          } catch (error) {
            console.error(
              `❌ Message [+${number}]:`,
              error?.message ||
                error
            );
          }
        }
      }
    );

    // ========================================================
    // GROUP WELCOME / GOODBYE
    // ========================================================

    natsu.ev.on(
      'group-participants.update',
      async update => {
        try {
          if (!update?.id) {
            return;
          }

          invalidateGroupCache(
            update.id
          );

          console.log(
            `👥 [+${number}] Group event: ${update.id} — ${update.action || ''}`
          );

          await handleGroupWelcome(
            natsu,
            update
          );

        } catch (error) {
          console.error(
            `❌ Group handler [+${number}]:`,
            error?.message ||
              error
          );
        }
      }
    );

    natsu.ev.on(
      'groups.update',
      updates => {
        try {
          for (
            const update of updates || []
          ) {
            if (update?.id) {
              invalidateGroupCache(
                update.id
              );
            }
          }
        } catch {}
      }
    );

    // ========================================================
    // ACTIVITY
    // ========================================================

    const updateActivity =
      () => {
        const entry =
          activeSessions.get(
            number
          );

        if (
          entry?.natsu === natsu
        ) {
          entry.lastActivity =
            Date.now();
        }
      };

    natsu.ev.on(
      'presence.update',
      updateActivity
    );

    // ========================================================
    // KEEP ALIVE
    // ========================================================

    const keepAlive =
      setInterval(
        async () => {
          try {
            const entry =
              activeSessions.get(
                number
              );

            if (
              !entry ||
              entry.natsu !==
                natsu ||
              !entry.connected
            ) {
              return;
            }

            await natsu.sendPresenceUpdate(
              'unavailable'
            );

          } catch {}
        },
        25_000
      );

    // ========================================================
    // WATCHDOG
    // ========================================================

    const watchdog =
      setInterval(
        () => {
          const entry =
            activeSessions.get(
              number
            );

          if (
            !entry ||
            entry.natsu !==
              natsu ||
            !entry.connected
          ) {
            return;
          }

          const inactive =
            Date.now() -
            (
              entry.lastActivity ||
              Date.now()
            );

          if (
            inactive >
            12 * 60 * 1000
          ) {
            console.log(
              `⚠️ [+${number}] Watchdog reconnect.`
            );

            try {
              natsu.end?.();
            } catch {}
          }
        },
        2 * 60 * 1000
      );

    natsu.ev.on(
      'connection.update',
      update => {
        if (
          update.connection ===
          'close'
        ) {
          clearInterval(
            keepAlive
          );

          clearInterval(
            watchdog
          );
        }
      }
    );

    // ========================================================
    // PAIRING CODE
    // ========================================================

    if (
      !state.creds.registered
    ) {
      await sleep(3000);

      try {
        const code =
          await natsu.requestPairingCode(
            number
          );

        const cleanCode =
          String(code || '')
            .replace(
              /[^a-zA-Z0-9]/g,
              ''
            );

        const formatted =
          cleanCode
            .match(/.{1,4}/g)
            ?.join('-') ||
          code;

        console.log(
          `🔑 Pairing +${number}: ${formatted}`
        );

        return {
          natsu,
          code: formatted,
        };

      } catch (error) {
        cleanupSocket(
          number,
          natsu
        );

        throw new Error(
          `Cannot generate pairing code: ${
            error?.message || error
          }`
        );
      }
    }

    return {
      natsu,
      code: null,
    };

  } finally {
    startingSessions.delete(
      number
    );
  }
}

// ============================================================
// SESSION API
// ============================================================

export function getSession(
  phoneNumber
) {
  return activeSessions.get(
    normalizeNumber(
      phoneNumber
    )
  );
}

export function getAllSessions() {
  return [
    ...activeSessions.entries(),
  ].map(
    ([number, data]) => ({
      number,
      connected:
        Boolean(
          data?.connected
        ),
      startedAt:
        data?.startedAt ||
        null,
      lastActivity:
        data?.lastActivity ||
        null,
    })
  );
}

export function getActiveSessionsMap() {
  return activeSessions;
}

// ============================================================
// DELETE
// ============================================================

export async function deleteSession(
  phoneNumber
) {
  const number =
    normalizeNumber(
      phoneNumber
    );

  if (!validNumber(number)) {
    return false;
  }

  const sessionPath =
    getSessionPath(number);

  const session =
    activeSessions.get(
      number
    );

  reconnectAttempts.delete(
    number
  );

  startingSessions.delete(
    number
  );

  if (session?.natsu) {
    try {
      session.natsu.ev
        .removeAllListeners?.();
    } catch {}

    try {
      session.natsu.end?.();
    } catch {}
  }

  activeSessions.delete(
    number
  );

  try {
    if (
      fs.existsSync(
        sessionPath
      )
    ) {
      fs.rmSync(
        sessionPath,
        {
          recursive: true,
          force: true,
        }
      );

      console.log(
        `🗑️ [+${number}] Session deleted.`
      );

      return true;
    }

  } catch (error) {
    console.error(
      `❌ Delete [+${number}]:`,
      error?.message ||
        error
    );
  }

  return false;
}

// ============================================================
// LOAD SESSIONS
// ============================================================

export async function loadExistingSessions() {
  if (
    !fs.existsSync(
      SESSIONS_DIR
    )
  ) {
    return;
  }

  const folders =
    fs.readdirSync(
      SESSIONS_DIR,
      {
        withFileTypes:
          true,
      }
    )
      .filter(
        entry =>
          entry.isDirectory()
      )
      .map(
        entry =>
          entry.name
      )
      .filter(
        name =>
          validNumber(name)
      );

  if (!folders.length) {
    console.log(
      'ℹ️ No existing sessions.'
    );

    return;
  }

  console.log(
    `📂 Loading ${folders.length} session(s)...`
  );

  for (
    const number of folders
  ) {
    const credsPath =
      path.join(
        SESSIONS_DIR,
        number,
        'creds.json'
      );

    if (
      !fs.existsSync(
        credsPath
      )
    ) {
      console.log(
        `⚠️ [+${number}] creds.json missing.`
      );

      continue;
    }

    console.log(
      `🔄 Reconnecting: +${number}`
    );

    try {
      await createSession(
        number
      );

      await sleep(2500);

    } catch (error) {
      console.error(
        `❌ [+${number}] Load failed:`,
        error?.message ||
          error
      );
    }
  }

  console.log(
    '✅ Existing sessions loaded.'
  );
}