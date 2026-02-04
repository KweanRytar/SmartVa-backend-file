import Event from "../model/event.model.js";
import { Task } from "../model/task.model.js";
import { User } from "../model/user.model.js";

/* =====================================================
   GET SUPERVISORS BY EMAIL
===================================================== */
export const getSupervisorsByEmail = async (req, res, next) => {
  const userId = req.user.userId;
  const email = req.params.email?.toLowerCase();

  if (!email) return res.status(400).json({ message: "Email is required" });

  if (!userId) {
    const err = new Error("Unauthorized: No user ID found");
    err.statusCode = 401;
    return next(err);
  }

  try {
    const supervisors = await Task.aggregate([
      {
        $match: {
          $or: [
            { "delegate.email": email },
            { "subTasks.delegate.email": email }
          ]
        }
      },
      {
        $addFields: {
          supervisorId: {
            $cond: [
              { $gt: [{ $size: { $filter: { input: "$delegate", as: "d", cond: { $ne: ["$$d.userId", null] } } } }, 0] },
              { $arrayElemAt: [{ $map: { input: { $filter: { input: "$delegate", as: "d", cond: { $ne: ["$$d.userId", null] } } }, as: "sd", in: "$$sd.userId" } }, 0] },
              "$userId"
            ]
          }
        }
      },
      {
        $group: {
          _id: "$supervisorId",
          totalTasks: { $sum: 1 },
          tasks: { $push: "$$ROOT" }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "supervisor"
        }
      },
      { $unwind: { path: "$supervisor", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          supervisorId: "$_id",
          totalTasks: 1,
          supervisor: { _id: "$supervisor._id", fullName: "$supervisor.fullName", email: "$supervisor.email" },
          tasks: 1
        }
      }
    ]);

    res.status(200).json({ count: supervisors.length, supervisors });
  } catch (error) {
    next(error);
  }
};

/* =====================================================
   UPDATE TASK STATUS BY DELEGATE
===================================================== */
export const updateTaskStatusByDelegate = async (req, res, next) => {
  const { taskId } = req.params;
  const { status, isSubtask, subtaskId } = req.body;
  const userId = req.user.userId;

  try {
    const delegate = await User.findById(userId).select("email");
    if (!delegate) return res.status(404).json({ message: "Delegate not found" });

    let updatedTask;

    if (isSubtask) {
      if (!subtaskId) return res.status(400).json({ message: "Subtask ID is required" });

      const task = await Task.findOne({
        _id: taskId,
        "subTasks._id": subtaskId,
        "subTasks.delegate.email": delegate.email
      });

      if (!task) return res.status(403).json({ message: "You are not assigned to this subtask" });

      updatedTask = await Task.findOneAndUpdate(
        { _id: taskId, "subTasks._id": subtaskId },
        { $set: { "subTasks.$.status": status } },
        { new: true }
      );
    } else {
      const task = await Task.findOne({ _id: taskId, "delegate.email": delegate.email });
      if (!task) return res.status(403).json({ message: "You are not assigned to this task" });

      updatedTask = await Task.findOneAndUpdate(
        { _id: taskId, "delegate.email": delegate.email },
        { $set: { status } },
        { new: true }
      );
    }

    res.status(200).json({ message: "Status updated successfully", task: updatedTask });
  } catch (error) {
    next(error);
  }
};

/* =====================================================
   GET EVENTS WHERE USER IS A CONCERNED MEMBER
===================================================== */
export const getEventsByMemberEmail = async (req, res, next) => {
  const userId = req.user.userId;
  if (!userId) {
    const err = new Error("Unauthorized: No user ID found");
    err.statusCode = 401;
    return next(err);
  }

  try {
    const user = await User.findById(userId).select("email");
    if (!user) return res.status(404).json({ message: "User not found" });

    const events = await Event.find({ "concernedMembers.email": user.email })
      .populate("userId", "fullName email")
      .lean();

    const now = new Date();
    const in30Minutes = new Date(now.getTime() + 30 * 60 * 1000);
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const enrichedEvents = events.map(event => ({
      ...event,
      creatorName: event.userId?.fullName,
      creatorEmail: event.userId?.email
    }));

    res.status(200).json({
      count: enrichedEvents.length,
      events: enrichedEvents,
      eventsIn30Minutes: enrichedEvents.filter(e => e.startTime >= now && e.startTime <= in30Minutes),
      eventsIn24Hours: enrichedEvents.filter(e => e.startTime >= now && e.startTime <= in24Hours),
      eventsIn7Days: enrichedEvents.filter(e => e.startTime >= now && e.startTime <= in7Days)
    });
  } catch (error) {
    next(error);
  }
};
