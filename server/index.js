const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Ensure data and uploads directories exist
const dataDir = path.join(__dirname, '..', 'data');
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
const PORT = process.env.PORT || 3000;

// SSE clients for realtime notifications
const sseClients = new Set();

// Broadcast record notification to all clients
function broadcastRecord(data) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach(client => {
        client.write(message);
    });
}

// Export for use in routes
app.set('broadcastRecord', broadcastRecord);

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(uploadsDir));

// SSE endpoint for realtime notifications
app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Send initial connection message
    res.write('data: {"type":"connected"}\n\n');

    // Add client to set
    sseClients.add(res);

    // Remove client on disconnect
    req.on('close', () => {
        sseClients.delete(res);
    });
});

// API Routes
const examsRouter = require('./routes/exams');
const questionsRouter = require('./routes/questions');
const uploadRouter = require('./routes/upload');
const mediaRouter = require('./routes/media');
const backupRouter = require('./routes/backup');

app.use('/api/exams', examsRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/media', mediaRouter);
app.use('/api/backup', backupRouter);

// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Quiz App running at http://localhost:${PORT}`);
});
