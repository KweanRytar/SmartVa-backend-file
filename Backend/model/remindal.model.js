import mongoose from "mongoose";

const remindalSchema = new mongoose.Schema({
    title: String,
  reminderTime: Date,
  email: String
})

const Remindal = mongoose.model('Remindal', remindalSchema);

export default Remindal