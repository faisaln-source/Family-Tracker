const db = require('../db/database');

/**
 * Build a recursive descendants tree starting from a given ancestor.
 * Uses SQLite recursive CTE.
 */
const buildDescendantsTree = (ancestorId, globalSeenChildren = null) => {
  // CTE carries tree_parent_id so we know which parent edge was used to reach each node.
  // Using UNION (not UNION ALL) de-duplicates at SQL level; in JS we also guard with
  // linkedAsChild so a node with two parents only appears under the first one encountered.
  const all = db.prepare(`
    WITH RECURSIVE descendants(
      id, first_name, last_name, gender, photo_url,
      generation, is_alive, family_id, dob, dod,
      occupation, birthplace, bio, depth, tree_parent_id
    ) AS (
      SELECT p.id, p.first_name, p.last_name, p.gender, p.photo_url,
             p.generation, p.is_alive, p.family_id, p.dob, p.dod,
             p.occupation, p.birthplace, p.bio, 0, NULL
      FROM   persons p WHERE p.id = ?

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
  `).all(ancestorId);

  // Build node map (first occurrence wins)
  const map = {};
  const visited = new Set();
  all.forEach(p => {
    if (!visited.has(p.id)) {
      visited.add(p.id);
      map[p.id] = { ...p, children: [], spouses: [] };
    }
  });

  // Attach spouses
  const ids = Object.keys(map);
  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    const spouseRows = db.prepare(`
      SELECT m.person1_id, m.person2_id, m.married_on,
             p.id AS sp_id, p.first_name, p.last_name, p.gender,
             p.photo_url, p.generation, p.is_alive,
             f.id AS sp_family_id, f.family_name AS sp_family_name, f.color AS sp_family_color
      FROM   marriages m
      JOIN   persons p ON p.id = CASE
               WHEN m.person1_id IN (${placeholders}) AND m.person2_id IN (${placeholders})
                 THEN m.person2_id
               WHEN m.person1_id IN (${placeholders}) THEN m.person2_id
               ELSE m.person1_id
             END
      LEFT JOIN families f ON f.id = p.family_id
      WHERE  m.person1_id IN (${placeholders}) OR m.person2_id IN (${placeholders})
    `).all(...ids, ...ids, ...ids, ...ids, ...ids);

    const spouseAdded = new Set();
    spouseRows.forEach(row => {
      // attach spouse to the in-tree member
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

  // Wire parent → child.  linkedAsChild ensures each node appears under exactly ONE parent.
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

// ── Helper to gather all IDs in a tree ──────────────────────────────────────
const gatherIds = (node, set) => {
  if (!node) return;
  set.add(node.id);
  if (node.spouses) node.spouses.forEach(s => set.add(s.id));
  if (node.children) node.children.forEach(c => gatherIds(c, set));
};

// ── GET full tree for a family ──────────────────────────────────────────────
const getFamilyTree = (req, res) => {
  try {
    const familyId = req.params.familyId;

    // Find generation 1 roots for this family
    const roots = db.prepare(`
      SELECT p.id FROM persons p
      LEFT JOIN relationships r ON r.child_id = p.id
      WHERE p.family_id = ? AND r.parent_id IS NULL
      ORDER BY p.first_name
    `).all(familyId);

    const trees = [];
    const seen = new Set();
    roots.forEach(r => {
      if (seen.has(r.id)) return;
      const tree = buildDescendantsTree(r.id);
      if (tree) {
        trees.push(tree);
        gatherIds(tree, seen);
      }
    });

    const family = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);
    res.json({ success: true, family, data: trees });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET tree from a specific ancestor ──────────────────────────────────────
const getAncestorTree = (req, res) => {
  try {
    const tree = buildDescendantsTree(parseInt(req.params.id));
    if (!tree) return res.status(404).json({ success: false, error: 'Ancestor not found' });
    res.json({ success: true, data: tree });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET all families trees (overview) ──────────────────────────────────────
const getAllTrees = (req, res) => {
  try {
    const roots = db.prepare(`
      SELECT p.id FROM persons p
      LEFT JOIN relationships r ON r.child_id = p.id
      WHERE r.parent_id IS NULL
      ORDER BY p.generation, p.first_name
    `).all();

    const trees = [];
    const globalSeenChildren = new Set();
    roots.forEach(r => {
      const tree = buildDescendantsTree(r.id, globalSeenChildren);
      if (tree) {
        trees.push(tree);
      }
    });

    res.json({ success: true, data: trees });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET ancestors of a person (upward) ─────────────────────────────────────
const getAncestors = (req, res) => {
  try {
    const ancestors = db.prepare(`
      WITH RECURSIVE anc AS (
        SELECT p.*, 0 AS depth
        FROM   persons p WHERE p.id = ?

        UNION ALL

        SELECT p.*, a.depth + 1
        FROM   persons p
        JOIN   relationships r ON r.child_id = p.id
        JOIN   anc a ON a.id = r.child_id  -- corrected: a.parent links
      )
      SELECT * FROM anc ORDER BY depth
    `).all(req.params.id);

    // Actually let's do the correct upward traversal
    const ancestors2 = db.prepare(`
      WITH RECURSIVE anc(id, first_name, last_name, gender, photo_url, generation, depth) AS (
        SELECT p.id, p.first_name, p.last_name, p.gender, p.photo_url, p.generation, 0
        FROM persons p WHERE p.id = ?

        UNION ALL

        SELECT p.id, p.first_name, p.last_name, p.gender, p.photo_url, p.generation, anc.depth + 1
        FROM persons p
        JOIN relationships r ON r.parent_id = p.id
        JOIN anc ON anc.id = r.child_id
      )
      SELECT * FROM anc WHERE depth > 0 ORDER BY depth
    `).all(req.params.id);

    res.json({ success: true, data: ancestors2 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Dashboard stats ─────────────────────────────────────────────────────────
const getStats = (req, res) => {
  try {
    const totalPersons  = db.prepare('SELECT COUNT(*) AS c FROM persons').get().c;
    const totalFamilies = db.prepare('SELECT COUNT(*) AS c FROM families').get().c;
    const totalMarriages = db.prepare('SELECT COUNT(*) AS c FROM marriages').get().c;
    const alive   = db.prepare('SELECT COUNT(*) AS c FROM persons WHERE is_alive = 1').get().c;
    const deceased = db.prepare('SELECT COUNT(*) AS c FROM persons WHERE is_alive = 0').get().c;

    const byGeneration = db.prepare(`
      SELECT generation, COUNT(*) AS count,
             SUM(CASE WHEN gender='male' THEN 1 ELSE 0 END) AS male,
             SUM(CASE WHEN gender='female' THEN 1 ELSE 0 END) AS female
      FROM persons GROUP BY generation ORDER BY generation
    `).all();

    const byFamily = db.prepare(`
      SELECT f.family_name, f.color, COUNT(p.id) AS count
      FROM families f
      LEFT JOIN persons p ON p.family_id = f.id
      GROUP BY f.id ORDER BY count DESC
    `).all();

    const maxGen = db.prepare('SELECT MAX(generation) AS g FROM persons').get().g || 0;

    res.json({
      success: true,
      data: {
        totalPersons, totalFamilies, totalMarriages,
        alive, deceased, maxGeneration: maxGen,
        byGeneration, byFamily
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Recalculate all generations from scratch ────────────────────────────────
const cascadeGenerations = (personId, newGeneration) => {
  db.prepare("UPDATE persons SET generation = ?, updated_at = datetime('now') WHERE id = ?").run(newGeneration, personId);
  const children = db.prepare('SELECT child_id FROM relationships WHERE parent_id = ?').all(personId);
  children.forEach(c => cascadeGenerations(c.child_id, newGeneration + 1));
};

const recalculateGenerations = (req, res) => {
  try {
    // Find all root persons (no parents) and cascade from them
    const roots = db.prepare(`
      SELECT p.id, p.generation FROM persons p
      LEFT JOIN relationships r ON r.child_id = p.id
      WHERE r.parent_id IS NULL
    `).all();

    let updated = 0;
    const recalculate = db.transaction(() => {
      roots.forEach(root => {
        cascadeGenerations(root.id, root.generation);
        updated++;
      });
    });
    recalculate();

    res.json({ success: true, message: `Recalculated from ${updated} root(s)` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { getFamilyTree, getAncestorTree, getAllTrees, getAncestors, getStats, recalculateGenerations };
