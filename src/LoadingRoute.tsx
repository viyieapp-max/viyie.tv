import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import openingVideo from "./assets/opening.webm?url";

interface LoadingRouteProps {
  onComplete: () => void;
}

export function LoadingRoute({ onComplete }: LoadingRouteProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCompleteRef = useRef(onComplete);

  // Keep ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const startTime = Date.now();
    const duration = 9000;

    const handleComplete = () => {
      onCompleteRef.current();
    };

    const timer = setTimeout(handleComplete, duration);

    // If user switches tab, check if it should have finished when they return
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const elapsed = Date.now() - startTime;
        if (elapsed >= duration) {
          handleComplete();
        } else if (videoRef.current && videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Try to ensure video plays
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Silently fail if autoplay blocked
      });
    }

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const handleEnded = () => {
    onCompleteRef.current();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center overflow-hidden touch-none select-none">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center justify-center p-4 text-center"
      >
        <video 
          ref={videoRef}
          src={openingVideo} 
          autoPlay 
          muted 
          playsInline 
          loop={false}
          onEnded={handleEnded}
          className="w-[45vw] sm:w-[25vw] max-w-[300px] h-auto object-contain pointer-events-none"
        />
      </motion.div>
    </div>
  );
}
