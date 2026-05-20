require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Create HTTP Server for WebSockets
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB Atlas connected successfully');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

// Schema & Model
const highlightSchema = new mongoose.Schema({
  timestamp: { type: String, required: true },
  label: { type: String, required: true },
  camera: { type: String, required: true },
  coordinates: {
    x: { type: Number },
    y: { type: Number }
  },
  createdAt: { type: Date, default: Date.now }
});

const Highlight = mongoose.model('Highlight', highlightSchema);

// REST API Endpoints
app.post('/api/highlights', async (req, res) => {
  try {
    const { timestamp, label, camera, coordinates } = req.body;

    if (!timestamp || !label || !camera) {
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }

    const newHighlight = new Highlight({
      timestamp,
      label,
      camera,
      coordinates
    });

    await newHighlight.save();

    return res.status(201).json(newHighlight);

  } catch (error) {
    console.error('Error saving highlight:', error);

    return res.status(500).json({
      error: 'Internal Server Error'
    });
  }
});

app.get('/api/highlights', async (req, res) => {
  try {
    const highlights = await Highlight.find().sort({
      createdAt: -1
    });

    return res.status(200).json(highlights);

  } catch (error) {
    console.error('Error fetching highlights:', error);

    return res.status(500).json({
      error: 'Internal Server Error'
    });
  }
});

// WebSocket communication
io.on('connection', (socket) => {

  console.log(`Client connected: ${socket.id}`);

  socket.on('tag-moment', (data) => {

    console.log('Received tag-moment event:', data);

    io.emit('moment-tagged', data);
  });

  socket.on('disconnect', () => {

    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Fake live sports events
const eventOptions = [
  "Point scored!",
  "Foul detected",
  "Highlight clipped!",
  "Goal! Exciting play!",
  "Yellow card issued",
  "Timeout called by Coach",
  "Spectacular save by Goalkeeper!",
  "Substitution in progress"
];

setInterval(() => {

  const randomEvent =
    eventOptions[Math.floor(Math.random() * eventOptions.length)];

  const timestamp = new Date().toLocaleTimeString();

  const eventPayload = {
    message: randomEvent,
    timestamp: timestamp
  };

  io.emit('live-game-event', eventPayload);

  console.log(`Broadcasted event: ${randomEvent}`);

}, 5000);

// Start server
server.listen(port, () => {

  console.log(`Sports Replay Dashboard Backend running on port ${port}`);

});