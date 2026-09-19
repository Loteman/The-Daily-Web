const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1); // סגירת השרת במקרה של כשל בחיבור
  }
};

module.exports = connectDB;// Mongoose connection setup to MongoDB using MONGODB_URI
