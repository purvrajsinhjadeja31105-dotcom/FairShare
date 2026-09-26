const http = require('http');
const app = require('./app');
const socketService = require('./services/socketService');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize Socket.io on the same HTTP server
socketService.init(server);

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
