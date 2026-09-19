// טעינת משתני הסביבה מקובץ ה-.env (חייב להיות בשורה הראשונה)
require('dotenv').config();

const express = require('express');
const connectDB = require('./config/db');

const app = express();

// התחברות למסד הנתונים
connectDB();

// Middleware לקריאת JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// כאן מגיעים שאר ה-Routes שלך...

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});