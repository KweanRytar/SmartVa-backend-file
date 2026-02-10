// task.controller.js
import { Task } from "../model/task.model.js";
import { Resend } from "resend";

import { User } from "../model/user.model.js";
import { Notification } from "../model/notification.model.js";
import mongoose from "mongoose";
import { agenda } from "./event.controller.js";
import { normalizeDelegates } from "../Helpers/delegateNormalizer.js";
import { sendMailToDelegatesOfTask } from "./sendMailToConcernedMembers.js";
import { sendUpdatedTaskEmail } from "./sendMailToConcernedMembers.js";
import { getIO } from "../socket.js";

/**
 * Utility to normalize the authenticated user's id & email
 * Accepts req.user as either a string id or an object { _id, email, ... }
 */
const getUserInfo = (req) => {
  const userId = req.user.userId
  if(!userId){
  throw new Error("you are not authorized")}
  return userId
 
};

const resend = new Resend(process.env.RESEND_API)

/**
 * Create a task
 */
/**
 * Create a task
 */
export const createTask = async (req, res, next) => {
  const { title, description, dueDate, delegate, priority, status, subTasks } =
    req.body;

  const userId = getUserInfo(req);

  try {
    // ✅ Validation
    if (!title || !description || !dueDate || !delegate || !priority) {
      const err = new Error("All fields except subtasks are required");
      err.statusCode = 400;
      return next(err);
    }

    // ✅ Get assignee
    const assignee = await User.findById(userId);
    if (!assignee) {
      const err = new Error("Assignee user not found");
      err.statusCode = 404;
      return next(err);
    }

    const assigneeName = assignee.fullName || "User";

    // ✅ Normalize main task delegates
    const normalizedDelegate = await normalizeDelegates(delegate);

    // ✅ Normalize subtask delegates
    const normalizedSubTasks = Array.isArray(subTasks)
      ? await Promise.all(
          subTasks.map(async (sub) => ({
            ...sub,
            delegate: await normalizeDelegates(sub.delegate),
          }))
        )
      : [];

    // ✅ Create task
    const task = await Task.create({
      title,
      description,
      dueDate,
      delegate: normalizedDelegate,
      priority,
      status,
      subTasks: normalizedSubTasks,
      userId,
    });

    // ✅ Generate delegate display name
    const generateDelegateName = async (email) => {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (user) return user.fullName;

      const raw = email.split(/[@.]/)[0];
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    };

    // ===============================
    // 📧 EMAIL NOTIFICATIONS
    // ===============================

    await Promise.all(
      normalizedDelegate.map(async (d) => {
        try {
          const delegateName = await generateDelegateName(d.email);
          await sendMailToDelegatesOfTask(
            d.email,
            delegateName,
            title,
            description,
            dueDate,
            assigneeName
          );
        } catch (err) {
          console.error("Delegate email failed:", err.message);
        }
      })
    );

    await Promise.all(
      normalizedSubTasks.flatMap((sub) =>
        sub.delegate.map(async (d) => {
          try {
            const delegateName = await generateDelegateName(d.email);
            await sendMailToDelegatesOfTask(
              d.email,
              delegateName,
              sub.title,
              sub.description,
              sub.dueDate,
              assigneeName
            );
          } catch (err) {
            console.error("Subtask email failed:", err.message);
          }
        })
      )
    );

    // ===============================
    // 🔔 IN-APP NOTIFICATIONS FOR MAIN TASK
    // ===============================

    const io = getIO();
    const notificationMessage = `You have been assigned a new task: "${title}" with due date ${new Date(
      dueDate
    ).toLocaleDateString()}.`;

    await Promise.all(
      normalizedDelegate.map(async (d) => {
        if (!d.userId) return;

        await Notification.create({
          userId: d.userId,
          message: notificationMessage,
        });

        io.to(d.userId.toString()).emit("new-notification", {
          message: notificationMessage,
        });
      })
    );

    // 🔔 IN-APP NOTIFICATIONS FOR SUBTASKS
    await Promise.all(
      normalizedSubTasks.flatMap((sub) => {
        return sub.delegate.map(async (d) => {
          if (!d.userId) return;
          const subtaskNotificationMessage = `You have been assigned a new subtask: "${sub.title}" with due date ${new Date(
            sub.dueDate
          ).toLocaleDateString()}.`;
          await Notification.create({
            userId: d.userId,
            message: subtaskNotificationMessage,
          });
          io.to(d.userId.toString()).emit("new-notification", {
            message: subtaskNotificationMessage,
          });
        });
      })
    )


    // ===============================
    // ⏰ SCHEDULE REMINDER (AGENDA)
    // ===============================

    const notificationTime =
      new Date(dueDate).getTime() - 2 * 24 * 60 * 60 * 1000;

    if (notificationTime > Date.now()) {
      await agenda.schedule(
        new Date(notificationTime),
        "create event notification",
        {
          userId,
          message: `Your task titled "${title}" will be due in two days.`,
        }
      );
    }

    return res.status(201).json({
      message: "Task created successfully",
      task,
    });
  } catch (error) {
    return next(error);
  }
};
/**
 * Search tasks for the authenticated user (created by them OR where they are a delegate/subtask delegate)
 * Supports pagination via ?page=1&limit=10 and a `search` query param for text search
 */
