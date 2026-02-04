import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  fullName: {
    type: String,
    required: true,
  },
  verifyToken: {
    type: String,
    
  },
  verifyTokenExpiry: {
    type: Date,
   
  },
  resetToken: {
    type: String,
   
  },
  resetTokenExpiry: {
    type: Date,
    
  },
  verified: {
    type: Boolean,
    default: false,
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
  }
  });

  export const User = mongoose.model('User', userSchema);