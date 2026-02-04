import mongoose from "mongoose";

const noteSchema = new mongoose.Schema({
    noteId: {
        type: String,
        required: true,
        unique: true,
        default: () => new mongoose.Types.ObjectId().toString(), 
    },
    title: {
        type: String,
        required: true,
    },
    contentHtml: {
        type: String,
        required: true,
    },
    contentText: {
        type: String,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    
},{ timestamps: true})

noteSchema.index({ userId: 1 });
noteSchema.index({ title: 1, userId: 1 });
noteSchema.index({contentText: 'text'})

const Note = mongoose.model("Note", noteSchema)

export default Note;