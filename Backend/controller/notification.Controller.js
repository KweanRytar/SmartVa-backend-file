import { Notification } from '../model/notification.model.js';

// Delete a notification by ID
export const deleteNotification = async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    const notification = await Notification.findOneAndDelete({ _id: id, userId }).lean();

    if (!notification) {
      const err = new Error('Notification not found or not authorized');
      err.statusCode = 404;
      return next(err);
    }

    res.status(200).json({
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
