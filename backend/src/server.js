const fs = require('fs');
const path = require('path');
const http = require('http');
const env = require('./config/env');
const { buildAllowedOrigins } = require('./config/express');
const { connectDatabase } = require('./config/database');
const { initSocket } = require('./sockets');
const app = require('./app');

async function start() {
  await connectDatabase(env.mongoUri);

  fs.mkdirSync(path.resolve(env.uploadDir), { recursive: true });
  const { ensureProfileUploadDir } = require('./utils/profileImageStorage');
  ensureProfileUploadDir();

  const server = http.createServer(app);
  initSocket(server, {
    allowedOrigins: buildAllowedOrigins(),
    app,
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `Port ${env.port} is already in use. Stop the other process or set PORT in .env.`,
      );
    } else {
      console.error('HTTP server error:', err);
    }
    process.exit(1);
  });

  server.listen(env.port, () => {
    console.log(`HTTP server listening on port ${env.port} (${env.nodeEnv})`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
