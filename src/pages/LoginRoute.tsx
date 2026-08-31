import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  ChevronRight, 
  ArrowLeft,
  Loader2,
  Check
} from "lucide-react";
import { useUserData } from "../hooks/useUserData";
import { useContent } from "../hooks/useContent";

interface LoginRouteProps {
  onLoginSuccess: () => void;
  brandName?: string;
  brandLogo?: string;
}

// Fallback high-quality movie posters of popular/recent releases
const FALLBACK_POSTERS = [
  "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&q=80",
  "https://images.unsplash.com/photo-1542204172-e70528091f50?w=400&q=80",
  "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400&q=80",
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80",
  "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=400&q=80",
  "https://images.unsplash.com/photo-1535016120720-40c646be5580?w=400&q=80",
  "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&q=80",
  "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=400&q=80",
  "https://images.unsplash.com/photo-1524712245354-2c4e5e7134cd?w=400&q=80",
];

export default function LoginRoute({ onLoginSuccess }: LoginRouteProps) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, user, signOut } = useUserData();
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  
  // Loading & Content states
  const [latestPosters, setLatestPosters] = useState<string[]>(FALLBACK_POSTERS);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  const { contents } = useContent();

  useEffect(() => {
    if (contents && contents.length > 0) {
      const list = contents.filter(c => c.poster || c.posterUrl).map(c => ({
        poster: (c.poster || c.posterUrl) as string,
        releaseDate: c.releaseDate || ""
      }));
      list.sort((a, b) => {
        const da = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
        const db = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
        const validDa = isNaN(da) ? 0 : da;
        const validDb = isNaN(db) ? 0 : db;
        return validDb - validDa;
      });
      if (list.length > 0) {
        setLatestPosters(list.map(c => c.poster));
      }
    }
  }, [contents]);

  useEffect(() => {
    if (user && !isSigningIn) {
      onLoginSuccess();
    }
  }, [user, onLoginSuccess, isSigningIn]);

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setErrorText("");
    try {
      await signInWithGoogle();
    } catch (e: any) {
      console.error(e);
      setErrorText(e?.message || "Google Authentication failed. Please try again.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSigningIn) return;

    if (!email) {
      setErrorText("Please enter your email address.");
      return;
    }
    if (!password) {
      setErrorText("Please enter your password.");
      return;
    }
    if (password.length < 6) {
      setErrorText("Password must be at least 6 characters.");
      return;
    }
    if (authMode === "signup" && !displayName) {
      setErrorText("Please enter your display name.");
      return;
    }

    setIsSigningIn(true);
    setErrorText("");

    try {
      if (authMode === "signin") {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password, displayName);
      }
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setIsSigningIn(false);
    }
  };

  // Stagger across columns
  const col1 = latestPosters.filter((_, idx) => idx % 3 === 0);
  const col2 = latestPosters.filter((_, idx) => idx % 3 === 1);
  const col3 = latestPosters.filter((_, idx) => idx % 3 === 2);

  // Triple size for smooth endless keyframing
  const col1Tripled = [...col1, ...col1, ...col1];
  const col2Tripled = [...col2, ...col2, ...col2];
  const col3Tripled = [...col3, ...col3, ...col3];

  const handleCancel = () => {
    signOut().catch(console.error);
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <div className="fixed inset-0 z-[99999] h-screen w-screen bg-[#050202] text-white flex overflow-hidden font-sans select-none">
      
      {/* Dynamic Keyframes for smooth seamless loops */}
      <style>{`
        @keyframes scrollUp {
          0% { transform: translateY(0); }
          100% { transform: translateY(-33.333%); }
        }
        @keyframes scrollDown {
          0% { transform: translateY(-33.333%); }
          100% { transform: translateY(0); }
        }
        .animate-scroll-up {
          animation: scrollUp 150s linear infinite;
        }
        .animate-scroll-down {
          animation: scrollDown 150s linear infinite;
        }
      `}</style>

      {/* LEFT SIDE: Scrolling Posters (Hidden on Mobile) */}
      <div className="hidden md:flex flex-1 relative h-full bg-[#050202] overflow-hidden items-center justify-center p-6 border-r border-white/5">
        
        {/* Poster Grid Container */}
        <div className="absolute inset-0 grid grid-cols-3 gap-4 p-4 opacity-40 scale-105 pointer-events-none">
          
          {/* Column 1 - Scrolls Up */}
          <div className="relative h-full overflow-hidden">
            <div className="animate-scroll-up flex flex-col gap-4">
              {col1Tripled.map((url, i) => (
                <div key={`col1-${i}`} className="w-full aspect-[2/3] rounded-2xl overflow-hidden border border-white/5 shadow-lg bg-neutral-900">
                  <img src={url} alt="Poster" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
              ))}
            </div>
          </div>

          {/* Column 2 - Scrolls Down */}
          <div className="relative h-full overflow-hidden">
            <div className="animate-scroll-down flex flex-col gap-4">
              {col2Tripled.map((url, i) => (
                <div key={`col2-${i}`} className="w-full aspect-[2/3] rounded-2xl overflow-hidden border border-white/5 shadow-lg bg-neutral-900">
                  <img src={url} alt="Poster" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
              ))}
            </div>
          </div>

          {/* Column 3 - Scrolls Up */}
          <div className="relative h-full overflow-hidden">
            <div className="animate-scroll-up flex flex-col gap-4">
              {col3Tripled.map((url, i) => (
                <div key={`col3-${i}`} className="w-full aspect-[2/3] rounded-2xl overflow-hidden border border-white/5 shadow-lg bg-neutral-900">
                  <img src={url} alt="Poster" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Ambient Dark Overlay to blend with the form on the right */}
        <div className="absolute inset-0 bg-radial-gradient(from center, transparent 30%, rgba(5,2,2,0.9) 100%) pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#050202] to-transparent pointer-events-none" />

        {/* Brand visual watermark in the middle of lists */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-md p-8 bg-black/30 backdrop-blur-md rounded-3xl border border-white/5">
          <img src="https://www.image2url.com/r2/default/images/1779795362416-611ba175-203c-4e05-a418-f114f49f612e.png" alt="Logo" className="h-16 w-auto mb-4 drop-shadow-[0_0_20px_rgba(239,68,68,0.7)]" />
          <p className="mt-3 text-sm text-white/60 leading-relaxed font-light">
            Enter the premium arena of world-class entertainment. Seamless streaming, ultimate audio, curated catalogs.
          </p>
        </div>
      </div>

      {/* RIGHT SIDE: Elegant iQIYI Red themed login UI */}
      <div className="w-full md:w-[460px] lg:w-[500px] xl:w-[540px] flex-shrink-0 h-full flex flex-col justify-between p-6 sm:p-12 relative z-50 bg-[#070404] border-l border-white/5 shadow-2xl overflow-y-auto">
        
        {/* Top Header Section */}
        <div className="flex items-center justify-between w-full mb-8">
          {/* Back/Close button */}
          <button 
            onClick={handleCancel}
            className="flex items-center gap-2 group text-white/50 hover:text-white transition-colors cursor-pointer text-xs font-semibold uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Cancel</span>
          </button>

          <img src="https://www.image2url.com/r2/default/images/1779795362416-611ba175-203c-4e05-a418-f114f49f612e.png" alt="Logo" className="h-8 w-auto md:h-10 object-contain drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]" />
        </div>

        {/* Middle Auth Card */}
        <div className="w-full max-w-md mx-auto my-auto space-y-8">
          
          {/* Heading */}
          <div className="space-y-2 text-center md:text-left">
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              {authMode === "signin" ? "Sign In" : "Create Account"}
            </h2>
            <p className="text-xs text-white/40 leading-relaxed font-medium">
              Join our platform to stream highly immersive movies & series instantly.
            </p>
          </div>

          {/* Tab Selection Switcher */}
          <div className="grid grid-cols-2 p-1.5 bg-white/[0.02] border border-white/5 rounded-2xl">
            <button
              onClick={() => { setAuthMode("signin"); setErrorText(""); }}
              className={`py-2.5 text-xs font-medium uppercase tracking-widest rounded-xl transition-all cursor-pointer ${
                authMode === "signin" 
                  ? "bg-red-600 text-white shadow-[0_4px_12px_rgba(239,68,68,0.3)] font-black" 
                  : "text-white/40 hover:text-white"
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => { setAuthMode("signup"); setErrorText(""); }}
              className={`py-2.5 text-xs font-medium uppercase tracking-widest rounded-xl transition-all cursor-pointer ${
                authMode === "signup" 
                  ? "bg-red-600 text-white shadow-[0_4px_12px_rgba(239,68,68,0.3)] font-black" 
                  : "text-white/40 hover:text-white"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Notification / Error details */}
          <AnimatePresence mode="wait">
            {errorText && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-start gap-3 bg-red-950/20 border border-red-500/20 p-4 rounded-2xl text-red-400 text-xs text-left shadow-lg"
              >
                <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                <p className="leading-relaxed font-medium">{errorText}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleEmailAuthSubmit} className="space-y-4">
            {authMode === "signup" && (
              <div className="space-y-2">
                <label className="text-[10px] text-white/40 uppercase tracking-widest block font-medium ml-1">Display Name</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-red-500 transition-colors" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="ex: firefury"
                    className="w-full h-12 bg-white/[0.02] border border-white/5 focus:border-red-500/40 focus:bg-white/[0.04] rounded-2xl pl-11 pr-4 text-xs text-white placeholder-white/20 outline-none transition-all font-medium"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] text-white/40 uppercase tracking-widest block font-medium ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-red-500 transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@email.com"
                  className="w-full h-12 bg-white/[0.02] border border-white/5 focus:border-red-500/40 focus:bg-white/[0.04] rounded-2xl pl-11 pr-4 text-xs text-white placeholder-white/20 outline-none transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] text-white/40 uppercase tracking-widest block font-medium">Password</label>
                {authMode === "signin" && (
                  <button 
                    type="button"
                    onClick={() => setErrorText("Please contact administration to reset your password, or sign in using Google Auth.")}
                    className="text-[10px] text-red-500 font-medium hover:underline"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-red-500 transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 bg-white/[0.02] border border-white/5 focus:border-red-500/40 focus:bg-white/[0.04] rounded-2xl pl-11 pr-12 text-xs text-white placeholder-white/20 outline-none transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 p-1 cursor-pointer transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Terms and conditions disclaimer for and signup mode */}
            {authMode === "signup" && (
              <p className="text-[10px] text-white/30 leading-relaxed text-center font-normal px-2">
                By creating an account, you agree to our terms of utilization and privacy rules.
              </p>
            )}

            {/* Submission premium styled button */}
            <button
              type="submit"
              disabled={isSigningIn}
              className="w-full h-12 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-medium text-xs uppercase tracking-widest rounded-2xl transition-all shadow-[0_4px_25px_rgba(239,68,68,0.3)] hover:shadow-[0_4px_30px_rgba(239,68,68,0.5)] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              {isSigningIn ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <>
                  <span>{authMode === "signin" ? "Sign In" : "Register Now"}</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Elegant Divider */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-white/5"></div>
            <span className="flex-shrink mx-4 text-[9px] text-white/20 uppercase tracking-widest font-medium">Or sync access via</span>
            <div className="flex-grow border-t border-white/5"></div>
          </div>

          {/* Google SSO Login */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
            className="w-full h-12 bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 rounded-2xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 cursor-pointer text-white text-xs uppercase tracking-wider font-medium shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span>Continue with Google</span>
          </button>

          {/* Sync guarantee check lines */}
          <div className="flex flex-col items-center gap-1.5 text-left max-w-[280px] mx-auto border-t border-white/5 pt-4">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <span className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">Sync Favorite Shows</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <span className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">Track Stream History</span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <p className="text-center text-[9px] text-white/20 uppercase tracking-widest font-normal pt-6 border-t border-white/5 mt-8">
          © {new Date().getFullYear()} All rights reserved.
        </p>

      </div>

    </div>
  );
}
