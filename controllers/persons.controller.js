const pool = require('../db/database');
const { broadcastUpdate } = require('../sse');

// ── GET all persons (with filters) ─────────────────────────────────────────
const getAllPersons = async (req, res) => {
  try {
    const { family_id, generation, gender, is_alive, q } = req.query;

    let query = `
      SELECT p.*,
             f.family_name, f.color AS family_color,
             STRING_AGG(DISTINCT m.person1_id || ',' || m.person2_id, ',') AS marriages_raw
      FROM   persons p
      LEFT JOIN families f ON f.id = p.family_id
      LEFT JOIN marriages m ON (m.person1_id = p.id OR m.person2_id = p.id)
      WHERE 1=1
    `;
    const params = [];
    let paramIdx = 1;

    if (family_id) { query += ` AND p.family_id = $${paramIdx++}`; params.push(family_id); }
    if (generation) { query += ` AND p.generation = $${paramIdx++}`; params.push(generation); }
    if (gender)     { query += ` AND p.gender = $${paramIdx++}`; params.push(gender); }
    if (is_alive !== undefined) { query += ` AND p.is_alive = $${paramIdx++}`; params.push(is_alive); }
    if (q) {
      query += ` AND (p.first_name ILIKE $${paramIdx} OR p.last_name ILIKE $${paramIdx} OR p.birthplace ILIKE $${paramIdx} OR p.occupation ILIKE $${paramIdx})`;
      params.push(`%${q}%`);
      paramIdx++;
    }

    query += ' GROUP BY p.id, f.family_name, f.color ORDER BY p.generation, p.first_name';

    const { rows: persons } = await pool.query(query, params);
    res.json({ success: true, data: persons, total: persons.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET single person with full relations ───────────────────────────────────
const getPersonById = async (req, res) => {
  try {
    const id = req.params.id;
    const { rows: persons } = await pool.query(`
      SELECT p.*, f.family_name, f.color AS family_color
      FROM   persons p
      LEFT JOIN families f ON f.id = p.family_id
      WHERE  p.id = $1
    `, [id]);

    const person = persons[0];
    if (!person) return res.status(404).json({ success: false, error: 'Person not found' });

    const { rows: parents } = await pool.query(`
      SELECT p.id, p.first_name, p.last_name, p.gender, p.photo_url, p.generation
      FROM   relationships r
      JOIN   persons p ON p.id = r.parent_id
      WHERE  r.child_id = $1
    `, [id]);

    const { rows: children } = await pool.query(`
      SELECT p.id, p.first_name, p.last_name, p.gender, p.photo_url, p.generation, p.is_alive
      FROM   relationships r
      JOIN   persons p ON p.id = r.child_id
      WHERE  r.parent_id = $1
      ORDER  BY p.generation, p.first_name
    `, [id]);

    const { rows: siblings } = await pool.query(`
      SELECT DISTINCT p.id, p.first_name, p.last_name, p.gender, p.photo_url, p.generation
      FROM   relationships r1
      JOIN   relationships r2 ON r2.parent_id = r1.parent_id
      JOIN   persons p ON p.id = r2.child_id
      WHERE  r1.child_id = $1 AND r2.child_id != $1
    `, [id]);

    const { rows: spouses } = await pool.query(`
      SELECT p.id, p.first_name, p.last_name, p.gender, p.photo_url,
             m.married_on, m.divorced_on
      FROM   marriages m
      JOIN   persons p ON p.id = CASE WHEN m.person1_id = $1 THEN m.person2_id ELSE m.person1_id END
      WHERE  m.person1_id = $1 OR m.person2_id = $1
    `, [id]);

    res.json({
      success: true,
      data: { ...person, parents, children, siblings, spouses }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── CREATE person ───────────────────────────────────────────────────────────
const createPerson = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      family_id, first_name, last_name, gender, dob, dod,
      birthplace, occupation, bio, generation, is_alive,
      parent_ids, spouse_id, spouse_married_on
    } = req.body;

    if (!first_name) return res.status(400).json({ success: false, error: 'first_name is required' });

    let resolvedGeneration = generation ? parseInt(generation) : null;
    if (parent_ids) {
      const firstParentId = Array.isArray(parent_ids) ? parent_ids[0] : parent_ids;
      const { rows: parentRow } = await client.query('SELECT generation FROM persons WHERE id = $1', [firstParentId]);
      if (parentRow.length > 0) resolvedGeneration = parentRow[0].generation + 1;
    }
    if (!resolvedGeneration) return res.status(400).json({ success: false, error: 'generation is required' });

    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

    await client.query('BEGIN');

    const { rows: insertedPerson } = await client.query(`
      INSERT INTO persons
        (family_id, first_name, last_name, gender, dob, dod,
         birthplace, occupation, bio, photo_url, generation, is_alive)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      family_id || null, first_name, last_name || null,
      gender || 'male', dob || null, dod || null,
      birthplace || null, occupation || null, bio || null,
      photo_url, resolvedGeneration, is_alive !== undefined ? parseInt(is_alive) : 1
    ]);

    const personId = insertedPerson[0].id;

    if (parent_ids) {
      const ids = Array.isArray(parent_ids) ? parent_ids : [parent_ids];
      for (const pid of ids) {
        await client.query('INSERT INTO relationships (parent_id, child_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [pid, personId]);
      }
    }

    if (spouse_id) {
      const p1 = Math.min(personId, parseInt(spouse_id));
      const p2 = Math.max(personId, parseInt(spouse_id));
      await client.query('INSERT INTO marriages (person1_id, person2_id, married_on) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [p1, p2, spouse_married_on || null]);
    }

    await client.query('COMMIT');

    broadcastUpdate('person_created');
    res.status(201).json({ success: true, data: insertedPerson[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
};

// ── UPDATE person ───────────────────────────────────────────────────────────
const updatePerson = async (req, res) => {
  try {
    const {
      family_id, first_name, last_name, gender, dob, dod,
      birthplace, occupation, bio, generation, is_alive
    } = req.body;

    const photo_url = req.file ? `/uploads/${req.file.filename}` : undefined;

    const setClauses = [];
    const params = [];
    let paramIdx = 1;

    const set = (col, val) => {
      if (val !== undefined) {
        setClauses.push(`${col} = $${paramIdx++}`);
        params.push(val);
      }
    };

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

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    
    // Add ID at the end
    params.push(req.params.id);
    const idIdx = paramIdx;

    const { rows: updatedPersons } = await pool.query(`UPDATE persons SET ${setClauses.join(', ')} WHERE id = $${idIdx} RETURNING *`, params);

    if (updatedPersons.length === 0) return res.status(404).json({ success: false, error: 'Person not found' });
    
    broadcastUpdate('person_updated');
    res.json({ success: true, data: updatedPersons[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── DELETE person ───────────────────────────────────────────────────────────
const deletePerson = async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM persons WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ success: false, error: 'Person not found' });
    
    broadcastUpdate('person_deleted');
    res.json({ success: true, message: 'Person deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET by generation ───────────────────────────────────────────────────────
const getByGeneration = async (req, res) => {
  try {
    const gen = parseInt(req.params.gen);
    const { rows: persons } = await pool.query(`
      SELECT p.*, f.family_name, f.color AS family_color
      FROM   persons p
      LEFT JOIN families f ON f.id = p.family_id
      WHERE  p.generation = $1
      ORDER  BY f.family_name, p.first_name
    `, [gen]);

    const stats = {
      total: persons.length,
      male: persons.filter(p => p.gender === 'male').length,
      female: persons.filter(p => p.gender === 'female').length,
      alive: persons.filter(p => parseInt(p.is_alive) === 1).length,
      deceased: persons.filter(p => parseInt(p.is_alive) === 0).length,
    };

    res.json({ success: true, generation: gen, stats, data: persons });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Helper: cascade generation update down through all descendants ──────────
const cascadeGenerations = async (client, personId, newGeneration) => {
  await client.query("UPDATE persons SET generation = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [newGeneration, personId]);
  const { rows: children } = await client.query('SELECT child_id FROM relationships WHERE parent_id = $1', [personId]);
  for (const c of children) {
    await cascadeGenerations(client, c.child_id, newGeneration + 1);
  }
};

// ── ADD parent relationship ─────────────────────────────────────────────────
const addRelationship = async (req, res) => {
  const client = await pool.connect();
  try {
    const { parent_id, child_id } = req.body;

    const { rows: parentRows } = await client.query('SELECT generation FROM persons WHERE id = $1', [parent_id]);
    if (parentRows.length === 0) return res.status(404).json({ success: false, error: 'Parent not found' });
    const parentGen = parentRows[0].generation;

    await client.query('BEGIN');
    await client.query('INSERT INTO relationships (parent_id, child_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [parent_id, child_id]);
    await cascadeGenerations(client, child_id, parentGen + 1);
    await client.query('COMMIT');

    broadcastUpdate('relationship_added');
    res.json({ success: true, message: 'Relationship added', childGeneration: parentGen + 1 });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
};

// ── ADD marriage ────────────────────────────────────────────────────────────
const addMarriage = async (req, res) => {
  try {
    const { person1_id, person2_id, married_on, divorced_on } = req.body;
    const p1 = Math.min(person1_id, person2_id);
    const p2 = Math.max(person1_id, person2_id);
    await pool.query('INSERT INTO marriages (person1_id, person2_id, married_on, divorced_on) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [p1, p2, married_on || null, divorced_on || null]);
    
    broadcastUpdate('marriage_added');
    res.json({ success: true, message: 'Marriage added' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── REMOVE parent relationship ─────────────────────────────────────────────
const removeRelationship = async (req, res) => {
  try {
    const { parent_id, child_id } = req.body;
    const { rowCount } = await pool.query('DELETE FROM relationships WHERE parent_id = $1 AND child_id = $2', [parent_id, child_id]);
    if (rowCount === 0) return res.status(404).json({ success: false, error: 'Relationship not found' });
    
    broadcastUpdate('relationship_removed');
    res.json({ success: true, message: 'Relationship removed' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

// ── REMOVE marriage ─────────────────────────────────────────────────────────
const removeMarriage = async (req, res) => {
  try {
    const { person1_id, person2_id } = req.body;
    const p1 = Math.min(person1_id, person2_id);
    const p2 = Math.max(person1_id, person2_id);
    await pool.query('DELETE FROM marriages WHERE person1_id = $1 AND person2_id = $2', [p1, p2]);
    
    broadcastUpdate('marriage_removed');
    res.json({ success: true, message: 'Marriage removed' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

module.exports = {
  getAllPersons, getPersonById, createPerson, updatePerson,
  deletePerson, getByGeneration, addRelationship, addMarriage,
  removeRelationship, removeMarriage
};
