import mongoose from "mongoose";

const delegateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false,
  index: true
   },
  
  name: { type: String, required: false },
  email: { type: String, required: true, index: true },

});

delegateSchema.pre("save", function (next){
  if (this.email) this.email = this.email.toLowerCase();
  next();
})

const subtaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  dueDate: { type: Date, required: true },
  delegate: [delegateSchema],
  priority: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed'],
    default: 'Pending'
  }
});

subtaskSchema.pre('save', function (next){
  if (!this._id){
    this._id = new mongoose.Types.ObjectId();
  }
  next();
})

 const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  dueDate: { type: Date, required: true },
  delegate: [delegateSchema],
  priority:  {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed'],
    default: 'Pending'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  subTasks: [subtaskSchema]
})

taskSchema.index({ userId: 1 });
taskSchema.index({ 'delegate.email': 1 });
taskSchema.index({ 'delegate.userId': 1 });
taskSchema.index({ priority: 1, userId: 1 });
taskSchema.index({ status: 1, userId: 1 });
taskSchema.index({ 'subTasks.delegate.email': 1 });


export const Task = mongoose.model('Task', taskSchema);


//  <div className="flex flex-col mt-4">
          //   <label className="mb-1 font-semibold">Delegate</label>
          //   <input
          //     type="text"
          //     placeholder="Delegate Username (if SmartVA user)"
          //     value={taskData.delegate.username}
          //     onChange={(e) =>
          //       handleMainDelegateChange("username", e.target.value)
          //     }
          //     className="bg-gray-400 dark:bg-gray-500 rounded-2xl h-10 p-4 mb-2"
          //   />
          //   <input
          //     type="text"
          //     placeholder="Delegate Name (if external)"
          //     value={taskData.delegate.name}
          //     onChange={(e) => handleMainDelegateChange("name", e.target.value)}
          //     className="bg-gray-400 dark:bg-gray-500 rounded-2xl h-10 p-4 mb-2"
          //   />
          //   <input
          //     type="email"
          //     placeholder="Delegate Email (if external)"
          //     value={taskData.delegate.email}
          //     onChange={(e) => handleMainDelegateChange("email", e.target.value)}
          //     className="bg-gray-400 dark:bg-gray-500 rounded-2xl h-10 p-4"
          //   />
          // </div>