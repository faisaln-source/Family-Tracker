const db = require('../db/database');
const { broadcastUpdate } = require('../sse');

// ── GET all persons (with filters) ─────────────────────────────────────────
const getAllPersons = (req, res) => {
  try {
    const { family_id, generation, gender, is_alive, q } = req.query;

    let query = `
      SELECT p.*,
             f.family_name, f.color AS family_color,
             GROUP_CONCAT(DISTINCT m.person1_id || ',' || m.person2_id) AS marriages_raw
      FROM   persons p
      LEFT JOIN families f ON f.id = p.family_id
      LEFT JOIN marriages m ON (m.person1_id = p.id OR m.person2_id = p.id)
      WHERE 1=1
    `;
    const params = [];

    if (family_id) { query += ' AND p.family_id = ?';    params.push(family_id); }
    if (generation) { query += ' AND p.generation = ?'; params.push(generation); }
    if (gender)     { query += ' AND p.gender = ?';     params.push(gender); }
    if (is_alive !== undefined) { query += ' AND p.is_alive = ?'; params.push(is_alive); }
    if (q) {
      query += ` AND (p.first_name LIKE ? OR p.last_name LIKE ? OR p.birthplace LIKE ? OR p.occupation LIKE ?)`;
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }

    query += ' GROUP BY p.id ORDER BY p.generation, p.first_name';

    const persons = db.prepare(query).all(...params);
    res.json({ success: true, data: persons, total: persons.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET single person with full relations ───────────────────────────────────
const getPersonById = (req, res) => {
  try {
    const person = db.prepare(`
      SELECT p.*, f.family_name, f.color AS family_color
      FROM   persons p
      LEFT JOIN families f ON f.id = p.family_id
      WHERE  p.id = ?
    `).get(req.params.id);

    if (!person) return res.status(404).json({ success: false, error: 'Person not found' });

    // Parents
    const parents = db.prepare(`
      SELECT p.id, p.first_name, p.last_name, p.gender, p.photo_url, p.generation
      FROM   relationships r
      JOIN   persons p ON p.id = r.parent_id
      WHERE  r.child_id = ?
    `).all(req.params.id);

    // Children
    const children = db.prepare(`
      SELECT p.id, p.first_name, p.last_name, p.gender, p.photo_url, p.generation, p.is_alive
      FROM   relationships r
      JOIN   persons p ON p.id = r.child_id
      WHERE  r.parent_id = ?
      ORDER  BY p.generation, p.first_name
    `).all(req.params.id);

    // Siblings
    const siblings = db.prepare(`
      SELECT DISTINCT p.id, p.first_name, p.last_name, p.gender, p.photo_url, p.generation
      FROM   relationships r1
      JOIN   relationships r2 ON r2.parent_id = r1.parent_id
      JOIN   persons p ON p.id = r2.child_id
      WHERE  r1.child_id = ? AND r2.child_id != ?
    `).all(req.params.id, req.params.id);

    // Spouses
    const spouses = db.prepare(`
      SELECT p.id, p.first_name, p.last_name, p.gender, p.photo_url,
             m.married_on, m.divorced_on
      FROM   marriages m
      JOIN   persons p ON p.id = CASE WHEN m.person1_id = ? THEN m.person2_id ELSE m.person1_id END
      WHERE  m.person1_id = ? OR m.person2_id = ?
    `).all(req.params.id, req.params.id, req.params.id);

    res.json({
      success: true,
      data: { ...person, parents, children, siblings, spouses }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── CREATE person ───────────────────────────────────────────────────────────
const createPerson = (req, res) => {
  try {
    const {
      family_id, first_name, last_name, gender, dob, dod,
      birthplace, occupation, bio, generation, is_alive,
      parent_ids, spouse_id, spouse_married_on
    } = req.body;

    if (!first_name) return res.status(400).json({ success: false, error: 'first_name is required' });

    // Auto-derive generation from parent if parent_ids provided
    let resolvedGeneration = generation ? parseInt(generation) : null;
    if (parent_ids) {
      const firstParentId = Array.isArray(parent_ids) ? parent_ids[0] : parent_ids;
      const parentRow = db.prepare('SELECT generation FROM persons WHERE id = ?').get(parseInt(firstParentId));
      if (parentRow) resolvedGeneration = parentRow.generation + 1;
    }
    if (!resolvedGeneration) return res.status(400).json({ success: false, error: 'generation is required (or provide parent_ids to auto-derive)' });

    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

    const insertPerson = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO persons
          (family_id, first_name, last_name, gender, dob, dod,
           birthplace, occupation, bio, photo_url, generation, is_alive)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        family_id || null, first_name, last_name || null,
        gender || 'male', dob || null, dod || null,
        birthplace || null, occupation || null, bio || null,
        photo_url, resolvedGeneration, is_alive !== undefined ? parseInt(is_alive) : 1
      );

      const personId = result.lastInsertRowid;

      // Link parents
      if (parent_ids) {
        const ids = Array.isArray(parent_ids) ? parent_ids : [parent_ids];
        const insertRel = db.prepare('INSERT OR IGNORE INTO relationships (parent_id, child_id) VALUES (?, ?)');
        ids.forEach(pid => insertRel.run(parseInt(pid), personId));
      }

      // Link spouse
      if (spouse_id) {
        const p1 = Math.min(personId, parseInt(spouse_id));
        const p2 = Math.max(personId, parseInt(spouse_id));
        db.prepare('INSERT OR IGNORE INTO marriages (person1_id, person2_id, married_on) VALUES (?, ?, ?)')
          .run(p1, p2, spouse_married_on || null);
      }

      return personId;
    });

    const personId = insertPerson();
    const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(personId);
    broadcastUpdate('person_created');
    res.status(201).json({ success: true, data: person });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── UPDATE person ───────────────────────────────────────────────────────────
const updatePerson = (req, res) => {
  try {
    const {
      family_id, first_name, last_name, gender, dob, dod,
      birthplace, occupation, bio, generation, is_alive
    } = req.body;

    const photo_url = req.file ? `/uploads/${req.file.filename}` : undefined;

    const setClauses = [];
    const params = [];

    const set = (col, val) => { if (val !== undefined) { setClauses.push(`${col} = ?`); params.push(val); } };

    set('family_id',   family_id);
    set('first_name',  first_name);
    set('last_name',   last_name);
    set('gender',      gender);
    set('dob',         dob);
    set('dod',         dod);
    set('birthplace',  birthplace);
    set('occupation',  occupation);
    set('bio',         bio);
    set('generation',  generation ? parseInt(generation) : undefined);
    set('is_alive',    is_alive !== undefined ? parseInt(is_alive) : undefined);
    if (photo_url) set('photo_url', photo_url);

    setClauses.push(`updated_at = datetime('now')`);
    params.push(req.params.id);

    db.prepare(`UPDATE persons SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);

    const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(req.params.id);
    if (!person) return res.status(404).json({ success: false, error: 'Person not found' });
    broadcastUpdate('person_updated');
    res.json({ success: true, data: person });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── DELETE person ───────────────────────────────────────────────────────────
const deletePerson = (req, res) => {
  try {
    const result = db.prepare('DELETE FROM persons WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ success: false, error: 'Person not found' });
    broadcastUpdate('person_deleted');
    res.json({ success: true, message: 'Person deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET by generation ───────────────────────────────────────────────────────
const getByGeneration = (req, res) => {
  try {
    const gen = parseInt(req.params.gen);
    const persons = db.prepare(`
      SELECT p.*, f.family_name, f.color AS family_color
      FROM   persons p
      LEFT JOIN families f ON f.id = p.family_id
      WHERE  p.generation = ?
      ORDER  BY f.family_name, p.first_name
    `).all(gen);

    const stats = {
      total: persons.length,
      male: persons.filter(p => p.gender === 'male').length,
      female: persons.filter(p => p.gender === 'female').length,
      alive: persons.filter(p => p.is_alive).length,
      deceased: persons.filter(p => !p.is_alive).length,
    };

    res.json({ success: true, generation: gen, stats, data: persons });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Helper: cascade generation update down through all descendants ──────────
const cascadeGenerations = (personId, newGeneration) => {
  db.prepare("UPDATE persons SET generation = ?, updated_at = datetime('now') WHERE id = ?").run(newGeneration, personId);
  const children = db.prepare('SELECT child_id FROM relationships WHERE parent_id = ?').all(personId);
  children.forEach(c => cascadeGenerations(c.child_id, newGeneration + 1));
};

// ── ADD parent relationship ─────────────────────────────────────────────────
const addRelationship = (req, res) => {
  try {
    const { parent_id, child_id } = req.body;

    const parent = db.prepare('SELECT generation FROM persons WHERE id = ?').get(parent_id);
    if (!parent) return res.status(404).json({ success: false, error: 'Parent not found' });

    db.prepare('INSERT OR IGNORE INTO relationships (parent_id, child_id) VALUES (?, ?)').run(parent_id, child_id);

    // Auto-update child's generation and cascade to all their descendants
    cascadeGenerations(child_id, parent.generation + 1);

    res.json({ success: true, message: 'Relationship added', childGeneration: parent.generation + 1 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── ADD marriage ────────────────────────────────────────────────────────────
const addMarriage = (req, res) => {
  try {
    const { person1_id, person2_id, married_on, divorced_on } = req.body;
    const p1 = Math.min(person1_id, person2_id);
    const p2 = Math.max(person1_id, person2_id);
    db.prepare('INSERT OR IGNORE INTO marriages (person1_id, person2_id, married_on, divorced_on) VALUES (?, ?, ?, ?)')
      .run(p1, p2, married_on || null, divorced_on || null);
    res.json({ success: true, message: 'Marriage added' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── REMOVE parent relationship ─────────────────────────────────────────────
const removeRelationship = (req, res) => {
  try {
    const { parent_id, child_id } = req.body;
    const result = db.prepare('DELETE FROM relationships WHERE parent_id = ? AND child_id = ?').run(parent_id, child_id);
    if (result.changes === 0) return res.status(404).json({ success: false, error: 'Relationship not found' });
    broadcastUpdate('relationship_removed');
    res.json({ success: true, message: 'Relationship removed' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── REMOVE marriage ─────────────────────────────────────────────────────────
const removeMarriage = (req, res) => {
  try {
    const { person1_id, person2_id } = req.body;
    const p1 = Math.min(person1_id, person2_id);
    const p2 = Math.max(person1_id, person2_id);
    db.prepare('DELETE FROM marriages WHERE person1_id = ? AND person2_id = ?').run(p1, p2);
    res.json({ success: true, message: 'Marriage removed' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

module.exports = {
  getAllPersons, getPersonById, createPerson, updatePerson,
  deletePerson, getByGeneration, addRelationship, addMarriage,
  removeRelationship, removeMarriage
};
