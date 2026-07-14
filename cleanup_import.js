require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('\n🗑️  Deleting all imported data...\n');

    await client.query('DELETE FROM marriages');
    console.log('  ✅ Marriages cleared');

    await client.query('DELETE FROM relationships');
    console.log('  ✅ Relationships cleared');

    await client.query('DELETE FROM persons');
    console.log('  ✅ Persons cleared');

    await client.query('DELETE FROM families');
    console.log('  ✅ Families cleared');

    // Reset auto-increment sequences
    await client.query(`ALTER SEQUENCE persons_id_seq RESTART WITH 1`);
    await client.query(`ALTER SEQUENCE families_id_seq RESTART WITH 1`);
    await client.query(`ALTER SEQUENCE relationships_id_seq RESTART WITH 1`);
    await client.query(`ALTER SEQUENCE marriages_id_seq RESTART WITH 1`);
    console.log('  ✅ ID sequences reset to 1');

    const p = await client.query('SELECT COUNT(*) FROM persons');
    const f = await client.query('SELECT COUNT(*) FROM families');
    console.log(`\n════════════════════════════════`);
    console.log(`✅ Done! DB is now clean.`);
    console.log(`   Persons  : ${p.rows[0].count}`);
    console.log(`   Families : ${f.rows[0].count}`);
    console.log(`════════════════════════════════\n`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
