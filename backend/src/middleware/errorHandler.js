const mongoose = require('mongoose');
const multer = require('multer');
const AppError = require('../utils/AppError');
const env = require('../config/env');

function handleCastErrorDB() {
  return new AppError('Invalid ID format', 400);
}

function handleDuplicateKeyDB(err) {
  const key = err.keyValue ? Object.keys(err.keyValue)[0] : null;
  if (key === 'email') {
    return new AppError('Email already registered', 409);
  }
  if (key === 'username') {
    return new AppError('Username is already taken', 409);
  }
  return new AppError('Duplicate field value', 409);
}

function handleValidationErrorDB(err) {
  const messages = Object.values(err.errors).map((e) => e.message);
  return new AppError(messages.join('. ') || 'Validation error', 400);
}

function sendErrorDev(err, res) {
  const statusCode = err.statusCode || 500;
  const body = {
    status: statusCode >= 500 ? 'error' : 'fail',
    message: err.message,
  };
  if (!err.isOperational || statusCode >= 500) {
    body.stack = err.stack;
  }
  if (err.errors) {
    body.errors = err.errors;
  }
  res.status(statusCode).json(body);
}

function sendErrorProd(err, res) {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: 'fail',
      message: err.message,
    });
  }
  return res.status(500).json({
    status: 'error',
    message: 'Something went wrong',
  });
}

function normalizeMulterError(err) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return new AppError('File exceeds maximum allowed size', 413);
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return new AppError('Unexpected or disallowed file field', 400);
    }
    return new AppError('Upload could not be completed', 400);
  }
  return err;
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let error = normalizeMulterError(err);

  if (error instanceof mongoose.Error.CastError) {
    error = handleCastErrorDB();
  }
  if (error.code === 11000) {
    error = handleDuplicateKeyDB(error);
  }
  if (error instanceof mongoose.Error.ValidationError) {
    error = handleValidationErrorDB(error);
  }
  if (error.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token', 401);
  }
  if (error.name === 'TokenExpiredError') {
    error = new AppError('Token expired', 401);
  }

  const statusCode = error.statusCode || 500;
  if (statusCode >= 500 && env.nodeEnv === 'production') {
    console.error('[error]', req.method, req.originalUrl, error.message);
  }

  if (env.nodeEnv === 'development') {
    return sendErrorDev(error, res);
  }
  return sendErrorProd(error, res);
}

module.exports = errorHandler;