export const searchTasks = async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  const userId  = getUserInfo(req); // ✅ extract properly
  const { title } = req.params;

  try {
    console.log("🔍 Searching tasks for user:", userId, "Search term:", title);

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const searchRegex = { $regex: title, $options: "i" }; // ✅ case-insensitive

    // 🔹 User ownership / delegation filter
    const ownershipOrDelegateFilter = {
      $or: [
        { userId },
        { delegate: { $elemMatch: { userId } } },
        { subTasks: { $elemMatch: { delegate: { $elemMatch: { userId } } } } },
      ],
    };

    // 🔹 Text search filter (title, description, etc.)
    const textMatchFilter = {
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        { subTasks: { $elemMatch: { title: searchRegex } } },
      ],
    };

    // Combine filters
    const query = { $and: [ownershipOrDelegateFilter, textMatchFilter] };

    const tasks = await Task.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Task.countDocuments(query);

    

    res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      tasks, // ✅ renamed to match frontend
    });
  } catch (error) {
    console.error("❌ Task search error:", error);
    next(error);
  }
};



/**
 * Get all tasks (owner or where delegate matches) with pagination
 */
export const getTasks = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    // normalize userId
    const userId = getUserInfo(req); // should return req.user.userId
    if (!userId) {
      const err = new Error("Unauthorized: No user ID found");
      err.statusCode = 401;
      return next(err);
    }

    // Ensure ObjectId type for query
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Filter: tasks created by user OR delegated to user
    const filter = {
      $or: [{ userId: userObjectId }, { "delegate.userId": userObjectId }],
    };

    // Count total tasks
    const totalTasks = await Task.countDocuments(filter);

    // Paginate tasks
    const tasks = await Task.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return res.status(200).json({
      message: "Tasks retrieved successfully",
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(totalTasks / limit),
      totalTasks,
      tasks,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Get task by id
 * Allows owner or delegate/subtask delegate to fetch (safer than owner-only)
 */
export const getTaskById = async (req, res, next) => {
  const { taskId } = req.params;
  const userId = getUserInfo(req);

  try {
    // 🟢 1. Try finding a main task
    let task = await Task.findOne({
      _id: taskId,
      $or: [
        { userId },
        { "delegate.userId": userId },
        
        { "subTasks.delegate.userId": userId },
     
      ],
    });

    // ✅ If found as a main task
    if (task) {
      return res
        .status(200)
        .json({ message: "Task retrieved successfully", isSubtask: false, task });
    }

    // 🟡 2. If not found, try finding as a subtask
    const parentTask = await Task.findOne({
      "subTasks._id": taskId,
      $or: [
        { userId },
        { "delegate.userId": userId },
     
        { "subTasks.delegate.userId": userId },
        
      ],
    });

    if (!parentTask) {
      const err = new Error("Task or subtask not found or not authorized");
      err.statusCode = 404;
      return next(err);
    }

    // Extract the specific subtask
    const subtask = parentTask.subTasks.find(st => st._id.toString() === taskId);

    // ✅ Return subtask data separately
    return res.status(200).json({
      message: "Subtask retrieved successfully",
      isSubtask: true,
      parentTaskId: parentTask._id,
      subtask,
    });

  } catch (error) {
    return next(error);
  }
};

export const markTaskAsCompleted = async (req, res, next) => {
  const { taskId } = req.params;
  const userId = getUserInfo(req);

  try {
    const taskToUpdate = await Task.findOne({
      $or: [{ _id: taskId }, { "subTasks._id": taskId }],
      userId,
    });

    if (!taskToUpdate) {
      const err = new Error("Task not found or not authorized");
      err.statusCode = 404;
      return next(err);
    }

    // If it's the main task
    if (taskToUpdate._id.toString() === taskId) {
      if (taskToUpdate.status === "Completed") {
        return res.status(200).json({ message: "Task is already completed", task: taskToUpdate });
      }

      taskToUpdate.status = "Completed";
    } 
    // If it's a subtask
    else {
      const subTask = taskToUpdate.subTasks.id(taskId);
      if (!subTask) {
        const err = new Error("Subtask not found");
        err.statusCode = 404;
        return next(err);
      }

      if (subTask.status === "Completed") {
        return res.status(200).json({ message: "Subtask is already completed", task: taskToUpdate });
      }

      subTask.status = "Completed";
    }

    await taskToUpdate.save();

    return res.status(200).json({
      message: "Marked as completed successfully",
      task: taskToUpdate,
    });
  } catch (error) {
    next(error);
  }
};


/**
 * Update task (owner only)
 */   

export const updateTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const userId = getUserInfo(req);
    const updateData = req.body;

    // ===============================
    // 🔍 Find existing task
    // ===============================
    const oldTask = await Task.findOne({ _id: taskId, userId });
    if (!oldTask) {
      const err = new Error("Task not found or not authorized");
      err.statusCode = 404;
      return next(err);
    }

    const notificationMessage = `Task "${ oldTask.title}" has been updated. Please check the details.`;

    // ===============================
    // 🔄 Update task
    // ===============================
    const updatedTask = await Task.findOneAndUpdate(
      { _id: taskId, userId },
      { $set: updateData },
      { new: true }
    );

    if (!updatedTask) {
      const err = new Error("Task update failed");
      err.statusCode = 400;
      return next(err);
    }



    // ===============================
    // 👤 Generate delegate display name
    // ===============================
    const generateDelegateName = async (email) => {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (user) return user.fullName;

      const raw = email.split(/[@.]/)[0];
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    };

    // ===============================
    // 📧 Notify MAIN delegates (email)
    // ===============================
    await Promise.all(
      updatedTask.delegate.map(async (d) => {
        if (!d.email) return;

        try {
          const delegateName = await generateDelegateName(d.email);
          await sendUpdatedTaskEmail(d.email, delegateName, updatedTask);
        } catch (err) {
          console.error("Delegate update email failed:", err.message);
        }
      })
    );

    // ===============================
    // 📧 Notify SUBTASK delegates (email)
    // ===============================
    await Promise.all(
      updatedTask.subTasks.flatMap((sub) =>
        sub.delegate.map(async (d) => {
          if (!d.email) return;

          // check if mail existed in main task delegates to avoid duplicate mails
          if (updatedTask.delegate.some(mainD => mainD.email === d.email)) return;

          try {
            const delegateName = await generateDelegateName(d.email);
            await sendUpdatedTaskEmail(d.email, delegateName, {
              ...updatedTask.toObject(),
              subTask: sub,
            });
          } catch (err) {
            console.error("Subtask delegate email failed:", err.message);
          }
        })
      )
    );

    // ===============================
    // 🔔 Real-time notifications (Socket)
    // ===============================
    const io = getIO();

    const notifyUser = async (email) => {
      if (!email) return;

      const user = await User.findOne({ email: email.toLowerCase() }).select("_id");
      if (!user?._id) return;

      await Notification.create({
        userId: user._id,
        message: notificationMessage,
      });

      io.to(user._id.toString()).emit("new-notification", {
        message: notificationMessage,
      });
    };

    // Notify main delegates
    await Promise.all(updatedTask.delegate.map((d) => notifyUser(d.email)));

    // Notify subtask delegates
    await Promise.all(
      updatedTask.subTasks.flatMap((sub) => {

// check if user was already notified in main task delegates
      if(updatedTask.delegate.some(mainD => mainD.email === sub.email)) return;

        sub.delegate.map((d) => notifyUser(d.email))
   } )
    );

    // ===============================
    // ✅ Response
    // ===============================
    return res.status(200).json({
      message: "Task updated successfully",
      task: updatedTask,
    });
  } catch (err) {
    next(err);
  }
};    
  
