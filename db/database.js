const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:outOfjava123@db.oozbodxqdkmmoplukgdg.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false } // Required for Supabase / Cloud providers
});

const initDB = async () => {
  try {
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS families (
        id          SERIAL PRIMARY KEY,
        family_name TEXT    NOT NULL UNIQUE,
        origin      TEXT,
        description TEXT,
        color       TEXT DEFAULT '#4f46e5',
        image_url   TEXT,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE families ADD COLUMN IF NOT EXISTS image_url TEXT;

      CREATE TABLE IF NOT EXISTS persons (
        id          SERIAL PRIMARY KEY,
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
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE persons ADD COLUMN IF NOT EXISTS phone TEXT;

      CREATE TABLE IF NOT EXISTS relationships (
        id        SERIAL PRIMARY KEY,
        parent_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
        child_id  INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
        UNIQUE(parent_id, child_id)
      );

      CREATE TABLE IF NOT EXISTS marriages (
        id          SERIAL PRIMARY KEY,
        person1_id  INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
        person2_id  INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
        married_on  TEXT,
        divorced_on TEXT,
        UNIQUE(person1_id, person2_id)
      );

      CREATE INDEX IF NOT EXISTS idx_persons_family    ON persons(family_id);
      CREATE INDEX IF NOT EXISTS idx_persons_generation ON persons(generation);
      CREATE INDEX IF NOT EXISTS idx_rel_parent         ON relationships(parent_id);
      CREATE INDEX IF NOT EXISTS idx_rel_child          ON relationships(child_id);
    `);
    client.release();
    console.log('✅ PostgreSQL Database initialized at Supabase');
  } catch (err) {
    console.error('❌ DB Init Error:', err);
  }
};

initDB();

module.exports = pool;
