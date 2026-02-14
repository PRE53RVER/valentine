import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

interface Heart {
  id: number;
  x: number;
  delay: number;
  duration: number;
  size: number;
}

interface Sparkle {
  id: number;
  x: number;
  y: number;
  delay: number;
}

interface Firework {
  id: number;
  x: number;
  y: number;
  colors: string[];
}

// Physics state for the No button (kept outside React state for perf)
interface NoButtonPhysics {
  posX: number;
  posY: number;
  velX: number;
  velY: number;
  initialized: boolean;
  lastCursorX: number;
  lastCursorY: number;
  lastCursorTime: number;
  cursorSpeedX: number;
  cursorSpeedY: number;
}

function App() {
  const [hearts, setHearts] = useState<Heart[]>([]);
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  const [fireworks, setFireworks] = useState<Firework[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [hoverYes, setHoverYes] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const noButtonRef = useRef<HTMLButtonElement>(null);

  // Physics ref for the No button — avoids re-renders on every frame
  const noPhysics = useRef<NoButtonPhysics>({
    posX: 0, posY: 0,
    velX: 0, velY: 0,
    initialized: false,
    lastCursorX: -9999, lastCursorY: -9999,
    lastCursorTime: 0,
    cursorSpeedX: 0, cursorSpeedY: 0,
  });
  const rafId = useRef<number>(0);

  // Generate floating hearts
  useEffect(() => {
    const initialHearts: Heart[] = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 10,
      duration: 8 + Math.random() * 6,
      size: 16 + Math.random() * 20,
    }));
    setHearts(initialHearts);
  }, []);

  // Generate sparkles
  useEffect(() => {
    const initialSparkles: Sparkle[] = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 2,
    }));
    setSparkles(initialSparkles);
  }, []);

  // Add more hearts during celebration
  useEffect(() => {
    if (showCelebration) {
      const celebrationHearts: Heart[] = Array.from({ length: 40 }, (_, i) => ({
        id: i + 100,
        x: Math.random() * 100,
        delay: Math.random() * 5,
        duration: 5 + Math.random() * 4,
        size: 20 + Math.random() * 25,
      }));
      setHearts(prev => [...prev, ...celebrationHearts]);
    }
  }, [showCelebration]);

  // Fireworks animation
  const createFirework = useCallback((x: number, y: number) => {
    const colors = ['#ff6b6b', '#ff9a9e', '#fecfef', '#ffd700', '#ff69b4', '#ff1493'];
    const newFirework: Firework = {
      id: Date.now() + Math.random(),
      x,
      y,
      colors,
    };
    setFireworks(prev => [...prev, newFirework]);
    
    setTimeout(() => {
      setFireworks(prev => prev.filter(f => f.id !== newFirework.id));
    }, 1500);
  }, []);

  // Launch multiple fireworks
  const launchFireworks = useCallback(() => {
    const launch = () => {
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          const x = 10 + Math.random() * 80;
          const y = 10 + Math.random() * 60;
          createFirework(x, y);
        }, i * 200);
      }
    };
    
    launch();
    const interval = setInterval(launch, 2000);
    
    setTimeout(() => clearInterval(interval), 10000);
  }, [createFirework]);

  // Handle Yes click
  const handleYesClick = () => {
    setShowCelebration(true);
    launchFireworks();
  };

  // ── No-button carrom-coin physics ──────────────────────────────────
  // Instant "strike" when cursor gets close, smooth glide with friction,
  // elastic bounces off screen edges — just like a carrom coin.

  const STRIKE_RADIUS = 160;    // px – cursor proximity to trigger a strike
  const FRICTION = 0.965;       // per-frame drag (high = long smooth glide)
  const WALL_RESTITUTION = 0.6; // bounce energy retained on wall hit
  const MIN_STRIKE = 18;        // minimum impulse strength
  const MAX_STRIKE = 55;        // cap so it doesn't go crazy
  const SPEED_MULTIPLIER = 2.2; // how much cursor speed amplifies the strike
  const COOLDOWN = 120;         // ms – ignore repeat strikes for this long
  const lastStrikeTime = useRef(0);

  // Track cursor / touch position & velocity
  const onPointerActivity = useCallback((clientX: number, clientY: number) => {
    const p = noPhysics.current;
    const now = performance.now();
    const dt = Math.max(now - p.lastCursorTime, 1);
    p.cursorSpeedX = (clientX - p.lastCursorX) / dt * 16;
    p.cursorSpeedY = (clientY - p.lastCursorY) / dt * 16;
    p.lastCursorX = clientX;
    p.lastCursorY = clientY;
    p.lastCursorTime = now;
  }, []);

  // Global mouse / touch listeners
  useEffect(() => {
    const handleMouse = (e: MouseEvent) => onPointerActivity(e.clientX, e.clientY);
    const handleTouch = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        onPointerActivity(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    window.addEventListener('mousemove', handleMouse, { passive: true });
    window.addEventListener('touchmove', handleTouch, { passive: true });
    window.addEventListener('touchstart', handleTouch, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouse);
      window.removeEventListener('touchmove', handleTouch);
      window.removeEventListener('touchstart', handleTouch);
    };
  }, [onPointerActivity]);

  // Main animation loop
  useEffect(() => {
    if (showCelebration) return;

    const tick = () => {
      const btn = noButtonRef.current;
      if (!btn) { rafId.current = requestAnimationFrame(tick); return; }

      const p = noPhysics.current;

      // Initialise position from current layout
      if (!p.initialized) {
        const r = btn.getBoundingClientRect();
        p.posX = r.left;
        p.posY = r.top;
        p.initialized = true;
      }

      const btnW = btn.offsetWidth;
      const btnH = btn.offsetHeight;
      const cx = p.posX + btnW / 2;
      const cy = p.posY + btnH / 2;

      const dx = cx - p.lastCursorX;
      const dy = cy - p.lastCursorY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const now = performance.now();

      // ── Strike ─────────────────────────────────────────────
      if (dist < STRIKE_RADIUS && dist > 1 && now - lastStrikeTime.current > COOLDOWN) {
        lastStrikeTime.current = now;

        // How fast is the cursor moving?
        const cursorSpeed = Math.sqrt(
          p.cursorSpeedX * p.cursorSpeedX + p.cursorSpeedY * p.cursorSpeedY
        );

        // Closer cursor = stronger strike (like a harder flick)
        const proximity = 1 - dist / STRIKE_RADIUS; // 0 → 1
        const strike = Math.min(
          MAX_STRIKE,
          Math.max(MIN_STRIKE, cursorSpeed * SPEED_MULTIPLIER) * (0.6 + proximity * 0.8)
        );

        // Direction: directly away from cursor
        const nx = dx / dist;
        const ny = dy / dist;

        // Tiny angle deflection so it doesn't feel robotic
        const deflect = (Math.random() - 0.5) * 0.25;
        const cos = Math.cos(deflect);
        const sin = Math.sin(deflect);

        p.velX += (nx * cos - ny * sin) * strike;
        p.velY += (nx * sin + ny * cos) * strike;
      }

      // ── Friction (smooth carrom glide) ─────────────────────
      p.velX *= FRICTION;
      p.velY *= FRICTION;

      // Stop micro-drifts
      if (Math.abs(p.velX) < 0.08) p.velX = 0;
      if (Math.abs(p.velY) < 0.08) p.velY = 0;

      // ── Integrate position ─────────────────────────────────
      p.posX += p.velX;
      p.posY += p.velY;

      // ── Wall bounces (elastic, like carrom board rails) ────
      const margin = 4;
      const maxX = window.innerWidth - btnW - margin;
      const maxY = window.innerHeight - btnH - margin;

      if (p.posX < margin) {
        p.posX = margin;
        p.velX = Math.abs(p.velX) * WALL_RESTITUTION;
      } else if (p.posX > maxX) {
        p.posX = maxX;
        p.velX = -Math.abs(p.velX) * WALL_RESTITUTION;
      }

      if (p.posY < margin) {
        p.posY = margin;
        p.velY = Math.abs(p.velY) * WALL_RESTITUTION;
      } else if (p.posY > maxY) {
        p.posY = maxY;
        p.velY = -Math.abs(p.velY) * WALL_RESTITUTION;
      }

      // ── Write to DOM (no React re-render) ──────────────────
      btn.style.position = 'fixed';
      btn.style.left = `${p.posX}px`;
      btn.style.top = `${p.posY}px`;
      btn.style.zIndex = '50';
      btn.style.transition = 'none';
      btn.style.willChange = 'left, top';

      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId.current);
  }, [showCelebration]);

  // Firework Component
  const FireworkExplosion = ({ firework }: { firework: Firework }) => {
    const particles = Array.from({ length: 20 }, (_, i) => {
      const angle = (i / 20) * Math.PI * 2;
      const velocity = 80 + Math.random() * 40;
      return {
        x: Math.cos(angle) * velocity,
        y: Math.sin(angle) * velocity,
        color: firework.colors[Math.floor(Math.random() * firework.colors.length)],
      };
    });

    return (
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${firework.x}%`,
          top: `${firework.y}%`,
        }}
      >
        {particles.map((particle, i) => (
          <div
            key={i}
            className="firework-particle"
            style={{
              backgroundColor: particle.color,
              animation: `fireworkExplode 1.5s ease-out forwards`,
              animationDelay: `${i * 0.02}s`,
              '--tx': `${particle.x}px`,
              '--ty': `${particle.y}px`,
            } as React.CSSProperties}
          />
        ))}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-screen overflow-hidden ${showCelebration ? 'celebration-bg' : ''}`}
    >
      {/* Background Glow */}
      <div className="bg-glow absolute top-1/2 left-1/2" />
      
      {/* Floating Hearts */}
      {hearts.map(heart => (
        <div
          key={heart.id}
          className="floating-heart"
          style={{
            left: `${heart.x}%`,
            fontSize: `${heart.size}px`,
            animationDelay: `${heart.delay}s`,
            animationDuration: `${heart.duration}s`,
          }}
        >
          {Math.random() > 0.3 ? '❤️' : Math.random() > 0.5 ? '💖' : '💕'}
        </div>
      ))}

      {/* Sparkles */}
      {sparkles.map(sparkle => (
        <div
          key={sparkle.id}
          className="sparkle"
          style={{
            left: `${sparkle.x}%`,
            top: `${sparkle.y}%`,
            animationDelay: `${sparkle.delay}s`,
          }}
        />
      ))}

      {/* Fireworks */}
      {fireworks.map(firework => (
        <FireworkExplosion key={firework.id} firework={firework} />
      ))}

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-4">
        {!showCelebration ? (
          <>
            {/* Valentine Question */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl text-white font-bold text-center mb-12 drop-shadow-lg"
                style={{ fontFamily: "'Great Vibes', cursive" }}>
              Will you be my Valentine?
            </h1>

            {/* Buttons Container */}
            <div className="flex flex-col sm:flex-row gap-8 items-center justify-center">
              {/* Yes Button */}
              <button
                onClick={handleYesClick}
                onMouseEnter={() => setHoverYes(true)}
                onMouseLeave={() => setHoverYes(false)}
                className={`
                  relative px-12 py-5 rounded-full text-2xl font-bold text-white
                  bg-gradient-to-r from-rose-400 to-rose-500
                  transition-all duration-300 ease-out
                  ${hoverYes ? 'transform scale-110' : ''}
                  yes-pulse btn-glow
                `}
                style={{ fontFamily: "'Dancing Script', cursive" }}
              >
                <span className="flex items-center gap-2">
                  ❤️ Yes
                </span>
                {hoverYes && (
                  <span className="absolute inset-0 rounded-full bg-white opacity-20 animate-ping" />
                )}
              </button>

              {/* No Button – physics-driven, impossible to click */}
              <button
                ref={noButtonRef}
                className="
                  px-12 py-5 rounded-full text-2xl font-bold text-white
                  bg-gradient-to-r from-gray-400 to-gray-500
                  no-btn-physics select-none cursor-not-allowed
                  shadow-lg hover:shadow-xl
                "
                style={{ fontFamily: "'Dancing Script', cursive" }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // give an extra impulse on touch
                  if (e.touches[0]) {
                    onPointerActivity(e.touches[0].clientX, e.touches[0].clientY);
                  }
                }}
              >
                <span className="flex items-center gap-2 pointer-events-none">
                  💔 No
                </span>
              </button>
            </div>

            {/* Cute hint text */}
            <p className="mt-12 text-white text-lg opacity-70 animate-pulse"
               style={{ fontFamily: "'Dancing Script', cursive" }}>
              Psst... The Yes button is waiting for you! 💝
            </p>
          </>
        ) : (
          /* Celebration Screen — Poem */
          <div className="poem-container w-full max-w-2xl mx-auto overflow-y-auto max-h-[90vh] px-6 py-8 scrollbar-hide">
            {/* Title */}
            <h1
              className="love-text text-5xl md:text-7xl lg:text-8xl text-white font-bold text-center mb-4 poem-fade-in"
              style={{ fontFamily: "'Great Vibes', cursive", animationDelay: '0s' }}
            >
              I Love You My Baby ❤️
            </h1>

            <div className="flex justify-center gap-3 text-3xl mb-8 poem-fade-in" style={{ animationDelay: '0.3s' }}>
              <span>🎉</span><span>💝</span><span>🌹</span><span>💕</span><span>🎊</span>
            </div>

            {/* Poem Title */}
            <h2
              className="text-3xl md:text-4xl text-white/90 text-center mb-10 italic poem-fade-in"
              style={{ fontFamily: "'Great Vibes', cursive", animationDelay: '0.6s' }}
            >
              My Love, My Valentine
            </h2>

            {/* Stanzas */}
            {[
              [
                'No praises are enough,',
                'No words could ever do,',
                'For beauty itself feels shy',
                'Standing next to you.',
              ],
              [
                'Your eyes… like a flower,',
                'Blooming a universe inside,',
                'Galaxies of wonder and warmth',
                'Where all my dreams reside.',
              ],
              [
                'Your smile — a sunrise of magic,',
                'Soft, golden, and true,',
                'It lights the darkest corners',
                'And pulls my soul to you.',
              ],
              [
                'In your laughter I find music,',
                'In your silence I find peace,',
                'In your presence, my restless heart',
                'Finally finds release.',
              ],
              [
                'If beauty were a language,',
                'The world would speak your name,',
                'For every star in the heavens',
                'Burns with your gentle flame.',
              ],
              [
                'No praises are enough, my love,',
                'Still my heart will always try,',
                'To tell you — today, tomorrow, forever…',
              ],
            ].map((stanza, si) => (
              <div
                key={si}
                className="poem-stanza poem-fade-in text-center mb-8"
                style={{ animationDelay: `${0.9 + si * 0.5}s` }}
              >
                {stanza.map((line, li) => (
                  <p
                    key={li}
                    className="text-xl md:text-2xl text-white/90 leading-relaxed"
                    style={{ fontFamily: "'Dancing Script', cursive" }}
                  >
                    {line}
                  </p>
                ))}
              </div>
            ))}

            {/* Closing line */}
            <p
              className="poem-fade-in text-2xl md:text-3xl text-white font-bold text-center mt-6 mb-4 poem-glow"
              style={{
                fontFamily: "'Great Vibes', cursive",
                animationDelay: `${0.9 + 6 * 0.5}s`,
              }}
            >
              You are the most beautiful part of my life. ❤️
            </p>

            <div
              className="flex justify-center gap-4 text-4xl mt-8 mb-4 animate-bounce poem-fade-in"
              style={{ animationDelay: `${0.9 + 7 * 0.5}s` }}
            >
              <span>💖</span><span>💗</span><span>💕</span><span>💖</span>
            </div>
          </div>
        )}
      </div>

      {/* CSS for firework animation */}
      <style>{`
        @keyframes fireworkExplode {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(var(--tx), var(--ty)) scale(0);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default App;
