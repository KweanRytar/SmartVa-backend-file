// controllers/authController.js

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { User } from '../model/user.model.js';
import { generateVerifyToken } from './generations.js';
import { sendVerifyEmail, sendResetPasswordEmail } from './sendEmailReminder.js';


// ----------------------------- REGISTER -----------------------------
export const register = async (req, res, next) => {
  const { userName, email, password, fullName } = req.body;
  try {
    if (!userName || !email || !password || !fullName) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const [existingUser, existingUserName] = await Promise.all([
      User.findOne({ email }),
      User.findOne({ userName })
    ]);

    if (existingUser) return res.status(400).json({ message: 'Email already exists' });
    if (existingUserName) return res.status(400).json({ message: 'Username already exists' });

    const rawToken = generateVerifyToken();
    const hashedToken = crypto.createHash('sha256').update(String(rawToken)).digest('hex');
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      
      userName,
      email,
      fullName,
      password: hashedPassword,
      verifyToken: hashedToken,
      verifyTokenExpiry: Date.now() + 3600000 // 1hr
    });

    await sendVerifyEmail(email, rawToken);

    res.status(201).json({
      message: 'User created successfully. Verification email sent.',
      user: { id: user._id, userName, email, fullName }
    });
  } catch (err) {
    next(err);
  }
};


// GET USER
export const getUser = async (req, res, next) => {
  
  const userId = req.user.userId || req.user || req.user._id;
  try {
    const user = await User.findById(userId).select('-password -verifyToken -verifyTokenExpiry -resetToken -resetTokenExpiry');
    if (!user) return res.status(404).json({ message: 'User not found' });
  
    res.status(200).json({ user });
  } catch (error) {
  next(error);
  }
}


// ----------------------------- VERIFY EMAIL -----------------------------
export const verifyEmail = async (req, res, next) => {
  const { token } = req.body;
  try {
    if (!token) return res.status(400).json({ message: 'Token is required' });

    const hashed = crypto.createHash('sha256').update(String(token)).digest('hex');
    const user = await User.findOne({ verifyToken: hashed });

    if (!user || user.verifyTokenExpiry < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    user.verified = true;
    user.verifyToken = null;
    user.verifyTokenExpiry = null;
    await user.save();

    const authToken = jwt.sign({ userId: user._id }, process.env.jwtSecret, { expiresIn: '1d' });
    res.cookie('token', authToken, { httpOnly: true, secure: false, maxAge: 86400000 });

    res.status(200).json({ message: 'Email verified successfully' });
  } catch (err) {
    next(err);
  }
};

// ----------------------------- LOGIN -----------------------------
export const login = async (req, res, next) => {
  const { email, password } = req.body;
   try {
    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // sign JWT
    const token = jwt.sign({ userId: user._id }, process.env.jwtSecret, {
      expiresIn: "1d",
    });

    // set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // change to true in production (HTTPS)
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: "Lax",
    });

    res.status(200).json({
      message: "Login successful",
      user: {
        _id: user._id,
        email: user.email,
        userName: user.userName,
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    next(err);
  }
};

// ----------------------------- LOGOUT -----------------------------
export const logout = async (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out successfully' });
};

// ----------------------------- GET USER -----------------------------
export const getUserDetails = async (req, res, next) => {


  try {
    const user = await User.findById(req.user.userId).select("-password"); // don’t send 
    
    

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    
    res.status(200).json({
     user
    });

  } catch (err) {
    next(err);
  }
};

// ----------------------------- UPDATE USER -----------------------------
export const updateUserDetails = async (req, res, next) => {
  const userId = req.user.userId;
  const { userName, fullName, email, password } = req.body;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (
    userName === undefined &&
    fullName === undefined &&
    email === undefined &&
    !password
  ) {
    return res
      .status(400)
      .json({ message: "At least one field is required to update" });
  }

  let hashedPassword;
  if (password) {
    hashedPassword = await bcrypt.hash(password, 10);
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (userName !== undefined) user.userName = userName;
    if (fullName !== undefined) user.fullName = fullName;
    if (email !== undefined) user.email = email;
    if (password) user.password = hashedPassword;

    await user.save();

    res.status(200).json({ message: "User updated successfully" });
  } catch (err) {
    next(err);
  }
};

// ----------------------------- REQUEST PASSWORD RESET -----------------------------
export const requestToResetPassword = async (req, res, next) => {
  const { email } = req.body;
  try {
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const rawToken = generateVerifyToken().toString();
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetToken = hashedToken;
    user.resetTokenExpiry = Date.now() + 3600000; // 1hr
    await user.save();

    await sendResetPasswordEmail(email, rawToken);
    res.status(200).json({ message: 'Reset email sent' });
  } catch (err) {
    next(err);
  }
};

// ----------------------------- CONFIRM RESET TOKEN -----------------------------
export const confirmResetToken = async (req, res, next) => {
  const { token } = req.body;
  try {
    if (!token) return res.status(400).json({ message: 'Token required' });

    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ resetToken: hashed });

    if (!user || user.resetTokenExpiry < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const resetJWT = jwt.sign({ id: user._id, email: user.email }, process.env.jwtSecret, { expiresIn: '10m' });
    res.cookie('resetToken', resetJWT, { httpOnly: true, secure: false, maxAge: 10 * 60 * 1000, sameSite: 'Lax' });

    res.status(200).json({ message: 'Token confirmed. Proceed to reset password.' });
  } catch (err) {
    next(err);
  }
};

// ----------------------------- RESET PASSWORD -----------------------------
export const resetPassword = async (req, res, next) => {
  const { newPassword } = req.body;
  try {
    const token = req.cookies.resetToken;
    if (!token) return res.status(401).json({ message: 'Unauthorized. Token missing.' });

    const decoded = jwt.verify(token, process.env.jwtSecret);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.clearCookie('resetToken');
    res.status(200).json({ message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
};
