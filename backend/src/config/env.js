require('dotenv').config();

const required = ['MONGODB_URI', 'JWT_SECRET'];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missing.join(', ')}`,
  );
}

const corsOriginsExtra = (process.env.CORS_ORIGINS_EXTRA || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  corsOriginsExtra,
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  maxFileSizeBytes: parseInt(
    process.env.MAX_FILE_SIZE_BYTES || String(25 * 1024 * 1024),
    10,
  ),
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
};
