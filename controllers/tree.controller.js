const pool = require('../db/database');

// ── Build a recursive descendants tree ──────────────────────────────────────
const buildDescendantsTree = async (ancestorId, globalSeenChildren = null) => {
  const { rows: all } = await pool.query(`
    WITH RECURSIVE descendants(
      id, first_name, last_name, gender, photo_url,
      generation, is_alive, family_id, dob, dod,
      occupation, birthplace, bio, depth, tree_parent_id
    ) AS (
      SELECT p.id, p.first_name, p.last_name, p.gender, p.photo_url,
             p.generation, p.is_alive, p.family_id, p.dob, p.dod,
             p.occupation, p.birthplace, p.bio, 0, NULL::int
      FROM   persons p WHERE p.id = $1

      UNION

      SELECT p.id, p.first_name, p.last_name, p.gender, p.photo_url,
             p.generation, p.is_alive, p.family_id, p.dob, p.dod,
             p.occupation, p.birthplace, p.bio, d.depth + 1, d.id
      FROM   persons p
      JOIN   relationships r ON r.child_id = p.id
      JOIN   descendants d  ON d.id = r.parent_id
    )
    SELECT d.*, f.family_name, f.color AS family_color
    FROM   descendants d
    LEFT JOIN families f ON f.id = d.family_id
    ORDER BY d.depth
  `, [ancestorId]);

  const map = {};
  const visited = new Set();
  all.forEach(p => {
    if (!visited.has(p.id)) {
      visited.add(p.id);
      map[p.id] = { ...p, children: [], spouses: [] };
    }
  });

  const ids = Object.keys(map).map(id => parseInt(id));
  if (ids.length > 0) {
    const { rows: spouseRows } = await pool.query(`
      SELECT m.person1_id, m.person2_id, m.married_on,
             p.id AS sp_id, p.first_name, p.last_name, p.gender,
             p.photo_url, p.generation, p.is_alive,
             f.id AS sp_family_id, f.family_name AS sp_family_name, f.color AS sp_family_color
      FROM   marriages m
      JOIN   persons p ON p.id = CASE
               WHEN m.person1_id = ANY($1::int[]) AND m.person2_id = ANY($1::int[])
                 THEN m.person2_id
               WHEN m.person1_id = ANY($1::int[]) THEN m.person2_id
               ELSE m.person1_id
             END
      LEFT JOIN families f ON f.id = p.family_id
      WHERE  m.person1_id = ANY($1::int[]) OR m.person2_id = ANY($1::int[])
    `, [ids]);

    const spouseAdded = new Set();
    spouseRows.forEach(row => {
      const ownerId = map[row.person1_id] ? row.person1_id : row.person2_id;
      const key = `${ownerId}-${row.sp_id}`;
      if (map[ownerId] && !spouseAdded.has(key)) {
        spouseAdded.add(key);
        map[ownerId].spouses.push({
          id: row.sp_id,
          first_name: row.first_name,
          last_name: row.last_name,
          gender: row.gender,
          photo_url: row.photo_url,
          generation: row.generation,
          is_alive: row.is_alive,
          family_id: row.sp_family_id,
          family_name: row.sp_family_name,
          family_color: row.sp_family_color,
          married_on: row.married_on
        });
      }
    });
  }

  const linkedAsChild = new Set();
  all.forEach(p => {
    if (p.tree_parent_id && map[p.tree_parent_id] && map[p.id] && !linkedAsChild.has(p.id)) {
      if (globalSeenChildren && globalSeenChildren.has(p.id)) return;
      linkedAsChild.add(p.id);
      if (globalSeenChildren) globalSeenChildren.add(p.id);
      map[p.tree_parent_id].children.push(map[p.id]);
    }
  });

  return map[ancestorId] || null;
};

const gatherIds = (node, set) => {
  if (!node) return;
  set.add(node.id);
  if (node.spouses) node.spouses.forEach(s => set.add(s.id));
  if (node.children) node.children.forEach(c => gatherIds(c, set));
};

