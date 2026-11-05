import http from 'node:http';
import { createApp } from '../app.js';
import { hashPassword } from '../auth.js';
import { loadConfig } from '../config.js';
import { openDb } from '../db.js';
import { createMockProvider } from '../recognition/mock.js';

// 2026-11-05 12:00 em America/Fortaleza (UTC-3) — dentro da janela do almoço (11:00–14:00).
export const LUNCH_TIME = new Date('2026-11-05T15:00:00Z');
export const DINNER_TIME = new Date('2026-11-05T22:00:00Z'); // 19:00 local — fora da janela

// JPEG mínimo (só os magic bytes bastam: o provedor mock não decodifica a imagem).
export const IMAGE = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]).toString('base64');

export async function startTestServer({ config: overrides = {}, recognizer = createMockProvider(), now = LUNCH_TIME } = {}) {
  const state = { now };
  const config = loadConfig({}, { dbPath: ':memory:', ...overrides });
  const db = openDb(':memory:');
  const server = http.createServer(createApp({ config, db, recognizer, clock: () => state.now }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  // Cliente com "cookie jar" mínimo.
  function client() {
    let cookie = '';
    return async (method, path, body, { raw = false } = {}) => {
      const res = await fetch(baseUrl + path, {
        method,
        headers: { ...(raw ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.startsWith('session=;') ? '' : set.split(';')[0];
      const data = await res.json().catch(() => null);
      return { status: res.status, data, headers: res.headers };
    };
  }

  async function createAdmin(identifier = 'admin', password = 'admin-password') {
    db.prepare("INSERT INTO users (identifier, name, password_hash, role, created_at) VALUES (?, 'Admin', ?, 'admin', ?)").run(
      identifier,
      await hashPassword(password),
      Date.now(),
    );
    return { identifier, password };
  }

  return {
    baseUrl,
    db,
    state,
    client,
    createAdmin,
    close: () => new Promise((resolve) => server.close(() => (db.close(), resolve()))),
  };
}

export const student = (n = 1) => ({
  identifier: `aluno${n}`,
  password: 'senha-segura-123',
  name: `Aluno ${n}`,
});
