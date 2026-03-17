import express from "express";
import cors from "cors";
import routes from "../config/route.config.js";
import notFound from "./middlewares/notFound.middlewares.js";
import globalErrorHandler from "./middlewares/globalError.middlewares.js";
import { Server } from "socket.io";
import cron from "node-cron";
import { checkUpcomingBookings } from "./controllers/provider.controller.js";

const app = express();

let io;

function ioHandler(server) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    socket.on("join", (userId) => {
      socket.join(userId);
      console.log(`User ${userId} joined`);
    });

    socket.on("new-message", ({ to, message }) =>
      io.to(to).emit("message-received", { from: socket.id, message })
    );
    socket.on("provider-location-update", ({ providerId, location }) =>
      io.emit("provider-location-update", { providerId, location })
    );
    socket.on("disconnect", () => console.log("User disconnected:", socket.id));
  });

  return io;
}

function getIO() {
  if (!io) throw new Error("Socket.IO not initialized!");
  return io;
}

// Middlewares
app.use(express.json());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);

// Root route
app.get("/", (req, res) => {
  res.status(200).json({ status: true, message: "Welcome to the server" });
});

// Routes
app.use("/api/v1", routes);

// Error handlers
app.use(globalErrorHandler);
app.use(notFound);

cron.schedule("*/1 * * * *", async () => {
  try {
    await checkUpcomingBookings();
  } catch (err) {
    console.error("Error executing cron job:", err);
  }
});
export default app;
export { ioHandler, getIO };
