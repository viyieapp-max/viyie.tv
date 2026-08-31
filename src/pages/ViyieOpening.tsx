import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronRight, 
  ChevronLeft,
  Download, 
  Sparkles, 
  Globe, 
  Tv, 
  Star, 
  User, 
  ShieldCheck, 
  Layers,
  MapPin,
  X
} from "lucide-react";
import { useUserData } from "../hooks/useUserData";
import { useSettings } from "../hooks/useSettings";
import { useContent } from "../hooks/useContent";
import { LoadingRoute } from "../LoadingRoute";
import { db, collection, getDocs, query } from "../lib/firebase";
import { BRAND_NAME, BRAND_LOGO_URL } from "../constants/brand";
import { useLanguage, translateTextWithGoogle } from "../hooks/useLanguage";
import { LanguageSwitcher } from "../components/UIComponents";

// Core platform premium features
const KEY_FEATURES = [
  { name: "Ultra HD Cinematic Engine", icon: Tv, desc: "Immersive high-fidelity visualization with instant trailer pre-buffering" },
  { name: "Cross-Device Sync", icon: Layers, desc: "Pick up exactly where you left off on TV, desktop, tablet, or mobile native apps" },
  { name: "Safe Cloud Storage", icon: ShieldCheck, desc: "Securely save bookmarks, favorites, and watch history with real-time sync" },
  { name: "Dynamic Discoveries", icon: Sparkles, desc: "Explosive, trending content updated automatically straight to your dashboard" }
];

// Fallback high quality cover photos and media info
const PREMIUM_MOVIES = [
  {
    id: "taste-1",
    title: "Spider-Man: Spiderverse",
    studio: "Sony Pictures",
    rating: "4.9",
    type: "Sci-Fi / Action",
    youtubeId: "g4Hbz2j0n0Q",
    backdrop: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1200&q=80",
    poster: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&q=80",
    synopsis: "Teen Miles Morales becomes the Spider-Man of his universe and must join with five spider-powered individuals from other dimensions to stop a threat for all realities."
  },
  {
    id: "taste-2",
    title: "Wish World",
    studio: "Walt Disney",
    rating: "4.6",
    type: "Musical / Fantasy",
    youtubeId: "rcPymfHszV8",
    backdrop: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&q=80",
    poster: "https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?w=600&q=80",
    synopsis: "A young girl named Asha makes a wish so powerful that it's answered by a cosmic force, a little ball of boundless energy called Star."
  },
  {
    id: "taste-3",
    title: "Luck Animation",
    studio: "Skydance Animation",
    rating: "4.8",
    type: "Family / Adventure",
    youtubeId: "Xz9g1b_vWv4", // The 'Luck' official trailer
    backdrop: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80",
    poster: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&q=80", // Animated girl under umbrella lookalike
    synopsis: "The curtain is pulled back on the millennia-old battle between the organizations of good luck and bad luck that secretly affects everyday lives."
  },
  {
    id: "taste-4",
    title: "Barbie Dreamhouse",
    studio: "Mattel Studio",
    rating: "4.7",
    type: "Comedy / Fantasy",
    youtubeId: "pBk4NYhWNMM",
    backdrop: "https://images.unsplash.com/photo-1524712245354-2c4e5e7134cd?w=1200&q=80",
    poster: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=600&q=80",
    synopsis: "Stereotypical Barbie experiences a full-on existential crisis and must travel to the real world in order to understand herself and discover her true destiny."
  },
  {
    id: "taste-5",
    title: "Peter Pan & Wendy",
    studio: "Fantasy Pictures",
    rating: "4.5",
    type: "Adventure / Animation",
    youtubeId: "9_U_Lsc_uT0",
    backdrop: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&q=80",
    poster: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&q=80",
    synopsis: "Wendy Darling, a young girl afraid to leave her childhood home behind, meets Peter Pan, a boy who refuses to grow up."
  }
];

const FAQ_ITEMS = [
  {
    q: "What is Viyie Streaming Platform?",
    a: "Viyie is a premium entertainment ecosystem that aggregates world-class cinematic content under one unified, lightning-fast streaming interface.",
  },
  {
    q: "Which device players and platforms are officially supported?",
    a: "We natively support high-speed direct streaming on all modern web browsers (Chrome, Safari, Firefox, Edge) across mobile native viewing, tablets, and desktop computers.",
  },
  {
    q: "Can I watch offline or download contents?",
    a: "Absolutely! By logging in with Google, you gain instant access to our secure download hub with fully integrated, virus-free high-speed links.",
  },
  {
    q: "How does the sync functionality work?",
    a: "Your account credentials remain perfectly synced in our real-time cloud datastores. Watch sequences of TV shows, continue watching where you left off, and curate custom lists seamlessly.",
  },
];

const IMAGES = {
  TABLET_ICON: "https://cdn.corenexis.com/files/c/7236678720.png",
  MOBILE_ICON: "https://cdn.corenexis.com/files/c/7688792720.png",
  COMPUTER_ICON: "https://cdn.corenexis.com/files/c/5962135720.png",
  DOWN_DEVICE: "https://cdn.corenexis.com/files/c/6878663720.png",
  BANNER_3D: "https://cdn.corenexis.com/files/c/7858945720.png",
  BANNER_2D: "https://cdn.corenexis.com/files/c/4815999720.png",
};

function getYouTubeId(url: string) {
  if (!url) return null;
  try {
    let id = "";
    if (url.includes("v=")) {
      id = url.split("v=")[1].split(/[&?]/)[0];
    } else if (url.includes("youtu.be/")) {
      id = url.split("youtu.be/")[1].split(/[&?]/)[0];
    } else if (url.includes("/embed/")) {
      id = url.split("/embed/")[1].split(/[&?]/)[0];
    } else if (url.includes("/shorts/")) {
      const parts = url.split("/shorts/");
      id = parts[parts.length - 1].split(/[?&/]/)[0];
    }
    
    if (id && id !== "videoseries" && id.length > 2) {
      return id;
    }
  } catch (e) {}
  return null;
}

