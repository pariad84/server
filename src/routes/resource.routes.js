const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const resourceController = require('../controllers/resource.controller');

const router = Router();

router.get('/', asyncHandler(resourceController.getResources));
router.get('/:resource', asyncHandler(resourceController.getResource));

module.exports = router;
