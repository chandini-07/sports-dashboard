# Sports Replay Dashboard

A real time multi camera sports replay and analysis dashboard built using React, Node.js, Socket.io, and MongoDB Atlas.

## Overview

This project simulates a professional sports broadcast review system where operators can:

- View multiple live camera feeds simultaneously
- Tag important match moments in real time
- Track live game events using WebSockets
- Store replay highlights in MongoDB Atlas
- Visualize tactical pitch coordinates
- Monitor AI style event analysis and live incident timelines

The application focuses on low latency communication, synchronized feeds, and interactive replay workflows similar to modern sports analytics systems.

---

## Features

### Multi Camera Replay System
- Dual live video feeds
- Playback speed controls
- Pause and mute functionality
- Multi stream synchronization simulation

### Real Time WebSocket Communication
- Instant event broadcasting using Socket.io
- Live match ticker updates
- Dynamic AI co pilot event feed

### Replay Tagging System
- Tag incidents like goals, fouls, and cards
- Coordinate based pitch tagging
- Replay history storage

### MongoDB Atlas Integration
- Cloud database for replay highlights
- Persistent event storage
- REST API support using Express.js

### Interactive Dashboard UI
- Broadcast style operator interface
- Tactical football pitch visualization
- Responsive modern layout

---

## Tech Stack

### Frontend
- React.js
- Vite
- HTML/CSS
- Socket.io Client

### Backend
- Node.js
- Express.js
- Socket.io
- MongoDB Atlas
- Mongoose

---

## Project Structure

```bash
sports-dashboard/
│
├── backend/
│   ├── server.js
│   ├── package.json
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── VideoPlayer.jsx
│   │   └── index.css
│   │
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

---

## Installation

### Clone Repository

```bash
git clone https://github.com/chandini-07/sports-dashboard.git
cd sports-dashboard
```

---

## Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file:

```env
MONGO_URI=your_mongodb_atlas_uri
PORT=5000
```

Run backend server:

```bash
node server.js
```

---

## Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend will run on:

```bash
http://localhost:5173
```

---

## WebSocket Events

### Emitted Events
- `live-game-event`
- `moment-tagged`

### Incoming Events
- `tag-moment`

---

## API Endpoints

### Save Highlight

```http
POST /api/highlights
```

### Fetch Highlights

```http
GET /api/highlights
```

---

## Future Improvements

- Real HLS or WebRTC live streaming
- AI based automated highlight detection
- Player tracking and heatmaps
- Authentication and operator roles
- Cloud deployment using Render and Vercel

---

## Author

Chandini Gayathri Jakku

IIIT Hyderabad

GitHub:
https://github.com/chandini-07