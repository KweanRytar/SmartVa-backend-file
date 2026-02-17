import mongoose from "mongoose";
import Document from "../model/document.model.js";

/**
 * =========================
 * GET all documents
 * =========================
 */
// controllers/document.controller.js
// ... keep your other functions (create, update, delete, getById, addResponse...) unchanged

export const getAllDocuments = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const filter = { userId };

    // 1. title (byName) - partial, case-insensitive
    if (req.query.title) {
      filter.title = { $regex: req.query.title.trim(), $options: "i" };
    }

    // 2. ref (byRef) - exact match, case-insensitive
    if (req.query.ref) {
      filter.ref = { $regex: `^${req.query.ref.trim()}$`, $options: "i" };
      // If you want partial match instead: { $regex: req.query.ref.trim(), $options: "i" }
    }

    // 3. category - partial, case-insensitive
    if (req.query.category) {
      filter.category = { $regex: req.query.category.trim(), $options: "i" };
    }

    // 4. sender (bySender) - partial, case-insensitive
    if (req.query.sender) {
      filter.sender = { $regex: req.query.sender.trim(), $options: "i" };
    }

    // 5. fileCategory - exact match
    if (req.query.fileCategory) {
      filter.fileCategory = req.query.fileCategory.trim();
    }

    // 6. receptionMode - exact match
    if (req.query.receptionMode) {
      filter.receptionMode = req.query.receptionMode.trim();
    }

    // 7. unresponded / responded (status)
    if (req.query.status) {
      const status = req.query.status.toLowerCase().trim();
      if (status === "responded") {
        filter.responseStatus = "responded";
      } else if (status === "pending" || status === "unresponded" || status === "not-responded") {
        // Option A: using responseStatus field (if you consistently set it)
        filter.responseStatus = { $ne: "responded" };

        // Option B: or check if responses array is empty / doesn't exist (more reliable if status can be inconsistent)
        // filter.$or = [
        //   { responses: { $exists: false } },
        //   { responses: { $size: 0 } }
        // ];
      } 
      // You can expand with more values if needed (e.g. "not_required")
    }

    // Sorting (default newest first)
    let sort = { createdAt: -1 };
    if (req.query.sort) {
      const [field, direction] = req.query.sort.split(":");
      sort = { [field]: direction === "desc" || direction === "-1" ? -1 : 1 };
    }

    // Pagination (very useful once you have >50-100 documents)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const skip = (page - 1) * limit;

    const [documents, total] = await Promise.all([
      Document.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Document.countDocuments(filter),
    ]);

    res.status(200).json({
      message: "Documents retrieved successfully",
      data: documents,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
    });
  } catch (error) {
    next(error);
  }
};
/**
 * =========================
 * GET document by ID
 * =========================
 */
