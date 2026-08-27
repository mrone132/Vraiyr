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

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const CODE_TTL = 5 * 60 * 1000;
const REQUEST_COOLDOWN = 10 * 1000;

const pendingCodes = new Map();
const pairingRequests = new Map();

// ============================================================
// MIDDLEWARE
// ============================================================

app.disable('x-powered-by');

app.use(express.json({
  limit: '20kb',
}));

app.use(express.urlencoded({
  extended: false,
  limit: '20kb',
}));

app.use(express.static(
  path.join(__dirname, 'public')
));

// ============================================================
// HELPERS
// ============================================================

function normalizeNumber(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function validNumber(number) {
  return /^\d{8,15}$/.test(number);
}

function errorResponse(res, status, error) {
  return res.status(status).json({
    ok: false,
    error,
  });
}

function successResponse(res, data = {}) {
  return res.json({
    ok: true,
    ...data,
  });
}

// ============================================================
// CLEAN TEMP DATA
// ============================================================

function cleanTemporaryData() {
  const now = Date.now();

  for (const [number, data] of pendingCodes.entries()) {
    if (
      !data ||
      now - data.createdAt > CODE_TTL
    ) {
      pendingCodes.delete(number);
    }
  }

  for (const [number, timestamp] of pairingRequests.entries()) {
    if (
      now - timestamp > REQUEST_COOLDOWN
    ) {
      pairingRequests.delete(number);
    }
  }
}

setInterval(
  cleanTemporaryData,
  30_000
).unref();

// ============================================================
// HEALTH
// ============================================================

app.get('/api/health', (_req, res) => {
  return successResponse(res, {
    status: 'online',
    bot: BOT_NAME,
    developer: DEV_NAME,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// BOT INFO
// ============================================================

app.get('/api/info', (_req, res) => {
  return successResponse(res, {
    name: BOT_NAME,
    dev: DEV_NAME,
    mode: 'MULTI-DEVICE',
    version: process.env.BOT_VERSION || '1.0.0',
  });
});

// ============================================================
// CREATE PAIRING
// ============================================================

app.post('/api/pair', async (req, res) => {
  const number = normalizeNumber(
    req.body?.number
  );

  if (!validNumber(number)) {
    return errorResponse(
      res,
      400,
      'Numéro invalide. Utilise le format international sans le +.'
    );
  }

  const existing = getSession(number);

  if (existing?.connected) {
    return errorResponse(
      res,
      409,
      `Ce numéro est déjà connecté à ${BOT_NAME}.`
    );
  }

  // Protection anti-spam
  const lastRequest =
    pairingRequests.get(number);

  if (
    lastRequest &&
    Date.now() - lastRequest <
      REQUEST_COOLDOWN
  ) {
    const remaining = Math.ceil(
      (
        REQUEST_COOLDOWN -
        (Date.now() - lastRequest)
      ) / 1000
    );

    return errorResponse(
      res,
      429,
      `Attends ${remaining}s avant de demander un nouveau code.`
    );
  }

  // Retourne le code existant s'il est encore valide
  const pending =
    pendingCodes.get(number);

  if (
    pending &&
    Date.now() - pending.createdAt <
      CODE_TTL
  ) {
    return successResponse(res, {
      number,
      code: pending.code,
      reused: true,
      expiresIn: Math.ceil(
        (
          CODE_TTL -
          (Date.now() - pending.createdAt)
        ) / 1000
      ),
    });
  }

  pairingRequests.set(
    number,
    Date.now()
  );

  try {
    const result =
      await createSession(number);

    if (!result?.code) {
      pairingRequests.delete(number);

      return errorResponse(
        res,
        409,
        'Impossible de générer un nouveau code pour cette session.'
      );
    }

    const code = String(
      result.code
    );

    pendingCodes.set(number, {
      code,
      createdAt: Date.now(),
    });

    return successResponse(res, {
      number,
      code,
      reused: false,
      expiresIn: CODE_TTL / 1000,
    });

  } catch (error) {
    pairingRequests.delete(number);

    console.error(
      `❌ Pairing +${number}:`,
      error?.message || error
    );

    return errorResponse(
      res,
      500,
      error?.message ||
        'Impossible de générer le code de pairing.'
    );
  }
});

// ============================================================
// STATUS
// ============================================================

app.get(
  '/api/status/:number',
  (req, res) => {
    const number =
      normalizeNumber(
        req.params.number
      );

    if (!validNumber(number)) {
      return errorResponse(
        res,
        400,
        'Numéro invalide.'
      );
    }

    const session =
      getSession(number);

    const pending =
      pendingCodes.get(number);

    const connected =
      Boolean(session?.connected);

    if (connected) {
      pendingCodes.delete(number);
    }

    let expiresIn = 0;

    if (pending) {
      expiresIn = Math.max(
        0,
        Math.ceil(
          (
            CODE_TTL -
            (
              Date.now() -
              pending.createdAt
            )
          ) / 1000
        )
      );
    }

    return successResponse(res, {
      number,
      exists: Boolean(session),
      connected,
      pairingPending:
        Boolean(pending) &&
        !connected &&
        expiresIn > 0,
      expiresIn,
    });
  }
);

// ============================================================
// DELETE SESSION
// ============================================================

app.delete(
  '/api/pair/:number',
  async (req, res) => {
    const number =
      normalizeNumber(
        req.params.number
      );

    if (!validNumber(number)) {
      return errorResponse(
        res,
        400,
        'Numéro invalide.'
      );
    }

    try {
      const removed =
        await deleteSession(number);

      pendingCodes.delete(number);
      pairingRequests.delete(number);

      return successResponse(res, {
        number,
        removed: Boolean(removed),
      });

    } catch (error) {
      console.error(
        `❌ Delete +${number}:`,
        error?.message || error
      );

      return errorResponse(
        res,
        500,
        error?.message ||
          'Impossible de supprimer la session.'
      );
    }
  }
);

// ============================================================
// SESSIONS
// ============================================================

app.get(
  '/api/sessions',
  (_req, res) => {
    try {
      const sessions =
        getAllSessions();

      return successResponse(res, {
        sessions: Array.isArray(sessions)
          ? sessions
          : [],
      });

    } catch (error) {
      console.error(
        '❌ Sessions:',
        error
      );

      return errorResponse(
        res,
        500,
        'Impossible de récupérer les sessions.'
      );
    }
  }
);

// ============================================================
// API 404
// ============================================================

app.use(
  '/api',
  (_req, res) => {
    return errorResponse(
      res,
      404,
      'Route API introuvable.'
    );
  }
);

// ============================================================
// EXPRESS ERROR
// ============================================================

app.use(
  (error, _req, res, _next) => {
    console.error(
      '❌ Express:',
      error
    );

    if (
      error?.type ===
      'entity.parse.failed'
    ) {
      return errorResponse(
        res,
        400,
        'JSON invalide.'
      );
    }

    return errorResponse(
      res,
      500,
      'Erreur interne du serveur.'
    );
  }
);

// ============================================================
// START
// ============================================================

async function startServer() {
  try {
    console.log('');
    console.log(
      '┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓'
    );
    console.log(
      '┃          🍁 𝗠𝗜𝗡𝗜 𝗞𝗜𝗟𝗟𝗨𝗔 𝗠𝗗 🍁           ┃'
    );
    console.log(
      '┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫'
    );
    console.log(
      '┃ ◉ 𝗠𝗢𝗗𝗘      ➜ 𝗠𝗨𝗟𝗧𝗜 𝗗𝗘𝗩𝗜𝗖𝗘          ┃'
    );
    console.log(
      '┃ ◉ 𝗗𝗘𝗩       ➜ 𝗞𝗜𝗟𝗟𝗨𝗔 𝗧𝗘𝗔𝗠             ┃'
    );
    console.log(
      '┃ ◉ 𝗦𝗧𝗔𝗧𝗨𝗦    ➜ Initialisation...        ┃'
    );
    console.log(
      '┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛'
    );
    console.log('');

    await loadExistingSessions();

    app.listen(
      PORT,
      HOST,
      () => {
        console.log('');
        console.log(
          '┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓'
        );
        console.log(
          `┃ ◉ 𝗪𝗘𝗕 ➜ http://localhost:${PORT}`.padEnd(45) +
          '┃'
        );
        console.log(
          `┃ ◉ 𝗣𝗢𝗥𝗧 ➜ ${PORT}`.padEnd(45) +
          '┃'
        );
        console.log(
          '┃ ◉ 𝗦𝗧𝗔𝗧𝗨𝗦 ➜ 🟢 ONLINE                  ┃'
        );
        console.log(
          '┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛'
        );
        console.log('');
      }
    );

  } catch (error) {
    console.error(
      '❌ Server startup:',
      error?.message || error
    );

    process.exit(1);
  }
}

// ============================================================
// SHUTDOWN
// ============================================================

function shutdown(signal) {
  console.log(
    `\n⚠️ ${signal} reçu. Arrêt...`
  );

  pendingCodes.clear();
  pairingRequests.clear();

  process.exit(0);
}

process.on(
  'SIGINT',
  () => shutdown('SIGINT')
);

process.on(
  'SIGTERM',
  () => shutdown('SIGTERM')
);

startServer();