/**
 * Delete task (owner only)
 */
export const deleteTask = async (req, res, next) => {
  const { taskId } = req.params;
  const userId = getUserInfo(req);

  try {
    // Try deleting a main task
    const mainTask = await Task.findOneAndDelete({ _id: taskId, userId });
    if (mainTask) {
      return res.status(200).json({
        message: "Main task deleted successfully",
        task: mainTask,
      });
    }

    // Try deleting a subtask
    const parentTask = await Task.findOne({ "subTasks._id": taskId, userId });
    if (!parentTask) {
      return res.status(404).json({ message: "Task or subtask not found" });
    }

    const subTask = parentTask.subTasks.id(taskId);
    if (!subTask) {
      return res.status(404).json({ message: "Subtask not found" });
    }

    // Proper subtask removal
    subTask.deleteOne(); // <--- use deleteOne() instead of remove()
    await parentTask.save();

    return res.status(200).json({
      message: "Subtask deleted successfully",
      task: parentTask,
    });
  } catch (error) {
    next(error);
  }
};

// get all unique delegates across all tasks for the authenticated user
export const getAllDelegates = async (req, res, next) => {
  const userId = getUserInfo(req);

  try {
    const tasks = await Task.find({ userId }).lean();

    const delegateMap = new Map();
    const today = new Date();

    tasks.forEach(task => {
      // function to update delegate info
      const processDelegate = (d, task) => {
        const email = d.email?.toLowerCase();
        if (!email) return;

        const name = d.name || "Unknown";

        // Initialize delegate entry if not exists
        if (!delegateMap.has(email)) {
          delegateMap.set(email, {
            name,
            email,
            phone: d.phone || "",
            taskCount: 0,
            pending: false,
            overdue: false,
          });
        }

        const delegateEntry = delegateMap.get(email);

        // Increment task count
        delegateEntry.taskCount += 1;

        // Mark pending if any of the tasks is pending
        if (task.status?.toLowerCase() === "pending") {
          delegateEntry.pending = true;
        }

        // Mark overdue if due date is past today and not completed
        if (task.dueDate && new Date(task.dueDate) < today && task.status?.toLowerCase() !== "completed") {
          delegateEntry.overdue = true;
        }

        delegateMap.set(email, delegateEntry);
      };

      // --- Main task delegates ---
      task.delegate?.forEach(d => processDelegate(d, task));

      // --- Subtask delegates ---
      task.subTasks?.forEach(sub => {
        sub.delegate?.forEach(d => processDelegate(d, sub));
      });
    });

    const delegates = Array.from(delegateMap.values());

    res.status(200).json({
      message: "Delegates fetched successfully",
      delegates,
    });
  } catch (err) {
   next(err);
  }
};




