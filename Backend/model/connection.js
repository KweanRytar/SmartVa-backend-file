import mongoose from 'mongoose';
import  Document  from './document.model.js';
import dotenv from 'dotenv';

dotenv.config();



export const dbConnection = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, );
 

    try {
      await Document.collection.dropIndex('ref_1');
      console.log("✅ Duplicate index 'ref_1' dropped successfully");
    } catch (error) {
      if (error.codeName === 'IndexNotFound') {
        console.log("ℹ️ Index 'ref_1' not found — nothing to drop");
      } else {
        console.error('❌ Failed to drop index:', error.message);
      }
    }
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error.message);
    process.exit(1); // Optional: exit if DB connection fails
  }
};
