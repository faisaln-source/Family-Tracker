const express = require('express');
const router = express.Router();
const {
  getAllFamilies, getFamilyById, createFamily, updateFamily, deleteFamily
} = require('../controllers/families.controller');

router.get('/',       getAllFamilies);
router.get('/:id',    getFamilyById);
router.post('/',      createFamily);
router.put('/:id',    updateFamily);
router.delete('/:id', deleteFamily);

module.exports = router;
