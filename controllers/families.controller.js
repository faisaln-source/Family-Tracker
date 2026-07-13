const db = require('../db/database');
const { broadcastUpdate } = require('../sse');

// ── GET all families ────────────────────────────────────────────────────────
const getAllFamilies = (req, res) => {
  try {
    const families = db.prepare(`
      SELECT f.*,
             COUNT(p.id) AS member_count
      FROM   families f
      LEFT JOIN persons p ON p.family_id = f.id
      GROUP  BY f.id
      ORDER  BY f.family_name
    `).all();
    res.json({ success: true, data: families });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET single family ───────────────────────────────────────────────────────
const getFamilyById = (req, res) => {
  try {
    const family = db.prepare('SELECT * FROM families WHERE id = ?').get(req.params.id);
    if (!family) return res.status(404).json({ success: false, error: 'Family not found' });

    const members = db.prepare(`
      SELECT id, first_name, last_name, gender, generation, is_alive, photo_url, dob, dod
      FROM   persons WHERE family_id = ? ORDER BY generation, first_name
    `).all(req.params.id);

    res.json({ success: true, data: { ...family, members } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── CREATE family ───────────────────────────────────────────────────────────
const createFamily = (req, res) => {
  try {
    const { family_name, origin, description, color } = req.body;
    if (!family_name) return res.status(400).json({ success: false, error: 'family_name is required' });

    const result = db.prepare(`
      INSERT INTO families (family_name, origin, description, color)
      VALUES (?, ?, ?, ?)
    `).run(family_name, origin || null, description || null, color || '#4f46e5');

    const family = db.prepare('SELECT * FROM families WHERE id = ?').get(result.lastInsertRowid);
    broadcastUpdate('family_created');
    res.status(201).json({ success: true, data: family });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ success: false, error: 'Family name already exists' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── UPDATE family ───────────────────────────────────────────────────────────
const updateFamily = (req, res) => {
  try {
    const { family_name, origin, description, color } = req.body;
    db.prepare(`
      UPDATE families SET family_name = COALESCE(?, family_name),
                          origin      = COALESCE(?, origin),
                          description = COALESCE(?, description),
                          color       = COALESCE(?, color)
      WHERE id = ?
    `).run(family_name, origin, description, color, req.params.id);

    const family = db.prepare('SELECT * FROM families WHERE id = ?').get(req.params.id);
    if (!family) return res.status(404).json({ success: false, error: 'Family not found' });
    broadcastUpdate('family_updated');
    res.json({ success: true, data: family });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── DELETE family ───────────────────────────────────────────────────────────
const deleteFamily = (req, res) => {
  try {
    const result = db.prepare('DELETE FROM families WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ success: false, error: 'Family not found' });
    broadcastUpdate('family_deleted');
    res.json({ success: true, message: 'Family deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { getAllFamilies, getFamilyById, createFamily, updateFamily, deleteFamily };
