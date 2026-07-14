const pool = require('../db/database');
const { broadcastUpdate } = require('../sse');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const BUCKET = 'person-photos';

// Extract just the filename from a full Supabase public URL
// e.g. https://<host>/storage/v1/object/public/person-photos/family_123.jpg -> family_123.jpg
function extractFilename(url) {
  if (!url) return null;
  try {
    const parts = url.split(`/${BUCKET}/`);
    return parts.length > 1 ? parts[1] : null;
  } catch { return null; }
}

async function deleteFromStorage(imageUrl) {
  const filename = extractFilename(imageUrl);
  if (!filename) return;
  const { error } = await supabase.storage.from(BUCKET).remove([filename]);
  if (error) console.warn('⚠️  Could not delete old image from storage:', error.message);
  else console.log('🗑️  Deleted old image from storage:', filename);
}

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
    const imageUrl = req.imageUrl || null;

    const { rows } = await pool.query(`
      INSERT INTO families (family_name, origin, description, color, image_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [family_name, origin || null, description || null, color || '#4f46e5', imageUrl]);

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
    const newImageUrl = req.imageUrl; // set by upload middleware only when a new file was uploaded

    // If a new image was uploaded, delete the old one from Supabase Storage first
    if (newImageUrl) {
      const { rows: current } = await pool.query('SELECT image_url FROM families WHERE id = $1', [req.params.id]);
      if (current[0]?.image_url) {
        await deleteFromStorage(current[0].image_url);
      }
    }

    const { rows } = await pool.query(`
      UPDATE families
      SET family_name = COALESCE($1, family_name),
          origin      = COALESCE($2, origin),
          description = COALESCE($3, description),
          color       = COALESCE($4, color),
          image_url   = CASE WHEN $6::boolean THEN $5 ELSE image_url END
      WHERE id = $7
      RETURNING *
    `, [family_name, origin, description, color,
        newImageUrl || null,
        newImageUrl !== undefined,  // only overwrite if a new image was uploaded
        req.params.id]);

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
    // Fetch image URL before deleting so we can clean up storage
    const { rows: current } = await pool.query('SELECT image_url FROM families WHERE id = $1', [req.params.id]);
    if (!current[0]) return res.status(404).json({ success: false, error: 'Family not found' });

    await pool.query('DELETE FROM families WHERE id = $1', [req.params.id]);

    // Delete image from Supabase Storage if one exists
    if (current[0].image_url) {
      await deleteFromStorage(current[0].image_url);
    }

    broadcastUpdate('family_deleted');
    res.json({ success: true, message: 'Family deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { getAllFamilies, getFamilyById, createFamily, updateFamily, deleteFamily };