/**
 * Shared helper for filtered GET endpoints.
 * Signature: (filterObject, label, req, res, next)
 * It will merge userId into the filter if not already present.
 */
const getTasksByFilter = async (filter = {}, label = "Tasks", req, res, next) => {
  const userId = getUserInfo(req)
  try {
    // If caller already supplied userId in filter, keep it; otherwise enforce owner
    const finalFilter = { ...filter };
    if (finalFilter.userId === undefined && finalFilter.userId === undefined) {
      // only attach userId when not already present in the filter (owner-limited queries)
      finalFilter.userId = userId;
    }

    const tasks = await Task.find(finalFilter);
    return res.status(200).json({ message: `${label} tasks retrieved successfully`, tasks });
  } catch (error) {
    return next(error);
  }
};

/* Filtered endpoints using getTasksByFilter (correct param ordering) */
export const getTasksByDueDate = (req, res, next) =>
  getTasksByFilter({ dueDate: req.params.dueDate }, "Due date", req, res, next);

export const getTasksByStatus = (req, res, next) =>
  getTasksByFilter({ status: req.params.status }, "Status", req, res, next);

export const getTasksByTitle = (req, res, next) =>
  getTasksByFilter({ title: req.params.title }, "Title", req, res, next);

export const getPendingTasks = (req, res, next) =>
  getTasksByFilter({ status: "Pending" }, "Pending", req, res, next);

