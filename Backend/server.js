// import dotenv
import dotenv from 'dotenv';

dotenv.config();


import express from 'express';
import http from 'http';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import { initSocket } from './socket.js';
import { dbConnection } from './model/connection.js';
import { errorHandler } from './middlewares/errorHandling.js';

// routes
import profileRoutes from './routes/profile.routes.js';
import contactRoutes from './routes/contact.routes.js';
import documentRoutes from './routes/document.routes.js';
import eventRoutes from './routes/events.routes.js';
import taskRoutes from './routes/task.routes.js';
import visitorRoutes from './routes/visitors.routes.js';
import userRoutes from './routes/user.routes.js';
import noteRoutes from './routes/notes.routes.js';

// services
import { sendEmail, sendNotifications } from "./controller/sendEmailReminder.js";


import { agenda } from './controller/event.controller.js';
import deleteExpiredEvents from './controller/deletedExpiredEvent.js';

const app = express();
const server = http.createServer(app);

// STOP CONSOLE LOGS 
console.log = console.warn = ()=>{};

 

await dbConnection();

// 🔥 INIT SOCKET FIRST
initSocket(server);




// background jobs (NOW socket exists)
sendEmail();
sendNotifications();
deleteExpiredEvents();
agenda.start();

// middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: [process.env.frontend_url, process.env.ALTERNATIVE_FRONTEND_URL],
  credentials: true,
}));

// routes
app.use('/contact', contactRoutes);
app.use('/document', documentRoutes);
app.use('/events', eventRoutes);
app.use('/task', taskRoutes);
app.use('/visitors', visitorRoutes);
app.use('/user', userRoutes);
app.use('/notes', noteRoutes);
app.use('/profile', profileRoutes);

// errors
app.use(errorHandler);



server.listen(process.env.port, () => {
  console.log("Server running on port 5000");
});
