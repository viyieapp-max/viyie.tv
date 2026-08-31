import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Play,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Info,
  ChevronDown,
  Download,
  HelpCircle,
  ExternalLink,
  FileDown,
  Clock,
  X,
  Calendar,
  LayoutList,
  LayoutGrid,
  Search,
  MonitorPlay,
  AlertCircle,
  ShieldCheck,
  Film,
  Heart,
  Plus,
  Check,
  ThumbsUp,
  
} from "lucide-react";
import type { Content as Movie } from "../types";
import { useUserData } from "../hooks/useUserData";
import { checkSpamAndTriggerCooldown } from "../lib/spamProtector";
import { useStudios } from "../hooks/useStudios";
import CommentSection from "./CommentSection";
import { MediaBanner } from "./UIComponents";
import { useSettings } from "../hooks/useSettings";
import { ScrollCarousel } from "./ScrollCarousel";
import { OptimizedImage } from "./UIComponents";
import { ViyiePlayerUI } from "./ViyiePlayer";

import { triggerDefense } from "../utils/security";
import { useIsMobile } from "../hooks/useIsMobile";

import { BRAND_MAIN_SERVER_NAME } from "../constants/brand";
import {
  db,
  doc,
  onSnapshot,
  writeBatch,
  increment,
  updateDoc,
  serverTimestamp,
} from "../lib/firebase";

interface Props {
  movie: Movie;
  allContents: Movie[];
  onSwitchMovie: (m: Movie, epIndex?: number, seasonIndex?: number) => void;
  isAdmin?: boolean;
  onUserClick?: (uid: string) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  latestEpisodes?: any[];
  onLockerToggle?: (isOpen: boolean) => void;
  onShowTrailer?: () => void;
  onNetworkClick?: (name: string) => void;
}

export function IframeSecurityShield({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative w-full h-full"
      id="iframe-security-shield-container"
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }}
    >
      {children}
    </div>
  );
}

