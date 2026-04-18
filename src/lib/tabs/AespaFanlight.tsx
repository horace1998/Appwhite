import { useState, useEffect, useRef } from "react";
import { motion, useAnimation } from "motion/react";

interface FanlightProps {
  onShatter: () => void;
}

export default function AespaFanlight({ onShatter }: FanlightProps) {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const controls = useAnimation();

  useEffect(() => {
    if (isHolding) {
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const newProgress = Math.min(elapsed / 1200, 1); // 1.2 seconds to full charge
        setProgress(newProgress);

        if (newProgress >= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          onShatter();
        }
      }, 16);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setProgress(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHolding, onShatter]);

  const handleStart = () => setIsHolding(true);
  const handleEnd = () => setIsHolding(false);

  return (
    <div 
      className="flex flex-col items-center justify-center gap-12 select-none touch-none"
      onMouseDown={handleStart}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
    >
      <div className="relative w-64 h-64 flex items-center justify-center">
        {/* Glow Effect */}
        <div 
          className="absolute inset-0 rounded-full blur-[60px] transition-all duration-300"
          style={{ 
            background: `radial-gradient(circle, rgba(179,136,255,${0.2 + progress * 0.8}) 0%, transparent 70%)`,
            transform: `scale(${1 + progress * 0.5})`
          }}
        />

        {/* Fanlight Base Shape (simplified futuristic aespa emblem look) */}
        <svg viewBox="0 0 100 100" className="w-full h-full relative z-10 filter drop-shadow-[0_0_20px_rgba(179,136,255,0.3)]">
          {/* Inner Core */}
          <circle 
            cx="50" cy="50" r="30" 
            fill="none" 
            stroke="white" 
            strokeWidth="0.5" 
            strokeOpacity="0.2"
          />
          
          {/* aespa 'ae' styled logo simplified */}
          <motion.path
            d="M30 50 Q 50 20 70 50 Q 50 80 30 50 Z"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0.2 }}
            animate={{ 
              pathLength: progress, 
              opacity: 0.2 + progress * 0.8,
              stroke: isHolding ? "#B388FF" : "#FFFFFF"
            }}
          />

          <motion.path
            d="M50 30 L 50 70 M 35 45 L 65 55"
            stroke="white"
            strokeWidth="1"
            strokeOpacity={0.1 + progress * 0.4}
          />

          {/* Progress Ring */}
          <circle 
            cx="50" cy="50" r="45" 
            fill="none" 
            stroke="rgba(255,255,255,0.05)" 
            strokeWidth="2"
          />
          <motion.circle 
            cx="50" cy="50" r="45" 
            fill="none" 
            stroke="#B388FF" 
            strokeWidth="2"
            strokeDasharray="283"
            strokeDashoffset={283 - (283 * progress)}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
          />
        </svg>

        {/* Interaction Prompt Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
           {!isHolding && progress === 0 && (
             <span className="text-[10px] tracking-[0.5em] text-white/40 uppercase animate-pulse">
               Hold to SYNK
             </span>
           )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
         <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
               className="h-full bg-synk-lavender"
               initial={{ width: 0 }}
               animate={{ width: `${progress * 100}%` }}
               transition={{ type: "spring", bounce: 0, duration: 0.1 }}
            />
         </div>
         <span className="text-[8px] tracking-[0.6em] text-white/20 uppercase">
            {isHolding ? "Syncing Resonance..." : "Calibration Ready"}
         </span>
      </div>
    </div>
  );
}
