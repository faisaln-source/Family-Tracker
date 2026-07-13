const express = require('express');
const router  = express.Router();
const {
  getFamilyTree, getAncestorTree, getAllTrees, getAncestors, getStats, recalculateGenerations
} = require('../controllers/tree.controller');

router.get('/stats',                 getStats);
router.get('/all',                   getAllTrees);
router.get('/family/:familyId',      getFamilyTree);
router.get('/ancestor/:id',          getAncestorTree);
router.get('/ancestors/:id',         getAncestors);
router.post('/recalculate-generations', recalculateGenerations);

module.exports = router;
