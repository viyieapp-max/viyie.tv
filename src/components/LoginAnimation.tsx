import { motion } from "framer-motion";

export function LoginAnimation() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#05010a] animate-gradient-bg bg-[length:400%_400%] z-0">
       <div className="absolute inset-0 bg-gradient-to-br from-[#0a0510] via-[#05010a] to-[#1a0505] opacity-50 mix-blend-screen animate-gradient-bg bg-[length:400%_400%]" />
      
      {/* Wind Streaks - Top to Bottom */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={`wind-${i}`}
          className="absolute w-[2px] bg-gradient-to-b from-transparent via-white/20 to-transparent shadow-[0_0_8px_rgba(255,255,255,0.4)]"
          style={{
            height: Math.random() * 200 + 100,
            left: `${Math.random() * 100}%`,
            top: '-50%',
          }}
          animate={{
            y: ['0vh', '150vh'],
          }}
          transition={{
            duration: Math.random() * 3 + 2,
            repeat: Infinity,
            repeatType: 'loop',
            ease: "linear",
            delay: Math.random() * 4,
          }}
        />
      ))}

      {/* Floating Particles in Background for depth - Top to Bottom */}
      {[...Array(40)].map((_, i) => (
        <motion.div
          key={`part-${i}`}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 4 + 1 + 'px',
            height: Math.random() * 4 + 1 + 'px',
            backgroundColor: ['#fff', '#fde047', '#60a5fa', '#f472b6'][Math.floor(Math.random() * 4)],
            left: `${Math.random() * 100}%`,
            top: '-10%',
            opacity: 0
          }}
          animate={{
            y: [0, typeof window !== 'undefined' ? window.innerHeight + 100 : 800],
            x: [0, Math.random() * 50 - 25],
            opacity: [0, Math.random() * 0.5 + 0.3, 0],
            scale: [0, Math.random() + 0.5, 0]
          }}
          transition={{
            duration: Math.random() * 4 + 3,
            repeat: Infinity,
            delay: Math.random() * 5,
          }}
        />
      ))}
    </div>
  )
}
