const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './db/family.db';
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ─────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS families (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    family_name TEXT    NOT NULL UNIQUE,
    origin      TEXT,
    description TEXT,
    color       TEXT DEFAULT '#4f46e5',
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS persons (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id   INTEGER REFERENCES families(id) ON DELETE SET NULL,
    first_name  TEXT    NOT NULL,
    last_name   TEXT,
    gender      TEXT    CHECK(gender IN ('male','female','other')) DEFAULT 'male',
    dob         TEXT,
    dod         TEXT,
    birthplace  TEXT,
    occupation  TEXT,
    bio         TEXT,
    photo_url   TEXT,
    generation  INTEGER NOT NULL DEFAULT 1,
    is_alive    INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at  TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS relationships (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    child_id  INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    UNIQUE(parent_id, child_id)
  );

  CREATE TABLE IF NOT EXISTS marriages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    person1_id  INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    person2_id  INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    married_on  TEXT,
    divorced_on TEXT,
    UNIQUE(person1_id, person2_id)
  );

  -- Indexes for performance
  CREATE INDEX IF NOT EXISTS idx_persons_family    ON persons(family_id);
  CREATE INDEX IF NOT EXISTS idx_persons_generation ON persons(generation);
  CREATE INDEX IF NOT EXISTS idx_rel_parent         ON relationships(parent_id);
  CREATE INDEX IF NOT EXISTS idx_rel_child          ON relationships(child_id);
`);

console.log('✅ Database initialized at', dbPath);

module.exports = db;
