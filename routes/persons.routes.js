const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const router  = express.Router();

const {
  getAllPersons, getPersonById, createPerson, updatePerson,
  deletePerson, getByGeneration, addRelationship, addMarriage,
  removeRelationship, removeMarriage
} = require('../controllers/persons.controller');

// ── Multer photo upload config ──────────────────────────────────────────────
const uploadsDir = process.env.UPLOADS_DIR || './uploads';
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `photo_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  }
});

// ── Routes ──────────────────────────────────────────────────────────────────
router.get('/',                          getAllPersons);
router.get('/generation/:gen',           getByGeneration);
router.get('/:id',                       getPersonById);
router.post('/',   upload.single('photo'), createPerson);
router.put('/:id', upload.single('photo'), updatePerson);
router.delete('/:id',                    deletePerson);
router.post('/relationships',            addRelationship);
router.post('/marriages',                addMarriage);
router.delete('/relationships',          removeRelationship);
router.delete('/marriages',              removeMarriage);

module.exports = router;
