const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const userController = require('../controllers/user.controller');

const router = Router();

router.get('/', asyncHandler(userController.getUsers));
router.get('/:id', asyncHandler(userController.getUser));
router.post('/', asyncHandler(userController.postUser));

module.exports = router;
