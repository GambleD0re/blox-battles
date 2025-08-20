// /backend/src/api/routes/index.js

import { Router } from 'express';
import healthRouter from './health.routes.js';
// import authRouter from './users/auth.routes.js'; // Future import
// import profileRouter from './users/profile.routes.js'; // Future import

const masterRouter = Router();

// Mount all feature-specific routers
masterRouter.use('/health', healthRouter);
// masterRouter.use('/auth', authRouter);
// masterRouter.use('/users', profileRouter);

export default masterRouter;
