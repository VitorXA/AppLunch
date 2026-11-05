import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Migrações simples controladas por PRAGMA user_version.
// Para evoluir o schema, ADICIONE um novo item ao final da lista (nunca edite os antigos).
const MIGRATIONS = [
  `
  CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier    TEXT NOT NULL UNIQUE COLLATE NOCASE,  -- matrícula / SUAP / RA
    name          TEXT NOT NULL,
    email         TEXT,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX idx_sessions_expires ON sessions(expires_at);

  CREATE TABLE face_templates (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    provider   TEXT NOT NULL,
    template   TEXT NOT NULL,
    consent_at INTEGER NOT NULL,   -- quando a pessoa consentiu com o uso do rosto
    created_at INTEGER NOT NULL
  );

  CREATE TABLE meals (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    meal_type  TEXT NOT NULL,
    meal_date  TEXT NOT NULL,      -- YYYY-MM-DD no fuso configurado
    score      REAL,
    created_at INTEGER NOT NULL,
    UNIQUE (user_id, meal_type, meal_date)  -- uma refeição por tipo por dia
  );
  CREATE INDEX idx_meals_date ON meals(meal_date);
  `,
];

export function openDb(file) {
  if (file !== ':memory:') mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  migrate(db);
  return db;
}

function migrate(db) {
  const { user_version: current } = db.prepare('PRAGMA user_version').get();
  for (let version = current; version < MIGRATIONS.length; version++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[version]);
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}
