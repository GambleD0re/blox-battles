// /backend/src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mainApiRouter = require('./api');

const app = express();

// --- Global Middleware ---
app.use(helmet());

const corsOptions = {
  origin: process.env.SERVER_URL,
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Health Check Route ---
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'CyberDome Backend is healthy' });
});

// --- API Routes ---
app.use('/api', mainApiRouter);


module.exports = app;
