import express from 'express';
import {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  getTaskById,
  
  getTasksByDueDate,
  getTasksByStatus,
  getAllDelegates,
  getDelegateDetails,
  markTaskAsCompleted,

  getPendingTasks,
  getCompletedTasks,
   getAllDelegatesTasks,
  getOverdueTasks,
  getDelegatesWithCompletedTasks,
  getDelegatesWithPendingTasks,
  getEmergencyTasks,
  getTasksDueInNext72Hours,
  getTasksByPriority,
  getTasksByDelegate,
  getDelegatesWithOverdueTasks,
  messageDelegate,
  delegateUpdateTaskStatus,
  messageSubtaskDelegate,
  delegateUpdateSubtaskStatus,
  getSubtasksForDelegate,
  searchTasks, 
} from '../controller/task.controller.js';
import { authenticate } from '../middlewares/authenticate.js';  

const routes = express.Router();

// CRUD
routes.post('/', authenticate, createTask);
routes.get('/getAllTasks', authenticate, getTasks);
routes.put('/:taskId', authenticate, updateTask);
routes.delete('/:taskId', authenticate, deleteTask);

// Specific filters
routes.get('/title/:title', authenticate, searchTasks);
routes.get('/status/:status', authenticate, getTasksByStatus);
routes.get('/priority/:priority', authenticate, getTasksByPriority);
routes.get('/delegate/:delegate', authenticate, getTasksByDelegate);
routes.get('/due-date/:dueDate', authenticate, getTasksByDueDate);
routes.get('/delegates/allTask', authenticate, getAllDelegatesTasks);

// Status-based
routes.get('/pending', authenticate, getPendingTasks);
routes.get('/completed', authenticate, getCompletedTasks);
routes.get('/overdue', authenticate, getOverdueTasks);
routes.get('/due-in-next-72-hours', authenticate, getTasksDueInNext72Hours);
routes.get('/emergency/emergencyTasks', authenticate, getEmergencyTasks);

// Delegates by status
routes.get('/delegates/pending', authenticate, getDelegatesWithPendingTasks);
routes.get('/delegates/completed', authenticate, getDelegatesWithCompletedTasks);
routes.get('/delegates/overdue', authenticate, getDelegatesWithOverdueTasks);

// Messaging
routes.post('/delegate/message', authenticate, messageDelegate)
routes.post('/message/subtask/:subtaskId', authenticate, messageSubtaskDelegate);

// Add this route for delegates to update only the status of a task
routes.patch('/delegate/:taskId/status', authenticate, delegateUpdateTaskStatus);
routes.patch('/subtask/:subtaskId/status', authenticate, delegateUpdateSubtaskStatus);
routes.patch('/:taskId/mark-completed', authenticate, markTaskAsCompleted);

// Must be last
routes.get('/:taskId', authenticate, getTaskById);
routes.get('/subtasks/delegate', authenticate, getSubtasksForDelegate);
routes.get('/delegates/allDelegates', authenticate, getAllDelegates);
routes.get('/delegates/details/:delegateEmail', authenticate, getDelegateDetails);

export default routes;
