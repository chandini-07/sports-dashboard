import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import Hls from 'hls.js';

const VideoPlayer = forwardRef(({ src, title, cameraName }, ref) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(1.0);

  // Expose playback control functions to parent component via ref
  useImperativeHandle(ref, () => ({
    play: () => {
      if (videoRef.current) {
        videoRef.current.play()
          .then(() => setIsPlaying(true))
          .catch((err) => console.log(`Play request failed for ${title}:`, err));
      }
    },
    pause: () => {
      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    },
    setPlaybackRate: (rate) => {
      if (videoRef.current) {
        videoRef.current.playbackRate = rate;
        setCurrentSpeed(rate);
      }
    },
    setMuted: (muted) => {
      if (videoRef.current) {
        videoRef.current.muted = muted;
        setIsMuted(muted);
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
        // Apply default mute and autoplay
        video.muted = isMuted;
        video.playbackRate = currentSpeed;
        video.play()
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.log("Autoplay blocked. Retrying in muted mode.", err);
            video.muted = true;
            setIsMuted(true);
            video.play()
              .then(() => setIsPlaying(true))
              .catch((playErr) => console.error("Muted play failed:", playErr));
          });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error(`HLS Error for ${title}:`, data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Attempting network error recovery...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Attempting media error recovery...');
              hls.recoverMediaError();
              break;
            default:
              console.error('Unrecoverable HLS error');
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
      video.muted = isMuted;
      video.playbackRate = currentSpeed;
      video.addEventListener('loadedmetadata', () => {
        video.play()
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.log("Native autoplay blocked. Retrying muted.", err);
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

  return (
    <div className="video-card">
      <div className="video-header">
        <div className="video-title-wrap">
          <span className="video-title">{title}</span>
          <span className="video-camera-desc">({cameraName})</span>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {isPlaying ? (
            <span style={{ 
              fontSize: '9px', 
              color: 'var(--accent-emerald)', 
              background: 'rgba(16, 185, 129, 0.1)', 
              padding: '2px 6px', 
              borderRadius: '10px',
              fontWeight: '700',
              letterSpacing: '0.05em'
            }}>
              LIVE FEED
            </span>
          ) : (
            <span style={{ 
              fontSize: '9px', 
              color: 'var(--text-muted)', 
              background: 'var(--bg-hover)', 
              padding: '2px 6px', 
              borderRadius: '10px',
              fontWeight: '700',
              letterSpacing: '0.05em'
            }}>
              PAUSED
            </span>
          )}
          {currentSpeed !== 1.0 && (
            <span style={{ 
              fontSize: '9px', 
              color: 'var(--accent-indigo)', 
              background: 'rgba(99, 102, 241, 0.1)', 
              padding: '2px 6px', 
              borderRadius: '10px',
              fontWeight: '700'
            }}>
              ⚡ {currentSpeed}x
            </span>
          )}
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
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-hover)',
            color: 'var(--accent-rose)',
            fontSize: '11px',
            textAlign: 'center',
            padding: '1rem',
            lineHeight: '1.6'
          }}>
            <span style={{ fontSize: '18px', marginBottom: '4px' }}>⚠️</span>
            <strong>STREAM OFFLINE OR UNSUPPORTED</strong>
            <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {src}
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
