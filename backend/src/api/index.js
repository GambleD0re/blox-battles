// /backend/src/api/index.js
const express = require('express');
const v1Router = require('./v1');

const router = express.Router();

// Mount all v1 routes under the /v1 namespace
router.use('/v1', v1Router);

module.exports = router;