export const getCompletedTasks = (req, res, next) =>
  getTasksByFilter({ status: "Completed" }, "Completed", req, res, next);

export const getOverdueTasks = (req, res, next) =>
  getTasksByFilter({ dueDate: { $lt: new Date() } }, "Overdue", req, res, next);

export const getTasksByPriority = (req, res, next) =>
  // Model field appears to be `priorites` — accept that
  getTasksByFilter({ priorites: req.params.priority }, "Priority", req, res, next);

export const getTasksByDelegate = (req, res, next) => {
  const delegateIdentifier = req.params.delegate;
  // We DON'T attach userId here so delegates can be searched across the owner's tasks via getTasksByFilter merging
  const filter = {
    $or: [
      { "delegate.name": delegateIdentifier },
      { "delegate.email": delegateIdentifier }
    ]
  };
  return getTasksByFilter(filter, "Delegate", req, res, next);
};

export const getEmergencyTasks = (req, res, next) =>
  // emergency = high priority and due within next 24 hours
  getTasksByFilter(
    {
      $and: [
        { priorites: "High" },
        { dueDate: { $lt: new Date(Date.now() + 24 * 60 * 60 * 1000) } }
      ]
    },
    "Emergency",
    req, res, next
  );

export const getTasksDueInNext72Hours = (req, res, next) =>
  getTasksByFilter(
    { dueDate: { $lte: new Date(Date.now() + 72 * 60 * 60 * 1000) } },
    "Due in the next 72 hours",
    req, res, next
  );

/**
 * Delegates listing helper (returns distinct delegate entries for tasks filtered by owner)
 * Signature: (filter, label, req, res, next)
 */


export const getDelegateDetails = async (req, res, next) => {
  try {
    const { delegateEmail } = req.params;
    const normalizedEmail = delegateEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ message: "Invalid delegate email" });
    }

    const now = new Date();

    const results = await Task.aggregate([
      // Match tasks with this delegate
      {
        $match: {
          $or: [
            { "delegate.email": normalizedEmail },
            { "subTasks.delegate.email": normalizedEmail },
          ],
        },
      },

      // Extract main task assignments
      {
        $addFields: {
          mainAssignments: {
            $map: {
              input: {
                $filter: {
                  input: "$delegate",
                  cond: { $eq: ["$$this.email", normalizedEmail] },
                },
              },
              in: {
                _id: "$_id",
                title: "$title",
                status: "$status",
                dueDate: "$dueDate",
                type: "task",
                delegateName: "$$this.name",
              },
            },
          },
        },
      },

      // Extract subtask assignments
      {
        $addFields: {
          subAssignments: {
            $map: {
              input: {
                $filter: {
                  input: "$subTasks",
                  cond: { $in: [normalizedEmail, "$$this.delegate.email"] },
                },
              },
              in: {
                _id: "$$this._id",
                parentTaskId: "$_id",
                title: "$$this.title",
                status: "$$this.status",
                dueDate: "$$this.dueDate",
                parentTask: "$title",
                type: "subtask",
                delegateName: {
                  $first: {
                    $map: {
                      input: {
                        $filter: {
                          input: "$$this.delegate",
                          cond: { $eq: ["$$this.email", normalizedEmail] },
                        },
                      },
                      in: "$$this.name",
                    },
                  },
                },
              },
            },
          },
        },
      },

      // Combine all assignments
      {
        $project: {
          assignments: { $concatArrays: ["$mainAssignments", "$subAssignments"] },
        },
      },

      // Group all results
      {
        $group: {
          _id: null,
          allAssignments: { $push: "$assignments" },
        },
      },
    ]);

    if (!results.length || !results[0].allAssignments.length) {
      return res.status(404).json({
        message: "No tasks found for the specified delegate email",
      });
    }

    // Flatten assignments
    const assignments = results[0].allAssignments.flat();

    // Calculate totals
    const totalPending = assignments.filter((a) => a.status === "Pending").length;
    const totalCompleted = assignments.filter((a) => a.status === "Completed").length;
    const totalOverdue = assignments.filter(
      (a) => new Date(a.dueDate) < now && a.status !== "Completed"
    ).length;

    const delegateName = assignments.find((a) => a.delegateName)?.delegateName || null;

    res.status(200).json({
      delegateName,
      delegateEmail: normalizedEmail,
      totalPending,
      totalCompleted,
      totalOverdue,
      assignments,
    });
  } catch (error) {
    console.error("Delegate details error:", error);
    next(error);
  }
};