export const getDocumentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const err = new Error("Invalid document ID");
      err.statusCode = 400;
      throw err;
    }

    const document = await Document.findOne({ _id: id, userId }).lean();

    if (!document) {
      const err = new Error("Document not found or not authorized");
      err.statusCode = 404;
      throw err;
    }

    res.status(200).json({
      message: "Document retrieved successfully",
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * =========================
 * CREATE document
 * =========================
 */
export const createDocument = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const {
      title,
      description,
      ref,
      sender,
      category,
      receptionMode,
      fileCategory,
      type , // default
      responseStatus = "not_required", // default
      responses = [], // optional array of responses
    } = req.body;

console.log('receptionMode:', receptionMode);
responses.map(element => {
  console.log('response element:', element.receptionMode);
})
  


    // Required fields for document
    if (!title || !description || !sender || !receptionMode || !type) {
      const err = new Error(
        "Title, description, sender, receptionMode, and type are required"
      );
      err.statusCode = 400;
      throw err;
    }

    // Conditional validation
    if (receptionMode === "in-person" && !fileCategory) {
      const err = new Error(
        "fileCategory is required when receptionMode is in-person"
      );
      err.statusCode = 400;
      throw err;
    }

    // Validate unique ref if provided
    if (ref?.trim()) {
      const refExists = await Document.exists({ ref: ref.trim() });
      if (refExists) {
        const err = new Error("Document with this reference already exists");
        err.statusCode = 409;
        throw err;
      }
    }

    // Validate responses if responseStatus is 'responded'
    let validResponses = [];
    if (responseStatus === "responded") {
      if (!Array.isArray(responses) || responses.length === 0) {
        const err = new Error(
          "At least one response must be provided when responseStatus is 'responded'"
        );
        err.statusCode = 400;
        throw err;
      }

      // Validate each response
     validResponses = responses.map((resp, index) => {
  const { title, summary, type, receptionMode, fileCategory, needsFurtherResponse, respondedAt, ref } = resp;

  if (!title || !summary || !receptionMode) {
    const err = new Error(
      `Response at index ${index} is missing required fields (title, summary, or receptionMode)`
    );
    err.statusCode = 400;
    throw err;
  }

  return {
    title: title.trim(),
    ref: ref?.trim() || undefined,
    summary: summary.trim(),
    needsFurtherResponse: Boolean(needsFurtherResponse),
    receptionMode,
    fileCategory: receptionMode === "in-person" ? fileCategory?.trim() : undefined,
    type: ["incoming", "outgoing"].includes(type) ? type : "outgoing",
    respondedAt: respondedAt ? new Date(respondedAt) : new Date(),
  };
});

    }

    const document = await Document.create({
      title: title.trim(),
      description: description.trim(),
      sender: sender.trim(),
      ref: ref?.trim() || undefined,
      category: category || "General",
      receptionMode,
      fileCategory:
        receptionMode === "in-person" ? fileCategory?.trim() : undefined,
      type,
      responseStatus,
      responses: validResponses,
      userId,
    });

    res.status(201).json({
      message: "Document created successfully",
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * =========================
 * UPDATE document
 * =========================
 */
export const updateDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid document ID" });
    }

    const {
      title,
      description,
      category,
      sender,
      ref,
      type,
      receptionMode,
      fileCategory,
      responseStatus,
      responses = [],
    } = req.body;

    if (!title || !description || !sender || !type) {
      return res.status(400).json({
        message: "Title, description, sender, and type are required",
      });
    }

    if (receptionMode === "in-person" && !fileCategory) {
      return res.status(400).json({
        message: "fileCategory is required when receptionMode is in-person",
      });
    }

    let validResponses = [];

    if (responseStatus === "responded") {
      if (!responses.length) {
        return res.status(400).json({
          message: "Responses are required when status is responded",
        });
      }

      validResponses = responses.map((resp, idx) => {
        if (!resp.title || !resp.summary) {
          throw new Error(
            `Response at index ${idx} missing title or summary`
          );
        }

        return {
          title: resp.title.trim(),
          summary: resp.summary.trim(),
          ref: resp.ref?.trim(),
          resStatus: Boolean(resp.resStatus),
          receptionMode: resp.receptionMode,
          fileCategory:
            resp.receptionMode === "in-person"
              ? resp.fileCategory
              : undefined,
          type: resp.type,
          respondedAt: resp.respondedAt
            ? new Date(resp.respondedAt)
            : new Date(),
        };
      });
    }

    const updateData = {
      title,
      description,
      category,
      sender,
      ref,
      type,
      receptionMode,
      responseStatus,
      responses:
        responseStatus === "responded" ? validResponses : [],
    };

    if (receptionMode === "in-person") {
      updateData.fileCategory = fileCategory;
    }

    const updatedDocument = await Document.findOneAndUpdate(
      { _id: id, userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedDocument) {
      return res.status(404).json({
        message: "Document not found or not authorized",
      });
    }

    res.status(200).json({
      message: "Document updated successfully",
      data: updatedDocument,
    });
  } catch (error) {
    next(error);
  }
};


/**
 * =========================
 * DELETE document
 * =========================
 */
export const deleteDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const err = new Error("Invalid document ID");
      err.statusCode = 400;
      throw err;
    }

    const deleted = await Document.findOneAndDelete({ _id: id, userId });

    if (!deleted) {
      const err = new Error("Document not found or not authorized");
      err.statusCode = 404;
      throw err;
    }

    res.status(200).json({
      message: "Document deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * =========================
 * ADD response to document
 * =========================
 */


export const addDocumentResponse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const {
      title,
      ref,
      summary,
      resStatus,
      type,
      receptionMode,
      fileCategory,
      respondedAt,
    } = req.body;

    /* ----------------------------------
       Basic validations
    ---------------------------------- */
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const err = new Error("Invalid document ID");
      err.statusCode = 400;
      throw err;
    }

    if (!title || !summary) {
      const err = new Error("Response title and summary are required");
      err.statusCode = 400;
      throw err;
    }

    if (!type || !["incoming", "outgoing"].includes(type)) {
      const err = new Error("Response type must be incoming or outgoing");
      err.statusCode = 400;
      throw err;
    }

    if (!receptionMode || !["virtual", "in-person"].includes(receptionMode)) {
      const err = new Error("Reception mode must be Virtual or in-person");
      err.statusCode = 400;
      throw err;
    }

    if (receptionMode === "in-person" && !fileCategory) {
      const err = new Error(
        "fileCategory is required when reception mode is in-person"
      );
      err.statusCode = 400;
      throw err;
    }

    /* ----------------------------------
       Find document (auth enforced)
    ---------------------------------- */
    const document = await Document.findOne({
      _id: id,
      userId,
    });

    if (!document) {
      const err = new Error("Document not found or not authorized");
      err.statusCode = 404;
      throw err;
    }

    /* ----------------------------------
       Push new response
    ---------------------------------- */
    document.responses.push({
      title: title.trim(),
      ref: ref?.trim(),
      summary: summary.trim(),
      type,
      receptionMode,
      fileCategory:
        receptionMode === "in-person" ? fileCategory?.trim() : undefined,
      resStatus: Boolean(resStatus),
      respondedAt: respondedAt ? new Date(respondedAt) : new Date(),
    });

    /* ----------------------------------
       Update document status
    ---------------------------------- */
    document.responseStatus = "responded";
    document.lastRespondedAt = new Date();

    await document.save();

    res.status(201).json({
      message: "Response added successfully",
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * =========================
 * FILTERS & SEARCH
 * =========================
 */

// export const getDocumentByName = async (req, res, next) => {
//   try {
//     const userId = req.user.userId;
//     const { name } = req.params;

//     const documents = await Document.find({
//       userId,
//       title: { $regex: name, $options: "i" },
//     }).lean();

//     res.status(200).json({
//       message: `Found ${documents.length} document(s)`,
//       data: documents,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// export const getDocumentByRef = async (req, res, next) => {
//   try {
//     const userId = req.user.userId;
//     const { ref } = req.params;

//     console.log(ref)

//     const document = await Document.findOne({ ref, userId }).lean();

//     res.status(200).json({
//       message: document ? "Document found" : "Document not found",
//       data: document || null,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// export const getDocumentsByFileCategory = async (req, res, next) => {
//   try {
//     const userId = req.user.userId;
//     const { category } = req.params;

//     console.log(category)

//     const documents = await Document.find({
//       userId,
//       category,
//     }).lean();

//     res.status(200).json({
//       message: `Found ${documents.length} document(s)`,
//       data: documents,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// export const getDocumentsByReceptionMode = async (req, res, next) => {
//   try {
//     const userId = req.user.userId;
//     const { mode } = req.params;

//     const documents = await Document.find({
//       userId,
//       receptionMode: mode,
//     }).lean();

//     res.status(200).json({
//       message: `Found ${documents.length} document(s)`,
//       data: documents,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// export const viewRespondedDocuments = async (req, res, next) => {
//   try {
//     const userId = req.user.userId;

//     const documents = await Document.find({
//       userId,
//       responseStatus: "responded",
//     }).lean();

//     res.status(200).json({
//       message: "Responded documents retrieved successfully",
//       data: documents,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// export const viewUnrespondedDocuments = async (req, res, next) => {
//   try {
//     const userId = req.user.userId;

//     const documents = await Document.find({
//       userId,
//       responseStatus: "not-responded",
//     }).lean();

//     res.status(200).json({
//       message: "Unresponded documents retrieved successfully",
//       data: documents,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// export const getDocumentsByCategory = async (req, res, next) => {
//   try {
//     const userId = req.user.userId;
//     const { category } = req.params;

//     const documents = await Document.find({
//       userId,
//       category: { $regex: category, $options: "i" },
//     }).lean();

//     res.status(200).json({
//       message: `Found ${documents.length} document(s)`,
//       data: documents,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// export const getDocumentsBySender = async (req, res, next) => {
//   try {
//     const userId = req.user.userId;
//     const { sender } = req.params;

//     const documents = await Document.find({
//       userId,
//       sender,
//     }).lean();

//     res.status(200).json({
//       message: `Found ${documents.length} document(s)`,
//       data: documents,
//     });
//   } catch (error) {
//     next(error);
//   }
// };
