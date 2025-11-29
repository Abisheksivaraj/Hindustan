const mongoose = require("mongoose");
require("dotenv").config({ path: "./backend/.env" });

const connectDb = async () => {
  try {
    // Use process.env.MONGO_URI to access environment variable
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/Project";
    
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected successfully" + mongoUri);
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

module.exports = connectDb;