import http from 'node:http';
import { createApp } from './app.js';
import { hashPassword } from './auth.js';
import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { createRecognizer } from './recognition/index.js';

// Carrega o .env se existir (Node >= 22.10).
try {
  process.loadEnvFile();
} catch {
  /* sem .env: usa só as variáveis do ambiente */
}

async function seedAdmin(db, { admin }) {
  if (!admin.identifier || !admin.password) return;
  if (admin.password.length < 8) throw new Error('ADMIN_PASSWORD precisa ter pelo menos 8 caracteres.');
  const exists = db.prepare('SELECT 1 FROM users WHERE identifier = ?').get(admin.identifier);
  if (exists) return;
  db.prepare(
    "INSERT INTO users (identifier, name, password_hash, role, created_at) VALUES (?, ?, ?, 'admin', ?)",
  ).run(admin.identifier, admin.name, await hashPassword(admin.password), Date.now());
  console.log(`Conta de administrador "${admin.identifier}" criada.`);
}

const config = loadConfig();
const db = openDb(config.dbPath);
await seedAdmin(db, config);
const recognizer = createRecognizer(config);

const server = http.createServer(createApp({ config, db, recognizer }));
server.listen(config.port, config.host, () => {
  console.log(`AppLunch rodando em http://localhost:${config.port} (${config.nodeEnv}, reconhecimento: ${recognizer.name})`);
  if (recognizer.name === 'mock') {
    console.warn('⚠  Reconhecimento facial em modo MOCK: qualquer imagem é aceita. Use apenas para desenvolvimento.');
  }
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
