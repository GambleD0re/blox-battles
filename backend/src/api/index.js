// /backend/src/api/index.js
//
// PURPOSE: This is the TOP-LEVEL router.
// Its ONLY job is to mount versioned routers (e.g., /v1).
// It should NOT contain any specific feature routes.

const express = require('express');
const v1Router = require('./v1');

const router = express.Router();

// Mount all v1 routes under the /v1 namespace
router.use('/v1', v1Router);

module.exports = router;
