import mongoose from "mongoose";

const responseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    ref: {
      type: String,
      trim: true,
    },

    summary: {
      type: String,
      required: true,
      trim: true,
    },

    resStatus: {
      type: Boolean,
      default: false,
    },
  receptionMode: {
      type: String,
      enum: ["virtual", "in-person"],
      required: true,
    },

    fileCategory: {
      type: String,
      trim: true,
      required: function () {
        return this.receptionMode === 'in-person';
      },
    },

 type: {
      type: String,
      enum: ["incoming", "outgoing"],
      required: true,
    },
    respondedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    // =========================
    // Core document info
    // =========================
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },
     category: {
      type: String,
      default: "General",
      trim: true,
    },
     sender: {
      type: String,
      required: true,
      trim: true,
    },

    ref: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
      type: {
      type: String,
      enum: ["incoming", "outgoing"],
      required: true,
    },

   receptionMode: {
      type: String,
      enum: ["virtual", "in-person"],
      required: true,
    },

     fileCategory: {
      type: String,
      trim: true,
      required: function () {
        return this.receptionMode === 'in-person';
      },
    },
    responseStatus: {
      type: String,
      enum: ["not_required", "pending", "responded"],
      default: "pending",
    },
  
   responses: {
      type: [responseSchema],
      required: function () {
        return this.responseStatus !== "not_required" || (this.responseStatus === "responded" );
      }
   },

    // =========================
    // Ownership
    // =========================
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    
    },
  },
  {
    timestamps: true,
  }
);

// =========================
// Indexes
// =========================
documentSchema.index({ userId: 1, title: 1 });
documentSchema.index({ userId: 1, category: 1 });
documentSchema.index({ userId: 1, sender: 1 });
documentSchema.index({ userId: 1, receptionMode: 1 });
documentSchema.index({ userId: 1, fileCategory: 1 });
documentSchema.index({ userId: 1, ref: 1 });
documentSchema.index({ ref: 1 }, { unique: true, sparse: true });

export default mongoose.model("Document", documentSchema);



