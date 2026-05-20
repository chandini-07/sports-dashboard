import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import Hls from 'hls.js';

const VideoPlayer = forwardRef(({ src, title, cameraName }, ref) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(1.0);

  // Expose playback functions to parent components via ref
  useImperativeHandle(ref, () => ({
    setPlaybackRate: (rate) => {
      if (videoRef.current) {
        videoRef.current.playbackRate = rate;
        setCurrentSpeed(rate);
      }
    },
    getPlaybackRate: () => {
      return videoRef.current ? videoRef.current.playbackRate : 1.0;
    },
    videoElement: videoRef.current
  }));

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setHasError(false);

    // Initialize HLS.js if supported
    if (Hls.isSupported()) {
      const hls = new Hls({
        maxMaxBufferLength: 10,
        enableWorker: true,
        lowLatencyMode: true
      });
      hlsRef.current = hls;

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play()
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.log("Autoplay was blocked by browser. Starting in muted mode.", err);
            video.muted = true;
            setIsMuted(true);
            video.play()
              .then(() => setIsPlaying(true))
              .catch((playErr) => console.error("Play failed even when muted:", playErr));
          });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error(`HLS Error for ${title}:`, data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Fatal network error encountered, attempting to recover...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Fatal media error encountered, attempting to recover...');
              hls.recoverMediaError();
              break;
            default:
              console.error('Fatal unrecoverable HLS error');
              setHasError(true);
              hls.destroy();
              break;
          }
        }
      });

      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Apple HLS support (Safari / iOS)
      video.src = src;
      video.addEventListener('loadedmetadata', () => {
        video.play()
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.log("Native autoplay blocked. Starting muted.", err);
            video.muted = true;
            setIsMuted(true);
            video.play()
              .then(() => setIsPlaying(true))
              .catch((playErr) => console.error("Native play failed:", playErr));
          });
      });
    } else {
      console.error('HLS is not supported in this browser.');
      setHasError(true);
    }
  }, [src, title]);

  const toggleMute = () => {
    if (videoRef.current) {
      const nextMute = !videoRef.current.muted;
      videoRef.current.muted = nextMute;
      setIsMuted(nextMute);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(err => console.error("Play execution failed:", err));
      }
    }
  };

  return (
    <div className="video-card">
      <div className="video-header">
        <span className="video-title">{title}</span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginRight: '0.25rem' }}>
            {cameraName}
          </span>
          {currentSpeed !== 1.0 && (
            <span style={{ 
              fontSize: '0.7rem', 
              color: 'var(--accent-cyan)', 
              background: 'rgba(0, 242, 254, 0.1)', 
              padding: '0.1rem 0.3rem', 
              borderRadius: '4px',
              fontWeight: '700'
            }}>
              ⚡ {currentSpeed}x
            </span>
          )}
          <button className="mute-overlay-btn" onClick={togglePlay}>
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button className="mute-overlay-btn" onClick={toggleMute}>
            {isMuted ? '🔇 Unmute' : '🔊 Muted'}
          </button>
        </div>
      </div>
      <div className="video-player-wrapper">
        {hasError ? (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(26, 30, 42, 0.9)',
            color: 'var(--accent-red)',
            fontSize: '0.85rem',
            fontFamily: 'var(--font-display)',
            textAlign: 'center',
            padding: '1rem',
            lineHeight: '1.6'
          }}>
            ❌ STREAM OFFLINE OR UNSUPPORTED<br/>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              ({src.substring(0, 45)}...)
            </span>
          </div>
        ) : (
          <video
            ref={videoRef}
            className="video-tag"
            playsInline
            muted={isMuted}
            controls={false}
          />
        )}
      </div>
    </div>
  );
});

export default VideoPlayer;
