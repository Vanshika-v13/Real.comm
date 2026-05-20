const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const env = require('../../config/env');

async function socketAuthMiddleware(socket, next) {
  try {
    const raw =
      socket.handshake.auth?.token ?? socket.handshake.query?.token;
    const token = typeof raw === 'string' ? raw.trim() : '';
    if (!token) {
      return next(new Error('Authentication required'));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.jwtSecret);
    } catch {
      return next(new Error('Invalid or expired token'));
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return next(new Error('User no longer exists'));
    }

    socket.data.userId = user._id.toString();
    socket.data.userName = user.name;
    socket.data.username = user.username || null;
    socket.data.profileImage = user.profileImage || null;
    socket.data.bio = user.bio || '';
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { socketAuthMiddleware };