// get delegates by status 

const getDelegatesByStatus = async (filter, req, res, next) => {
  try {
    const userId = getUserInfo(req); // get logged-in user ID

    // fetch tasks for this user
    const userTasks = await Task.find({ userId });

    const delegateMap = new Map();

    // reusable filter function
    const matchesFilter = (item) => {
      if (filter.status && item.status !== filter.status) return false;
      if (filter.dueDate && item.dueDate >= filter.dueDate.$lt) return false;
      return true;
    };

    // helper: process delegates of a task/subtask
    const processDelegates = (taskOrSub) => {
      if (!matchesFilter(taskOrSub)) return;

      taskOrSub.delegate.forEach((d) => {
        const email = d.email.toLowerCase();
        delegateMap.set(email, { name: d.name, email, task: taskOrSub });
      });
    };

    // iterate all tasks
    userTasks.forEach((task) => {
      processDelegates(task); // main task

      // iterate subtasks
      task.subTasks.forEach((sub) => processDelegates(sub));
    });

    res.status(200).json({
      message: `Delegates retrieved successfully`,
      delegates: Array.from(delegateMap.values()),
    });
  } catch (error) {
    next(error);
  }
};

// export specific endpoints
export const getDelegatesWithPendingTasks = (req, res, next) =>
  getDelegatesByStatus({ status: "Pending" }, req, res, next);

export const getDelegatesWithCompletedTasks = (req, res, next) =>
  getDelegatesByStatus({ status: "Completed" }, req, res, next);

export const getDelegatesWithOverdueTasks = (req, res, next) =>
  getDelegatesByStatus({ dueDate: { $lt: new Date() } }, req, res, next);


/**
 * Send email to delegate(s) — owner only
 */
