const { Router } = require('express');
const userRoutes = require('./user.routes');
const recordRoutes = require('./record.routes');
const resourceRoutes = require('./resource.routes');

const router = Router();

router.use('/users', userRoutes);
router.use('/data/:resource', recordRoutes);
router.use('/resources', resourceRoutes);

module.exports = router;
