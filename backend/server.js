const express = require('express');
const cors = require('cors');
const http = require('http');
const socketService = require('./services/socketService');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize Socket.io
socketService.init(server);

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/users', require('./routes/users'));
app.use('/api/notifications', require('./routes/notifications'));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'backend is running.' });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

