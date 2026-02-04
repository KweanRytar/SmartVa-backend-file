import mongoose from "mongoose";
import Contact from "../model/contact.model.js";

/**
 * GET all contacts for a user
 */
export const getAllContacts = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      const err = new Error("Unauthorized");
      err.statusCode = 401;
      throw err;
    }

    const contacts = await Contact.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      message: contacts.length
        ? `Found ${contacts.length} contacts`
        : "No contacts found for this user",
      contacts,
      totalContacts: contacts.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET a single contact by ID
 */
export const getContactById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const err = new Error("Invalid contact ID");
      err.statusCode = 400;
      throw err;
    }

    const contact = await Contact.findOne({ _id: id, userId }).lean();

    if (!contact) {
      const err = new Error("Contact not found or not authorized");
      err.statusCode = 404;
      throw err;
    }

    res.status(200).json({
      message: "Contact retrieved successfully",
      data: contact
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST: Create a new contact
 */
export const createContact = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { name, companyName, email, position, phoneNumber } = req.body;

    if (!name || !companyName || !email || !phoneNumber) {
      const err = new Error("Name, company name, email, and phone number are required");
      err.statusCode = 400;
      throw err;
    }

    const exists = await Contact.exists({ email, userId });
    if (exists) {
      const err = new Error("Contact with this email already exists");
      err.statusCode = 409;
      throw err;
    }

    const contact = await Contact.create({
      name,
      companyName,
      email,
      position,
      phoneNumber,
      userId
    });

    res.status(201).json({
      message: `${name} added successfully`,
      data: contact
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT: Update contact by ID
 */
export const updateContact = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const err = new Error("Invalid contact ID");
      err.statusCode = 400;
      throw err;
    }

    const updatedContact = await Contact.findOneAndUpdate(
      { _id: id, userId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updatedContact) {
      const err = new Error("Contact not found or not authorized");
      err.statusCode = 404;
      throw err;
    }

    res.status(200).json({
      message: `${updatedContact.name} updated successfully`,
      data: updatedContact
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE: Delete contact by ID
 */
export const deleteContact = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const err = new Error("Invalid contact ID");
      err.statusCode = 400;
      throw err;
    }

    const deleted = await Contact.findOneAndDelete({ _id: id, userId });

    if (!deleted) {
      const err = new Error("Contact not found or not authorized");
      err.statusCode = 404;
      throw err;
    }

    res.status(200).json({
      message: "Contact deleted successfully"
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET contacts by company name (case-insensitive)
 */
export const contactsWithSameCompany = async (req, res, next) => {
  try {
    const { companyName } = req.params;
    const userId = req.user.userId;

    if (!companyName) {
      const err = new Error("companyName is required");
      err.statusCode = 400;
      throw err;
    }

    const contacts = await Contact.find({
      companyName: { $regex: companyName, $options: "i" },
      userId
    }).lean();

    res.status(200).json({
      message: `Found ${contacts.length} contact(s)`,
      data: contacts
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET contacts by name (case-insensitive)
 */
export const getContactByName = async (req, res, next) => {
  try {
    const { name } = req.params;
    const userId = req.user.userId;

    if (!name) {
      const err = new Error("Name is required");
      err.statusCode = 400;
      throw err;
    }

    const contacts = await Contact.find({
      name: { $regex: name, $options: "i" },
      userId
    }).lean();

    res.status(200).json({
      message: `Found ${contacts.length} contact(s)`,
      data: contacts
    });
  } catch (error) {
    next(error);
  }
};
