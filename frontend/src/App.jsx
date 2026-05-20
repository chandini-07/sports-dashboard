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
  const [markerCoords, setMarkerCoords] = useState(null); // { x, y } relative percentage

  // Collapsible panels state
  const [isPitchOpen, setIsPitchOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Global Video Playback State
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [speedIndex, setSpeedIndex] = useState(2); // Index in [0.25, 0.5, 1.0, 2.0]
  const speedRates = [0.25, 0.5, 1.0, 2.0];

  // AI Co-Pilot Assistant State
  const [copilotMessages, setCopilotMessages] = useState([
    {
      id: 'welcome',
      text: 'AI Assistant Initialized. Standing by to analyze match telemetry, track tactical formations, and stream live play commentary. Select pitch coordinates below to log spatial data.',
      timestamp: new Date().toLocaleTimeString(),
      event: 'SYSTEM'
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  // VideoPlayer refs for DOM manipulation
  const cam1Ref = useRef(null);
  const cam2Ref = useRef(null);
  const socketRef = useRef(null);
  const timelineEndRef = useRef(null);

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

  // Simulate streaming text word-by-word (AI Co-Pilot)
  const streamAICopilotCommentary = (eventMessage) => {
    setIsTyping(true);
    
    const analysisPool = {
      "Point scored!": "AI Analysis: Goal scoring opportunity detected. Attack initiated from the left flank, overloading the box. Defensive structure collapsed under rapid horizontal ball progression.",
      "Foul detected": "AI Analysis: Tactical foul observed in the mid-pitch transition zone. Structural integrity preserved by disrupting play. Recommending card assessment for persistent infraction.",
      "Highlight clipped!": "AI Analysis: Frame-sequence analysis captured. System cache updated with coordinates. Tracking spatial distribution of midfielders at the instant of clip.",
      "Goal! Exciting play!": "AI Analysis: SPECTACULAR FINISH! Forward pocket exploited. Ball trajectory: 24m/s, curve deviation: 8%. Defensive line positioning was 1.4 meters too deep.",
      "Yellow card issued": "AI Analysis: Discipline alert. Key central defender now cautioned. This alters high-press threshold. Recommend shifting coverage to avoid second booking.",
      "Timeout called by Coach": "AI Analysis: Tactical pause. Teams resetting defensive lines. Statistical heatmaps indicate heavy congestion in zone 14. Adjustments expected in wide channels.",
      "Spectacular save by Goalkeeper!": "AI Analysis: Incredible reaction speed (0.18s). Shot stopping efficiency rated at 94.5%. Defense recovery was slow, exposing the second post.",
      "Substitution in progress": "AI Analysis: Personnel modification. Fresh legs in the attacking third. Anticipating high-intensity counter-pressing in the final 15 minutes."
    };

    const defaultAnalysis = `AI Analysis: Live game event detected: "${eventMessage}". Updating tactical heatmaps and team positioning statistics in real-time.`;
    const fullText = analysisPool[eventMessage] || defaultAnalysis;

    const words = fullText.split(' ');
    let currentText = '';
    let wordIndex = 0;
    const msgId = Math.random().toString();

    setCopilotMessages(prev => [
      { id: msgId, text: '', timestamp: new Date().toLocaleTimeString(), event: eventMessage },
      ...prev
    ].slice(0, 15)); // Keep last 15 messages

    const timer = setInterval(() => {
      if (wordIndex < words.length) {
        currentText += (wordIndex === 0 ? '' : ' ') + words[wordIndex];
        setCopilotMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: currentText } : m));
        wordIndex++;
      } else {
        clearInterval(timer);
        setIsTyping(false);
      }
    }, 80);
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
      const eventMsg = data.message;
      setLiveEvents((prev) => [
        {
          id: Math.random().toString(),
          message: eventMsg,
          timestamp: data.timestamp || new Date().toLocaleTimeString(),
          rawTime: Date.now(),
          type: 'live'
        },
        ...prev
      ].slice(0, 30));

      // Trigger AI Co-Pilot commentary streaming
      streamAICopilotCommentary(eventMsg);
    });

    // Listen for broadcasted moment-tagged events from any client
    socket.on('moment-tagged', (data) => {
      const coordStr = data.coordinates 
        ? ` (Pitch Pos: X:${data.coordinates.x}%, Y:${data.coordinates.y}%)` 
        : '';
      
      setLiveEvents((prev) => [
        {
          id: Math.random().toString(),
          message: `🎯 [USER TAG] Moment tagged: "${data.label}" on ${data.camera}${coordStr}!`,
          timestamp: data.timestamp,
          rawTime: Date.now(),
          type: 'tag'
        },
        ...prev
      ].slice(0, 30));

      streamAICopilotCommentary(`Highlight Clipped: "${data.label}"`);
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
      coordinates: markerCoords
    };

    console.log('Tagging moment:', payload);

    if (socketRef.current) {
      socketRef.current.emit('tag-moment', payload);
    }

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
        setMarkerCoords(null);
        fetchHighlights();
      } else {
        console.error('Failed to save highlight to database');
      }
    } catch (error) {
      console.error('Error posting highlight:', error);
    }
  };

  // Global Toggle Play / Pause
  const handleTogglePlay = () => {
    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);
    
    if (nextPlaying) {
      if (cam1Ref.current) cam1Ref.current.play();
      if (cam2Ref.current) cam2Ref.current.play();
    } else {
      if (cam1Ref.current) cam1Ref.current.pause();
      if (cam2Ref.current) cam2Ref.current.pause();
    }
  };

  // Global Toggle Mute / Unmute
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (cam1Ref.current) cam1Ref.current.setMuted(nextMuted);
    if (cam2Ref.current) cam2Ref.current.setMuted(nextMuted);
  };

  // Global Speed Slider adjustment
  const handleSpeedIndexChange = (e) => {
    const index = parseInt(e.target.value);
    setSpeedIndex(index);
    const rate = speedRates[index];
    
    if (cam1Ref.current) cam1Ref.current.setPlaybackRate(rate);
    if (cam2Ref.current) cam2Ref.current.setPlaybackRate(rate);
  };

  // Interactive Pitch click coordinates mapping
  const handleFieldClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    
    const xPercent = Math.round((rawX / rect.width) * 100);
    const yPercent = Math.round((rawY / rect.height) * 100);
    
    setMarkerCoords({ x: xPercent, y: yPercent });
  };

  // Local state metrics compiler
  const goalsCount = highlights.filter(h => h.label.toLowerCase().includes('goal')).length;
  const foulsCount = highlights.filter(h => h.label.toLowerCase().includes('foul')).length;
  const cardsCount = highlights.filter(h => 
    h.label.toLowerCase().includes('card') || 
    h.label.toLowerCase().includes('yellow') || 
    h.label.toLowerCase().includes('red')
  ).length;

  // Chronological incident timeline mapper (sorted combined timeline)
  const getCombinedTimeline = () => {
    const mappedHighlights = highlights.map(h => ({
      id: h._id || h.createdAt,
      type: 'tag',
      badge: 'USER TAG',
      timestamp: h.timestamp,
      message: `Moment Tagged: "${h.label}" on ${h.camera}`,
      rawTime: new Date(h.createdAt || Date.now()).getTime(),
      coordinates: h.coordinates
    }));

    const mappedLive = liveEvents.map(e => ({
      id: e.id,
      type: 'match',
      badge: 'MATCH EVENT',
      timestamp: e.timestamp,
      message: e.message,
      rawTime: e.rawTime || Date.now(),
      coordinates: null
    }));

    const combined = [...mappedHighlights, ...mappedLive];
    // Sort descending (most recent first)
    combined.sort((a, b) => b.rawTime - a.rawTime);
    return combined;
  };

  const combinedTimeline = getCombinedTimeline();

  return (
    <div className="dashboard-container">
      {/* Top App Bar */}
      <header className="dashboard-header">
        <div className="header-title-section">
          <div className="logo-container">
            <div className="logo-dot"></div>
            FIELDVISION.AI
          </div>
          <div className="live-badge">
            <div className="live-dot"></div>
            LIVE STREAM
          </div>
        </div>
        
        <div className="header-actions">
          <div className="connection-status">
            <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
            <span>WebSocket: {isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <div className="user-profile" title="User Profile">JD</div>
        </div>
      </header>

      {/* Metric Banner Block */}
      <div className="telemetry-bar">
        <div className="telemetry-card">
          <span className="telemetry-icon">⚽</span>
          <div className="telemetry-info">
            <span className="telemetry-val">{goalsCount}</span>
            <span className="telemetry-lbl">Goals Tagged</span>
          </div>
        </div>
        <div className="telemetry-card">
          <span className="telemetry-icon">⚠️</span>
          <div className="telemetry-info">
            <span className="telemetry-val">{foulsCount}</span>
            <span className="telemetry-lbl">Fouls Tagged</span>
          </div>
        </div>
        <div className="telemetry-card">
          <span className="telemetry-icon">🟥</span>
          <div className="telemetry-info">
            <span className="telemetry-val">{cardsCount}</span>
            <span className="telemetry-lbl">Cards Tagged</span>
          </div>
        </div>
        <div className="telemetry-card">
          <span className="telemetry-icon">💾</span>
          <div className="telemetry-info">
            <span className="telemetry-val">{highlights.length}</span>
            <span className="telemetry-lbl">Cached Replays</span>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className={`dashboard-grid ${!isSidebarOpen ? 'collapsed-right' : ''}`}>
        
        {/* Left Column: Videos, Actions & Pitch */}
        <div className="left-column">
          
          {/* Dual Video Workspace */}
          <div className="videos-grid">
            <VideoPlayer 
              ref={cam1Ref}
              src="https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8" 
              title="Camera 1" 
              cameraName="Primary Wide Angle"
            />
            <VideoPlayer 
              ref={cam2Ref}
              src="http://sample.vodobox.net/skate_phantom_flex_4k/skate_phantom_flex_4k.m3u8" 
              title="Camera 2" 
              cameraName="Tactical Close Stream"
            />
          </div>

          {/* Consolidated Playback Rail */}
          <div className="playback-rail-card">
            <div className="playback-controls">
              <button 
                className={`playback-btn ${isPlaying ? 'active' : ''}`} 
                onClick={handleTogglePlay}
                title={isPlaying ? "Pause Stream" : "Play Stream"}
              >
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
              <button 
                className={`playback-btn ${!isMuted ? 'active' : ''}`} 
                onClick={handleToggleMute}
                title={isMuted ? "Unmute Feed" : "Mute Feed"}
              >
                {isMuted ? '🔇 Muted' : '🔊 Unmuted'}
              </button>
            </div>

            {/* Shared Horizontal Speed Slider */}
            <div className="speed-slider-container">
              <span className="speed-slider-label">PLAYBACK RATE</span>
              <div className="speed-slider-wrap">
                <input 
                  type="range" 
                  min="0" 
                  max="3" 
                  step="1"
                  value={speedIndex} 
                  onChange={handleSpeedIndexChange}
                  className="speed-range-input" 
                />
                <div className="speed-ticks">
                  {speedRates.map((rate, i) => (
                    <span 
                      key={rate} 
                      className={`speed-tick ${speedIndex === i ? 'active' : ''}`}
                      onClick={() => handleSpeedIndexChange({ target: { value: i } })}
                    >
                      {rate}x
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="playback-meta-pill">
              SPEED: {speedRates[speedIndex]}x
            </div>
          </div>

          {/* Spatial Coordinates Field (Tactical Pitch Drawer) */}
          <div className={`tactical-pitch-panel ${isPitchOpen ? 'expanded' : 'collapsed'}`}>
            <div className="panel-header">
              <h2 className="panel-title">⚽ Spatial Coordinates Pitch Field</h2>
              <button 
                className="panel-toggle-btn"
                onClick={() => setIsPitchOpen(!isPitchOpen)}
              >
                {isPitchOpen ? '▼ Hide Pitch' : '▲ Show Pitch'}
              </button>
            </div>

            {isPitchOpen && (
              <div className="pitch-content-grid">
                
                {/* Form configuration */}
                <div className="pitch-form">
                  <div className="form-row">
                    <div className="tag-option-group">
                      <span className="tag-option-label">Active Camera</span>
                      <select 
                        className="tag-select" 
                        value={selectedCamera} 
                        onChange={(e) => setSelectedCamera(e.target.value)}
                      >
                        <option value="Camera 1">Camera 1 (Wide)</option>
                        <option value="Camera 2">Camera 2 (Tactical)</option>
                        <option value="Multi-Angle">Multi-Angle Stream</option>
                      </select>
                    </div>

                    <div className="tag-option-group">
                      <span className="tag-option-label">Incident Classification</span>
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
                  </div>

                  <div className="coordinate-lock-info">
                    <span style={{ fontSize: '12px' }}>📍</span>
                    <span style={{ fontWeight: '500' }}>
                      {markerCoords 
                        ? `Locked: X: ${markerCoords.x}%, Y: ${markerCoords.y}%` 
                        : 'Select coords by clicking on the pitch'}
                    </span>
                  </div>

                  <button className="tag-button" onClick={handleTagMoment}>
                    🚨 COMMIT MOMENT DATA
                  </button>
                </div>

                {/* Minimalist vector pitch field */}
                <div className="pitch-vector-container">
                  <svg 
                    viewBox="0 0 100 60" 
                    className="field-interactive" 
                    onClick={handleFieldClick}
                  >
                    {/* Pitch Outer border */}
                    <rect x="2" y="2" width="96" height="56" fill="none" stroke="#ffffff" strokeWidth="1.5" />
                    
                    {/* Halfway Line */}
                    <line x1="50" y1="2" x2="50" y2="58" stroke="#ffffff" strokeWidth="1.5" />
                    
                    {/* Center Circle & Center Spot */}
                    <circle cx="50" cy="30" r="10" fill="none" stroke="#ffffff" strokeWidth="1.5" />
                    <circle cx="50" cy="30" r="1" fill="#ffffff" />

                    {/* Left & Right Goal Boxes */}
                    <rect x="2" y="20" width="6" height="20" fill="none" stroke="#ffffff" strokeWidth="1.5" />
                    <rect x="92" y="20" width="6" height="20" fill="none" stroke="#ffffff" strokeWidth="1.5" />

                    {/* Left & Right Penalty Box Areas */}
                    <rect x="2" y="10" width="14" height="40" fill="none" stroke="#ffffff" strokeWidth="1.5" />
                    <rect x="84" y="10" width="14" height="40" fill="none" stroke="#ffffff" strokeWidth="1.5" />
                    
                    {/* Left & Right Penalty Spots */}
                    <circle cx="12" cy="30" r="0.8" fill="#ffffff" />
                    <circle cx="88" cy="30" r="0.8" fill="#ffffff" />

                    {/* Left & Right Goal lines */}
                    <line x1="2" y1="26" x2="2" y2="34" stroke="var(--accent-indigo)" strokeWidth="2.5" />
                    <line x1="98" y1="26" x2="98" y2="34" stroke="var(--accent-indigo)" strokeWidth="2.5" />

                    {/* Render coordinate marker node */}
                    {markerCoords && (
                      <g className="glowing-coordinate-marker">
                        <circle cx={markerCoords.x} cy={markerCoords.y} r="2.5" fill="var(--accent-rose)" />
                        <circle cx={markerCoords.x} cy={markerCoords.y} r="6" fill="none" stroke="var(--accent-rose)" strokeWidth="1" opacity="0.7" />
                        <line x1={markerCoords.x - 10} y1={markerCoords.y} x2={markerCoords.x + 10} y2={markerCoords.y} stroke="var(--accent-rose)" strokeWidth="0.5" opacity="0.5" />
                        <line x1={markerCoords.x} y1={markerCoords.y - 10} x2={markerCoords.x} y2={markerCoords.y + 10} stroke="var(--accent-rose)" strokeWidth="0.5" opacity="0.5" />
                      </g>
                    )}
                  </svg>
                </div>

              </div>
            )}
          </div>

        </div>

        {/* Right Column: Collapsible Intelligence Sidebar */}
        {isSidebarOpen ? (
          <aside className="right-column-sidebar">
            {/* Sidebar toggle button (collapses sidebar) */}
            <div 
              className="sidebar-toggle-handle" 
              onClick={() => setIsSidebarOpen(false)}
              title="Hide Intelligence Column"
            >
              ▶
            </div>

            {/* AI Co-Pilot Live Assistant */}
            <div className="ai-copilot-panel">
              <div className="panel-header">
                <h2 className="panel-title">🤖 AI CO-PILOT LIVE ASSISTANT</h2>
                {isTyping && (
                  <span className="ai-streaming-indicator">
                    <span className="ai-stream-dot"></span>
                    <span className="ai-stream-dot"></span>
                    <span className="ai-stream-dot"></span>
                  </span>
                )}
              </div>
              
              <div className="ai-assistant-body">
                {copilotMessages.map((msg) => (
                  <div key={msg.id} className="ai-message-bubble">
                    <div className="ai-message-header">
                      <span>{msg.event} ANALYSIS</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <div>{msg.text}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chronological Incident Timeline */}
            <div className="timeline-panel">
              <div className="panel-header">
                <h2 className="panel-title">📋 LIVE INCIDENT TIMELINE</h2>
              </div>
              
              <div className="timeline-scroll-feed">
                {combinedTimeline.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                    No events tracked yet.
                  </div>
                ) : (
                  combinedTimeline.map((item) => (
                    <div 
                      key={item.id} 
                      className={`timeline-item ${item.type === 'tag' ? 'user-tag' : 'match-event'}`}
                    >
                      <div className="timeline-meta">
                        <span className={`timeline-badge ${item.type === 'tag' ? 'user' : 'match'}`}>
                          {item.badge}
                        </span>
                        <span>{item.timestamp}</span>
                      </div>
                      <div className="timeline-message">{item.message}</div>
                      {item.coordinates && (
                        <div className="timeline-extra">
                          <span>📍 Coords: X: {item.coordinates.x}%, Y: {item.coordinates.y}%</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={timelineEndRef} />
              </div>
            </div>

          </aside>
        ) : (
          /* Floating button when sidebar is collapsed */
          <div 
            className="sidebar-toggle-floating" 
            onClick={() => setIsSidebarOpen(true)}
            title="Expand Intelligence Column"
          >
            <span>◀</span> AI Co-Pilot Feed
          </div>
        )}

      </div>
    </div>
  );
}
