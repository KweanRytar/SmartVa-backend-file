// ================================================
//                server.js
// ================================================

//  ERROR HANDLERS FIRST - BEFORE ANYTHING ELSE
process.on('unhandledRejection', (reason, promise) => {
  console.error(' Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(' Uncaught Exception:', error);
  process.exit(1);
});

// NOW load environment variables
import dotenv from "dotenv";
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

import express from "express";
import http from "http";
import cookieParser from "cookie-parser";
import cors from "cors";

// Internal imports
import { initSocket } from "./socket.js";
import { dbConnection } from "./model/connection.js";
import { errorHandler } from "./middlewares/errorHandling.js";

// Routes
import profileRoutes from "./routes/profile.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import documentRoutes from "./routes/document.routes.js";
import eventRoutes from "./routes/events.routes.js";
import taskRoutes from "./routes/task.routes.js";
import visitorRoutes from "./routes/visitors.routes.js";
import userRoutes from "./routes/user.routes.js";
import noteRoutes from "./routes/notes.routes.js";
import GMGRRoutes from "./routes/GMGR.routes.js";

// Background jobs & services
import { sendEmail, sendNotifications } from "./controller/sendEmailReminder.js";
import { agenda } from "./controller/event.controller.js";
import deleteExpiredEvents from "./controller/deletedExpiredEvent.js";
import { generalReminder } from "./controller/sendEmailReminder.js";


// ================================================
//                Initialize App
// ================================================
const app = express();
const server = http.createServer(app);

// Connect to database
await dbConnection();

// Initialize Socket.IO (must be before routes)
initSocket(server);

// Start background jobs
sendEmail();
sendNotifications();
deleteExpiredEvents();
generalReminder();
await agenda.start();

// ================================================
//                Middleware
// ================================================
app.use(express.json());
app.use(cookieParser());

// SET PROXY
app.set('trust proxy', 1);

// CORS
const allowedOrigins = [
  process.env.frontend_url,
  process.env.ALTERNATIVE_FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  credentials: true,
}));

// ================================================
//                Routes
// ================================================


app.use("/contact", contactRoutes);
app.use("/document", documentRoutes);
app.use("/events", eventRoutes);
app.use("/task", taskRoutes);
app.use("/visitors", visitorRoutes);
app.use("/user", userRoutes);
app.use("/notes", noteRoutes);
app.use("/profile", profileRoutes);
app.use("/general", GMGRRoutes)

// Error handling 
app.use(errorHandler);

// ================================================
//                Start Server
// ================================================
const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});