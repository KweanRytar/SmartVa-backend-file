// ================================================
//                server.js
// ================================================

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

// Background jobs & services
import { sendEmail, sendNotifications } from "./controller/sendEmailReminder.js";
import { agenda } from "./controller/event.controller.js";
import deleteExpiredEvents from "./controller/deletedExpiredEvent.js";

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
agenda.start();

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
app.get("/", (req, res) => {
  res.status(200).send("SmartVA backend is alive 🚀");
});

app.use("/contact", contactRoutes);
app.use("/document", documentRoutes);
app.use("/events", eventRoutes);
app.use("/task", taskRoutes);
app.use("/visitors", visitorRoutes);
app.use("/user", userRoutes);
app.use("/notes", noteRoutes);
app.use("/profile", profileRoutes);

// Error handling (last)
app.use(errorHandler);

// ================================================
//                Start Server
// ================================================
const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});