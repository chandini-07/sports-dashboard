import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import VideoPlayer from './VideoPlayer';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [liveEvents, setLiveEvents] = useState([]);
  const [highlights, setHighlights] = useState([]);
  
  // Custom tag settings
  const [selectedCamera, setSelectedCamera] = useState('Camera 1');
  const [tagLabel, setTagLabel] = useState('Goal Scored');
  const [markerCoords, setMarkerCoords] = useState(null); // { x, y } relative percentage (0-100)

  // Playback speeds state
  const [cam1Speed, setCam1Speed] = useState(1.0);
  const [cam2Speed, setCam2Speed] = useState(1.0);

  // VideoPlayer refs for DOM manipulation
  const cam1Ref = useRef(null);
  const cam2Ref = useRef(null);

  const socketRef = useRef(null);
  const eventsEndRef = useRef(null);

  // Fetch highlights on mount
  const fetchHighlights = async () => {
    try {
      const response = await fetch('/api/highlights');
      if (response.ok) {
        const data = await response.json();
        setHighlights(data);
      } else {
        console.error('Failed to fetch highlights history');
      }
    } catch (error) {
      console.error('Error fetching highlights:', error);
    }
  };

  useEffect(() => {
    fetchHighlights();

    // Connect to Backend WebSocket
    const socket = io('http://localhost:5000');
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to sports-dashboard WebSocket server!');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from WebSocket server');
    });

    // Listen for live ticker events
    socket.on('live-game-event', (data) => {
      setLiveEvents((prev) => [
        {
          id: Math.random().toString(),
          message: data.message,
          timestamp: data.timestamp || new Date().toLocaleTimeString(),
          type: 'live'
        },
        ...prev
      ].slice(0, 30)); // Limit to last 30 items
    });

    // Listen for broadcasted moment-tagged events from any client
    socket.on('moment-tagged', (data) => {
      const coordStr = data.coordinates 
        ? ` (Pitch Pos: X:${data.coordinates.x}%, Y:${data.coordinates.y}%)` 
        : '';
      
      // Add visual notification in rolling feed
      setLiveEvents((prev) => [
        {
          id: Math.random().toString(),
          message: `🎯 [USER TAG] Moment tagged: "${data.label}" on ${data.camera}${coordStr}!`,
          timestamp: data.timestamp,
          type: 'tag'
        },
        ...prev
      ].slice(0, 30));

      // Refresh highlights from DB
      fetchHighlights();
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  // Tag Moment handler
  const handleTagMoment = async () => {
    const localizedTimestamp = new Date().toLocaleTimeString();
    const payload = {
      timestamp: localizedTimestamp,
      label: tagLabel,
      camera: selectedCamera,
      coordinates: markerCoords // Send captured X/Y coordinates
    };

    console.log('Tagging moment:', payload);

    // 1. Emit socket event
    if (socketRef.current) {
      socketRef.current.emit('tag-moment', payload);
    }

    // 2. REST POST to MongoDB
    try {
      const response = await fetch('/api/highlights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const savedHighlight = await response.json();
        console.log('Saved highlight in DB:', savedHighlight);
        // Clear tactical map coordinate selection upon successful tag
        setMarkerCoords(null);
        fetchHighlights();
      } else {
        console.error('Failed to save highlight to database');
      }
    } catch (error) {
      console.error('Error posting highlight:', error);
    }
  };

  // Speed adjust handler
  const handleSpeedChange = (camIndex, rate) => {
    if (camIndex === 1) {
      setCam1Speed(rate);
      if (cam1Ref.current) {
        cam1Ref.current.setPlaybackRate(rate);
      }
    } else {
      setCam2Speed(rate);
      if (cam2Ref.current) {
        cam2Ref.current.setPlaybackRate(rate);
      }
    }
  };

  // Interactive SVG pitch click handler
  const handleFieldClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    
    // Normalize coordinates to percentage 0-100
    const xPercent = Math.round((rawX / rect.width) * 100);
    const yPercent = Math.round((rawY / rect.height) * 100);
    
    setMarkerCoords({ x: xPercent, y: yPercent });
  };

  // Local state metrics compiler for header metrics bar
  const goalsCount = highlights.filter(h => h.label.toLowerCase().includes('goal')).length;
  const foulsCount = highlights.filter(h => h.label.toLowerCase().includes('foul')).length;
  const cardsCount = highlights.filter(h => 
    h.label.toLowerCase().includes('card') || 
    h.label.toLowerCase().includes('yellow') || 
    h.label.toLowerCase().includes('red')
  ).length;

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-title-section">
          <div className="live-badge">
            <div className="live-dot"></div>
            LIVE
          </div>
          <h1 className="header-title">SPORTS REPLAY STUDIO</h1>
        </div>
        
        {/* WebSocket Connection Status */}
        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
          <span>WebSocket: {isConnected ? 'Connected' : 'Connecting...'}</span>
        </div>
      </header>

      {/* Telemetry Counter Metrics Bar */}
      <div className="telemetry-bar">
        <div className="telemetry-card">
          <span className="telemetry-icon">⚽</span>
          <div className="telemetry-info">
            <span className="telemetry-val">{goalsCount}</span>
            <span className="telemetry-lbl">Goals Tagged</span>
          </div>
        </div>
        <div className="telemetry-card">
          <span className="telemetry-icon" style={{ color: 'var(--accent-cyan)' }}>⚠️</span>
          <div className="telemetry-info">
            <span className="telemetry-val">{foulsCount}</span>
            <span className="telemetry-lbl">Fouls Tagged</span>
          </div>
        </div>
        <div className="telemetry-card">
          <span className="telemetry-icon" style={{ color: 'var(--accent-red)' }}>🟥</span>
          <div className="telemetry-info">
            <span className="telemetry-val">{cardsCount}</span>
            <span className="telemetry-lbl">Cards Tagged</span>
          </div>
        </div>
        <div className="telemetry-card">
          <span className="telemetry-icon" style={{ color: 'var(--text-primary)' }}>💾</span>
          <div className="telemetry-info">
            <span className="telemetry-val">{highlights.length}</span>
            <span className="telemetry-lbl">Total Replays</span>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="dashboard-grid">
        {/* Left Column: Video & Tag Controls */}
        <div className="left-column">
          
          {/* Dual Video Players */}
          <div className="videos-grid">
            <VideoPlayer 
              ref={cam1Ref}
              src="https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8" 
              title="Camera 1 - Feed" 
              cameraName="Stream 1 (Red Bull Action Sports)"
            />
            <VideoPlayer 
              ref={cam2Ref}
              src="http://sample.vodobox.net/skate_phantom_flex_4k/skate_phantom_flex_4k.m3u8" 
              title="Camera 2 - Feed" 
              cameraName="Stream 2 (Skateboard Phantom Flex)"
            />
          </div>

          {/* Interactive Playback Speed Controllers Row */}
          <div className="speed-controllers-container">
            <div className="speed-controller-card">
              <span className="speed-label">Camera 1 Rate:</span>
              <div className="speed-buttons">
                {[0.25, 0.5, 1.0, 2.0].map((rate) => (
                  <button 
                    key={rate} 
                    className={`speed-btn ${cam1Speed === rate ? 'active' : ''}`}
                    onClick={() => handleSpeedChange(1, rate)}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>
            
            <div className="speed-controller-card">
              <span className="speed-label">Camera 2 Rate:</span>
              <div className="speed-buttons">
                {[0.25, 0.5, 1.0, 2.0].map((rate) => (
                  <button 
                    key={rate} 
                    className={`speed-btn ${cam2Speed === rate ? 'active' : ''}`}
                    onClick={() => handleSpeedChange(2, rate)}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Central Tag Control Panel with Tactical Field Map */}
          <div className="tag-controller-section" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
            
            {/* Input & Form Configurations */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%', justifyContent: 'center' }}>
              <div className="tag-option-group">
                <span className="tag-option-label">Select Active Camera</span>
                <select 
                  className="tag-select" 
                  value={selectedCamera} 
                  onChange={(e) => setSelectedCamera(e.target.value)}
                >
                  <option value="Camera 1">Camera 1 (Wide)</option>
                  <option value="Camera 2">Camera 2 (Zoom)</option>
                  <option value="Multi-Angle">Multi-Angle</option>
                </select>
              </div>

              <div className="tag-option-group">
                <span className="tag-option-label">Incident Type</span>
                <select 
                  className="tag-select" 
                  value={tagLabel} 
                  onChange={(e) => setTagLabel(e.target.value)}
                >
                  <option value="Goal Scored">⚽ Goal Scored</option>
                  <option value="Foul Committed">⚠️ Foul Committed</option>
                  <option value="Yellow Card">🟨 Yellow Card</option>
                  <option value="Red Card">🟥 Red Card</option>
                  <option value="Amazing Save">🧤 Amazing Save</option>
                  <option value="Offside Call">🚩 Offside Call</option>
                  <option value="Substitution">🔄 Substitution</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                <span className="tag-option-label" style={{ color: 'var(--accent-cyan)' }}>
                  Coordinate Lock:
                </span>
                <span style={{ fontSize: '0.85rem', color: markerCoords ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {markerCoords ? `⚽ Pitch Position Selected: (X: ${markerCoords.x}%, Y: ${markerCoords.y}%)` : '⚠️ Click the field on the right to set coordinates'}
                </span>
              </div>

              <button className="tag-button" onClick={handleTagMoment} style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }}>
                🚨 TAG MOMENT
              </button>
            </div>

            {/* Interactive SVG Tactical Pitch Coordinate Map */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span className="tag-option-label" style={{ textAlign: 'center' }}>Tactical Pitch Coordinates</span>
              <div style={{ position: 'relative', width: '100%' }}>
                <svg 
                  viewBox="0 0 100 60" 
                  className="field-interactive" 
                  style={{ 
                    width: '100%', 
                    height: 'auto', 
                    background: 'rgba(0, 242, 254, 0.02)', 
                    borderRadius: '10px', 
                    border: '1.5px dashed rgba(0, 242, 254, 0.25)', 
                    cursor: 'crosshair',
                    transition: 'all 0.2s ease'
                  }} 
                  onClick={handleFieldClick}
                >
                  {/* Pitch Border */}
                  <rect x="1" y="1" width="98" height="58" fill="none" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1" />
                  
                  {/* Center Pitch Line */}
                  <line x1="50" y1="1" x2="50" y2="59" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1" />
                  
                  {/* Center Circle */}
                  <circle cx="50" cy="30" r="10" fill="none" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1" />
                  <circle cx="50" cy="30" r="0.8" fill="rgba(255, 255, 255, 0.5)" />

                  {/* Left & Right Goal Areas */}
                  <rect x="1" y="20" width="5" height="20" fill="none" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1" />
                  <rect x="94" y="20" width="5" height="20" fill="none" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1" />

                  {/* Left & Right Penalty Box Areas */}
                  <rect x="1" y="10" width="13" height="40" fill="none" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1" />
                  <rect x="86" y="10" width="13" height="40" fill="none" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1" />
                  
                  {/* Corner Arcs */}
                  <path d="M 1,4 A 3,3 0 0,0 4,1" fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="0.8" />
                  <path d="M 96,1 A 3,3 0 0,0 99,4" fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="0.8" />
                  <path d="M 4,59 A 3,3 0 0,0 1,56" fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="0.8" />
                  <path d="M 99,56 A 3,3 0 0,0 96,59" fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="0.8" />

                  {/* Selected Spot glowing crosshair cross */}
                  {markerCoords && (
                    <g>
                      <circle cx={markerCoords.x} cy={markerCoords.y} r="3" fill="var(--accent-red)" className="glowing-coordinate-marker" />
                      <circle cx={markerCoords.x} cy={markerCoords.y} r="7" fill="none" stroke="var(--accent-red)" strokeWidth="1" opacity="0.8" />
                      <line x1={markerCoords.x - 12} y1={markerCoords.y} x2={markerCoords.x + 12} y2={markerCoords.y} stroke="var(--accent-red)" strokeWidth="0.6" opacity="0.6" />
                      <line x1={markerCoords.x} y1={markerCoords.y - 12} x2={markerCoords.x} y2={markerCoords.y + 12} stroke="var(--accent-red)" strokeWidth="0.6" opacity="0.6" />
                    </g>
                  )}
                </svg>
              </div>
            </div>

          </div>

          {/* Saved Clip History Panel */}
          <div className="history-section">
            <div className="section-header">
              <h2 className="section-title">Saved Replays & Highlights</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {highlights.length} clips recorded
              </span>
            </div>

            <div className="highlights-scroll-panel">
              {highlights.length === 0 ? (
                <div className="no-data">No highlights tagged yet. Click the RED button to record.</div>
              ) : (
                highlights.map((clip) => (
                  <div key={clip._id || clip.createdAt} className="highlight-item" style={{ gridTemplateColumns: '80px 100px 1fr 140px 120px' }}>
                    <span className="highlight-camera">{clip.camera}</span>
                    <span className="highlight-time">⏱ {clip.timestamp}</span>
                    <span className="highlight-label">{clip.label}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {clip.coordinates ? `📍 Pos: (${clip.coordinates.x}%, ${clip.coordinates.y}%)` : '📍 Center Field'}
                    </span>
                    <span className="highlight-meta-time">
                      {new Date(clip.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Right Column: WebSocket Rolling Ticker Feed */}
        <aside className="right-column">
          <div className="ticker-title-section">
            <h2 className="section-title" style={{ color: 'var(--accent-cyan)' }}>Live Game Ticker</h2>
            <div className="live-dot"></div>
          </div>

          <div className="ticker-feed">
            {liveEvents.length === 0 ? (
              <div className="no-data">Waiting for live match data ticker...</div>
            ) : (
              liveEvents.map((ev) => (
                <div 
                  key={ev.id} 
                  className={`ticker-item ${ev.type === 'tag' ? 'tag-broadcast' : ''}`}
                >
                  <div className="ticker-meta">
                    <span className="ticker-badge">
                      {ev.type === 'tag' ? '📢 TAGGED EVENT' : '⚽ MATCH EVENT'}
                    </span>
                    <span className="ticker-time">{ev.timestamp}</span>
                  </div>
                  <div className="ticker-message">{ev.message}</div>
                </div>
              ))
            )}
            <div ref={eventsEndRef} />
          </div>
        </aside>
      </div>
    </div>
  );
}
