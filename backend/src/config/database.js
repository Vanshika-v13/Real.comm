const mongoose = require('mongoose');

async function connectDatabase(uri) {
  mongoose.set('strictQuery', true);
  
  const trimmedUri = (uri || '').trim();
  let connectionUri = trimmedUri;

  try {
    if (trimmedUri.startsWith('mongodb')) {
      const url = new URL(trimmedUri);
      if (url.password) {
        const decodedPassword = decodeURIComponent(url.password);
        url.password = encodeURIComponent(decodedPassword);
        connectionUri = url.toString();
      }
      // Log masked URI for debugging (hiding password)
      const masked = trimmedUri.replace(/:([^@]+)@/, ':****@');
      console.log(`Connecting to MongoDB: ${masked}`);
    }
  } catch (err) {
    connectionUri = trimmedUri;
  }

  await mongoose.connect(connectionUri);
  console.log('MongoDB connected successfully');
}

module.exports = { connectDatabase };
