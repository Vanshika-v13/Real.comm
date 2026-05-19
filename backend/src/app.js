const express = require('express');
const { configureMiddleware } = require('./config/express');
const authRoutes = require('./routes/authRoutes');
const roomRoutes = require('./routes/roomRoutes');
const fileAccessRoutes = require('./routes/fileAccessRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const notFoundHandler = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

configureMiddleware(app);

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/files', fileAccessRoutes);
app.use('/api/settings', settingsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
