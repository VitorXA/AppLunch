import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { hashPassword, newToken, sha256, verifyAgainstDummy, verifyPassword } from './auth.js';
import { HttpError, RecognitionError } from './errors.js';
import { decodeImage } from './images.js';
import { currentMeal } from './meals.js';
import { RateLimiter } from './rate-limit.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Cria o handler HTTP (req, res) da aplicação. Sem frameworks: só Node.
 * `clock` existe para os testes poderem controlar a hora.
 */
export function createApp({ config, db, recognizer, clock = () => new Date() }) {
  const limiter = new RateLimiter();
  const sessionTtlMs = config.sessionTtlHours * 3600_000;

  const q = {
    userByIdentifier: db.prepare('SELECT * FROM users WHERE identifier = ?'),
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    insertUser: db.prepare(
      'INSERT INTO users (identifier, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ),
    insertSession: db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)'),
    sessionUser: db.prepare(
      'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?',
    ),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    purgeSessions: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
    faceByUser: db.prepare('SELECT * FROM face_templates WHERE user_id = ?'),
    insertFace: db.prepare(
      'INSERT INTO face_templates (user_id, provider, template, consent_at, created_at) VALUES (?, ?, ?, ?, ?)',
    ),
    deleteFace: db.prepare('DELETE FROM face_templates WHERE user_id = ?'),
    insertMeal: db.prepare(
      'INSERT INTO meals (user_id, meal_type, meal_date, score, created_at) VALUES (?, ?, ?, ?, ?)',
    ),
    mealsOfUserOnDate: db.prepare('SELECT meal_type FROM meals WHERE user_id = ? AND meal_date = ?'),
    mealExists: db.prepare('SELECT 1 FROM meals WHERE user_id = ? AND meal_type = ? AND meal_date = ?'),
    mealsOnDate: db.prepare(
      `SELECT m.id, m.meal_type, m.score, m.created_at, u.identifier, u.name
         FROM meals m JOIN users u ON u.id = m.user_id
        WHERE m.meal_date = ? ORDER BY m.created_at DESC`,
    ),
  };

  // ---------- utilidades ----------

  const publicUser = (u) => ({ id: u.id, identifier: u.identifier, name: u.name, email: u.email, role: u.role });

  function clientIp(req) {
    if (config.trustProxy) {
      const forwarded = req.headers['x-forwarded-for'];
      if (forwarded) return String(forwarded).split(',')[0].trim();
    }
    return req.socket.remoteAddress ?? 'unknown';
  }

  function parseCookies(header = '') {
    const out = {};
    for (const part of header.split(';')) {
      const i = part.indexOf('=');
      if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
    return out;
  }

  const sessionCookie = (value, maxAgeSec) =>
    `session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSec}${config.cookieSecure ? '; Secure' : ''}`;

  function sendJson(res, status, data, headers = {}) {
    const body = JSON.stringify(data);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
      ...headers,
    });
    res.end(body);
  }

  async function readJson(req) {
    const contentType = String(req.headers['content-type'] ?? '');
    // Exigir JSON, junto com SameSite=Strict, protege contra CSRF: um site de
    // terceiros não consegue enviar esse Content-Type sem uma checagem CORS.
    if (!contentType.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'unsupported_media_type');
    const limit = Math.ceil(config.maxImageBytes * 1.4) + 16_384;
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit) throw new HttpError(413, 'payload_too_large');
      chunks.push(chunk);
    }
    if (size === 0) return {};
    try {
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new Error('not an object');
      return data;
    } catch {
      throw new HttpError(400, 'invalid_json');
    }
  }

  function startSession(userId) {
    const now = clock().getTime();
    q.purgeSessions.run(now);
    const token = newToken();
    q.insertSession.run(sha256(token), userId, now + sessionTtlMs);
    return sessionCookie(token, Math.floor(sessionTtlMs / 1000));
  }

  function mealsStatus(user) {
    const { meal, date } = currentMeal(config.meals, config.timezone, clock());
    const done = new Set(q.mealsOfUserOnDate.all(user.id, date).map((r) => r.meal_type));
    return {
      serverDate: date,
      currentMeal: meal?.id ?? null,
      meals: config.meals.map((m) => ({ ...m, doneToday: done.has(m.id) })),
    };
  }

  // ---------- rotas da API ----------

  const routes = [];
  const route = (method, pattern, handler, { auth = 'none' } = {}) => {
    const keys = [];
    const regex = new RegExp(
      '^' + pattern.replace(/:([a-z]+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$',
    );
    routes.push({ method, regex, keys, handler, auth });
  };

  route('GET', '/api/health', async () => ({ body: { ok: true } }));

  route('GET', '/api/config', async () => ({
    body: {
      registrationOpen: config.registrationOpen,
      requiresInviteCode: Boolean(config.registrationCode),
    },
  }));

  route('POST', '/api/auth/register', async ({ req, body }) => {
    if (!config.registrationOpen) throw new HttpError(403, 'registration_closed');
    if (!limiter.hit(`register:${clientIp(req)}`, 20, 3600_000)) throw new HttpError(429, 'too_many_attempts');
    if (config.registrationCode && body.inviteCode !== config.registrationCode) {
      throw new HttpError(403, 'invalid_invite_code');
    }

    const identifier = typeof body.identifier === 'string' ? body.identifier.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null;
    const password = typeof body.password === 'string' ? body.password : '';

    if (!config.idPattern.test(identifier)) throw new HttpError(422, 'invalid_identifier');
    if (name.length < 2 || name.length > 100) throw new HttpError(422, 'invalid_name');
    if (email && (email.length > 254 || !EMAIL.test(email))) throw new HttpError(422, 'invalid_email');
    if (password.length < 8 || password.length > 128) throw new HttpError(422, 'weak_password');
    if (q.userByIdentifier.get(identifier)) throw new HttpError(409, 'identifier_taken');

    const hash = await hashPassword(password);
    let user;
    try {
      const { lastInsertRowid } = q.insertUser.run(identifier, name, email, hash, 'student', clock().getTime());
      user = q.userById.get(lastInsertRowid);
    } catch (err) {
      if (/UNIQUE/i.test(err.message)) throw new HttpError(409, 'identifier_taken');
      throw err;
    }
    return { status: 201, body: { user: publicUser(user) }, headers: { 'Set-Cookie': startSession(user.id) } };
  });

  route('POST', '/api/auth/login', async ({ req, body }) => {
    const identifier = typeof body.identifier === 'string' ? body.identifier.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const key = `login:${clientIp(req)}:${identifier.toLowerCase()}`;
    if (!limiter.hit(key, 10, 15 * 60_000)) throw new HttpError(429, 'too_many_attempts');

    const user = identifier ? q.userByIdentifier.get(identifier) : null;
    const valid = user ? await verifyPassword(password, user.password_hash) : (await verifyAgainstDummy(password), false);
    if (!valid) throw new HttpError(401, 'invalid_credentials');

    limiter.reset(key);
    return { body: { user: publicUser(user) }, headers: { 'Set-Cookie': startSession(user.id) } };
  });

  route('POST', '/api/auth/logout', async ({ token }) => {
    if (token) q.deleteSession.run(sha256(token));
    return { body: { ok: true }, headers: { 'Set-Cookie': sessionCookie('', 0) } };
  });

  route(
    'GET',
    '/api/me',
    async ({ user }) => ({
      body: { user: publicUser(user), faceEnrolled: Boolean(q.faceByUser.get(user.id)), timezone: config.timezone, ...mealsStatus(user) },
    }),
    { auth: 'user' },
  );

  route(
    'POST',
    '/api/face/enroll',
    async ({ user, body }) => {
      if (body.consent !== true) throw new HttpError(422, 'consent_required');
      if (q.faceByUser.get(user.id)) throw new HttpError(409, 'face_already_enrolled');
      if (!limiter.hit(`face:${user.id}`, 10, 5 * 60_000)) throw new HttpError(429, 'too_many_attempts');
      const image = decodeImage(body.image, config.maxImageBytes);
      const { template } = await runRecognizer(() => recognizer.enroll(image));
      const now = clock().getTime();
      q.insertFace.run(user.id, recognizer.name, template, now, now);
      return { status: 201, body: { faceEnrolled: true } };
    },
    { auth: 'user' },
  );

  // Direito de apagar os próprios dados biométricos (exige a senha).
  route(
    'DELETE',
    '/api/face',
    async ({ user, body }) => {
      const password = typeof body.password === 'string' ? body.password : '';
      if (!limiter.hit(`delface:${user.id}`, 5, 15 * 60_000)) throw new HttpError(429, 'too_many_attempts');
      if (!(await verifyPassword(password, user.password_hash))) throw new HttpError(401, 'invalid_credentials');
      q.deleteFace.run(user.id);
      return { body: { faceEnrolled: false } };
    },
    { auth: 'user' },
  );

  route(
    'POST',
    '/api/meals/checkin',
    async ({ user, body }) => {
      if (!limiter.hit(`checkin:${user.id}`, 10, 5 * 60_000)) throw new HttpError(429, 'too_many_attempts');

      const { meal, date } = currentMeal(config.meals, config.timezone, clock());
      if (!meal) throw new HttpError(422, 'outside_meal_window');
      const face = q.faceByUser.get(user.id);
      if (!face) throw new HttpError(412, 'face_not_enrolled');
      if (q.mealExists.get(user.id, meal.id, date)) throw new HttpError(409, 'already_checked_in');

      const image = decodeImage(body.image, config.maxImageBytes);
      const { match, score } = await runRecognizer(() => recognizer.verify({ ...image, template: face.template }));
      if (!match) throw new HttpError(403, 'face_mismatch');

      try {
        q.insertMeal.run(user.id, meal.id, date, score ?? null, clock().getTime());
      } catch (err) {
        if (/UNIQUE/i.test(err.message)) throw new HttpError(409, 'already_checked_in');
        throw err;
      }
      return { status: 201, body: { ok: true, meal: { id: meal.id, label: meal.label }, date } };
    },
    { auth: 'user' },
  );

  route(
    'GET',
    '/api/admin/meals',
    async ({ url }) => {
      const date = url.searchParams.get('date') ?? currentMeal(config.meals, config.timezone, clock()).date;
      if (!DATE.test(date)) throw new HttpError(422, 'invalid_date');
      const rows = q.mealsOnDate.all(date);
      const totals = Object.fromEntries(config.meals.map((m) => [m.id, 0]));
      for (const r of rows) totals[r.meal_type] = (totals[r.meal_type] ?? 0) + 1;
      return {
        body: {
          date,
          meals: config.meals,
          totals,
          entries: rows.map((r) => ({
            id: r.id,
            identifier: r.identifier,
            name: r.name,
            mealType: r.meal_type,
            score: r.score,
            at: new Date(r.created_at).toISOString(),
          })),
        },
      };
    },
    { auth: 'admin' },
  );

  // Admin remove o rosto cadastrado de alguém (ex.: pedido de exclusão ou recadastro).
  route(
    'DELETE',
    '/api/admin/users/:id/face',
    async ({ params }) => {
      const target = q.userById.get(Number(params.id));
      if (!target) throw new HttpError(404, 'not_found');
      q.deleteFace.run(target.id);
      return { body: { faceEnrolled: false } };
    },
    { auth: 'admin' },
  );

  async function runRecognizer(fn) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof RecognitionError) throw new HttpError(err.status, err.code);
      throw err;
    }
  }

  async function handleApi(req, res, url) {
    let matched = null;
    let pathExists = false;
    for (const r of routes) {
      const m = r.regex.exec(url.pathname);
      if (!m) continue;
      pathExists = true;
      if (r.method === req.method) {
        matched = { r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
        break;
      }
    }
    if (!matched) throw new HttpError(pathExists ? 405 : 404, pathExists ? 'method_not_allowed' : 'not_found');

    const { r, params } = matched;
    const token = parseCookies(req.headers.cookie).session ?? null;
    let user = null;
    if (r.auth !== 'none') {
      user = token ? (q.sessionUser.get(sha256(token), clock().getTime()) ?? null) : null;
      if (!user) throw new HttpError(401, 'unauthorized');
      if (r.auth === 'admin' && user.role !== 'admin') throw new HttpError(403, 'forbidden');
    }

    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const body = hasBody ? await readJson(req) : {};
    const result = await r.handler({ req, res, url, params, body, user, token });
    sendJson(res, result.status ?? 200, result.body, result.headers);
  }

  // ---------- arquivos estáticos (build do frontend) ----------

  const staticRoot = path.resolve(config.staticDir);

  async function serveStatic(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'method_not_allowed');
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      throw new HttpError(400, 'bad_request');
    }
    let file = path.join(staticRoot, pathname);
    // Impede path traversal (../../etc/passwd).
    if (file !== staticRoot && !file.startsWith(staticRoot + path.sep)) throw new HttpError(403, 'forbidden');

    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) {
      file = path.join(file, 'index.html');
      info = await stat(file).catch(() => null);
    }
    if (!info) {
      // Fallback de SPA: rotas do front voltam para o index.html; arquivos com extensão faltando dão 404.
      if (path.extname(pathname)) throw new HttpError(404, 'not_found');
      file = path.join(staticRoot, 'index.html');
      info = await stat(file).catch(() => null);
      if (!info) throw new HttpError(404, 'frontend_not_built');
    }

    const ext = path.extname(file).toLowerCase();
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  }

  // ---------- handler principal ----------

  return async function handler(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
    );
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
      else await serveStatic(req, res, url);
    } catch (err) {
      if (res.headersSent) return res.destroy();
      if (err instanceof HttpError) {
        const headers = err.status === 413 ? { Connection: 'close' } : {};
        return sendJson(res, err.status, { error: err.code, ...err.extra }, headers);
      }
      console.error(err);
      sendJson(res, 500, { error: 'internal_error' });
    }
  };
}
