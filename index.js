import 'dotenv/config';
import './server.js';

// ── GLOBAL CRASH GUARDS ─────────────────────────────────────────────────────
// Baileys sometimes writes creds AFTER we delete the session folder, which
// throws an async ENOENT and kills the whole process. Swallow these so the
// bot stays online instead of crashing the container.
process.on('uncaughtException', (err) => {
  const msg = String(err?.message || err);
  if (/ENOENT|creds\.json|pre-?key|no such file/i.test(msg)) {
    console.log(`⚠️ Ignored non-fatal: ${msg}`);
    return;
  }
  console.error('❗ uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  const msg = String(reason?.message || reason);
  if (/ENOENT|creds\.json|pre-?key|no such file|Connection Closed|Stream Errored/i.test(msg)) {
    console.log(`⚠️ Ignored non-fatal rejection: ${msg}`);
    return;
  }
  console.error('❗ unhandledRejection:', reason);
});
