import React, { useEffect, useState } from 'react';
import './GlobalBackground.css';

const GlobalBackground = () => {
  const [stars, setStars] = useState([]);
  
  useEffect(() => {
    // Generate random stars for the realistic night sky
    const newStars = [];
    // 400 stars for dense universe feel
    for (let i = 0; i < 400; i++) {
      // 80% tiny distant stars, 20% closer glowing stars
      const isGlowing = Math.random() > 0.8;
      newStars.push({
        id: i,
        left: `\${Math.random() * 100}%`,
        top: `\${Math.random() * 100}%`,
        size: isGlowing ? `\${Math.random() * 2 + 1.5}px` : `\${Math.random() * 1 + 0.5}px`,
        animationDuration: `\${Math.random() * 4 + 3}s`,
        animationDelay: `\${Math.random() * 5}s`,
        opacity: isGlowing ? (Math.random() * 0.5 + 0.5) : (Math.random() * 0.4 + 0.1),
        glowing: isGlowing
      });
    }
    setStars(newStars);
  }, []);

  // Mouse tracking with delay
  const [mousePos, setMousePos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [delayedMousePos, setDelayedMousePos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    let animationFrameId;
    const updateDelayedMouse = () => {
      setDelayedMousePos(prev => {
        // Spring physics: move 8% of the distance towards the target per frame
        const dx = mousePos.x - prev.x;
        const dy = mousePos.y - prev.y;
        return {
          x: prev.x + dx * 0.08,
          y: prev.y + dy * 0.08
        };
      });
      animationFrameId = requestAnimationFrame(updateDelayedMouse);
    };
    updateDelayedMouse();
    return () => cancelAnimationFrame(animationFrameId);
  }, [mousePos]);

  return (
    <div className="global-bg">
      {/* --- LIGHT MODE: DAY SKY --- */}
      <div className="bg-layer light-mode-layer">
        <div className="sky-gradient"></div>
        <div className="sun-container">
          <div className="sun-core"></div>
          <div className="sun-glow"></div>
        </div>
        
        {/* Clouds */}
        <div className="cloud cloud-1"></div>
        <div className="cloud cloud-2"></div>
        <div className="cloud cloud-3"></div>
        <div className="cloud cloud-4"></div>

        {/* Wind Breeze Follower */}
        <div className="wind-breeze-container" style={{ transform: `translate(\${delayedMousePos.x}px, \${delayedMousePos.y}px)` }}>
          <div className="wind-line w-1"></div>
          <div className="wind-line w-2"></div>
          <div className="wind-line w-3"></div>
        </div>
      </div>

      {/* --- DARK MODE: GALAXY NIGHT --- */}
      <div className="bg-layer dark-mode-layer">
        <div className="space-gradient"></div>
        
        {/* The Milky Way band */}
        <div className="milky-way"></div>
        <div className="milky-way-2"></div>

        {/* Random Twinkling Stars */}
        <div className="stars-container">
          {stars.map((star) => (
            <div 
              key={star.id}
              className={`star \${star.glowing ? 'star-glowing' : ''}`}
              style={{
                left: star.left,
                top: star.top,
                width: star.size,
                height: star.size,
                opacity: star.opacity,
                animationDuration: star.animationDuration,
                animationDelay: star.animationDelay
              }}
            ></div>
          ))}
        </div>

        {/* Trailing Galaxy/Star Cluster */}
        <div className="mouse-galaxy-container" style={{ transform: `translate(\${delayedMousePos.x}px, \${delayedMousePos.y}px)` }}>
          <div className="mouse-galaxy-glow"></div>
          <div className="mouse-star ms-1"></div>
          <div className="mouse-star ms-2"></div>
          <div className="mouse-star ms-3"></div>
          <div className="mouse-star ms-4"></div>
        </div>
      </div>
    </div>
  );
};

export default GlobalBackground;
