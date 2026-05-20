const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const env = require('./env');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many requests, try again later' },
});

function buildAllowedOrigins() {
  const origins = new Set([
    'http://localhost:5173',
    env.clientUrl,
    ...env.corsOriginsExtra,
  ]);
  return Array.from(origins).filter(Boolean);
}

function configureMiddleware(app) {
  if (env.nodeEnv === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          return callback(null, true);
        }
        if (buildAllowedOrigins().includes(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Length', 'Content-Type'],
      maxAge: 86400,
      optionsSuccessStatus: 204,
    }),
  );

  app.use('/api', apiLimiter);

  if (env.nodeEnv === 'development') {
    app.use(morgan('dev'));
  }

  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  app.use(cookieParser());
}

module.exports = { configureMiddleware, buildAllowedOrigins };
