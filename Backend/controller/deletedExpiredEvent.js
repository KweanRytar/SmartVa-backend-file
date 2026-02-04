import { agenda } from "./event.controller.js";
import Event from "../model/event.model.js";
import BusyTime from "../model/busyTime.model.js";

/**
 * Agenda job: delete expired event
 */
const deleteExpiredEvents = () => {
  agenda.define("delete expired event", async (job) => {
    const { eventId, endTime, startTime, userId } = job.attrs.data;

    try {
      // Guard clauses (fast exit, no DB hit)
      if (!eventId || !userId || !endTime) return;

      if (new Date(endTime) > new Date()) return;

      // Delete event
      const deletedEvent = await Event.findOneAndDelete({
        _id: eventId,
        userId
      });

      if (!deletedEvent) return;

      // Cleanup busy time (non-blocking if already gone)
      await BusyTime.deleteOne({
        startTime,
        userId
      });
    } catch (error) {
      // Let Agenda handle retries & failure tracking
      throw new Error(`Agenda job failed for event ${eventId}`);
    }
  });

  return agenda;
};

export default deleteExpiredEvents;
