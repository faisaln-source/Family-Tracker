const pool = require('../db/database');
const { broadcastUpdate } = require('../sse');

// ── GET all families ────────────────────────────────────────────────────────
const getAllFamilies = async (req, res) => {
  try {
    const { rows: families } = await pool.query(`
      SELECT f.*,
             COUNT(p.id) AS member_count
      FROM   families f
      LEFT JOIN persons p ON p.family_id = f.id
      GROUP  BY f.id
      ORDER  BY f.family_name
    `);
    res.json({ success: true, data: families });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET single family ───────────────────────────────────────────────────────
const getFamilyById = async (req, res) => {
  try {
    const { rows: families } = await pool.query('SELECT * FROM families WHERE id = $1', [req.params.id]);
    const family = families[0];
    if (!family) return res.status(404).json({ success: false, error: 'Family not found' });

    const { rows: members } = await pool.query(`
      SELECT id, first_name, last_name, gender, generation, is_alive, photo_url, dob, dod
      FROM   persons WHERE family_id = $1 ORDER BY generation, first_name
    `, [req.params.id]);

    res.json({ success: true, data: { ...family, members } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── CREATE family ───────────────────────────────────────────────────────────
const createFamily = async (req, res) => {
  try {
    const { family_name, origin, description, color } = req.body;
    if (!family_name) return res.status(400).json({ success: false, error: 'family_name is required' });

    const { rows } = await pool.query(`
      INSERT INTO families (family_name, origin, description, color)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [family_name, origin || null, description || null, color || '#4f46e5']);

    broadcastUpdate('family_created');
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.message.includes('unique') || err.message.includes('UNIQUE')) {
      return res.status(409).json({ success: false, error: 'Family name already exists' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── UPDATE family ───────────────────────────────────────────────────────────
const updateFamily = async (req, res) => {
  try {
    const { family_name, origin, description, color } = req.body;
    const { rows } = await pool.query(`
      UPDATE families SET family_name = COALESCE($1, family_name),
                          origin      = COALESCE($2, origin),
                          description = COALESCE($3, description),
                          color       = COALESCE($4, color)
      WHERE id = $5
      RETURNING *
    `, [family_name, origin, description, color, req.params.id]);

    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Family not found' });
    
    broadcastUpdate('family_updated');
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── DELETE family ───────────────────────────────────────────────────────────
const deleteFamily = async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM families WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ success: false, error: 'Family not found' });
    
    broadcastUpdate('family_deleted');
    res.json({ success: true, message: 'Family deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { getAllFamilies, getFamilyById, createFamily, updateFamily, deleteFamily };
