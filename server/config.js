// Toda a configuração do servidor vem de variáveis de ambiente (veja .env.example).

const DEFAULT_MEALS = [{ id: 'lunch', label: 'Almoço', start: '11:00', end: '14:00' }];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function toInt(value, fallback) {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error(`Valor numérico inválido: ${value}`);
  return n;
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function parseMeals(raw) {
  if (!raw) return DEFAULT_MEALS;
  let list;
  try {
    list = JSON.parse(raw);
  } catch {
    throw new Error('MEAL_TYPES precisa ser um JSON válido.');
  }
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('MEAL_TYPES precisa ser uma lista com ao menos uma refeição.');
  }
  const ids = new Set();
  for (const meal of list) {
    if (!meal || typeof meal.id !== 'string' || !/^[a-z0-9_-]{1,32}$/.test(meal.id)) {
      throw new Error('Cada refeição precisa de um "id" (a-z, 0-9, _ ou -).');
    }
    if (ids.has(meal.id)) throw new Error(`Refeição duplicada em MEAL_TYPES: ${meal.id}`);
    ids.add(meal.id);
    if (typeof meal.label !== 'string' || !meal.label.trim()) {
      throw new Error(`A refeição "${meal.id}" precisa de um "label".`);
    }
    if (!HHMM.test(meal.start ?? '') || !HHMM.test(meal.end ?? '')) {
      throw new Error(`A refeição "${meal.id}" precisa de "start" e "end" no formato HH:MM.`);
    }
    if (toMinutes(meal.start) >= toMinutes(meal.end)) {
      throw new Error(`Em "${meal.id}", "start" precisa ser antes de "end" (janelas que viram a meia-noite não são suportadas).`);
    }
  }
  return list;
}

export function loadConfig(env = process.env, overrides = {}) {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';

  const timezone = env.APP_TIMEZONE ?? 'America/Fortaleza';
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
  } catch {
    throw new Error(`APP_TIMEZONE inválido: ${timezone}`);
  }

  const config = {
    nodeEnv,
    isProduction,
    host: env.HOST ?? '0.0.0.0',
    port: toInt(env.PORT, 3000),
    dbPath: env.DATABASE_PATH ?? './data/applunch.db',
    staticDir: env.STATIC_DIR ?? 'dist',
    timezone,
    meals: parseMeals(env.MEAL_TYPES),

    // Conta e sessão
    sessionTtlHours: toInt(env.SESSION_TTL_HOURS, 12),
    cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isProduction,
    trustProxy: env.TRUST_PROXY === 'true',
    registrationOpen: (env.REGISTRATION_OPEN ?? 'true') !== 'false',
    registrationCode: env.REGISTRATION_CODE || null,
    idPattern: new RegExp(env.ID_PATTERN ?? '^[A-Za-z0-9._-]{3,32}$'),

    // Conta de administrador criada na primeira inicialização (opcional)
    admin: {
      identifier: env.ADMIN_ID || null,
      password: env.ADMIN_PASSWORD || null,
      name: env.ADMIN_NAME || 'Administrador',
    },

    // Reconhecimento facial (veja docs/FACE-RECOGNITION.md)
    face: {
      provider: env.FACE_PROVIDER ?? 'mock',
      serviceUrl: env.FACE_SERVICE_URL || null,
      serviceToken: env.FACE_SERVICE_TOKEN || null,
      allowMockInProduction: env.ALLOW_MOCK_FACE_IN_PRODUCTION === 'true',
    },

    maxImageBytes: toInt(env.MAX_IMAGE_BYTES, 1_500_000),
  };

  return { ...config, ...overrides };
}
