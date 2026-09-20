const mongoose = require('mongoose');
require('dotenv').config();
const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dugsi_local';

mongoose.connect(uri)
  .then(() => {
    console.log('Successfully connected to MongoDB Atlas');
    process.exit(0);
  })
  .catch(err => {
    console.error('Failed to connect:', err);
    process.exit(1);
  });
