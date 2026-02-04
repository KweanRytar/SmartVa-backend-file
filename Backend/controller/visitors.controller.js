import { Visitor } from "../model/vistor.model.js";
import mongoose from "mongoose";

// Create visitor
export const createVisitor = async (req, res, next) => {
  try {
    const { name, email, phone, message } = req.body;
    if (!name || !email || !phone) {
      const err = new Error("Name, email, and phone are required");
      err.statusCode = 400;
      return next(err);
    }
    const visitor = await Visitor.create({
      name,
      email,
      phone,
      message,
      userId: req.user.userId,
    });
    res.status(201).json({ message: "Visitor created successfully", visitor });
  } catch (error) {
    next(error);
  }
};

// Update visitor
export const upDateVisitor = async (req, res, next) => {
  const { id } = req.params;
  const updatedBody = req.body;
  const userId = req.user.userId;

  try {
    const updatedVisitor = await Visitor.findOneAndUpdate(
      { _id: id, userId },
      updatedBody,
      { new: true }
    );
    if (!updatedVisitor) {
      const err = new Error("Visitor not found or not authorized");
      err.statusCode = 404;
      return next(err);
    }
    res.status(200).json({
      message: "Visitor updated successfully",
      visitor: updatedVisitor,
    });
  } catch (error) {
    next(error);
  }
};

// Get all visitors (with optional search query)
export const getVisitors = async (req, res, next) => {
  const userId = req.user.userId;
   // use query params for search

   const objectUserId = new mongoose.Types.ObjectId(userId);

  try {
    

    const visitors = await Visitor.find({userId: objectUserId});
    const total = await Visitor.countDocuments(visitors);
    console.log("Total visitors found:", total, visitors);

    res.status(200).json({
      message: "Visitors fetched successfully",
      visitors,
      total,
    });
  } catch (error) {
    next(error);
  }
};

// Get visitor by ID
export const getVisitorById = async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    const visitor = await Visitor.findOne({ _id: id, userId });
    if (!visitor) {
      const err = new Error("Visitor with the specified ID not found");
      err.statusCode = 404;
      return next(err);
    }
    res.status(200).json({ message: "Visitor retrieved successfully", visitor });
  } catch (error) {
    next(error);
  }
};

// Get visitors by day
export const getVisitorByDay = async (req, res, next) => {
  const userId = req.user.userId;
  const { day } = req.params;

  try {
    const startDay = new Date(day);
    const endDay = new Date(startDay);
    endDay.setDate(endDay.getDate() + 1);

    const visitors = await Visitor.find({
      createdAt: { $gte: startDay, $lt: endDay },
      userId,
    });

    res.status(200).json({
      message: `Visitors for the day ${startDay.toDateString()} fetched successfully`,
      visitors,
    });
  } catch (error) {
    next(error);
  }
};

// Get visitors by month
export const getVisitorByMonth = async (req, res, next) => {
  const userId = req.user.userId;
  const { month } = req.params;

  try {
    const year = new Date().getFullYear();
    const visitors = await Visitor.find({
      createdAt: {
        $gte: new Date(year, month - 1, 1),
        $lt: new Date(year, month, 1),
      },
      userId,
    });
    res.status(200).json({
      message: `Visitors for month ${month} fetched successfully`,
      visitors,
    });
  } catch (error) {
    next(error);
  }
};

// Get visitors by week
export const getVisitorsByWeek = async (req, res, next) => {
  const userId = req.user.userId;

  try {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const visitors = await Visitor.find({
      createdAt: { $gte: startOfWeek, $lt: endOfWeek },
      userId,
    });

    res.status(200).json({
      message: "Visitors for the week fetched successfully",
      visitors,
    });
  } catch (error) {
    next(error);
  }
};

// Delete visitor
export const deleteVisitors = async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    const deletedVisitor = await Visitor.findOneAndDelete({ _id: id, userId });
    if (!deletedVisitor) {
      const err = new Error("Visitor not found or not authorized");
      err.statusCode = 404;
      return next(err);
    }
    res.status(200).json({
      message: "Visitor deleted successfully",
      visitor: deletedVisitor,
    });
  } catch (error) {
    next(error);
  }
};

// Get visitors by name
export const getVisitorByName = async (req, res, next) => {
  const { name } = req.params;
  const userId = req.user.userId;

  try {
    const visitors = await Visitor.find({
      name: { $regex: name, $options: "i" },
      userId,
    });

    if (!visitors || visitors.length === 0) {
      const err = new Error(`No visitor found with name "${name}"`);
      err.statusCode = 404;
      return next(err);
    }

    res.status(200).json({
      message: `Visitors with name "${name}" retrieved successfully`,
      visitors,
    });
  } catch (error) {
    next(error);
  }
};
