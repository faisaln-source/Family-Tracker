const express    = require('express');
const multer     = require('multer');
const path       = require('path');
const router     = express.Router();
const { createClient } = require('@supabase/supabase-js');

const {
  getAllPersons, getPersonById, createPerson, updatePerson,
  deletePerson, getByGeneration, addRelationship, addMarriage,
  removeRelationship, removeMarriage
} = require('../controllers/persons.controller');

// ── Supabase Storage client ─────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const BUCKET = 'person-photos';

// ── Multer: memory storage (no disk) ────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  }
});

// ── Middleware: upload photo to Supabase Storage ────────────────────────────
const uploadToSupabase = async (req, res, next) => {
  if (!req.file) return next(); // no photo attached — skip

  try {
    const ext      = path.extname(req.file.originalname).toLowerCase();
    const filename = `photo_${Date.now()}${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filename, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error.message);
      return res.status(500).json({ success: false, error: 'Photo upload failed: ' + error.message });
    }

    // Get public URL and attach to req so the controller can use it
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    req.photoUrl = data.publicUrl;
    next();
  } catch (err) {
    console.error('Upload middleware error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Routes ──────────────────────────────────────────────────────────────────
router.get('/',                          getAllPersons);
router.get('/generation/:gen',           getByGeneration);
router.get('/:id',                       getPersonById);
router.post('/',   upload.single('photo'), uploadToSupabase, createPerson);
router.put('/:id', upload.single('photo'), uploadToSupabase, updatePerson);
router.delete('/:id',                    deletePerson);
router.post('/relationships',            addRelationship);
router.post('/marriages',                addMarriage);
router.delete('/relationships',          removeRelationship);
router.delete('/marriages',              removeMarriage);

module.exports = router;
