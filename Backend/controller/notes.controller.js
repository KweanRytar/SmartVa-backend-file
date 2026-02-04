import mongoose from 'mongoose';
import Note from '../model/notes.model.js';

// Create a note
export const createnote = async (req, res, next) => {
  const { title, contentHtml, contentText } = req.body;

  try {
    if (!title || !contentHtml || !contentText) {
      const err = new Error("Title, contentHtml, and contentText are required");
      err.statusCode = 400;
      return next(err);
    }

    const userId = req.user.userId;

    const note = await Note.create({
      title,
      contentHtml,
      contentText,
      userId,
    });

    res.status(201).json({
      message: "Note created successfully",
      note,
    });
  } catch (error) {
    next(error);
  }
};

// Get all notes
export const getallnotes = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    if (!userId) {
      const err = new Error("Unauthorized: No user ID found");
      err.statusCode = 401;
      return next(err);
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const notes = await Note.find({ userId: userObjectId }).lean(); // Lean for performance
    const totalNotes = await Note.countDocuments({ userId: userObjectId });

    res.status(200).json({
      message: "Notes fetched successfully",
      notes,
      totalNotes
    });
  } catch (error) {
    next(error);
  }
};

// Edit a note
export const editnote = async (req, res, next) => {
  const { id } = req.params;
  const { title, contentHtml, contentText } = req.body;

  try {
    const note = await Note.findOneAndUpdate(
      { _id: id, userId: req.user.userId },
      { title, contentHtml, contentText },
      { new: true, runValidators: true }
    ).lean();

    if (!note) {
      const err = new Error("Note not found or not authorized");
      err.statusCode = 404;
      return next(err);
    }

    res.status(200).json(note);
  } catch (error) {
    next(error);
  }
};

// Delete a note
export const deletenote = async (req, res, next) => {
  const { id } = req.params;
  try {
    const note = await Note.findOneAndDelete({ _id: id, userId: req.user.userId }).lean();
    if (!note) {
      const err = new Error("Note not found or not authorized");
      err.statusCode = 404;
      return next(err);
    }

    res.status(200).json({ message: "Note deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// Find note by title
export const findnotebytitle = async (req, res, next) => {
  const { title } = req.params;
  const userId = req.user.userId;

  try {
    const notes = await Note.find({ title: { $regex: title, $options: "i" }, userId }).lean();
    res.status(200).json(notes);
  } catch (error) {
    next(error);
  }
};

// Find note by ID
export const findnotebyid = async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    const note = await Note.findOne({ _id: id, userId }).lean();
    if (!note) {
      const err = new Error("Note not found or not authorized");
      err.statusCode = 404;
      return next(err);
    }

    res.status(200).json(note);
  } catch (error) {
    next(error);
  }
};
