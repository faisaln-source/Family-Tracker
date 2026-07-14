const express        = require('express');
const multer         = require('multer');
const path           = require('path');
const router         = express.Router();
const { createClient } = require('@supabase/supabase-js');
const {
  getAllFamilies, getFamilyById, createFamily, updateFamily, deleteFamily
} = require('../controllers/families.controller');

// ── Supabase Storage client ──────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const BUCKET = 'person-photos'; // reuse same bucket

// ── Multer: memory storage ───────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  }
});

// ── Middleware: upload family image to Supabase Storage ──────────────────────
const uploadFamilyImage = async (req, res, next) => {
  if (!req.file) return next();
  try {
    const ext      = path.extname(req.file.originalname).toLowerCase();
    const filename = `family_${Date.now()}${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filename, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (error) return res.status(500).json({ success: false, error: 'Image upload failed: ' + error.message });
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    req.imageUrl = data.publicUrl;
    next();
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Routes ───────────────────────────────────────────────────────────────────
router.get('/',       getAllFamilies);
router.get('/:id',    getFamilyById);
router.post('/',      upload.single('image'), uploadFamilyImage, createFamily);
router.put('/:id',    upload.single('image'), uploadFamilyImage, updateFamily);
router.delete('/:id', deleteFamily);

module.exports = router;
