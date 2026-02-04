import express from 'express';
import { getSupervisorsByEmail, updateTaskStatusByDelegate, getEventsByMemberEmail } from '../controller/smartSpace.Controller.js';
import { deleteNotification } from '../controller/notification.Controller.js';
import { logout } from '../controller/user.controller.js';

const router = express.Router();
import { authenticate } from '../middlewares/authenticate.js';

router.get('/supervisors/:email', authenticate, getSupervisorsByEmail);

router.patch('/task/status/:taskId', authenticate, updateTaskStatusByDelegate);

router.get('/events/member/:email', authenticate, getEventsByMemberEmail);

router.delete('/notification/:id', authenticate, deleteNotification)

router.post('/logout', authenticate, logout);


export default router;