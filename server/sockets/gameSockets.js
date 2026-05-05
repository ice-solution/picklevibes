const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

/**
 * 遊戲 Socket.IO handlers
 * - 遊戲端需在 handshake auth 或 connect 後提供 game JWT
 * - 目前採用 connect 後 emit: game:register { token, gameHallId }
 */
module.exports = function attachGameSockets(io) {
  io.on('connection', (socket) => {
    socket.on('game:register', ({ token, gameHallId }) => {
      try {
        if (!token) return;
        const secret = process.env.GAME_JWT_SECRET;
        if (!secret) return;
        jwt.verify(String(token), secret);
        if (!gameHallId || !mongoose.isValidObjectId(gameHallId)) return;
        socket.join(`gameHall:${gameHallId}`);
        socket.emit('game:registered', { ok: true, gameHallId });
      } catch {
        // ignore
      }
    });

    // Web 用戶端訂閱自己（用戶端需傳 userId；前端我們會在 join 頁面做）
    socket.on('user:watch', ({ userId }) => {
      if (!userId || !mongoose.isValidObjectId(userId)) return;
      socket.join(`user:${userId}`);
    });
  });
};

