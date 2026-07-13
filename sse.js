let clients = [];

const sseMiddleware = (req, res, next) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients.push(res);

  req.on('close', () => {
    clients = clients.filter(client => client !== res);
  });
};

const broadcastUpdate = (message = 'update') => {
  clients.forEach(client => {
    try {
      client.write(`data: ${JSON.stringify({ message, timestamp: Date.now() })}\n\n`);
    } catch (e) {
      // Ignore errors for disconnected clients
    }
  });
};

module.exports = { sseMiddleware, broadcastUpdate };
