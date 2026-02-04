import { Server } from 'socket.io';

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // ✅ connection handler MUST be inside initSocket
  io.on('connection', (socket) => {
      console.log("User connected:", socket.id);
    socket.on('join', (userId) => {
      if (!userId) return;
      socket.join(userId); // user-specific room
       console.log("User joined room:", userId);
    });

    socket.on('disconnect', () => {
      // optional cleanup
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};