export const messageDelegate = async (req, res, next) => {
  try {
    const { delegateEmail, subject, message } = req.body;
    const userId = getUserInfo(req);

    console.log("Message delegate request by user:", userId, "to:", delegateEmail);

    // 🔒 Validate input
    if (!delegateEmail || !subject || !message) {
      return res.status(400).json({
        message: "Delegate email, subject, and message are required",
      });
    }

    const email = delegateEmail.trim().toLowerCase();

    // 🔍 Get sender name
    const sender = await User.findById(userId).select("fullName").lean();
    if (!sender) {
      return res.status(404).json({ message: "Sender not found" });
    }

    /**
     * OPTIONAL BUT SMART:
     * Confirm this delegate has ever been assigned a task by the user
     * (prevents random email abuse)
     */
    const delegateExists = await Task.exists({
      userId,
      $or: [
        { "delegate.email": email },
        { "subTasks.delegate.email": email },
      ],
    });

    if (!delegateExists) {
      return res.status(404).json({
        message: "This delegate is not associated with any of your tasks",
      });
    }

    

    // ✉️ Send mail
   const {data, error} = await resend.emails.send({
      from: `${sender.fullName} <${process.env.EMAIL_FROM}>`,
      to: email,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Message from ${sender.fullName}</h2>

          <div style="background-color: #fff; padding: 20px; border-left: 4px solid #4CAF50;">
            <p style="color: #333; line-height: 1.6; white-space: pre-wrap;">
              ${message}
            </p>
          </div>

          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            Sent via SmartVA
          </p>
        </div>
      `,
    });
   if (error) {
  console.error("Resend send error:", error); // ← log full error!

  let errorMessage = "Failed to send email";
  let status = 500;

  if (error.statusCode === 401 || error.statusCode === 403) {
    errorMessage = "Email service authentication failed. Contact support.";
    status = 503;
  } else if (error.statusCode === 429) {
    errorMessage = "Too many emails sent. Please try again later.";
    status = 429;
  } else if (error.message?.includes("from")) {
    errorMessage = "Invalid sender address. Please check configuration.";
  } else if (error.message) {
    errorMessage = error.message; // expose safe parts only
  }

  return res.status(status).json({ 
    message: errorMessage,
    // optional: errorCode: error.code or error.statusCode
  });
}
    return res.status(200).json({
      success: true,
      message: "Message sent successfully",
      recipient: email,
    });
  } catch (error) {
    console.error("Message delegate error:", error);
    next(error);
  }
};

/**
 * Send email to subtask delegate(s) — owner only
 */
export const messageSubtaskDelegate = async (req, res, next) => {
  const { subtaskId } = req.params;
  const { message, delegateName, delegateEmail } = req.body;
  const { id: userId, displayName } = getUserInfo(req);

  try {
    // Find the task that contains the subtask and ensure owner is the authenticated user
    const task = await Task.findOne({ "subtasks._id": subtaskId, userId });
    if (!task) {
      const err = new Error("You are not authorized to access this subtask or it does not exist.");
      err.statusCode = 403;
      return next(err);
    }

    const subtask = task.subtask.id(subtaskId);
    if (!subtask) {
      const err = new Error("Subtask not found");
      err.statusCode = 404;
      return next(err);
    }

    if (!subtask.delegate || !Array.isArray(subtask.delegate) || subtask.delegate.length === 0) {
      const err = new Error("No delegates found for this subtask");
      err.statusCode = 404;
      return next(err);
    }

    let recipients = [];
    if (delegateName || delegateEmail) {
      recipients = subtask.delegate.filter(d =>
        (delegateName && d.name === delegateName) ||
        (delegateEmail && d.email === delegateEmail)
      );

      if (recipients.length === 0) {
        const err = new Error("Delegate not found with provided name or email");
        err.statusCode = 404;
        return next(err);
      }
    } else {
      recipients = subtask.delegate;
    }

   

    for (const delegate of recipients) {
      const {data, error} = await resend.emails.send({
        from: `${displayName} <${process.env.EMAIL_FROM}>`,
        to: delegate.email,
        subject: "Subtask Reminder",
        text: message
      });
    }

    if (error) {
      throw new Error("Failed to send email to one or more delegates");
    }

    return res.status(200).json({ message: `Message sent to ${recipients.length} subtask delegate(s) successfully` });
  } catch (error) {
    return next(error);
  }
};

/**
 * Delegate updates only the status of a main task.
 * Only allowed when the logged-in user is a registered delegate (matched by userId on the delegate entry)
 */
export const delegateUpdateTaskStatus = async (req, res, next) => {
  const { taskId } = req.params;
  const { status } = req.body;
  const { id: userId } = getUserInfo(req);

  if (!status) {
    const err = new Error("Status is required");
    err.statusCode = 400;
    return next(err);
  }

  try {
    const task = await Task.findById(taskId);
    if (!task) {
      const err = new Error("Task not found");
      err.statusCode = 404;
      return next(err);
    }

    const isDelegate = Array.isArray(task.delegate) && task.delegate.some(d =>
      (d.userId && d.userId.toString() === userId)
    );

    if (!isDelegate) {
      const err = new Error("You are not authorized to update this task's status");
      err.statusCode = 403;
      return next(err);
    }

    task.status = status;
    await task.save();

    return res.status(200).json({ message: "Task status updated successfully", task });
  } catch (error) {
    return next(error);
  }
};

/**
 * Delegate updates only the status of a subtask.
 * Only allowed when the logged-in user is a registered delegate of that subtask.
 */
export const delegateUpdateSubtaskStatus = async (req, res, next) => {
  const { subtaskId } = req.params;
  const { status } = req.body;
  const { userId } = getUserInfo(req);

  // Validation
  if(!userId) {
    const err = new Error("Unauthorized: No user ID found");
    err.statusCode = 401;
    return next(err);
  }

  if (!status) {
    const err = new Error("Status is required");
    err.statusCode = 400;
    return next(err);
  }

  try {
    // Find task containing the subtask (no owner constraint because delegate can update)
    const task = await Task.findOne({ "subtasks._id": subtaskId });
    if (!task) {
      const err = new Error("Task or subtask not found");
      err.statusCode = 404;
      return next(err);
    }

    const subtask = task.subTasks.id(subtaskId);
    if (!subtask) {
      const err = new Error("Subtask not found");
      err.statusCode = 404;
      return next(err);
    }

    const isDelegate = Array.isArray(subtask.delegate) && subtask.delegate.some(d =>
      (d.userId && d.userId.toString() === userId)
    );

    if (!isDelegate) {
      const err = new Error("You are not authorized to update this subtask's status");
      err.statusCode = 403;
      return next(err);
    }

    subtask.status = status;
    await task.save();

    return res.status(200).json({ message: "Subtask status updated successfully", subtask });
  } catch (error) {
    return next(error);
  }
};

/**
 * List all subtasks where the logged-in user is a registered delegate or matched by email
 */
export const getSubtasksForDelegate = async (req, res, next) => {
  const { id: userId, email: userEmail } = getUserInfo(req);

  try {
    const tasks = await Task.find({
      $or: [
        { "subtasks.delegate.userId": userId },
        { "subtasks.delegate.email": userEmail }
      ]
    });

    const result = [];
    for (const task of tasks) {
      const matchingSubtasks = task.subtasks.filter(subtask =>
        Array.isArray(subtask.delegate) &&
        subtask.delegate.some(d =>
          (d.userId && d.userId.toString() === userId) ||
          (d.email && d.email === userEmail)
        )
      );

      if (matchingSubtasks.length > 0) {
        result.push({
          taskId: task._id,
          taskTitle: task.title,
          subtasks: matchingSubtasks
        });
      }
    }

    return res.status(200).json({ message: "Subtasks for delegate retrieved successfully", data: result });
  } catch (error) {
    return next(error);
  }
};


// get all delegates tasks
export const getAllDelegatesTasks = async (req, res, next) => {
  const  userId  = getUserInfo(req);
  const delegateEmail = req.params.delegateEmail;

  try {
    const delegateTasks = await Task.find({
      delegate: { $elemMatch: { email: delegateEmail } }
    })

    if (!delegateTasks || delegateTasks.length === 0) {
      const err = new Error("No tasks found for the specified delegate email");
      err.statusCode = 404;
      return next(err);
    }

const totalTasks = delegateTasks.length;
const pendingTasks = delegateTasks.filter(task => task.status === 'Pending');
const completedTasks = delegateTasks.filter(task => task.status === 'Completed');
const overdueTasks = delegateTasks.filter(task => new Date(task.dueDate) < new Date() && task.status !== 'Completed');

    return res.status(200).json({
      message: "Delegate tasks retrieved successfully",
      allTasks: delegateTasks,
      totalTasks,
      pendingTasksCount: pendingTasks.length,
      pendingTasks,
      completedTasksCount: completedTasks.length,
      completedTasks,
      overdueTasksCount: overdueTasks.length,
      overdueTasks
    })

  } catch (error) {
    console.error("Error retrieving delegate tasks:", error);
    return next(error);
  }

}