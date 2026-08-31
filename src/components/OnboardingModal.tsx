import { useState, useEffect } from "react";
import { useUserData } from "../hooks/useUserData";
import { motion, AnimatePresence } from "framer-motion";
import { User, ArrowRight, Sparkles, AlertCircle } from "lucide-react";
import { db, collection, query, where, getDocs } from "../lib/firebase";

export default function OnboardingModal() {
  const { user, updateProfile } = useUserData();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [isUsernameEdited, setIsUsernameEdited] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(false);
  const [complete, setComplete] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [errorMsg, setErrorMsg] = useState("");

  // Countdown timer for Welcomescreen
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showWelcomeScreen) {
      setCountdown(10);
      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setComplete(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showWelcomeScreen]);

  // Initialize with user's displayName if available
  useEffect(() => {
    if (user) {
      // Clear previous states
      setName("");
      setUsername("");
      setIsUsernameEdited(false);
      setErrorMsg("");

      // Set new
      if (user.name && user.name !== "User") {
        setName(user.name);
      }
    }
  }, [user?.uid]);

  // Auto-generate username from name ONLY if user hasn't manually edited it
  useEffect(() => {
    if (!isUsernameEdited) {
      if (name.trim()) {
        const suggested = name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
        setUsername(suggested);
      } else {
        setUsername("");
      }
    }
  }, [name, isUsernameEdited]);

  const handleUsernameChange = (val: string) => {
    setIsUsernameEdited(true);
    // Remove @ if user types it, we'll display it separately
    let formatted = val.replace(/^@/, "");
    // Convert to lowercase, replace spaces with underscores, remove non-alphanumeric/underscore
    formatted = formatted.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    setUsername(formatted);
    setErrorMsg("");
  };

  const checkUsernameUnique = async (uname: string) => {
    try {
      const q = query(collection(db, "users"), where("username", "==", uname));
      const snapshot = await getDocs(q);
      // It's possible the current user already has this username, but we only show this modal if they DON'T have a username
      if (!snapshot.empty) {
        return false;
      }
      return true;
    } catch(err) {
      console.error(err);
      return false; // Fail safe
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !username.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    setErrorMsg("");

    const finalUsername = "@" + username.trim();

    const isUnique = await checkUsernameUnique(finalUsername);
    if (!isUnique) {
      setErrorMsg("Username is already taken by another user.");
      setIsSubmitting(false);
      return;
    }

    try {
      await updateProfile({
        name: name.trim(),
        username: finalUsername,
      });
      setShowWelcomeScreen(true);
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
      setIsSubmitting(false);
    }
  };

  const shouldRenderForm = user && (!user.username || showWelcomeScreen) && !complete && !showWelcomeScreen;
  const shouldRenderWelcome = showWelcomeScreen && !complete;

  return (
    <AnimatePresence>
      {shouldRenderWelcome && (
        <motion.div
           key="welcome"
           initial={{ opacity: 0, scale: 1.02 }}
           animate={{ opacity: 1, scale: 1 }}
           exit={{ opacity: 0, scale: 0.98, filter: "blur(15px)" }}
           transition={{ duration: 0.9, ease: "easeInOut" }}
           className="fixed inset-0 z-[99999] flex items-center justify-center bg-black overflow-hidden font-inter text-white"
        >
          {/* CSS for Welcome Animation inside the component to keep it isolated */}
          <style dangerouslySetInnerHTML={{__html: `
          .welcome-content {
            text-align: center;
          }
          
          .welcome-title {
            font-size: clamp(3rem, 8vw, 7rem);
            font-weight: 800;
            letter-spacing: clamp(-1.75px, -0.25vw, -3.5px);
            position: relative;
            overflow: hidden;
            background: #000;
            margin: 0;
            padding: 2rem;
            z-index: 10;
          }
          
          .welcome-subtitle {
            margin-top: 1rem;
            font-size: 1rem;
            color: rgba(255, 255, 255, 0.7);
            z-index: 10;
            position: relative;
          }
          
          .welcome-aurora {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 2;
            mix-blend-mode: darken;
            pointer-events: none;
          }
          
          .welcome-aurora__item {
            overflow: hidden;
            position: absolute;
            width: 60vw;
            height: 60vw;
            border-radius: 37% 29% 27% 27% / 28% 25% 41% 37%;
            filter: blur(1rem);
            mix-blend-mode: overlay;
          }
          
          .welcome-aurora__item:nth-of-type(1) {
            background-color: #00c2ff;
            top: -50%;
            animation: aurora-border 6s ease-in-out infinite,
              aurora-1 12s ease-in-out infinite alternate;
          }
          
          .welcome-aurora__item:nth-of-type(2) {
            background-color: #ffc640;
            right: 0;
            top: 0;
            animation: aurora-border 6s ease-in-out infinite,
              aurora-2 12s ease-in-out infinite alternate;
          }
          
          .welcome-aurora__item:nth-of-type(3) {
            background-color: #33ff8c;
            left: 0;
            bottom: 0;
            animation: aurora-border 6s ease-in-out infinite,
              aurora-3 8s ease-in-out infinite alternate;
          }
          
          .welcome-aurora__item:nth-of-type(4) {
            background-color: #e54cff;
            right: 0;
            bottom: -50%;
            animation: aurora-border 6s ease-in-out infinite,
              aurora-4 24s ease-in-out infinite alternate;
          }
          
          @keyframes aurora-1 {
            0% { top: 0; right: 0; }
            50% { top: 100%; right: 75%; }
            75% { top: 100%; right: 25%; }
            100% { top: 0; right: 0; }
          }
          
          @keyframes aurora-2 {
            0% { top: -50%; left: 0%; }
            60% { top: 100%; left: 75%; }
            85% { top: 100%; left: 25%; }
            100% { top: -50%; left: 0%; }
          }
          
          @keyframes aurora-3 {
            0% { bottom: 0; left: 0; }
            40% { bottom: 100%; left: 75%; }
            65% { bottom: 40%; left: 50%; }
            100% { bottom: 0; left: 0; }
          }
          
          @keyframes aurora-4 {
            0% { bottom: -50%; right: 0; }
            50% { bottom: 0%; right: 40%; }
            90% { bottom: 50%; right: 25%; }
            100% { bottom: -50%; right: 0; }
          }
          
          @keyframes aurora-border {
            0% { border-radius: 37% 29% 27% 27% / 28% 25% 41% 37%; }
            25% { border-radius: 47% 29% 39% 49% / 61% 19% 66% 26%; }
            50% { border-radius: 57% 23% 47% 72% / 63% 17% 66% 33%; }
            75% { border-radius: 28% 49% 29% 100% / 93% 20% 64% 25%; }
            100% { border-radius: 37% 29% 27% 27% / 28% 25% 41% 37%; }
          }
        `}} />
        
        <motion.div 
          className="welcome-content flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05, y: -30, filter: "blur(12px)" }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        >
          <h1 className="welcome-title text-center">Welcome to VIYIE
            <div className="welcome-aurora">
              <div className="welcome-aurora__item"></div>
              <div className="welcome-aurora__item"></div>
              <div className="welcome-aurora__item"></div>
              <div className="welcome-aurora__item"></div>
            </div>
            </h1>
            <p className="welcome-subtitle text-white/50 text-center font-medium">enjoy the best experience from us</p>
            
            <motion.div 
              className="mt-8 flex flex-col items-center gap-3"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
            >
              <span className="text-[10px] sm:text-[11px] text-white/40 uppercase tracking-[0.25em] font-black leading-none">
                Automatically exiting in
              </span>
              
              <div className="flex items-center justify-center gap-2 h-14 sm:h-16 px-5 sm:px-6 bg-white/5 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-md">
                <span className="relative flex items-center justify-center w-8">
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={countdown}
                      initial={{ y: 15, opacity: 0, filter: "blur(4px)" }}
                      animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                      exit={{ y: -15, opacity: 0, filter: "blur(4px)" }}
                      transition={{ type: "spring", stiffness: 350, damping: 25 }}
                      className="absolute text-2xl sm:text-3xl font-extrabold text-red-500 notranslate"
                      translate="no"
                    >
                      {countdown}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <span className="text-xs sm:text-sm font-medium text-white/50 lowercase ml-1">seconds</span>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}

      {shouldRenderForm && (
        <motion.div 
          key="onboarding-form"
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.4 }}
        >
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-[#0f0f0f] border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden"
          >
        {/* Background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-600/10 blur-[60px] rounded-full" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-red-600/20 blur-[60px] rounded-full" />

        <div className="relative text-center space-y-6">
          <div className="w-20 h-20 bg-gradient-to-br from-red-600 to-red-500 rounded-2xl mx-auto flex items-center justify-center transform rotate-6 shadow-xl shadow-red-950/20">
            <User className="w-10 h-10 text-white -rotate-6" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-medium text-white tracking-tight">Welcome to VIYIE</h2>
            <p className="text-white/40 text-sm font-medium">Complete your profile to start sharing your thoughts.</p>
          </div>

          <div className="space-y-4 text-left">
            <div className="space-y-2">
              <label className="text-[10px] font-medium uppercase tracking-widest text-white/30 ml-2">Display Name</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-red-500 transition-colors">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="ex: Khazu"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="notranslate w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-red-500/50 transition-all font-medium"
                  translate="no"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-medium uppercase tracking-widest text-white/30 ml-2">Username</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-red-500 transition-colors font-medium">
                  @
                </div>
                <input
                  type="text"
                  placeholder="ex: khazu_1bo"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className="notranslate w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-red-500/50 transition-all font-medium"
                  translate="no"
                />
              </div>
              {errorMsg && (
                <p className="text-[11px] text-red-500 ml-2 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3 h-3" />
                  {errorMsg}
                </p>
              )}
              <p className="text-[11px] text-white/20 ml-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Autogenerated for you. Use only letters, numbers, and underscores.
              </p>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !username.trim() || isSubmitting}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-600 to-red-500 text-white font-medium text-sm shadow-lg shadow-red-950/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Let's Go
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