// ── GET full tree for a family ──────────────────────────────────────────────
const getFamilyTree = async (req, res) => {
  try {
    const familyId = parseInt(req.params.familyId);
    const { rows: roots } = await pool.query(`
      SELECT p.id FROM persons p
      LEFT JOIN relationships r ON r.child_id = p.id
      WHERE p.family_id = $1 AND r.parent_id IS NULL
      ORDER BY p.first_name
    `, [familyId]);

    const trees = [];
    const seen = new Set();
    
    for (const r of roots) {
      if (seen.has(r.id)) continue;
      const tree = await buildDescendantsTree(r.id);
      if (tree) {
        trees.push(tree);
        gatherIds(tree, seen);
      }
    }

    const { rows: families } = await pool.query('SELECT * FROM families WHERE id = $1', [familyId]);
    res.json({ success: true, family: families[0], data: trees });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET tree from a specific ancestor ──────────────────────────────────────
const getAncestorTree = async (req, res) => {
  try {
    const tree = await buildDescendantsTree(parseInt(req.params.id));
    if (!tree) return res.status(404).json({ success: false, error: 'Ancestor not found' });
    res.json({ success: true, data: tree });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET all families trees (overview) ──────────────────────────────────────
const getAllTrees = async (req, res) => {
  try {
    const { rows: roots } = await pool.query(`
      SELECT p.id FROM persons p
      LEFT JOIN relationships r ON r.child_id = p.id
      WHERE r.parent_id IS NULL
      ORDER BY p.generation, p.first_name
    `);

    const trees = [];
    const globalSeenChildren = new Set();
    
    for (const r of roots) {
      const tree = await buildDescendantsTree(r.id, globalSeenChildren);
      if (tree) {
        trees.push(tree);
      }
    }

    res.json({ success: true, data: trees });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET ancestors of a person (upward) ─────────────────────────────────────
const getAncestors = async (req, res) => {
  try {
    const { rows: ancestors } = await pool.query(`
      WITH RECURSIVE anc(id, first_name, last_name, gender, photo_url, generation, depth) AS (
        SELECT p.id, p.first_name, p.last_name, p.gender, p.photo_url, p.generation, 0
        FROM persons p WHERE p.id = $1

        UNION ALL

        SELECT p.id, p.first_name, p.last_name, p.gender, p.photo_url, p.generation, anc.depth + 1
        FROM persons p
        JOIN relationships r ON r.parent_id = p.id
        JOIN anc ON anc.id = r.child_id
      )
      SELECT * FROM anc WHERE depth > 0 ORDER BY depth
    `, [req.params.id]);

    res.json({ success: true, data: ancestors });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Dashboard stats ─────────────────────────────────────────────────────────
const getStats = async (req, res) => {
  try {
    const [
      { rows: [rPersons] }, { rows: [rFamilies] }, { rows: [rMarriages] },
      { rows: [rAlive] }, { rows: [rDeceased] },
      { rows: byGen }, { rows: byFam }, { rows: [rMaxGen] }
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) AS c FROM persons'),
      pool.query('SELECT COUNT(*) AS c FROM families'),
      pool.query('SELECT COUNT(*) AS c FROM marriages'),
      pool.query('SELECT COUNT(*) AS c FROM persons WHERE is_alive = 1'),
      pool.query('SELECT COUNT(*) AS c FROM persons WHERE is_alive = 0'),
      pool.query(`
        SELECT generation, COUNT(*) AS count,
               SUM(CASE WHEN gender='male' THEN 1 ELSE 0 END) AS male,
               SUM(CASE WHEN gender='female' THEN 1 ELSE 0 END) AS female
        FROM persons GROUP BY generation ORDER BY generation
      `),
      pool.query(`
        SELECT f.family_name, f.color, COUNT(p.id) AS count
        FROM families f
        LEFT JOIN persons p ON p.family_id = f.id
        GROUP BY f.id, f.family_name, f.color ORDER BY count DESC
      `),
      pool.query('SELECT MAX(generation) AS g FROM persons')
    ]);

    res.json({
      success: true,
      data: {
        totalPersons: parseInt(rPersons.c),
        totalFamilies: parseInt(rFamilies.c),
        totalMarriages: parseInt(rMarriages.c),
        alive: parseInt(rAlive.c),
        deceased: parseInt(rDeceased.c),
        maxGeneration: rMaxGen.g || 0,
        byGeneration: byGen,
        byFamily: byFam
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Recalculate all generations from scratch ────────────────────────────────
const cascadeGenerations = async (client, personId, newGeneration) => {
  await client.query("UPDATE persons SET generation = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [newGeneration, personId]);
  const { rows: children } = await client.query('SELECT child_id FROM relationships WHERE parent_id = $1', [personId]);
  for (const c of children) {
    await cascadeGenerations(client, c.child_id, newGeneration + 1);
  }
};

const recalculateGenerations = async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows: roots } = await client.query(`
      SELECT p.id, p.generation FROM persons p
      LEFT JOIN relationships r ON r.child_id = p.id
      WHERE r.parent_id IS NULL
    `);

    await client.query('BEGIN');
    let updated = 0;
    for (const root of roots) {
      await cascadeGenerations(client, root.id, root.generation);
      updated++;
    }
    await client.query('COMMIT');

    res.json({ success: true, message: `Recalculated from ${updated} root(s)` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
};

module.exports = { getFamilyTree, getAncestorTree, getAllTrees, getAncestors, getStats, recalculateGenerations };
