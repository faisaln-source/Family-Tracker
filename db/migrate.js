const sqlite = require('better-sqlite3');
const pgPool = require('./database');

async function migrate() {
  console.log('Starting migration from SQLite to Postgres...');
  const db = new sqlite('./db/family.db', { fileMustExist: true });
  const client = await pgPool.connect();

  try {
    const families = db.prepare('SELECT * FROM families').all();
    console.log(`Migrating ${families.length} families...`);
    for (const f of families) {
      await client.query(
        'INSERT INTO families (id, family_name, origin, description, color, created_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING',
        [f.id, f.family_name, f.origin, f.description, f.color, f.created_at]
      );
    }
    // Update family sequence
    await client.query("SELECT setval('families_id_seq', (SELECT MAX(id) FROM families))");

    const persons = db.prepare('SELECT * FROM persons').all();
    console.log(`Migrating ${persons.length} persons...`);
    for (const p of persons) {
      await client.query(
        'INSERT INTO persons (id, family_id, first_name, last_name, gender, dob, dod, birthplace, occupation, bio, photo_url, generation, is_alive, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) ON CONFLICT DO NOTHING',
        [p.id, p.family_id, p.first_name, p.last_name, p.gender, p.dob, p.dod, p.birthplace, p.occupation, p.bio, p.photo_url, p.generation, p.is_alive, p.created_at, p.updated_at]
      );
    }
    await client.query("SELECT setval('persons_id_seq', (SELECT MAX(id) FROM persons))");

    const rels = db.prepare('SELECT * FROM relationships').all();
    console.log(`Migrating ${rels.length} relationships...`);
    for (const r of rels) {
      await client.query(
        'INSERT INTO relationships (id, parent_id, child_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [r.id, r.parent_id, r.child_id]
      );
    }
    await client.query("SELECT setval('relationships_id_seq', (SELECT MAX(id) FROM relationships))");

    const marriages = db.prepare('SELECT * FROM marriages').all();
    console.log(`Migrating ${marriages.length} marriages...`);
    for (const m of marriages) {
      await client.query(
        'INSERT INTO marriages (id, person1_id, person2_id, married_on, divorced_on) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
        [m.id, m.person1_id, m.person2_id, m.married_on, m.divorced_on]
      );
    }
    await client.query("SELECT setval('marriages_id_seq', (SELECT MAX(id) FROM marriages))");

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
