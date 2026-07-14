/**
 * import_excel.js
 * Imports Family_Master_Sheet_Auto_ID_With_Filters.xlsx into the Family Tracker DB.
 *
 * Run: node import_excel.js
 */

require('dotenv').config();
const XLSX = require('xlsx');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const FILE = 'Family_Master_Sheet_Auto_ID_With_Filters.xlsx';

// ── Helpers ──────────────────────────────────────────────────────────────────

function toGender(g) {
  if (!g) return 'other';
  const v = String(g).trim().toUpperCase();
  if (v === 'M') return 'male';
  if (v === 'F') return 'female';
  return 'other';
}

function isAlive(val) {
  if (!val || val === '') return 1;
  const v = String(val).trim().toLowerCase();
  if (v.includes('dec') || v === 'd' || v === 'dead' || v === 'no') return 0;
  return 1;
}

function cleanName(n) {
  return n ? String(n).trim() : '';
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const client = await pool.connect();

  try {
    console.log('\n📂 Reading Excel file...');
    const wb = XLSX.readFile(FILE);

    // Collect all rows from all sheets, attaching the sheet/family name
    let allRows = [];
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      rows.forEach(r => { r.__sheet = sheetName; });
      allRows = allRows.concat(rows);
    }

    console.log(`📊 Total rows across all sheets: ${allRows.length}`);

    // Filter out blank rows (no Name and no ID)
    allRows = allRows.filter(r => cleanName(r['Name']) !== '' || cleanName(r['ID (AUTO)']) !== '');
    allRows = allRows.filter(r => cleanName(r['Name']) !== '');

    console.log(`✅ Valid rows after filtering: ${allRows.length}`);

    // ── Step 1: Ensure a default family exists ──────────────────────────────
    // Each sheet represents a branch; we'll use one family "Family Tracker Import"
    // and store branch info in the bio/notes field.
    // We create one family per sheet name.

    console.log('\n🏠 Creating families (one per sheet)...');
    const familyMap = {}; // sheetName -> family_id

    for (const sheetName of wb.SheetNames) {
      const res = await client.query(
        `INSERT INTO families (family_name, description)
         VALUES ($1, $2)
         ON CONFLICT (family_name) DO UPDATE SET family_name = EXCLUDED.family_name
         RETURNING id`,
        [sheetName, `Imported from sheet: ${sheetName}`]
      );
      familyMap[sheetName] = res.rows[0].id;
      console.log(`  ✅ Family "${sheetName}" -> id ${res.rows[0].id}`);
    }

    // ── Step 2: Insert all persons ──────────────────────────────────────────
    console.log('\n👥 Inserting persons...');

    // Map from Excel ID (AUTO) -> DB person id
    const idMap = {};       // excelId -> db_id
    const nameToDbId = {};  // "Name|sheetName" -> db_id (for spouse lookup)

    let inserted = 0;
    let skipped = 0;

    for (const row of allRows) {
      const excelId   = cleanName(row['ID (AUTO)']);
      const name      = cleanName(row['Name']);
      const gender    = toGender(row['Gender']);
      const alive     = isAlive(row['Alive / Deceased']);
      const gen       = parseInt(row['Generation']) || 1;
      const notes     = cleanName(row['Notes']);
      const address   = cleanName(row['Address']);
      const contact   = cleanName(row['Contact Number']);
      const familyId  = familyMap[row['__sheet']];

      // Build bio from available info
      const bioParts = [];
      if (address)  bioParts.push(`Address: ${address}`);
      if (contact)  bioParts.push(`Contact: ${contact}`);
      if (notes)    bioParts.push(notes);
      const bio = bioParts.join(' | ') || null;

      // Skip if already inserted (dedup by excelId within session)
      if (excelId && idMap[excelId]) {
        skipped++;
        continue;
      }

      // Split name into first/last
      const nameParts = name.split(' ');
      const firstName = nameParts[0] || name;
      const lastName  = nameParts.slice(1).join(' ') || '';

      const res = await client.query(
        `INSERT INTO persons
           (family_id, first_name, last_name, gender, is_alive, generation, bio)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [familyId, firstName, lastName, gender, alive, gen, bio]
      );

      const dbId = res.rows[0].id;

      if (excelId) idMap[excelId] = dbId;
      nameToDbId[`${name}|${row['__sheet']}`] = dbId;
      inserted++;

      if (inserted % 100 === 0) process.stdout.write(`  ...${inserted} inserted\n`);
    }

    console.log(`\n  ✅ Inserted: ${inserted}`);
    console.log(`  ⏭️  Skipped (dup IDs): ${skipped}`);

    // ── Step 3: Link parent → child relationships ───────────────────────────
    console.log('\n🔗 Linking parent-child relationships...');

    let relLinked = 0;
    let relFailed = 0;

    for (const row of allRows) {
      const childExcelId  = cleanName(row['ID (AUTO)']);
      const parentExcelId = cleanName(row['Parent ID']);

      if (!childExcelId || !parentExcelId) continue;

      const childDbId  = idMap[childExcelId];
      const parentDbId = idMap[parentExcelId];

      if (!childDbId || !parentDbId) {
        relFailed++;
        continue;
      }

      try {
        await client.query(
          `INSERT INTO relationships (parent_id, child_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [parentDbId, childDbId]
        );
        relLinked++;
      } catch (e) {
        relFailed++;
      }
    }

    console.log(`  ✅ Relationships linked: ${relLinked}`);
    console.log(`  ⚠️  Relationships skipped/failed: ${relFailed}`);

    // ── Step 4: Link marriages (Spouse Name) ────────────────────────────────
    console.log('\n💍 Linking marriages...');

    let marriageLinked = 0;
    let marriageFailed = 0;

    for (const row of allRows) {
      const personExcelId = cleanName(row['ID (AUTO)']);
      const spouseName    = cleanName(row['Spouse Name']);
      const spouseId      = cleanName(row['Spouse ID']);
      const marriedOn     = null; // not in the sheet

      if (!spouseName || !personExcelId) continue;

      const personDbId = idMap[personExcelId];
      if (!personDbId) continue;

      // Try to find spouse by Spouse ID first, then by name in same sheet
      let spouseDbId = spouseId ? idMap[spouseId] : null;

      if (!spouseDbId) {
        // Try name match in same sheet
        spouseDbId = nameToDbId[`${spouseName}|${row['__sheet']}`];
      }

      if (!spouseDbId) {
        // Try name match across all sheets
        const nameKey = Object.keys(nameToDbId).find(k => k.startsWith(spouseName + '|'));
        if (nameKey) spouseDbId = nameToDbId[nameKey];
      }

      if (!spouseDbId) {
        // Spouse not in our DB — insert them as a minimal record
        const sheetFamilyId = familyMap[row['__sheet']];
        const spouseGender = toGender(row['Gender_1']);
        const spouseAlive  = isAlive(row['Alive / Deceased_1']);
        const spouseContact = cleanName(row['Contact Number_1']);
        const nameParts = spouseName.split(' ');
        const spouseFirst = nameParts[0];
        const spouseLast  = nameParts.slice(1).join(' ') || '';

        const sRes = await client.query(
          `INSERT INTO persons (family_id, first_name, last_name, gender, is_alive, generation, bio)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [sheetFamilyId, spouseFirst, spouseLast, spouseGender, spouseAlive,
           parseInt(row['Generation']) || 1,
           spouseContact ? `Contact: ${spouseContact}` : null]
        );
        spouseDbId = sRes.rows[0].id;
        nameToDbId[`${spouseName}|${row['__sheet']}`] = spouseDbId;
        inserted++;
      }

      // Ensure person1_id < person2_id to satisfy UNIQUE constraint
      const [p1, p2] = personDbId < spouseDbId
        ? [personDbId, spouseDbId]
        : [spouseDbId, personDbId];

      try {
        await client.query(
          `INSERT INTO marriages (person1_id, person2_id, married_on)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [p1, p2, marriedOn]
        );
        marriageLinked++;
      } catch (e) {
        marriageFailed++;
      }
    }

    console.log(`  ✅ Marriages linked: ${marriageLinked}`);
    console.log(`  ⚠️  Marriages skipped/failed: ${marriageFailed}`);

    // ── Final Summary ───────────────────────────────────────────────────────
    const countRes = await client.query('SELECT COUNT(*) FROM persons');
    const relRes   = await client.query('SELECT COUNT(*) FROM relationships');
    const marRes   = await client.query('SELECT COUNT(*) FROM marriages');

    console.log('\n════════════════════════════════════════');
    console.log('🎉 IMPORT COMPLETE!');
    console.log(`   Total persons in DB  : ${countRes.rows[0].count}`);
    console.log(`   Total relationships  : ${relRes.rows[0].count}`);
    console.log(`   Total marriages      : ${marRes.rows[0].count}`);
    console.log('════════════════════════════════════════\n');

  } catch (err) {
    console.error('\n❌ Import failed:', err.message);
    console.error(err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