/** Convert any YouTube URL to embed URL with safe params */
function toEmbedUrl(raw: string) {
  if (!raw) return raw;
  // ONLY apply YouTube logic if it's a YouTube domain
  const isYT = raw.includes("youtube.com") || raw.includes("youtu.be");
  if (isYT) {
    try {
      let id = "";
      let listId = "";
      let index = "";

      // Handle Playlist first if present
      if (raw.includes("list=")) {
        listId = raw.split("list=")[1].split(/[?&"']/)[0];
      }
      if (raw.includes("index=")) {
        index = raw.split("index=")[1].split(/[?&"']/)[0];
      }

      if (raw.includes("youtu.be/")) {
        id = raw.split("youtu.be/")[1].split(/[?&"']/)[0];
      } else if (raw.includes("watch?v=")) {
        id = raw.split("watch?v=")[1].split(/[?&"']/)[0];
      } else if (raw.includes("/embed/")) {
        id = raw.split("/embed/")[1].split(/[?&"']/)[0];
      } else if (raw.includes("/shorts/")) {
        id = raw.split("/shorts/")[1].split(/[?&"']/)[0];
      }

      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : "https://www.youtube.com";

      // If it's a playlist link without a specific video, use the videoseries embed
      if (listId && !id) {
        let basePlaylistUrl = `https://www.youtube.com/embed/videoseries?list=${listId}&autoplay=1&rel=0&modestbranding=1&playsinline=1&cc_load_policy=1&hl=id&cc_lang_pref=id&origin=${encodeURIComponent(origin)}`;
        if (index) {
          basePlaylistUrl += `&index=${index}`;
        }
        return basePlaylistUrl;
      }

      // If it has both a video ID and a list ID, YouTube's embed player supports both
      const base = id
        ? `https://www.youtube.com/embed/${id}`
        : `https://www.youtube.com/embed/videoseries`;
      const params = new URLSearchParams({
        autoplay: "1",
        rel: "0",
        modestbranding: "1",
        playsinline: "1",
        cc_load_policy: "1",
        hl: "id",
        cc_lang_pref: "id",
      });
      // If origin exists, always include it for YouTube as it helps with domain-restricted videos
      if (origin) {
        params.append("origin", origin);
      }
      if (listId) params.append("list", listId);
      if (index) params.append("index", index);

      return `${base}?${params.toString()}`;
    } catch {
      return raw;
    }
  }

  // Handle Dailymotion
  if (raw.includes("dailymotion.com") || raw.includes("dai.ly")) {
    let id = "";
    if (raw.includes("geo.dailymotion.com")) {
      if (raw.includes("video=")) {
        id = raw.split("video=")[1].split(/[&?]/)[0];
      } else if (raw.includes("/player/")) {
        id = raw.split("/player/")[1].split(/[.?&]/)[0];
      }
      if (id) {
        return `https://www.dailymotion.com/embed/video/${id}?autoplay=1&mute=0`;
      }
      return raw;
    }
    if (raw.includes("/video/")) {
      id = raw.split("/video/")[1].split(/[?&"']/)[0];
    } else if (raw.includes("dai.ly/")) {
      id = raw.split("dai.ly/")[1].split(/[?&"']/)[0];
    }
    if (id) {
      return `https://www.dailymotion.com/embed/video/${id}?autoplay=1&mute=0`;
    }
  }

  // Handle Google Drive / Remote Drive
  if (raw.includes("drive.google.com") || raw.includes("docs.google.com")) {
    const driveRegex = /(?:\/d\/|id=)([\w\-]{25,50})/i;
    const match = raw.match(driveRegex);
    if (match && match[1]) {
      return `https://drive.google.com/file/d/${match[1]}/preview`;
    }
  }

  return raw;
}

const b64d = (str: string): string => {
  if (typeof window === "undefined") return "";
  try {
    return window.atob(str);
  } catch (e) {
    return "";
  }
};

function getAutoServerName(url: string, defaultName: string) {
  if (!url) return defaultName;
  const lower = url.toLowerCase();
  if (
    lower.includes("youtube.com") ||
    lower.includes("youtu.be") ||
    lower.includes(b64d("eW91dHViZS5jb20=")) ||
    lower.includes(b64d("eW91dHUuYmU="))
  )
    return "YouTube";
  if (
    lower.includes("hydrax") ||
    lower.includes("short.icu") ||
    lower.includes("short.ink") ||
    lower.includes("abyssplayer.com") ||
    lower.includes("hydx") ||
    lower.includes(b64d("aHlkcmF4")) ||
    lower.includes(b64d("c2hvcnQuaWN1")) ||
    lower.includes(b64d("c2hvcnQuaW5r")) ||
    lower.includes(b64d("YWJ5c3NwbGF5ZXIuY29t")) ||
    lower.includes(b64d("aHlkeA=="))
  )
    return "Hydrax";
  if (
    lower.includes("turbovip") ||
    lower.includes("turbovid") ||
    lower.includes("emturbovid") ||
    lower.includes(b64d("dHVyYm92aXA=")) ||
    lower.includes(b64d("dHVyYm92aWQ=")) ||
    lower.includes(b64d("ZW10dXJib3ZpZA=="))
  )
    return "TurboVIP";
  if (
    lower.includes("dailymotion.com") ||
    lower.includes("dailymotion") ||
    lower.includes("geo.dailymotion.com") ||
    lower.includes(b64d("ZGFpbHltb3Rpb24uY29t"))
  )
    return "Dailymotion";
  if (
    lower.includes("drive.google.com") ||
    lower.includes("docs.google.com") ||
    lower.includes(b64d("ZHJpdmUuZ29vZ2xlLmNvbQ==")) ||
    lower.includes(b64d("ZG9jcy5nb29nbGUuY29t"))
  )
    return "Remote Drive";
  return defaultName;
}

function getYouTubeId(raw: string) {
  if (!raw) return null;
  if (raw.includes("videoseries")) return null;
  try {
    let id = "";
    if (raw.includes("v=")) {
      id = raw.split("v=")[1].split(/[&?]/)[0];
    } else if (raw.includes("youtu.be/")) {
      id = raw.split("youtu.be/")[1].split(/[&?]/)[0];
    } else if (raw.includes("/embed/")) {
      id = raw.split("/embed/")[1].split(/[&?]/)[0];
    } else if (raw.includes("/shorts/")) {
      id = raw.split("/shorts/")[1].split(/[&?]/)[0];
    }

    if (id && id !== "videoseries" && id.length > 2) return id;
  } catch {}
  return null;
}

function getNetworkLogo(name: string): string | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();

  const specificMap: Record<string, string> = {
    netflix: "https://cdn.corenexis.com/files/c/1361972720.png",
    "hbo max": "https://cdn.corenexis.com/files/c/5163285720.png",
    max: "https://cdn.corenexis.com/files/c/5163285720.png",
    hbo: "https://cdn.corenexis.com/files/c/5163285720.png",
    "disney+":
      "https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg",
    disneyplus:
      "https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg",
    disney:
      "https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg",
    "prime video": "https://cdn.corenexis.com/files/c/3582936720.png",
    "amazon prime": "https://cdn.corenexis.com/files/c/3582936720.png",
    "apple tv+":
      "https://upload.wikimedia.org/wikipedia/commons/2/28/Apple_TV_Plus_Logo.svg",
    "apple tv":
      "https://upload.wikimedia.org/wikipedia/commons/2/28/Apple_TV_Plus_Logo.svg",
    hulu: "https://cdn.corenexis.com/files/c/3767345720.png",
    iqiyi: "https://cdn.corenexis.com/files/c/4524968720.png",
    viu: "https://cdn.corenexis.com/files/c/3315581720.png",
    crunchyroll: "https://cdn.corenexis.com/files/c/1541131720.png",
    bilibili: "https://cdn.corenexis.com/files/c/9733599720.png",
  };

  if (specificMap[n]) {
    return specificMap[n];
  }

  // Fallback to clearbit
  const map: Record<string, string> = {
    vidio: "vidio.com",
    youtube: "youtube.com",
    viki: "viki.com",
    wetv: "wetv.vip",
    we: "wetv.vip",
    peacock: "peacocktv.com",
    paramount: "paramountplus.com",
    "paramount+": "paramountplus.com",
  };

  if (map[n]) {
    return `https://logo.clearbit.com/${map[n]}`;
  }

  // Fallback icon horse
  return `https://icon.horse/icon/${n.replace(/[^a-z0-9]/gi, "")}.com`;
}

const parseCustomSubtitles = (input: string | any): { lang: string; url: string; offset?: number }[] => {
  if (!input) return [];
  if (typeof input !== "string") {
    if (Array.isArray(input)) {
      return input.map((s: any) => ({
        lang: s.lang || s.name || "Default",
        url: s.url || "",
        offset: s.offset !== undefined ? Number(s.offset) : undefined
      }));
    }
    return [];
  }

  const trimmed = input.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((s: any) => ({
          lang: s.name || s.lang || "Default",
          url: s.url || "",
          offset: s.offset !== undefined ? Number(s.offset) : undefined
        }));
      }
    } catch (e) {
      console.warn("Failed to parse custom subtitles JSON:", e);
    }
  }

  return [{ lang: "Default", url: trimmed }];
};

export default function StreamingPage({
  movie,
  allContents,
  onSwitchMovie,
  isAdmin,
  onUserClick,
  onPlayStateChange,
  latestEpisodes = [],
  initialEpisode = 0,
  initialSeason = 0,
  onLockerToggle,
  onShowTrailer,
  onNetworkClick,
}: Props & { initialEpisode?: number; initialSeason?: number }) {
  const { settings } = useSettings();
  const { studios } = useStudios();

  const matchingStudios = useMemo(() => {
    if (!movie.studio) return [];

    const trimmedStudio = movie.studio.trim();
    if (
      trimmedStudio.startsWith("http://") ||
      trimmedStudio.startsWith("https://") ||
      trimmedStudio.includes("corenexis.com")
    ) {
      return [
        {
          name: "Studio",
          logoUrl: trimmedStudio,
        },
      ];
    }

    // Split by comma in case of multiple studios
    const parts = movie.studio
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const results: any[] = [];

    for (const part of parts) {
      const lower = part.toLowerCase();
      let match = studios.find((s) => s.name.toLowerCase() === lower);
      if (!match) {
        match = studios.find(
          (s) =>
            s.name.toLowerCase().includes(lower) ||
            lower.includes(s.name.toLowerCase()),
        );
      }
      if (match && !results.some((r) => r.name === match!.name)) {
        results.push(match);
      }
    }

    return results;
  }, [movie.studio, studios]);

  const {
    user,
    addHistory,
    history,
    favorites,
    myList,
    isFavorite,
    isInMyList,
    toggleFavorite,
    toggleMyList,
    toast,
    openAuth,
  } = useUserData();

  const isFav = isFavorite(movie.id);
  const inMyList = isInMyList(movie.id);

  const isPremiumUser = Boolean(
    (user?.tiers || [user?.tier || "regular"]).includes("viyie_plus") ||
    user?.tier === "viyie_plus",
  );

  const openSmartLink = () => {
    if (isPremiumUser) return; // Completely block smartlink ads for Viyie+
    const links = [
      "https://www.effectivecpmnetwork.com/nciu6tec?key=84e310d8d0ff89bd37560b18aca34461",
      "https://omg10.com/4/11064819",
    ];
    const selected = links[Math.floor(Math.random() * links.length)];
    window.open(selected, "_blank");
  };

  const formattedDate = useMemo(() => {
    if (!movie.releaseDate) return movie.year;
    const d = new Date(movie.releaseDate);
    if (isNaN(d.getTime())) return movie.year;
    const day = d.getDate().toString().padStart(2, "0");
    const month = d.toLocaleDateString("en-US", { month: "long" });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  }, [movie.releaseDate, movie.year]);

  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const [activeVideoAdUrl, setActiveVideoAdUrl] = useState<string | null>(null);
  const [activeVideoAdLink, setActiveVideoAdLink] = useState<string | null>(
    null,
  );
  const [videoAdCanSkip, setVideoAdCanSkip] = useState(false);
  const [videoAdCountdown, setVideoAdCountdown] = useState(3);
  const [hasEvaluatedVideoAd, setHasEvaluatedVideoAd] = useState(false);

  const [showInitialAdPopup, setShowInitialAdPopup] = useState(false);
  const [showPeriodicOverlay, setShowPeriodicOverlay] = useState(false);
  const [showNetworkWarning, setShowNetworkWarning] = useState(false);

  const [devBlocked, setDevBlocked] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      sessionStorage.getItem(`viyie_dev_block_${movie.id}`) === "true" ||
      sessionStorage.getItem("viyie_global_dev_block") === "true" ||
      Boolean((window as any).__VIYIE_COMPROMISED)
    );
  });

  useEffect(() => {
    (window as any).__VIYIE_STREAMING_ACTIVE = true;

    const handleCompromised = () => {
      try {
        sessionStorage.setItem(`viyie_dev_block_${movie.id}`, "true");
        sessionStorage.setItem("viyie_global_dev_block", "true");
      } catch (e) {}
      setDevBlocked(true);
    };

    window.addEventListener("viyieCompromised", handleCompromised);
    if ((window as any).__VIYIE_COMPROMISED) {
      handleCompromised();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const keyLower = e.key ? e.key.toLowerCase() : "";
      const isF12 = e.key === "F12" || e.keyCode === 123 || e.code === "F12";

      const isCtrlShiftI =
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (keyLower === "i" || e.keyCode === 73 || e.code === "KeyI");
      const isCtrlShiftJ =
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (keyLower === "j" || e.keyCode === 74 || e.code === "KeyJ");
      const isCtrlShiftC =
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (keyLower === "c" || e.keyCode === 67 || e.code === "KeyC");

      const isMacDevTools =
        e.metaKey &&
        e.altKey &&
        (keyLower === "i" ||
          keyLower === "j" ||
          keyLower === "c" ||
          e.keyCode === 73 ||
          e.keyCode === 74 ||
          e.keyCode === 67);

      const isCtrlU =
        (e.ctrlKey || e.metaKey) &&
        (keyLower === "u" || e.keyCode === 85 || e.code === "KeyU");
      const isCtrlS =
        (e.ctrlKey || e.metaKey) &&
        (keyLower === "s" || e.keyCode === 83 || e.code === "KeyS");

      if (
        isF12 ||
        isCtrlShiftI ||
        isCtrlShiftJ ||
        isCtrlShiftC ||
        isMacDevTools ||
        isCtrlU ||
        isCtrlS
      ) {
        e.preventDefault();
        e.stopPropagation();
        try {
          sessionStorage.setItem(`viyie_dev_block_${movie.id}`, "true");
          sessionStorage.setItem("viyie_global_dev_block", "true");
        } catch (err) {}
        setDevBlocked(true);
        triggerDefense();
        return false;
      }
    };

    // Set a small interval to detect devtools opening via size diff if window is not max
    const devToolsCheck = setInterval(() => {
      const widthDiff = window.outerWidth - window.innerWidth > 160;
      const heightDiff = window.outerHeight - window.innerHeight > 160;
      if (widthDiff || heightDiff) {
        try {
          sessionStorage.setItem(`viyie_dev_block_${movie.id}`, "true");
          sessionStorage.setItem("viyie_global_dev_block", "true");
        } catch (err) {}
        setDevBlocked(true);
        triggerDefense();
      }
    }, 1000);

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      (window as any).__VIYIE_STREAMING_ACTIVE = false;
      window.removeEventListener("viyieCompromised", handleCompromised);
      window.removeEventListener("keydown", handleKeyDown, true);
      clearInterval(devToolsCheck);
    };
  }, [movie.id]);

  const [activeEpisode, setActiveEpisode] = useState(initialEpisode);
  const [activeSeason, setActiveSeason] = useState(initialSeason);
  const [likesCount, setLikesCount] = useState(movie.likesCount || 0);
  const [hasLiked, setHasLiked] = useState(false);

  // Sync state with props which come from reactive useContent hook
  useEffect(() => {
    setLikesCount(movie.likesCount || 0);
  }, [movie.likesCount]);

  // Real-time listener for current user's like status
  useEffect(() => {
    if (!movie.id || !user) {
      setHasLiked(false);
      return;
    }
    const likeRef = doc(db, "content", String(movie.id), "likes", user.uid);
    const unsub = onSnapshot(likeRef, (snap) => {
      setHasLiked(snap.exists());
    });
    return () => unsub();
  }, [movie.id, user]);

  const handleToggleLike = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user) {
      toast("Login for full access. Do you want to login?", "info", {
        duration: 7000,
        action: {
          label: "LOGIN",
          onClick: openAuth,
        },
      });
      return;
    }

    if (!checkSpamAndTriggerCooldown(toast)) return;

    const batch = writeBatch(db);
    const contentRef = doc(db, "content", String(movie.id));
    const likeRef = doc(db, "content", String(movie.id), "likes", user.uid);

    // Optimistic Update
    const nextHasLiked = !hasLiked;
    const prevLikesCount = likesCount;
    setHasLiked(nextHasLiked);
    setLikesCount((prev) => (nextHasLiked ? prev + 1 : Math.max(0, prev - 1)));

    if (hasLiked) {
      batch.delete(likeRef);
      const now = new Date();
      let y = now.getFullYear();
      let m = now.getMonth();
      if (now.getDate() < 16) {
        m--;
        if (m < 0) {
          m = 11;
          y--;
        }
      }
      batch.update(contentRef, {
        likesCount: increment(-1),
        [`monthlyStats.${y}-${String(m + 1).padStart(2, "0")}-16.likes`]:
          increment(-1),
      });
    } else {
      batch.set(likeRef, { uid: user.uid, createdAt: serverTimestamp() });
      const now = new Date();
      let y = now.getFullYear();
      let m = now.getMonth();
      if (now.getDate() < 16) {
        m--;
        if (m < 0) {
          m = 11;
          y--;
        }
      }
      batch.update(contentRef, {
        likesCount: increment(1),
        [`monthlyStats.${y}-${String(m + 1).padStart(2, "0")}-16.likes`]:
          increment(1),
      });
    }

    try {
      await batch.commit();
    } catch (err) {
      console.error("Error toggling like:", err);
      // Revert optimism on error
      setHasLiked(hasLiked);
      setLikesCount(prevLikesCount);
      toast("Failed to update like status.", "error");
    }
  };
  const [activeServerIndex, setActiveServerIndex] = useState(0);
  const [isPlayingTrailerInPlayer, setIsPlayingTrailerInPlayer] = useState(false);
  
  const [useFailsafeIframe, setUseFailsafeIframe] = useState(() => {
    const saved = localStorage.getItem("viyie_use_failsafe_iframe");
    return saved === "true";
  });

  // Sync state with custom event
  useEffect(() => {
    const handleChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (typeof customEvent.detail === "boolean") {
        setUseFailsafeIframe(customEvent.detail);
      }
    };
    window.addEventListener("viyie_failsafe_iframe_changed", handleChanged);
    return () => {
      window.removeEventListener(
        "viyie_failsafe_iframe_changed",
        handleChanged,
      );
    };
  }, []);

  const toggleFailsafeIframe = (val: boolean) => {
    setUseFailsafeIframe(val);
    localStorage.setItem("viyie_use_failsafe_iframe", val ? "true" : "false");
    window.dispatchEvent(
      new CustomEvent("viyie_failsafe_iframe_changed", { detail: val }),
    );
  };

  const [isStreamStarted, setIsStreamStarted] = useState(true);
  const isThumbnailMode = movie.kind !== "tv" && !isStreamStarted;
  const [isPlayerLoading, setIsPlayerLoading] = useState(true);
  const [isLockerOpen, setIsLockerOpen] = useState(false);
  const [isMobileLockerOpen, setIsMobileLockerOpen] = useState(false);
  const isMobile = useIsMobile(768);
  const [lockerMode, setLockerMode] = useState<"list" | "grid">("list");
  const [showServerTip, setShowServerTip] = useState(false);
  const [showMoreServers, setShowMoreServers] = useState(false);

  useEffect(() => {
    if (isLockerOpen || isMobileLockerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isLockerOpen, isMobileLockerOpen]);

  // Synchronize locker state when transitioning between desktop and mobile viewport sizes
  useEffect(() => {
    if (isLockerOpen && isMobile) {
      setIsLockerOpen(false);
      setIsMobileLockerOpen(true);
    } else if (isMobileLockerOpen && !isMobile) {
      setIsMobileLockerOpen(false);
      setIsLockerOpen(true);
    }
  }, [isMobile, isLockerOpen, isMobileLockerOpen]);

  useEffect(() => {
    // 80% chance to show the tip
    if (Math.random() < 0.8) {
      setShowServerTip(true);
      // Optional: hide after some time
      const timeout = setTimeout(() => setShowServerTip(false), 20000);
      return () => clearTimeout(timeout);
    }
  }, []);

  // Global right-click (contextmenu) and devtools keyboard shortcut protection during streaming
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest(".viyieplayer")) {
        // Allow custom context menu inside Viyie player
        return;
      }
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent F12 key
      if (e.key === "F12") {
        e.preventDefault();
        return;
      }
      // Prevent Ctrl+Shift+I / Ctrl+Shift+C / Ctrl+Shift+J / Ctrl+U
      if (
        (e.ctrlKey || e.metaKey) &&
        ((e.shiftKey &&
          (e.key === "I" ||
            e.key === "i" ||
            e.key === "C" ||
            e.key === "c" ||
            e.key === "J" ||
            e.key === "j")) ||
          e.key === "U" ||
          e.key === "u")
      ) {
        e.preventDefault();
      }
    };

    window.addEventListener("contextmenu", handleContextMenu, {
      capture: true,
    });
    window.addEventListener("keydown", handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu, {
        capture: true,
      });
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, []);

  const isEpisodeSwitchRef = useRef(false);

  const switchEpisode = useCallback(
    (newIdx: number | ((prev: number) => number)) => {
      isEpisodeSwitchRef.current = true;
      setActiveEpisode(newIdx);
      setIsStreamStarted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [],
  );

  useEffect(() => {
    onLockerToggle?.(isLockerOpen || isMobileLockerOpen);
  }, [isLockerOpen, isMobileLockerOpen, onLockerToggle]);

  const recoRef = useRef<HTMLDivElement>(null);
  const [episodeSearch, setEpisodeSearch] = useState("");

  const episodes = useMemo(() => {
    let baseEpisodes = [];
    if (movie.seasons && movie.seasons.length > 0) {
      baseEpisodes =
        movie.seasons[activeSeason]?.episodes ||
        movie.seasons[0].episodes ||
        [];
    } else {
      baseEpisodes = movie.episodes || [];
    }

    let merged = [...baseEpisodes];

    if ((movie.type === "tv" || movie.kind === "tv") && allContents && Array.isArray(allContents)) {
      const subPages = allContents.filter(
        (c) =>
          c.id !== movie.id &&
          (c.syncMainId === movie.id ||
            String(c.id).startsWith(String(movie.id) + "-page")),
      );

      const extractPageNum = (idStr: string) => {
        const match = idStr.match(/-page(\d+)$/);
        return match ? parseInt(match[1], 10) : 9999;
      };

      subPages.sort(
        (a, b) => extractPageNum(String(a.id)) - extractPageNum(String(b.id)),
      );

      subPages.forEach((p) => {
        if (p.episodes && Array.isArray(p.episodes)) {
          merged = merged.concat(p.episodes);
        }
      });
    }

    // Deduplicate all episodes by episode number to solve double sync (e.g. 638-1165 in One Piece)
    const uniqueEpisodes: any[] = [];
    const seenNums = new Set();
    merged.forEach((ep) => {
      if (ep) {
        let num = undefined;
        if (ep.number !== undefined && ep.number !== null && String(ep.number).trim() !== "") {
          num = Number(ep.number);
        }
        if (num !== undefined && !isNaN(num)) {
          if (!seenNums.has(num)) {
            seenNums.add(num);
            uniqueEpisodes.push({ ...ep, number: num });
          }
        } else {
          uniqueEpisodes.push(ep);
        }
      }
    });

    // Sort episodes in ascending order by numeric order to make it neat
    uniqueEpisodes.sort(
      (a, b) => (Number(a.number) || 0) - (Number(b.number) || 0),
    );

    return uniqueEpisodes;
  }, [movie, activeSeason, allContents]);

  const filteredEpisodes = useMemo(() => {
    if (!episodeSearch) return episodes;
    return episodes.filter(
      (ep) =>
        ep &&
        (String(ep.number || "").includes(episodeSearch) ||
          ep.title?.toLowerCase().includes(episodeSearch.toLowerCase())),
    );
  }, [episodes, episodeSearch]);

  const isTrailerPlayback = useMemo(() => {
    return (
      movie.kind === "tv" &&
      episodes[activeEpisode]?.title?.toLowerCase().includes("trailer")
    );
  }, [movie.kind, episodes, activeEpisode]);

  const formattedPlayerDuration = null;

  const rawPrimaryUrl = useMemo(() => {
    if (movie.kind === "tv" && episodes.length > 0) {
      const ep = episodes[activeEpisode];
      return ep?.url || ep?.embedUrl || ep?.streamUrl || "";
    }
    return movie.embedUrl || movie.streamUrl || (movie as any).url || "";
  }, [movie, episodes, activeEpisode]);

  const isPrimaryTrailer = useMemo(() => {
    if (!rawPrimaryUrl) return false;
    const lower = rawPrimaryUrl.toLowerCase();
    return (
      lower.includes("youtube.com") ||
      lower.includes("youtu.be") ||
      lower.includes("youtube-nocookie.com") ||
      (movie.kind !== "tv" && movie.trailerUrl && rawPrimaryUrl === movie.trailerUrl)
    );
  }, [rawPrimaryUrl, movie]);

  // Handle active servers array: either from the episode (for TV) or from the movie
  const rawAlternativeServers = useMemo(() => {
    let rawServers: any[] = [];
    if (movie.kind === "tv" && episodes.length > 0) {
      const activeEp = episodes[activeEpisode];
      rawServers = activeEp?.servers || [];
    } else {
      rawServers = movie.servers || [];
    }

    // Filter out hidden servers, empty URLs, or YouTube links (which represent trailers)
    const filteredVisible = rawServers.filter(
      (sv: any) =>
        sv &&
        sv.visible !== false &&
        sv.embedUrl &&
        sv.embedUrl.trim() !== "" &&
        !sv.embedUrl.toLowerCase().includes("youtube.com") &&
        !sv.embedUrl.toLowerCase().includes("youtu.be") &&
        !sv.embedUrl.toLowerCase().includes("youtube-nocookie.com") &&
        !(sv.name && sv.name.toLowerCase().includes("youtube")) &&
        !(sv.name && sv.name.toLowerCase().includes("trailer")),
    );

    return filteredVisible;
  }, [movie, episodes, activeEpisode]);

  // Resolve the effective primary source and active servers list
  const { effectivePrimaryUrl, effectivePrimaryObj, activeServers } = useMemo(() => {
    // If primary URL is empty or is a trailer, fallback immediately to the first valid alternative server as the Primary Server
    if (!rawPrimaryUrl || isPrimaryTrailer) {
      if (rawAlternativeServers.length > 0) {
        return {
          effectivePrimaryUrl: rawAlternativeServers[0].embedUrl,
          effectivePrimaryObj: rawAlternativeServers[0],
          activeServers: rawAlternativeServers.slice(1),
        };
      } else {
        return {
          effectivePrimaryUrl: rawPrimaryUrl || "",
          effectivePrimaryObj:
            movie.kind === "tv" && episodes.length > 0
              ? episodes[activeEpisode] || episodes[0]
              : movie,
          activeServers: [],
        };
      }
    } else {
      // Primary URL is a valid streaming URL. Deduplicate from rawAlternativeServers if present.
      const deduplicatedServers = rawAlternativeServers.filter(
        (s: any) => s.embedUrl && s.embedUrl !== rawPrimaryUrl,
      );
      return {
        effectivePrimaryUrl: rawPrimaryUrl,
        effectivePrimaryObj:
          movie.kind === "tv" && episodes.length > 0
            ? episodes[activeEpisode] || episodes[0]
            : movie,
        activeServers: deduplicatedServers,
      };
    }
  }, [isPrimaryTrailer, rawPrimaryUrl, rawAlternativeServers, movie, episodes, activeEpisode]);

  const { activeServerUrl, activeServerObj } = useMemo(() => {
    let url = "";
    let obj: any = null;
    if (activeServerIndex > 0 && activeServers[activeServerIndex - 1]) {
      url = activeServers[activeServerIndex - 1].embedUrl; // avoid toEmbedUrl on custom MP4s
      obj = activeServers[activeServerIndex - 1];
    } else {
      url = effectivePrimaryUrl || "";
      obj = effectivePrimaryObj;
    }

    // Auto-detect Google Drive URLs
    const isDriveUrl = url ? /(?:drive|docs)\.google\.com/i.test(url) : false;

    // If it's a custom player or Google Drive URL, don't run through it with toEmbedUrl which adds &autoplay=1 etc to raw files.
    return {
      activeServerUrl:
         isDriveUrl ? url : toEmbedUrl(url || ""),
      activeServerObj: obj,
    };
  }, [effectivePrimaryUrl, effectivePrimaryObj, activeServerIndex, activeServers]);

  const trailerUrlInPlayer = useMemo(() => {
    let url = movie.trailerUrl || movie.embedUrl || "";
    if (!url || (!url.includes("youtube") && !url.includes("youtu.be"))) {
      url = `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(movie.title + " official trailer")}&autoplay=1&mute=0&rel=0&modestbranding=1`;
    }
    return toEmbedUrl(url);
  }, [movie]);

  const streamUrl = isPlayingTrailerInPlayer ? trailerUrlInPlayer : activeServerUrl;

  const [dailymotionSecondsLeft, setDailymotionSecondsLeft] = useState(15);

  const isDailymotionMovie = useMemo(() => {
    return Boolean(
      isStreamStarted &&
      movie.kind !== "tv" &&
      streamUrl &&
      streamUrl.toLowerCase().includes("geo.dailymotion.com"),
    );
  }, [isStreamStarted, movie.kind, streamUrl]);

  useEffect(() => {
    if (isDailymotionMovie) {
      setDailymotionSecondsLeft(15);
      const timer = setInterval(() => {
        setDailymotionSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setDailymotionSecondsLeft(0);
    }
  }, [isDailymotionMovie]);

  const isDriveStream = useMemo(() => {
    if (!streamUrl) return false;
    return (
      /(?:drive|docs)\.google\.com/i.test(streamUrl) ||
      Boolean(activeServerObj?.name?.toLowerCase().includes("drive"))
    );
  }, [streamUrl, activeServerObj]);

  const currentEpisodeDetails = useMemo(() => {
    return movie.kind === "tv" && episodes.length > 0
      ? episodes[activeEpisode]
      : null;
  }, [movie, episodes, activeEpisode]);

  const activePlay1DisplayName = useMemo(() => {
    return (
      currentEpisodeDetails?.play1DisplayName ||
      movie.play1DisplayName ||
      "PLAY1"
    );
  }, [currentEpisodeDetails, movie]);

  const activePlay2DisplayName = useMemo(() => {
    return (
      currentEpisodeDetails?.play2DisplayName ||
      movie.play2DisplayName ||
      "PLAY2"
    );
  }, [currentEpisodeDetails, movie]);

  const activeHidePlay1 = useMemo(() => {
    return currentEpisodeDetails?.hidePlay1 ?? movie.hidePlay1 ?? false;
  }, [currentEpisodeDetails, movie]);

  useEffect(() => {
    if (activeHidePlay1 && useFailsafeIframe) {
      toggleFailsafeIframe(false);
    }
  }, [activeHidePlay1, useFailsafeIframe]);

  const isDailymotionStream = useMemo(() => {
    if (!streamUrl) return false;
    const lower = streamUrl.toLowerCase();
    const lowerName = activeServerObj?.name?.toLowerCase() || "";
    return (
      lower.includes("dailymotion.com") ||
      lower.includes("dai.ly") ||
      lower.includes("geo.dailymotion") ||
      lowerName.includes("dailymotion")
    );
  }, [streamUrl, activeServerObj]);

  const isEmbedPlayerWithOverlay = useMemo(() => {
    if (!streamUrl) return false;
    const lowerUrl = streamUrl.toLowerCase();
    const isDM =
      isDailymotionStream ||
      lowerUrl.includes("dailymotion.com") ||
      lowerUrl.includes("dai.ly") ||
      lowerUrl.includes("geo.dailymotion");
    const isDriveEmbed = isDriveStream && useFailsafeIframe;
    return Boolean(isDM || isDriveEmbed);
  }, [isDailymotionStream, isDriveStream, useFailsafeIframe, streamUrl]);

  // Reset loading when episode or streamUrl changes
  useEffect(() => {
    setIsPlayerLoading(true);
  }, [
    activeEpisode,
    streamUrl,
    isStreamStarted,
  ]);

  useEffect(() => {
    let timer: any;
    if (streamUrl && isStreamStarted && isPlayerLoading) {
      timer = setTimeout(() => {
        setIsPlayerLoading(false);
      }, 6000); // 6 seconds wait, auto-hides loader and activates player
    }
    return () => clearTimeout(timer);
  }, [streamUrl, isStreamStarted, isPlayerLoading]);

  const isYouTube = streamUrl
    ? streamUrl.includes(b64d("eW91dHViZS5jb20=")) ||
      streamUrl.includes(b64d("eW91dHUuYmU="))
    : false;
  const isRemoteVideo = streamUrl ? (
    streamUrl.startsWith('{"type":"remotevideo"') || 
    streamUrl.startsWith('{\n  "type": "remotevideo"') ||
    streamUrl.includes('"type": "remotevideo"') ||
    streamUrl.includes('"type":"remotevideo"')
  ) : false;
  const isRumble = streamUrl ? streamUrl.includes("rumble.com") && !streamUrl.includes(".m3u8") : false;
  const isHydrax = streamUrl
    ? streamUrl.includes(b64d("c2hvcnQuaWN1")) ||
      streamUrl.includes(b64d("c2hvcnQuaW5r")) ||
      streamUrl.includes(b64d("YWJ5c3NwbGF5ZXIuY29t")) ||
      streamUrl.includes(b64d("aHlkcmF4Lm5ldA==")) ||
      streamUrl.includes(b64d("Y2xvdWQuaG93bmV0d29yay54eXo=")) ||
      streamUrl.includes(b64d("cGxheWVyaWZyYW1lLnNicw==")) ||
      streamUrl.includes(b64d("aHlyYXg=")) ||
      streamUrl.includes(b64d("aHlkcmF4"))
    : false;

  const isNativeVideo = useMemo(() => {
    if (!streamUrl) return false;
    const lowerUrl = streamUrl.toLowerCase();
    return (
      lowerUrl.endsWith(".mp4") ||
      lowerUrl.endsWith(".webm") ||
      lowerUrl.endsWith(".ogg") ||
      lowerUrl.includes(".mp4?") ||
      lowerUrl.includes(".webm?") ||
      lowerUrl.includes(".ogg?")
    );
  }, [streamUrl]);

  const isSpecialEmbed =
    !isNativeVideo && !isYouTube && !isHydrax && streamUrl; // Fallback to a highly compatible iframe for ALL other embeds including dailymotion

  const [blockedPlayerConfirm, setBlockedPlayerConfirm] = useState(false);
  const isBlockedProvider = useMemo(() => {
    if (!streamUrl) return false;
    return streamUrl.includes("f16px.com") || streamUrl.includes("f16px.net");
  }, [streamUrl]);

  const activeUseExternalPopup = useMemo(() => {
    if (activeServerIndex > 0 && activeServers[activeServerIndex - 1]) {
      return activeServers[activeServerIndex - 1].useExternalPopup || false;
    }
    return effectivePrimaryObj?.useExternalPopup || false;
  }, [effectivePrimaryObj, activeServerIndex, activeServers]);

  const activeUseExternalTab = useMemo(() => {
    if (activeServerIndex > 0 && activeServers[activeServerIndex - 1]) {
      return activeServers[activeServerIndex - 1].useExternalTab || false;
    }
    return effectivePrimaryObj?.useExternalTab || false;
  }, [effectivePrimaryObj, activeServerIndex, activeServers]);

  const activeUseSandbox = useMemo(() => {
    if (activeServerIndex > 0 && activeServers[activeServerIndex - 1]) {
      return activeServers[activeServerIndex - 1].useSandbox || false;
    }
    return effectivePrimaryObj?.useSandbox || false;
  }, [effectivePrimaryObj, activeServerIndex, activeServers]);

  const playerScale = useMemo(() => {
    if (activeServerIndex > 0 && activeServers[activeServerIndex - 1]) {
      return activeServers[activeServerIndex - 1].playerScale ?? 100;
    }
    return effectivePrimaryObj?.playerScale ?? 100;
  }, [effectivePrimaryObj, activeServerIndex, activeServers]);

  const playerTranslateX = useMemo(() => {
    if (activeServerIndex > 0 && activeServers[activeServerIndex - 1]) {
      return activeServers[activeServerIndex - 1].playerTranslateX ?? 0;
    }
    return effectivePrimaryObj?.playerTranslateX ?? 0;
  }, [effectivePrimaryObj, activeServerIndex, activeServers]);

  const playerTranslateY = useMemo(() => {
    if (activeServerIndex > 0 && activeServers[activeServerIndex - 1]) {
      return activeServers[activeServerIndex - 1].playerTranslateY ?? 0;
    }
    return effectivePrimaryObj?.playerTranslateY ?? 0;
  }, [effectivePrimaryObj, activeServerIndex, activeServers]);

  const currentEp = useMemo(() => {
    return movie.kind === "tv" && episodes && episodes.length > 0 ? episodes[activeEpisode] : null;
  }, [movie, episodes, activeEpisode]);

  const isCustomPlayerActive = useMemo(() => {
    const isM3u8 = streamUrl && (
      streamUrl.toLowerCase().includes('.m3u8') || 
      streamUrl.toLowerCase().includes('proxy-playlist') || 
      streamUrl.toLowerCase().includes('v-stream') || 
      streamUrl.toLowerCase().includes('v-dash') || 
      streamUrl.toLowerCase().includes('.mpd') || 
      streamUrl.toLowerCase().includes('.m3u') ||
      streamUrl.toLowerCase().includes('dynamic-icons.png') ||
      streamUrl.toLowerCase().includes('sprite-sheet.png') ||
      streamUrl.toLowerCase().includes('vendor-polyfills.js')
    );
    if (isM3u8) return true;

    if (activeServerIndex > 0 && activeServers[activeServerIndex - 1]) {
      return activeServers[activeServerIndex - 1].isCustomPlayer || false;
    }
    return effectivePrimaryObj?.isCustomPlayer || false;
  }, [effectivePrimaryObj, activeServerIndex, activeServers, streamUrl]);

  const customPlayerVideoObject = useMemo(() => {
    if (!isCustomPlayerActive || !streamUrl) return null;
    
    let subtitles: { lang: string; url: string; offset?: number }[] = [];
    if (activeServerIndex > 0 && activeServers[activeServerIndex - 1]?.customSubtitle) {
      subtitles = parseCustomSubtitles(activeServers[activeServerIndex - 1].customSubtitle);
    } else if (activeServerIndex === 0 && effectivePrimaryObj?.customSubtitle) {
      subtitles = parseCustomSubtitles(effectivePrimaryObj.customSubtitle);
    } else if (currentEp && currentEp.customSubtitle) {
      subtitles = parseCustomSubtitles(currentEp.customSubtitle);
    } else if (movie.customSubtitle) {
      subtitles = parseCustomSubtitles(movie.customSubtitle);
    } else if (movie.subtitles && Array.isArray(movie.subtitles)) {
      subtitles = movie.subtitles.map((s: any) => ({
        lang: s.lang || s.name || "Default",
        url: s.url || "",
        offset: s.offset !== undefined ? Number(s.offset) : undefined
      }));
    }

    return {
      id: movie.id || "streaming-custom",
      videoUrl: streamUrl,
      title: currentEp 
        ? `${movie.title} - Episode ${currentEp.number}: ${currentEp.title || ""}` 
        : movie.title || "Video Playback",
      posterUrl: movie.poster || "",
      subtitles: subtitles,
    };
  }, [isCustomPlayerActive, streamUrl, movie, currentEp, activeServerIndex, activeServers, effectivePrimaryObj]);

  const handleStartPlayback = (skipAdCheck = false) => {
    // Check if the current source contains "vifast" (case insensitive) for standard VIFAST ad-free service
    const isVifastStream =
      (activeServerIndex === 0 &&
        (settings?.mainServerName || "").toLowerCase().includes("vifast")) ||
      (activeServerIndex > 0 &&
        activeServerObj &&
        (activeServerObj.name || "").toLowerCase().includes("vifast")) ||
      (streamUrl && streamUrl.toLowerCase().includes("vifast"));

    // VIP users (Viyie+) and VIFAST stream servers are completely ad-free
    const isAdFreeUser =
      isPremiumUser ||
      isVifastStream ||
      Boolean(
        movie.tags?.some(
          (t) =>
            t.toLowerCase() === "bebas iklan" ||
            t.toLowerCase() === "adfree" ||
            t.toLowerCase() === "no ads",
        ),
      ) ||
      isDriveStream;

    // Process ads percentage based check if NOT evaluated yet and not ad-free user
    let willShowVideoAd = false;
    let selectedAdToPlay: any = null;

    const videos = settings?.adVideos?.filter((v) => v.active && v.url) || [];

    if (
      !skipAdCheck &&
      !isAdFreeUser &&
      !hasEvaluatedVideoAd &&
      videos.length > 0
    ) {
      const totalLocalPercentage = videos.reduce(
        (acc, curr) => acc + (Number(curr.percentage) || 0),
        0,
      );

      const roll = Math.random() * 100;
      if (roll <= totalLocalPercentage) {
        let cumulative = 0;
        selectedAdToPlay = videos[0];
        for (const ad of videos) {
          const p = Number(ad.percentage) || 0;
          if (p <= 0) continue;
          cumulative += p;
          if (roll <= cumulative) {
            selectedAdToPlay = ad;
            break;
          }
        }
        if (selectedAdToPlay && selectedAdToPlay.url) {
          willShowVideoAd = true;
        }
      }
    }

    if (willShowVideoAd && selectedAdToPlay) {
      setHasEvaluatedVideoAd(true);
      setActiveVideoAdUrl(selectedAdToPlay.url);
      setActiveVideoAdLink(selectedAdToPlay.linkUrl || null);
      setVideoAdCanSkip(false);
      setVideoAdCountdown(3);
      setIsStreamStarted(true); // Overlay shown and background player starts processing source!

      let counter = 3;
      const interval = setInterval(() => {
        counter--;
        if (counter <= 0) {
          clearInterval(interval);
          setVideoAdCanSkip(true);
          setVideoAdCountdown(0);
        } else {
          setVideoAdCountdown(counter);
        }
      }, 1000);
      return;
    }

    // Klik thumbnail juga smartlink jika tidak melakukan aksi iklan streaming, jika akan melakukan iklan streaming jangan smart link
    if (!isAdFreeUser) {
      const isEpisode = movie.kind === "tv" && episodes.length > 0;
      if (!isEpisode) {
        openSmartLink();
      }
    }

    if (!skipAdCheck && !isAdFreeUser) {
      setHasEvaluatedVideoAd(true);
    }

    if (activeUseExternalPopup) {
      window.open(
        streamUrl,
        "_blank",
        "width=1280,height=720,menubar=no,status=no,toolbar=no",
      );
      setIsStreamStarted(true);
      return;
    }

    if (activeUseExternalTab) {
      window.open(streamUrl, "_blank");
      setIsStreamStarted(true);
      return;
    }

    if (isBlockedProvider) {
      setBlockedPlayerConfirm(true);
      return;
    }

    setIsStreamStarted(true);
  };

  const handlePopupFromWarning = () => {
    window.open(
      streamUrl,
      "_blank",
      "width=1280,height=720,menubar=no,status=no,toolbar=no",
    );
    setBlockedPlayerConfirm(false);
    setIsStreamStarted(true);
  };

  useEffect(() => {
    setActiveSeason(initialSeason || 0);
    setPrevSeason(initialSeason || 0);
    setActiveEpisode(initialEpisode || 0);
    setActiveServerIndex(0);
    setIsPlayingTrailerInPlayer(false);
    setIsStreamStarted(true);
    setHasEvaluatedVideoAd(false);
    setShowInitialAdPopup(false);
    setShowPeriodicOverlay(false);
    setShowNetworkWarning(false);
  }, [movie.id, initialEpisode, initialSeason]);

  const [prevSeason, setPrevSeason] = useState(activeSeason);
  useEffect(() => {
    if (activeSeason !== prevSeason) {
      setActiveEpisode(0);
      setActiveServerIndex(0);
      setIsPlayingTrailerInPlayer(false);
      setHasEvaluatedVideoAd(false);
      setShowInitialAdPopup(false);
      setShowPeriodicOverlay(false);
      setShowNetworkWarning(false);
      setPrevSeason(activeSeason);
    }
  }, [activeSeason, prevSeason]);

  useEffect(() => {
    setActiveServerIndex(0);
    setIsPlayingTrailerInPlayer(false);
    setHasEvaluatedVideoAd(false);
    setShowInitialAdPopup(false);
    setShowPeriodicOverlay(false);
    setShowNetworkWarning(false);
    // Safety timeout to reset the ref in case activeServerIndex didn't change
    setTimeout(() => {
      isEpisodeSwitchRef.current = false;
    }, 100);
  }, [activeEpisode]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (
      isStreamStarted &&
      isPlayerLoading &&
      !showInitialAdPopup &&
      !showPeriodicOverlay &&
      !activeVideoAdUrl
    ) {
      timer = setTimeout(() => {
        setShowNetworkWarning(true);
      }, 5000);
    } else {
      setShowNetworkWarning(false);
    }
    return () => clearTimeout(timer);
  }, [
    isStreamStarted,
    isPlayerLoading,
    showInitialAdPopup,
    showPeriodicOverlay,
    activeVideoAdUrl,
  ]);

  useEffect(() => {
    if (!isStreamStarted || showInitialAdPopup || activeVideoAdUrl) {
      setShowPeriodicOverlay(false);
      return;
    }

    // Evaluate every 15s if current player is Dailymotion or Drive Stream (80% chance to show)
    const timer = setInterval(() => {
      if (isEmbedPlayerWithOverlay) {
        const shouldShow = Math.random() < 0.8;
        setShowPeriodicOverlay(shouldShow);
      } else {
        setShowPeriodicOverlay(false);
      }
    }, 15000);

    return () => clearInterval(timer);
  }, [
    isStreamStarted,
    showInitialAdPopup,
    activeVideoAdUrl,
    isEmbedPlayerWithOverlay,
  ]);

  useEffect(() => {
    // Changing servers of the active content must display the thumbnail again (unless it was from an episode switch or it is a movie)
    if (!isEpisodeSwitchRef.current && movie.kind === "tv") {
      setIsStreamStarted(false);
    }
    isEpisodeSwitchRef.current = false;
    setIsPlayerLoading(true);
  }, [activeServerIndex]);

  useEffect(() => {
    onPlayStateChange?.(isStreamStarted && !devBlocked);
  }, [isStreamStarted, devBlocked, onPlayStateChange]);

  const lastSavedRef = useRef<string>("");
  useEffect(() => {
    const currentKey = `${movie?.id}-${activeSeason}-${activeEpisode}`;
    if (lastSavedRef.current === currentKey) return;

    // Only save history once when playback starts (or on movie change)
    // No more periodic writes/intervals, but preserve existing progress if present is in cloud history
    if (!isTrailerPlayback && movie?.id) {
      const existingEntry = history?.find(
        (h) =>
          String(h.movieId) === String(movie.id) &&
          (movie.kind !== "tv" ||
            (h.episodeIndex === activeEpisode &&
              h.seasonIndex === activeSeason)),
      );
      const initialProgress = existingEntry ? existingEntry.progress : 0.05;

      addHistory(
        movie,
        initialProgress,
        movie.kind === "tv" ? activeEpisode : undefined,
        movie.kind === "tv" ? activeSeason : undefined,
      );
      lastSavedRef.current = currentKey;
    }
  }, [
    movie?.id,
    activeEpisode,
    isTrailerPlayback,
    activeSeason,
    addHistory,
    history,
  ]);

  useEffect(() => {
    if (!movie?.id) return;

    const timer = setTimeout(async () => {
      try {
        const contentRef = doc(db, "content", String(movie.id));
        const now = new Date();
        let year = now.getFullYear();
        let month = now.getMonth();
        if (now.getDate() < 16) {
          month--;
          if (month < 0) {
            month = 11;
            year--;
          }
        }
        const periodKey = `${year}-${String(month + 1).padStart(2, "0")}-16`;

        await updateDoc(contentRef, {
          views: increment(1),
          [`monthlyStats.${periodKey}.views`]: increment(1),
        });
      } catch (e) {
        console.error("Failed to update views:", e);
      }
    }, 120000); // 2 minutes

    return () => clearTimeout(timer);
  }, [movie?.id]);

  /** AI Smart recommendations: weighted by genres of current movie + favorites + mylist + history */
  const smartRecommendations = useMemo(() => {
    const genreScore = new Map<string, number>();
    const studioScore = new Map<string, number>();

    const learn = (m?: Movie, weight = 1) => {
      if (!m) return;
      m.genres.forEach((g) =>
        genreScore.set(g, (genreScore.get(g) || 0) + weight),
      );
      if (m.studio)
        studioScore.set(
          m.studio,
          (studioScore.get(m.studio) || 0) + weight * 0.5,
        );
    };

    learn(movie, 6); // High bias for current movie matching

    // Heavily weight history to fulfill "genres frequently watched"
    history.forEach((h) =>
      learn(
        allContents.find((m) => m.id === h.movieId),
        2 + (h.progress || 0), // Boost if they watched a lot of it
      ),
    );
    favorites.forEach((id) =>
      learn(
        allContents.find((m) => m.id === id),
        3,
      ),
    );
    myList.forEach((id) =>
      learn(
        allContents.find((m) => m.id === id),
        1.5,
      ),
    );

    // AI Boost: heavily watched genres get an exponential multiplier to truly match "frequently watched"
    for (const [g, s] of genreScore.entries()) {
      if (s > 5) genreScore.set(g, s * 1.5);
    }

    return allContents
      .filter(
        (m) =>
          m.id !== movie.id &&
          m.status !== "coming_soon" &&
          !m.isSubPage &&
          !m.syncMainId &&
          !String(m.id).includes("-page"),
      )
      .map((m) => {
        const g = m.genres.reduce(
          (sum, x) => sum + (genreScore.get(x) || 0),
          0,
        );
        const s = m.studio ? studioScore.get(m.studio) || 0 : 0;
        const trendBoost = m.isTrending ? 2 : 0;
        return { movie: m, score: g + s + trendBoost };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((x) => x.movie);
  }, [movie, favorites, myList, history, allContents]);

  const scrollReco = (dir: "left" | "right") => {
    recoRef.current?.scrollBy({
      left: dir === "left" ? -400 : 400,
      behavior: "smooth",
    });
  };

  const sortedSeasonConnections = useMemo(() => {
    return (movie.seasonConnections || []).sort(
      (a, b) => a.seasonNumber - b.seasonNumber,
    );
  }, [movie.seasonConnections]);

  const renderDownloadSection = (isDesktopView: boolean) => {
    if ((movie.downloadLinks?.length || 0) === 0) return null;

    return (
      <div
        className={`bg-[#000000] border border-white/5 rounded-3xl p-6 sm:p-10 space-y-6 relative overflow-hidden group/download ${isDesktopView ? "hidden lg:block w-[320px] xl:w-[400px] shrink-0 sticky top-24" : "block lg:hidden"}`}
      >
        <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover/download:opacity-100 transition-opacity duration-700" />
        <div className="relative flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600/10 flex items-center justify-center border border-emerald-500/20">
            <FileDown className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="font-black text-lg md:text-xl uppercase tracking-tighter text-white">
              Direct Downloads
            </h3>
            <p className="text-[10px] text-emerald-500/50 font-medium uppercase tracking-[0.2em]">
              High Speed Servers
            </p>
          </div>
        </div>

        <div
          className={`relative grid gap-4 ${isDesktopView ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"}`}
        >
          {movie.downloadLinks?.map((dl, idx) => (
            <a
              key={idx}
              href={dl.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-5 py-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-emerald-600 hover:border-emerald-500 transition-all duration-300 group/item shadow-lg hover:shadow-emerald-900/40"
            >
              <div className="flex flex-col">
                <span className="font-extrabold text-sm text-white group-hover/item:text-white transition-colors">
                  {dl.name}
                </span>
                <span className="text-[9px] text-white/30 uppercase font-black tracking-widest mt-0.5">
                  Mirror Server #{idx + 1}
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover/item:bg-white/20 transition-colors">
                <ExternalLink className="w-4 h-4 text-white/40 group-hover/item:text-white transition-colors" />
              </div>
            </a>
          ))}
        </div>

        {settings?.downloadTutorials &&
          settings.downloadTutorials.length > 0 && (
            <div className="relative pt-6 mt-4 border-t border-white/5">
              <div className="flex items-center gap-2 mb-4">
                <HelpCircle className="w-4 h-4 text-orange-400" />
                <span className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em]">
                  How to download? (Tutorial)
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {settings.downloadTutorials.map((tut, idx) => (
                  <a
                    key={idx}
                    href={tut.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-orange-600/10 border border-orange-500/20 text-orange-500 text-[10px] font-black rounded-xl hover:bg-orange-600 hover:text-white transition-all duration-300 flex items-center gap-2 uppercase tracking-wider"
                  >
                    {tut.name}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          )}
      </div>
    );
  };

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-[#000000] text-white overflow-x-hidden pt-0 lg:pt-0 animate-fade-in pb-16 md:pb-0"
    >
      {/* PLAYER — full width edge-to-edge */}
      <div
        className={`relative w-full bg-[#020205] overflow-hidden group/player transition-all duration-500 ease-out ${
          !isStreamStarted && movie.kind !== "tv"
            ? "aspect-[16/8.5]"
            : "aspect-video max-h-[80vh]"
        }`}
        style={{
          aspectRatio:
            !isStreamStarted && movie.kind !== "tv" ? "16 / 8.5" : undefined,
        }}
      >
        {(devBlocked || isStreamStarted) &&
          (devBlocked && !isAdmin && user?.role !== "admin" ? (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#070101] text-center p-6 border-4 border-red-600/30 animate-fade-in">
              <div className="absolute inset-0 bg-radial-gradient from-red-600/5 to-transparent pointer-events-none" />
              <div className="w-16 h-16 rounded-full bg-red-600/10 border border-red-500/20 flex items-center justify-center mb-4 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg md:text-2xl font-black text-red-500 uppercase tracking-widest mb-3 drop-shadow-[0_0_8px_rgba(239,68,68,0.2)]">
                VIYIE PLAYBACK LOCK
              </h3>
              <p className="text-white/80 text-xs md:text-sm leading-relaxed max-w-md font-medium px-4">
                Violation Detected: Developer tools, keyboard inspection
                shortcuts, source code viewers, or page saving utilities were
                attempted. This media stream has been securely and permanently
                locked for this session to safeguard our database and stream
                endpoints.
              </p>
              <div className="mt-5 px-4 py-2 bg-red-600/10 border border-red-600/20 rounded-md text-[10px] font-mono tracking-wider text-red-400 max-w-xs uppercase">
                STATUS: TAMPER_LOCKOUT_ENGAGED
              </div>
              <p className="mt-5 text-[11px] text-white/50 leading-relaxed max-w-xs font-normal">
                To resume playback, you must close this browser session and load
                the player inside a{" "}
                <span className="text-red-400 font-medium">
                  new browser tab
                </span>
                . Active locks persist on page reload.
              </p>
            </div>
          ) : (
            <div className="absolute inset-0 z-10">
              {isPlayerLoading &&
                !activeUseExternalPopup &&
                !isCustomPlayerActive &&
                !activeVideoAdUrl && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md pointer-events-none">
                    <div className="relative w-16 h-16">
                      <div className="absolute inset-0 border-4 border-red-500/20 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-t-red-600 rounded-full animate-spin"></div>
                    </div>
                    <p className="mt-4 text-[10px] font-medium text-white/50 animate-pulse tracking-[0.2em] uppercase">
                      Processing Source...
                    </p>
                  </div>
                )}

              {/* Active Video Ad Overlay */}
              {activeVideoAdUrl && (
                <div className="absolute inset-0 z-30 pointer-events-auto bg-black flex flex-col justify-center items-center">
                  {/* Secure Click Interceptor - completely intercepts, blocks player controls, pausing, pressing or seeking */}
                  <div
                    className={`absolute inset-0 z-40 ${activeVideoAdLink ? "cursor-pointer" : "cursor-default"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (activeVideoAdLink) {
                        window.open(activeVideoAdLink, "_blank");
                      }
                    }}
                  />

                  {(() => {
                    const isDirectVideo =
                      activeVideoAdUrl.toLowerCase().endsWith(".mp4") ||
                      activeVideoAdUrl.toLowerCase().endsWith(".webm") ||
                      activeVideoAdUrl.toLowerCase().includes(".mp4?") ||
                      activeVideoAdUrl.toLowerCase().includes(".webm?") ||
                      activeVideoAdUrl.includes("export=download") ||
                      activeVideoAdUrl.includes("/uc?");

                    if (isDirectVideo) {
                      return (
                        <video
                          src={activeVideoAdUrl}
                          autoPlay
                          playsInline
                          className="w-full h-full object-contain pointer-events-none relative z-10 scrollbar-none"
                        />
                      );
                    }

                    let finalAdUrl = activeVideoAdUrl;
                    if (
                      finalAdUrl.includes("drive.google.com") &&
                      finalAdUrl.includes("/view")
                    ) {
                      finalAdUrl = finalAdUrl.replace("/view", "/preview");
                    }

                    return (
                      <iframe
                        src={`${finalAdUrl}${finalAdUrl.includes("?") ? "&" : "?"}autoplay=1&mute=0&controls=0&modestbranding=1&rel=0`}
                        title="Advertisement"
                        className="w-full h-full border-0 pointer-events-none relative z-10"
                        allow="autoplay; fullscreen"
                        allowFullScreen
                      />
                    );
                  })()}

                  <div className="absolute bottom-6 right-6 z-50">
                    {videoAdCanSkip ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveVideoAdUrl(null);
                        }}
                        className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 hover:scale-105 active:scale-95 text-white text-[11px] font-black uppercase tracking-[0.15em] rounded-full border border-red-500/30 animate-fade-in transition-all shadow-xl cursor-pointer"
                      >
                        Skip Ad <ChevronRight className="w-4 h-4 text-white" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 px-6 py-2.5 bg-black/80 backdrop-blur-md rounded-full text-white/50 text-[11px] font-medium uppercase tracking-widest border border-white/10 shadow-lg">
                        <Clock className="w-3.5 h-3.5 animate-pulse text-red-500" />
                        Skip in {videoAdCountdown}...
                      </div>
                    )}
                  </div>
                  {activeVideoAdLink && (
                    <div className="absolute bottom-6 left-6 z-20 pointer-events-none">
                      <div className="px-4 py-2 bg-black/60 backdrop-blur-md flex items-center gap-2 rounded-xl text-white/80 text-[10px] font-medium uppercase tracking-widest border border-white/10 shadow-2xl">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        Click anywhere to learn more
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Underground Movie Player Layer */}
              <div className="absolute inset-0 z-[5] pointer-events-auto">
                {activeUseExternalPopup || activeUseExternalTab ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#000000] relative">
                    <div className="absolute inset-0 opacity-20 bg-black/50"></div>
                    <div className="relative z-10 flex flex-col items-center p-8 text-center max-w-md">
                      <div className="w-20 h-20 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center mb-6 animate-pulse">
                        {activeUseExternalTab ? (
                          <ExternalLink className="w-10 h-10 text-red-500" />
                        ) : (
                          <MonitorPlay className="w-10 h-10 text-red-500" />
                        )}
                      </div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">
                        {activeUseExternalTab
                          ? "Opened in New Tab"
                          : "Opened in Popup"}
                      </h3>
                      <p className="text-white/40 text-sm mb-8 leading-relaxed font-medium">
                        This content is being played in an external{" "}
                        {activeUseExternalTab ? "tab" : "window"}. Do not close
                        this page.
                      </p>
                      <div className="flex flex-col gap-3 w-full">
                        <button
                          onClick={() =>
                            activeUseExternalTab
                              ? window.open(streamUrl, "_blank")
                              : window.open(
                                  streamUrl,
                                  "_blank",
                                  "width=1280,height=720,menubar=no,status=no,toolbar=no",
                                )
                          }
                          className="flex items-center justify-center gap-2 px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-red-900/40 transition-all hover:scale-105"
                        >
                          <ExternalLink className="w-4 h-4" /> Re-open Player
                        </button>
                        <button
                          onClick={() => setIsStreamStarted(false)}
                          className="mt-2 text-[10px] font-black text-white/20 uppercase hover:text-white transition-colors"
                        >
                          Back to thumbnail
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <IframeSecurityShield>
                    {isCustomPlayerActive && customPlayerVideoObject ? (
                      <div className="w-full h-full pointer-events-auto">
                        <ViyiePlayerUI video={customPlayerVideoObject} />
                      </div>
                    ) : isYouTube ? (
                      <iframe
                        src={streamUrl || undefined}
                        title={movie.title}
                        className="w-full h-full border-none pointer-events-auto"
                        style={{
                          transform: (streamUrl || "").toLowerCase().includes("ok.ru")
                            ? "none"
                            : `scale(${playerScale / 100}) translate(${playerTranslateX}%, ${playerTranslateY}%)`,
                          width: "100%",
                          height: "100%",
                          transformOrigin: "center",
                        }}
                        allowFullScreen={true}
                        sandbox={
                          activeUseSandbox
                            ? "allow-scripts allow-same-origin allow-presentation"
                            : undefined
                        }
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="no-referrer-when-downgrade"
                        loading="lazy"
                        onLoad={() => setIsPlayerLoading(false)}
                      />
                    ) : isRemoteVideo ? (
                        <div className="w-full aspect-video md:-mt-10 pointer-events-auto">
                          {(() => {
                             let resolutions = [];
                             let initialUrl = streamUrl || "";
                             try {
                               if (streamUrl) {
                                 const parsed = JSON.parse(streamUrl);
                                 resolutions = parsed.streams.filter((s: any) => s.url).map((s: any) => ({ res: s.resolution, url: s.url }));
                                 initialUrl = resolutions.length > 0 ? resolutions[0].url : streamUrl;
                               }
                             } catch(e) {}
                             return <video src={initialUrl} controls className="w-full h-full" autoPlay />;
                          })()}
                        </div>
                    ) : isRumble ? (
                        <div className="w-full aspect-video md:-mt-10">
                          <iframe
                            className="rumble transition-all duration-300 w-full h-full landscape:h-[297.75px] md:landscape:h-[930px] md:h-[930px]"
                            style={{ width: '100%', maxWidth: '2016px', margin: '0 auto', display: 'block' }}
                            src={`https://rumble.com/embed/${streamUrl?.match(/\/embed\/([a-zA-Z0-9]+)/)?.[1] || "v79xzz8"}/?pub=4pl5c6`}
                            frameBorder="0"
                            allowFullScreen
                          />
                        </div>
                      ) : isHydrax ? (
                      <iframe
                        src={streamUrl || undefined}
                        title={movie.title}
                        className="w-full h-full border-none pointer-events-auto"
                        style={{
                          transform: (streamUrl || "").toLowerCase().includes("ok.ru")
                            ? "none"
                            : `scale(${playerScale / 100}) translate(${playerTranslateX}%, ${playerTranslateY}%)`,
                          width: "100%",
                          height: "100%",
                          transformOrigin: "center",
                        }}
                        scrolling="no"
                        frameBorder="0"
                        allowFullScreen={true}
                        referrerPolicy="no-referrer"
                        sandbox={
                          activeUseSandbox
                            ? "allow-scripts allow-same-origin allow-presentation"
                            : undefined
                        }
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        loading="lazy"
                        onLoad={() => setIsPlayerLoading(false)}
                      />
                      ) : isNativeVideo ? (
                      <video 
                        src={streamUrl} 
                        controls 
                        autoPlay 
                        className="w-full h-full pointer-events-auto" 
                        onLoadedData={() => setIsPlayerLoading(false)} 
                      />
                    ) : isSpecialEmbed ? (
                      <iframe
                        src={streamUrl || undefined}
                        title={movie.title}
                        className="w-full h-full border-none pointer-events-auto"
                        style={{
                          transform: (streamUrl || "").toLowerCase().includes("ok.ru")
                            ? "none"
                            : `scale(${playerScale / 100}) translate(${playerTranslateX}%, ${playerTranslateY}%)`,
                          width: "100%",
                          height: "100%",
                          transformOrigin: "center",
                        }}
                        scrolling="no"
                        frameBorder="0"
                        allowFullScreen={true}
                        referrerPolicy="no-referrer"
                        sandbox={
                          activeUseSandbox
                            ? "allow-scripts allow-same-origin allow-presentation"
                            : undefined
                        }
                        // @ts-ignore
                        webkitallowfullscreen="true"
                        // @ts-ignore
                        mozallowfullscreen="true"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        onLoad={() => setIsPlayerLoading(false)}
                      />
                    ) : (
                      <iframe
                        src={streamUrl || undefined}
                        title={movie.title}
                        className="w-full h-full border-none pointer-events-auto"
                        style={{
                          transform: (streamUrl || "").toLowerCase().includes("ok.ru")
                            ? "none"
                            : `scale(${playerScale / 100}) translate(${playerTranslateX}%, ${playerTranslateY}%)`,
                          width: "100%",
                          height: "100%",
                          transformOrigin: "center",
                        }}
                        scrolling="no"
                        frameBorder="0"
                        allowFullScreen={true}
                        referrerPolicy="no-referrer"
                        sandbox={
                          activeUseSandbox
                            ? "allow-scripts allow-same-origin allow-presentation"
                            : undefined
                        }
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        loading="lazy"
                        onLoad={() => setIsPlayerLoading(false)}
                      />
                    )}
                  </IframeSecurityShield>
                )}
              </div>
            </div>
          ))}

        {/* Thumbnail Overlay */}
        <AnimatePresence>
          {!isStreamStarted &&
            !(devBlocked && !isAdmin && user?.role !== "admin") &&
            (movie.kind === "tv" ? (
              <motion.div
                initial={false}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 z-10 bg-black group/thumbnail cursor-pointer overflow-hidden"
                onClick={() => handleStartPlayback()}
              >
                <div className="absolute inset-0">
                  <OptimizedImage
                    src={movie.backdrop || movie.poster || undefined}
                    alt={movie.title}
                    className="w-full h-full"
                    style={{
                      objectPosition: movie.backdropPosition || "50% 50%",
                      transform: `scale(${movie.backdropScale || 1}) rotate(${movie.backdropRotate || 0}deg)`,
                      transformOrigin: movie.backdropPosition || "50% 50%",
                      opacity: 0.85,
                    }}
                    quality="high"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />
                </div>

                {/* Infobar and Descriptions Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center transition-colors duration-500 group-hover/thumbnail:bg-black/10">
                  {activeUseExternalPopup && (
                    <div className="mt-4 px-3 py-1 bg-black/80 rounded-full border border-white/10 text-[9px] font-black text-white/60 uppercase tracking-widest backdrop-blur-sm">
                      This player will open in a popup window when played!
                    </div>
                  )}
                  {activeUseExternalTab && (
                    <div className="mt-4 px-3 py-1 bg-black/80 rounded-full border border-white/10 text-[9px] font-black text-white/60 uppercase tracking-widest backdrop-blur-sm">
                      This player will open in a new tab when played!
                    </div>
                  )}
                </div>

                {/* Bottom Right "Click Thumbnail to Play" Pill */}
                <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 md:bottom-8 md:right-8 z-20 pointer-events-none">
                  <span className="notranslate text-[9px] sm:text-[11px] font-medium text-white/50 uppercase tracking-[0.15em]">
                    Click to Play
                  </span>
                </div>

                {/* Bottom Left Info */}
                <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 md:bottom-8 md:left-8 flex items-end gap-8 sm:gap-12 md:gap-14 z-20 pointer-events-none">
                  <div className="flex flex-col text-left pb-1 sm:pb-2">
                    <h2
                      className="notranslate text-base sm:text-2xl md:text-3xl lg:text-4xl font-appeal font-normal text-white tracking-wider drop-shadow-2xl flex items-center uppercase"
                      translate="no"
                    >
                      <div className="w-1 md:w-1.5 h-[1em] bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.6)] rounded-full mr-2 sm:mr-4 shrink-0" />
                      <span className="line-clamp-2">{movie.title}</span>
                    </h2>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2.5 bg-black/40 w-fit px-2.5 py-1 rounded-full backdrop-blur-sm border border-white/5 flex-wrap">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-yellow-500 fill-yellow-500" />
                        <span className="font-semibold text-white text-[10px] sm:text-xs">
                          {movie.rating}
                        </span>
                      </div>
                      {formattedDate && (
                        <>
                          <span className="text-white/20 text-[10px]">•</span>
                          <span className="font-semibold text-white/80 text-[10px] sm:text-xs">
                            {formattedDate}
                          </span>
                        </>
                      )}
                      {movie.duration && (
                        <>
                          <span className="text-white/20 text-[10px]">•</span>
                          <span className="font-semibold text-white/80 text-[10px] sm:text-xs">
                            {movie.duration}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              // EXQUISITE NEW MOVIE LANDING HERO (iQiyi red variant design)!
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 z-10 w-full h-full bg-[#020204] overflow-hidden flex items-end select-none cursor-pointer"
                onClick={() => handleStartPlayback()}
              >
                {/* 1. Backdrop Background */}
                <div className="absolute inset-0 w-full h-full">
                  <OptimizedImage
                    src={movie.backdrop || movie.poster || undefined}
                    alt={movie.title}
                    className="w-full h-full object-cover"
                    style={{
                      objectPosition: movie.backdropPosition || "50% 50%",
                      transform: `scale(${movie.backdropScale || 1.1}) rotate(${movie.backdropRotate || 0}deg)`,
                      opacity: 0.68,
                    }}
                    quality="high"
                  />
                  {/* Left Solid/Linear black-to-transparent iQiyi premium gradient with reduced fade */}
                  <div className="absolute inset-x-0 bottom-0 top-0 bg-gradient-to-r from-[#020205]/75 via-[#020205]/35 to-transparent pointer-events-none" />
                  {/* Vertical bottom gradient overlay with rich fade for texts at bottom (no blur!) */}
                  <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#020205] via-[#020205]/45 to-transparent pointer-events-none" />
                </div>

                {/* 2. Responsive Content Container (Aligned smoothly to bottom) */}
                {!isMobile && (
                  <div className="relative z-20 w-full h-full flex items-end max-w-[2000px] mx-auto px-6 sm:px-12 md:px-16 lg:px-20 pb-6 sm:pb-10 md:pb-12 lg:pb-14 pt-4">
                    <div className="w-full flex md:flex-row flex-col items-end justify-between gap-6 md:gap-10">
                      {/* Left Column Text details with motion animations */}
                      <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                        className="flex-1 flex flex-col justify-end items-start text-left space-y-3.5 sm:space-y-4 md:space-y-4 max-w-2xl"
                      >
                        {/* Title display */}
                        <h1
                          className="notranslate text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-appeal font-normal tracking-wider text-white leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] uppercase"
                          translate="no"
                        >
                          {movie.title}
                        </h1>

                        {/* Genres Header tag (moved below Title, white/75 opacity) */}
                        {movie.genres && movie.genres.length > 0 && (
                          <div className="text-[11px] md:text-xs font-semibold tracking-wider text-white/75 uppercase leading-none">
                            {movie.genres.join("  ·  ")}
                          </div>
                        )}

                        {/* Metadata row */}
                        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-white/95 text-xs md:text-sm font-medium pt-1">
                          <span className="font-extrabold text-white">
                            {movie.year}
                          </span>
                          <span className="text-white/20">•</span>
                          <span className="font-semibold text-white/90">
                            {formattedPlayerDuration ||
                              movie.duration ||
                              "1h 36m"}
                          </span>
                          {movie.rating && (
                            <>
                              <span className="text-white/20">•</span>
                              <span className="flex items-center gap-1 font-medium text-yellow-500">
                                ⭐ {movie.rating}
                              </span>
                            </>
                          )}
                          <span className="text-white/20">•</span>
                          <span className="text-white/60">
                            {(movie as any).quality || "1080p HD"}
                          </span>
                        </div>

                        {/* Director information */}
                        <div className="text-xs md:text-sm text-white/40">
                          Director :{" "}
                          <span className="text-white/90 font-semibold">
                            {(movie as any).director ||
                              (movie.cast && movie.cast[0]) ||
                              "Maggie Kang"}
                          </span>
                        </div>

                        {/* Synopsis / Description text (somewhat transparent underneath) */}
                        <p className="text-xs sm:text-sm text-white/60 leading-relaxed font-sans max-w-xl line-clamp-3 select-text">
                          {movie.synopsis}
                        </p>

                        {/* Matching Studio logos inline */}
                        {matchingStudios.length > 0 && (
                          <div className="flex items-center gap-5 pt-2">
                            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em] text-white/30 shrink-0">
                              STUDIO
                            </span>
                            <div className="flex flex-wrap items-center gap-3">
                              {matchingStudios.slice(0, 3).map((studio) => (
                                <div
                                  key={studio.name}
                                  className="h-7 sm:h-9 relative overflow-hidden flex items-center justify-center shrink-0 p-1.5 rounded-lg bg-black/40 border border-white/5 shadow-inner"
                                >
                                  <img
                                    src={studio.logoUrl || undefined}
                                    alt={studio.name}
                                    className="h-full w-auto object-contain pointer-events-none select-none"
                                    onError={(e) => {
                                      (
                                        e.target as HTMLImageElement
                                      ).style.display = "none";
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    </div>
                  </div>
                )}

                {/* Bottom Right "Click to Play" Pill */}
                <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 md:bottom-8 md:right-8 z-20 pointer-events-none">
                  <span className="notranslate text-[9px] sm:text-[11px] font-medium text-white/50 uppercase tracking-[0.15em]">
                    Click to Play
                  </span>
                </div>
              </motion.div>
            ))}
        </AnimatePresence>

        {/* Blocked Player Warning Modal */}
        <AnimatePresence>
          {blockedPlayerConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
            >
              <div className="max-w-md w-full bg-[#111] border border-white/10 rounded-3xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-orange-500" />
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-red-600/10 border border-red-500/20 flex items-center justify-center mb-6">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                  </div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-3 leading-tight">
                    Incompatible Player Detected
                  </h3>
                  <p className="text-white/40 text-[13px] leading-relaxed mb-8">
                    This player provider cannot be displayed directly on our
                    website due to security restrictions. <br />
                    <br />
                    Would you like to open it in a secure web popup instead?
                  </p>

                  <div className="flex flex-col w-full gap-3">
                    <button
                      onClick={handlePopupFromWarning}
                      className="h-12 w-full bg-red-600 hover:bg-red-500 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-xl shadow-lg shadow-red-900/40 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" /> Open in Popup
                    </button>
                    <button
                      onClick={() => setIsStreamStarted(true)}
                      className="h-12 w-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-xl border border-white/5 transition-all"
                    >
                      Try Embedding Anyway
                    </button>
                    <button
                      onClick={() => setBlockedPlayerConfirm(false)}
                      className="mt-2 text-[10px] font-black text-white/20 uppercase hover:text-red-500 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dailymotion Movie Secure Overlay - 15s Countdown Progress */}
        {isDailymotionMovie && dailymotionSecondsLeft > 0 && (
          <div
            id="dailymotion-movie-overlay"
            className="absolute inset-0 z-[106] flex flex-col items-center justify-center bg-black/80 backdrop-blur-[2px] cursor-pointer transition-all duration-300 animate-in fade-in"
            onClick={() => {
              openSmartLink();
              setDailymotionSecondsLeft(0);
            }}
          >
            <div className="flex flex-col items-center text-center p-6 max-w-sm sm:max-w-md bg-[#0a0a0c]/95 border border-red-600/30 rounded-2xl shadow-[0_0_40px_rgba(239,68,68,0.2)] pointer-events-none">
              <div className="relative w-12 h-12 flex items-center justify-center mb-4">
                <span className="absolute inset-0 rounded-full border-4 border-red-600/10 border-t-red-600 animate-spin" />
                <MonitorPlay className="w-5 h-5 text-red-500" />
              </div>
              <h4 className="text-white text-xs sm:text-sm font-black uppercase tracking-[0.2em] mb-2 text-red-500 font-sans">
                Direct Stream Sponsor Active
              </h4>
              <p className="text-white/60 text-[10.5px] sm:text-xs leading-relaxed max-w-xs mb-4">
                Thank you for your support! Click anywhere to sponsor this
                stream, or wait for stream direct connection.
              </p>

              {/* Progress bar visualizer */}
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mb-3.5 relative">
                <div
                  className="bg-red-600 h-full rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(dailymotionSecondsLeft / 15) * 100}%` }}
                />
              </div>

              <div className="flex items-center justify-between w-full text-[9px] font-black uppercase tracking-widest text-white/40 font-mono">
                <span>Connecting Server</span>
                <span className="text-red-500">
                  {Math.round((dailymotionSecondsLeft / 15) * 100)}% (
                  {dailymotionSecondsLeft}s)
                </span>
              </div>
            </div>

            <div className="absolute bottom-4 text-[9px] font-black tracking-widest text-white/30 uppercase animate-pulse font-mono">
              Click Player to Continue Instantly
            </div>
          </div>
        )}

        {/* Periodic Transparent Overlay for Dailymotion and Drive remote players */}
        {showPeriodicOverlay && isEmbedPlayerWithOverlay && (
          <div
            id="transparent-click-ad-overlay"
            className="absolute inset-0 z-[105] cursor-pointer bg-transparent"
            onClick={() => {
              setShowPeriodicOverlay(false);
              openSmartLink();
            }}
          />
        )}
      </div>

      {showNetworkWarning && (
        <div className="w-full max-w-7xl mx-auto text-center py-2 px-4 transition-all animate-in fade-in zoom-in duration-500 mt-2">
          <span className="text-[10px] sm:text-[11px] font-medium text-red-500/80">
            If content does not load within 5 seconds, try switching servers or
            check your network connection.
          </span>
        </div>
      )}

      {/* Mobile Episode Navigation - Right under player */}
      {isMobile && movie.kind === "tv" && episodes.length > 1 && (
        <div className="w-full bg-[#000000] border-b border-white/5 px-4 py-4 flex items-center justify-between sticky top-0 z-30 shadow-2xl backdrop-blur-md">
          <button
            disabled={activeEpisode === 0}
            onClick={() => switchEpisode((prev: number) => prev - 1)}
            className="group flex items-center gap-2 text-[10px] font-medium text-white/50 disabled:opacity-10 transition-all active:scale-95 hover:text-red-500"
          >
            <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />{" "}
            PREV
          </button>

          <div className="flex flex-col items-center">
            <span className="text-[8px] font-medium text-white/20 uppercase tracking-[0.3em] mb-1">
              Now Playing
            </span>
            <span className="text-[11px] font-medium text-red-600 bg-red-600/10 px-3 py-1 rounded-full border border-red-600/20 shadow-[0_0_15px_rgba(220,38,38,0.1)]">
              EPISODE {episodes[activeEpisode]?.number || ""}
            </span>
          </div>

          <button
            disabled={activeEpisode === episodes.length - 1}
            onClick={() => switchEpisode((prev: number) => prev + 1)}
            className="group flex items-center gap-2 text-[10px] font-medium text-white/50 disabled:opacity-10 transition-all active:scale-95 hover:text-red-500"
          >
            NEXT{" "}
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      )}

      {/* Player Action Bar (Servers, Nav, Actions) - ALWAYS visible */}
      <div className="w-full bg-[#000000] border-b border-white/5 shadow-2xl relative">
        <div className="max-w-[2000px] mx-auto px-7 sm:px-[47px] lg:px-[56px] py-4 sm:py-6 flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-6 w-full">
            <AnimatePresence>
              {showServerTip && activeServers.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="absolute left-4 sm:left-6 top-full mt-3 z-[60] flex flex-col items-start"
                >
                  {/* Tooltip Arrow pointing UP */}
                  <div className="w-4 h-4 bg-red-600 border-t border-l border-red-500/50 rotate-45 transform translate-y-2.5 ml-10 shadow-none -z-10 relative"></div>
                  <div className="bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2.5 rounded-2xl shadow-[0_15px_40px_-5px_rgba(220,38,38,0.6)] border border-red-500/50 flex items-center gap-3 relative z-10">
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <HelpCircle className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="flex flex-col pr-2">
                      <span className="text-[11px] font-black uppercase text-white tracking-widest leading-none mb-0.5">
                        Pro Tip
                      </span>
                      <span className="text-[10px] text-white/90 font-medium leading-tight">
                        Try a different server if playback fails or the video
                        doesn't load.
                      </span>
                    </div>
                    <button
                      onClick={() => setShowServerTip(false)}
                      className="hover:bg-black/20 p-1.5 rounded-full transition-colors shrink-0"
                    >
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!isThumbnailMode && (effectivePrimaryUrl || activeServers.length > 0) && (
              <div className="flex flex-col gap-3 w-full sm:w-auto">
                <div
                  className={`flex flex-wrap items-center gap-3 w-full sm:w-auto ${!isMobile || activeServers.length > 0 ? "" : "hidden sm:flex"}`}
                >
                  <div className="flex items-center gap-2 mr-2 sm:mr-6 text-red-500 shrink-0">
                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="text-[9px] sm:text-[10px] text-red-500 uppercase font-medium tracking-[0.2em] whitespace-nowrap">
                      Fast Servers
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {effectivePrimaryUrl && (
                      <button
                        onClick={() => {
                          setIsPlayingTrailerInPlayer(false);
                          setActiveServerIndex(0);
                        }}
                        className={`group flex items-center gap-2.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-semibold transition-all duration-300 border ${
                          activeServerIndex === 0 && !isPlayingTrailerInPlayer
                            ? "bg-gradient-to-r from-red-600 to-red-500 text-white border-red-500/50 shadow-[0_0_20px_rgba(220,38,38,0.4)]"
                            : "bg-white/[0.03] text-white/50 border-white/10 hover:text-white hover:bg-white/[0.08] hover:border-white/20"
                        }`}
                      >
                        {activeServerIndex === 0 && !isPlayingTrailerInPlayer ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        ) : (
                          <MonitorPlay className="w-3.5 h-3.5" />
                        )}
                        <span className="translate-y-[0.5px]">
                          {getAutoServerName(
                            effectivePrimaryUrl,
                            effectivePrimaryObj?.name ||
                            movie.mainServerName ||
                            settings?.mainServerName ||
                            BRAND_MAIN_SERVER_NAME,
                          )}
                        </span>
                      </button>
                    )}
                    {activeServers.length > 0 &&
                      (user ? (
                        <>
                          {/* Render Alternative 1 (index 1) directly */}
                          {activeServers.slice(0, 1).map((s) => {
                            const actualIdx = 1;
                            const isPlaceholderName = !s.name || ["Server", "Server 1", "New Server"].includes(s.name);
                            const serverName = isPlaceholderName ? getAutoServerName(s.embedUrl, s.name || "Server") : s.name;
                            const serverNameLower = serverName.toLowerCase();
                            const isYT = serverNameLower.includes("youtube");
                            const isDM = serverNameLower.includes("dailymotion");
                            const isSrvViyiePlus = s.isViyiePlus === true;
                            const isUserViyiePlus = Boolean(user?.tiers?.includes("viyie_plus") || user?.tier === "viyie_plus" || isAdmin);

                            return (
                              <button
                                key={actualIdx}
                                onClick={() => {
                                  if (isSrvViyiePlus && !isUserViyiePlus) {
                                    toast("This helper source is exclusive for Viyie+ members. Please upgrade your tier in profile settings!", "info");
                                    return;
                                  }
                                  setIsPlayingTrailerInPlayer(false);
                                  setActiveServerIndex(actualIdx);
                                }}
                                className={`group flex items-center gap-2.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-semibold transition-all duration-300 border ${
                                  activeServerIndex === actualIdx && !isPlayingTrailerInPlayer
                                    ? isSrvViyiePlus
                                      ? "bg-[#18181b] text-amber-400 border-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.3)] font-medium"
                                      : "bg-gradient-to-r from-red-600 to-red-500 text-white border-red-500/50 shadow-[0_0_20px_rgba(220,38,38,0.4)]"
                                    : isSrvViyiePlus
                                      ? "bg-white/[0.03] text-amber-500/90 border-amber-500/20 hover:text-amber-400 hover:bg-white/[0.08] hover:border-amber-500/45 font-medium"
                                      : "bg-white/[0.03] text-white/50 border-white/10 hover:text-white hover:bg-white/[0.08] hover:border-white/20"
                                }`}
                              >
                                {activeServerIndex === actualIdx && !isPlayingTrailerInPlayer ? (
                                  <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isSrvViyiePlus ? "bg-amber-400" : "bg-white"}`} />
                                ) : isSrvViyiePlus ? (
                                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                                ) : isYT ? (
                                  <Play className="w-3.5 h-3.5" />
                                ) : isDM ? (
                                  <LayoutList className="w-3.5 h-3.5" />
                                ) : (
                                  <MonitorPlay className="w-3.5 h-3.5" />
                                )}
                                <span className="translate-y-[0.5px] whitespace-nowrap">{serverName}</span>
                              </button>
                            );
                          })}

                          {/* Render "More Server" dropdown if there are more than 1 alternative servers */}
                          {activeServers.length > 1 && (
                            <div className="relative group">
                              <button
                                onClick={() => setShowMoreServers(!showMoreServers)}
                                className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-semibold transition-all duration-300 border ${
                                  activeServerIndex > 1 && !isPlayingTrailerInPlayer
                                    ? "bg-white/[0.08] text-white border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                                    : "bg-white/[0.03] text-white/50 border-white/10 hover:text-white hover:bg-white/[0.08] hover:border-white/20"
                                }`}
                              >
                                <span className="translate-y-[0.5px]">More Servers</span>
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${showMoreServers ? "rotate-180" : ""}`} />
                              </button>

                              <AnimatePresence>
                                {showMoreServers && (
                                  <>
                                    <motion.div
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      onClick={() => setShowMoreServers(false)}
                                      className="fixed inset-0 z-40 bg-black/60 md:hidden"
                                    />
                                    <motion.div
                                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                      transition={{ duration: 0.2, ease: "easeOut" }}
                                      className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-8 bg-black/95 backdrop-blur-xl border-t border-white/10 rounded-t-3xl shadow-2xl flex flex-col gap-2 
                                                 md:absolute md:top-full md:bottom-auto md:left-auto md:right-0 md:mt-3 md:w-56 md:p-3 md:pb-3 md:rounded-2xl md:border md:bg-[#121212]/95"
                                    >
                                      <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-2 md:hidden" />
                                      {activeServers.slice(1).map((s, idx) => {
                                        const actualIdx = idx + 2; // slice(1) means starts at index 1 of activeServers, so actualIdx is 2
                                        const isPlaceholderName = !s.name || ["Server", "Server 1", "New Server"].includes(s.name);
                                        const serverName = isPlaceholderName ? getAutoServerName(s.embedUrl, s.name || "Server") : s.name;
                                        const serverNameLower = serverName.toLowerCase();
                                        const isYT = serverNameLower.includes("youtube");
                                        const isDM = serverNameLower.includes("dailymotion");
                                        const isSrvViyiePlus = s.isViyiePlus === true;
                                        const isUserViyiePlus = Boolean(user?.tiers?.includes("viyie_plus") || user?.tier === "viyie_plus" || isAdmin);

                                        return (
                                          <button
                                            key={actualIdx}
                                            onClick={() => {
                                              if (isSrvViyiePlus && !isUserViyiePlus) {
                                                toast("This helper source is exclusive for Viyie+ members. Please upgrade your tier in profile settings!", "info");
                                                return;
                                              }
                                              setActiveServerIndex(actualIdx);
                                              setShowMoreServers(false);
                                            }}
                                            className={`group flex items-center justify-between px-4 py-3 md:px-3 md:py-2.5 rounded-xl md:rounded-lg text-xs md:text-[10px] font-semibold transition-all duration-300 border ${
                                              activeServerIndex === actualIdx
                                                ? isSrvViyiePlus
                                                  ? "bg-[#18181b] text-amber-400 border-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.3)] font-medium"
                                                  : "bg-gradient-to-r from-red-600 to-red-500 text-white border-red-500/50 shadow-[0_0_20px_rgba(220,38,38,0.4)]"
                                                : isSrvViyiePlus
                                                  ? "bg-white/[0.03] text-amber-500/90 border-amber-500/20 hover:text-amber-400 hover:bg-white/[0.08] hover:border-amber-500/45 font-medium"
                                                  : "bg-white/[0.03] text-white/50 border-white/10 hover:text-white hover:bg-white/[0.08] hover:border-white/20"
                                            }`}
                                          >
                                            <div className="flex items-center gap-3 md:gap-2">
                                              {activeServerIndex === actualIdx ? (
                                                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isSrvViyiePlus ? "bg-amber-400" : "bg-white"}`} />
                                              ) : isSrvViyiePlus ? (
                                                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                                              ) : isYT ? (
                                                <Play className="w-3.5 h-3.5" />
                                              ) : isDM ? (
                                                <LayoutList className="w-3.5 h-3.5" />
                                              ) : (
                                                <MonitorPlay className="w-3.5 h-3.5" />
                                              )}
                                              <span className="translate-y-[0.5px] whitespace-nowrap">{serverName}</span>
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </motion.div>
                                  </>
                                )}
                              </AnimatePresence>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="group relative">
                          <button className="flex items-center gap-2.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-semibold bg-white/[0.02] text-white/30 border border-white/5 cursor-not-allowed">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span className="translate-y-[0.5px]">
                              +{activeServers.length} Locked Sources
                            </span>
                          </button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 p-3 rounded-2xl bg-black/90 backdrop-blur-xl border border-white/10 text-white shadow-2xl opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all z-20 text-[10px] text-center font-medium leading-relaxed">
                            Unlock premium alternate servers by joining our
                            community. It's free!
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {isDriveStream && (
                  <div className="w-full flex flex-col gap-1.5 mt-1 bg-black/40 border border-white/5 p-3 rounded-2xl max-w-sm font-sans">
                    <span className="text-[9px] font-black tracking-widest text-white/40 uppercase pl-1">
                      HOSTED PLAYER OPTIONS
                    </span>
                    <div className="flex items-center bg-black/60 border border-white/10 p-1 rounded-xl shadow-lg gap-1">
                      {!activeHidePlay1 && (
                        <button
                          onClick={() => {
                            toggleFailsafeIframe(true);
                            toast(
                              `Playback: ${activePlay1DisplayName} (Hosted Stream)`,
                              "success",
                            );
                          }}
                          className={`flex-1 text-center py-2 rounded-lg text-[10px] font-black tracking-wider transition-all uppercase cursor-pointer ${
                            useFailsafeIframe
                              ? "bg-red-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]"
                              : "text-white/40 hover:text-white"
                          }`}
                        >
                          {activePlay1DisplayName}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          toggleFailsafeIframe(false);
                          toast(
                            `Playback: ${activePlay2DisplayName} (Cloud Host)`,
                            "success",
                          );
                        }}
                        className={`flex-1 text-center py-2 rounded-lg text-[10px] font-black tracking-wider transition-all uppercase cursor-pointer ${
                          !useFailsafeIframe
                            ? "bg-red-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]"
                            : "text-white/40 hover:text-white"
                        }`}
                      >
                        {activePlay2DisplayName}
                      </button>
                    </div>
                  </div>
                )}


              </div>
            )}

            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 w-full sm:w-auto px-1 sm:px-0">
              {/* Desktop TV: Prev / Next / Locker */}
              {!isMobile && movie.kind === "tv" && episodes.length > 0 && (
                <div className="flex items-center gap-3 bg-white/5 rounded-full p-1 border border-white/10 shadow-inner">
                  <button
                    disabled={activeEpisode === 0}
                    onClick={() => switchEpisode((prev: number) => prev - 1)}
                    className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    disabled={activeEpisode === episodes.length - 1}
                    onClick={() => switchEpisode((prev: number) => prev + 1)}
                    className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setIsLockerOpen(true)}
                    className="bg-red-600 px-5 py-2.5 rounded-full text-white hover:bg-red-500 transition-all shadow-lg shadow-red-900/50 active:scale-95 flex items-center gap-3 group/locker"
                  >
                    <div className="flex flex-col items-end text-right leading-tight">
                      <span className="text-[9px] font-black uppercase tracking-widest text-white/70 group-hover/locker:text-white">
                        Locker
                      </span>
                      <span className="text-[11px] font-medium">
                        S
                        {movie.seasons && movie.seasons[activeSeason]
                          ? movie.seasons[activeSeason].number
                          : activeSeason + 1}{" "}
                        E{episodes[activeEpisode]?.number || ""}
                      </span>
                    </div>
                    <LayoutList className="w-5 h-5 transition-transform group-hover/locker:scale-110" />
                  </button>
                </div>
              )}

              {/* Masukan Publik: Trailer, Like, Watchlist buttons */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {isMobile && movie.kind === "tv" && episodes.length > 0 && (
                  <button
                    onClick={() => setIsMobileLockerOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all border border-red-500/30 active:scale-95 group/showeps shadow-lg shadow-red-900/10 shrink-0 select-none"
                  >
                    <LayoutList className="w-3.5 h-3.5 text-white group-hover/showeps:scale-110 transition-transform" />
                    <span className="leading-none mt-0.5">(show eps)</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsPlayingTrailerInPlayer(true);
                    setIsStreamStarted(true);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-2.5 sm:px-4 sm:py-2.5 rounded-xl transition-all border active:scale-95 group/trailer ${
                    isPlayingTrailerInPlayer
                      ? "bg-gradient-to-r from-red-600 to-red-500 text-white border-red-500/50 shadow-lg shadow-red-900/40"
                      : "bg-black/40 border-white/10 text-white hover:bg-white/10"
                  }`}
                >
                  <Film className={`w-3.5 h-3.5 group-hover/trailer:scale-110 transition-transform ${isPlayingTrailerInPlayer ? "text-white" : "text-red-500"}`} />
                  <span className="leading-none text-[9px] md:text-xs font-medium uppercase tracking-widest mt-0.5">Trailer</span>
                </button>

                {!isThumbnailMode && (
                  <button
                    onClick={handleToggleLike}
                    className={`flex items-center gap-1.5 px-2.5 py-2.5 sm:px-4 sm:py-2.5 rounded-xl transition-all border active:scale-95 group/like ${
                      hasLiked
                        ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/40"
                        : "bg-black/40 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                    }`}
                    title={hasLiked ? "Unlike" : "Like"}
                  >
                    <ThumbsUp
                      className={`w-3.5 h-3.5 transition-transform group-hover/like:scale-110 ${hasLiked ? "fill-current" : ""}`}
                    />
                    <span className="text-[9px] md:text-sm font-medium leading-none">
                      {likesCount.toLocaleString()}
                    </span>
                  </button>
                )}

                <button
                  onClick={() => {
                    if (!user) {
                      toast(
                        "Login for full access. Do you want to login?",
                        "info",
                        {
                          duration: 7000,
                          action: {
                            label: "LOGIN",
                            onClick: openAuth,
                          },
                        },
                      );
                      return;
                    }
                    toggleFavorite(movie);
                  }}
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border active:scale-95 ${
                    isFav
                      ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/40"
                      : "bg-black/40 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Heart
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isFav ? "fill-current scale-110" : ""}`}
                  />
                </button>

                <button
                  onClick={() => {
                    if (!user) {
                      toast(
                        "Login for full access. Do you want to login?",
                        "info",
                        {
                          duration: 7000,
                          action: {
                            label: "LOGIN",
                            onClick: openAuth,
                          },
                        },
                      );
                      return;
                    }
                    toggleMyList(movie);
                  }}
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border active:scale-95 ${
                    inMyList
                      ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/40"
                      : "bg-black/40 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {inMyList ? (
                    <Check className="w-3.5 h-3.5 sm:w-5 sm:h-5 scale-110" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                  )}
                </button>
              </div>

              {/* Mobile / TV Download Action */}
              {(isMobile || movie.kind === "tv") &&
                (movie.downloadLinks?.length || 0) > 0 && (
                  <button
                    onClick={() => setShowDownloadModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-medium uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-900/40 active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[2000px] mx-auto px-7 sm:px-[47px] lg:px-[56px] py-10 space-y-12">
        {!isThumbnailMode && (
          <div className="flex flex-col gap-8 pb-8 border-b border-white/5">
            <div className="flex flex-col md:flex-row gap-8">
              <div className="hidden md:block w-48 lg:w-64 shrink-0">
                <div className="aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative group bg-black/50">
                  <img
                    src={movie.poster || undefined}
                    alt={movie.title}
                    className="w-full h-full object-cover transition-transform duration-700 md:group-hover:scale-105"
                  />
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-start space-y-6 pt-0">
                <div className="space-y-4">
                  <motion.h1
                    layoutId="movieTitle"
                    translate="no"
                    className="notranslate text-lg sm:text-3xl md:text-5xl font-appeal font-normal text-white tracking-wider leading-snug drop-shadow-2xl flex items-center uppercase"
                  >
                    <div className="w-1 md:w-1.5 h-[1em] bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.6)] rounded-full mr-3 md:mr-5 shrink-0" />
                    {movie.title}
                    {movie.kind === "tv" && episodes.length > 0 && (
                      <span className="text-red-600 inline-flex items-center ml-2 md:ml-4">
                        <span className="text-white/10 mx-1.5 md:mx-3 font-light">
                          |
                        </span>
                        <span className="text-sm md:text-xl font-semibold bg-red-600/10 px-2.5 py-0.5 rounded-lg border border-red-500/20">
                          EP {episodes[activeEpisode]?.number || ""}
                        </span>
                      </span>
                    )}
                  </motion.h1>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] md:text-sm font-medium">
                    {(movie as any).quality && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 text-white rounded-xl border border-white/20 font-black uppercase tracking-widest text-[9px]">
                        {(movie as any).quality}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-yellow-500/10 text-yellow-500 rounded-xl border border-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.1)]">
                      <Star className="w-4 h-4 fill-yellow-500" />
                      <span className="font-medium">{movie.rating}</span>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-white/70 rounded-xl border border-white/5 group hover:bg-white/10 transition-colors">
                      <Calendar className="w-4 h-4 text-red-600" />
                      <span>{formattedDate}</span>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-white/70 rounded-xl border border-white/5 group hover:bg-white/10 transition-colors">
                      <Clock className="w-4 h-4 text-red-600" />
                      <span>{formattedPlayerDuration || movie.duration}</span>
                    </div>

                    {movie.studio && matchingStudios.length > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/10 text-red-500 rounded-xl border border-red-500/10 font-medium uppercase tracking-widest text-[9px]">
                        <Sparkles className="w-3.5 h-3.5" />
                        {matchingStudios.map((s) => s.name).join(", ")}
                      </div>
                    )}
                  </div>
                </div>

                <div className="hidden lg:flex flex-wrap items-center gap-2">
                  {movie.genres?.map((genre, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-white/5 border border-white/10 rounded-md text-xs font-medium text-white/70"
                    >
                      {genre}
                    </span>
                  ))}
                </div>

                <div className="hidden lg:block space-y-4">
                  <p className="text-white/60 text-sm leading-relaxed max-w-4xl line-clamp-4 mb-4">
                    {movie.synopsis}
                  </p>

                  {matchingStudios.length > 0 && (
                    <div
                      className="flex overflow-x-auto no-scrollbar scrollbar-none justify-start gap-4 mb-6 -ml-2 animate-fade-in py-1 px-2"
                      style={{ animationDuration: "1.5s" }}
                    >
                      {matchingStudios.map((studio) => {
                        const zoom = studio.logoZoom ?? 1.0;
                        const rotate = studio.logoRotate ?? 0;
                        const shiftX = studio.logoShiftX ?? 0;
                        const shiftY = studio.logoShiftY ?? 0;
                        const bgColor = studio.logoBgColor || "transparent";
                        const shape = studio.logoShape || "none";
                        const border = studio.logoBorder ?? false;

                        let shapeClass = "rounded-xl";
                        if (shape === "circle")
                          shapeClass = "rounded-full aspect-square";
                        else if (shape === "square")
                          shapeClass = "rounded-none";
                        else if (shape === "pill")
                          shapeClass = "rounded-full px-4";
                        else if (shape === "rounded")
                          shapeClass = "rounded-2xl";

                        const borderClass = border
                          ? "border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.05)]"
                          : "border border-white/5";

                        return (
                          <div
                            key={studio.name}
                            className={`h-11 sm:h-12 md:h-14 relative overflow-hidden flex items-center justify-center shrink-0 transition-all duration-300 ease-out hover:scale-110 p-2 ${shapeClass} ${borderClass}`}
                            style={{ backgroundColor: bgColor }}
                            title={studio.name}
                          >
                            <img
                              src={studio.logoUrl || undefined}
                              alt={studio.name}
                              className="h-full w-auto object-contain pointer-events-none select-none"
                              style={{
                                transform: `scale(${zoom}) rotate(${rotate}deg) translate(${shiftX}px, ${shiftY}px)`,
                                filter: "none",
                                opacity: 1.0,
                              }}
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {movie.cast && movie.cast.length > 0 && (
                    <div className="pt-2 animate-fade-in">
                      <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em] mb-1.5 flex items-center gap-2">
                        <LayoutList className="w-3 h-3 text-red-500" /> STARRING
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {movie.cast.map((name, i, arr) => (
                          <span
                            key={i}
                            className="text-xs font-medium text-white/70 hover:text-red-500 transition-colors cursor-default"
                          >
                            {name}
                            {i < arr.length - 1 ? " •" : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {movie.kind === "tv" && episodes.length > 0 && !isMobile && (
                    <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                      <div className="w-32 aspect-video rounded-lg overflow-hidden shrink-0 border border-white/10">
                        <img
                          src={
                            episodes[activeEpisode]?.thumbnail ||
                            movie.poster ||
                            undefined
                          }
                          className="w-full h-full object-cover"
                          alt=""
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-[10px] text-red-500 font-black uppercase">
                          Now Playing
                        </p>
                        <h4 className="text-sm font-medium truncate">
                          Episode {episodes[activeEpisode]?.number || ""}:{" "}
                          {episodes[activeEpisode]?.title || "Untitled"}
                        </h4>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Synopsis & TV Info (Tablet/Mobile below the Hero) */}
            <div className="flex flex-col lg:hidden space-y-4 pt-4 border-t border-white/5 md:border-transparent md:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                {movie.genres?.map((genre, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-white/5 border border-white/10 rounded-md text-xs font-medium text-white/70"
                  >
                    {genre}
                  </span>
                ))}
              </div>
              <p className="text-white/60 text-sm leading-relaxed max-w-4xl">
                {movie.synopsis}
              </p>

              {matchingStudios.length > 0 && (
                <div
                  className="flex overflow-x-auto no-scrollbar scrollbar-none justify-start gap-3 mt-2 mb-4 -ml-2 px-2 animate-fade-in pb-1"
                  style={{ animationDuration: "1.5s" }}
                >
                  {matchingStudios.map((studio) => {
                    const zoom = studio.logoZoom ?? 1.0;
                    const rotate = studio.logoRotate ?? 0;
                    const shiftX = studio.logoShiftX ?? 0;
                    const shiftY = studio.logoShiftY ?? 0;
                    const bgColor = studio.logoBgColor || "transparent";
                    const shape = studio.logoShape || "none";
                    const border = studio.logoBorder ?? false;

                    let shapeClass = "rounded-xl";
                    if (shape === "circle")
                      shapeClass = "rounded-full aspect-square";
                    else if (shape === "square") shapeClass = "rounded-none";
                    else if (shape === "pill") shapeClass = "rounded-full px-4";
                    else if (shape === "rounded") shapeClass = "rounded-2xl";

                    const borderClass = border
                      ? "border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.05)]"
                      : "border border-white/5";

                    return (
                      <div
                        key={studio.name}
                        className={`h-11 sm:h-12 md:h-14 relative overflow-hidden flex items-center justify-center shrink-0 transition-all duration-300 ease-out hover:scale-110 p-2 mt-1 ${shapeClass} ${borderClass}`}
                        style={{ backgroundColor: bgColor }}
                        title={studio.name}
                      >
                        <img
                          src={studio.logoUrl || undefined}
                          alt={studio.name}
                          className="h-full w-auto object-contain pointer-events-none select-none"
                          style={{
                            transform: `scale(${zoom}) rotate(${rotate}deg) translate(${shiftX}px, ${shiftY}px)`,
                            filter: "none",
                            opacity: 1.0,
                          }}
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {movie.cast && movie.cast.length > 0 && (
                <div className="pt-2">
                  <p className="text-[9px] text-white/30 font-black uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5">
                    <LayoutList className="w-2.5 h-2.5 text-red-500" /> STARRING
                  </p>
                  <div className="flex flex-wrap gap-x-2 gap-y-1">
                    {movie.cast.map((name, i, arr) => (
                      <span
                        key={i}
                        className="text-[11px] font-medium text-white/60"
                      >
                        {name}
                        {i < arr.length - 1 ? " •" : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {movie.kind === "tv" && episodes.length > 0 && !isMobile && (
                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="w-32 aspect-video rounded-lg overflow-hidden shrink-0 border border-white/10">
                    <img
                      src={
                        episodes[activeEpisode]?.thumbnail ||
                        movie.poster ||
                        undefined
                      }
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-[10px] text-red-500 font-black uppercase">
                      Now Playing
                    </p>
                    <h4 className="text-sm font-medium truncate">
                      Episode {episodes[activeEpisode]?.number || ""}:{" "}
                      {episodes[activeEpisode]?.title || "Untitled"}
                    </h4>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {movie.networks && movie.networks.length > 0 && !isThumbnailMode && (
          <div className="pt-2 pb-4 animate-fade-in w-full overflow-x-auto no-scrollbar snap-x relative z-10">
            <div className="flex gap-4 pb-2 w-max items-center pl-1 pr-8">
              {movie.networks.map((net, i) => {
                const logoSrc = getNetworkLogo(net);
                if (!logoSrc) return null;
                const isSmallLogo =
                  net.toLowerCase() === "disney+" ||
                  net.toLowerCase() === "apple tv+" ||
                  net.toLowerCase() === "apple tv" ||
                  net.toLowerCase() === "disneyplus";
                return (
                  <div
                    key={i}
                    title={net}
                    onClick={() => onNetworkClick?.(net)}
                    className="flex items-center justify-center h-20 md:h-28 w-[38vw] md:w-[20vw] shrink-0 group cursor-pointer snap-start hover:scale-105 transition-transform duration-300"
                  >
                    <img
                      src={logoSrc}
                      alt={net}
                      className={`w-full h-full object-contain filter drop-shadow-lg opacity-100 transition-all duration-300 ${isSmallLogo ? "scale-[0.4] brightness-0 invert" : "scale-90"}`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Download & Tutorial Section (Mobile) */}
        {renderDownloadSection(false)}
      </div>

      {/* Episode list (TV only) - Mobile only */}
      {movie.kind === "tv" && isMobile && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6 px-4"
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 group">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.5)]" />
                <h3 className="text-base md:text-lg font-medium text-white flex items-center gap-2 tracking-tight">
                  Episodes
                </h3>
              </div>
              <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] group-hover:text-red-500/50 transition-colors bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                {episodes.length} EP
              </span>
            </div>

            {/* Seasons Selector - Horizontal scroll */}
            {((movie.seasons && movie.seasons.length > 1) ||
              sortedSeasonConnections.length > 0) && (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none custom-scroll -mx-4 px-4 sm:mx-0 sm:px-0">
                {/* Internal Seasons */}
                {movie.seasons &&
                  movie.seasons.map((season, idx) => (
                    <button
                      key={`internal-${season.number}-${idx}`}
                      onClick={() => setActiveSeason(idx)}
                      className={`px-5 py-2 rounded-xl text-xs font-medium border shrink-0 transition-all active:scale-95 ${
                        idx === activeSeason
                          ? "bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/40"
                          : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:border-white/20"
                      }`}
                    >
                      {season.title || `Season ${season.number}`}
                    </button>
                  ))}

                {/* Connected Seasons */}
                {sortedSeasonConnections.map((conn, idx) => {
                  const target = allContents.find(
                    (c) => String(c.id) === String(conn.contentId),
                  );
                  const isCurrent = String(movie.id) === String(conn.contentId);
                  return (
                    <button
                      key={`conn-${conn.contentId || ""}-${idx}`}
                      disabled={isCurrent}
                      onClick={() => target && onSwitchMovie(target)}
                      className={`px-5 py-2 rounded-xl text-xs font-medium border shrink-0 transition-all active:scale-95 ${
                        isCurrent
                          ? "bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/40 opacity-50 cursor-default"
                          : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:border-white/20"
                      }`}
                    >
                      {conn.title ||
                        target?.title ||
                        `Season ${conn.seasonNumber}`}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div
            className={`
              ${
                isMobile
                  ? "flex overflow-x-auto pb-6 scrollbar-none custom-scroll snap-x snap-mandatory gap-4 -mx-4 px-4 pr-10"
                  : "grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-2 pb-4"
              }
            `}
          >
            {episodes.map((ep, idx) => {
              const active = idx === activeEpisode;
              return (
                <motion.button
                  key={`${ep.number}-${idx}`}
                  whileHover={{ scale: isMobile ? 1 : 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => switchEpisode(idx)}
                  className={`group relative shrink-0 ${isMobile ? "w-44 md:w-56 snap-start" : "w-full"} aspect-video rounded-xl overflow-hidden border transition-all duration-300 flex flex-col justify-end text-left shadow-lg ${
                    active
                      ? "border-red-600 ring-4 ring-red-600/20 z-10"
                      : "border-white/5 bg-white/5 hover:border-red-500/50"
                  }`}
                >
                  <div className="absolute inset-0 bg-[#000000]">
                    {ep.thumbnail || movie.poster || undefined ? (
                      <div className="absolute inset-0 overflow-hidden">
                        <img
                          src={ep.thumbnail || movie.poster || undefined}
                          alt={ep.title || `Episode ${ep.number}`}
                          className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${active ? "opacity-90 scale-105" : "opacity-40 group-hover:opacity-70 "}`}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center opacity-10 group-hover:opacity-30 transition-opacity">
                        <Play className="w-8 h-8 text-white fill-white" />
                      </div>
                    )}
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-80" />

                  {active && (
                    <motion.div
                      layoutId="activeEpProgress"
                      className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 z-20 shadow-[0_0_10px_rgba(220,38,38,1)]"
                    />
                  )}

                  <div className="relative p-2 sm:p-3 z-10 w-full">
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-[9px] sm:text-[10px] font-black tracking-widest uppercase flex items-center gap-1 ${active ? "text-red-500" : "text-white/40 group-hover:text-white/80"}`}
                      >
                        EP {ep.number}
                      </span>
                      {active && (
                        <div className="flex gap-1 items-center">
                          <span className="w-1 h-1 rounded-full bg-red-500 animate-ping" />
                          <span className="text-[8px] font-black text-red-500 uppercase tracking-tighter">
                            Playing
                          </span>
                        </div>
                      )}
                    </div>
                    <p
                      className={`text-[10px] sm:text-xs font-medium line-clamp-1 w-full transition-colors ${active ? "text-white" : "text-white/60 group-hover:text-white"}`}
                    >
                      {ep.title || `Episode`}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Episodes Grid (Desktop) */}
      {movie.kind === "tv" &&
        !isMobile &&
        !isThumbnailMode &&
        episodes.length > 0 && (
          <div className="animate-fade-in mt-10 mb-8 max-w-[2000px] px-7 sm:px-[47px] lg:px-[56px] mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {episodes.map((ep, idx) => {
                const active = idx === activeEpisode;
                const formattedDate = ep.updatedAt
                  ? new Date(ep.updatedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "2-digit",
                    })
                  : "";
                return (
                  <div
                    key={idx}
                    className="flex flex-col gap-2 cursor-pointer group"
                    onClick={() => switchEpisode(idx)}
                  >
                    <div
                      className={`relative aspect-video rounded-xl overflow-hidden border transition-colors ${active ? "border-red-600 ring-2 ring-red-600/30" : "border-white/10 group-hover:border-white/30"}`}
                    >
                      {ep.thumbnail || movie.poster || movie.backdrop ? (
                        <img
                          src={ep.thumbnail || movie.poster || movie.backdrop || undefined}
                          alt={ep.title || `Episode ${ep.number}`}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-white/5 flex items-center justify-center">
                          <Play className="w-8 h-8 text-white/20" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />

                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase shadow-lg shadow-black/50 border border-white/10">
                        S{((activeSeason || 0) + 1).toString().padStart(2, "0")}
                        E{ep.number?.toString().padStart(2, "0") || "00"}
                      </div>
                      {formattedDate && formattedDate !== "Invalid Date" && (
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-lg shadow-black/50 border border-white/10">
                          {formattedDate}
                        </div>
                      )}
                      <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-lg shadow-black/50 border border-white/10">
                        {ep.duration || "24m"}
                      </div>
                    </div>
                    <div className="flex flex-col px-1">
                      <h4
                        className={`text-sm font-bold line-clamp-1 transition-colors ${active ? "text-red-500" : "text-white group-hover:text-red-400"}`}
                      >
                        {ep.title || `Episode ${ep.number}`}
                      </h4>
                      <p className="text-[11px] text-white/50 line-clamp-2 mt-1 leading-relaxed">
                        {movie.synopsis || "No description available."}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {/* General Information (Collapsible General Notes) */}
      {!isThumbnailMode && (
        <div className="px-7 sm:px-[47px] lg:px-[56px] max-w-[2000px] mx-auto">
          <details className="mt-10 mb-2 group cursor-pointer border border-white/5 bg-white/5 rounded-2xl overflow-hidden [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-white/50 group-open:text-white transition-colors" />
                <span className="font-medium text-sm text-white/80 group-open:text-white transition-colors">
                  General Information
                </span>
              </div>
              <ChevronDown className="w-5 h-5 text-white/50 group-open:rotate-180 transition-transform duration-300" />
            </summary>
            <div className="p-4 sm:p-6 border-t border-white/5 flex flex-col gap-4 bg-[#000000]">
              <div className="flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-yellow-500 mt-1 shrink-0" />
                <p className="text-xs sm:text-sm text-white/70 leading-relaxed max-w-5xl">
                  <strong className="text-white">Note:</strong> The streaming
                  player includes ads originating from the distribution providers,
                  we do not place any ads on the player ourselves. We apologize
                  for any inefficiency. If the player suddenly stops, it is
                  usually due to a provider server issue or an unstable network
                  connection.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-4 h-4 mt-0.5 shrink-0 flex items-center justify-center text-[10px] bg-red-600 text-white rounded-full font-medium">
                  !
                </span>
                <p className="text-xs sm:text-sm text-white/50 leading-relaxed max-w-5xl">
                  <strong className="text-white/60">Tip for Mobile Users:</strong>{" "}
                  If you encounter pop-up ads within the player on your mobile
                  device, try tilting or rotating your smartphone to landscape
                  mode. Playing in landscape mode can often help you avoid or
                  easily dismiss these popups so you can enjoy a smoother viewing
                  experience.
                </p>
              </div>
            </div>
          </details>
        </div>
      )}

      <div className="max-w-[2000px] mx-auto border-t border-white/5 pt-8 px-7 sm:px-[47px] lg:px-[56px]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-red-600 rounded-full" />
            <h3 className="text-xl font-semibold text-white uppercase tracking-tighter flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-red-500" />
              You may also like
            </h3>
          </div>
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => scrollReco("left")}
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollReco("right")}
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-[10px] text-white/40 mb-3 font-medium">
          AI Smart Picks — tailored specifically for you based on the genres you
          watch the most.
        </p>
        <ScrollCarousel className="flex gap-2 snap-x snap-mandatory pb-6 pt-2 pl-8 sm:pl-12 lg:pl-16 pr-8 sm:pr-12 lg:pr-16">
          {smartRecommendations.map((rec) => (
            <button
              key={rec.id}
              onClick={() => onSwitchMovie(rec)}
              className="shrink-0 snap-start w-36 sm:w-40 md:w-44 group text-left flex flex-col cursor-pointer"
            >
              <div className="relative aspect-[2/3] w-full shrink-0 rounded-lg overflow-hidden bg-[#1a1a1a] shadow-md border border-white/10 group-hover:border-transparent active:scale-95 transition-all">
                {/* Hover Gradient Border (Orange at bottom) */}
                <div
                  className="absolute inset-0 z-50 pointer-events-none rounded-[inherit] border-[1.5px] border-transparent opacity-0 group-hover:opacity-100 transition-all duration-300"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(249,115,22,1) 0%, rgba(249,115,22,0) 100%) border-box",
                    WebkitMask:
                      "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
                    WebkitMaskComposite: "destination-out",
                    maskComposite: "exclude",
                  }}
                />
                <OptimizedImage
                  src={rec.poster || undefined}
                  alt={rec.title}
                  className="w-full h-full object-cover  transition-transform duration-700 opacity-80 group-hover:opacity-100"
                  quality="medium"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />

                {/* Rating Label (Small) */}
                <div className="absolute top-1.5 right-1.5 z-20 flex items-center gap-0.5 px-1 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[8px] font-black text-white border border-white/5">
                  <Star className="w-2 h-2 text-yellow-500 fill-yellow-500" />
                  {rec.rating}
                </div>

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-50 group-hover:scale-100">
                  <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-lg transform transition-transform">
                    <Play className="w-5 h-5 text-white fill-current translate-x-0.5" />
                  </div>
                </div>
              </div>
              <div className="mt-2.5 flex-1 flex flex-col items-start text-left">
                <h4
                  className="text-[11px] sm:text-xs font-medium text-white line-clamp-1 uppercase tracking-tight group-hover:text-red-400 transition-colors text-left"
                  translate="no"
                >
                  {rec.title}
                </h4>
                <div className="flex items-center justify-start gap-2 mt-1 w-full text-left">
                  <span className="text-[9px] font-medium text-white/40 uppercase tracking-widest text-left">
                    {rec.year}
                  </span>
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10 uppercase">
                    {rec.kind === "movie" ? "MOVIE" : "TV"}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </ScrollCarousel>
      </div>

      {/* Latest Updates Section (TV only) - Above Comments */}
      {movie.kind === "tv" && latestEpisodes.length > 0 && (
        <div className="max-w-[2000px] mx-auto border-t border-white/5 pt-8 px-7 sm:px-[47px] lg:px-[56px]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1.5 h-6 bg-red-600 rounded-full" />
            <h3 className="text-xl font-semibold text-white uppercase tracking-tighter flex items-center gap-2">
              <Clock className="w-5 h-5 text-red-500" />
              Latest Updates
            </h3>
          </div>

          <ScrollCarousel className="flex gap-2 sm:gap-3 pb-6 snap-x pt-2 pl-8 sm:pl-12 lg:pl-16 pr-8 sm:pr-12 lg:pr-16">
            {latestEpisodes.map((item: any, idx: number) => {
              const itemUrl = item.episode?.url || item.url || "";
              const ytId = getYouTubeId(itemUrl);
              const thumb =
                item.episodeThumbnail ||
                (ytId && ytId !== "videoseries"
                  ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
                  : item.episode?.thumbnail ||
                    item.backdrop ||
                    item.poster ||
                    movie.poster ||
                    "/placeholder-episode.jpg");
              return (
                <div
                  key={idx}
                  onClick={() => onSwitchMovie(item, item.episodeNumber - 1)}
                  className="group cursor-pointer flex-none w-[200px] sm:w-[240px] snap-start flex flex-col"
                >
                  <div className="relative aspect-video w-full shrink-0 rounded-2xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-red-500/50 transition-all duration-300 shadow-md">
                    <OptimizedImage
                      src={thumb}
                      alt={item.title}
                      className="w-full h-full object-cover  transition-transform duration-700 opacity-80 group-hover:opacity-100"
                      quality="medium"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all bg-black/20">
                      <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-lg transform transition-transform">
                        <Play className="w-5 h-5 text-white fill-current translate-x-0.5" />
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                      <h4 className="text-xs sm:text-sm font-semibold text-white line-clamp-1 uppercase tracking-tight group-hover:text-red-400 transition-colors drop-shadow-md">
                        {item.title}
                      </h4>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-start px-1 flex-1 text-left">
                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-500/10 px-1.5 py-0.5 rounded shrink-0 text-left">
                      EPISODE {item.episodeNumber}
                    </span>
                    <span className="text-[10px] font-medium text-white/50 uppercase tracking-tight truncate ml-2 text-left">
                      {item.episodeTitle || `Episode ${item.episodeNumber}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </ScrollCarousel>
        </div>
      )}

      {/* Main Content Area: Comments & Desktop Download */}
      <div className="max-w-[2000px] mx-auto flex flex-col lg:flex-row gap-8 lg:items-start border-t border-white/5 pt-8 px-7 sm:px-[47px] lg:px-[56px]">
        {/* Comments Section */}
        <div className="flex-1 min-w-0">
          {!isPremiumUser && settings?.adImage && (
            <div className="mb-8 w-full bg-[#000000] border-y border-white/5 flex justify-center overflow-hidden h-[60px] sm:h-[80px] md:h-[124px] shadow-2xl">
              <div className="block w-full max-w-7xl relative mx-auto h-full">
                <MediaBanner
                  mediaUrl={settings.adImage}
                  linkUrl={settings.adUrl || "#"}
                />
              </div>
            </div>
          )}
          <CommentSection
            contentId={String(movie.id)}
            user={user}
            isAdmin={isAdmin}
            onUserClick={onUserClick}
          />
        </div>

        {/* Download & Tutorial Section (Desktop Only) */}
        {renderDownloadSection(true)}
      </div>
      <AnimatePresence>
        {showDownloadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
            onClick={() => setShowDownloadModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-lg bg-[#000000] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-xl">
                    <Download className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">
                      Available Downloads
                    </h3>
                    <p
                      className="notranslate text-[10px] text-white/40 font-medium uppercase tracking-widest"
                      translate="no"
                    >
                      {movie.title}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-white/50" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scroll">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block">
                    Choose Download Server
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    {movie.downloadLinks?.map((dl, idx) => (
                      <a
                        key={idx}
                        href={dl.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-emerald-600 group transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <FileDown className="w-5 h-5 text-white/40 group-hover:text-white" />
                          <span className="font-black text-sm">{dl.name}</span>
                        </div>
                        <ExternalLink className="w-4 h-4 text-white/20 group-hover:text-white group-hover:opacity-100" />
                      </a>
                    ))}
                  </div>
                </div>

                {settings?.downloadTutorials &&
                  settings.downloadTutorials.length > 0 && (
                    <div className="space-y-4 pt-6 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-orange-400" />
                        <label className="text-[10px] font-black uppercase text-white/30 tracking-widest">
                          Guide & Tutorials
                        </label>
                      </div>
                      <div className="space-y-2">
                        {settings.downloadTutorials.map((tut, idx) => (
                          <a
                            key={idx}
                            href={tut.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-orange-600 transition-all group"
                          >
                            <Play className="w-3.5 h-3.5 text-red-500 group-hover:text-white fill-current" />
                            <span className="text-xs font-medium">
                              {tut.name}
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 ml-auto text-white/20 group-hover:text-white" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

              <div className="p-4 bg-white/5 flex items-center justify-center p-3">
                <p className="text-[10px] text-white/30 font-medium">
                  Links are provided by external servers. Be cautious with ads.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Episode Locker Side Panel (Desktop only) */}
      <AnimatePresence>
        {isLockerOpen && !isMobile && (
          <div className="fixed inset-0 z-[200] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLockerOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="relative w-full h-full bg-[#000000] border-l border-white/5 flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
              style={{ width: "min(100vw, 420px)" }}
            >
              {/* Locker Header */}
              <div className="p-6 border-b border-white/5 bg-white/5 backdrop-blur-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-600 rounded-xl shadow-[0_0_15px_rgba(220,38,38,0.4)]">
                    <LayoutList className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-white/90">
                      Episode Locker
                    </h3>
                    <p className="text-[10px] font-medium text-red-500 uppercase tracking-[0.2em]">
                      Season {activeSeason + 1}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsLockerOpen(false)}
                  className="p-2 rounded-full hover:bg-white/5 text-white/40 hover:text-white transition-all shadow-inner"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Connection Seasons - Horizontal Scroll */}
              {(sortedSeasonConnections.length > 0 ||
                (movie.seasons && movie.seasons.length > 1)) && (
                <div className="p-4 border-b border-white/5 bg-black/40">
                  <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-3 ml-1">
                    Connected Seasons
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none custom-scroll">
                    {/* Internal Seasons */}
                    {movie.seasons &&
                      movie.seasons.map((season, idx) => (
                        <button
                          key={`int-${idx}`}
                          onClick={() => setActiveSeason(idx)}
                          className={`flex flex-col items-center gap-1.5 shrink-0 group ${idx === activeSeason ? "scale-105" : "opacity-60 hover:opacity-100"}`}
                        >
                          <div
                            className={`w-16 h-24 relative rounded-lg overflow-hidden border-2 transition-all duration-300 ${idx === activeSeason ? "border-red-600 shadow-lg shadow-red-900/40" : "border-white/10 group-hover:border-white/30"}`}
                          >
                            <img
                              src={movie.poster || undefined}
                              className="w-full h-full object-cover"
                              alt=""
                            />
                            <div
                              className={`absolute inset-0 flex items-center justify-center bg-black/40 ${idx === activeSeason ? "opacity-0" : "opacity-100"}`}
                            >
                              <span className="text-[10px] font-black text-white">
                                {season.number}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`text-[9px] font-black uppercase tracking-tight ${idx === activeSeason ? "text-red-500" : "text-white/40"}`}
                          >
                            S{season.number}
                          </span>
                        </button>
                      ))}

                    {/* Connected Seasons */}
                    {sortedSeasonConnections.map((conn, idx) => {
                      const target = allContents.find(
                        (c) => String(c.id) === String(conn.contentId),
                      );
                      const isCurrent =
                        String(movie.id) === String(conn.contentId);
                      return (
                        <button
                          key={`ext-${conn.contentId || ""}-${idx}`}
                          disabled={isCurrent}
                          onClick={() => target && onSwitchMovie(target)}
                          className={`flex flex-col items-center gap-1.5 shrink-0 group ${isCurrent ? "scale-105" : "opacity-60 hover:opacity-100"}`}
                        >
                          <div
                            className={`w-16 h-24 relative rounded-lg overflow-hidden border-2 transition-all duration-300 ${isCurrent ? "border-red-600 shadow-lg shadow-red-900/40" : "border-white/10 group-hover:border-white/30"}`}
                          >
                            <img
                              src={target?.poster || movie.poster || undefined}
                              className="w-full h-full object-cover"
                              alt=""
                            />
                            <div
                              className={`absolute inset-0 flex items-center justify-center bg-black/40 ${isCurrent ? "opacity-0" : "opacity-100"}`}
                            >
                              <span className="text-[10px] font-black text-white">
                                {conn.seasonNumber}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`text-[9px] font-black uppercase tracking-tight ${isCurrent ? "text-red-500" : "text-white/40"}`}
                          >
                            S{conn.seasonNumber}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Search Box & Toggle */}
              <div className="p-4 bg-white/5 border-b border-white/5 flex gap-3">
                <div className="relative group flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-red-500 transition-colors" />
                  <input
                    type="text"
                    placeholder="Search episodes..."
                    value={episodeSearch}
                    onChange={(e) => setEpisodeSearch(e.target.value)}
                    className="w-full h-11 pl-11 pr-4 bg-black/40 border border-white/5 rounded-2xl text-xs font-medium text-white placeholder:text-white/20 focus:border-red-500/50 outline-none transition-all shadow-inner focus:bg-black/60"
                  />
                </div>
                <div className="flex bg-black/40 rounded-2xl border border-white/5 p-1 h-11 shrink-0 items-center justify-between gap-1 overflow-hidden shadow-inner">
                  <button
                    onClick={() => setLockerMode("list")}
                    className={`p-2 rounded-xl transition-all ${lockerMode === "list" ? "bg-white/10 text-white shadow-md shadow-black/20" : "text-white/40 hover:text-white hover:bg-white/5"}`}
                  >
                    <LayoutList className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setLockerMode("grid")}
                    className={`p-2 rounded-xl transition-all ${lockerMode === "grid" ? "bg-white/10 text-white shadow-md shadow-black/20" : "text-white/40 hover:text-white hover:bg-white/5"}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Episodes List/Grid */}
              <div
                className={`flex-1 overflow-y-auto custom-scroll p-4 ${lockerMode === "grid" ? "grid grid-cols-4 gap-2 content-start" : "space-y-2.5"}`}
              >
                {filteredEpisodes.map((ep, idx) => {
                  const realIdx = episodes.indexOf(ep);
                  const active = realIdx === activeEpisode;

                  if (lockerMode === "grid") {
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          switchEpisode(realIdx);
                          setIsLockerOpen(false);
                        }}
                        className={`w-full aspect-square flex flex-col items-center justify-center rounded-2xl transition-all border outline-none group ${active ? "bg-red-600/10 border-red-500 hover:bg-red-600/20 shadow-[0_0_15px_rgba(220,38,38,0.3)]" : "bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10"}`}
                      >
                        <span
                          className={`text-[10px] font-black uppercase tracking-widest ${active ? "text-red-500" : "text-white/30 group-hover:text-white/60"}`}
                        >
                          EP
                        </span>
                        <span
                          className={`text-xl sm:text-2xl font-black ${active ? "text-white" : "text-white/70 group-hover:text-white"}`}
                        >
                          {ep.number}
                        </span>
                      </button>
                    );
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        switchEpisode(realIdx);
                        setIsLockerOpen(false);
                      }}
                      className={`w-full group flex items-start gap-4 p-3 rounded-2xl transition-all border ${active ? "bg-red-600/10 border-red-500/40 shadow-[0_0_15px_rgba(220,38,38,0.1)]" : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"}`}
                    >
                      <div className="relative w-28 aspect-video rounded-xl overflow-hidden border border-white/10 shrink-0 shadow-lg bg-black">
                        {!ep.thumbnail && !movie.poster ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                              EP {ep.number}
                            </span>
                          </div>
                        ) : (
                          <img
                            src={ep.thumbnail || movie.poster || undefined}
                            className={`w-full h-full object-cover transition-transform duration-500 ${active ? "scale-105" : " opacity-70 group-hover:opacity-100"}`}
                            alt=""
                          />
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-5 h-5 text-white fill-white" />
                        </div>
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-[9px] font-black uppercase tracking-widest ${active ? "text-red-500" : "text-white/30 group-hover:text-white/60"}`}
                          >
                            EP {ep.number}
                          </span>
                          {active && (
                            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse shadow-[0_0_10px_rgba(220,38,38,1)]" />
                          )}
                        </div>
                        <h4
                          className={`text-xs font-medium truncate leading-tight ${active ? "text-white" : "text-white/60 group-hover:text-white"}`}
                        >
                          {ep.title || `Episode ${ep.number}`}
                        </h4>
                        <p className="text-[9px] font-medium text-white/20 mt-1 uppercase tracking-tighter">
                          HD 1080P Content
                        </p>
                      </div>
                    </button>
                  );
                })}
                {filteredEpisodes.length === 0 && (
                  <div
                    className={`col-span-full flex flex-col items-center justify-center py-12 opacity-30 gap-4`}
                  >
                    <Search className="w-10 h-10" />
                    <p className="text-xs font-medium uppercase tracking-widest">
                      No Episodes Found
                    </p>
                  </div>
                )}
              </div>

              {/* Locker Footer */}
              <div className="p-4 border-t border-white/5 bg-white/5/10 backdrop-blur-md">
                <div className="p-4 bg-red-600 rounded-2xl flex items-center justify-between shadow-[0_10px_20px_rgba(220,38,38,0.2)]">
                  <span className="text-[10px] font-black text-white/90 uppercase tracking-widest">
                    Selected {filteredEpisodes.length} Episodes
                  </span>
                  <Sparkles className="w-4 h-4 text-white animate-pulse" />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile-Only Episode Locker Dialog */}
      <AnimatePresence>
        {isMobile && isMobileLockerOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[99999] bg-[#000000] text-white flex flex-col"
          >
            {/* Season Selector at the very top */}
            <div className="p-4 border-b border-white/10 bg-zinc-950 flex flex-col gap-3 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 px-2.5 bg-red-600 text-white rounded-full text-[9px] font-black uppercase tracking-widest">
                    TV Show
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-red-500 flex items-center gap-2">
                    Episode List
                  </h3>
                </div>
                <button
                  onClick={() => setIsMobileLockerOpen(false)}
                  className="p-1.5 px-3 bg-white/15 hover:bg-white/20 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Close
                </button>
              </div>

              {/* Horizontal Season labels scroll */}
              {(sortedSeasonConnections.length > 0 ||
                (movie.seasons && movie.seasons.length > 1)) && (
                <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none select-none">
                  {/* Internal Seasons */}
                  {movie.seasons &&
                    movie.seasons.map((season, idx) => (
                      <button
                        key={`mob-int-${idx}`}
                        onClick={() => {
                          setActiveSeason(idx);
                          setEpisodeSearch(""); // Reset search on season switch
                        }}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0 transition-all ${
                          idx === activeSeason
                            ? "bg-red-600 text-white border-red-500 shadow-md shadow-red-900/20"
                            : "bg-white/5 text-white/50 border-white/5 hover:text-white"
                        }`}
                      >
                        S{season.number}
                      </button>
                    ))}

                  {/* Connected Seasons */}
                  {sortedSeasonConnections.map((conn, idx) => {
                    const target = allContents.find(
                      (c) => String(c.id) === String(conn.contentId),
                    );
                    const isCurrent =
                      String(movie.id) === String(conn.contentId);
                    return (
                      <button
                        key={`mob-ext-${conn.contentId || ""}-${idx}`}
                        disabled={isCurrent}
                        onClick={() => {
                          if (target) {
                            onSwitchMovie(target);
                            setIsMobileLockerOpen(false);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0 transition-all ${
                          isCurrent
                            ? "bg-red-600 text-white border-red-500"
                            : "bg-white/5 text-white/50 border-white/5 hover:text-white"
                        }`}
                      >
                        S{conn.seasonNumber} (ext)
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Search Box + Layout Selector (Compact for Mobile) */}
            <div className="p-3 border-b border-white/5 bg-zinc-900 flex gap-2 shrink-0 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  placeholder="Search episodes..."
                  value={episodeSearch}
                  onChange={(e) => setEpisodeSearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 bg-white/5 border border-white/5 rounded-xl text-xs font-semibold text-white placeholder:text-white/30 focus:border-red-600 outline-none transition-all"
                />
              </div>

              <div className="flex bg-white/5 rounded-xl border border-white/5 p-1 h-10 items-center gap-0.5 shrink-0">
                <button
                  onClick={() => setLockerMode("list")}
                  className={`p-1.5 rounded-lg transition-all ${
                    lockerMode === "list"
                      ? "bg-red-600 text-white shadow"
                      : "text-white/40"
                  }`}
                >
                  <LayoutList className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setLockerMode("grid")}
                  className={`p-1.5 rounded-lg transition-all ${
                    lockerMode === "grid"
                      ? "bg-red-600 text-white shadow"
                      : "text-white/40"
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Episodes Panel for Mobile (List Mode of grid 4xX mode) */}
            <div className="flex-1 overflow-y-auto p-4 bg-[#050508] custom-scroll">
              {lockerMode === "grid" ? (
                <div className="grid grid-cols-4 gap-2.5">
                  {filteredEpisodes.map((ep, idx) => {
                    const realIdx = episodes.indexOf(ep);
                    const active = realIdx === activeEpisode;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          switchEpisode(realIdx);
                          setIsMobileLockerOpen(false);
                        }}
                        className={`aspect-square flex flex-col items-center justify-center rounded-xl transition-all border outline-none ${
                          active
                            ? "bg-red-600/20 border-red-500 shadow-lg shadow-red-900/30"
                            : "bg-white/5 border-white/5"
                        }`}
                      >
                        <span
                          className={`text-[8px] font-black uppercase tracking-wider ${active ? "text-red-500" : "text-white/30"}`}
                        >
                          EP
                        </span>
                        <span
                          className={`text-sm font-black ${active ? "text-white" : "text-white/80"}`}
                        >
                          {ep.number}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredEpisodes.map((ep, idx) => {
                    const realIdx = episodes.indexOf(ep);
                    const active = realIdx === activeEpisode;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          switchEpisode(realIdx);
                          setIsMobileLockerOpen(false);
                        }}
                        className={`w-full flex items-center gap-3.5 p-2 rounded-xl transition-all border text-left ${
                          active
                            ? "bg-red-600/20 border-red-500/40"
                            : "bg-white/5 border-white/5 hover:bg-white/10"
                        }`}
                      >
                        <div className="relative w-24 aspect-video rounded-lg overflow-hidden border border-white/10 shrink-0 bg-black">
                          {ep.thumbnail || movie.poster ? (
                            <img
                              src={ep.thumbnail || movie.poster || undefined}
                              className={`w-full h-full object-cover ${active ? "scale-105" : "opacity-75"}`}
                              alt=""
                              referrerPolicy="no-referrer"
                              loading="lazy"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-[9px] font-black text-white/30">
                                EP {ep.number}
                              </span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <Play className="w-4 h-4 text-white/80 fill-white/20" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span
                              className={`text-[9px] font-medium uppercase tracking-wider ${active ? "text-red-500" : "text-white/30"}`}
                            >
                              Episode {ep.number}
                            </span>
                            {active && (
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
                            )}
                          </div>
                          <h4
                            className={`text-xs font-medium leading-tight truncate ${active ? "text-white" : "text-white/70"}`}
                          >
                            {ep.title || `Episode ${ep.number}`}
                          </h4>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {filteredEpisodes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 opacity-30 gap-3">
                  <Search className="w-8 h-8" />
                  <p className="text-xs font-black uppercase tracking-widest text-center">
                    No Episodes Found
                  </p>
                </div>
              )}
            </div>

            {/* Simple Footer metadata */}
            <div className="p-3 border-t border-white/5 bg-zinc-950 flex items-center justify-between text-[10px] text-white/45 font-black uppercase tracking-wider pb-safe-bottom">
              <span>{filteredEpisodes.length} Episodes Loaded</span>
              <span>HD 1080P STREAMS</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.main>
  );
}