export default function ViyieOpening() {
  const { signInWithGoogle, user } = useUserData();
  const { settings } = useSettings();
  const { contents, popularAll } = useContent();

  const { t, changeLanguage } = useLanguage();
  const language: string = "en";
  const [translatedSynopsis, setTranslatedSynopsis] = useState("");
  const [showVpnNotification, setShowVpnNotification] = useState(false);

  // Core platform premium features translated
  const translatedFeatures = KEY_FEATURES;

  const activeMovies = useMemo(() => {
    if (!contents || contents.length === 0) {
      return PREMIUM_MOVIES;
    }

    const sourceList = (popularAll && popularAll.length > 0) ? popularAll : contents;
    const mapped = sourceList
      .filter((item) => item.poster)
      .slice(0, 20)
      .map((item, index) => {
        const ytId = getYouTubeId(item.embedUrl || item.streamUrl || item.trailerUrl || "") || "g4Hbz2j0n0Q";
        return {
          id: item.id || `taste-${index}`,
          title: item.title || "Untitled Preview",
          studio: (item as any).studio || (item as any).director || "Viyie Entertainment",
          rating: item.rating ? String(item.rating) : "4.7",
          type: Array.isArray(item.genres) && item.genres.length > 0 ? item.genres.join(" / ") : (item.type || "Movie"),
          youtubeId: ytId,
          backdrop: item.backdrop || item.poster || "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1200&q=80",
          poster: item.poster || "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&q=80",
          synopsis: (item as any).description || (item as any).synopsis || "No description available for this preview."
        };
      });

    if (mapped.length < 2) {
      return PREMIUM_MOVIES;
    }
    return mapped;
  }, [contents, popularAll]);

  const [isPlayingOpening, setIsPlayingOpening] = useState(false);

  const [posters, setPosters] = useState<string[]>([]);

  useEffect(() => {
    if (activeMovies) {
      setPosters(activeMovies.map(pm => pm.poster));
    }
  }, [activeMovies]);
  
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  
  // Gatekeeper Dialog option
  const [showEntranceModal, setShowEntranceModal] = useState(false);

  // Staggered trigger on mount
  const [isMounted, setIsMounted] = useState(false);

  // Active indices for rotating trailer background and Coverflow slider
  const [activeTrailerIndex, setActiveTrailerIndex] = useState(2);
  const [activeCoverflowIndex, setActiveCoverflowIndex] = useState(2);
  const [timeElapsed, setTimeElapsed] = useState(0);

  // Sync index of coverflow to the background trailer
  const handleSelectCoverflowIndex = (idx: number) => {
    setActiveCoverflowIndex(idx);
  };

  // Automated 60-second timer loops with preloading 10 seconds in advance (at 50 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeElapsed((prev) => {
        if (prev >= 59) {
          // Time to switch to next trailer
          setActiveTrailerIndex((prevIndex) => {
            const len = activeMovies?.length || PREMIUM_MOVIES.length;
            return (prevIndex + 1) % len;
          });
          return 0;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeMovies]);

  // Mount stagger trigger
  useEffect(() => {
    setIsMounted(true);
    localStorage.setItem("has_seen_opening", "true");
  }, []);

  useEffect(() => {
    if (contents && contents.length > 0) {
      const list = contents.filter(c => c.poster || c.posterUrl).map(c => c.poster || c.posterUrl) as string[];
      if (list.length > 0) {
        setPosters(list);
      }
    }
  }, [contents]);

  const handleOpeningAnimationComplete = () => {
    setIsPlayingOpening(false);
    localStorage.setItem("has_seen_opening", "true");
  };

  const handleInstallAppClick = () => {
    const link = settings?.appDownloadLink;
    if (link && link.trim() !== "") {
      window.open(link, "_blank", "noopener,noreferrer");
    } else {
      showToast("Application build packages are starting compiler services! Available shortly.");
    }
  };

  const handleGoogleSignInClick = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
      showToast("Signed in successfully! Launching secure entertainment line...");
      setTimeout(() => {
        window.history.pushState({}, "", "/home");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, 1500);
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || "Google Authentication bypassed. Please request administrator sync.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleNavigateToHome = () => {
    window.history.pushState({}, "", "/home");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleNavigateToSubscription = () => {
    window.history.pushState({}, "", "/subsviyie");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleNavigateToLogin = () => {
    window.history.pushState({}, "", "/login");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleScrollToDevices = () => {
    const el = document.getElementById("available-devices");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleEntranceTrigger = () => {
    if (user) {
      handleNavigateToHome();
    } else {
      setShowEntranceModal(true);
    }
  };

  // Infinite marquee helpers
  const rowLeft = useMemo(() => {
    return [...posters, ...posters, ...posters];
  }, [posters]);

  const rowRight = useMemo(() => {
    return [...posters, ...posters, ...posters].reverse();
  }, [posters]);

  if (isPlayingOpening) {
    return <LoadingRoute onComplete={handleOpeningAnimationComplete} />;
  }

  // Next preloaded trailer parameters
  const nextVideoIndex = (activeTrailerIndex + 1) % activeMovies.length;
  const currentTrailer = activeMovies[activeTrailerIndex] || activeMovies[0];
  const preloadedTrailer = activeMovies[nextVideoIndex] || activeMovies[0];

  // Translated FAQs
  const translatedFaqItems = FAQ_ITEMS;

  // Indonesian VPN / timezone / custom location suggestion popup hook disabled
  useEffect(() => {
    // Keep strictly English, no popup suggestion needed
  }, []);

  // Sync / translate active synopsis on the fly
  useEffect(() => {
    let active = true;
    const originalText = currentTrailer?.synopsis || "No synopsis available for this selection.";
    if (language === "id") {
      setTranslatedSynopsis("Menerjemahkan...");
      translateTextWithGoogle(originalText, "id", "en")
        .then((res) => {
          if (active) {
            setTranslatedSynopsis(res);
          }
        })
        .catch(() => {
          if (active) {
            setTranslatedSynopsis(originalText);
          }
        });
    } else {
      setTranslatedSynopsis(originalText);
    }
    return () => {
      active = false;
    };
  }, [currentTrailer?.id, currentTrailer?.synopsis, language]);

  // Motion variants for native staggered appearance loading
  const staggeredContainer: any = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.1
      }
    }
  };

  const staggeredItem: any = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 70, damping: 15 }
    }
  };

  const revealUp: any = {
    hidden: { opacity: 0, y: 40 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.7, ease: [0.215, 0.610, 0.355, 1.000] } 
    }
  };

  const revealLeft: any = {
    hidden: { opacity: 0, x: -40 },
    visible: { 
      opacity: 1, 
      x: 0, 
      transition: { duration: 0.7, ease: [0.215, 0.610, 0.355, 1.000] } 
    }
  };

  const revealRight: any = {
    hidden: { opacity: 0, x: 40 },
    visible: { 
      opacity: 1, 
      x: 0, 
      transition: { duration: 0.7, ease: [0.215, 0.610, 0.355, 1.000] } 
    }
  };

  const revealScale: any = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { 
      opacity: 1, 
      scale: 1, 
      transition: { duration: 0.7, ease: [0.215, 0.610, 0.355, 1.000] } 
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0505] text-[#eaeaea] font-sans overflow-x-hidden relative selection:bg-[#ff1e27] selection:text-white pb-16">
      {/* Dynamic Keyframe Marquees & Premium Styles */}
      <style>{`
        @font-face {
          font-family: 'NexaHeavy';
          src: url('/Nexa-Heavy.ttf') format('truetype');
          font-weight: 950;
          font-style: normal;
        }
        .font-nexa {
          font-family: 'NexaHeavy', sans-serif;
        }
        @keyframes scrollLeft {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        @keyframes scrollRight {
          0% { transform: translate3d(-50%, 0, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }
        .animate-marquee-left {
          animation: scrollLeft 180s linear infinite;
        }
        .animate-marquee-right {
          animation: scrollRight 180s linear infinite;
        }
        .text-glow-red {
          text-shadow: 0 0 15px rgba(255, 30, 39, 0.4);
        }
      `}</style>

      {/* Global Modern Notification Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-[1002] bg-[#140b0b] border border-red-500/20 px-5 py-4 rounded-2xl flex items-center gap-3.5 shadow-[0_20px_50px_rgba(255,30,39,0.15)] max-w-sm"
          >
            <div className="w-10 h-10 rounded-xl bg-red-600/10 flex items-center justify-center border border-red-500/20 shrink-0">
              <Sparkles className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-xs text-white/80 font-medium leading-relaxed">
              {toastMessage}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GATEKEEPER MODAL POP-UP */}
      <AnimatePresence>
        {showEntranceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/85 backdrop-blur-xl px-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 30, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-md bg-[#110808] border border-red-500/20 rounded-3xl p-6 md:p-8 overflow-hidden shadow-[0_0_80px_rgba(255,30,39,0.2)] text-center"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-red-600/10 blur-[60px] rounded-full pointer-events-none" />

              <div className="w-14 h-14 rounded-2xl bg-red-600/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
                <User className="w-6 h-6 text-red-500" />
              </div>

              <h3 className="text-xl md:text-2xl font-normal text-white uppercase tracking-wider mb-2 font-japanese">
                {t("unifiedGateway")}
              </h3>
              <p className="text-xs text-white/50 leading-relaxed font-normal mb-8 max-w-xs mx-auto">
                {t("gatewayDesc")}
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={async () => {
                    setShowEntranceModal(false);
                    await handleGoogleSignInClick();
                  }}
                  className="w-full h-12 bg-red-600 hover:bg-red-500 text-white font-normal text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_4px_20px_rgba(255,30,39,0.3)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-white" />
                  <span>{t("continueAccount")}</span>
                </button>

                <button
                  onClick={() => {
                    setShowEntranceModal(false);
                    handleNavigateToHome();
                  }}
                  className="w-full h-12 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 font-normal text-xs uppercase tracking-wider rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Globe className="w-4 h-4 text-white/60" />
                  <span>{t("browseInstantly")}</span>
                </button>
              </div>

              <button
                onClick={() => setShowEntranceModal(false)}
                className="absolute top-4 right-4 text-white/30 hover:text-white text-sm transition-colors"
              >
                ✕
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. iQIYI-Inspired Solid Black All-inclusive Premium Navbar */}
      <header className="fixed top-0 inset-x-0 h-16 md:h-20 bg-black/95 z-[99] border-b border-white/10 flex items-center justify-between px-4 sm:px-6 md:px-12 text-white">
        <div
          className="flex items-center gap-1.5 cursor-pointer"
          onClick={handleEntranceTrigger}
        >
          {settings?.brandLogo ? (
            <img
              src={settings.brandLogo}
              alt="Brand Logo"
              className="h-7 w-auto object-contain"
            />
          ) : (
            <span className="font-sans font-extrabold text-white text-lg md:text-2xl tracking-tight flex items-center">
              Viyie<span className="text-[10px] font-semibold align-super ml-0.5 text-red-500">®</span>
            </span>
          )}
        </div>

        {/* Center menu */}
        <div className="hidden md:flex items-center gap-8 text-[13px] font-medium text-white/70">
          <button
            onClick={handleScrollToDevices}
            className="flex items-center gap-1 hover:text-red-500 cursor-pointer transition-colors"
          >
            {t("platform")}
          </button>
          <button
            onClick={handleNavigateToSubscription}
            className="hover:text-red-500 cursor-pointer transition-colors"
          >
            {t("pricing")}
          </button>
          <button
            onClick={handleNavigateToLogin}
            className="flex items-center gap-1 hover:text-red-500 cursor-pointer transition-colors"
          >
            {t("login")}
          </button>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 md:gap-5 text-[13px] font-medium">
          <LanguageSwitcher />

          <button
            onClick={handleEntranceTrigger}
            className="text-white/70 hover:text-red-500 transition-colors cursor-pointer px-2 py-1"
          >
            Get Started
          </button>
          <button
            onClick={handleGoogleSignInClick}
            className="px-4 py-2 bg-red-650 hover:bg-red-600 rounded-lg text-white transition-all active:scale-95 cursor-pointer font-medium text-xs whitespace-nowrap shadow-[0_4px_12px_rgba(239,30,39,0.25)] border-none shrink-0"
          >
            {user ? "Enter App" : "Sign in"}
          </button>
        </div>
      </header>

      {/* 2. ROTATING TRAILER ULTRA-MODERN HERO SCENERY */}
      <section className="relative w-full h-[58vh] sm:h-[72vh] md:h-[85vh] overflow-hidden bg-black flex flex-col justify-end mt-16 md:mt-20">
        {/* Absolute Trailer Background Node */}
        <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden scale-105 transform translate-z-0">
          {/* Main Active Playback trailer */}
          <iframe
            key={`hero-trailer-${currentTrailer.id}-${currentTrailer.youtubeId}`}
            src={`https://www.youtube.com/embed/${currentTrailer.youtubeId}?autoplay=1&mute=1&controls=0&rel=0&showinfo=0&modestbranding=1&start=30&end=90&loop=1&playlist=${currentTrailer.youtubeId}&enablejsapi=1&iv_load_policy=3&disablekb=1`}
            className="absolute inset-0 w-full h-full border-0 pointer-events-none object-cover aspect-video scale-[1.35]"
            allow="autoplay; encrypted-media"
            title="Active Cinema Showcase"
          />

          {/* Buffering preload backup player underneath (opacity 0) - renders at t >= 50 seconds */}
          {timeElapsed >= 50 && (
            <iframe
              key={`preload-trailer-${preloadedTrailer.id}-${preloadedTrailer.youtubeId}`}
              src={`https://www.youtube.com/embed/${preloadedTrailer.youtubeId}?autoplay=1&mute=1&controls=0&rel=0&showinfo=0&modestbranding=1&start=30&end=90&enablejsapi=1`}
              className="absolute inset-0 w-full h-full border-0 pointer-events-none opacity-0 select-none scale-[1.35] aspect-video"
              allow="autoplay; encrypted-media"
              title="Preloading Cinema Ready Line"
            />
          )}

          {/* Cinematic Vignettes & Red iQIYI lighting overlay */}
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[#0a0505] via-[#0a0505]/40 to-transparent" />
          <div className="absolute inset-0 bg-radial-gradient(ellipse at center, transparent 30%, rgba(10,5,5,0.7) 90%)" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0505] via-[#0a0505]/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#0a0505] to-transparent" />
        </div>

        {/* Floating Scenery Details Overlay */}
        <div className="absolute top-28 sm:top-36 left-4 right-4 md:left-12 z-20 flex flex-col pointer-events-none">
          <span className="text-[9px] w-fit font-normal text-red-500 tracking-widest uppercase bg-red-600/10 px-3 py-1 rounded-full border border-red-500/20 inline-block mb-2">
            Trailer Cinema
          </span>
          <h2 className="text-2xl md:text-5xl font-extrabold text-white uppercase tracking-wider mb-1 font-nexa">
            {currentTrailer.title}
          </h2>
          <div className="flex items-center gap-3 text-[10px] text-white/50 tracking-widest uppercase mb-1">
            <span>{currentTrailer.studio}</span>
            <span>•</span>
            <div className="flex items-center gap-1 text-red-500">
              <Star className="w-3 h-3 fill-current" />
              <span>{currentTrailer.rating}</span>
            </div>
          </div>
          {/* Loop timer visualization */}
          <div className="w-32 sm:w-48 h-1 bg-white/10 rounded-full overflow-hidden mt-2 max-w-sm">
            <div 
              style={{ width: `${(timeElapsed / 60) * 100}%` }} 
              className="h-full bg-red-650 transition-all duration-1000 ease-linear shadow-[0_0_10px_rgba(255,30,39,0.8)]" 
            />
          </div>
          <div className="mt-4 max-w-xl pr-4">
            <h4 className="text-[9px] text-red-500 font-medium uppercase tracking-widest mb-1.5 flex items-center gap-1.5 font-japanese">
              <Sparkles className="w-3 h-3 shrink-0" />
              Synopsis
            </h4>
            <p className="text-xs sm:text-sm text-white/80 leading-relaxed font-normal line-clamp-3">
              {translatedSynopsis || "No synopsis available for this selection."}
            </p>
          </div>
        </div>
      </section>

      {/* 3. "TOP POPULAR" INTERACTIVE 3D PERSPECTIVE COVERFLOW (IMAGE 2 DESIGN EXCELLENCE) */}
      <section className="relative z-30 -mt-24 sm:-mt-40 md:-mt-52 max-w-[2000px] mx-auto overflow-hidden px-4 sm:px-10 lg:px-12 pb-16 pt-8">
        <motion.div 
          variants={staggeredContainer}
          initial="hidden"
          animate={isMounted ? "visible" : "hidden"}
          className="text-center mb-10"
        >
          <motion.div variants={staggeredItem}>
            <span className="text-[10px] text-red-500 font-medium uppercase tracking-widest flex items-center justify-center gap-1.5 mb-1">
              <Sparkles className="w-3 h-3" />
              {t("topPopular")}
            </span>
          </motion.div>
          <motion.h3 
            variants={staggeredItem}
            className="text-2xl sm:text-3xl font-light text-white uppercase tracking-widest font-japanese"
          >
            {t("topPopular")}
          </motion.h3>
          <motion.p 
            variants={staggeredItem}
            className="text-xs text-white/50 tracking-wider font-light mt-1 max-w-md mx-auto"
          >
            {t("topPopularDesc")}
          </motion.p>
        </motion.div>

        {/* 3D Perspective Card Layout Container */}
        <div className="w-full flex flex-col items-center justify-center relative py-12">
          {/* Card Platform */}
          <div className="relative w-full max-w-5xl h-[280px] sm:h-[400px] md:h-[480px] flex items-center justify-center">
            {activeMovies.map((movie, index) => {
              const offset = index - activeCoverflowIndex;
              const absOffset = Math.abs(offset);
              const isActive = index === activeCoverflowIndex;
              const isVisible = absOffset <= 3; // Keep only near ones visible so 20 items looks clean

              // Calculate 3D curves mirroring Image 2 & 3
              // Left cards: slanted to the right (rotateY positive)
              // Right cards: slanted to the left (rotateY negative)
              const rotateY = offset === 0 ? 0 : offset > 0 ? -18 : 18;
              const scale = offset === 0 ? 1.08 : 1 - absOffset * 0.1;
              const zIndex = 100 - absOffset;
              
              // Spacing adjustment (Adapts nicely based on screen width without breaking layouts)
              // We stack them layered with a gentle translateZ depth
              let translateX = 0;
              if (offset !== 0) {
                // Determine horizontal overlap spacing
                translateX = offset * 110; 
              }

              return (
                <div
                  key={movie.id}
                  onClick={() => handleSelectCoverflowIndex(index)}
                  style={{
                    transform: `translateX(${translateX}px) scale(${scale}) rotateY(${rotateY}deg)`,
                    zIndex: zIndex,
                    cursor: "pointer",
                    transformStyle: "preserve-3d",
                    perspective: "1000px",
                    opacity: isVisible ? (isActive ? 1 : 0.6) : 0,
                    pointerEvents: isVisible ? "auto" : "none",
                    visibility: isVisible ? "visible" : "hidden",
                  }}
                  className={`absolute w-[140px] sm:w-[220px] md:w-[260px] aspect-[2/3] rounded-2xl overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] shadow-[0_20px_50px_rgba(0,0,0,0.8)] border ${
                    isActive 
                      ? "border-red-500/50 shadow-[0_0_40px_rgba(255,30,39,0.35)]" 
                      : "border-white/10"
                  }`}
                >
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    className="w-full h-full object-cover select-none pointer-events-none"
                    referrerPolicy="no-referrer"
                  />

                  {/* Backdrop Gradient shading */}
                  <div className={`absolute inset-0 bg-gradient-to-t ${
                    isActive 
                      ? "from-black via-black/30 to-transparent" 
                      : "from-black/90 to-black/25"
                  }`} />

                  {/* Rating Badge at bottom right of center card */}
                  {isActive && (
                    <div className="absolute top-3 right-3 bg-[#e11d48] text-white text-[8px] sm:text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                      <Star className="w-2 sm:w-2.5 h-2 sm:h-2.5 fill-current" />
                      <span>{movie.rating}</span>
                    </div>
                  )}

                  {/* Title and details at bottom left of active card */}
                  {isActive && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute bottom-4 sm:bottom-6 left-3 sm:left-5 text-left z-20 pointer-events-none max-w-[85%]"
                    >
                      <h4 className="text-xs sm:text-lg font-medium text-white uppercase tracking-wider truncate drop-shadow-md font-japanese">
                        {movie.title}
                      </h4>
                      <p className="text-[8px] sm:text-[10px] text-white/60 tracking-wider uppercase font-medium mt-0.5">
                        {movie.type}
                      </p>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Left / Right Arrow Circle Controls & Dots Navigation (Image 2 style) */}
          <div className="flex flex-col items-center gap-6 mt-4 sm:mt-12 z-40 relative">
            {/* Arrow circular switcher */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleSelectCoverflowIndex((activeCoverflowIndex - 1 + activeMovies.length) % activeMovies.length)}
                className="w-10 h-10 rounded-full border border-white/20 bg-black/60 backdrop-blur-md flex items-center justify-center hover:border-red-500 hover:text-red-500 text-white/75 transition-all active:scale-95 cursor-pointer shadow-md"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => handleSelectCoverflowIndex((activeCoverflowIndex + 1) % activeMovies.length)}
                className="w-10 h-10 rounded-full border border-white/20 bg-black/60 backdrop-blur-md flex items-center justify-center hover:border-red-500 hover:text-red-500 text-white/75 transition-all active:scale-95 cursor-pointer shadow-md"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Dots navigation indicator with center active pill wrapper */}
            <div className="flex items-center gap-2 max-w-full overflow-x-auto py-1 px-4 scrollbar-thin">
              {activeMovies.map((_, idx) => {
                const isActive = idx === activeCoverflowIndex;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectCoverflowIndex(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 shrink-0 ${
                      isActive 
                        ? "w-8 bg-red-600 shadow-[0_0_8px_rgba(255,30,39,0.8)]" 
                        : "w-2 bg-white/20 hover:bg-white/40"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 4. DYNAMICAL PRECISE BANNER CONTAINER (DOWN_DEVICE) */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={revealScale}
        className="px-4 sm:px-8 md:px-12 py-8 max-w-7xl mx-auto mt-2 md:mt-2 relative z-10"
      >
        <div className="relative rounded-3xl overflow-hidden border border-red-500/10 shadow-[0_30px_70px_rgba(0,0,0,0.9)] bg-[#0f0a0a] group transition-all duration-300">
          {/* Main Visual Image aligned from end to end */}
          <div className="w-full relative">
            <img
              src={IMAGES.DOWN_DEVICE}
              alt="Viyie Premium Banner"
              className="w-full h-auto object-contain relative pointer-events-none select-none"
              referrerPolicy="no-referrer"
            />
            {/* Soft bottom vignette border to blend the background */}
            <div className="absolute inset-x-0 bottom-0 h-24 md:h-32 bg-gradient-to-t from-[#0f0a0a] to-transparent pointer-events-none" />

            {/* MOBILE ONLY: Buttons inside the image bottom left corner */}
            <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-10 flex md:hidden flex-wrap gap-2 items-center">
              <button
                onClick={handleEntranceTrigger}
                className="h-8 px-3 bg-white text-black hover:bg-slate-100 flex items-center gap-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Globe className="w-3 h-3 shrink-0 text-red-600" />
                <span>{language === "id" ? "Situs Web" : "Website"}</span>
              </button>
              <button
                onClick={handleInstallAppClick}
                className="h-8 px-3 bg-neutral-900 hover:bg-neutral-800 text-white border border-white/10 flex items-center gap-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
              >
                <Download className="w-3 h-3 shrink-0 text-red-500" />
                <span>{language === "id" ? "Pasang Aplikasi" : "Install App"}</span>
              </button>
            </div>

            {/* DESKTOP ONLY: Interactive Floating Action Portal */}
            <div className="hidden md:flex absolute bottom-8 left-8 z-10 max-w-xl bg-black/70 backdrop-blur-xl p-6 rounded-2xl border border-red-500/10 shadow-2xl flex-col gap-4 text-left">
              <div>
                <span className="text-[10px] font-normal text-red-500 tracking-wider uppercase bg-red-600/10 px-2.5 py-1 rounded-full border border-red-500/20 inline-block mb-2">
                  {t("unifiedStreamSystem")}
                </span>
                <h3 className="text-lg font-light text-white leading-tight uppercase tracking-wider font-japanese">
                  {t("seamlessInteractiveCinema")}
                </h3>
                <p className="text-[11px] text-white/50 leading-relaxed max-w-sm mt-1 font-normal">
                  {language === "id" 
                    ? "Hubungkan menggunakan profil pengguna pusat Anda untuk menyinkronkan rangkaian episode, tolok ukur kecepatan, dan terjemahan personalisasi secara instan." 
                    : "Connect using your central user profile to synchronize sequences of episodes, speed benchmarks, and personalized translations instantly."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5 items-center">
                <button
                  onClick={handleEntranceTrigger}
                  className="h-10 px-5 bg-white text-black hover:bg-slate-100 flex items-center gap-2 rounded-xl text-xs font-medium uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5 shrink-0 text-red-600" />
                  <span>{language === "id" ? "Jelajahi Web" : "Browse Web"}</span>
                </button>
                <button
                  onClick={handleInstallAppClick}
                  className="h-10 px-5 bg-neutral-950 hover:bg-neutral-900 text-white border border-white/10 flex items-center gap-2 rounded-xl text-xs font-normal uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 shrink-0 text-red-500" />
                  <span>{language === "id" ? "Dapatkan Aplikasi" : "Get App"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* MOBILE ONLY: Text below the image */}
          <div className="flex md:hidden flex-col gap-2 p-4 pt-1 sm:p-5 text-left">
            <span className="text-[10px] w-fit font-medium text-red-500 tracking-wider uppercase bg-red-600/10 px-2.5 py-1 rounded-full border border-red-500/20 inline-block mb-0.5">
              {t("secureStreamHub")}
            </span>
            <h3 className="text-sm sm:text-base font-normal text-white leading-tight uppercase tracking-wide font-japanese">
              {t("secureSync")}
            </h3>
            <p className="text-[11px] text-white/50 leading-relaxed font-normal">
              {t("secureSyncDesc")}
            </p>
          </div>
        </div>
      </motion.section>

      {/* 5. PREMIUM STREAMING FEATURES DISPLAY */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={revealUp}
        className="px-6 sm:px-12 py-10 max-w-7xl mx-auto text-left relative z-10"
      >
        <div className="mb-8 text-center md:text-left">
          <span className="text-[10px] font-medium text-red-500 uppercase tracking-widest bg-red-600/10 px-3.5 py-1.5 rounded-full border border-red-500/20 inline-block">
            {language === "id" ? "Fitur Premium" : "Premium Features"}
          </span>
          <h3 className="text-2xl font-light text-white uppercase tracking-wider mt-3 font-japanese">
            {language === "id" ? "Sistem Pemutaran Generasi Berikutnya" : "Next-Generation Streaming Features"}
          </h3>
          <p className="text-xs text-white/50 max-w-xl mt-1 font-normal leading-relaxed">
            {language === "id" 
              ? "Jelajahi berbagai sistem yang dirancang untuk meningkatkan pengalaman menonton Anda tanpa hambatan." 
              : "Explore the state-of-the-art features designed to elevate your cinematic experience with zero interruptions."}
          </p>
        </div>

        {/* Features bento collection showcase under budget constraint */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {translatedFeatures.map((feat, idx) => {
            const IconComponent = feat.icon;
            return (
              <motion.div 
                key={feat.name}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  visible: { 
                    opacity: 1, 
                    y: 0, 
                    transition: { duration: 0.6, delay: idx * 0.08, ease: "easeOut" } 
                  }
                }}
                className="p-5 rounded-2xl bg-[#110808] border border-red-500/10 hover:border-red-500/30 transition-all hover:-translate-y-1 group flex flex-col justify-between min-h-[120px]"
              >
                <div className="w-8 h-8 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white text-red-500 transition-colors">
                  <IconComponent className="w-4 h-4" />
                </div>
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wide font-japanese">
                    {feat.name}
                  </h4>
                  <p className="text-[10px] text-white/40 font-normal leading-normal mt-1">
                    {feat.desc}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* 6. HARDWARE-ACCELERATED DUAL AUTO-SCROLL POSTER MARQUEE (Not clickable) */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={revealUp}
        className="py-12 bg-[#0c0606] border-y border-red-500/5 relative overflow-hidden select-none pointer-events-none"
      >
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#0a0505] to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#0a0505] to-transparent z-10 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 mb-4">
          <p className="text-[10px] sm:text-xs font-medium text-red-500 uppercase tracking-widest text-center sm:text-left">
            {language === "id" ? "Katalog Aktif" : "Active Grid"}
          </p>
          <h2 className="text-xl sm:text-2xl font-light text-white tracking-wider uppercase text-center sm:text-left font-japanese">
            {language === "id" ? "Koleksi Cuplikan Tak Terbatas" : "Endless Movie Showcase"}
          </h2>
        </div>

        {/* Marquee Container */}
        <div className="flex flex-col gap-5 w-full overflow-hidden relative">
          {posters.length === 0 ? (
            <div className="flex flex-wrap md:flex-nowrap justify-center items-center gap-4 px-6 py-4 w-full max-w-7xl mx-auto">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="shimmer w-full md:w-[220px]">
                  <div className="wrapper">
                    <div className="image-card animate"></div>
                    <div className="stroke animate title"></div>
                    <div className="stroke animate link"></div>
                    <div className="stroke animate description"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Row 1: Leftward slider */}
              <div className="flex w-[200%] gap-4 relative">
                <div className="flex gap-4 animate-marquee-left whitespace-nowrap">
                  {rowLeft.map((url, index) => (
                    <div
                      key={`marq1-${index}`}
                      className="w-44 sm:w-64 lg:w-72 aspect-[2/3] rounded-3xl overflow-hidden border border-white/5 shadow-[0_15px_40px_rgba(0,0,0,0.6)] bg-neutral-900 shrink-0 inline-block"
                    >
                      <img
                        src={url}
                        alt="Show Poster"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 2: Rightward slider */}
              <div className="flex w-[200%] gap-4 relative">
                <div className="flex gap-4 animate-marquee-right whitespace-nowrap">
                  {rowRight.map((url, index) => (
                    <div
                      key={`marq2-${index}`}
                      className="w-44 sm:w-64 lg:w-72 aspect-[2/3] rounded-3xl overflow-hidden border border-white/5 shadow-[0_15px_40px_rgba(0,0,0,0.6)] bg-neutral-900 shrink-0 inline-block"
                    >
                      <img
                        src={url}
                        alt="Show Poster"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </motion.section>

      {/* 7. PREMIUM BANNER_2D DEVELOPER SHOWCASE */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={revealScale}
        className="px-6 sm:px-12 py-16 max-w-7xl mx-auto text-left relative z-10"
      >
        <div className="mb-10 text-center sm:text-left">
          <p className="text-[10px] sm:text-xs font-medium text-red-500 uppercase tracking-widest bg-red-650/10 px-3.5 py-1.5 rounded-full border border-red-500/20 inline-block">
            {language === "id" ? "Platform Inti Sinema" : "Cinema Core Platform"}
          </p>
          <h2 className="text-2xl sm:text-3xl font-light text-white tracking-wider uppercase mt-3 font-japanese">
            {language === "id" ? "Mesin Streaming Sinema Terpadu" : "Unified Cinema Streaming Engine"}
          </h2>
          <p className="text-xs text-white/50 max-w-xl mt-2 font-normal leading-relaxed">
            {language === "id" 
              ? "Sistem presentasi konten mutakhir kami dioptimalkan pelayanaan pemutaran cepat, transisi kualitas lancar, dan sinkronisasi tontonan multi-bahasa secara instan." 
              : "Our state-of-the-art content presentation system is optimized for fast decoding, seamless quality transition, and synchronized multi-language playback layers."}
          </p>
        </div>

        <div className="relative rounded-3xl overflow-hidden border border-red-500/10 shadow-[0_25px_60px_rgba(255,30,39,0.06)] bg-black group transition-all duration-300">
          <img
            src={IMAGES.BANNER_2D}
            alt="Viyie Premium Cinema Stream Experience"
            className="w-full h-auto object-cover relative pointer-events-none select-none"
            referrerPolicy="no-referrer"
          />
          {/* Bottom vignette to smoothly integrate with the dark environment */}
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black via-black/20 to-transparent pointer-events-none" />
        </div>
      </motion.section>

      {/* 8. USER UNIQUE FEATURE GRIDS (Featuring Devices, USP) */}
      <section id="available-devices" className="px-6 sm:px-12 py-12 max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          {/* Column Left: High quality graphic */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={revealLeft}
            className="relative rounded-3xl overflow-hidden border border-white/5 bg-black/55 p-6 flex flex-col items-center justify-center"
          >
            <div className="absolute inset-0 bg-radial-gradient(from center, rgba(239, 68, 68, 0.05) 20%, transparent 80%) pointer-events-none" />
            <img
              src={IMAGES.BANNER_3D}
              alt="Multi-screen integration catalog"
              className="w-4/5 h-auto object-contain pointer-events-none select-none drop-shadow-[0_15px_30px_rgba(0,0,0,0.5)]"
              referrerPolicy="no-referrer"
            />
          </motion.div>

          {/* Column Right: Custom support bullet panels */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={revealRight}
            className="space-y-6 text-left"
          >
            <div>
              <span className="text-[10px] font-normal text-red-500 tracking-widest uppercase">
                {language === "id" ? "Dukungan Perangkat Keras Serbaguna" : "Versatile Hardware Support"}
              </span>
              <h3 className="text-xl sm:text-2xl font-light text-white uppercase tracking-wider mt-1 font-japanese">
                {language === "id" ? "Putar di perangkat favorit Anda" : "Stream on your favorite devices"}
              </h3>
              <p className="text-xs text-white/50 leading-relaxed font-normal mt-2">
                {language === "id" 
                  ? "Saksikan semesta hiburan penuh Viyie di televisi, laptop desktop, tablet berkinerja tinggi, maupun lingkungan ponsel pintar peluncur." 
                  : "Launch the Viyie streaming universe across televisions, desktop laptops, high-performance tablets, and mobile operating environments."}
              </p>
            </div>

            {/* Device Support Icons Grid with provided assets */}
            <div className="grid grid-cols-3 gap-4">
              {/* Computer support */}
              <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl flex flex-col items-center text-center">
                <img
                  src={IMAGES.COMPUTER_ICON}
                  alt="Computer"
                  className="w-12 h-12 object-contain mb-2 pointer-events-none select-none"
                  referrerPolicy="no-referrer"
                />
                <span className="text-[10px] font-normal text-white uppercase tracking-wider">
                  {language === "id" ? "Desktop" : "Desktop"}
                </span>
              </div>

              {/* Tablet Support */}
              <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl flex flex-col items-center text-center">
                <img
                  src={IMAGES.TABLET_ICON}
                  alt="Tablet"
                  className="w-12 h-12 object-contain mb-2 pointer-events-none select-none"
                  referrerPolicy="no-referrer"
                />
                <span className="text-[10px] font-normal text-white uppercase tracking-wider">
                  Tablet
                </span>
              </div>

              {/* Mobile Support */}
              <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl flex flex-col items-center text-center">
                <img
                  src={IMAGES.MOBILE_ICON}
                  alt="Mobile"
                  className="w-12 h-12 object-contain mb-2 pointer-events-none select-none"
                  referrerPolicy="no-referrer"
                />
                <span className="text-[10px] font-normal text-white uppercase tracking-wider">
                  {language === "id" ? "Ponsel" : "Handheld"}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 9. FAQ COLLAPSIBLE ACCORDION */}
      <section className="px-6 sm:px-12 py-16 max-w-3xl mx-auto relative z-10">
        <div className="mb-10 text-center">
          <p className="text-[10px] sm:text-xs font-medium text-red-500 uppercase tracking-widest">
            {language === "id" ? "Pusat Bantuan" : "Support center"}
          </p>
          <h2 className="text-2xl sm:text-3xl font-light text-white tracking-wider uppercase mt-2 font-japanese">
            {language === "id" ? "Pertanyaan yang Sering Diajukan" : "Frequently Asked Questions"}
          </h2>
        </div>

        <div className="space-y-4">
          {translatedFaqItems.map((item, index) => {
            const isExpanded = expandedFaq === index;
            return (
              <motion.div
                key={index}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  visible: { 
                    opacity: 1, 
                    y: 0, 
                    transition: { duration: 0.6, delay: index * 0.08, ease: "easeOut" } 
                  }
                }}
                className="border border-red-500/5 rounded-2xl overflow-hidden bg-white/[0.01] hover:bg-white/[0.02] transition-colors"
              >
                <button
                  onClick={() => setExpandedFaq(isExpanded ? null : index)}
                  className="w-full h-14 px-6 flex items-center justify-between text-left focus:outline-none transition-colors cursor-pointer"
                >
                  <span className="text-xs sm:text-sm font-semibold text-white/90 uppercase tracking-wider">
                    {item.q}
                  </span>
                  <ChevronRight
                    className={`w-4 h-4 text-white/50 transition-transform duration-300 ${isExpanded ? "rotate-90 text-red-500" : ""}`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <div className="px-6 pb-6 text-xs sm:text-sm text-white/60 leading-relaxed font-normal border-t border-white/5 pt-4">
                        {item.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* 10. SECURE BRAND FOOTER */}
      <motion.footer 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={revealUp}
        className="px-6 sm:px-12 pt-16 border-t border-white/5 max-w-7xl mx-auto text-center relative z-10"
      >
        <div className="flex flex-col items-center gap-6">
          <img
            src={
              settings?.brandLogo ||
              BRAND_LOGO_URL ||
              "https://www.image2url.com/r2/default/images/1779795362416-611ba175-203c-4e05-a418-f114f49f612e.png"
            }
            alt="Brand Logo"
            className="h-10 w-auto object-contain"
          />
          <p className="text-[11px] text-white/30 max-w-md leading-relaxed uppercase tracking-wider font-normal">
            {language === "id" 
              ? "Dengan mengakses mesin penstriman ini, Anda menyetujui penerimaan struktur indeks data aman dan sinkronisasi tontonan. Semua aset platform dikompilasi secara dinamis." 
              : "By accessing this stream engine, you acknowledge acceptance of secure data indexing and synchronization structures. All platform assets are compiled dynamically."}
          </p>

          <div className="flex flex-wrap gap-4 items-center justify-center text-[10px] text-white/40 font-medium uppercase tracking-widest border-y border-white/5 py-3 w-full max-w-lg">
            <span
              className="cursor-pointer hover:text-red-500 transition-colors"
              onClick={handleEntranceTrigger}
            >
              {language === "id" ? "Gerbang Situs Web" : "Website Gateway"}
            </span>
            <span>•</span>
            <span
              className="cursor-pointer hover:text-red-500 transition-colors"
              onClick={handleInstallAppClick}
            >
              {language === "id" ? "Pasang Paket Layanan" : "Install Service Pack"}
            </span>
            <span>•</span>
            <span
              className="cursor-pointer hover:text-red-500 transition-colors"
              onClick={handleEntranceTrigger}
            >
              {language === "id" ? "Gabung Komunitas" : "Join Community"}
            </span>
          </div>

          <p className="text-[10px] text-white/20 uppercase tracking-widest mt-4">
            {settings?.footerText ||
              `© ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.`}
          </p>
        </div>
      </motion.footer>

      {/* INDONESIAN VPN / LOCATION DETECTED POPUP */}
      <AnimatePresence>
        {showVpnNotification && (
          <motion.div
            initial={{ opacity: 0, x: -50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -50, scale: 0.95 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="fixed bottom-6 left-6 z-[2020] max-w-sm w-[calc(100vw-3rem)] md:w-96 bg-black/95 backdrop-blur-2xl border border-red-500/20 rounded-2xl p-4 shadow-[0_12px_40px_rgba(255,30,39,0.25)] flex flex-col gap-3 text-left"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex gap-2.5 text-red-500">
                <MapPin className="w-5 h-5 shrink-0 animate-bounce mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-[11px] font-medium uppercase tracking-wider text-white">
                    Location Suggestion / Saran Lokasi
                  </h4>
                  <p className="text-xs text-white/80 leading-relaxed font-normal">
                    We detected that you are visiting from Indonesia. Would you like to switch the language to Indonesian?
                  </p>
                  <p className="text-[11px] text-white/50 leading-relaxed italic font-normal">
                    Kami mendeteksi kamu berasal dari Indonesia. Ingin mengubah bahasa ke Bahasa Indonesia?
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  localStorage.setItem("vinet-lang", "en");
                  setShowVpnNotification(false);
                }}
                className="text-white/40 hover:text-white p-1 rounded-full hover:bg-white/5 transition-all cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  localStorage.setItem("vinet-lang", "en");
                  setShowVpnNotification(false);
                }}
                className="flex-1 py-1.5 text-[10px] font-medium uppercase tracking-wider rounded-lg bg-neutral-900 border border-white/5 text-white/60 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Keep English
              </button>
              <button
                onClick={() => {
                  changeLanguage("id");
                  setShowVpnNotification(false);
                }}
                className="flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-lg bg-red-650 hover:bg-red-600 text-white shadow-lg shadow-red-950/50 transition-colors cursor-pointer"
              >
                Bahasa Indonesia
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
