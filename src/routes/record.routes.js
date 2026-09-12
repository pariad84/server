const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const recordController = require('../controllers/record.controller');

// mergeParams: the resource name is a parameter of the path this router is mounted on.
const router = Router({ mergeParams: true });

router.get('/', asyncHandler(recordController.getRecords));
router.get('/:id', asyncHandler(recordController.getRecord));
router.post('/', asyncHandler(recordController.postRecord));
router.put('/:id', asyncHandler(recordController.putRecord));
router.delete('/:id', asyncHandler(recordController.deleteRecord));

module.exports = router;
