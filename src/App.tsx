import { createPortal } from "react-dom";
import { ScrollCarousel } from "./components/ScrollCarousel";
import { OptimizedImage } from "./components/UIComponents";
import { SectionHeader } from "./components/UIComponents";
import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  memo,
  type ReactNode,
} from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import {
  Search,
  X,
  AlertCircle,
  Play,
  Star,
  Clock,
  Calendar,
  MonitorPlay,
  Menu,
  Filter,
  Heart,
  Share2,
  Tv,
  Film as FilmIcon,
  Command,
  CornerDownLeft,
  Hash,
  Flame,
  TrendingUp,
  History,
  ArrowUp,
  ArrowDown,
  Bookmark,
  BookmarkCheck,
  Trash2,
  AlertTriangle,
  ExternalLink,
  Plus,
  RefreshCw,
  Check,
  Bell,
  Layers,
  ChevronDown,
  ChevronLeft,
  User,
  LogIn,
  Music,
  Pause,
  ShieldCheck,
  ThumbsUp,
  Settings,
  Trophy,
  Sparkles,
  Crown,
  MessageCircle,
  WifiOff,
  Volume2,
  VolumeX,
  Download,
  Cpu,
  MessageSquare,
  PlayCircle,
  Activity,
  ShieldAlert,
} from "lucide-react";
import { useUserData } from "./hooks/useUserData";
import { checkSpamAndTriggerCooldown } from "./lib/spamProtector";
import {
  useContent,
  getGlobalContents,
  type Content,
} from "./hooks/useContent";
import { useIsMobile } from "./hooks/useIsMobile";
import { useSettings } from "./hooks/useSettings";
import {
  db,
  doc as fbDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  handleFirestoreError,
  OperationType,
  writeBatch,
  increment,
  serverTimestamp,
  getDocs,
} from "./lib/firebase";
import { BRAND_LOGO_URL, BRAND_NAME, BRAND_SLOGAN } from "./constants/brand";
import ToastStack from "./components/ToastStack";
import ShareDialog from "./components/ShareDialog";
import { CollectionEmpty } from "./components/UIComponents";
import { LanguageSwitcher } from "./components/UIComponents";
import MobileNav from "./components/MobileNav";
import AdminLogin from "./components/AdminLogin";
import { ProfileSettingsRoute } from "./pages/ProfileSettingsRoute";
import StreamingPage, {
  IframeSecurityShield,
} from "./components/StreamingPage";
import AdminDashboard from "./pages/AdminDashboard";
import LoginRoute from "./pages/LoginRoute";
import { PrivacyRoute, TermsRoute } from "./pages/LegalRoutes";
import { NeedHelpRoute, ReportBugRoute } from "./pages/HelpAndBugRoutes";
import { LanguageRoute } from "./pages/LanguageRoute";
import { ProfileRoute } from "./pages/ProfileRoute";
import { NotificationUser } from "./pages/NotificationUser";
import { ViyieSubscription } from "./pages/ViyieSubscription";
import ViyieOpening from "./pages/ViyieOpening";
import NetworkBlockScreen from "./components/NetworkBlockScreen";
import OnboardingModal from "./components/OnboardingModal";
import { AudioPlayer } from "./components/UIComponents";
import { saveTrack, getAllTracks, deleteTrack } from "./utils/musicDb";
import { ContinueWatching } from "./components/ContinueWatching";
import { SimplePagination } from "./components/UIComponents";
import { ViyiePlayerUI } from "./components/ViyiePlayer";
import { MediaBanner } from "./components/UIComponents";

// Format watched time as relative (e.g. "2 jam lalu")
function formatRelativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} mins ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hours ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} days ago`;
  const week = Math.floor(day / 7);
  if (week < 4) return `${week} weeks ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month} months ago`;
  const year = Math.floor(day / 365);
  return `${year} years ago`;
}

function slugifyTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getLastEpisodeNumber(movie: any): number {
  if (!movie) return 0;
  let allEps = [...(movie.episodes || [])];

  const mainId = movie.syncMainId || movie.id;
  const allContents = getGlobalContents();
  if (
    movie.type === "tv" &&
    mainId &&
    allContents &&
    Array.isArray(allContents)
  ) {
    const subPages = allContents.filter(
      (c) =>
        c.id !== mainId &&
        (c.syncMainId === mainId ||
          String(c.id).startsWith(String(mainId) + "-page")),
    );
    subPages.forEach((p) => {
      if (p.episodes && Array.isArray(p.episodes)) {
        allEps = allEps.concat(p.episodes);
      }
    });
  }

  if (allEps.length === 0) return 0;
  const numbers = allEps.map((e) => Number(e.number) || 0);
  return Math.max(...numbers, 0);
}

// Helper to isolate movie/episode specifications based on token string
function parseViyieParam(param: string, contents: Content[]) {
  let contentId = param;
  let episodeNum: number | null = null;

  if (param.includes("-ep-")) {
    const parts = param.split("-ep-");
    contentId = parts[0];
    episodeNum = parseInt(parts[1], 10);
  } else if (param.includes("_ep")) {
    const parts = param.split("_ep");
    contentId = parts[0];
    episodeNum = parseInt(parts[1], 10);
  }

  if (contentId.startsWith("movie-")) {
    contentId = contentId.replace("movie-", "");
  } else if (contentId.startsWith("show-")) {
    contentId = contentId.replace("show-", "");
  }

  let content = contents.find((c) => String(c.id) === String(contentId));
  if (!content) {
    // Strip trailing random letters slug (e.g. -abcdef or -kpxqwa)
    const trimmedId = contentId.replace(/-[a-z]+$/i, "");
    content = contents.find((c) => String(c.id) === String(trimmedId));
  }
  if (!content) {
    const firstDash = contentId.indexOf("-");
    if (firstDash > 0) {
      const candidateId = contentId.substring(0, firstDash);
      content = contents.find((c) => String(c.id) === String(candidateId));
    }
  }
  if (!content) {
    content = contents.find(
      (c) =>
        c.title.toLowerCase().replace(/[^a-z0-9]/g, "-") ===
        contentId.replace(/-[a-z]+$/i, "")
    );
  }
  if (!content) return null;

  let playUrl = content.streamUrl || content.embedUrl || "";
  let subtitle = "";
  let title = content.title;

  if (episodeNum !== null && content.episodes && content.episodes.length > 0) {
    const ep =
      content.episodes.find((e) => e.number === episodeNum) ||
      content.episodes[episodeNum - 1] ||
      content.episodes[0];
    if (ep) {
      playUrl = ep.url || "";
      title = `${content.title} - Episode ${ep.number}: ${ep.title}`;
      const customSv = ep.servers?.find(
        (s) =>
          s.isCustomPlayer ||
          s.name === "Remote Drive" ||
          s.name === "Remote Drive Player" ||
          s.name === "Video Remote" ||
          s.name?.toLowerCase().includes("remote drive") ||
          s.name?.toLowerCase().includes("viyie"),
      );
      if (customSv) {
        playUrl = customSv.streamUrl || customSv.embedUrl;
        subtitle = customSv.customSubtitle || "";
      } else if (ep.isCustomPlayer) {
        subtitle = ep.customSubtitle || "";
      }
    }
  } else {
    const customSv = content.servers?.find(
      (s) =>
        s.isCustomPlayer ||
        s.name === "Remote Drive" ||
        s.name === "Remote Drive Player" ||
        s.name === "Video Remote" ||
        s.name?.toLowerCase().includes("remote drive") ||
        s.name?.toLowerCase().includes("viyie"),
    );
    if (customSv) {
      playUrl = customSv.streamUrl || customSv.embedUrl;
      subtitle = customSv.customSubtitle || "";
    } else if (content.isCustomPlayer) {
      subtitle = content.customSubtitle || "";
    }
  }

  return {
    content,
    playUrl,
    subtitle,
    title,
    episodeNum,
  };
}

// Standalone Embedding Player Page component
function ViyiePlayoutEmbed({
  param,
  contents,
}: {
  param: string;
  contents: Content[];
}) {
  const result = parseViyieParam(param, contents);

  if (!result || !result.playUrl) {
    return (
      <div className="fixed inset-0 bg-[#060606] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 rounded-full bg-red-600/10 flex items-center justify-center border border-red-500/20 mb-4 animate-bounce">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-lg font-black text-white tracking-widest uppercase mb-1">
          Stream Content Unresolved
        </h1>
        <p className="text-xs text-white/50 max-w-sm font-sans">
          The streaming code or file parameter is either missing, deleted, or
          has been taken down by server security.
        </p>
      </div>
    );
  }

  const videoObject = useMemo(() => {
    if (!result) return null;
    return {
      id: result.content?.id || "standalone-embed",
      videoUrl: result.playUrl,
      title: result.title || "Video Playback",
      posterUrl: result.content?.poster || "",
      subtitles: result.subtitle 
        ? [{ lang: "Default", url: result.subtitle }] 
        : (result.content?.subtitles || []),
    };
  }, [result]);

  return (
    <div className="fixed inset-0 bg-[#0a0a0c] z-[9999] flex flex-col justify-between overflow-hidden">
      <div className="absolute inset-0 bg-[#0a0a0c] flex items-center justify-center">
        <div className="w-full h-full max-h-[100vh] aspect-video relative">
          {videoObject && <ViyiePlayerUI video={videoObject} />}
        </div>
      </div>
    </div>
  );
}

// Standalone Advertising & Downloader Landing Page component
function ViyieDownloadGate({
  param,
  contents,
}: {
  param: string;
  contents: Content[];
}) {
  const result = parseViyieParam(param, contents);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadStep, setDownloadStep] = useState<"holding" | "final">(
    "holding",
  );
  const [timerSeconds, setTimerSeconds] = useState(10);

  useEffect(() => {
    if (downloadStep === "holding") {
      const interval = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setDownloadStep("final");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [downloadStep]);

  if (!result || !result.playUrl) {
    return (
      <div className="fixed inset-0 bg-[#060606] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 rounded-full bg-red-600/10 flex items-center justify-center border border-red-500/20 mb-4 animate-bounce">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-lg font-bold text-white tracking-widest uppercase mb-1">
          Download Resource Broken
        </h1>
        <p className="text-xs text-white/50 max-w-sm font-sans font-normal">
          The download entry either does not exist or was removed due to DMCA
          complaints.
        </p>
      </div>
    );
  }

  const downloadIntervalRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (downloadIntervalRef.current) {
        clearInterval(downloadIntervalRef.current);
      }
    };
  }, []);

  const handleStartDownload = () => {
    setDownloadProgress(0);
    if (downloadIntervalRef.current) {
      clearInterval(downloadIntervalRef.current);
    }
    downloadIntervalRef.current = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev === null) return 0;
        if (prev >= 100) {
          if (downloadIntervalRef.current) {
            clearInterval(downloadIntervalRef.current);
            downloadIntervalRef.current = null;
          }
          const element = document.createElement("a");
          element.href = result.playUrl;
          element.setAttribute(
            "download",
            `${result.content.title || "video"}.mp4`,
          );
          element.target = "_blank";
          document.body.appendChild(element);
          element.click();
          document.body.removeChild(element);
          return 100;
        }
        return prev + Math.floor(Math.random() * 20) + 5;
      });
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[#070707] text-white flex flex-col items-center justify-center p-4 md:p-8 font-sans">
      <div className="w-full max-w-xl bg-zinc-950/80 border border-white/5 rounded-3xl p-6 md:p-8 backdrop-blur-2xl shadow-[0_0_50px_rgba(239,68,68,0.05)] text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-red-500/10 rounded-full blur-[80px]" />

        <div className="flex items-center justify-center gap-1.5 mb-6 text-red-500 font-bold tracking-widest text-xs uppercase animate-pulse">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Viyie Secure Hub
        </div>

        <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight mb-2">
          {result.title}
        </h1>
        <p className="text-[11px] text-white/40 mb-6 font-mono bg-white/[0.02] inline-block px-3 py-1 rounded-full border border-white/5 font-normal">
          Type: {result.content.type === "tv" ? "TV Episode" : "Movie Stream"} |
          Size: ~1.2 GB
        </p>

        {downloadStep === "holding" && (
          <div className="space-y-6">
            <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl relative">
              <div className="text-xs font-bold text-white mb-2 flex items-center justify-center gap-2">
                <Cpu className="w-4 h-4 text-red-500 animate-spin-slow" />
                <span>Preparing Secure High-Speed Mirror...</span>
              </div>
              <p className="text-[11.5px] text-white/50 leading-relaxed mb-4 font-normal">
                Please wait while our proxy encoder checks Google Drive link
                status for malicious safety bypass issues.
              </p>

              <div className="relative w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-mono font-bold text-lg">
                {timerSeconds}
                <div className="absolute inset-0 rounded-full border-2 border-red-500/40 border-t-transparent animate-spin-slow" />
              </div>
            </div>

            <div className="p-4 bg-zinc-900/60 border border-white/5 rounded-xl text-left flex items-start gap-3">
              <span className="text-[8px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold tracking-wider uppercase inline-block mt-0.5">
                Sponsor
              </span>
              <div className="space-y-0.5">
                <div className="text-[11px] font-semibold text-white/80">
                  Premium Access VPN: Protect From Kominfo Blocks
                </div>
                <p className="text-[10px] text-white/40 font-normal">
                  Encrypt your connection and access unlimited global movie hubs
                  completely secure and anonymous.
                </p>
              </div>
            </div>
          </div>
        )}

        {downloadStep === "final" && (
          <div className="space-y-5">
            <div className="p-6 bg-red-500/[0.02] border border-red-500/10 rounded-2xl">
              <div className="text-sm font-bold text-white mb-1 flex items-center justify-center gap-2">
                <ShieldCheck className="w-4.5 h-4.5 text-red-500" />
                <span>Your Mirror Link is Armed</span>
              </div>
              <p className="text-xs text-white/50 mb-5 font-normal">
                You are downloading from high-performance proxy nodes securely
                bypassing ISP limitations.
              </p>

              {downloadProgress === null ? (
                <button
                  onClick={handleStartDownload}
                  className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white text-xs font-bold uppercase tracking-wider py-3 rounded-xl transition-all duration-150 shadow-[0_0_20px_rgba(220,38,38,0.35)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer pointer-events-auto"
                >
                  <Download className="w-4 h-4" />
                  <span>Start Standalone Download</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(220,38,38,0.5)]"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-white/50 font-normal">
                    <span>Downloading: {downloadProgress}%</span>
                    <span>
                      {downloadProgress === 100
                        ? "Ready!"
                        : "Bypassing restrictions..."}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {downloadProgress === 100 && (
              <p className="text-[10.5px] text-green-400 font-normal animate-pulse flex items-center justify-center gap-1.5">
                <Check className="w-3.5 h-3.5 animate-bounce" />
                Your browser began safe-mirror transmission download
                downloading.
              </p>
            )}
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between text-[9px] text-white/30 font-normal">
          <span>Safe Encrypted Sync SSL</span>
          <span>Bypassing Kominfo Redirection</span>
        </div>
      </div>
    </div>
  );
}

function homePath() {
  return "/home";
}

function streamPath(movie: Content) {
  return `/home/${slugifyTitle(movie.title)}`;
}

function movieFromLocationPath(contents: Content[]) {
  const path = window.location.pathname;
  const match = path.match(/\/home\/([^/?#]+)/);
  if (!match) return null;

  let slug = match[1];
  try {
    slug = decodeURIComponent(match[1]);
  } catch (err) {
    // Fallback if decodeURIComponent fails on malformed sequence
  }

  // Try exact ID match first
  const byId = contents.find((m) => m.id === slug);
  if (byId) return byId;

  return contents.find((m) => slugifyTitle(m.title) === slug) || null;
}

const NETWORKS = [
  {
    name: "Netflix",
    logo: "https://cdn.corenexis.com/files/c/1361972720.png",
    color: "from-[#E50914] to-[#B20710]",
  },
  {
    name: "HBO Max",
    logo: "https://cdn.corenexis.com/files/c/5163285720.png",
    color: "from-[#9102FF] to-[#5C01A4]",
  },
  {
    name: "Disney+",
    logo: "https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg",
    color: "from-[#0063E5] to-[#003C8A]",
  },
  {
    name: "Prime Video",
    logo: "https://cdn.corenexis.com/files/c/3582936720.png",
    color: "from-[#00A8E1] to-[#007BA4]",
  },
  {
    name: "Apple TV+",
    logo: "https://upload.wikimedia.org/wikipedia/commons/2/28/Apple_TV_Plus_Logo.svg",
    color: "from-[#222] to-[#000]",
  },
  {
    name: "Hulu",
    logo: "https://cdn.corenexis.com/files/c/3767345720.png",
    color: "from-[#1CE783] to-[#16B767]",
  },
  {
    name: "iQIYI",
    logo: "https://cdn.corenexis.com/files/c/4524968720.png",
    color: "from-[#FF0000] to-[#CC0000]",
  },
  {
    name: "Viu",
    logo: "https://cdn.corenexis.com/files/c/3315581720.png",
    color: "from-[#FFF200] to-[#FFD700]",
  },
  {
    name: "Crunchyroll",
    logo: "https://cdn.corenexis.com/files/c/1541131720.png",
    color: "from-[#F47521] to-[#D65D1B]",
  },
  {
    name: "Bilibili",
    logo: "https://cdn.corenexis.com/files/c/9733599720.png",
    color: "from-[#00A1D6] to-[#0087B3]",
  },
];

const GRID_COLS =
  "grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3";
const PREVIEW_GRID_COLS =
  "grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3";

const sharedObserver =
  typeof window !== "undefined"
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const el = entry.target as HTMLDivElement;
              const callback = (el as any)._onIntersect;
              if (callback) {
                callback();
                if (sharedObserver) sharedObserver.unobserve(el);
                (el as any)._onIntersect = null;
              }
            }
          });
        },
        { rootMargin: "300px" }, // Optimized margin to load exactly when entering viewport
      )
    : null;

function LazyRender({ children }: { children: ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!sharedObserver) {
      setIsVisible(true);
      return;
    }

    (el as any)._onIntersect = () => setIsVisible(true);
    sharedObserver.observe(el);

    return () => {
      if (sharedObserver) sharedObserver.unobserve(el);
      (el as any)._onIntersect = null;
    };
  }, []);

  return (
    <div
      ref={ref}
      className={
        !isVisible
          ? "w-full h-full min-h-[175px] md:min-h-[250px] bg-white/5 rounded-lg shrink-0"
          : "w-full h-full shrink-0 contents"
      }
    >
      {isVisible ? children : null}
    </div>
  );
}

// Highlight matched substring
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const regex = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi",
  );
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-red-600/30 text-red-100 rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

interface Suggestion {
  type: "movie" | "genre" | "year" | "recent" | "trending";
  movie?: Content;
  label: string;
  meta?: string;
}

function SearchBox({
  searchQuery,
  setSearchQuery,
  onSelectMovie,
  recentSearches,
  addRecentSearch,
  isExpanded,
  setIsExpanded,
  allowCollapse = true,
  contents,
}: {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSelectMovie: (m: Content) => void;
  recentSearches: string[];
  addRecentSearch: (q: string) => void;
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;
  allowCollapse?: boolean;
  contents: Content[];
}) {
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isWindows =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    /win/i.test(navigator.userAgent || "");
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Build suggestions
  const suggestions = useMemo<Suggestion[]>(() => {
    const q = searchQuery.trim().toLowerCase();

    if (!q) {
      // Empty: show recent + trending
      const items: Suggestion[] = [];
      recentSearches
        .slice(0, 4)
        .forEach((r) => items.push({ type: "recent", label: r }));
      contents
        .filter((m) => m.isTrending)
        .slice(0, 5)
        .forEach((m) =>
          items.push({
            type: "trending",
            movie: m,
            label: m.title,
            meta: `${m.releaseDate.split("-")[0]} · ⭐ ${m.rating}`,
          }),
        );
      return items;
    }

    const items: Suggestion[] = [];

    // Movie matches (title or duration)
    contents.forEach((m) => {
      if (
        m.title.toLowerCase().includes(q) ||
        (m.duration && m.duration.toLowerCase().includes(q))
      ) {
        items.push({
          type: "movie",
          movie: m,
          label: m.title,
          meta: `${m.releaseDate.split("-")[0]} · ${
            m.type === "tv"
              ? `TV ${(() => {
                  const last = getLastEpisodeNumber(m);
                  return last ? `(${last} Eps)` : "";
                })()}`
              : m.duration || ""
          } · ⭐ ${m.rating}`,
        });
      }
    });

    // Genre matches
    const allGenresSet = new Set<string>();
    contents.forEach((c) => c.genres.forEach((g) => allGenresSet.add(g)));

    Array.from(allGenresSet).forEach((g) => {
      if (g.toLowerCase().includes(q)) {
        const count = contents.filter((m) => m.genres.includes(g)).length;
        items.push({
          type: "genre",
          label: g,
          meta: `${count} titles`,
        });
      }
    });

    return items.slice(0, 8);
  }, [searchQuery, recentSearches, contents]);

  // Reset active index when suggestions change
  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setTimeout(() => setIsExpanded(false), 300);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [setIsExpanded]);

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsExpanded(true);
        // Use a slight delay to ensure input is rendered if it was collapsed
        const timer = setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            setOpen(true);
          }
        }, 150);
        return () => clearTimeout(timer);
      }
      if (e.key === "Escape") {
        if (open) {
          setOpen(false);
        } else if (isExpanded && allowCollapse) {
          setTimeout(() => setIsExpanded(false), 300);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, isExpanded, allowCollapse, setIsExpanded]);

  const handleSelect = useCallback(
    (s: Suggestion) => {
      if (s.type === "movie" || s.type === "trending") {
        if (s.movie) {
          addRecentSearch(s.movie.title);
          onSelectMovie(s.movie);
          setSearchQuery("");
          setOpen(false);
        }
      } else if (s.type === "recent") {
        setSearchQuery(s.label);
      } else {
        // genre / year -> apply to search
        setSearchQuery(s.label);
        addRecentSearch(s.label);
        setOpen(false);
      }
    },
    [addRecentSearch, onSelectMovie, setSearchQuery],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions[activeIndex]) {
        handleSelect(suggestions[activeIndex]);
      } else if (searchQuery.trim()) {
        addRecentSearch(searchQuery.trim());
        setOpen(false);
      }
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full flex justify-end">
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[240] bg-[#070707]/90 backdrop-blur-md pointer-events-auto"
              onClick={() => {
                setOpen(false);
                if (allowCollapse) setIsExpanded(false);
              }}
            />
          )}
        </AnimatePresence>,
        document.body
      )}
      {/* Jika tidak expanded, tampilkan tombol search biasa */}
      {!isExpanded ? (
        <button
          onClick={() => {
            setIsExpanded(true);
            setTimeout(() => {
              inputRef.current?.focus();
              setOpen(true);
            }, 100);
          }}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:text-red-400 hover:bg-white/10 hover:drop-shadow-[0_0_8px_rgba(255,0,0,0.8)] transition-all duration-300"
        >
          <Search className="w-5 h-5" />
        </button>
      ) : (
        <div className="w-full flex items-center gap-2">
          <div
            className={`flex-1 relative group transition-all duration-300 ${
              open ? "scale-[1.01]" : ""
            }`}
          >
            <div
              className={`relative flex items-center h-10 sm:h-12 rounded-lg border transition-all ${
                open
                  ? "bg-[#100808]/95 border-red-600/80"
                  : "bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10"
              }`}
            >
              <Search
                className={`absolute left-4 w-5 h-5 transition-colors ${
                  open ? "text-red-400" : "text-white/40"
                }`}
              />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => {
                  setOpen(true);
                  setIsExpanded(true);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search title, genre, year..."
                className="w-full h-full pl-12 pr-24 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none rounded-lg"
              />
              <div className="absolute right-3 flex items-center gap-2">
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      if (inputRef.current) inputRef.current.focus();
                    }}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {!searchQuery && (
                  <kbd className="hidden sm:flex items-center gap-1 px-2 h-6 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-white/40 mr-1 select-none">
                    <Command className="w-2.5 h-2.5" />K
                  </kbd>
                )}
              </div>
            </div>

            {/* Suggestions & No Results Dropdown (nested to align perfectly with input bounds) */}
            <AnimatePresence>
              {open && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 right-0 mt-2 z-[500] w-full"
                >
                  <div
                    className={`relative overflow-hidden rounded-md border ${isWindows ? "bg-[#070707]/98 border-zinc-700 shadow-[0_25px_60px_rgba(0,0,0,0.9)]" : "bg-[#070707]/95 backdrop-blur-xl border-white/10 shadow-2xl shadow-black/70"}`}
                  >
                    {/* Decorative gradient corner */}
                    <div className="absolute -top-20 -right-20 w-40 h-40 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

                    {/* Header strip */}
                    {!searchQuery.trim() && (
                      <div className="relative px-4 py-2 border-b border-white/5 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                          {recentSearches.length > 0
                            ? "Recent & Trending"
                            : "Trending Now"}
                        </span>
                        <Flame className="w-3 h-3 text-red-500" />
                      </div>
                    )}
                    {searchQuery.trim() && (
                      <div className="relative px-4 py-2 border-b border-white/5 flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                          {suggestions.length} results for
                        </span>
                        <span className="text-[10px] text-red-500 font-mono truncate">
                          "{searchQuery}"
                        </span>
                      </div>
                    )}

                    {/* Suggestions list */}
                    <div className="relative max-h-[60vh] overflow-y-auto custom-scroll py-1">
                      {suggestions.map((s, idx) => {
                        const isActive = idx === activeIndex;
                        return (
                          <button
                            key={`${s.type}-${s.label}-${idx}`}
                            onMouseEnter={() => setActiveIndex(idx)}
                            onClick={() => handleSelect(s)}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-all relative ${
                              isActive ? "bg-white/5" : ""
                            }`}
                          >
                            {/* Active indicator bar */}
                            {isActive && (
                              <motion.div
                                layoutId="activeBar"
                                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-10 bg-gradient-to-b from-red-500 to-red-600 rounded-r-full"
                              />
                            )}

                            {/* Thumbnail / Icon */}
                            {s.movie ? (
                              <div className="w-14 h-20 shrink-0 rounded-md overflow-hidden bg-[#1a1a1a] border border-white/5">
                                <img
                                  src={s.movie.poster || undefined}
                                  alt={s.movie.title}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (
                                      e.target as HTMLImageElement
                                    ).style.opacity = "0.3";
                                  }}
                                />
                              </div>
                            ) : (
                              <div
                                className={`w-12 h-12 shrink-0 rounded-md flex items-center justify-center border ${
                                  s.type === "recent"
                                    ? "bg-white/5 border-white/10 text-white/50"
                                    : s.type === "genre"
                                      ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                                      : "bg-red-600/10 border-red-600/20 text-red-400"
                                }`}
                              >
                                {s.type === "recent" ? (
                                  <History className="w-4 h-4" />
                                ) : s.type === "genre" ? (
                                  <Hash className="w-4 h-4" />
                                ) : (
                                  <Calendar className="w-4 h-4" />
                                )}
                              </div>
                            )}

                            {/* Label */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p
                                  className="text-sm font-medium text-white truncate"
                                  translate="no"
                                >
                                  <HighlightMatch
                                    text={s.label}
                                    query={searchQuery}
                                  />
                                </p>
                                {s.type === "trending" && (
                                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-600/20 text-red-400 uppercase">
                                    Hot
                                  </span>
                                )}
                                {s.type === "movie" && s.movie?.isNew && (
                                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-600/20 text-red-400 uppercase">
                                    New
                                  </span>
                                )}
                              </div>
                              {s.meta && (
                                <p className="text-[11px] text-white/40 truncate mt-0.5">
                                  {s.meta}
                                </p>
                              )}
                              {s.movie && (
                                <div className="flex items-center gap-1 mt-1 flex-wrap">
                                  {s.movie.genres.slice(0, 3).map((g) => (
                                    <span
                                      key={g}
                                      className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/40"
                                    >
                                      {g}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Action hint */}
                            {isActive && (
                              <div className="hidden sm:flex items-center gap-1 text-[10px] text-white/40 shrink-0">
                                <CornerDownLeft className="w-3 h-3" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Footer with shortcut hints */}
                    <div className="relative px-4 py-2 border-t border-white/5 flex items-center justify-between text-[10px] text-white/30">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <kbd className="flex items-center justify-center w-4 h-4 rounded bg-white/5 border border-white/10">
                            <ArrowUp className="w-2 h-2" />
                          </kbd>
                          <kbd className="flex items-center justify-center w-4 h-4 rounded bg-white/5 border border-white/10">
                            <ArrowDown className="w-2 h-2" />
                          </kbd>
                          <span>navigation</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <kbd className="flex items-center justify-center px-1 h-4 rounded bg-white/5 border border-white/10 font-mono">
                            ↵
                          </kbd>
                          <span>select</span>
                        </span>
                        <span className="hidden sm:flex items-center gap-1">
                          <kbd className="flex items-center justify-center px-1 h-4 rounded bg-white/5 border border-white/10 font-mono">
                            esc
                          </kbd>
                          <span>close</span>
                        </span>
                      </div>
                      <img
                        src={settings?.brandLogo || BRAND_LOGO_URL}
                        alt={BRAND_NAME}
                        className="h-3 w-auto object-contain opacity-60"
                        draggable={false}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
              {open && suggestions.length === 0 && searchQuery.trim() && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute top-full left-0 right-0 mt-2 z-[500] w-full"
                >
                  <div
                    className={`rounded-2xl border p-6 text-center ${isWindows ? "bg-[#070707]/98 border-zinc-700 shadow-[0_25px_60px_rgba(0,0,0,0.9)]" : "bg-[#070707]/95 backdrop-blur-xl border-white/10 shadow-2xl"}`}
                  >
                    <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-white/5 flex items-center justify-center">
                      <Search className="w-4 h-4 text-white/30" />
                    </div>
                    <p className="text-sm font-medium text-white/60">
                      No results found for{" "}
                      <span className="text-red-400">"{searchQuery}"</span>
                    </p>
                    <p className="text-xs text-white/30 mt-1">
                      Try another keyword or explore genres
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {allowCollapse && (
            <button
              onClick={() => {
                setOpen(false);
                setSearchQuery("");
                setTimeout(() => setIsExpanded(false), 300);
              }}
              className="p-2 text-white/50 hover:text-white transition-all duration-200 active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Navbar({
  searchQuery,
  setSearchQuery,
  activeTab,
  setActiveTab,
  onSelectMovie,
  recentSearches,
  addRecentSearch,
  contents,
  isMusicPlaying,
  setIsMusicPlaying,
  activeTrackIndex,
  setActiveTrackIndex,
  computedIsUserAdmin,
  isStreaming,
  isHidden,
  onNavigateAway,
  onOpenSettings,
  onNavigate,
  unreadNotifsCount,
  onMenuToggle,
  currentPath,
  showAdConsent,
  tracks = [],
  setCustomTracks,
}: {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeTab: string;
  setActiveTab: (t: string) => void;
  onSelectMovie: (m: Content) => void;
  recentSearches: string[];
  addRecentSearch: (q: string) => void;
  contents: Content[];
  isMusicPlaying: boolean;
  setIsMusicPlaying: (v: boolean) => void;
  activeTrackIndex: number;
  setActiveTrackIndex: (idx: number) => void;
  computedIsUserAdmin: boolean;
  isStreaming?: boolean;
  isHidden?: boolean;
  onNavigateAway?: (targetPath?: string) => void;
  onOpenSettings: () => void;
  onNavigate: (path: string) => void;
  unreadNotifsCount: number;
  onMenuToggle?: (open: boolean) => void;
  currentPath?: string;
  showAdConsent?: boolean;
  tracks?: { id?: string; title: string; url: string; isCustom?: boolean }[];
  setCustomTracks?: React.Dispatch<
    React.SetStateAction<
      { id?: string; title: string; url: string; isCustom?: boolean }[]
    >
  >;
}) {
  const [scrolled, setScrolled] = useState(false);
  const isMobile = useIsMobile();
  const isWindows =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    /win/i.test(navigator.userAgent || "");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [musicMenuOpen, setMusicMenuOpen] = useState(false);

  const { settings: bannerSettings } = useSettings();
  const hasAnnouncement =
    bannerSettings?.systemNotificationActive &&
    bannerSettings?.systemNotification;
  const topOffset = hasAnnouncement ? 32 : 0;

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [musicSettingsOpen, setMusicSettingsOpen] = useState(false);
  const [newTrackTitle, setNewTrackTitle] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      // Auto-populate song title with file name (without extension)
      const baseName =
        file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
      setNewTrackTitle(baseName);
    }
  };

  const handleUploadTrack = async () => {
    if (!uploadedFile || !newTrackTitle.trim()) return;
    setIsUploading(true);
    try {
      // 1. Save track blob in IndexedDB
      const dbTrack = await saveTrack(newTrackTitle.trim(), uploadedFile);

      // 2. Create Object URL for the blob
      const objectUrl = URL.createObjectURL(uploadedFile);

      // 3. Add to react state customTracks
      if (setCustomTracks) {
        setCustomTracks((prev) => [
          ...prev,
          {
            id: dbTrack.id,
            title: dbTrack.title,
            url: objectUrl,
            isCustom: true,
          },
        ]);
      }

      // 4. Reset form state
      setUploadedFile(null);
      setNewTrackTitle("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Failed to upload track:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveTrack = (idxToRemove: number) => {
    if (setCustomTracks) {
      setCustomTracks((prev) => {
        const customIdx = idxToRemove - 2;
        const targetTrack = prev[customIdx];
        if (targetTrack && targetTrack.id) {
          deleteTrack(targetTrack.id).catch((err) =>
            console.error("Failed to delete track from DB:", err),
          );
          URL.revokeObjectURL(targetTrack.url);
        }
        const updated = prev.filter((_, i) => i !== customIdx);
        return updated;
      });
    }
    if (activeTrackIndex === idxToRemove) {
      setActiveTrackIndex(0);
    } else if (activeTrackIndex > idxToRemove) {
      setActiveTrackIndex(activeTrackIndex - 1);
    }
  };

  const [searchExpanded, setSearchExpanded] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [isDesktopLg, setIsDesktopLg] = useState(false);
  const [showMusicTooltip, setShowMusicTooltip] = useState(false);

  const [showGeneralTooltip, setShowGeneralTooltip] = useState(false);
  const [generalTooltipText, setGeneralTooltipText] = useState("");

  useEffect(() => {
    if (Math.random() < 0.4) {
      setShowMusicTooltip(true);
    } else {
      setShowMusicTooltip(false);
    }
  }, [currentPath]);

  useEffect(() => {
    // Slight delay to be less intrusive
    const timer = setTimeout(() => {
      if (
        bannerSettings?.navbarNotificationActive &&
        bannerSettings?.navbarNotifications &&
        bannerSettings.navbarNotifications.length > 0
      ) {
        const notifs = bannerSettings.navbarNotifications.filter(Boolean);
        if (notifs.length === 0) {
          setShowGeneralTooltip(false);
          return;
        }

        const text = notifs[Math.floor(Math.random() * notifs.length)];
        setGeneralTooltipText(text);

        const hasSeen = sessionStorage.getItem("has_seen_general_notif");
        if (!hasSeen) {
          sessionStorage.setItem("has_seen_general_notif", "true");
          setShowGeneralTooltip(true);
        } else {
          const probability =
            bannerSettings?.navbarNotificationProbability || 40;
          if (Math.random() < probability / 100) {
            setShowGeneralTooltip(true);
          } else {
            setShowGeneralTooltip(false);
          }
        }
      } else {
        setShowGeneralTooltip(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    currentPath,
    bannerSettings?.navbarNotificationActive,
    bannerSettings?.navbarNotifications,
    bannerSettings?.navbarNotificationProbability,
  ]);

  useEffect(() => {
    if (isMusicPlaying) setShowMusicTooltip(false);
  }, [isMusicPlaying]);

  useEffect(() => {
    onMenuToggle?.(
      mobileMenuOpen || musicMenuOpen || libraryOpen || moreMenuOpen,
    );
  }, [mobileMenuOpen, musicMenuOpen, libraryOpen, moreMenuOpen, onMenuToggle]);

  const libraryRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const musicRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const onResize = () => {
      setIsCompact(window.innerWidth < 1350);
      setIsDesktopLg(window.innerWidth >= 1024);
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.height = "100vh";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.documentElement.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.documentElement.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  // Close genre dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        libraryRef.current &&
        !libraryRef.current.contains(e.target as Node)
      ) {
        setLibraryOpen(false);
      }
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
      if (musicRef.current && !musicRef.current.contains(e.target as Node)) {
        setMusicMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { favorites, myList, history, user, openAuth, signOut } = useUserData();
  const isViyiePlus = (user?.tiers || [user?.tier || "regular"]).includes(
    "viyie_plus",
  );

  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  // Top navbar tabs (with library moved to Account dropdown)
  const tabs = [
    { id: "home", label: "Home", icon: MonitorPlay, badge: 0 },
    { id: "movie", label: "Movies", icon: FilmIcon, badge: 0 },
    { id: "tv", label: "TV", icon: Tv, badge: 0 },
    { id: "network", label: "Network", icon: Layers, badge: 0 },
    { id: "upcoming", label: "Soon", icon: Calendar, badge: 0 },
    { id: "genre", label: "Genres", icon: Filter, badge: 0 },
  ];

  return (
    <motion.nav
      initial={false}
      style={{ top: topOffset }}
      animate={
        isMobile
          ? {
              paddingTop: 0,
              paddingLeft: 0,
              paddingRight: 0,
              y: isHidden ? -100 : 0,
            }
          : {
              paddingTop: 0,
              paddingLeft: 0,
              paddingRight: 0,
              y: isHidden ? -100 : 0,
            }
      }
      transition={
        isMobile
          ? { duration: 0.2 }
          : { type: "spring", stiffness: 260, damping: 28 }
      }
      className={`left-0 right-0 z-[250] pointer-events-auto fixed top-0 w-full`}
    >
      <motion.div
        initial={false}
        style={{
          paddingTop: "0px",
          marginLeft: "0px",
          paddingLeft: "0px",
          paddingRight: "0px",
          marginBottom: "0px",
        }}
        animate={
          isMobile
            ? {
                borderRadius: 0,
                maxWidth: "100%",
              }
            : {
                borderRadius: 0,
                maxWidth: "100%",
              }
        }
        transition={
          isMobile
            ? { duration: 0.2 }
            : { type: "spring", stiffness: 240, damping: 30 }
        }
        className={`mx-auto overflow-visible relative transition-all duration-300 w-full ${!scrolled ? "bg-gradient-to-b from-black/50 to-transparent" : isWindows ? "bg-transparent backdrop-blur-none" : "bg-black"}`}
      >
        <div
          className={`relative flex items-center justify-between gap-2 lg:gap-8 transition-all duration-300 -translate-y-[2px] ${
            isMobile ? "h-[60px] px-4" : "h-[60px] px-2 lg:px-4"
          } ${scrolled ? "drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" : ""}`}
        >
          {/* Left Side: Logo & Mobile Menu */}
          <div className="absolute lg:relative left-4 lg:left-0 flex items-center gap-2 shrink-0">
            <div
              className="flex items-center cursor-pointer opacity-100 hover:opacity-90 transition-opacity"
              onClick={() => {
                setActiveTab("home");
                setSearchQuery("");
                onNavigateAway?.("/home");
                window.history.pushState({}, "", "/home");
                window.dispatchEvent(new PopStateEvent("popstate"));
                onNavigate?.("/home");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <img
                src={bannerSettings?.brandLogo || BRAND_LOGO_URL}
                alt={BRAND_NAME}
                className={`w-auto object-contain drop-shadow-[0_6px_18px_rgba(220,38,38,0.35)] transition-all h-8 lg:h-9`}
                draggable={false}
              />
            </div>

            {/* Mobile Menu Button - positioned right next to the Logo */}
            <button
              onClick={() => {
                setMobileMenuOpen(!mobileMenuOpen);
                setLibraryOpen(false);
              }}
              className={`text-white hover:text-red-400 hover:drop-shadow-[0_0_8px_rgba(255,0,0,0.8)] rounded-xl transition-all duration-300 lg:hidden ${
                searchExpanded
                  ? "w-0 p-0 opacity-0 overflow-hidden"
                  : "p-2 w-9 h-9 opacity-100 visible bg-white/5 border border-white/10 flex items-center justify-center shrink-0"
              }`}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* Desktop Tabs (with smooth layoutId pill) - Now next to Logo */}
          <div
            className={`hidden lg:flex flex-1 items-center gap-8 xl:gap-10 ml-4 lg:ml-6 relative transition-all duration-300 ${searchExpanded ? "opacity-0 invisible w-0 overflow-hidden" : "opacity-100 visible"} ${isMobile ? "hidden" : ""}`}
            onMouseLeave={() => setHoveredTab(null)}
          >
            {tabs
              .filter(
                (tab) =>
                  !(
                    isCompact &&
                    ["network", "upcoming", "genre"].includes(tab.id)
                  ),
              )
              .map((tab) => {
                const isActive = activeTab === tab.id;
                const isHovered = hoveredTab === tab.id;
                const isUnderlined = hoveredTab ? isHovered : isActive;
                return (
                  <button
                    key={tab.id}
                    onMouseEnter={() => setHoveredTab(tab.id)}
                    onClick={() => {
                      const tabPaths: Record<string, string> = {
                        home: "/home",
                        movie: "/movies",
                        tv: "/tv",
                        network: "/network",
                        upcoming: "/soon",
                        history: "/history",
                        favorites: "/liked",
                        mylist: "/mylist",
                        genre: "/genre",
                      };
                      const targetPath = tabPaths[tab.id] || "/home";
                      setActiveTab(tab.id);
                      onNavigateAway?.(targetPath);
                      if (window.location.pathname !== targetPath) {
                        window.history.pushState({}, "", targetPath);
                        window.dispatchEvent(new PopStateEvent("popstate"));
                        onNavigate?.(targetPath);
                      }
                    }}
                    className={`group relative flex flex-col items-center justify-center py-2 text-[12px] md:text-sm font-garet uppercase tracking-widest transition-all duration-300 ${
                      isActive
                        ? "text-brand-red"
                        : "text-white hover:text-brand-red"
                    }`}
                  >
                    <span className="relative z-10 px-1">{tab.label}</span>
                    {tab.badge > 0 && (
                      <span className="absolute -top-1 -right-3 rounded-full bg-red-600 text-white text-[10px] px-1 shadow-sm">
                        {tab.badge}
                      </span>
                    )}
                    {isUnderlined && (
                      <motion.div
                        layoutId="navTabUnderline"
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 30,
                        }}
                        className="absolute -bottom-1 h-[2px] bg-brand-red w-full rounded-t-full shadow-[0_-2px_10px_rgba(218,0,0,0.8)]"
                      />
                    )}
                  </button>
                );
              })}

            {/* More Menu (only when compact) */}
            {isCompact && (
              <div ref={moreRef} className="relative">
                <button
                  onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                  className={`group relative flex flex-col items-center justify-center py-2 text-[12px] md:text-sm font-garet uppercase tracking-widest transition-all duration-300 ${
                    moreMenuOpen ||
                    tabs
                      .filter(
                        (t) =>
                          t.id === "genre" ||
                          t.id === "network" ||
                          t.id === "upcoming",
                      )
                      .some((t) => activeTab === t.id)
                      ? "text-brand-red"
                      : "text-white hover:text-brand-red"
                  }`}
                >
                  <span className="relative z-10 px-1 flex items-center gap-1.5 whitespace-nowrap">
                    <span>More</span>
                    <motion.span
                      animate={{ rotate: moreMenuOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </motion.span>
                  </span>

                  {(moreMenuOpen ||
                    tabs
                      .filter(
                        (t) =>
                          t.id === "genre" ||
                          t.id === "network" ||
                          t.id === "upcoming",
                      )
                      .some((t) => activeTab === t.id)) && (
                    <motion.div
                      layoutId="navTabUnderline"
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                      className="absolute -bottom-1 h-[2px] bg-brand-red w-full rounded-t-full shadow-[0_-2px_10px_rgba(218,0,0,0.8)]"
                    />
                  )}
                </button>

                <AnimatePresence>
                  {moreMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.18 }}
                      className="absolute top-full left-0 mt-2 w-72 z-50 text-left"
                    >
                      <div
                        className={`rounded-2xl p-2.5 space-y-1 relative overflow-hidden border ${isWindows ? "bg-zinc-900/90 border-zinc-700 shadow-[0_25px_60px_rgba(0,0,0,0.9)]" : "bg-[#100808]/95 backdrop-blur-2xl border border-white/10 shadow-2xl"}`}
                      >
                        <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-red-600/10 blur-2xl pointer-events-none" />
                        <div className="absolute -bottom-16 -left-16 w-32 h-32 rounded-full bg-red-500/10 blur-2xl pointer-events-none" />

                        <div className="relative space-y-1">
                          <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 px-2.5 py-1">
                            Navigation
                          </span>
                          {tabs
                            .filter(
                              (t) =>
                                t.id === "genre" ||
                                t.id === "network" ||
                                t.id === "upcoming",
                            )
                            .map((tab) => {
                              const isActive = activeTab === tab.id;
                              return (
                                <button
                                  key={tab.id}
                                  onClick={() => {
                                    const tabPaths: Record<string, string> = {
                                      home: "/home",
                                      movie: "/movies",
                                      tv: "/tv",
                                      network: "/network",
                                      upcoming: "/soon",
                                      history: "/history",
                                      favorites: "/liked",
                                      mylist: "/mylist",
                                      genre: "/genre",
                                    };
                                    const targetPath =
                                      tabPaths[tab.id] || "/home";
                                    setActiveTab(tab.id);
                                    onNavigateAway?.(targetPath);
                                    setMoreMenuOpen(false);
                                    if (
                                      window.location.pathname !== targetPath
                                    ) {
                                      window.history.pushState(
                                        {},
                                        "",
                                        targetPath,
                                      );
                                      window.dispatchEvent(
                                        new PopStateEvent("popstate"),
                                      );
                                      onNavigate?.(targetPath);
                                    }
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] md:text-sm font-garet uppercase tracking-widest transition-all ${
                                    isActive
                                      ? "bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]"
                                      : "text-white opacity-100 hover:bg-white/10 hover:text-white"
                                  }`}
                                >
                                  <span className="flex items-center gap-2">
                                    <tab.icon className="w-4 h-4 text-red-500" />
                                    {tab.label}
                                  </span>
                                  {tab.badge > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">
                                      {tab.badge}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          <div className="flex-1" />

          {/* Right Side Icons */}
          <div
            className={`absolute flex flex-row items-center gap-2 lg:gap-4 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] z-[500] ${searchExpanded && isDesktopLg ? "left-1/2 -translate-x-1/2 w-[75vw] max-w-[75vw] justify-center" : "right-4 lg:right-8 justify-end"}`}
          >
            <AnimatePresence>
              {!searchExpanded && (
                <motion.div
                  initial={{ opacity: 1, width: "auto" }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-1 overflow-visible order-1"
                >
                  <div ref={musicRef} className="relative flex items-center">
                    <button
                      onClick={() =>
                        !isStreaming && setMusicMenuOpen(!musicMenuOpen)
                      }
                      className={`p-2 transition-colors ${isStreaming ? "opacity-30 cursor-not-allowed pointer-events-none" : "text-white hover:text-brand-red"} ${musicMenuOpen ? "text-brand-red" : ""}`}
                      title="Music Settings"
                    >
                      <Music className="w-5 h-5" />
                    </button>

                    <AnimatePresence>
                      {!isMusicPlaying &&
                        showMusicTooltip &&
                        !scrolled &&
                        !isStreaming && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="absolute top-12 right-0 bg-red-600 text-white text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg shadow-red-900/40 whitespace-nowrap z-[100] border border-red-500/50 flex items-center gap-2"
                          >
                            <div className="absolute -top-1 right-6 w-3 h-3 bg-red-600 rotate-45 border-t border-l border-red-500/50" />
                            Feeling quiet? Play some music! 🎵
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowMusicTooltip(false);
                              }}
                              className="ml-1 p-0.5 rounded-full hover:bg-black/20"
                            >
                              <X className="w-3 h-3 cursor-pointer opacity-70 hover:opacity-100" />
                            </button>
                          </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {musicMenuOpen && !isStreaming && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className={`absolute top-full mt-3 right-0 w-80 p-5 rounded-[2rem] z-50 overflow-hidden border ${isWindows ? "bg-zinc-900/90 border-zinc-700 shadow-[0_25px_60px_rgba(0,0,0,0.9)]" : "bg-[#0c0c0e]/98 backdrop-blur-2xl border border-white/10 shadow-2xl"}`}
                        >
                          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-500" />

                          {/* Top Navigation / Toggle */}
                          <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                            <div className="flex items-center gap-2">
                              {musicSettingsOpen ? (
                                <button
                                  onClick={() => setMusicSettingsOpen(false)}
                                  className="p-1 rounded-full hover:bg-white/5 text-white/60 hover:text-white transition-all"
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                </button>
                              ) : (
                                <Music className="w-4 h-4 text-red-500 animate-pulse" />
                              )}
                              <h4 className="text-[11px] font-bold uppercase tracking-widest text-white/90">
                                {musicSettingsOpen
                                  ? "Manage Music"
                                  : "Viyie+ Music Session"}
                              </h4>
                            </div>

                            <button
                              onClick={() =>
                                setMusicSettingsOpen(!musicSettingsOpen)
                              }
                              className={`p-1.5 rounded-xl transition-all ${musicSettingsOpen ? "bg-red-500/10 text-red-400 border border-red-500/25" : "hover:bg-white/5 text-white/40 hover:text-white-80"}`}
                              title={
                                musicSettingsOpen
                                  ? "Go Back"
                                  : "Music Settings / Upload"
                              }
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {!musicSettingsOpen ? (
                            /* --- TRACK LIST VIEW --- */
                            <>
                              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                                {tracks.map((track, idx) => (
                                  <div
                                    key={idx}
                                    className={`group flex items-center justify-between p-2.5 rounded-2xl transition-all border ${activeTrackIndex === idx ? "bg-red-500/10 border-red-500/25" : "hover:bg-white/5 border-transparent"}`}
                                  >
                                    <button
                                      onClick={() => {
                                        if (activeTrackIndex === idx) {
                                          setIsMusicPlaying(!isMusicPlaying);
                                        } else {
                                          setActiveTrackIndex(idx);
                                          setIsMusicPlaying(true);
                                        }
                                      }}
                                      className="flex-1 flex items-center gap-3 text-left"
                                    >
                                      <div
                                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${activeTrackIndex === idx ? "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-md shadow-red-900/30" : "bg-white/5 text-white/40 group-hover:bg-white/10"}`}
                                      >
                                        {activeTrackIndex === idx &&
                                        isMusicPlaying ? (
                                          <Pause className="w-4 h-4" />
                                        ) : (
                                          <Play className="w-4 h-4" />
                                        )}
                                      </div>
                                      <div className="truncate max-w-[150px]">
                                        <p
                                          className={`text-xs font-bold truncate ${activeTrackIndex === idx ? "text-white" : "text-white/70 group-hover:text-white"}`}
                                        >
                                          {track.title}
                                        </p>
                                        <p className="text-[10px] text-white/35 font-medium">
                                          {track.isCustom
                                            ? "Custom Track"
                                            : `Default Track ${idx + 1}`}
                                        </p>
                                      </div>
                                    </button>

                                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                      {activeTrackIndex === idx && (
                                        <div className="flex items-end gap-[1.5px] h-3 px-1">
                                          {[...Array(3)].map((_, barI) => (
                                            <motion.div
                                              key={barI}
                                              animate={
                                                isMusicPlaying
                                                  ? {
                                                      height: [3, 10, 5, 10, 3],
                                                    }
                                                  : { height: 3 }
                                              }
                                              transition={{
                                                repeat: Infinity,
                                                duration: 0.6 + barI * 0.15,
                                                ease: "easeInOut",
                                              }}
                                              className="w-[1.5px] bg-red-500 rounded-full"
                                            />
                                          ))}
                                        </div>
                                      )}

                                      {track.isCustom && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveTrack(idx);
                                          }}
                                          className="p-1.5 rounded-lg bg-white/0 hover:bg-red-500/10 text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all border border-transparent hover:border-red-500/20"
                                          title="Delete Custom Track"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}

                                {tracks.length === 0 && (
                                  <div className="py-8 text-center text-white/20 text-xs">
                                    No tracks available. Click the cog to add!
                                  </div>
                                )}
                              </div>

                              <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                                <button
                                  onClick={() =>
                                    setIsMusicPlaying(!isMusicPlaying)
                                  }
                                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${isMusicPlaying ? "bg-white/5 border-white/10 text-white hover:bg-white/10" : "bg-gradient-to-r from-red-600 to-red-500 border-red-500/30 text-white shadow-lg shadow-red-600/20 hover:scale-[1.02]"}`}
                                >
                                  {isMusicPlaying ? (
                                    <>
                                      <Pause className="w-3.5 h-3.5" /> Stop
                                      Music
                                    </>
                                  ) : (
                                    <>
                                      <Play className="w-3.5 h-3.5" /> Play
                                      Music
                                    </>
                                  )}
                                </button>

                                <button
                                  onClick={() => setMusicSettingsOpen(true)}
                                  className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-dashed border-white/10 hover:border-red-500/30 rounded-xl text-[10px] font-medium text-white/40 hover:text-red-400 transition-all"
                                >
                                  <Plus className="w-3.5 h-3.5" /> Upload Custom
                                  Music
                                </button>
                              </div>
                            </>
                          ) : (
                            /* --- MUSIC CONFIG / UPLOAD SETTINGS VIEW --- */
                            <div className="space-y-4">
                              <div className="space-y-2.5 animate-fade-in">
                                <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                                  Upload Custom Track
                                </div>

                                {/* Drag and Drop / File Input Zone */}
                                <div
                                  onClick={() => fileInputRef.current?.click()}
                                  className="border border-dashed border-white/15 hover:border-red-500/40 rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-white/5 hover:bg-red-500/5 group text-white/70 hover:text-white"
                                >
                                  <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept="audio/*"
                                    className="hidden"
                                  />
                                  <Music className="w-6 h-6 text-white/30 group-hover:text-red-500 transition-colors mb-2 animate-bounce" />
                                  <span className="text-[10px] font-black uppercase tracking-wider">
                                    {uploadedFile
                                      ? "File Selected"
                                      : "Choose Audio File"}
                                  </span>
                                  <span className="text-[9px] text-white/45 mt-1 truncate max-w-[200px]">
                                    {uploadedFile
                                      ? uploadedFile.name
                                      : "MP3, WAV, M4A, etc."}
                                  </span>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-white/30 uppercase tracking-wider block">
                                    Track Title
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Enter song name..."
                                    value={newTrackTitle}
                                    onChange={(e) =>
                                      setNewTrackTitle(e.target.value)
                                    }
                                    className="w-full px-3 py-2 text-xs text-white bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-red-500/50"
                                  />
                                </div>

                                <button
                                  onClick={handleUploadTrack}
                                  disabled={
                                    !newTrackTitle.trim() ||
                                    !uploadedFile ||
                                    isUploading
                                  }
                                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-bold bg-red-600 hover:bg-red-500 text-white disabled:opacity-30 disabled:pointer-events-none transition-all"
                                >
                                  {isUploading ? (
                                    <>
                                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                      Saving to local...
                                    </>
                                  ) : (
                                    <>
                                      <Check className="w-3.5 h-3.5" /> Upload &
                                      Save Locally
                                    </>
                                  )}
                                </button>
                              </div>

                              <div className="pt-2 border-t border-white/5">
                                <p className="text-[10px] text-white/30 text-center leading-relaxed font-medium">
                                  Audio files are saved directly in your
                                  browser's secure data storage (IndexedDB) for
                                  persistent and seamless playback without any
                                  limits!
                                </p>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Notification Bell */}
            {(!searchExpanded || !isDesktopLg) && (
              <button
                onClick={() => {
                  onNavigateAway?.("/notifuser");
                  window.history.pushState({}, "", "/notifuser");
                  onNavigate("/notifuser");
                }}
                className="relative p-2 text-white hover:text-brand-red transition-colors group order-3"
              >
                <Bell className="w-5 h-5 text-current" />
                {unreadNotifsCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 bg-red-600 text-white text-[8px] font-black flex items-center justify-center rounded-full shadow-lg border border-[#100808]">
                    {unreadNotifsCount}
                  </span>
                )}
              </button>
            )}

            {/* Desktop Search (Far right, centers when expanded) */}
            {isDesktopLg && (
              <div
                className={`transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] drop-shadow-md flex justify-end order-4 relative z-[300] ${
                  searchExpanded ? "w-full" : "w-10"
                }`}
              >
                <SearchBox
                  contents={contents}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  onSelectMovie={onSelectMovie}
                  recentSearches={recentSearches}
                  addRecentSearch={addRecentSearch}
                  isExpanded={searchExpanded}
                  setIsExpanded={setSearchExpanded}
                  allowCollapse={true}
                />
              </div>
            )}

            {/* Mobile Search (expandable) */}
            {!isDesktopLg && !mobileMenuOpen && (
              <div
                className={`transition-all duration-300 w-full flex justify-end order-4 ${searchExpanded ? "max-w-full" : "max-w-[40px]"}`}
              >
                <SearchBox
                  contents={contents}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  onSelectMovie={onSelectMovie}
                  recentSearches={recentSearches}
                  addRecentSearch={addRecentSearch}
                  isExpanded={searchExpanded}
                  setIsExpanded={setSearchExpanded}
                />
              </div>
            )}

            {/* --- 2. ACCOUNT --- */}
            {(!searchExpanded || !isDesktopLg) && (
              <div ref={libraryRef} className="relative order-2">
                <button
                  onClick={() => {
                    setLibraryOpen((v) => !v);
                    setShowGeneralTooltip(false);
                    if (mobileMenuOpen) {
                      setMobileMenuOpen(false);
                    }
                  }}
                  className={`relative p-2 transition-colors ${
                    libraryOpen
                      ? "text-brand-red"
                      : "text-white hover:text-brand-red"
                  }`}
                >
                  <User className="w-5 h-5" />
                </button>

                <AnimatePresence>
                  {showGeneralTooltip &&
                    !scrolled &&
                    !libraryOpen &&
                    !isStreaming && (
                      <>
                        {/* Desktop Tooltip (Original Windows UI - Unchanged) */}
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="hidden sm:flex absolute top-14 right-0 bg-[#0f0f0f] text-white text-[10px] sm:text-xs font-bold px-4 py-3 rounded-xl shadow-2xl shadow-red-900/40 z-[100] border border-white/20 flex flex-col gap-1 items-start min-w-[260px]"
                        >
                          <span className="text-white text-sm font-medium whitespace-normal leading-snug pr-4">
                            {generalTooltipText}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowGeneralTooltip(false);
                            }}
                            className="absolute top-3 right-3 p-1 hover:bg-white/10 rounded-full transition-colors"
                          >
                            <X className="w-3.5 h-3.5 text-white/50 hover:text-white" />
                          </button>
                        </motion.div>

                        {/* Mobile Tooltip (Fixed to Bottom Left and Stackable) */}
                        <motion.div
                          initial={{ opacity: 0, x: -30 }}
                          animate={{
                            opacity: 1,
                            x: 0,
                            bottom: showAdConsent ? "270px" : "16px",
                          }}
                          exit={{ opacity: 0, x: -30 }}
                          transition={{
                            type: "spring",
                            damping: 25,
                            stiffness: 300,
                          }}
                          className="sm:hidden fixed left-4 z-[300] bg-[#111] text-white p-4 rounded-2xl shadow-2xl shadow-black/80 border border-white/10 flex flex-col gap-1 items-start w-[calc(100%-2rem)] max-w-[320px]"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-6 h-6 rounded-lg bg-red-600/20 flex items-center justify-center">
                              <Bell className="w-3.5 h-3.5 text-red-500" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                              Viyie Message
                            </span>
                          </div>
                          <span className="text-white text-[13px] font-bold whitespace-normal leading-snug pr-6 tracking-tight line-clamp-3">
                            {generalTooltipText}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowGeneralTooltip(false);
                            }}
                            className="absolute top-3 right-3 p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all active:scale-90"
                          >
                            <X className="w-4 h-4 text-white/50" />
                          </button>
                        </motion.div>
                      </>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                  {libraryOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.18 }}
                      className="absolute top-full right-0 mt-2 w-72 z-[150]"
                    >
                      <div
                        className={`rounded-2xl p-3 space-y-2 border ${isWindows ? "bg-zinc-900/90 border-zinc-700 shadow-[0_25px_60px_rgba(0,0,0,0.9)]" : "bg-[#100808]/95 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/70"}`}
                      >
                        <button
                          onClick={() => {
                            if (user) {
                              signOut();
                            } else {
                              openAuth();
                              window.history.pushState({}, "", "/login");
                              onNavigate("/login");
                            }
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-left hover:bg-white/10"
                        >
                          {user?.picture ? (
                            <img
                              src={user.picture || undefined}
                              alt={user.name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <LogIn className="w-4 h-4 text-orange-400" />
                          )}
                          <div>
                            <p
                              className="notranslate text-sm font-bold text-white"
                              translate="no"
                            >
                              {user ? user.name : "Sign In / Sign Up"}
                            </p>
                            <p
                              className="notranslate text-[10px] text-white/35"
                              translate="no"
                            >
                              {user
                                ? user.email || user.provider
                                : "Join the community today"}
                            </p>
                          </div>
                        </button>

                        {/* Viyie+ Subscription Button */}
                        <button
                          onClick={() => {
                            setLibraryOpen(false);
                            onNavigateAway?.("/subsviyie");
                            window.history.pushState({}, "", "/subsviyie");
                            onNavigate("/subsviyie");
                          }}
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-yellow-500/10 bg-yellow-500/5 text-yellow-500 hover:text-[#f59e0b] hover:bg-yellow-500/10 hover:border-yellow-500/25 transition-all duration-200 font-bold text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <Crown className="w-4 h-4 text-yellow-500 animate-pulse" />
                            <span className="font-extrabold tracking-tight">
                              VIYIE+ Subscription
                            </span>
                          </div>
                          {isViyiePlus && (
                            <div className="text-[10px] bg-yellow-500/35 text-yellow-400 px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider scale-90 shadow-[0_0_10px_rgba(234,179,8,0.3)] border border-yellow-500/30 font-bold">
                              ACTIVE
                            </div>
                          )}
                        </button>

                        {!user && (
                          <div className="px-3 py-2 space-y-1.5 border-t border-white/5 pt-3">
                            <div className="flex items-center gap-2 text-[10px] text-white/50">
                              <Check className="w-3 h-3 text-red-500" />
                              <span>Personalized recommendations</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-white/50">
                              <Check className="w-3 h-3 text-red-500" />
                              <span>Sync watch list across devices</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-white/50">
                              <Check className="w-3 h-3 text-red-500" />
                              <span>Join community (Review & Comments)</span>
                            </div>
                          </div>
                        )}
                        {[
                          { id: "profile", label: "My Profile", icon: User },
                          {
                            id: "settings",
                            label: "Edit Profile",
                            icon: Settings,
                          },
                          {
                            id: "mylist",
                            label: "Watch List",
                            icon: Bookmark,
                            badge: myList.length,
                          },
                          {
                            id: "favorites",
                            label: "Favorites",
                            icon: Heart,
                            badge: favorites.length,
                          },
                          {
                            id: "history",
                            label: "History",
                            icon: History,
                            badge: history.length,
                          },
                        ]
                          .concat(
                            user?.tiers?.includes("admin") ||
                              user?.tiers?.includes("owner") ||
                              user?.role === "admin" ||
                              user?.tier === "admin" ||
                              computedIsUserAdmin
                              ? [
                                  {
                                    id: "admin",
                                    label: "Admin Panel",
                                    icon: ShieldCheck,
                                    badge: 0,
                                  },
                                ]
                              : [],
                          )
                          .map((item) => (
                            <button
                              key={item.id}
                              onClick={() => {
                                if (item.id === "profile") {
                                  if (user) {
                                    const path = `/profile/${user.uid}`;
                                    onNavigateAway?.(path);
                                    window.history.pushState({}, "", path);
                                    onNavigate(path);
                                  } else {
                                    openAuth();
                                  }
                                } else if (item.id === "settings") {
                                  onOpenSettings();
                                } else if (item.id === "admin") {
                                  const path = "/adminfirefury";
                                  onNavigateAway?.(path);
                                  window.history.pushState({}, "", path);
                                  onNavigate(path);
                                } else if (item.id === "music") {
                                  setIsMusicPlaying(!isMusicPlaying);
                                } else {
                                  const tabPaths: Record<string, string> = {
                                    home: "/home",
                                    movie: "/movies",
                                    tv: "/tv",
                                    network: "/network",
                                    upcoming: "/soon",
                                    history: "/history",
                                    favorites: "/liked",
                                    mylist: "/mylist",
                                    genre: "/genre",
                                  };
                                  const targetPath =
                                    tabPaths[item.id] || `/${item.id}`;
                                  setActiveTab(item.id);
                                  onNavigateAway?.(targetPath);
                                  if (window.location.pathname !== targetPath) {
                                    window.history.pushState(
                                      {},
                                      "",
                                      targetPath,
                                    );
                                    window.dispatchEvent(
                                      new PopStateEvent("popstate"),
                                    );
                                    onNavigate?.(targetPath);
                                  }
                                }
                                setLibraryOpen(false);
                              }}
                              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                            >
                              <span className="flex items-center gap-2">
                                <item.icon className="w-4 h-4" />
                                {item.label}
                              </span>
                              {item.badge !== undefined && item.badge > 0 && (
                                <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-red-500 text-white">
                                  {item.badge}
                                </span>
                              )}
                            </button>
                          ))}

                        <div className="pt-2 mt-2 border-t border-white/5 flex items-center justify-between px-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                            Language
                          </span>
                          <LanguageSwitcher />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen &&
            createPortal(
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 top-[60px] z-[999] lg:hidden bg-[#070707] overflow-y-auto overscroll-contain touch-auto"
                style={{ height: "calc(100vh - 60px)" }}
              >
                <div className="px-4 py-8 space-y-8 pb-32 flex flex-col min-h-full">
                  {/* Search bar inside menu - only one search UI active at a time */}
                  <SearchBox
                    contents={contents}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    onSelectMovie={(m) => {
                      onSelectMovie(m);
                      setMobileMenuOpen(false);
                    }}
                    recentSearches={recentSearches}
                    addRecentSearch={addRecentSearch}
                    isExpanded={true}
                    setIsExpanded={() => {}}
                    allowCollapse={false}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          const tabPaths: Record<string, string> = {
                            home: "/home",
                            movie: "/movies",
                            tv: "/tv",
                            network: "/network",
                            upcoming: "/soon",
                            history: "/history",
                            favorites: "/liked",
                            mylist: "/mylist",
                            genre: "/genre",
                          };
                          const targetPath = tabPaths[tab.id] || `/${tab.id}`;
                          setActiveTab(tab.id);
                          setMobileMenuOpen(false);
                          onNavigateAway?.(targetPath);
                          if (window.location.pathname !== targetPath) {
                            window.history.pushState({}, "", targetPath);
                            window.dispatchEvent(new PopStateEvent("popstate"));
                            onNavigate?.(targetPath);
                          }
                        }}
                        className={`relative flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-medium transition-all ${
                          activeTab === tab.id
                            ? "bg-gradient-to-br from-red-600 to-red-900/50 text-white border border-red-500 shadow-lg shadow-red-900/30"
                            : "bg-white/5 text-white/50 border border-white/5"
                        }`}
                      >
                        <tab.icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                        {tab.badge > 0 && (
                          <span className="min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center bg-red-500 text-white">
                            {tab.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  {/* Mobile Language Switcher */}
                  <div className="md:hidden flex items-center justify-between gap-3 pt-2 border-t border-white/5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                      Language
                    </span>
                    <LanguageSwitcher />
                  </div>
                </div>
              </motion.div>,
              document.body,
            )}
        </AnimatePresence>
      </motion.div>
    </motion.nav>
  );
}

function SoonHero({
  movies: heroList,
  onPlayTrailer,
  activeMovie,
  onActiveMovieChange,
}: {
  movies: Content[];
  onPlayTrailer?: (m: Content) => void;
  activeMovie: Content | null;
  onActiveMovieChange: (m: Content) => void;
}) {
  const isMobile = useIsMobile();
  const [timerKey, setTimerKey] = useState(Date.now());
  const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { user, toast, toggleFavorite, isFavorite } = useUserData();

  // Find index of activeMovie in heroList
  const currentIndex = useMemo(() => {
    if (!activeMovie || !heroList) return 0;
    const idx = heroList.findIndex((m) => String(m.id) === String(activeMovie.id));
    return idx === -1 ? 0 : idx;
  }, [activeMovie, heroList]);

  const movie = heroList[currentIndex] || heroList[0];

  const handleSelectIndex = (idx: number) => {
    if (heroList[idx]) {
      onActiveMovieChange(heroList[idx]);
      setTimerKey(Date.now());
    }
  };

  const fav = movie ? isFavorite(movie.id) : false;

  // Reset trailer when movie changes
  useEffect(() => {
    setIsPlayingTrailer(false);
  }, [currentIndex, heroList]);

  // Reset trailer on scroll or navigation to prevent audio playing when off-screen
  useEffect(() => {
    const handleReset = () => {
      setIsPlayingTrailer((prev) => {
        if (prev) return false;
        return prev;
      });
    };

    const handleScroll = () => {
      if (window.scrollY > 400) {
        setIsPlayingTrailer((prev) => {
          if (prev) return false;
          return prev;
        });
      }
    };

    window.addEventListener("popstate", handleReset);
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("closeHoverCards", handleReset);
    window.addEventListener("playTrailer", handleReset);

    return () => {
      window.removeEventListener("popstate", handleReset);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("closeHoverCards", handleReset);
      window.removeEventListener("playTrailer", handleReset);
    };
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      const isVisible = !document.hidden;
      setIsTabVisible(isVisible);
      if (!isVisible) {
        setIsPlayingTrailer(false);
      }

      // Pause/Play trailer via YouTube postMessage API when tab visibility changes
      if (iframeRef.current && iframeRef.current.contentWindow) {
        if (!isVisible) {
          iframeRef.current.contentWindow.postMessage(
            '{"event":"command","func":"pauseVideo","args":""}',
            "*",
          );
        } else {
          iframeRef.current.contentWindow.postMessage(
            '{"event":"command","func":"playVideo","args":""}',
            "*",
          );
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!heroList || heroList.length <= 1 || isPlayingTrailer) return;
    const timer = setTimeout(() => {
      const nextIdx = (currentIndex + 1) % heroList.length;
      onActiveMovieChange(heroList[nextIdx]);
      setTimerKey(Date.now());
    }, 10000);
    return () => clearTimeout(timer);
  }, [currentIndex, heroList, isPlayingTrailer, onActiveMovieChange]);

  if (!movie) return null;

  const heroTrailerUrl = movie.trailerUrl || movie.embedUrl;

  const handleHeroClick = () => {
    if (isMobile) {
      if (onPlayTrailer) onPlayTrailer(movie);
    } else {
      if (heroTrailerUrl && !isPlayingTrailer) {
        setIsPlayingTrailer(true);
        setIsMuted(true);
      }
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (iframeRef.current && iframeRef.current.contentWindow) {
      if (isMuted) {
        iframeRef.current.contentWindow.postMessage(
          '{"event":"command","func":"unMute","args":""}',
          "*",
        );
      } else {
        iframeRef.current.contentWindow.postMessage(
          '{"event":"command","func":"mute","args":""}',
          "*",
        );
      }
    }
    setIsMuted(!isMuted);
  };

  const [isReserved, setIsReserved] = useState(() => {
    try {
      const reserved = JSON.parse(
        localStorage.getItem("reserved_movies") || "[]",
      );
      return reserved.includes(movie.id);
    } catch {
      return false;
    }
  });

  // Sync reservation status when movie changes
  useEffect(() => {
    try {
      const reserved = JSON.parse(
        localStorage.getItem("reserved_movies") || "[]",
      );
      setIsReserved(reserved.includes(movie.id));
    } catch {
      setIsReserved(false);
    }
  }, [movie.id]);

  const handleReserve = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const key = "reserved_movies";
      let reserved = JSON.parse(localStorage.getItem(key) || "[]");
      if (reserved.includes(movie.id)) {
        reserved = reserved.filter((id: string) => id !== movie.id);
        localStorage.setItem(key, JSON.stringify(reserved));
        setIsReserved(false);
      } else {
        reserved.push(movie.id);
        localStorage.setItem(key, JSON.stringify(reserved));
        setIsReserved(true);
      }
    } catch (err) {
      console.error("Failed to update reservation", err);
    }
  };

  return (
    <div
      className={`relative w-full bg-[#000000] flex flex-col ${isMobile ? "" : "aspect-[16/8] overflow-hidden"}`}
    >
      <div
        className={`relative w-full overflow-hidden shrink-0 cursor-pointer ${isMobile ? "aspect-[16/8]" : "h-full md:absolute md:inset-0"}`}
        onClick={handleHeroClick}
      >
        {isPlayingTrailer && heroTrailerUrl && !isMobile ? (
          <div className="absolute inset-0 bg-black z-0 overflow-hidden text-center flex items-center justify-center">
            <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
              <iframe
                ref={iframeRef}
                src={(() => {
                  let url = heroTrailerUrl;
                  let embed = getEmbedAutoplayUrl(url || undefined, true, true);
                  if (embed && embed.includes("youtube.com")) {
                    embed += "&enablejsapi=1";
                  }
                  return embed;
                })()}
                title="Trailer"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full aspect-video border-0 pointer-events-none scale-115"
              />
              {/* Cinematic Letterboxing Overlays (to hide YouTube branding & controls) */}
              <div className="absolute top-0 left-0 right-0 h-[8.5%] bg-black z-10 pointer-events-none border-b border-white/5" />
              <div className="absolute bottom-0 left-0 right-0 h-[8.5%] bg-black z-10 pointer-events-none border-t border-white/5" />
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={movie.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${(() => {
                  const url = movie.backdrop || movie.poster;
                  if (url?.includes("tmdb.org/t/p/original"))
                    return url.replace("/t/p/original", "/t/p/w1280");
                  return url;
                })()})`,
                backgroundPosition: movie.backdropPosition || "50% 50%",
                transform: `scale(${movie.backdropScale || 1}) rotate(${movie.backdropRotate || 0}deg)`,
                transformOrigin: movie.backdropPosition || "50% 50%",
              }}
            />
          </AnimatePresence>
        )}

        <>
          <div
            className="absolute inset-x-0 top-0 h-32 pointer-events-none hidden md:block z-10"
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 100%)",
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none md:hidden"
            style={{
              background:
                "linear-gradient(to top, #0a0a0a -2%, rgba(10,10,10,0.6) 15%, transparent 50%)",
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none hidden md:block"
            style={{
              background:
                "linear-gradient(to top, #0a0a0a 0%, rgba(10,10,10,0.85) 14%, rgba(10,10,10,0.4) 40%, rgba(10,10,10,0.1) 65%, transparent 100%)",
            }}
          />
        </>

        {isMobile && (
          <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none p-4 bg-gradient-to-t from-[#0a0a0a] to-transparent">
            <motion.h1
              key={`title-${movie.id}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="notranslate text-2xl md:text-3xl font-appeal font-normal text-white leading-[1.1] drop-shadow-[0_4px_16px_rgba(0,0,0,1)] uppercase tracking-wider"
              translate="no"
            >
              {movie.title}
            </motion.h1>
          </div>
        )}
      </div>

      <div
        className={`${isMobile ? "relative py-4" : "absolute inset-0 z-10 pointer-events-none flex flex-col justify-end"}`}
      >
        <div
          className={`w-full ${isMobile ? "px-4" : "px-4 sm:px-6 lg:px-8 pb-2 sm:pb-3 md:pb-6 lg:pb-8 h-fit"}`}
        >
          <div
            className={`max-w-xl md:max-w-3xl w-full pointer-events-auto transition-opacity duration-500 opacity-100 visible ${isMobile ? "relative h-[250px] overflow-hidden" : ""}`}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={movie.id}
                initial={
                  isMobile
                    ? { opacity: 0, x: 0, y: 10 }
                    : { opacity: 0, x: -20, y: 0 }
                }
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={
                  isMobile
                    ? { opacity: 0, x: 0, y: -10 }
                    : { opacity: 0, x: 20, y: 0 }
                }
                transition={{ duration: 0.4, ease: "easeInOut" }}
              >
                <div className="flex flex-wrap items-center gap-2 mb-3 pt-1">
                  <motion.span
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    className="px-2 py-0.5 md:px-2.5 md:py-1 rounded-sm bg-red-600 shadow-md shadow-red-900/40 text-white text-[9px] md:text-[10px] font-semibold uppercase flex items-center gap-1"
                  >
                    <Calendar className="w-2.5 h-2.5 md:w-3 md:h-3" /> Soon
                  </motion.span>
                  <span className="text-[10px] md:text-[11px] font-medium tracking-[0.1em] text-white/50 bg-white/5 px-2 py-0.5 rounded uppercase">
                    {movie.year ||
                      movie.releaseDate?.split("-")[0] ||
                      "TBA"}
                  </span>
                  <span className="text-[10px] md:text-[11px] font-medium tracking-[0.1em] text-white/50 bg-white/5 px-2 py-0.5 rounded uppercase">
                    {movie.type === "tv" ? "TV" : "Movie"}
                  </span>
                </div>

                {!isMobile && (
                  <h1
                    className="notranslate text-3xl sm:text-4xl md:text-5xl lg:text-[56px] font-appeal font-normal text-white leading-[1.05] drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)] mb-3 lg:mb-4 tracking-wide uppercase"
                    translate="no"
                  >
                    {movie.title}
                  </h1>
                )}

                <p className="text-[11px] md:text-[13px] text-white/70 line-clamp-3 md:line-clamp-4 leading-[1.6] mb-5 md:mb-6 max-w-[90%] md:max-w-xl font-medium tracking-wide">
                  {movie.synopsis || "No synopsis available."}
                </p>

                <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                  <button
                    onClick={handleReserve}
                    className={`h-10 md:h-12 px-5 md:px-8 rounded-full text-xs md:text-[13px] font-bold uppercase tracking-widest transition-all duration-300 flex items-center gap-2 group ${
                      isReserved
                        ? "bg-red-600/10 text-red-500 border border-red-500/20 hover:bg-red-600/20 shadow-[0_0_15px_rgba(220,38,38,0.15)]"
                        : "bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-900/40"
                    }`}
                  >
                    {isReserved ? (
                      <>
                        <Check className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-500" />
                        Reserved
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        Reserve
                      </>
                    )}
                  </button>

                  {heroTrailerUrl && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onPlayTrailer && isMobile) onPlayTrailer(movie);
                        else {
                          if (!isPlayingTrailer) {
                            setIsPlayingTrailer(true);
                            setIsMuted(false);
                          }
                        }
                      }}
                      className="h-10 md:h-12 px-5 md:px-8 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-900/40 text-xs md:text-[13px] font-bold uppercase tracking-widest transition-all duration-300 flex items-center gap-2 group border-none"
                    >
                      <Play className="w-3.5 h-3.5 md:w-4 md:h-4 fill-white" />
                      Trailer
                    </button>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Pagination Dots - Persistent & interactive */}
            {heroList.length > 1 && (
              <div className="mt-8 flex items-center gap-2 overflow-x-auto hide-scroll-bar z-20">
                {heroList.map((m, idx) => {
                  const isActive = idx === currentIndex;
                  return (
                    <button
                      key={`hero-soon-dot-${m.id}-${idx}`}
                      onClick={() => handleSelectIndex(idx)}
                      className={`relative h-2 rounded-full transition-all duration-300 ${
                        isActive
                          ? "w-12 bg-white/10"
                          : "w-2 bg-red-600 hover:bg-red-500 shadow-[0_0_8px_rgba(220,38,38,0.4)]"
                      }`}
                    >
                      {isActive && !isPlayingTrailer && (
                        <div
                          key={`hero-soon-progress-${m.id}-${idx}-${timerKey}`}
                          className="absolute inset-x-0 inset-y-0 bg-gradient-to-r from-red-600 to-red-500 rounded-full animate-fill-progress shadow-[0_0_12px_rgba(220,38,38,0.6)]"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {!isMobile && (
        <div className="absolute bottom-6 right-8 z-30 flex flex-col md:flex-row items-end md:items-center gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!user) {
                  toast("Login required", "info");
                  return;
                }
                toggleFavorite(movie);
              }}
              className="group flex flex-col items-center gap-1 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all group-hover:bg-white/10">
                <Heart
                  className={`w-4 h-4 ${fav ? "fill-red-500 text-red-500" : "text-white"}`}
                />
              </div>
            </button>
            <button className="group flex flex-col items-center gap-1 cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all group-hover:bg-white/10">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
            </button>
            <button className="group flex flex-col items-center gap-1 cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all group-hover:bg-white/10">
                <Share2 className="w-4 h-4 text-white" />
              </div>
            </button>
          </div>

          <div className="w-[1px] h-8 bg-white/20 mx-2 hidden md:block" />

          {isPlayingTrailer && isTabVisible && (
            <button
              onClick={toggleMute}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors pointer-events-auto shrink-0 group"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
              ) : (
                <Volume2 className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function HeroSection({
  movies: heroList,
  onPlay,
  onWatchNow,
  onPlayTrailer,
  onShowDetails,
  mostCommented = [],
  userHistory = [],
  trendingMovies = [],
}: {
  movies: Content[];
  onPlay: (m: Content) => void;
  onWatchNow: (m: Content) => void;
  onPlayTrailer?: (m: Content) => void;
  onShowDetails?: (m: Content) => void;
  mostCommented?: Content[];
  userHistory?: any[];
  trendingMovies?: Content[];
}) {
  const isMobile = useIsMobile();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timerKey, setTimerKey] = useState(Date.now());
  const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleSelectIndex = (idx: number) => {
    setCurrentIndex(idx);
    setTimerKey(Date.now());
  };

  useEffect(() => {
    setIsPlayingTrailer(false); // Reset when hero changes
  }, [currentIndex, heroList]);

  // Reset trailer on scroll or navigation to prevent audio playing when off-screen
  useEffect(() => {
    const handleReset = () => {
      setIsPlayingTrailer((prev) => {
        if (prev) return false;
        return prev;
      });
    };

    const handleScroll = () => {
      if (window.scrollY > 400) {
        setIsPlayingTrailer((prev) => {
          if (prev) return false;
          return prev;
        });
      }
    };

    window.addEventListener("popstate", handleReset);
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("closeHoverCards", handleReset);
    window.addEventListener("playTrailer", handleReset);

    return () => {
      window.removeEventListener("popstate", handleReset);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("closeHoverCards", handleReset);
      window.removeEventListener("playTrailer", handleReset);
    };
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      const isVisible = !document.hidden;
      setIsTabVisible(isVisible);
      if (!isVisible) {
        setIsPlayingTrailer(false);
      }

      // Pause/Play trailer via YouTube postMessage API when tab visibility changes
      if (iframeRef.current && iframeRef.current.contentWindow) {
        if (!isVisible) {
          iframeRef.current.contentWindow.postMessage(
            '{"event":"command","func":"pauseVideo","args":""}',
            "*",
          );
        } else {
          iframeRef.current.contentWindow.postMessage(
            '{"event":"command","func":"playVideo","args":""}',
            "*",
          );
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!heroList || heroList.length <= 1 || isPlayingTrailer) return;
    const timer = setTimeout(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % heroList.length;
        setTimerKey(Date.now());
        return next;
      });
    }, 10000);
    return () => clearTimeout(timer);
  }, [currentIndex, heroList, isPlayingTrailer]);

  if (!heroList || heroList.length === 0) return null;
  const movie = heroList[currentIndex] || heroList[0];
  if (!movie) return null;

  const heroTrailerUrl = movie.trailerUrl || movie.embedUrl;

  const handleHeroClick = () => {
    if (isMobile) {
      onPlay(movie);
    } else {
      if (heroTrailerUrl && !isPlayingTrailer) {
        setIsPlayingTrailer(true);
        setIsMuted(true);
      } else if (!isPlayingTrailer) {
        onPlay(movie);
      }
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (iframeRef.current && iframeRef.current.contentWindow) {
      if (isMuted) {
        iframeRef.current.contentWindow.postMessage(
          '{"event":"command","func":"unMute","args":""}',
          "*",
        );
      } else {
        iframeRef.current.contentWindow.postMessage(
          '{"event":"command","func":"mute","args":""}',
          "*",
        );
      }
    }
    setIsMuted(!isMuted);
  };

  const topCommentIds = (mostCommented || []).slice(0, 3).map((m) => m.id);
  const isMovieMostCommented = topCommentIds.includes(movie.id);
  const isContinueWatching = (userHistory || []).some(
    (h) => String(h.movieId) === String(movie.id),
  );
  const isDynamicTrending =
    movie.isTrending ||
    (trendingMovies || []).some((m) => String(m.id) === String(movie.id));

  return (
    <div
      className={`relative w-full bg-[#000000] flex flex-col ${isMobile ? "" : "aspect-[16/8] overflow-hidden"}`}
    >
      {/* Visual background container */}
      <div
        className={`relative w-full overflow-hidden shrink-0 cursor-pointer ${isMobile ? "aspect-[16/8]" : "h-full md:absolute md:inset-0"}`}
        onClick={handleHeroClick}
      >
        {isPlayingTrailer && heroTrailerUrl && !isMobile ? (
          <div className="absolute inset-0 bg-black z-0 overflow-hidden text-center flex items-center justify-center">
            <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
              <iframe
                ref={iframeRef}
                src={(() => {
                  let url = heroTrailerUrl;
                  let embed = getEmbedAutoplayUrl(url || undefined, true, true);
                  if (embed && embed.includes("youtube.com")) {
                    embed += "&enablejsapi=1";
                  }
                  return embed;
                })()}
                title="Trailer"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full aspect-video border-0 pointer-events-none scale-115"
              />
              {/* Cinematic Letterboxing Overlays (to hide YouTube branding & controls) */}
              <div className="absolute top-0 left-0 right-0 h-[8.5%] bg-black z-10 pointer-events-none border-b border-white/5" />
              <div className="absolute bottom-0 left-0 right-0 h-[8.5%] bg-black z-10 pointer-events-none border-t border-white/5" />
            </div>
          </div>
        ) : (
          /* Crossfade image */
          <AnimatePresence>
            <motion.div
              key={movie.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${(() => {
                  const url = movie.backdrop || movie.poster;
                  if (url?.includes("tmdb.org/t/p/original"))
                    return url.replace("/t/p/original", "/t/p/w1280");
                  return url;
                })()})`,
                backgroundPosition: movie.backdropPosition || "50% 50%",
                transform: `scale(${movie.backdropScale || 1}) rotate(${movie.backdropRotate || 0}deg)`,
                transformOrigin: movie.backdropPosition || "50% 50%",
              }}
            />
          </AnimatePresence>
        )}

        {/* Fades */}
        <>
          <div
            className="absolute inset-x-0 top-0 h-32 pointer-events-none hidden md:block z-10"
            style={{
              background: `linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 100%)`,
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none md:hidden"
            style={{
              background: `linear-gradient(to top, #0a0a0a -2%, rgba(10,10,10,0.6) 15%, transparent 50%)`,
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none hidden md:block"
            style={{
              background: `linear-gradient(to top,
                #0a0a0a 0%,
                rgba(10,10,10,0.85) 14%,
                rgba(10,10,10,0.4) 40%,
                rgba(10,10,10,0.1) 65%,
                transparent 100%)`,
            }}
          />
        </>
        {/* Mobile only title overlay on image */}
        {isMobile && (
          <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none p-4 bg-gradient-to-t from-[#0a0a0a] to-transparent">
            <motion.h1
              key={`title-${movie.id}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="notranslate text-2xl md:text-3xl font-appeal font-normal text-white leading-[1.1] drop-shadow-[0_4px_16px_rgba(0,0,0,1)] uppercase tracking-wider"
              translate="no"
            >
              {movie.title}
            </motion.h1>
          </div>
        )}
      </div>

      {/* Text content */}
      <div
        className={`${isMobile ? "relative py-4" : "absolute inset-0 z-10 pointer-events-none flex flex-col justify-end"}`}
      >
        <div
          id="hero-content-wrapper"
          className={`w-full ${isMobile ? "px-4" : "px-4 sm:px-6 lg:px-8 pb-2 sm:pb-3 md:pb-6 lg:pb-8 h-fit"}`}
        >
          <div
            className={`max-w-xl md:max-w-3xl w-full pointer-events-auto transition-opacity duration-500 opacity-100 visible ${isMobile ? "relative h-[250px] overflow-hidden" : ""}`}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={movie.id}
                className={isMobile ? "w-full" : undefined}
                initial={
                  isMobile
                    ? { opacity: 0, x: 0, y: 10 }
                    : { opacity: 0, x: -20, y: 0 }
                }
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={
                  isMobile
                    ? {
                        opacity: 0,
                        x: 0,
                        y: -10,
                      }
                    : {
                        opacity: 0,
                        x: 20,
                        y: 0,
                      }
                }
                transition={{ duration: 0.4, ease: "easeInOut" }}
              >
                <div className="flex flex-wrap items-center gap-2 mb-3 pt-1">
                  {isDynamicTrending ? (
                    <motion.span
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.15 }}
                      className="px-2 py-0.5 md:px-2.5 md:py-1 rounded-lg bg-yellow-400 text-black text-[9px] md:text-[10px] font-black uppercase tracking-[0.12em] shadow-lg shadow-yellow-900/40 border border-yellow-300 flex items-center gap-1"
                    >
                      <Flame className="w-2.5 h-2.5 md:w-3 md:h-3" /> Trending
                      Now
                    </motion.span>
                  ) : isContinueWatching ? (
                    <motion.span
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.15 }}
                      className="px-2 py-0.5 md:px-2.5 md:py-1 rounded-lg bg-red-600 text-white text-[9px] md:text-[10px] font-bold uppercase tracking-[0.12em] shadow-lg shadow-red-900/40 border border-red-500/50 flex items-center gap-1"
                    >
                      <PlayCircle className="w-2.5 h-2.5 md:w-3 md:h-3" />{" "}
                      Continue Watching
                    </motion.span>
                  ) : isMovieMostCommented ? (
                    <motion.span
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.1 }}
                      className="px-2 py-0.5 md:px-2.5 md:py-1 rounded-lg bg-red-600 text-white text-[9px] md:text-[10px] font-bold uppercase tracking-[0.12em] shadow-lg shadow-red-900/40 border border-red-500/50 flex items-center gap-1"
                    >
                      <MessageSquare className="w-2.5 h-2.5 md:w-3 md:h-3" />{" "}
                      Most Commented
                    </motion.span>
                  ) : null}
                  <motion.span
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="px-2 py-0.5 md:px-2.5 md:py-1 rounded-lg bg-red-600/90 text-white text-[9px] md:text-[10px] font-bold uppercase tracking-[0.12em] shadow-lg shadow-red-900/40 border border-red-500/50"
                  >
                    {movie.type === "tv" ? "TV Series" : "Movie"}
                  </motion.span>
                </div>

                {!isMobile && (
                  <h1
                    className="notranslate text-lg sm:text-2xl md:text-3xl lg:text-5xl font-appeal font-normal text-white mb-2 md:mb-3 leading-tight pb-1 tracking-wider drop-shadow-2xl uppercase"
                    translate="no"
                  >
                    {movie.title}
                  </h1>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex flex-row flex-wrap items-center gap-2 md:gap-3 text-[10px] md:text-sm text-white/80 mb-3"
                >
                  <div className="flex flex-wrap items-center gap-2 md:gap-3 shrink-0">
                    <span className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 md:w-4 md:h-4 text-yellow-500 fill-yellow-500" />
                      <span className="text-white font-semibold tracking-tight">
                        {movie.rating || "0.0"}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-white/90 text-[11px] md:text-xs font-semibold">
                      {movie.releaseDate?.split("-")[0]}
                    </span>
                    <span className="flex items-center gap-1 text-white/90 text-[11px] md:text-xs font-semibold">
                      {(() => {
                        const last = getLastEpisodeNumber(movie);
                        return movie.type === "tv"
                          ? `${last === 1 ? "1 Eps" : last ? `1-${last} Eps` : "TV"}`
                          : movie.duration;
                      })()}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 md:gap-2">
                    <Layers className="w-3 h-3 md:w-3.5 md:h-3.5 text-red-600 mr-0.5 opacity-60" />

                    {(Array.isArray(movie.genres) ? movie.genres : [])
                      .slice(0, 4)
                      .map((g) => (
                        <span
                          key={g}
                          translate="no"
                          className="notranslate px-1.5 py-0.5 md:px-2 md:py-0.5 rounded-md bg-white/5 text-white/50 text-[9px] md:text-[10px] lg:text-xs border border-white/5 uppercase font-medium"
                        >
                          {g}
                        </span>
                      ))}
                    {(Array.isArray(movie.genres) ? movie.genres : []).length >
                      4 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onShowDetails?.(movie);
                        }}
                        className="px-1.5 py-0.5 md:px-2 md:py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-[9px] md:text-[10px] lg:text-xs border border-white/10 transition-colors uppercase font-medium"
                      >
                        +
                        {(Array.isArray(movie.genres) ? movie.genres : [])
                          .length - 4}{" "}
                        More
                      </button>
                    )}
                  </div>
                </motion.div>

                <p className="max-w-2xl text-white/75 text-[11px] md:text-xs lg:text-[14px] font-normal leading-5 lg:leading-6 h-[60px] lg:h-[72px] line-clamp-3 mb-4 drop-shadow-md overflow-hidden">
                  {movie.synopsis}
                </p>

                <div className="flex items-center gap-2 md:gap-3 mt-2">
                  <button
                    onClick={() => onWatchNow(movie)}
                    className="relative group flex items-center justify-center gap-2 px-5 md:px-6 py-2.5 md:py-2.5 bg-red-600 text-white rounded-md font-semibold text-[11px] md:text-xs tracking-widest uppercase shadow-xl shadow-red-900/50 transition-all hover:scale-105 active:scale-95 hover:bg-red-500"
                  >
                    <Play className="w-3.5 h-3.5 md:w-3.5 md:h-3.5 fill-white" />
                    <span>Watch Now</span>
                  </button>

                  <button
                    onClick={() =>
                      onPlayTrailer ? onPlayTrailer(movie) : onPlay(movie)
                    }
                    className="group relative flex items-center justify-center gap-1.5 px-5 md:px-6 py-2.5 md:py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-md font-semibold transition-all border border-white/10 text-[11px] md:text-xs uppercase tracking-widest"
                  >
                    <Tv className="w-3.5 h-3.5 md:w-3.5 md:h-3.5 text-red-600 transition-colors group-hover:text-red-500" />
                    <span>Trailer</span>
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Pagination Dots - Persistent & interactive */}
            {heroList.length > 1 && (
              <div className="mt-8 flex items-center gap-2 overflow-x-auto hide-scroll-bar z-20">
                {heroList.map((m, idx) => {
                  const isActive = idx === currentIndex;
                  return (
                    <button
                      key={`${m.id}-${idx}-indicator`}
                      type="button"
                      onClick={() => handleSelectIndex(idx)}
                      className={`relative overflow-hidden transition-all duration-300 ease-out cursor-pointer h-1.5 rounded-full
                        ${
                          isActive
                            ? "w-12 bg-white/10"
                            : "w-2 bg-red-600 hover:bg-red-500 shadow-[0_0_8px_rgba(220,38,38,0.4)]"
                        }`}
                    >
                      {isActive && !isPlayingTrailer && (
                        <div
                          key={`hero-progress-${m.id}-${idx}-${timerKey}`}
                          className="absolute inset-x-0 inset-y-0 bg-gradient-to-r from-red-600 to-red-500 rounded-full animate-fill-progress shadow-[0_0_12px_rgba(220,38,38,0.6)]"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mute Button */}
      {isPlayingTrailer && !isMobile && isTabVisible && (
        <div className="absolute right-4 md:right-8 lg:right-12 bottom-4 md:bottom-8 lg:bottom-12 z-30 pointer-events-auto drop-shadow-xl">
          <button
            onClick={toggleMute}
            className="w-10 h-10 md:w-12 md:h-12 bg-black/40 hover:bg-black/60 backdrop-blur-lg border border-white/20 rounded-full flex items-center justify-center text-white/90 hover:text-white transition-all transform hover:scale-105"
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 md:w-6 md:h-6" />
            ) : (
              <Volume2 className="w-5 h-5 md:w-6 md:h-6" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function getEmbedAutoplayUrl(
  url: string | undefined,
  isMuted: boolean = false,
  disableControls: boolean = false,
): string {
  if (!url) return "";
  let finalUrl = url.trim();

  // Extract src if user pasted a full iframe code
  if (finalUrl.toLowerCase().includes("<iframe")) {
    const match = finalUrl.match(/src=["'](.*?)["']/i);
    if (match && match[1]) {
      finalUrl = match[1];
    }
  }

  if (finalUrl.includes("youtube.com") || finalUrl.includes("youtu.be")) {
    let id = "";
    if (finalUrl.includes("youtu.be/")) {
      id = finalUrl.split("youtu.be/")[1]?.split(/[?&"']/)[0];
    } else if (finalUrl.includes("watch?v=")) {
      id = finalUrl.split("watch?v=")[1]?.split(/[?&"']/)[0];
    } else if (finalUrl.includes("/embed/")) {
      id = finalUrl.split("/embed/")[1]?.split(/[?&"']/)[0];
    }

    if (id) {
      let suffix = `?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
      if (isMuted) suffix += `&mute=1&muted=1`; // some older YT players check muted
      if (disableControls) suffix += `&controls=0&disablekb=1`;
      return `https://www.youtube.com/embed/${id}${suffix}`;
    }
  }

  // For other platforms (vimeo, dailymotion, turbovip, hydrax, etc)
  if (!finalUrl.includes("autoplay=") && !finalUrl.includes("autostart=")) {
    finalUrl +=
      (finalUrl.includes("?") ? "&" : "?") + "autoplay=1&autostart=true";
  }
  if (isMuted && !finalUrl.includes("mute=") && !finalUrl.includes("muted=")) {
    finalUrl += "&mute=1&muted=true";
  }
  if (disableControls && !finalUrl.includes("controls=")) {
    finalUrl += "&controls=0";
  }
  return finalUrl;
}

const EpisodeCard = memo(
  ({
    item,
    onClick,
  }: {
    item: any;
    onClick: (m: Content, epIndex: number) => void;
    index: number;
  }) => {
    const {
      toggleMyList,
      toggleFavorite,
      isInMyList,
      isFavorite,
      user,
      openAuth,
      toast,
    } = useUserData();
    const [isHovered, setIsHovered] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const [hoverPos, setHoverPos] = useState({
      x: -50,
      scale: 0.8,
      opacity: 0,
    });
    const [showTrailer, setShowTrailer] = useState(false);
    const [revealTrailer, setRevealTrailer] = useState(false);
    const hoverTimeoutRef = useRef<any>(null);
    const trailerTimeoutRef = useRef<any>(null);

    useEffect(() => {
      if (isHovered) {
        hoverTimeoutRef.current = setTimeout(() => {
          if (cardRef.current) {
            const rect = cardRef.current.getBoundingClientRect();
            const hoverWidth = rect.width * 1.68;
            const center = rect.left + rect.width / 2;

            const scrollParent = cardRef.current.closest(".overflow-x-auto");
            const bounds = scrollParent
              ? scrollParent.getBoundingClientRect()
              : { left: 0, right: window.innerWidth };

            let newX = -50;
            const padding = 70; // Set to 70px as requested to shift further from boundaries

            if (center - hoverWidth / 2 < bounds.left + padding) {
              const diff = bounds.left + padding - (center - hoverWidth / 2);
              newX = -50 + (diff / rect.width) * 100;
            } else if (center + hoverWidth / 2 > bounds.right - padding) {
              const diff = center + hoverWidth / 2 - (bounds.right - padding);
              newX = -50 - (diff / rect.width) * 100;
            }

            setHoverPos({ x: newX, scale: 1.68, opacity: 1 });

            // Start trailer autoplay IMMEDIATELY (under the backdrop) when card has scaled up
            setShowTrailer(true);
            setRevealTrailer(false);

            // Hide backdrop and reveal trailer ONLY after staying hovered for 2 seconds (2000 milliseconds)
            if (trailerTimeoutRef.current)
              clearTimeout(trailerTimeoutRef.current);
            trailerTimeoutRef.current = setTimeout(() => {
              setRevealTrailer(true);
            }, 2000);
          }
        }, 180);
      } else {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        if (trailerTimeoutRef.current) clearTimeout(trailerTimeoutRef.current);
        setHoverPos({ x: -50, scale: 0.8, opacity: 0 });
        setShowTrailer(false);
        setRevealTrailer(false);
      }
    }, [isHovered]);

    useEffect(() => {
      const handleCloseEvent = () => {
        setIsHovered(false);
      };

      window.addEventListener("scroll", handleCloseEvent, { passive: true });
      window.addEventListener("closeHoverCards", handleCloseEvent);
      window.addEventListener("playTrailer", handleCloseEvent);

      // Listen for scroll on carousel ancestors
      const carousels = document.querySelectorAll(".overflow-x-auto");
      carousels.forEach((carousel) => {
        carousel.addEventListener("scroll", handleCloseEvent, {
          passive: true,
        });
      });

      return () => {
        window.removeEventListener("scroll", handleCloseEvent);
        window.removeEventListener("closeHoverCards", handleCloseEvent);
        window.removeEventListener("playTrailer", handleCloseEvent);
        carousels.forEach((carousel) => {
          carousel.removeEventListener("scroll", handleCloseEvent);
        });
      };
    }, []);

    const getValidUrl = (url?: string | null) =>
      url && url.trim() !== "" ? url : null;
    const epThumbRaw =
      getValidUrl(item.episodeThumbnail) ||
      getValidUrl(item.episode?.thumbnail);
    const thumb =
      (epThumbRaw && !epThumbRaw.includes("videoseries") ? epThumbRaw : null) ||
      getValidUrl(item.backdrop) ||
      getValidUrl(item.poster) ||
      "/placeholder-episode.jpg";

    const fav = isFavorite(item.id);
    const inList = isInMyList(item.id);

    const stop = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
    };

    return (
      <div
        ref={cardRef}
        className="relative w-full snap-start group cursor-pointer flex flex-col card-hover-trigger"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          onClick={() => onClick(item as Content, item.episodeNumber - 1)}
          className="relative aspect-[16/9] rounded-xl overflow-hidden bg-[#1a1a1a] shadow-md border border-white/5 active:scale-95 transition-all duration-300"
        >
          <OptimizedImage
            src={thumb}
            fallbackSrc={item.backdrop || item.poster}
            alt={item.title}
            className="w-full h-full object-cover rounded-xl"
            quality="medium"
          />

          {/* Rating - Gold style on Black 60% */}
          {item.rating && (
            <div className="absolute top-2 right-2 flex flex-col items-end gap-1 z-40">
              <div className="flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm shadow-lg shadow-black/40 text-[9px] md:text-[10px] font-semibold text-yellow-400 border border-white/10 shrink-0">
                <Star className="w-2.5 h-2.5 text-yellow-500 fill-yellow-500" />
                {item.rating}
              </div>
            </div>
          )}

          <div className="absolute top-2 left-2 flex flex-col gap-0.5 items-start z-30">
            <span className="text-[9px] md:text-[10px] font-bold text-white px-1.5 py-0.5 bg-red-600 rounded shadow-lg shadow-red-900/40 uppercase tracking-widest leading-none">
              EP {item.episodeNumber}
            </span>
          </div>
        </div>

        <div className="mt-2.5 flex flex-col items-start px-0.5 transition-opacity duration-300">
          <h3
            className="notranslate text-[11px] md:text-[13px] font-bold text-white/90 line-clamp-1 leading-tight mb-1 text-left w-full"
            translate="no"
          >
            {item.title}
          </h3>
          <div className="flex items-center justify-start gap-1.5 text-[9px] md:text-[10px] text-white/50 font-medium">
            <span>
              {item.episode?.title || `Episode ${item.episodeNumber}`}
            </span>
          </div>
        </div>

        {/* Hover Pop-out Element */}
        <div
          onClick={() => onClick(item as Content, item.episodeNumber - 1)}
          className="hidden md:block absolute top-1/2 left-1/2 w-full transform bg-[#121212] rounded-[2%] shadow-[0_0_50px_rgba(0,0,0,0.9)] border border-white/10 z-[100] transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{
            transform: `translate(${hoverPos.x}%, -50%) scale(${hoverPos.scale})`,
            opacity: hoverPos.opacity,
            pointerEvents:
              isHovered && hoverPos.opacity === 1 ? "auto" : "none",
            boxShadow: isHovered ? "0 0 80px rgba(220,38,38,0.15)" : "none",
          }}
        >
          {/* Backdrop or Thumbnail */}
          <div className="relative w-full aspect-[16/9] rounded-t-[inherit] overflow-hidden bg-black/50">
            {showTrailer && (item.trailerUrl || item.embedUrl || item.url) && (
              <iframe
                src={getEmbedAutoplayUrl(
                  item.trailerUrl || item.embedUrl || item.url,
                  false,
                  true,
                )}
                className="absolute inset-0 w-full h-full object-cover scale-150 pointer-events-none z-10"
                allow="autoplay; encrypted-media"
                title="trailer"
              />
            )}
            <div
              className={`absolute inset-0 w-full h-full z-20 transition-opacity duration-500 ${
                revealTrailer ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}
            >
              <OptimizedImage
                src={thumb}
                fallbackSrc={item.backdrop || item.poster}
                alt={item.title}
                className="w-full h-full object-cover"
                quality="medium"
              />
            </div>

            <div className="absolute top-1.5 left-1.5 z-20">
              <span className="text-[7px] font-bold text-white px-1 py-0.5 bg-red-600 rounded shadow-md shadow-red-900/40 uppercase tracking-widest leading-none">
                EP {item.episodeNumber}
              </span>
            </div>

            {/* Top-right Rating inside popup */}
            {item.rating && (
              <div className="absolute top-1.5 right-1.5 flex items-center justify-center px-1.5 py-0.5 rounded-sm bg-black/60 backdrop-blur-md text-[6px] font-semibold text-yellow-400 border border-white/10 z-20">
                <Star className="w-1.5 h-1.5 text-yellow-500 fill-yellow-500 mr-0.5" />
                <span>{item.rating}</span>
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-[#121212] via-[#121212]/80 to-transparent z-10" />
          </div>

          <div className="p-2.5 flex flex-col items-start text-left w-full">
            <h3
              className="notranslate text-[9px] font-bold text-white line-clamp-1 leading-tight mb-1"
              translate="no"
            >
              {item.title}
            </h3>

            <div className="flex flex-wrap items-center gap-1 mb-2">
              <span className="text-[6px] text-white/50 font-bold uppercase tracking-widest">
                {item.year || item.releaseDate?.split("-")[0]}
              </span>
              <span className="text-[6px] text-white/30">•</span>
              <span className="text-[6px] text-teal-400 font-bold uppercase tracking-widest">
                Episode {item.episodeNumber}
              </span>
            </div>

            <div className="flex items-center gap-1.5 w-full">
              <button
                onClick={(e) => {
                  stop(e);
                  onClick(item as Content, item.episodeNumber - 1);
                }}
                className="bg-white/10 hover:bg-white/20 transition-colors rounded-sm px-2 py-1 flex items-center justify-center gap-1 text-[7px] font-bold text-white tracking-widest uppercase flex-1 border border-white/5"
              >
                <Play className="w-2.5 h-2.5 text-white fill-white" /> Watch
              </button>

              <button
                onClick={(e) => {
                  stop(e);
                  onClick(item as Content, item.episodeNumber - 1);
                }}
                className="w-5 h-5 rounded-sm flex items-center justify-center transition-colors border bg-white/5 hover:bg-white/10 border-white/10 text-white/70"
                title="Trailer"
              >
                <PlayCircle className="w-2.5 h-2.5" />
              </button>

              <button
                onClick={(e) => {
                  stop(e);
                  toast("Link copied to clipboard!", "success");
                }}
                className="w-5 h-5 rounded-sm flex items-center justify-center transition-colors border bg-white/5 hover:bg-white/10 border-white/10 text-white/70"
                title="Bagikan"
              >
                <Share2 className="w-2.5 h-2.5" />
              </button>

              <button
                onClick={(e) => {
                  stop(e);
                  if (!user) {
                    toast("Login required", "info", {
                      action: { label: "LOGIN", onClick: openAuth },
                    });
                    return;
                  }
                  toggleMyList(item);
                }}
                className={`w-5 h-5 rounded-sm flex items-center justify-center border ${inList ? "bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]" : "bg-white/5 hover:bg-white/10 border-white/10 text-white/70"}`}
                title="Add to Watchlist"
              >
                {inList ? (
                  <Check className="w-2.5 h-2.5" />
                ) : (
                  <Plus className="w-2.5 h-2.5" />
                )}
              </button>

              <button
                onClick={(e) => {
                  stop(e);
                  if (!user) {
                    toast("Login required", "info", {
                      action: { label: "LOGIN", onClick: openAuth },
                    });
                    return;
                  }
                  toggleFavorite(item);
                }}
                className={`w-5 h-5 rounded-sm flex items-center justify-center border ${fav ? "bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]" : "bg-white/5 hover:bg-white/10 border-white/10 text-white/70"}`}
                title="Like"
              >
                <Heart
                  className={`w-2.5 h-2.5 ${fav ? "fill-white text-white drop-shadow-md scale-110" : ""}`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

const MovieCard = memo(
  ({
    movie,
    onClick,
    onPlay,
    onPlayTrailer,
    showCommentBadge = false,
    expandOnHover = false,
    priority = false,
    showActions = true,
    passThroughHover = false,
    isAllContent = false,
  }: {
    movie: Content;
    onClick: (m: Content) => void;
    onPlay?: (m: Content, epIndex?: number, seasonIndex?: number) => void;
    onPlayTrailer?: (m: Content) => void;
    showCommentBadge?: boolean;
    expandOnHover?: boolean; // deprecated but kept for compat
    showPlayButtonHover?: boolean; // deprecated
    priority?: boolean;
    showActions?: boolean;
    passThroughHover?: boolean;
    isAllContent?: boolean;
  }) => {
    // satisfying TS
    if (onPlay) {
      /* */
    }
    const {
      user,
      isFavorite,
      isInMyList,
      toggleFavorite,
      toggleMyList,
      toast,
      openAuth,
    } = useUserData();
    const fav = isFavorite(movie.id);
    const inList = isInMyList(movie.id);

    const [isHovered, setIsHovered] = useState(false);
    const [hoverOffset, setHoverOffset] = useState("-50%");
    const [portalRect, setPortalRect] = useState<DOMRect | null>(null);
    const [showTrailer, setShowTrailer] = useState(false);
    const [revealTrailer, setRevealTrailer] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const hoverTimerRef = useRef<any>(null);
    const trailerTimerRef = useRef<any>(null);
    const isOverCardRef = useRef(false);
    const isOverPortalRef = useRef(false);

    const handleMouseEnter = () => {
      isOverCardRef.current = true;
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
      hoverTimerRef.current = setTimeout(() => {
        if (isOverCardRef.current) {
          setIsHovered(true);
          if (cardRef.current) {
            const rect = cardRef.current.getBoundingClientRect();
            setPortalRect(rect);

            const hoverWidth = rect.width * 1.7; // 170% width
            const center = rect.left + rect.width / 2;

            let newX = -50;
            const padding = 10;

            // Use window.innerWidth since it's a fixed portal now
            if (center - hoverWidth / 2 < padding) {
              const diff = padding - (center - hoverWidth / 2);
              newX = -50 + (diff / rect.width) * 100;
            } else if (center + hoverWidth / 2 > window.innerWidth - padding) {
              const diff =
                center + hoverWidth / 2 - (window.innerWidth - padding);
              newX = -50 - (diff / rect.width) * 100;
            }

            setHoverOffset(`${newX}%`);

            // Start trailer autoplay IMMEDIATELY (under the backdrop) when card has scaled up
            setShowTrailer(true);
            setRevealTrailer(false);

            // Hide backdrop and reveal trailer ONLY after staying hovered for 2 seconds (2000 milliseconds)
            if (trailerTimerRef.current) clearTimeout(trailerTimerRef.current);
            trailerTimerRef.current = setTimeout(() => {
              setRevealTrailer(true);
            }, 2000);
          }
        }
      }, 180);
    };

    const handleMouseLeave = () => {
      isOverCardRef.current = false;
      checkClose();
    };

    const handlePortalMouseEnter = () => {
      isOverPortalRef.current = true;
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };

    const handlePortalMouseLeave = () => {
      isOverPortalRef.current = false;
      checkClose();
    };

    const checkClose = () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
      hoverTimerRef.current = setTimeout(() => {
        if (!isOverCardRef.current && !isOverPortalRef.current) {
          setIsHovered(false);
          setShowTrailer(false);
          setRevealTrailer(false);
          if (trailerTimerRef.current) clearTimeout(trailerTimerRef.current);
        }
      }, 100);
    };

    useEffect(() => {
      const handleScrollOrCloseEvent = () => {
        setIsHovered(false);
        setShowTrailer(false);
        isOverCardRef.current = false;
        isOverPortalRef.current = false;
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        if (trailerTimerRef.current) clearTimeout(trailerTimerRef.current);
      };

      window.addEventListener("scroll", handleScrollOrCloseEvent, {
        passive: true,
      });
      window.addEventListener("closeHoverCards", handleScrollOrCloseEvent);
      window.addEventListener("playTrailer", handleScrollOrCloseEvent);

      // Listen for scroll on carousel ancestors
      const carousels = document.querySelectorAll(".overflow-x-auto");
      carousels.forEach((carousel) => {
        carousel.addEventListener("scroll", handleScrollOrCloseEvent, {
          passive: true,
        });
      });

      return () => {
        if (hoverTimerRef.current) {
          clearTimeout(hoverTimerRef.current);
        }
        window.removeEventListener("scroll", handleScrollOrCloseEvent);
        window.removeEventListener("closeHoverCards", handleScrollOrCloseEvent);
        window.removeEventListener("playTrailer", handleScrollOrCloseEvent);
        carousels.forEach((carousel) => {
          carousel.removeEventListener("scroll", handleScrollOrCloseEvent);
        });
      };
    }, []);

    const [isReserved, setIsReserved] = useState(() => {
      try {
        const reserved = JSON.parse(
          localStorage.getItem("reserved_movies") || "[]",
        );
        return reserved.includes(movie.id);
      } catch {
        return false;
      }
    });

    const stop = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
    };

    return (
      <div
        ref={cardRef}
        className={`relative group/card cursor-pointer w-full flex flex-col h-full card-hover-trigger ${isHovered ? "z-[200]" : "z-10"}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          onClick={() => onClick(movie)}
          className={`relative aspect-[2/3] w-full rounded-lg bg-[#1a1a1a] shadow-md border active:scale-95 transition-all duration-300 overflow-hidden ${
            expandOnHover
              ? "border-white/5"
              : "border-white/5 md:group-hover/card:border-red-500/50 md:group-hover/card:shadow-[0_0_20px_rgba(220,38,38,0.3)]"
          }`}
        >
          {/* Poster */}
          <OptimizedImage
            src={movie.poster || undefined}
            fallbackSrc={movie.backdrop}
            alt={movie.title}
            className={`w-full h-full object-cover transition-transform duration-500 ease-out ${!expandOnHover ? "md:group-hover/card:scale-110" : ""}`}
            quality="low"
            priority={priority}
          />

          {/* Top-right status badges */}
          <div className="absolute top-1.5 right-1.5 flex flex-col items-end gap-1 z-40">
            {/* Rating & Viewer Count */}
            {movie.status !== "coming_soon" && (
              <div className="flex flex-col gap-1.5 items-end">
                <div className="flex items-center justify-center px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm shadow-lg shadow-black/40 text-[8px] md:text-[10px] font-semibold text-yellow-400 border border-white/10 shrink-0">
                  <Star className="w-1.5 h-1.5 md:w-2.5 md:h-2.5 text-yellow-500 fill-yellow-500 shrink-0 mr-1" />
                  <span className="shrink-0">{movie.rating}</span>
                </div>
                {showActions && (
                  <div className="flex flex-col gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(movie);
                      }}
                      className={`w-7 h-7 md:w-8 md:h-8 rounded flex items-center justify-center border ${
                        isAllContent
                          ? fav
                            ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/40"
                            : "bg-black/60 backdrop-blur-sm border-white/10 text-white hover:bg-black/80"
                          : fav
                            ? "bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]"
                            : "bg-black/60 backdrop-blur-sm border-white/10 text-white/70"
                      }`}
                      title="Add to Favorite"
                    >
                      {fav ? (
                        <Heart
                          className={`w-4 h-4 scale-110 ${isAllContent ? "fill-white text-white" : "fill-white text-white"}`}
                        />
                      ) : (
                        <Heart className="w-4 h-4 text-white scale-100" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMyList(movie);
                      }}
                      className={`w-7 h-7 md:w-8 md:h-8 rounded flex items-center justify-center border ${
                        isAllContent
                          ? inList
                            ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/40"
                            : "bg-black/60 backdrop-blur-sm border-white/10 text-white hover:bg-black/80"
                          : inList
                            ? "bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]"
                            : "bg-black/60 backdrop-blur-sm border-white/10 text-white/70"
                      }`}
                      title="Add to Watchlist"
                    >
                      {inList ? (
                        <Check className="w-4 h-4 text-white scale-110" />
                      ) : (
                        <Plus className="w-4 h-4 text-white scale-100" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Top-left status badges */}
          <div className="absolute top-1.5 left-1.5 flex flex-col gap-0.5 items-start z-30">
            {showCommentBadge ? (
              <span className="px-1.5 py-0.5 rounded-sm bg-red-600 shadow-md shadow-red-900/40 text-white text-[7px] md:text-[10px] font-semibold flex items-center gap-1">
                <MessageSquare className="w-2 h-2 md:w-2.5 md:h-2.5" />
                {movie.commentsCount || 0}
              </span>
            ) : (
              <>
                {movie.status === "coming_soon" && (
                  <span className="px-1.5 py-0.5 rounded-sm bg-red-600 shadow-md shadow-red-900/40 text-white text-[7px] md:text-[10px] font-semibold uppercase flex items-center gap-0.5">
                    <Calendar className="w-1.5 h-1.5 md:w-2.5 md:h-2.5" /> Soon
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Subtitle / Description Below Poster */}
        <div className="mt-2.5 flex flex-col items-start text-left w-full px-0.5">
          <h3
            className="notranslate text-[11px] md:text-[13px] font-bold text-white/90 line-clamp-1 leading-tight mb-1"
            translate="no"
          >
            {movie.title}
          </h3>
          <div className="flex items-center justify-start gap-1.5 text-[9px] md:text-[10px] text-white/50 font-medium tracking-tight">
            <span>{movie.year || movie.releaseDate?.split("-")[0]}</span>
            <span className="shrink-0 truncate hidden min-[320px]:block">
              {movie.type === "tv"
                ? `• TV ${(() => {
                    const last = getLastEpisodeNumber(movie);
                    return last ? `(${last} Eps)` : "";
                  })()}`
                : `• Movie`}
            </span>
          </div>
        </div>

        {movie.status === "coming_soon" && (
          <button
            onClick={(e) => {
              stop(e);
              try {
                const key = `reserved_movies`;
                let reserved = JSON.parse(localStorage.getItem(key) || "[]");
                if (reserved.includes(movie.id)) {
                  reserved = reserved.filter((id: string) => id !== movie.id);
                  localStorage.setItem(key, JSON.stringify(reserved));
                  setIsReserved(false);
                } else {
                  reserved.push(movie.id);
                  localStorage.setItem(key, JSON.stringify(reserved));
                  setIsReserved(true);
                }
              } catch (err) {
                console.error("Failed to update reservation", err);
              }
            }}
            className={`mt-2 w-full py-1.5 md:py-2 rounded-md md:rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] transition-all border duration-300 ${
              isReserved
                ? "bg-red-600/10 text-red-500 border-red-500/20 hover:bg-red-600/20 shadow-[0_0_15px_rgba(220,38,38,0.15)]"
                : "bg-white/5 text-white/50 border-white/5 hover:bg-white/10 hover:text-white"
            } ${
              isHovered
                ? "opacity-0 pointer-events-none"
                : "opacity-100 md:group-hover:opacity-0 md:group-hover:pointer-events-none"
            }`}
          >
            {isReserved ? "Reserved" : "Reserve"}
          </button>
        )}

        {/* Hover Pop-out Element (Visible only on Desktop/Tablet Hover) */}
        {expandOnHover &&
          typeof document !== "undefined" &&
          createPortal(
            <AnimatePresence>
              {isHovered && portalRect && (
                <motion.div
                  initial={{
                    opacity: 0,
                    scale: 0.9,
                    y: "-40%",
                    x: hoverOffset,
                  }}
                  animate={{ opacity: 1, scale: 1, y: "-50%", x: hoverOffset }}
                  exit={{
                    opacity: 0,
                    scale: 0.9,
                    y: "-40%",
                    x: hoverOffset,
                    pointerEvents: "none",
                  }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  onClick={() => onClick(movie)}
                  onMouseEnter={handlePortalMouseEnter}
                  onMouseLeave={handlePortalMouseLeave}
                  className={`hidden md:flex fixed bg-[#121212] rounded-[0.8rem] border border-white/10 z-[9999] flex-col overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,1)] ${isHovered && !passThroughHover ? "pointer-events-auto" : "pointer-events-none"}`}
                  style={{
                    y: "-50%",
                    x: hoverOffset,
                    top: portalRect.top + portalRect.height * 0.4,
                    left: portalRect.left + portalRect.width / 2,
                    width: portalRect.width * 1.7,
                    aspectRatio: "2/3",
                  }}
                >
                  {/* Backdrop (16:8 ratio) */}
                  <div className="relative w-full aspect-[16/8] bg-[#1a1a1a] shrink-0">
                    {showTrailer && (movie.trailerUrl || movie.embedUrl) && (
                      <iframe
                        src={getEmbedAutoplayUrl(
                          movie.trailerUrl || movie.embedUrl,
                          false,
                          true,
                        )}
                        className="absolute inset-0 w-full h-full object-cover scale-150 pointer-events-none z-10"
                        allow="autoplay; encrypted-media"
                        title="trailer"
                      />
                    )}
                    <div
                      className={`absolute inset-0 w-full h-full z-20 transition-opacity duration-500 ${
                        revealTrailer
                          ? "opacity-0 pointer-events-none"
                          : "opacity-100"
                      }`}
                    >
                      <OptimizedImage
                        src={movie.backdrop || movie.poster || undefined}
                        fallbackSrc={movie.poster}
                        alt={movie.title}
                        className={`w-full h-full object-cover ${movie.backdrop ? "object-[center]" : "object-[center_20%]"}`}
                        quality="medium"
                      />
                    </div>
                    {/* Gradient Overlay for bottom blending */}
                    <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#121212] to-transparent pointer-events-none z-20" />
                  </div>

                  <div className="p-3 flex flex-col justify-between text-left w-full h-full flex-grow relative bg-[#121212] z-20">
                    <div>
                      {/* Title */}
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3
                          className="notranslate text-[14px] md:text-[15px] font-black text-white/90 line-clamp-2 leading-tight flex-1"
                          translate="no"
                        >
                          {movie.title}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[12px] font-bold text-white/90">
                          {movie.year || movie.releaseDate?.split("-")[0]}
                        </span>
                        <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/80 font-bold uppercase">
                          {movie.type === "tv" ? "TV" : "MOVIE"}
                        </span>
                        <span className="text-[11px] text-white/50 font-medium whitespace-nowrap ml-auto">
                          {movie.type === "tv"
                            ? `${getLastEpisodeNumber(movie)} Eps`
                            : movie.duration || "--"}
                        </span>
                      </div>

                      {movie.genres && movie.genres.length > 0 && (
                        <div className="mb-1.5 w-full">
                          <span className="text-[11px] text-white/60 font-medium line-clamp-2 leading-tight block">
                            {movie.genres.join(", ")}
                          </span>
                        </div>
                      )}

                      <p className="mt-1 text-[12px] text-white/70 line-clamp-4 leading-snug">
                        {movie.synopsis || "No synopsis available."}
                      </p>
                    </div>

                    <div className="mt-2 flex items-center justify-between w-full">
                      {/* Trailer button moved inside bottom-left of the card */}
                      {onPlayTrailer || true ? (
                        <button
                          onClick={(e) => {
                            stop(e);
                            if (onPlayTrailer) onPlayTrailer(movie);
                            else
                              window.dispatchEvent(
                                new CustomEvent("playTrailer", {
                                  detail: movie,
                                }),
                              );
                          }}
                          className="flex items-center gap-1 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold py-1 px-2.5 rounded border border-transparent transition-all shadow-md active:scale-95"
                        >
                          <Play className="w-2.5 h-2.5 fill-white" />
                          <span>Trailer</span>
                        </button>
                      ) : (
                        <div />
                      )}

                      <div className="flex items-center gap-1.5 shrink-0 hover-action-btns">
                        <button
                          onClick={(e) => {
                            stop(e);
                            if (!user) {
                              toast("Login required", "info", {
                                action: { label: "LOGIN", onClick: openAuth },
                              });
                              return;
                            }
                            toggleMyList(movie);
                          }}
                          className={`w-6 h-6 rounded flex items-center justify-center border ${
                            isAllContent
                              ? inList
                                ? "bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]"
                                : "bg-white/5 hover:bg-white/10 border-white/10 text-white"
                              : inList
                                ? "bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]"
                                : "bg-white/5 hover:bg-white/10 border-white/10 text-white/70"
                          }`}
                          title="Add to Watchlist"
                        >
                          {inList ? (
                            <Check className="w-3 h-3 text-white" />
                          ) : (
                            <Plus className="w-3 h-3 text-white" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            stop(e);
                            if (!user) {
                              toast("Login required", "info", {
                                action: { label: "LOGIN", onClick: openAuth },
                              });
                              return;
                            }
                            toggleFavorite(movie);
                          }}
                          className={`w-6 h-6 rounded flex items-center justify-center border ${
                            isAllContent
                              ? fav
                                ? "bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]"
                                : "bg-white/5 hover:bg-white/10 border-white/10 text-white"
                              : fav
                                ? "bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]"
                                : "bg-white/5 hover:bg-white/10 border-white/10 text-white/70"
                          }`}
                          title="Like"
                        >
                          <Heart
                            className={`w-3 h-3 ${isAllContent ? "fill-white text-white" : fav ? "fill-white scale-110" : "scale-100"}`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body,
          )}
      </div>
    );
  },
);

function MovieModal({
  movie,
  onClose,
  onSwitchMovie,
  onWatch,
  onTrailerStateChange,
  autoPlay = true,
  onShare,
}: {
  movie: Content;
  onClose: () => void;
  onSwitchMovie: (m: Content) => void;
  onWatch: (m: Content) => void;
  onTrailerStateChange?: (active: boolean) => void;
  autoPlay?: boolean;
  onShare?: (m: Content) => void;
}) {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const {
    user,
    isFavorite,
    isInMyList,
    toggleFavorite,
    toggleMyList,
    toast,
    openAuth,
  } = useUserData();
  const fav = isFavorite(movie.id);
  const inList = isInMyList(movie.id);

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
    const likeRef = fbDoc(db, "content", String(movie.id), "likes", user.uid);
    const unsub = onSnapshot(likeRef, (snap) => {
      setHasLiked(snap.exists());
    });
    return () => unsub();
  }, [movie.id, user]);

  const handleToggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
    const contentRef = fbDoc(db, "content", String(movie.id));
    const likeRef = fbDoc(db, "content", String(movie.id), "likes", user.uid);

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
      console.error("Error toggling like in Modal:", err);
      // Revert optimism on error
      setHasLiked(hasLiked);
      setLikesCount(prevLikesCount);
      toast("Failed to update like status.", "error");
    }
  };

  const formattedLikes = Intl.NumberFormat("en-US", {
    notation: "compact",
  }).format(likesCount || 0);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    if (autoPlay) {
      onTrailerStateChange?.(true);
    }
    return () => {
      document.body.style.overflow = "";
      onTrailerStateChange?.(false);
    };
  }, []);

  // Re-init when movie changes
  useEffect(() => {
    setIsPlaying(autoPlay);
    onTrailerStateChange?.(autoPlay);
  }, [movie.id, autoPlay]);

  const handlePlayTrailer = () => {
    setIsPlaying(true);
    onTrailerStateChange?.(true);
  };

  const handleWatchMovie = () => {
    onWatch(movie);
  };

  const isWindows =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    /win/i.test(navigator.userAgent || "");

  // Mark unused vars used to avoid TS errors (kept for API compat)
  void onSwitchMovie;

  return (
    <motion.div
      initial={isWindows ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={isWindows ? { opacity: 1 } : { opacity: 0 }}
      transition={isWindows ? { duration: 0 } : undefined}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/80 ${isWindows ? "" : "backdrop-blur-sm"}`}
      />

      {/* Modal Content (Netflix-style preview) */}
      <motion.div
        initial={
          isWindows
            ? { opacity: 1, scale: 1, y: 0 }
            : { opacity: 0, scale: 0.92, y: 20 }
        }
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={
          isWindows
            ? { opacity: 1, scale: 1, y: 0 }
            : { opacity: 0, scale: 0.92, y: 20 }
        }
        transition={
          isWindows
            ? { duration: 0 }
            : { type: "spring", damping: 26, stiffness: 320 }
        }
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-[#111] rounded-2xl border border-white/10 shadow-2xl"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 border border-white/10 ${isWindows ? "" : "backdrop-blur"}`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Trailer / preview area */}
        <div className="relative aspect-video bg-black rounded-t-2xl overflow-hidden">
          {isPlaying ? (
            <IframeSecurityShield>
              <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
                <iframe
                  src={(() => {
                    let url = movie.trailerUrl || movie.embedUrl;
                    if (!url) {
                      return `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(movie.title + " official trailer")}&autoplay=1&mute=0&rel=0&modestbranding=1`;
                    }
                    return getEmbedAutoplayUrl(url, false, false);
                  })()}
                  title={movie.title}
                  className="w-full h-full border-none pointer-events-auto scale-115"
                  frameBorder="0"
                  allowFullScreen={true}
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                />
                {/* Cinematic Letterboxing Overlays (to hide YouTube branding & controls) */}
                <div className="absolute top-0 left-0 right-0 h-[8.5%] bg-black z-10 pointer-events-none border-b border-white/5" />
                <div className="absolute bottom-0 left-0 right-0 h-[8.5%] bg-black z-10 pointer-events-none border-t border-white/5" />
              </div>
            </IframeSecurityShield>
          ) : (
            <div
              className="w-full h-full flex items-center justify-center relative group/trailer cursor-pointer"
              onClick={handlePlayTrailer}
            >
              <OptimizedImage
                src={movie.backdrop || movie.poster || undefined}
                fallbackSrc={movie.poster}
                alt={movie.title}
                className={`absolute inset-0 w-full h-full opacity-60 ${!movie.backdrop && movie.poster ? "object-contain my-4" : "object-cover"}`}
                style={
                  movie.backdrop
                    ? {
                        objectPosition: movie.backdropPosition || "50% 50%",
                        transform: `scale(${movie.backdropScale || 1}) rotate(${movie.backdropRotate || 0}deg)`,
                        transformOrigin: movie.backdropPosition || "50% 50%",
                      }
                    : undefined
                }
              />
              <div className="relative z-10 flex flex-col items-center gap-3">
                <div
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-400/90 flex items-center justify-center transition-all duration-500 group-hover/trailer:bg-red-600 group-hover/trailer:scale-110 shadow-2xl ${isWindows ? "" : "backdrop-blur-md"}`}
                >
                  <Play className="w-7 h-7 sm:w-10 sm:h-10 text-white fill-white ml-2" />
                </div>
                <span className="text-white font-black uppercase tracking-[0.3em] text-[10px] sm:text-xs drop-shadow-lg opacity-0 translate-y-2 group-hover/trailer:opacity-100 group-hover/trailer:translate-y-0 transition-all duration-500">
                  Play Trailer
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom info & actions (Netflix-style) */}
        <div className="p-5 md:p-7">
          <div className="flex flex-col md:flex-row md:items-start gap-5">
            <div className="hidden md:block w-32 shrink-0">
              <div className="aspect-[2/3] rounded-xl overflow-hidden border border-white/10">
                <OptimizedImage
                  src={movie.poster || undefined}
                  fallbackSrc={movie.backdrop}
                  alt={movie.title}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {movie.status === "coming_soon" && (
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-red-600 text-white px-2 py-0.5 rounded shadow-lg shadow-red-900/40 flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5" /> Coming Soon
                  </span>
                )}
                <span className="text-[10px] font-bold uppercase tracking-widest bg-red-600 text-white shadow-lg shadow-red-900/40 border border-red-500/50 px-2 py-0.5 rounded">
                  {movie.type === "tv" ? "TV Series" : "Movie"}
                </span>
              </div>
              <h2
                className="notranslate text-lg md:text-2xl font-semibold text-white mb-2"
                translate="no"
              >
                {movie.title}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-white/55 mb-4">
                <span className="flex items-center gap-1 text-yellow-400">
                  <Star className="w-3 h-3 fill-yellow-400" />
                  {movie.rating}
                </span>
                <span>{movie.releaseDate.split("-")[0]}</span>
                <span>
                  {movie.type === "tv"
                    ? (() => {
                        const last = getLastEpisodeNumber(movie);
                        return last === 1
                          ? "1 Eps"
                          : last
                            ? `1-${last} Eps`
                            : "TV";
                      })()
                    : movie.duration}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                {movie.genres?.map((g) => (
                  <span
                    key={g}
                    translate="no"
                    className="notranslate px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-white/60 text-[10px] md:text-xs font-semibold uppercase tracking-wider"
                  >
                    {g}
                  </span>
                ))}
              </div>
              <p className="text-white/55 text-sm leading-relaxed mb-5 line-clamp-4">
                {movie.synopsis}
              </p>

              {/* Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {movie.status === "coming_soon" ? (
                  <div className="flex items-center gap-2 px-5 py-2.5 bg-red-600/50 cursor-not-allowed opacity-80 text-white rounded-xl font-bold text-sm shadow-lg border border-red-500/20 shadow-red-900/10">
                    <Calendar className="w-4 h-4" />
                    Coming Soon
                  </div>
                ) : (
                  <button
                    onClick={handleWatchMovie}
                    className="flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white rounded-xl font-bold text-[11px] sm:text-sm transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-900/40"
                  >
                    <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white" />
                    {movie.type === "tv" ? "Watch Episodes" : "Watch Movie"}
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
                  className={`flex items-center gap-2 px-3 py-2 sm:px-3 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold border ${
                    fav
                      ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/20"
                      : "bg-white/5 border-white/10 text-white/70 hover:text-white"
                  }`}
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${fav ? "fill-white scale-110" : "scale-100"}`}
                  />
                  {fav ? "Favorited" : "Favorite"}
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
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border ${
                    inList
                      ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/20"
                      : "bg-white/5 border-white/10 text-white/70 hover:text-white"
                  }`}
                >
                  {inList ? (
                    <BookmarkCheck className="w-3.5 h-3.5" />
                  ) : (
                    <Bookmark className="w-3.5 h-3.5" />
                  )}
                  {inList ? "Saved" : "Watch List"}
                </button>
                <button
                  onClick={() => onShare?.(movie)}
                  className="flex items-center gap-2 px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl text-xs font-bold border border-white/10 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share
                </button>
                <button
                  onClick={handleToggleLike}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border ml-auto transition-all active:scale-95 ${
                    hasLiked
                      ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/20"
                      : "bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                  title={hasLiked ? "Unlike" : "Like"}
                >
                  <ThumbsUp
                    className={`w-3.5 h-3.5 transition-transform ${hasLiked ? "fill-white scale-110" : "group-hover:scale-110"}`}
                  />
                  <span className="tabular-nums">{formattedLikes}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function App() {
  const [isOnline, setIsOnline] = useState(() => {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  });

  const [isInitialOffline] = useState(() => {
    return typeof navigator !== "undefined" ? !navigator.onLine : false;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Fetch and cache the Connection Error image base64 in local storage for offline use when online
  useEffect(() => {
    if (typeof navigator !== "undefined" && isOnline) {
      fetch("/Connection Error.png")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load connection error asset");
          return res.blob();
        })
        .then((blob) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (reader.result) {
              localStorage.setItem(
                "connection_error_image_base64",
                reader.result as string,
              );
            }
          };
          reader.readAsDataURL(blob);
        })
        .catch((err) => {
          console.warn("Could not cache connection error asset locally:", err);
        });
    }
  }, [isOnline]);

  const { settings, genres: fetchedGenres } = useSettings();
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  );

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const {
    user,
    favorites,
    myList,
    history: userHistory,
    clearHistory,
    toast,
    signOut,
    loading: authLoading,
    openAuth,
  } = useUserData();
  const isMobile = useIsMobile();
  const [isIframeBlocked, setIsIframeBlocked] = useState(false);

  const [pendingRedeemPopup, setPendingRedeemPopup] = useState(false);
  const [, setPendingRedeemCode] = useState("");
  const [redeemProcessing, setRedeemProcessing] = useState(false);

  useEffect(() => {
    // 1. Capture query parameter
    const search = new URLSearchParams(window.location.search);
    const redeem = search.get("redeem");

    if (redeem) {
      const sanitized = redeem.replace(/[^a-zA-Z0-9_-]/g, "");
      localStorage.setItem("pending_redeem_code", sanitized);
      // clean the url
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  const processPendingRedeem = useCallback(
    async (code: string, activeUser: any) => {
      if (redeemProcessing) return;
      setRedeemProcessing(true);
      setPendingRedeemPopup(false);

      try {
        const snap = await getDocs(query(collection(db, "redeem_codes")));
        const codes = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as any[];
        const codeData = codes.find((c) => c.code === code.toUpperCase());

        if (!codeData) {
          toast("Invalid Viyie+ premium link or code.", "error");
          localStorage.removeItem("pending_redeem_code");
          setRedeemProcessing(false);
          return;
        }

        if (codeData.maxUses > 0 && codeData.uses >= codeData.maxUses) {
          toast("Viyie+ premium link has reached its usage limit.", "error");
          localStorage.removeItem("pending_redeem_code");
          setRedeemProcessing(false);
          return;
        }

        if (codeData.expiresAt) {
          const isExpired = Date.now() > codeData.expiresAt.toMillis();
          if (isExpired) {
            toast("This Viyie+ premium link has expired.", "error");
            localStorage.removeItem("pending_redeem_code");
            setRedeemProcessing(false);
            return;
          }
        }

        // Check if user already has Viyie+
        const currentTiers = activeUser?.tiers || [
          activeUser?.tier || "regular",
        ];
        if (currentTiers.includes("viyie_plus")) {
          toast("You already have Viyie+ access!", "info");
          localStorage.removeItem("pending_redeem_code");
          setRedeemProcessing(false);
          return;
        }

        // Record use
        await updateDoc(fbDoc(db, "redeem_codes", codeData.id), {
          uses: increment(1),
        });

        // Update User to Viyie+
        const newTiers = [...currentTiers];
        if (!newTiers.includes("viyie_plus")) {
          newTiers.push("viyie_plus");
        }

        await updateDoc(fbDoc(db, "users", activeUser.uid), {
          tiers: newTiers,
          tier: newTiers[0],
        });

        toast("Successfully claimed Viyie+ access!", "success");
        localStorage.removeItem("pending_redeem_code");

        // Force reload to apply changes globally
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (e) {
        console.error(e);
        toast("An error occurred during Viyie+ activation.", "error");
        setRedeemProcessing(false);
      }
    },
    [db, toast, redeemProcessing],
  );

  useEffect(() => {
    // 2. Check pending code
    if (authLoading) return;

    const pendingCode = localStorage.getItem("pending_redeem_code");
    if (!pendingCode) return;

    if (!user) {
      // User not logged in, show popup
      setPendingRedeemPopup(true);
      setPendingRedeemCode(pendingCode);
    } else {
      // User logged in, process it
      processPendingRedeem(pendingCode, user);
    }
  }, [user, authLoading, processPendingRedeem]);

  useEffect(() => {
    const handleManualRedeem = (e: CustomEvent) => {
      const code = e.detail?.code;
      if (!code) return;
      const sanitized = code.replace(/[^a-zA-Z0-9_-]/g, "");
      localStorage.setItem("pending_redeem_code", sanitized);

      if (!user) {
        setPendingRedeemPopup(true);
        setPendingRedeemCode(sanitized);
      } else {
        processPendingRedeem(sanitized, user);
      }
    };

    window.addEventListener("viyie_manual_redeem" as any, handleManualRedeem);
    return () =>
      window.removeEventListener(
        "viyie_manual_redeem" as any,
        handleManualRedeem,
      );
  }, [user, processPendingRedeem]);

  const computedIsUserOwner = Boolean(
    user?.email === "firefuryggwp@gmail.com" ||
    (user?.email &&
      settings?.staffs?.some(
        (s) => s.role === "owner" && s.email === user?.email,
      )),
  );

  const computedIsUserAdmin = Boolean(
    computedIsUserOwner ||
    (user?.email &&
      settings?.staffs?.some(
        (s) => s.role === "admin" && s.email === user?.email,
      )),
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__VIYIE_USER_IS_STAFF = !!(
        computedIsUserAdmin || computedIsUserOwner
      );
    }
  }, [computedIsUserAdmin, computedIsUserOwner]);

  useEffect(() => {
    const handleQuickAction = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.action === "logout") {
        signOut().catch(console.error);
      }
    };
    window.addEventListener("viyie_quick_action", handleQuickAction);
    return () =>
      window.removeEventListener("viyie_quick_action", handleQuickAction);
  }, [signOut]);

  useEffect(() => {
    // Iframe sandbox restriction disabled to allow Google AI Studio and sandbox preview frames
    setIsIframeBlocked(false);
  }, []);

  // FRONT-END ULTRA SECURITY GUARD: Blocks F12, Right-click, and freezes debugger inspectors
  useEffect(() => {
    // 1. Block Context Menu (Right Click)
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest(".viyieplayer")) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener("contextmenu", handleContextMenu, true);

    // 2. Traps keyboard attempts (F12, Ctrl+Shift+I, Cmd+Opt+I, Ctrl+U, etc.)
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;
      const isAlt = e.altKey;

      const key = e.key.toLowerCase();

      if (
        e.key === "F12" ||
        (isCmdOrCtrl &&
          isShift &&
          (key === "i" || key === "j" || key === "c")) ||
        (isCmdOrCtrl && isAlt && (key === "i" || key === "j" || key === "c")) ||
        (isCmdOrCtrl && key === "u") ||
        (isCmdOrCtrl && key === "s") ||
        (isCmdOrCtrl && isAlt && key === "u")
      ) {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new Event("viyieCompromised"));

        handleContextMenu(e as any);
        return false;
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  // ISP custom network blocking states
  const [ipData, setIpData] = useState<{
    ip: string;
    isp: string;
    city: string;
    country: string;
    loaded: boolean;
  }>(() => {
    const savedSimIsp = localStorage.getItem("viyie_simulated_isp");
    return {
      ip: "182.1.84.14",
      isp: savedSimIsp || "",
      city: "Jakarta",
      country: "Indonesia",
      loaded: Boolean(savedSimIsp),
    };
  });

  useEffect(() => {
    const savedSimIsp = localStorage.getItem("viyie_simulated_isp");
    if (savedSimIsp) {
      setIpData((prev) => ({
        ...prev,
        isp: savedSimIsp,
        loaded: true,
      }));
      return;
    }

    let active = true;
    const fetchIpInfo = async () => {
      // API 1: ipapi.co
      try {
        const res = await fetch("https://ipapi.co/json/");
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          setIpData({
            ip: data.ip || "114.124.23.82",
            isp: data.org || "Indihome",
            city: data.city || "Jakarta",
            country: data.country_name || "Indonesia",
            loaded: true,
          });
          return;
        }
      } catch (err) {}

      // API 2: ip-api.com (backup)
      try {
        const res = await fetch("https://ip-api.com/json/");
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          setIpData({
            ip: data.query || "114.124.23.82",
            isp: data.isp || data.org || "Indihome",
            city: data.city || "Jakarta",
            country: data.country || "Indonesia",
            loaded: true,
          });
          return;
        }
      } catch (err) {}

      // Last fallback
      if (active) {
        setIpData((prev) => ({
          ...prev,
          isp: "Indihome",
          loaded: true,
        }));
      }
    };

    fetchIpInfo();
    return () => {
      active = false;
    };
  }, []);

  const handleSimulateIspChange = (newIsp: string) => {
    if (newIsp === "Biznet Networks" || newIsp === "Biznet") {
      localStorage.removeItem("viyie_simulated_isp");
      setIpData((prev) => ({
        ...prev,
        isp: "Biznet Networks",
        loaded: true,
      }));
    } else {
      localStorage.setItem("viyie_simulated_isp", newIsp);
      setIpData((prev) => ({
        ...prev,
        isp: newIsp,
        loaded: true,
      }));
    }
  };

  const [selectedAdPopupUrl, setSelectedAdPopupUrl] = useState<string | null>(
    null,
  );
  const [adPopupKey, setAdPopupKey] = useState(0);

  const [appInitialized, setAppInitialized] = useState(false);
  useEffect(() => {
    if (appInitialized) {
      console.log("System initialization sequence complete.");
    }
  }, [appInitialized]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const [selectedMovie, setSelectedMovie] = useState<Content | null>(null);
  const [watchMovie, setWatchMovie] = useState<Content | null>(null);

  useEffect(() => {
    if (watchMovie) {
      window.dispatchEvent(new CustomEvent("closeHoverCards"));
    }
  }, [watchMovie]);

  const [showAdConsent, setShowAdConsent] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ad_consent_given") !== "true";
    }
    return true;
  });
  const [targetedEpisode, setTargetedEpisode] = useState<{
    episode: number;
    season: number;
  } | null>(null);

  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);

  const [randomFallbackMovies, setRandomFallbackMovies] = useState<Content[]>(
    [],
  );

  const openStream = useCallback(
    (movie: Content, epIndex?: number, seasonIndex?: number) => {
      setSelectedMovie(null);
      setTargetedEpisode(
        epIndex !== undefined
          ? { episode: epIndex, season: seasonIndex || 0 }
          : null,
      );
      setWatchMovie(movie);
      const next = streamPath(movie);
      if (window.location.pathname !== next) {
        window.history.pushState({ movieId: movie.id }, "", next);
        setCurrentPath(next);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [],
  );

  const [trailerAutoPlay, setTrailerAutoPlay] = useState(false);

  const handleGlobalBack = useCallback(() => {
    if (window.history.length > 2) {
      window.history.back();
    } else {
      window.history.pushState({}, "", "/");
      setCurrentPath("/");
    }
  }, []);

  const onMovieCardClick = useCallback((movie: Content) => {
    window.dispatchEvent(new CustomEvent("closeHoverCards"));
    setTrailerAutoPlay(true);
    setSelectedMovie(movie);
  }, []);

  const onTrailerClick = useCallback((movie: Content) => {
    window.dispatchEvent(new CustomEvent("closeHoverCards"));
    setTrailerAutoPlay(true);
    setSelectedMovie(movie);
  }, []);

  useEffect(() => {
    const handlePlayTrailerEvent = (e: CustomEvent<Content>) => {
      onTrailerClick(e.detail);
    };
    window.addEventListener(
      "playTrailer",
      handlePlayTrailerEvent as EventListener,
    );
    return () =>
      window.removeEventListener(
        "playTrailer",
        handlePlayTrailerEvent as EventListener,
      );
  }, [onTrailerClick]);
  const [activeTab, setActiveTab] = useState("home");
  const [selectedSoonMovie, setSelectedSoonMovie] = useState<Content | null>(
    null,
  );
  const [soonVisibleCount, setSoonVisibleCount] = useState(12);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPop = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Automatically route to /error when offline during initial loading, if initially offline, or if route is not found
  useEffect(() => {
    const validPaths = [
      "/",
      "/home",
      "/movies",
      "/tv",
      "/profile/settings",
      "/login",
      "/viyieopening",
      "/privacy",
      "/terms",
      "/language",
      "/needhelp",
      "/help",
      "/reportbug",
      "/report",
      "/notifuser",
      "/subsviyie",
      "/adminfirefury",
      "/error",
      "/eror",
      "/genre",
      "/series",
      "/history",
      "/liked",
      "/mylist",
      "/network",
      "/soon",
    ];

    const isPathValid =
      validPaths.includes(currentPath) ||
      currentPath.startsWith("/profile/") ||
      currentPath.startsWith("/play.id/") ||
      currentPath.startsWith("/e/") ||
      currentPath.startsWith("/dow.id/") ||
      currentPath.includes("/movie/") ||
      currentPath.includes("/tv/") ||
      currentPath.includes("/watch/") ||
      (currentPath.startsWith("/home/") && currentPath !== "/home") ||
      Boolean(watchMovie);

    if (isInitialOffline || (!appInitialized && !isOnline)) {
      if (
        window.location.pathname !== "/error" &&
        window.location.pathname !== "/eror"
      ) {
        localStorage.setItem("saved_error_route", "/error");
        window.history.replaceState({}, "", "/error");
        setCurrentPath("/error");
      }
    } else if (
      isOnline &&
      (currentPath === "/error" || currentPath === "/eror")
    ) {
      window.history.replaceState({}, "", "/home");
      setCurrentPath("/home");
      window.dispatchEvent(new PopStateEvent("popstate"));
    } else if (!isPathValid) {
      if (
        window.location.pathname !== "/error" &&
        window.location.pathname !== "/eror"
      ) {
        window.history.replaceState({}, "", "/error");
        setCurrentPath("/error");
      }
    }
  }, [isInitialOffline, appInitialized, isOnline, currentPath, watchMovie]);

  const isFirstVisitRef = useRef(
    sessionStorage.getItem("has_visited_app_ad") !== "true",
  );
  const firstVisitAdBlocked = useRef(false);
  const adPopupTriggeredInSession = useRef(false);

  useEffect(() => {
    if (currentPath !== "/" && currentPath !== "/home") {
      firstVisitAdBlocked.current = false;
      isFirstVisitRef.current = false;
    }
  }, [currentPath]);

  // Ad popup effect must be here after activeTab and currentPath
  useEffect(() => {
    const isStreamingPath =
      window.location.pathname.includes("/movie/") ||
      window.location.pathname.includes("/tv/") ||
      window.location.pathname.includes("/watch/") ||
      (window.location.pathname.match(/\/home\/([^/?#]+)/) &&
        window.location.pathname !== "/home") ||
      Boolean(watchMovie);
    if (isStreamingPath) {
      return;
    }

    if (
      activeTab === "home" &&
      (currentPath === "/" || currentPath === "/home")
    ) {
      // If user is premium/admin, do not trigger popups!
      const isUserPremium = Boolean(
        user?.email === "firefuryggwp@gmail.com" ||
        (user?.email &&
          settings?.staffs?.some((s) => s.email === user?.email)) ||
        (user?.tiers || [user?.tier || "regular"]).includes("viyie_plus"),
      );
      if (isUserPremium) {
        return;
      }

      if (adPopupTriggeredInSession.current) {
        return;
      }

      if (isFirstVisitRef.current) {
        sessionStorage.setItem("has_visited_app_ad", "true");
        firstVisitAdBlocked.current = true;
        return; // do not show on very first visit
      }
      if (firstVisitAdBlocked.current) {
        return;
      }

      const popups =
        settings?.adPopups?.filter(
          (p) => p.active && Number(p.percentage) > 0,
        ) || [];
      if (
        popups.length === 0 &&
        settings?.adPopupYouTubeUrl &&
        settings?.adPopupPercentage
      ) {
        popups.push({
          id: "legacy",
          url: settings.adPopupYouTubeUrl,
          percentage: settings.adPopupPercentage,
          active: true,
        });
      }

      if (popups.length > 0) {
        let totalPercentage = popups.reduce(
          (a, b) => a + (Number(b.percentage) || 0),
          0,
        );
        if (totalPercentage <= 0) totalPercentage = 100; // fallback

        let randomValue = Math.random() * totalPercentage;
        let selectedUrl = null;

        let cumulativePercentage = 0;
        for (const popup of popups) {
          const perc = Number(popup.percentage);
          if (isNaN(perc) || perc <= 0) continue;
          cumulativePercentage += perc;
          if (randomValue <= cumulativePercentage) {
            selectedUrl = popup.url;
            break;
          }
        }

        if (!selectedUrl && popups.length > 0) {
          selectedUrl = popups[0].url; // fallback to first
        }

        if (selectedUrl) {
          setSelectedAdPopupUrl(selectedUrl);
          setAdPopupKey((k) => k + 1);
          adPopupTriggeredInSession.current = true;
        }
      }
    }
  }, [
    activeTab,
    currentPath,
    settings?.adPopups,
    settings?.adPopupYouTubeUrl,
    settings?.adPopupPercentage,
    user,
    settings?.staffs,
  ]);

  const [latestReleaseType, setLatestReleaseType] = useState<
    "all" | "movie" | "tv"
  >("all");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [genreFormat, setGenreFormat] = useState<"all" | "tv" | "movie">("all");
  const [genreSort, setGenreSort] = useState<
    "latest_upload" | "newest_release" | "az" | "za" | "year_desc" | "year_asc"
  >("latest_upload");
  const [genreYear, setGenreYear] = useState<string>("all");
  const [genrePage, setGenrePage] = useState(1);
  const [sortBy, setSortBy] = useState<
    "latest_upload" | "latest" | "oldest" | "rating" | "year" | "new"
  >("latest_upload");

  useEffect(() => {
    setGenrePage(1);
  }, [selectedGenres, genreFormat, genreSort, genreYear, debouncedSearchQuery]);
  const [browseModal, setBrowseModal] = useState<{
    title: string;
    movies: Content[];
  } | null>(null);

  useEffect(() => {
    if (browseModal) {
      window.dispatchEvent(new CustomEvent("closeHoverCards"));
    }
  }, [browseModal]);

  const [showFilters, setShowFilters] = useState(false);
  const [isStreamRunning, setIsStreamRunning] = useState(false);
  const handleSetIsStreamRunning = useCallback((running: boolean) => {
    setIsStreamRunning(running);
  }, []);
  const [isHoveringTop, setIsHoveringTop] = useState(false);
  const [forceShowNavbar, setForceShowNavbar] = useState(false);

  useEffect(() => {
    if (forceShowNavbar && isMobile) {
      const timer = setTimeout(() => {
        setForceShowNavbar(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [forceShowNavbar, isMobile]);

  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);

  useEffect(() => {
    const path = window.location.pathname;
    let tab = path.replace(/^\//, "");
    if (tab === "") tab = "home";
    if (tab === "movies") tab = "movie"; // Plural fix
    if (tab === "soon") tab = "upcoming"; // Soon mapping
    if (tab === "liked") tab = "favorites";

    if (
      tab === "home" ||
      tab === "tv" ||
      tab === "movie" ||
      tab === "network" ||
      tab === "upcoming" ||
      tab === "genre" ||
      tab === "notifuser" ||
      tab === "history" ||
      tab === "favorites" ||
      tab === "mylist" ||
      tab === "series" ||
      tab === "subsviyie"
    ) {
      setActiveTab(tab);
    }
  }, [currentPath]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setIsHoveringTop(e.clientY < 120);
      if (e.clientY >= 120) setForceShowNavbar(false);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const [isLockerOpen, setIsLockerOpen] = useState(false);
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const isNavbarHidden =
    isLockerOpen ||
    (!!(watchMovie && isStreamRunning && !forceShowNavbar) &&
      !isNavMenuOpen);
  const [showAllGenres, setShowAllGenres] = useState(false);
  // Removed duplicate useUserData destructured call, moved to top of App component

  const isViyiePlus = (user?.tiers || [user?.tier || "regular"]).includes(
    "viyie_plus",
  );

  // Synchronize ad consent popup and other ads immediately if user's premium status changes from true to false
  const prevIsViyiePlusRef = useRef(isViyiePlus);
  useEffect(() => {
    if (prevIsViyiePlusRef.current && !isViyiePlus) {
      localStorage.removeItem("ad_consent_given");
      setShowAdConsent(true);
    }
    prevIsViyiePlusRef.current = isViyiePlus;
  }, [isViyiePlus]);

  useEffect(() => {
    const q = query(collection(db, "notifications"), orderBy("date", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const readIds = JSON.parse(
          localStorage.getItem("read_notifications") || "[]",
        );
        const deletedIds = JSON.parse(
          localStorage.getItem("deleted_notifications") || "[]",
        );
        const now = Date.now();
        const expiryTime = 5 * 24 * 60 * 60 * 1000;

        let count = 0;
        const list: any[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (data.userId && data.userId !== user?.uid) return;
          const notifDate = new Date(data.date).getTime();
          if (now - notifDate <= expiryTime && !deletedIds.includes(d.id)) {
            if (!readIds.includes(d.id)) count++;
            list.push({ ...data, id: d.id });
          }
        });
        setUnreadNotifsCount(count);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "notifications");
      },
    );
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (user?.commentBannedUntil) {
      const until = user.commentBannedUntil;
      const key = `ban_notified_${until}_${user.uid}`;
      if (!localStorage.getItem(key)) {
        const isPermanent = until === "permanent";
        const isFuture = !isPermanent && new Date(until).getTime() > Date.now();
        if (isPermanent || isFuture) {
          const msg = isPermanent
            ? "Your account has been permanently restricted from commenting."
            : `Your account has been restricted from commenting until: ${new Date(until).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}`;
          toast(msg, "error", { duration: 10000 });
          localStorage.setItem(key, "true");
        }
      }
    }
  }, [user, toast]);
  const {
    contents,
    rawContents,
    homeHeroContent,
    movieHeroContent,
    tvHeroContent,
    homeBottomHeroContent,
    latestAll,
    latestMovies,
    latestTv,
    popularAll,
    popularMovie,
    popularTv,
    topAll,
    latestEpisodes,
    loading,
  } = useContent(activeTab);

  useEffect(() => {
    if (contents && contents.length > 0 && randomFallbackMovies.length === 0) {
      const available = contents.filter((c) => c.status !== "coming_soon");
      // Pick 20 random content as stable fallback
      const shuffled = [...available]
        .sort(() => 0.5 - Math.random())
        .slice(0, 20);
      setRandomFallbackMovies(shuffled);
    }
  }, [contents, randomFallbackMovies.length]);

  // Real-time sync for active movie state
  useEffect(() => {
    if (watchMovie) {
      const updated = contents.find((c) => c.id === watchMovie.id);
      if (updated) {
        // Only update if likesCount or other relevant fields changed to avoid unnecessary re-renders
        if (updated.likesCount !== watchMovie.likesCount) {
          setWatchMovie(updated);
        }
      }
    }
    if (selectedMovie) {
      const updated = contents.find((c) => c.id === selectedMovie.id);
      if (updated) {
        if (updated.likesCount !== selectedMovie.likesCount) {
          setSelectedMovie(updated);
        }
      }
    }
  }, [contents, watchMovie?.id, selectedMovie?.id]);

  const initializationStarted = useRef(false);

  // Removed safety timer

  // 2. Database onload initialization effect
  useEffect(() => {
    if (currentPath === "/login" || currentPath === "/viyieopening") {
      setAppInitialized(true);
      return;
    }

    if (!loading && !initializationStarted.current) {
      initializationStarted.current = true;

      // Immediate redirect to opening or home if at root
      if (window.location.pathname === "/" || currentPath === "/") {
        const hasSeen = localStorage.getItem("has_seen_opening") === "true";
        const targetRoute = hasSeen ? "/home" : "/viyieopening";
        window.history.replaceState({}, "", targetRoute);
        setCurrentPath(targetRoute);
      }

      // Show application frame
      setAppInitialized(true);
    }
  }, [loading, currentPath]);

  useEffect(() => {
    if (settings) {
      document.title = settings.seoTitle || BRAND_NAME;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute("content", settings.seoDescription || "");
      }
    }
  }, [settings]);

  const allGenres = useMemo(() => {
    return ["All", ...fetchedGenres];
  }, [fetchedGenres]);

  const allYears = useMemo(() => {
    const years = new Set<string>();
    contents.forEach((c) => {
      const y = c.releaseDate?.split("-")[0] || String(c.year || "");
      if (y && y !== "undefined" && y.trim() !== "") {
        years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [contents]);

  const visibleGenres = useMemo(() => {
    return allGenres.filter((g) => !settings?.hiddenGenres?.includes(g));
  }, [allGenres, settings?.hiddenGenres]);

  const isAdFreeUser = Boolean(
    user &&
    ((user.tiers || [user.tier || "regular"]).includes("viyie_plus") ||
      user.tier === "viyie_plus"),
  );

  const [adClicked, setAdClicked] = useState(false);

  // Admin session state (for manual login)
  const [adminToken, setAdminToken] = useState(
    () => localStorage.getItem("vinet_admin_token") || "",
  );

  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [customTracks, setCustomTracks] = useState<
    { id?: string; title: string; url: string; isCustom?: boolean }[]
  >([]);

  // Load custom tracks from IndexedDB asynchronously
  useEffect(() => {
    let activeUrls: { [id: string]: string } = {};
    const loadTracks = async () => {
      try {
        const dbTracks = await getAllTracks();
        const loaded = dbTracks.map((t) => {
          const url = URL.createObjectURL(t.blob);
          activeUrls[t.id] = url;
          return {
            id: t.id,
            title: t.title,
            url,
            isCustom: true,
          };
        });
        setCustomTracks(loaded);
      } catch (err) {
        console.error("Failed to load tracks from IndexedDB:", err);
      }
    };
    loadTracks();

    return () => {
      // Clean up object URLs on component unmount
      Object.values(activeUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const allTracks = useMemo(() => {
    const defaultTracks = [
      { title: "Paradise", url: "/k1.mp3", isCustom: false },
      { title: "Watch Until Night", url: "/k2.mp3", isCustom: false },
    ];
    return [...defaultTracks, ...customTracks].map((t) => ({
      ...t,
      isCustom: t.isCustom ?? false,
    }));
  }, [customTracks]);

  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [isTrailerActive, setIsTrailerActive] = useState(false);
  const [globalSharingMovie, setGlobalSharingMovie] = useState<Content | null>(
    null,
  );

  // Stop music when entering admin panel
  useEffect(() => {
    if (currentPath === "/admin" || currentPath === "/adminfirefury") {
      setIsMusicPlaying(false);
    }
  }, [currentPath]);

  useEffect(() => {
    if (user?.profileSettings?.activeTrackIndex !== undefined) {
      setActiveTrackIndex(user.profileSettings.activeTrackIndex);
    }
    if (user?.profileSettings?.enableMusic !== undefined) {
      setIsMusicPlaying(user.profileSettings.enableMusic);
    }
  }, [user]);

  const musicSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateMusicPreference = async (updates: any) => {
    if (!user) return;

    // Debounce server update
    if (musicSyncTimeoutRef.current) clearTimeout(musicSyncTimeoutRef.current);
    musicSyncTimeoutRef.current = setTimeout(async () => {
      try {
        const userRef = fbDoc(db, "users", user.uid);
        await updateDoc(userRef, {
          "profileSettings.activeTrackIndex":
            updates.activeTrackIndex !== undefined
              ? updates.activeTrackIndex
              : activeTrackIndex,
          "profileSettings.enableMusic":
            updates.enableMusic !== undefined
              ? updates.enableMusic
              : (user.profileSettings?.enableMusic ?? true),
        });
      } catch (e) {
        console.error(e);
      }
    }, 5000); // 5 seconds debounce
  };
  const isAdminRoute = currentPath === "/adminfirefury";

  const isNetworkBlocked = useMemo(() => {
    return false;
  }, []);

  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("vinet-recent");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!loading && contents.length > 0) {
      const initial = movieFromLocationPath(contents);
      if (initial && initial.id !== watchMovie?.id) {
        setWatchMovie(initial);
      }
    }
    const onPop = () => {
      if (!loading && contents.length > 0) {
        const found = movieFromLocationPath(contents);
        if (found && found.id !== watchMovie?.id) {
          setWatchMovie(found);
        } else if (!found && watchMovie) {
          setWatchMovie(null);
        }
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [loading, contents, watchMovie?.id]);

  useEffect(() => {
    if (watchMovie) {
      setIsMusicPlaying(false); // Pause music when content loads
    } else {
      setForceShowNavbar(false);
      setIsStreamRunning(false);
    }
  }, [watchMovie]);

  const addRecentSearch = useCallback((q: string) => {
    if (!q.trim()) return;
    setRecentSearches((prev) => {
      const next = [q, ...prev.filter((r) => r !== q)].slice(0, 6);
      try {
        localStorage.setItem("vinet-recent", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Basic anti-copy / anti-drag protection (not foolproof)
  useEffect(() => {
    const isTargetEditable = (target: EventTarget | null) => {
      if (!target) return false;
      const el = target as HTMLElement;
      return (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable ||
        (el.closest &&
          (el.closest("[contenteditable]") !== null ||
            el.closest("input") !== null ||
            el.closest("textarea") !== null))
      );
    };

    const block = (e: Event) => {
      const isInsideAdmin =
        window.location.pathname.includes("admin") ||
        currentPath.includes("admin");
      if (isInsideAdmin || isTargetEditable(e.target)) return;
      e.preventDefault();
    };

    const onKey = (e: KeyboardEvent) => {
      const isInsideAdmin =
        window.location.pathname.includes("admin") ||
        currentPath.includes("admin");
      if (isInsideAdmin || isTargetEditable(e.target)) return;
      if (
        (e.ctrlKey || e.metaKey) &&
        ["c", "x", "u", "s", "p", "a"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
      }
      if (e.key === "F12") e.preventDefault();
    };

    document.addEventListener("copy", block, true);
    document.addEventListener("cut", block);
    document.addEventListener("dragstart", block);
    document.addEventListener("selectstart", block);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("copy", block, true);
      document.removeEventListener("cut", block);
      document.removeEventListener("dragstart", block);
      document.removeEventListener("selectstart", block);
      window.removeEventListener("keydown", onKey);
    };
  }, [currentPath]);

  const filteredMovies = useMemo(() => {
    let result = [...contents];

    // Search filter
    if (debouncedSearchQuery.trim()) {
      const tokens = debouncedSearchQuery
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      result = result.filter((m) => {
        const textToSearch = [
          m.title,
          m.originalTitle,
          m.releaseDate,
          m.year?.toString(),
          m.studio,
          m.synopsis,
          ...(m.genres || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return tokens.every((token) => textToSearch.includes(token));
      });
    }

    // Tab filter
    if (activeTab === "latest") {
      result = result.filter((m) => m.isNew && m.status !== "coming_soon");
    } else if (activeTab === "popular") {
      result = result.filter((m) => m.isTrending && m.status !== "coming_soon");
    } else if (activeTab === "movie") {
      result = result.filter(
        (m) => m.type === "movie" && m.status !== "coming_soon",
      );
    } else if (activeTab === "tv") {
      result = result.filter(
        (m) => m.type === "tv" && m.status !== "coming_soon",
      );
    } else if (activeTab === "upcoming") {
      result = result.filter((m) => m.status === "coming_soon");
    } else if (activeTab === "genre") {
      if (genreFormat === "movie") {
        result = result.filter((m) => m.type === "movie");
      } else if (genreFormat === "tv") {
        result = result.filter((m) => m.type === "tv");
      }
      if (genreYear !== "all") {
        result = result.filter((m) => {
          const y = m.releaseDate?.split("-")[0] || String(m.year || "");
          return y === genreYear;
        });
      }
    }

    // Genre filter
    if (selectedGenres.length > 0) {
      result = result.filter((m) =>
        selectedGenres.some((g) => m.genres.includes(g)),
      );
    }

    // Network filter
    if (selectedNetwork) {
      result = result.filter((m) => {
        const inNetworks = m.networks?.some(
          (net) => net.toLowerCase() === selectedNetwork.toLowerCase(),
        );
        const inStudio = m.studio
          ?.toLowerCase()
          .includes(selectedNetwork.toLowerCase());
        return inNetworks || inStudio;
      });
    }

    // Sort logic
    result.sort((a, b) => {
      const activeSort = activeTab === "genre" ? genreSort : sortBy;

      const rA = parseFloat(String(a.rating));
      const rB = parseFloat(String(b.rating));
      const validRA = isNaN(rA) ? 0 : rA;
      const validRB = isNaN(rB) ? 0 : rB;

      if (activeSort === "rating") return validRB - validRA;
      if (activeSort === "year" || activeSort === "year_desc") {
        const yearA = parseInt(a.releaseDate?.split("-")[0] || String(a.year));
        const yearB = parseInt(b.releaseDate?.split("-")[0] || String(b.year));
        const vA = isNaN(yearA) ? 0 : yearA;
        const vB = isNaN(yearB) ? 0 : yearB;
        return vB - vA;
      }
      if (activeSort === "year_asc") {
        const yearA = parseInt(a.releaseDate?.split("-")[0] || String(a.year));
        const yearB = parseInt(b.releaseDate?.split("-")[0] || String(b.year));
        const vA = isNaN(yearA) ? 0 : yearA;
        const vB = isNaN(yearB) ? 0 : yearB;
        return vA - vB;
      }
      if (activeSort === "az") {
        return (a.title || "").localeCompare(b.title || "");
      }
      if (activeSort === "za") {
        return (b.title || "").localeCompare(a.title || "");
      }
      if (activeSort === "oldest") {
        const da = new Date(a.releaseDate || 0).getTime();
        const db = new Date(b.releaseDate || 0).getTime();
        return (isNaN(da) ? 0 : da) - (isNaN(db) ? 0 : db);
      }
      if (activeSort === "latest" || activeSort === "newest_release") {
        const da = new Date(a.releaseDate || 0).getTime();
        const db = new Date(b.releaseDate || 0).getTime();
        return (isNaN(db) ? 0 : db) - (isNaN(da) ? 0 : da);
      }
      if (activeSort === "new") {
        if (a.isNew && !b.isNew) return -1;
        if (!a.isNew && b.isNew) return 1;
      }
      // default: latest (upload date)
      const getTime = (val: any) => {
        if (!val) return 0;
        try {
          if (typeof val.toMillis === "function") return val.toMillis();
          return new Date(val).getTime() || 0;
        } catch (e) {
          return 0;
        }
      };
      return getTime(b.createdAt) - getTime(a.createdAt);
    });

    return result;
  }, [
    contents,
    debouncedSearchQuery,
    activeTab,
    selectedGenres,
    sortBy,
    genreFormat,
    genreYear,
    genreSort,
    selectedNetwork,
  ]);

  const [gridCols, setGridCols] = useState(6);
  useEffect(() => {
    const updateCols = () => {
      if (window.innerWidth >= 1536) setGridCols(8);
      else if (window.innerWidth >= 1280) setGridCols(6);
      else if (window.innerWidth >= 768) setGridCols(5);
      else if (window.innerWidth >= 640) setGridCols(4);
      else setGridCols(3);
    };
    updateCols();
    window.addEventListener("resize", updateCols);
    return () => window.removeEventListener("resize", updateCols);
  }, []);

  const genrePerPage = gridCols * 6;
  const genreTotalPages = Math.max(
    1,
    Math.ceil(filteredMovies.length / genrePerPage),
  );
  const genrePageItems = useMemo(
    () =>
      filteredMovies.slice(
        (genrePage - 1) * genrePerPage,
        genrePage * genrePerPage,
      ),
    [filteredMovies, genrePage, genrePerPage],
  );

  useEffect(() => {
    if (genrePage > genreTotalPages && genreTotalPages > 0) {
      setGenrePage(1);
    }
  }, [genrePage, genreTotalPages]);

  const sectionTitle =
    activeTab === "latest"
      ? "Latest Movies"
      : activeTab === "popular"
        ? "Popular Movies"
        : activeTab === "movie"
          ? "Movies"
          : activeTab === "tv"
            ? "TV"
            : activeTab === "network"
              ? selectedNetwork
                ? `Network: ${selectedNetwork}`
                : "All Networks"
              : debouncedSearchQuery
                ? `Search Results "${debouncedSearchQuery}"`
                : selectedGenres.length > 0
                  ? `Genre: ${selectedGenres.join(", ")}`
                  : "All Movies";

  // Build movie lists from user data (preserve user's add order)
  const favoriteMovies = useMemo(
    () =>
      favorites
        .map((id) => contents.find((m) => m.id === id))
        .filter((m) => Boolean(m)) as Content[],
    [favorites, contents],
  );
  const myListMovies = useMemo(
    () =>
      myList
        .map((id) => contents.find((m) => m.id === id))
        .filter((m) => Boolean(m)) as Content[],
    [myList, contents],
  );
  const historyMovies = useMemo(
    () =>
      userHistory
        .map((h) => {
          const movie = contents.find((m) => m.id === h.movieId);
          return movie ? { movie, entry: h } : null;
        })
        .filter((x) => Boolean(x)) as { movie: Content; entry: any }[],
    [userHistory, contents],
  );

  const upcomingMovies = useMemo(
    () => contents.filter((c) => c.status === "coming_soon"),
    [contents],
  );

  const mostCommentedAll = useMemo(() => {
    return [...contents]
      .filter((c) => c.status !== "coming_soon")
      .sort((a, b) => {
        const ca = a.commentsCount || 0;
        const cb = b.commentsCount || 0;
        if (ca !== cb) return cb - ca;
        const la = a.likes?.length || 0;
        const lb = b.likes?.length || 0;
        if (la !== lb) return lb - la;
        return (b.views || 0) - (a.views || 0);
      });
  }, [contents]);
  const activeMostCommentedAll = useMemo(() => {
    if (activeTab === "network" || activeTab === "upcoming") return [];
    if (activeTab === "movie")
      return mostCommentedAll.filter((c) => c.type === "movie");
    if (activeTab === "tv")
      return mostCommentedAll.filter((c) => c.type === "tv");
    return mostCommentedAll;
  }, [mostCommentedAll, activeTab]);
  const activeMostCommented = useMemo(
    () => activeMostCommentedAll.slice(0, 14),
    [activeMostCommentedAll],
  );

  // Auto-scroll to section when tab changes
  useEffect(() => {
    const idMap: Record<string, string> = {
      home: "section-home",
      latest: "section-latest",
      popular: "section-popular",
      mylist: "section-mylist",
      favorites: "section-favorites",
      history: "section-history",
      upcoming: "section-upcoming",
    };
    const id = idMap[activeTab] || "section-home";
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 64;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "network") {
      setSelectedNetwork(null);
    }
  }, [activeTab]);

  // Dynamic lists based on activeTab
  const displayLatest =
    activeTab === "home"
      ? latestAll
      : activeTab === "tv"
        ? latestTv
        : latestMovies;
  const displayPopular =
    activeTab === "home"
      ? popularAll
      : activeTab === "tv"
        ? popularTv
        : popularMovie;

  const recommendedMovies = useMemo(() => {
    if (activeTab !== "home") return [];

    // Calculate genre frequencies from watched history
    const genreCounts: Record<string, number> = {};
    if (userHistory && userHistory.length > 0) {
      userHistory.forEach((entry) => {
        const movie = contents.find(
          (c) => String(c.id) === String(entry.movieId),
        );
        if (movie && movie.genres) {
          movie.genres.forEach((g) => {
            genreCounts[g] = (genreCounts[g] || 0) + 1;
          });
        }
      });
    }

    const hasHistory = Object.keys(genreCounts).length > 0;
    const available = contents.filter(
      (c) =>
        c.status !== "coming_soon" &&
        !(userHistory || []).some((h) => String(h.movieId) === String(c.id)),
    );

    if (!hasHistory) {
      // Just 20 random content if no history yet using our stable randomFallbackMovies
      if (randomFallbackMovies.length > 0) {
        return randomFallbackMovies;
      }
      return available.slice(0, 20);
    }

    // Score available content based on genres watched
    const scored = available
      .map((movie) => {
        let score = 0;
        if (movie.genres) {
          movie.genres.forEach((g) => {
            if (genreCounts[g]) score += genreCounts[g] * 10;
          });
        }
        // Use a stable rating boost and deterministic pseudo-random jitter based on movie ID to prevent re-shuffling on every re-render
        const codeSum = String(movie.id || "")
          .split("")
          .reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
        score += (codeSum % 5) + (Number(movie.rating) || 0) * 0.5;

        return { movie, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((item) => item.movie)
      .slice(0, 20);

    return scored;
  }, [userHistory, contents, activeTab, randomFallbackMovies]);

  const displayAll = useMemo(() => {
    const list =
      activeTab === "tv"
        ? contents.filter((c) => c.type === "tv")
        : activeTab === "movie"
          ? contents.filter((c) => c.type === "movie")
          : contents;
    const filtered = list.filter((c) => c.status !== "coming_soon");
    return filtered.sort((a, b) => {
      const da =
        typeof a.createdAt === "string"
          ? new Date(a.createdAt).getTime()
          : a.createdAt?.seconds
            ? a.createdAt.seconds * 1000
            : 0;
      const db =
        typeof b.createdAt === "string"
          ? new Date(b.createdAt).getTime()
          : b.createdAt?.seconds
            ? b.createdAt.seconds * 1000
            : 0;
      return db - da; // Descending (latest first)
    });
  }, [contents, activeTab]);

  // Reverse movies to show latest uploads first.
  // Keep rows full: mobile = 3 cols x 4 rows, desktop = 8 cols x 4 rows.
  const allPreview = useMemo(() => {
    let base = [...displayAll];
    if (selectedGenres.length > 0) {
      base = base.filter((c) =>
        selectedGenres.some((g) => c.genres?.includes(g)),
      );
    }

    let limits = 40;
    if (activeTab === "home") {
      if (typeof window !== "undefined") {
        if (window.innerWidth >= 1280)
          limits = 32; // xl: 8 * 4
        else if (window.innerWidth >= 1024)
          limits = 24; // lg: 6 * 4
        else if (window.innerWidth >= 768)
          limits = 20; // md: 5 * 4
        else limits = 12; // sm: 3 * 4
      }
    }

    return base.slice(0, limits);
  }, [displayAll, selectedGenres, isMobile, activeTab]);

  // When searching or filtering by genre, show single results section
  const isPersonalTab =
    activeTab === "mylist" ||
    activeTab === "favorites" ||
    activeTab === "history";

  const isFiltering =
    activeTab !== "genre" &&
    (debouncedSearchQuery.trim() !== "" ||
      (!isPersonalTab &&
        selectedGenres.length > 0 &&
        activeTab !== "home" &&
        activeTab !== "movie" &&
        activeTab !== "tv") ||
      (activeTab === "network" && selectedNetwork !== null));

  // Intercept special standalone embed player & secure download routes
  const viyiePlayParam = useMemo(() => {
    if (currentPath.startsWith("/play.id/")) {
      return currentPath.replace("/play.id/", "");
    }
    if (currentPath.startsWith("/e/")) {
      return currentPath.replace("/e/", "");
    }
    return null;
  }, [currentPath]);

  const viyieDownloadParam = useMemo(() => {
    if (currentPath.startsWith("/dow.id/")) {
      return currentPath.replace("/dow.id/", "");
    }
    return null;
  }, [currentPath]);

  if (isNetworkBlocked) {
    return (
      <NetworkBlockScreen
        isp={ipData.isp}
        ip={ipData.ip}
        city={ipData.city}
        country={ipData.country}
        errorTitle={settings?.error500Title}
        errorMsg={settings?.error500Msg}
        onSimulateIspChange={handleSimulateIspChange}
        mockIsps={settings?.blockedISPs || ["Indihome"]}
      />
    );
  }

  if (false && isIframeBlocked) {
    return (
      <div className="fixed inset-0 min-h-screen bg-black flex flex-col items-center justify-center p-4 text-white text-center z-[999999]">
        <div className="w-20 h-20 bg-red-600/20 rounded-full flex items-center justify-center mb-6 border border-red-500/30">
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-3xl font-bold mb-3">Embedded View Disabled</h1>
        <p className="text-white/60 mb-8 max-w-md text-lg">
          For security reasons, this website cannot be viewed inside a frame.
          Please visit the official site directly to continue.
        </p>
        <a
          href={window.location.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            try {
              window.top?.location.replace(window.location.href);
            } catch (err) {}
          }}
          className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)] flex items-center gap-3 active:scale-95"
        >
          <span>Visit Official Site</span>
          <ExternalLink className="w-5 h-5" />
        </a>
      </div>
    );
  }

  const isStrictHomeRoute =
    (currentPath === "/" || currentPath === "/home") &&
    !watchMovie &&
    !currentPath.includes("/movie/") &&
    !currentPath.includes("/tv/") &&
    !currentPath.includes("/watch/") &&
    !currentPath.startsWith("/home/");
  const showFullOfflineError =
    isInitialOffline ||
    (!appInitialized && !isOnline) ||
    (!isOnline && isStrictHomeRoute);

  if (
    showFullOfflineError ||
    currentPath === "/error" ||
    currentPath === "/eror"
  ) {
    const cachedImage =
      localStorage.getItem("connection_error_image_base64") ||
      "/Connection Error.png";

    const handleCloseTab = () => {
      window.close();
      alert("Please close this tab manually.");
    };

    return (
      <div className="min-h-screen w-full bg-[#000000] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
        {/* Subtle radial cinematic background vignette */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(0,0,0,0)_40%,#000000_100%)] z-10" />

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md mx-auto relative z-20 flex flex-col items-center text-center space-y-6"
        >
          {/* Framed Image Container at the top (100% size and No border, fully contains original image size) */}
          <div className="relative w-full mx-auto bg-transparent flex items-center justify-center scale-110 sm:scale-125 pb-4">
            <img
              src={cachedImage}
              alt="Connection Error"
              className="w-full h-auto object-contain"
              onError={(e) => {
                const img = e.currentTarget;
                if (img.src !== "/Connection Error.png") {
                  img.src = "/Connection Error.png";
                }
              }}
            />
          </div>

          {/* Connection Error Message & Diagnostics */}
          <div className="w-full space-y-1.5">
            <p className="text-[11px] text-white/50 leading-relaxed max-w-xs mx-auto">
              We couldn't connect to the platform. Please check the network
              metrics below.
            </p>
          </div>

          {/* Detailed Diagnostics Box */}
          <div className="w-full p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-left space-y-3 shadow-2xl">
            <div className="flex items-center gap-2 text-white/45 text-[9px] font-black uppercase tracking-[0.2em] pb-1 border-b border-white/5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
              Diagnostic Metrics
            </div>

            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between items-center text-white/70">
                <span className="flex items-center gap-1.5">
                  <WifiOff className="w-3.5 h-3.5 text-red-500 shrink-0" />{" "}
                  Connection Status
                </span>
                <span className="font-semibold text-red-500">
                  Offline (Disconnected)
                </span>
              </div>
              <div className="flex justify-between items-center text-white/70">
                <span className="flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />{" "}
                  VPN / Proxy Router
                </span>
                <span className="font-semibold text-amber-500">
                  Routing Mismatch
                </span>
              </div>
              <div className="flex justify-between items-center text-white/70">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-amber-500 shrink-0" />{" "}
                  Lag / Packet Delay
                </span>
                <span className="font-semibold text-amber-500">
                  Timeout Detected
                </span>
              </div>
            </div>

            <p className="text-[9px] text-white/35 leading-relaxed pt-2 border-t border-white/5 text-center">
              Disable secure proxies/VPNs, clear caches, or try cellular data
              networks.
            </p>
          </div>

          {/* Action Buttons: Refresh & Close */}
          <div className="w-full grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-1.5 px-4 py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-lg shadow-red-950/20 transition-all hover:scale-[1.02] active:scale-95 duration-200 cursor-pointer"
            >
              <RefreshCw
                className="w-3.5 h-3.5 animate-spin"
                style={{ animationDuration: "6s" }}
              />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleCloseTab}
              className="flex items-center justify-center gap-1.5 px-4 py-3 bg-transparent border border-red-600 hover:border-red-500 hover:bg-red-950/10 text-red-500 hover:text-red-400 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all hover:scale-[1.02] active:scale-95 duration-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Close Tab</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (settings?.isMaintenance && !computedIsUserAdmin && !isAdminRoute) {
    return (
      <div className="min-h-screen bg-[#070404] text-white flex flex-col items-center justify-center text-center p-8">
        <img
          src={settings.brandLogo || BRAND_LOGO_URL}
          alt={settings.seoTitle || BRAND_NAME}
          className="h-12 w-auto mb-6"
        />
        <h1 className="text-2xl md:text-3xl font-bold mb-4">
          Under Maintenance
        </h1>
        <p className="text-white/60 max-w-md mx-auto">
          We are currently updating our platform to serve you better. Please
          check back later.
        </p>
      </div>
    );
  }

  const isMusicActuallyEnabled =
    (user?.profileSettings?.enableMusic ?? true) || isMusicPlaying;
  const isMusicPausedByActivity = watchMovie || isTrailerActive;
  const shouldPlayMusic = isMusicPlaying && !isMusicPausedByActivity;

  if (viyiePlayParam !== null) {
    return <ViyiePlayoutEmbed param={viyiePlayParam} contents={contents} />;
  }

  if (viyieDownloadParam !== null) {
    return <ViyieDownloadGate param={viyieDownloadParam} contents={contents} />;
  }

  return (
    <MotionConfig transition={isMobile ? { duration: 0 } : { duration: 0.15 }}>
      <>
        <AudioPlayer
          isPlaying={shouldPlayMusic}
          onPause={() => setIsMusicPlaying(false)}
          enabled={isMusicActuallyEnabled}
          trackIndex={activeTrackIndex}
          tracks={allTracks}
        />
        {/* Ad Popup */}
        <AnimatePresence>
          {selectedAdPopupUrl && !isAdFreeUser && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            >
              <div className="relative w-full max-w-4xl aspect-[16/9] bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/20">
                <button
                  onClick={() => setSelectedAdPopupUrl(null)}
                  className="absolute top-4 right-4 z-[10] w-10 h-10 bg-black/60 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all backdrop-blur-md border border-white/20 hover:border-transparent active:scale-95 cursor-pointer"
                  style={{ pointerEvents: "auto" }}
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Overlay to prevent clicking iframe */}
                <div className="absolute inset-0 z-[5]" />

                <iframe
                  key={adPopupKey}
                  src={getEmbedAutoplayUrl(
                    selectedAdPopupUrl || undefined,
                    true,
                    true,
                  )}
                  className="w-full h-full border-0 pointer-events-none"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  title="Advertisement Popup"
                  allowFullScreen
                  tabIndex={-1}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Initial Red Circular Loader - keeps showing if app hasn't initialized OR Firestore is still loading data */}
        {(!appInitialized || loading) && (
          <div className="fixed inset-0 z-[10001] bg-[#070404] flex flex-col items-center justify-center">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-4 border-red-500/10" />
              <div className="absolute inset-0 rounded-full border-4 border-red-600 border-t-transparent border-r-transparent animate-spin" />
            </div>
          </div>
        )}

        {/* Main Routing block (instant on mobile, animated on desktop) */}
        <AnimatePresence mode="wait">
          {isAdminRoute ? (
            <motion.div
              key="admin"
              initial={!isMobile ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              exit={!isMobile ? { opacity: 0 } : undefined}
              transition={{ duration: 0.2 }}
            >
              {!computedIsUserAdmin && !adminToken ? (
                <AdminLogin
                  onSuccess={(token) => {
                    setAdminToken(token);
                    localStorage.setItem("vinet_admin_token", token);
                  }}
                  onBack={() => {
                    window.history.pushState({}, "", "/");
                    setCurrentPath("/");
                  }}
                />
              ) : (
                <AdminDashboard
                  isOwner={computedIsUserOwner}
                  onLogout={() => {
                    setAdminToken("");
                    localStorage.removeItem("vinet_admin_token");
                    window.history.pushState({}, "", "/");
                    setCurrentPath("/");
                  }}
                  onExit={() => {
                    window.history.pushState({}, "", "/");
                    setCurrentPath("/");
                  }}
                />
              )}
            </motion.div>
          ) : currentPath === "/profile/settings" ? (
            <motion.div
              key="settings"
              initial={!isMobile ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              exit={!isMobile ? { opacity: 0 } : undefined}
              transition={{ duration: 0.2 }}
            >
              <ProfileSettingsRoute
                onBack={() => {
                  window.history.pushState({}, "", "/");
                  setCurrentPath("/");
                }}
              />
            </motion.div>
          ) : currentPath === "/login" ? (
            <motion.div
              key="login"
              initial={!isMobile ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              exit={!isMobile ? { opacity: 0 } : undefined}
              transition={{ duration: 0.2 }}
            >
              <LoginRoute
                onLoginSuccess={() => {
                  window.history.pushState({}, "", "/home");
                  setCurrentPath("/home");
                }}
                brandName={BRAND_NAME}
                brandLogo={BRAND_LOGO_URL}
              />
            </motion.div>
          ) : currentPath === "/viyieopening" ? (
            <motion.div
              key="viyieopening"
              initial={!isMobile ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              exit={!isMobile ? { opacity: 0 } : undefined}
              transition={{ duration: 0.2 }}
            >
              <ViyieOpening />
            </motion.div>
          ) : currentPath === "/privacy" ? (
            <motion.div
              key="privacy"
              initial={!isMobile ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              exit={!isMobile ? { opacity: 0 } : undefined}
              transition={{ duration: 0.2 }}
            >
              <PrivacyRoute
                onBack={() => {
                  window.history.pushState({}, "", "/");
                  setCurrentPath("/");
                }}
              />
            </motion.div>
          ) : currentPath === "/terms" ? (
            <motion.div
              key="terms"
              initial={!isMobile ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              exit={!isMobile ? { opacity: 0 } : undefined}
              transition={{ duration: 0.2 }}
            >
              <TermsRoute
                onBack={() => {
                  window.history.pushState({}, "", "/");
                  setCurrentPath("/");
                }}
              />
            </motion.div>
          ) : currentPath === "/language" ? (
            <motion.div
              key="language"
              initial={!isMobile ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              exit={!isMobile ? { opacity: 0 } : undefined}
              transition={{ duration: 0.2 }}
            >
              <LanguageRoute onBack={handleGlobalBack} />
            </motion.div>
          ) : currentPath === "/needhelp" || currentPath === "/help" ? (
            <motion.div
              key="help"
              initial={!isMobile ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              exit={!isMobile ? { opacity: 0 } : undefined}
              transition={{ duration: 0.2 }}
            >
              <NeedHelpRoute
                onBack={() => {
                  window.history.pushState({}, "", "/");
                  setCurrentPath("/");
                }}
              />
            </motion.div>
          ) : currentPath === "/reportbug" || currentPath === "/report" ? (
            <motion.div
              key="report"
              initial={!isMobile ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              exit={!isMobile ? { opacity: 0 } : undefined}
              transition={{ duration: 0.2 }}
            >
              <ReportBugRoute
                onBack={() => {
                  window.history.pushState({}, "", "/");
                  setCurrentPath("/");
                }}
              />
            </motion.div>
          ) : currentPath === "/notifuser" ? (
            <motion.div
              key="notif"
              initial={!isMobile ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              exit={!isMobile ? { opacity: 0 } : undefined}
              transition={{ duration: 0.2 }}
            >
              <NotificationUser
                onBack={() => {
                  window.history.pushState({}, "", "/");
                  setCurrentPath("/");
                }}
                onSelectContent={(id) => {
                  const movie = contents.find((m) => m.id === id);
                  if (movie) {
                    onMovieCardClick(movie);
                    window.history.pushState({}, "", "/");
                    setCurrentPath("/");
                  }
                }}
              />
            </motion.div>
          ) : currentPath === "/subsviyie" ? (
            <motion.div
              key="subsviyie"
              initial={!isMobile ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              exit={!isMobile ? { opacity: 0 } : undefined}
              transition={{ duration: 0.2 }}
            >
              <ViyieSubscription onBack={handleGlobalBack} />
            </motion.div>
          ) : currentPath.startsWith("/profile/") ? (
            <motion.div
              key="profile"
              initial={!isMobile ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              exit={!isMobile ? { opacity: 0 } : undefined}
              transition={{ duration: 0.2 }}
            >
              <ProfileRoute
                userId={currentPath.split("/")[2]}
                onBack={() => {
                  window.history.pushState({}, "", "/");
                  setCurrentPath("/");
                }}
                onSelectMovie={(m) => {
                  openStream(m);
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="app"
              initial={!isMobile ? { opacity: 0, scale: 0.98 } : false}
              animate={{ opacity: 1, scale: 1 }}
              transition={
                !isMobile
                  ? { duration: 1, ease: [0.43, 0.13, 0.23, 0.96] }
                  : { duration: 0 }
              }
              className={`min-h-screen bg-black text-white overflow-x-hidden ${isMobile ? (watchMovie ? (settings?.systemNotificationActive && settings?.systemNotification ? "pt-[90px]" : "pt-[50px]") : settings?.systemNotificationActive && settings?.systemNotification ? "pt-[32px]" : "pt-0") : ""}`}
            >
              {settings?.systemNotificationActive &&
                settings?.systemNotification && (
                  <div className="fixed top-0 left-0 right-0 z-[100] h-8 bg-red-600 text-white flex items-center justify-between px-4 shadow-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <p
                        className="notranslate text-[10px] sm:text-xs font-black uppercase tracking-widest truncate"
                        translate="no"
                      >
                        {settings.systemNotification}
                      </p>
                    </div>
                    <div className="shrink-0 opacity-50">
                      <RefreshCw className="w-3 h-3 animate-spin-slow" />
                    </div>
                  </div>
                )}
              {(settings?.linkvertiseToken || settings?.adUrl) &&
                !adClicked &&
                !computedIsUserAdmin && (
                  <a
                    href={
                      settings?.adUrl ||
                      `https://linkvertise.com/${settings?.linkvertiseToken}/1`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      setAdClicked(true);
                      setTimeout(() => setAdClicked(false), 600000); // 10 min cooldown
                    }}
                    className="fixed inset-0 z-[99999] opacity-0 cursor-default"
                    title="Click to continue"
                  />
                )}
              <OnboardingModal />
              {/* Background ambient orbs... changed to pure black as requested */}
              {!isMobile && (
                <div className="fixed inset-0 pointer-events-none overflow-hidden bg-black">
                  <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-black/0 blur-[120px]" />
                  <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-black/0 blur-[120px]" />
                  <div className="absolute bottom-0 left-1/3 w-[600px] h-[600px] rounded-full bg-black/0 blur-[120px]" />
                </div>
              )}

              {(() => {
                return (
                  <div className="relative">
                    {/* Navbar: mobile = lightweight fixed bar, desktop = full animated navbar */}
                    <div className="fixed top-0 left-0 right-0 w-full z-[250] pointer-events-none">
                      {isMobile ? (
                        <div className="pointer-events-auto">
                          <MobileNav
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                            selectedGenres={selectedGenres}
                            setSelectedGenres={setSelectedGenres}
                            allGenres={allGenres}
                            isMusicPlaying={isMusicPlaying}
                            onToggleMusic={() => {
                              if (!watchMovie) {
                                const nextVal = !isMusicPlaying;
                                setIsMusicPlaying(nextVal);
                                if (nextVal) {
                                  updateMusicPreference({ enableMusic: true });
                                }
                              }
                            }}
                            computedIsUserAdmin={computedIsUserAdmin}
                            isStreaming={!!watchMovie}
                            isHidden={isNavbarHidden}
                            unreadNotifsCount={unreadNotifsCount}
                            tracks={allTracks}
                            setCustomTracks={setCustomTracks}
                            activeTrackIndex={activeTrackIndex}
                            setActiveTrackIndex={(idx) => {
                              setActiveTrackIndex(idx);
                              updateMusicPreference({
                                activeTrackIndex: idx,
                                enableMusic: true,
                              });
                            }}
                            onMenuToggle={(open) => setIsNavMenuOpen(open)}
                            onNavigateAway={(targetPath?: string) => {
                              if (watchMovie) {
                                setWatchMovie(null);
                                if (!targetPath || targetPath === window.location.pathname) {
                                  if (
                                    window.location.pathname.match(
                                      /\/home\/[^/?#]+/,
                                    )
                                  ) {
                                    window.history.pushState({}, "", homePath());
                                    setCurrentPath(homePath());
                                  }
                                }
                              }
                            }}
                            onNavigate={(path) => setCurrentPath(path)}
                          />
                        </div>
                      ) : (
                        <Navbar
                          searchQuery={searchQuery}
                          setSearchQuery={setSearchQuery}
                          activeTab={activeTab}
                          setActiveTab={setActiveTab}
                          onSelectMovie={onMovieCardClick}
                          recentSearches={recentSearches}
                          addRecentSearch={addRecentSearch}
                          contents={contents}
                          isMusicPlaying={isMusicPlaying}
                          setIsMusicPlaying={(p) => {
                            setIsMusicPlaying(p);
                            updateMusicPreference({ enableMusic: p });
                          }}
                          activeTrackIndex={activeTrackIndex}
                          setActiveTrackIndex={(idx) => {
                            setActiveTrackIndex(idx);
                            updateMusicPreference({
                              activeTrackIndex: idx,
                              enableMusic: true,
                            });
                          }}
                          computedIsUserAdmin={computedIsUserAdmin}
                          isStreaming={!!watchMovie}
                          isHidden={isNavbarHidden}
                          unreadNotifsCount={unreadNotifsCount}
                          onMenuToggle={(open) => setIsNavMenuOpen(open)}
                          onNavigateAway={(targetPath?: string) => {
                            if (watchMovie) {
                              setWatchMovie(null);
                              if (!targetPath || targetPath === window.location.pathname) {
                                if (
                                  window.location.pathname.match(
                                    /\/home\/[^/?#]+/,
                                  )
                                ) {
                                  window.history.pushState({}, "", homePath());
                                  setCurrentPath(homePath());
                                }
                              }
                            }
                          }}
                          onNavigate={(path) => setCurrentPath(path)}
                          onOpenSettings={() => {
                            window.history.pushState(
                              {},
                              "",
                              "/profile/settings",
                            );
                            setCurrentPath("/profile/settings");
                          }}
                          showAdConsent={showAdConsent}
                          tracks={allTracks}
                          setCustomTracks={setCustomTracks}
                        />
                      )}
                    </div>

                    {isNavbarHidden && (isHoveringTop || isMobile) && isStreamRunning && (
                      <motion.button
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        onClick={() => setForceShowNavbar(true)}
                        className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-white/10 backdrop-blur-xl p-2 rounded-full border border-white/20 text-white/60 hover:text-white hover:bg-white/20 transition-all shadow-2xl hover:scale-110 active:scale-95 group"
                      >
                        <ChevronDown className="w-5 h-5 transition-transform group-hover:translate-y-0.5" />
                      </motion.button>
                    )}

                    <AnimatePresence initial={false}>
                      {currentPath.includes("/watch/") && !watchMovie ? (
                        <motion.div
                          key="loading-stream"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#000000]"
                        >
                          <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(220,38,38,0.6)] mb-6" />
                          <div className="text-white/50 text-[12px] font-bold uppercase tracking-widest animate-pulse">
                            Loading Stream...
                          </div>
                        </motion.div>
                      ) : watchMovie ? (
                        <motion.div
                          key="streaming-page"
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ duration: 0.4, ease: "easeInOut" }}
                        >
                          <StreamingPage
                            key={watchMovie.id}
                            movie={watchMovie}
                            allContents={rawContents || contents}
                            onSwitchMovie={openStream}
                            isAdmin={computedIsUserAdmin}
                            onPlayStateChange={handleSetIsStreamRunning}
                            latestEpisodes={latestEpisodes}
                            initialEpisode={targetedEpisode?.episode}
                            initialSeason={targetedEpisode?.season}
                            onLockerToggle={setIsLockerOpen}
                            onShowTrailer={() => {
                              setSelectedMovie(watchMovie);
                              setTrailerAutoPlay(true);
                            }}
                            onUserClick={(uid) => {
                              window.history.pushState(
                                {},
                                "",
                                `/profile/${uid}`,
                              );
                              setCurrentPath(`/profile/${uid}`);
                              setWatchMovie(null);
                            }}
                            onNetworkClick={(netName) => {
                              setWatchMovie(null);
                              setActiveTab("network");
                              setSelectedNetwork(netName);
                              if (window.location.pathname !== "/network") {
                                window.history.pushState({}, "", "/network");
                                window.dispatchEvent(
                                  new PopStateEvent("popstate"),
                                );
                              }
                            }}
                          />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="main-content"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.3 }}
                        >
                          {/* Home billboard section */}
                          {!isFiltering &&
                            (activeTab === "home" ||
                              activeTab === "movie" ||
                              activeTab === "tv") && (
                              <section
                                id="section-home"
                                className="relative flex flex-col"
                              >
                                {/* Mobile: lightweight 16:9 hero */}
                                <HeroSection
                                  movies={
                                    activeTab === "movie"
                                      ? movieHeroContent
                                      : activeTab === "tv"
                                        ? tvHeroContent
                                        : homeHeroContent
                                  }
                                  onPlay={openStream}
                                  onPlayTrailer={onTrailerClick}
                                  onWatchNow={openStream}
                                  onShowDetails={onMovieCardClick}
                                  mostCommented={activeMostCommented}
                                  userHistory={userHistory}
                                  trendingMovies={displayPopular}
                                />

                                {/* Custom Internal Under Hero Banner Ad */}
                                {!watchMovie &&
                                  !isAdminRoute &&
                                  settings?.internalUnderHeroAdImage && (
                                    <div
                                      className={`relative z-10 w-full bg-[#000000] border-b border-white/5 flex justify-center overflow-hidden h-[60px] sm:h-[80px] md:h-[124px] ${settings.internalUnderHeroAdImage.includes("join.mp4") ? "cursor-pointer" : ""}`}
                                      onClick={() => {
                                        if (
                                          settings.internalUnderHeroAdImage?.includes(
                                            "join.mp4",
                                          )
                                        ) {
                                          window.scrollTo({
                                            top: document.body.scrollHeight,
                                            behavior: "smooth",
                                          });
                                        }
                                      }}
                                    >
                                      <div
                                        className={`block w-full max-w-7xl relative mx-auto h-full ${settings.internalUnderHeroAdImage.includes("join.mp4") ? "pointer-events-none" : ""}`}
                                      >
                                        <MediaBanner
                                          mediaUrl={
                                            settings.internalUnderHeroAdImage
                                          }
                                          linkUrl={
                                            settings?.internalUnderHeroAdUrl ||
                                            "#"
                                          }
                                        />
                                      </div>
                                    </div>
                                  )}
                              </section>
                            )}

                          {/* Search/Filter Results Section (only when filtering) */}
                          {isFiltering && (
                            <>
                              {selectedGenres.length > 0 &&
                                debouncedSearchQuery.trim() === "" && (
                                  <section className="relative flex flex-col">
                                    <HeroSection
                                      movies={filteredMovies
                                        .filter(
                                          (c) =>
                                            c.type === "movie" ||
                                            c.type === "tv",
                                        )
                                        .slice(0, 5)}
                                      // Use filteredMovies so it's guaranteed to match the genre
                                      onPlay={openStream}
                                      onPlayTrailer={onTrailerClick}
                                      onWatchNow={openStream}
                                      onShowDetails={onMovieCardClick}
                                      mostCommented={activeMostCommented}
                                      userHistory={userHistory}
                                      trendingMovies={displayPopular}
                                    />
                                  </section>
                                )}
                              <section
                                className={`min-h-screen pb-16 ${selectedGenres.length > 0 && debouncedSearchQuery.trim() === "" ? "" : "pt-24"}`}
                              >
                                <div className="max-w-[2000px] mx-auto px-7 sm:px-[47px] lg:px-[56px]">
                                  <SectionBlock
                                    title={sectionTitle}
                                    count={filteredMovies.length}
                                    showFilters={showFilters}
                                    setShowFilters={setShowFilters}
                                    selectedGenres={selectedGenres}
                                    setSelectedGenres={setSelectedGenres}
                                    sortBy={sortBy}
                                    setSortBy={setSortBy}
                                    allGenres={allGenres}
                                    onReset={() => {
                                      setSelectedGenres([]);
                                      setSortBy("latest_upload");
                                      setSearchQuery("");
                                      setSelectedNetwork(null);
                                      setActiveTab("home");
                                      window.history.pushState({}, "", "/home");
                                      window.dispatchEvent(
                                        new PopStateEvent("popstate"),
                                      );
                                    }}
                                    hasReset
                                  />
                                  {filteredMovies.length > 0 ? (
                                    <div className={GRID_COLS}>
                                      {filteredMovies.map((movie) => (
                                        <LazyRender key={movie.id}>
                                          <MovieCard
                                            movie={movie}
                                            onClick={onMovieCardClick}
                                            onPlay={openStream}
                                          />
                                        </LazyRender>
                                      ))}
                                    </div>
                                  ) : (
                                    <EmptyState />
                                  )}
                                </div>
                              </section>
                            </>
                          )}

                          {/* Networks Selection Section */}
                          {activeTab === "network" && !isFiltering && (
                            <section
                              id="section-networks"
                              className="relative min-h-screen pt-24 pb-16 overflow-hidden"
                            >
                              {/* Immersive background glows */}
                              <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-red-600/5 blur-[120px] rounded-full -z-10 animate-pulse" />
                              <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-red-600/5 blur-[120px] rounded-full -z-10" />

                              <div className="max-w-[2000px] mx-auto pt-24 pb-16 overflow-hidden relative">
                                <div className="max-w-[2000px] mx-auto px-7 sm:px-[47px] lg:px-[56px]">
                                  <SectionHeader
                                    title="Networks"
                                    icon={Layers}
                                    description="Explore content from your favorite networks"
                                    accent="from-red-600 to-red-400"
                                    count={NETWORKS.length}
                                  />
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mt-6">
                                  {NETWORKS.map((network) => (
                                    <div
                                      key={network.name}
                                      onClick={() =>
                                        setSelectedNetwork(network.name)
                                      }
                                      className="group relative aspect-[16/9] rounded-[2rem] overflow-hidden bg-black border border-white/5 shadow-xl transition-all duration-500 hover:scale-[1.02] hover:border-red-500/50 hover:shadow-[0_0_30px_rgba(220,38,38,0.2)] cursor-pointer"
                                    >
                                      <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-10 pointer-events-none">
                                        <div className="relative w-full h-full flex items-center justify-center">
                                          <img
                                            src={network.logo}
                                            alt={network.name}
                                            className={`max-w-full max-h-full object-contain transition-all duration-500 opacity-100 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] ${network.name === "Apple TV+" || network.name === "Disney+" ? "scale-[0.5] brightness-0 invert" : "group-hover:scale-105"}`}
                                            draggable={false}
                                            onError={(e) => {
                                              const img =
                                                e.target as HTMLImageElement;
                                              img.style.display = "none";
                                              const parent = img.parentElement;
                                              if (parent) {
                                                const span =
                                                  document.createElement(
                                                    "span",
                                                  );
                                                span.className =
                                                  "text-xl sm:text-2xl font-medium text-white uppercase tracking-tighter drop-shadow-2xl opacity-40 group-hover:opacity-100 transition-opacity duration-500";
                                                span.innerText = network.name;
                                                parent.appendChild(span);
                                              }
                                            }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </section>
                          )}

                          {/* Center Banner Hero (Network) */}
                          {activeTab === "network" &&
                            !isFiltering &&
                            !selectedNetwork &&
                            ((settings?.centerBanners?.length || 0) > 0 ||
                              settings?.centerBannerHeroImage) && (
                              <CenterBannerCarousel
                                banners={
                                  (settings?.centerBanners?.length || 0) > 0
                                    ? settings!.centerBanners!
                                    : [
                                        {
                                          id: "legacy",
                                          image:
                                            settings!.centerBannerHeroImage!,
                                          url:
                                            settings!.centerBannerHeroUrl || "",
                                        },
                                      ]
                                }
                                activeTab={activeTab}
                              />
                            )}

                          {/* Watch List Section */}
                          {activeTab === "mylist" && !isFiltering && (
                            <section
                              id="section-mylist"
                              className="relative min-h-screen pt-24 pb-16"
                            >
                              <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
                                <SectionHeader
                                  title="Watch List"
                                  icon={Bookmark}
                                  description="A list of movies you want to watch later"
                                  accent="from-red-600 to-red-400"
                                  count={myListMovies.length}
                                />
                                {myListMovies.length > 0 ? (
                                  <div className={GRID_COLS}>
                                    {myListMovies.map((movie) => (
                                      <LazyRender key={movie.id}>
                                        <MovieCard
                                          movie={movie}
                                          onClick={onMovieCardClick}
                                          onPlay={openStream}
                                        />
                                      </LazyRender>
                                    ))}
                                  </div>
                                ) : (
                                  <CollectionEmpty
                                    icon={Bookmark}
                                    title="Watch List is empty"
                                    description="Add movies by clicking the + button on posters or from the details page."
                                    action={{
                                      label: "Browse Movies",
                                      onClick: () => {
                                        setActiveTab("home");
                                        window.history.pushState(
                                          {},
                                          "",
                                          "/home",
                                        );
                                        window.dispatchEvent(
                                          new PopStateEvent("popstate"),
                                        );
                                      },
                                    }}
                                  />
                                )}
                              </div>
                            </section>
                          )}

                          {/* Favorites Section */}
                          {activeTab === "favorites" && !isFiltering && (
                            <section
                              id="section-favorites"
                              className="relative min-h-screen pt-16 pb-6"
                            >
                              <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
                                <SectionHeader
                                  title="Favorites"
                                  icon={Heart}
                                  description="Your favorite movies"
                                  accent="from-pink-500 to-red-500"
                                  count={favoriteMovies.length}
                                />
                                {favoriteMovies.length > 0 ? (
                                  <div className={GRID_COLS}>
                                    {favoriteMovies.map((movie) => (
                                      <LazyRender key={movie.id}>
                                        <MovieCard
                                          movie={movie}
                                          onClick={onMovieCardClick}
                                          onPlay={openStream}
                                        />
                                      </LazyRender>
                                    ))}
                                  </div>
                                ) : (
                                  <CollectionEmpty
                                    icon={Heart}
                                    title="No favorites yet"
                                    description="Tap the heart icon on a poster to save your favorite movies here."
                                    action={{
                                      label: "Find Favorites",
                                      onClick: () => {
                                        setActiveTab("home");
                                        window.history.pushState(
                                          {},
                                          "",
                                          "/home",
                                        );
                                        window.dispatchEvent(
                                          new PopStateEvent("popstate"),
                                        );
                                      },
                                    }}
                                  />
                                )}
                              </div>
                            </section>
                          )}

                          {/* History Section */}
                          {activeTab === "history" && !isFiltering && (
                            <section
                              id="section-history"
                              className="relative min-h-screen pt-16 pb-6"
                            >
                              <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
                                <SectionHeader
                                  title="Watch History"
                                  icon={History}
                                  description="Continue from where you left off"
                                  accent="from-purple-500 to-indigo-500"
                                  count={historyMovies.length}
                                >
                                  {historyMovies.length > 0 && (
                                    <button
                                      onClick={() => clearHistory()}
                                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-red-600/20 text-white/70 hover:text-red-300 text-[10px] sm:text-xs font-bold transition-all border border-white/10 hover:border-red-500/30 uppercase tracking-widest"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 sm:w-4 h-4" />
                                      Clear history
                                    </button>
                                  )}
                                </SectionHeader>
                                {historyMovies.length > 0 ? (
                                  <div className={GRID_COLS}>
                                    {historyMovies.map(({ movie, entry }) => (
                                      <div
                                        key={movie.id}
                                        className="flex flex-col gap-2 group relative"
                                      >
                                        <LazyRender>
                                          <div className="relative">
                                            <MovieCard
                                              movie={movie}
                                              onClick={onMovieCardClick}
                                            />
                                            {/* Episode Overlay (No progress bar here anymore) */}
                                            <div className="absolute inset-x-0 bottom-0 p-2 sm:p-3 bg-gradient-to-t from-black/90 to-transparent flex flex-col justify-end pointer-events-none z-30">
                                              {movie.kind === "tv" &&
                                                entry.seasonIndex !==
                                                  undefined &&
                                                entry.episodeIndex !==
                                                  undefined && (
                                                  <span className="text-[10px] font-black text-red-500 uppercase tracking-widest drop-shadow-md mb-1">
                                                    S
                                                    {movie.seasons &&
                                                    movie.seasons[
                                                      entry.seasonIndex
                                                    ]
                                                      ? movie.seasons[
                                                          entry.seasonIndex
                                                        ].number
                                                      : entry.seasonIndex +
                                                        1}{" "}
                                                    E
                                                    {movie.seasons &&
                                                    movie.seasons[
                                                      entry.seasonIndex
                                                    ] &&
                                                    movie.seasons[
                                                      entry.seasonIndex
                                                    ].episodes &&
                                                    movie.seasons[
                                                      entry.seasonIndex
                                                    ].episodes[
                                                      entry.episodeIndex
                                                    ]
                                                      ? movie.seasons[
                                                          entry.seasonIndex
                                                        ].episodes[
                                                          entry.episodeIndex
                                                        ].number
                                                      : entry.episodeIndex + 1}
                                                  </span>
                                                )}
                                            </div>

                                            {/* Hover Play button overlay */}
                                            <div
                                              onClick={() =>
                                                onMovieCardClick(movie)
                                              }
                                              className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer z-40"
                                            >
                                              <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shadow-lg shadow-red-900/40 text-white transform scale-90 group-hover:scale-100 transition-transform">
                                                <Play className="w-5 h-5 ml-1" />
                                              </div>
                                            </div>
                                          </div>
                                        </LazyRender>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 px-1 mt-1">
                                          Last watched:{" "}
                                          {formatRelativeTime(entry.watchedAt)}
                                        </p>

                                        {/* Unobtrusive Progress Bar below the text */}
                                        <div className="w-full h-1 mt-1.5 bg-white/10 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-red-600"
                                            style={{
                                              width: `${Math.max(5, (entry.progress || 0) * 100)}%`,
                                            }}
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <CollectionEmpty
                                    icon={History}
                                    title="No watch history"
                                    description="Start watching your favorite movies and your history will appear here."
                                    action={{
                                      label: "Watch Now",
                                      onClick: () => {
                                        setActiveTab("home");
                                        window.history.pushState(
                                          {},
                                          "",
                                          "/home",
                                        );
                                        window.dispatchEvent(
                                          new PopStateEvent("popstate"),
                                        );
                                      },
                                    }}
                                  />
                                )}
                              </div>
                            </section>
                          )}

                          {/* Upcoming Section */}
                          {activeTab === "upcoming" && !isFiltering && (
                            <>
                              {/* Soon Hero Section */}
                              {upcomingMovies.length > 0 && (
                                <section className="relative flex flex-col">
                                  <SoonHero
                                    movies={upcomingMovies}
                                    onPlayTrailer={onTrailerClick}
                                    activeMovie={selectedSoonMovie || upcomingMovies[0]}
                                    onActiveMovieChange={setSelectedSoonMovie}
                                  />
                                </section>
                              )}
                              <section
                                id="section-upcoming"
                                className={`relative min-h-screen py-3 pb-6 bg-[#000000] border-t border-white/5 ${upcomingMovies.length === 0 ? "pt-24" : ""}`}
                              >
                                <div className="max-w-[2000px] mx-auto pt-6 px-7 sm:px-[47px] lg:px-[56px]">
                                  {upcomingMovies.length > 0 ? (
                                    <>
                                      <div className={GRID_COLS}>
                                        {upcomingMovies
                                          .slice(0, soonVisibleCount)
                                          .map((movie) => (
                                            <LazyRender key={movie.id}>
                                              <MovieCard
                                                movie={movie}
                                                expandOnHover={false}
                                                onClick={(m) => {
                                                  setSelectedSoonMovie(m);
                                                  // scroll to top smoothly
                                                  window.scrollTo({
                                                    top: 0,
                                                    behavior: "smooth",
                                                  });
                                                }}
                                                onPlay={openStream}
                                              />
                                            </LazyRender>
                                          ))}
                                      </div>
                                      {upcomingMovies.length >
                                        soonVisibleCount && (
                                        <div className="mt-8 flex justify-center">
                                          <button
                                            onClick={() =>
                                              setSoonVisibleCount(
                                                (prev) => prev + 12,
                                              )
                                            }
                                            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-red-900/20 transition-all duration-300"
                                          >
                                            Show More
                                          </button>
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <EmptyState />
                                  )}
                                </div>
                              </section>
                            </>
                          )}

                          {/* Genre Route Section */}
                          {activeTab === "genre" && !isFiltering && (
                            <section
                              id="section-genres"
                              className="relative min-h-screen pt-24 pb-16 overflow-hidden"
                            >
                              <div className="max-w-[2000px] mx-auto px-7 sm:px-[47px] lg:px-[56px] relative">
                                <div className="mb-4">
                                  <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-widest flex flex-wrap items-center gap-2">
                                    GENRE:
                                    {selectedGenres.length === 0 ? (
                                      <span className="text-white/40">
                                        &gt; All
                                      </span>
                                    ) : (
                                      <>
                                        <span className="text-red-500">
                                          &gt;
                                        </span>
                                        {selectedGenres.map((g, i) => (
                                          <span
                                            key={g}
                                            className="text-red-400"
                                          >
                                            {g}
                                            {i < selectedGenres.length - 1
                                              ? ","
                                              : ""}
                                          </span>
                                        ))}
                                      </>
                                    )}
                                  </h2>
                                </div>

                                <div className="flex flex-col xl:flex-row gap-8 items-start">
                                  {/* Left Panel: Content Grid */}
                                  <div className="flex-1 w-full min-w-0 order-2 xl:order-1">
                                    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                                      <span className="text-sm font-bold text-white/50 uppercase tracking-widest">
                                        {filteredMovies.length} Results
                                      </span>
                                      {(selectedGenres.length > 0 ||
                                        genreFormat !== "all" ||
                                        genreSort !== "latest_upload" ||
                                        genreYear !== "all") && (
                                        <button
                                          onClick={() => {
                                            setSelectedGenres([]);
                                            setGenreFormat("all");
                                            setGenreSort("latest_upload");
                                            setGenreYear("all");
                                          }}
                                          className="text-[10px] sm:text-xs font-bold text-red-500 hover:text-red-400 uppercase tracking-widest px-3 py-1.5 rounded-lg border border-red-500/20 hover:border-red-500/50 bg-red-500/10 transition-all"
                                        >
                                          Clear Filters
                                        </button>
                                      )}
                                    </div>

                                    {filteredMovies.length > 0 ? (
                                      <>
                                        <div
                                          className={
                                            isMobile
                                              ? GRID_COLS
                                              : "grid grid-cols-4 md:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2 sm:gap-3 xl:gap-4"
                                          }
                                        >
                                          {genrePageItems.map((movie) => (
                                            <LazyRender key={movie.id}>
                                              <MovieCard
                                                movie={movie}
                                                onClick={onMovieCardClick}
                                                onPlay={openStream}
                                              />
                                            </LazyRender>
                                          ))}
                                        </div>
                                        <SimplePagination
                                          page={genrePage}
                                          totalPages={genreTotalPages}
                                          setPage={(p) => {
                                            setGenrePage(p);
                                            window.scrollTo({
                                              top: 0,
                                              behavior: "smooth",
                                            });
                                          }}
                                        />
                                      </>
                                    ) : (
                                      <EmptyState />
                                    )}
                                  </div>

                                  {/* Right Panel: Sticky Filters */}
                                  <div className="w-full xl:w-[350px] shrink-0 xl:sticky xl:top-[120px] order-1 xl:order-2 flex flex-col gap-6 mb-2 xl:mb-0">
                                    {/* Advanced Genre Filters */}
                                    <div className="flex flex-wrap xl:flex-col items-center xl:items-stretch gap-3 bg-black/40 p-3 rounded-md border border-white/5">
                                      <div className="flex items-center gap-2 bg-white/5 p-1 rounded-md w-fit">
                                        <button
                                          onClick={() => setGenreFormat("all")}
                                          className={`px-4 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all ${genreFormat === "all" ? "bg-white text-black" : "text-white/50 hover:text-white"}`}
                                        >
                                          All
                                        </button>
                                        <button
                                          onClick={() =>
                                            setGenreFormat("movie")
                                          }
                                          className={`px-4 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all ${genreFormat === "movie" ? "bg-white text-black" : "text-white/50 hover:text-white"}`}
                                        >
                                          Movies
                                        </button>
                                        <button
                                          onClick={() => setGenreFormat("tv")}
                                          className={`px-4 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all ${genreFormat === "tv" ? "bg-white text-black" : "text-white/50 hover:text-white"}`}
                                        >
                                          TV Shows
                                        </button>
                                      </div>

                                      <select
                                        value={genreSort}
                                        onChange={(e) =>
                                          setGenreSort(e.target.value as any)
                                        }
                                        className="bg-white/5 border border-white/10 rounded-md px-4 py-2 text-xs font-bold text-white uppercase tracking-widest outline-none appearance-none cursor-pointer w-full xl:w-auto"
                                      >
                                        <option
                                          value="latest_upload"
                                          className="bg-neutral-900"
                                        >
                                          Recently Added
                                        </option>
                                        <option
                                          value="newest_release"
                                          className="bg-neutral-900"
                                        >
                                          Newest Release
                                        </option>
                                        <option
                                          value="az"
                                          className="bg-neutral-900"
                                        >
                                          A - Z
                                        </option>
                                        <option
                                          value="za"
                                          className="bg-neutral-900"
                                        >
                                          Z - A
                                        </option>
                                        <option
                                          value="year_desc"
                                          className="bg-neutral-900"
                                        >
                                          Year (New to Old)
                                        </option>
                                        <option
                                          value="year_asc"
                                          className="bg-neutral-900"
                                        >
                                          Year (Old to New)
                                        </option>
                                      </select>

                                      <select
                                        value={genreYear}
                                        onChange={(e) =>
                                          setGenreYear(e.target.value)
                                        }
                                        className="bg-white/5 border border-white/10 rounded-md px-4 py-2 text-xs font-bold text-white uppercase tracking-widest outline-none appearance-none cursor-pointer w-full xl:w-auto"
                                      >
                                        <option
                                          value="all"
                                          className="bg-neutral-900"
                                        >
                                          All Years
                                        </option>
                                        {allYears.map((year) => (
                                          <option
                                            key={year}
                                            value={year}
                                            className="bg-neutral-900"
                                          >
                                            {year}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div className="p-4 rounded-md bg-white/5 border border-white/10 backdrop-blur-xl flex flex-wrap gap-2">
                                      {allGenres
                                        .filter((g) => g !== "All")
                                        .map((genre) => {
                                          const isActive =
                                            selectedGenres.includes(genre);
                                          return (
                                            <button
                                              key={genre}
                                              onClick={() => {
                                                setSearchQuery("");
                                                const searchBox =
                                                  document.querySelector(
                                                    'input[type="text"]',
                                                  ) as HTMLInputElement;
                                                if (searchBox)
                                                  searchBox.value = "";
                                                if (isActive) {
                                                  setSelectedGenres(
                                                    selectedGenres.filter(
                                                      (g) => g !== genre,
                                                    ),
                                                  );
                                                } else {
                                                  setSelectedGenres([
                                                    ...selectedGenres,
                                                    genre,
                                                  ]);
                                                }
                                              }}
                                              className={`px-4 py-2 rounded-sm text-[11px] font-semibold uppercase tracking-widest transition-all flex items-center gap-2 ${
                                                isActive
                                                  ? "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-900/30"
                                                  : "bg-white/5 text-white/60 border border-white/10 hover:text-white hover:bg-white/10"
                                              }`}
                                            >
                                              {isActive && (
                                                <Check className="w-3.5 h-3.5 shrink-0" />
                                              )}
                                              {genre}
                                            </button>
                                          );
                                        })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </section>
                          )}

                          {/* Main Content Sections (Moved below featured carousels as requested) */}
                          {!isFiltering &&
                            (activeTab === "home" ||
                              activeTab === "movie" ||
                              activeTab === "tv") && (
                              <>
                                {/* Latest Section */}
                                <section
                                  id="section-latest"
                                  className="relative z-10 hover:z-[60] bg-[#000000] py-4 border-t border-white/5 carousel-section-container"
                                >
                                  <div className="max-w-[2000px] mx-auto overflow-visible relative">
                                    <div className="px-7 sm:px-[47px] lg:px-[56px]">
                                      <SectionHeader
                                        innerStyle={
                                          isDesktop
                                            ? { marginLeft: "-36px" }
                                            : {}
                                        }
                                        title={
                                          activeTab === "tv"
                                            ? "Latest TV"
                                            : activeTab === "movie"
                                              ? "Latest Movies"
                                              : "New Content"
                                        }
                                        icon={TrendingUp}
                                        description="The freshest content added today"
                                        accent="from-red-600 to-red-400"
                                        count={
                                          displayLatest.filter(
                                            (m) =>
                                              latestReleaseType === "all" ||
                                              m.type === latestReleaseType,
                                          ).length
                                        }
                                        onViewAll={() =>
                                          setBrowseModal({
                                            title:
                                              activeTab === "tv"
                                                ? "Latest TV"
                                                : "Latest Movies",
                                            movies: displayLatest,
                                          })
                                        }
                                      >
                                        {activeTab === "home" && (
                                          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                                            {["all", "movie", "tv"].map((t) => (
                                              <button
                                                key={t}
                                                onClick={() =>
                                                  setLatestReleaseType(t as any)
                                                }
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                                  latestReleaseType === t
                                                    ? "bg-red-600 text-white shadow-lg shadow-red-900/20"
                                                    : "text-white/40 hover:text-white"
                                                }`}
                                              >
                                                {t}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </SectionHeader>
                                    </div>
                                    {displayLatest.filter(
                                      (m) =>
                                        latestReleaseType === "all" ||
                                        m.type === latestReleaseType,
                                    ).length > 0 ? (
                                      <div className="mt-0 pb-2 overflow-visible">
                                        <ScrollCarousel
                                          hoverExpand={false}
                                          style={
                                            isDesktop
                                              ? {
                                                  width: "100%",
                                                  marginLeft: "0px",
                                                }
                                              : {}
                                          }
                                          className="flex gap-2 sm:gap-3 pl-4 sm:pl-12 lg:pl-16 pr-0 snap-x snap-mandatory overflow-x-auto overflow-y-visible"
                                        >
                                          {displayLatest
                                            .filter(
                                              (m) =>
                                                latestReleaseType === "all" ||
                                                m.type === latestReleaseType,
                                            )
                                            .slice(0, 20)
                                            .map((movie) => (
                                              <div
                                                key={movie.id}
                                                className="shrink-0 snap-start transition-all duration-300 w-[calc((100%-1rem)/3)] sm:w-[calc((100%-1.5rem)/3)] md:w-[calc((100%-3rem)/3.8)] lg:w-[calc((100%-5rem)/5.5)] xl:w-[calc((100%-7rem)/7.2)] 2xl:w-[calc((100%-8.5rem)/8.5)]"
                                              >
                                                <LazyRender>
                                                  <MovieCard
                                                    movie={movie}
                                                    onClick={onMovieCardClick}
                                                    onPlay={openStream}
                                                    expandOnHover={true}
                                                    showActions={false}
                                                  />
                                                </LazyRender>
                                              </div>
                                            ))}
                                        </ScrollCarousel>
                                      </div>
                                    ) : (
                                      <EmptyState />
                                    )}
                                  </div>
                                </section>

                                {/* Recommendation Section */}
                                {activeTab === "home" &&
                                  recommendedMovies.length > 0 && (
                                    <section
                                      id="section-recommended"
                                      className="relative z-10 hover:z-[60] bg-[#000000] pt-[14px] pb-0 h-[381px] md:h-auto md:min-h-[381px] border-t border-white/5 carousel-section-container"
                                    >
                                      <div className="max-w-[2000px] mx-auto overflow-visible relative">
                                        <div className="px-7 sm:px-[47px] lg:px-[56px]">
                                          <SectionHeader
                                            innerStyle={
                                              isDesktop
                                                ? {
                                                    marginLeft: "-36px",
                                                    paddingTop: "0px",
                                                  }
                                                : {}
                                            }
                                            icon={Sparkles}
                                            title={
                                              <span className="flex items-center gap-1.5">
                                                Recommended{" "}
                                                <span className="text-red-500">
                                                  For You
                                                </span>
                                              </span>
                                            }
                                            description="This is tailored to the genres you frequently watch."
                                            accent="from-red-600 to-red-500"
                                            count={recommendedMovies.length}
                                            onViewAll={() =>
                                              setBrowseModal({
                                                title: "Recommended For You",
                                                movies: recommendedMovies,
                                              })
                                            }
                                          />
                                        </div>
                                        <div className="pb-8 pt-4 overflow-visible">
                                          <ScrollCarousel
                                            hoverExpand={false}
                                            style={
                                              isDesktop
                                                ? {
                                                    marginLeft: "0px",
                                                    width: "100%",
                                                  }
                                                : {}
                                            }
                                            className="flex gap-2 sm:gap-3 pl-4 sm:pl-12 lg:pl-16 pr-0 snap-x snap-mandatory overflow-x-auto overflow-y-visible"
                                          >
                                            {recommendedMovies.map((movie) => (
                                              <div
                                                key={movie.id}
                                                className="shrink-0 snap-start transition-all duration-300 w-[calc((100%-1rem)/3)] sm:w-[calc((100%-1.5rem)/3)] md:w-[calc((100%-3rem)/3.8)] lg:w-[calc((100%-5rem)/5.5)] xl:w-[calc((100%-7rem)/7.2)] 2xl:w-[calc((100%-8.5rem)/8.5)]"
                                              >
                                                <LazyRender>
                                                  <MovieCard
                                                    movie={movie}
                                                    onClick={onMovieCardClick}
                                                    onPlay={openStream}
                                                    expandOnHover={true}
                                                    showActions={false}
                                                  />
                                                </LazyRender>
                                              </div>
                                            ))}
                                          </ScrollCarousel>
                                        </div>
                                      </div>
                                    </section>
                                  )}

                                {/* Populer Section */}
                                <section
                                  id="section-populer"
                                  className="relative z-10 hover:z-[60] bg-[#000000] pt-0 pb-4 border-t border-white/5 carousel-section-container"
                                  style={
                                    isDesktop
                                      ? { marginTop: "6px", paddingLeft: "0px" }
                                      : {}
                                  }
                                >
                                  <div className="max-w-[2000px] mx-auto overflow-visible relative">
                                    <div className="px-7 sm:px-[47px] lg:px-[56px]">
                                      <SectionHeader
                                        innerStyle={
                                          isDesktop
                                            ? { marginLeft: "-36px" }
                                            : {}
                                        }
                                        icon={Flame}
                                        title={
                                          activeTab === "tv"
                                            ? "Hot TV"
                                            : activeTab === "movie"
                                              ? "Hot Movies"
                                              : "Trending Now"
                                        }
                                        description="Most watched & liked this week"
                                        accent="from-red-600 to-red-400"
                                        count={displayPopular.length}
                                        onViewAll={() =>
                                          setBrowseModal({
                                            title:
                                              activeTab === "tv"
                                                ? "Popular TV"
                                                : activeTab === "movie"
                                                  ? "Popular Movies"
                                                  : "Trending Now",
                                            movies: displayPopular,
                                          })
                                        }
                                      />
                                    </div>
                                    {displayPopular.length > 0 ? (
                                      <div className="mt-2 pb-2 overflow-visible">
                                        <ScrollCarousel
                                          hoverExpand={false}
                                          style={
                                            isDesktop
                                              ? {
                                                  width: "100%",
                                                  marginLeft: "0px",
                                                }
                                              : {}
                                          }
                                          className="flex gap-2 sm:gap-3 pl-4 sm:pl-12 lg:pl-16 pr-0 snap-x snap-mandatory overflow-x-auto overflow-y-visible"
                                        >
                                          {displayPopular
                                            .slice(0, 20)
                                            .map((movie) => (
                                              <div
                                                key={movie.id}
                                                className="shrink-0 snap-start transition-all duration-300 w-[calc((100%-1rem)/3)] sm:w-[calc((100%-1.5rem)/3)] md:w-[calc((100%-3rem)/3.8)] lg:w-[calc((100%-5rem)/5.5)] xl:w-[calc((100%-7rem)/7.2)] 2xl:w-[calc((100%-8.5rem)/8.5)]"
                                              >
                                                <LazyRender>
                                                  <MovieCard
                                                    movie={movie}
                                                    onClick={onMovieCardClick}
                                                    onPlay={openStream}
                                                    expandOnHover={true}
                                                    showActions={false}
                                                    passThroughHover={true}
                                                  />
                                                </LazyRender>
                                              </div>
                                            ))}
                                        </ScrollCarousel>
                                      </div>
                                    ) : (
                                      <EmptyState />
                                    )}
                                  </div>
                                </section>

                                {/* The Last Episode Added Section */}
                                {(activeTab === "tv" || activeTab === "home") &&
                                  latestEpisodes.length > 0 && (
                                    <section
                                      id="section-latest-episodes"
                                      className="relative z-10 hover:z-[60] bg-[#000000] py-5 border-t border-white/5 carousel-section-container"
                                    >
                                      <div className="max-w-[2000px] mx-auto overflow-visible relative">
                                        <div className="px-7 sm:px-[47px] lg:px-[56px]">
                                          <SectionHeader
                                            innerStyle={
                                              isDesktop
                                                ? {
                                                    marginLeft: "-36px",
                                                    marginTop: "-22px",
                                                    paddingLeft: "1px",
                                                  }
                                                : {}
                                            }
                                            title="The Last Episode Added"
                                            icon={Clock}
                                            description="New TV arrivals"
                                            accent="from-red-600 to-red-500"
                                            count={latestEpisodes.length}
                                            onViewAll={() => {
                                              setActiveTab("tv");
                                              window.history.pushState(
                                                {},
                                                "",
                                                "/tv",
                                              );
                                              window.dispatchEvent(
                                                new PopStateEvent("popstate"),
                                              );
                                            }}
                                          />
                                        </div>

                                        <div className="mt-3 pb-6 pt-2 overflow-visible">
                                          <ScrollCarousel
                                            style={
                                              isDesktop
                                                ? {
                                                    width: "100%",
                                                    marginLeft: "0px",
                                                    marginTop: "-248px",
                                                    marginBottom: "-275px",
                                                    paddingTop: "248px",
                                                    paddingBottom: "275px",
                                                  }
                                                : {}
                                            }
                                            className="grid auto-cols-[220px] md:auto-cols-[260px] lg:auto-cols-[240px] grid-flow-col gap-3 sm:gap-4 md:gap-5 snap-x snap-mandatory pl-4 sm:pl-12 lg:pl-16 pr-0"
                                          >
                                            {latestEpisodes.map(
                                              (item, index) => (
                                                <EpisodeCard
                                                  key={item.episodeId}
                                                  item={item}
                                                  onClick={openStream}
                                                  index={index}
                                                />
                                              ),
                                            )}
                                          </ScrollCarousel>
                                        </div>
                                      </div>
                                    </section>
                                  )}

                                {/* Center Banner Hero (Home, Movie, TV) */}
                                {(activeTab === "home" ||
                                  activeTab === "movie" ||
                                  activeTab === "tv") &&
                                  ((settings?.centerBanners?.length || 0) > 0 ||
                                    settings?.centerBannerHeroImage) && (
                                    <CenterBannerCarousel
                                      banners={
                                        (settings?.centerBanners?.length || 0) >
                                        0
                                          ? settings!.centerBanners!
                                          : [
                                              {
                                                id: "legacy",
                                                image:
                                                  settings!
                                                    .centerBannerHeroImage!,
                                                url:
                                                  settings!
                                                    .centerBannerHeroUrl || "",
                                              },
                                            ]
                                      }
                                      activeTab={activeTab}
                                    />
                                  )}

                                {/* Top Watching Section (Top 15) */}
                                {activeTab === "tv" && (
                                  <section
                                    id="section-top"
                                    className="relative z-10 hover:z-[60] bg-[#000000] py-3 border-t border-white/5"
                                  >
                                    <div className="max-w-[2000px] mx-auto overflow-visible relative">
                                      <div className="px-7 sm:px-[47px] lg:px-[56px]">
                                        <SectionHeader
                                          innerStyle={
                                            isDesktop
                                              ? { marginLeft: "-35px" }
                                              : {}
                                          }
                                          title={
                                            <span className="flex items-center gap-1.5">
                                              Top{" "}
                                              <span className="text-red-500">
                                                Popular
                                              </span>{" "}
                                              {activeTab === "tv"
                                                ? "TV"
                                                : "Content"}
                                            </span>
                                          }
                                          icon={Trophy}
                                          description={
                                            activeTab === "tv"
                                              ? "Most popular TV this month"
                                              : "Most popular content this month"
                                          }
                                          accent="from-red-600 to-red-400"
                                          count={displayPopular.length}
                                          onViewAll={() =>
                                            setBrowseModal({
                                              title:
                                                activeTab === "tv"
                                                  ? "Popular TV"
                                                  : "Popular Content",
                                              movies: displayPopular,
                                            })
                                          }
                                        />
                                      </div>
                                      {displayPopular.length > 0 ? (
                                        <div className="mt-2 pb-2 pt-6 overflow-visible">
                                          <ScrollCarousel
                                            hoverExpand={false}
                                            style={
                                              isDesktop
                                                ? {
                                                    width: "100%",
                                                    marginLeft: "0px",
                                                  }
                                                : {}
                                            }
                                            className="flex gap-2 sm:gap-3 pl-4 sm:pl-12 lg:pl-16 pr-0 snap-x snap-mandatory overflow-x-auto overflow-y-visible"
                                          >
                                            {displayPopular
                                              .slice(0, 15)
                                              .map((movie, index) => (
                                                <div
                                                  key={movie.id}
                                                  className="shrink-0 snap-start transition-all duration-300 w-[calc((100%-1rem)/3)] sm:w-[calc((100%-1.5rem)/3)] md:w-[calc((100%-3rem)/3.8)] lg:w-[calc((100%-5rem)/5.5)] xl:w-[calc((100%-7rem)/7.2)] 2xl:w-[calc((100%-8.5rem)/8.5)]"
                                                >
                                                  <div
                                                    onClick={() =>
                                                      onMovieCardClick(movie)
                                                    }
                                                    className="relative w-full aspect-[2/3] flex flex-col rounded-xl overflow-hidden cursor-pointer group bg-black/50 shadow-lg border border-white/5 transition-all duration-300 group-hover:border-transparent card-hover-trigger"
                                                  >
                                                    <div className="absolute top-1.5 left-1.5 z-20 w-6 h-6 rounded-md bg-black/90 backdrop-blur-md flex items-center justify-center border border-white/10 text-red-500 font-extrabold text-[10px] shadow-xl shadow-black/50">
                                                      #{index + 1}
                                                    </div>
                                                    <OptimizedImage
                                                      src={
                                                        movie.poster ||
                                                        movie.backdrop ||
                                                        undefined
                                                      }
                                                      alt={movie.title}
                                                      className="w-full h-full object-cover"
                                                      quality="medium"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-80" />

                                                    <div className="absolute inset-x-0 bottom-0 p-3 flex flex-col items-start justify-end h-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                      <h4
                                                        className="notranslate text-xs font-bold text-white line-clamp-2 leading-snug drop-shadow-md text-left"
                                                        translate="no"
                                                      >
                                                        {movie.title}
                                                      </h4>
                                                      <span className="text-[9px] text-white/50 font-medium tracking-widest mt-0.5 text-left line-clamp-1">
                                                        {movie.year} •{" "}
                                                        {movie.type === "movie"
                                                          ? "Movie"
                                                          : "Series"}
                                                      </span>
                                                    </div>
                                                  </div>
                                                </div>
                                              ))}
                                          </ScrollCarousel>
                                        </div>
                                      ) : (
                                        <EmptyState />
                                      )}
                                    </div>
                                  </section>
                                )}

                                {/* Top Ad Slots */}
                                {!watchMovie &&
                                  !isAdminRoute &&
                                  !isAdFreeUser &&
                                  (settings?.topAdLeftImage ||
                                    settings?.topAdRightImage) && (
                                    <>
                                      <div className="relative z-10 w-full py-6 sm:py-8 bg-[#000000] border-b border-white/5">
                                        <div className="max-w-[1920px] w-full mx-auto px-4 sm:px-6 md:px-[180px] lg:px-[200px]">
                                          <div className="flex flex-col sm:flex-row justify-center items-stretch gap-4 w-full">
                                            {settings?.topAdLeftImage && (
                                              <div className="relative overflow-hidden rounded-sm hover:opacity-80 transition-opacity flex-1 w-full flex items-center justify-center">
                                                <div className="absolute top-1 right-2 text-white/70 text-[9px] font-bold tracking-widest uppercase pointer-events-none z-10 drop-shadow-md bg-black/60 px-1 rounded backdrop-blur-sm">
                                                  Ad
                                                </div>
                                                <MediaBanner
                                                  mediaUrl={
                                                    settings.topAdLeftImage
                                                  }
                                                  linkUrl={
                                                    settings.topAdLeftUrl || "#"
                                                  }
                                                  className="w-full h-full object-contain max-h-[140px] md:max-h-[180px]"
                                                />
                                              </div>
                                            )}
                                            {settings?.topAdRightImage && (
                                              <div className="relative overflow-hidden rounded-sm hover:opacity-80 transition-opacity flex-1 w-full flex items-center justify-center">
                                                <div className="absolute top-1 right-2 text-white/70 text-[9px] font-bold tracking-widest uppercase pointer-events-none z-10 drop-shadow-md bg-black/60 px-1 rounded backdrop-blur-sm">
                                                  Ad
                                                </div>
                                                <MediaBanner
                                                  mediaUrl={
                                                    settings.topAdRightImage
                                                  }
                                                  linkUrl={
                                                    settings.topAdRightUrl ||
                                                    "#"
                                                  }
                                                  className="w-full h-full object-contain max-h-[140px] md:max-h-[180px]"
                                                />
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </>
                                  )}

                                {(activeTab === "home" ||
                                  activeTab === "movie" ||
                                  activeTab === "tv") && (
                                  <section
                                    id="section-all"
                                    style={
                                      isDesktop
                                        ? {
                                            paddingLeft: "0px",
                                            paddingRight: "0px",
                                            marginLeft: "-22px",
                                            marginRight: "-33px",
                                            marginTop: "-1px",
                                            paddingBottom: "21px",
                                            paddingTop: "8px",
                                          }
                                        : {}
                                    }
                                    className="relative z-10 py-6 transition-colors duration-700 bg-[#000000]"
                                  >
                                    <div
                                      style={
                                        isDesktop
                                          ? {
                                              width: "calc(100vw - 20px)",
                                              paddingLeft: "48px",
                                              marginLeft: "43px",
                                              marginTop: "9px",
                                              marginRight: "0px",
                                              paddingRight: "83px",
                                            }
                                          : {}
                                      }
                                      className="max-w-[2000px] w-full mx-auto px-3 sm:px-10 lg:px-12 overflow-hidden sm:overflow-visible"
                                    >
                                      <SectionHeader
                                        innerStyle={
                                          isDesktop
                                            ? {
                                                marginLeft: "-54px",
                                                marginRight: "3px",
                                                paddingLeft: "4px",
                                              }
                                            : {}
                                        }
                                        icon={Layers}
                                        title={
                                          activeTab === "tv"
                                            ? "All TV"
                                            : activeTab === "movie"
                                              ? "All Movies"
                                              : "All Contents"
                                        }
                                        description="Sorted by latest upload"
                                        accent="from-purple-500 to-red-500"
                                        count={displayAll.length}
                                        onViewAll={() =>
                                          setBrowseModal({
                                            title:
                                              activeTab === "tv"
                                                ? "All TV"
                                                : activeTab === "movie"
                                                  ? "All Movies"
                                                  : "All Contents",
                                            movies: displayAll,
                                          })
                                        }
                                      />

                                      <div
                                        style={
                                          isDesktop
                                            ? { marginLeft: "-54px" }
                                            : {}
                                        }
                                        className="mt-4 flex items-center gap-3 relative z-50 pointer-events-auto"
                                      >
                                        <button
                                          onClick={() =>
                                            setShowAllGenres((v) => !v)
                                          }
                                          className="px-3.5 py-1.5 rounded-lg bg-red-600/10 border border-red-500/20 text-red-400 hover:text-white hover:bg-red-600/20 hover:border-red-500/30 transition-all text-xs font-semibold flex items-center gap-2 cursor-pointer relative z-50 pointer-events-auto"
                                        >
                                          <Filter className="w-3.5 h-3.5" />
                                          {showAllGenres
                                            ? "Hide Genres"
                                            : "Show Genres"}
                                        </button>
                                        {selectedGenres.length > 0 && (
                                          <button
                                            onClick={() =>
                                              setSelectedGenres([])
                                            }
                                            className="px-3.5 py-1.5 text-xs bg-white/5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white border border-white/10 font-semibold transition-all cursor-pointer relative z-50 pointer-events-auto"
                                          >
                                            Reset Filter
                                          </button>
                                        )}
                                      </div>

                                      {/* Expanded genres list */}
                                      <div
                                        style={
                                          isDesktop
                                            ? { marginLeft: "-54px" }
                                            : {}
                                        }
                                        className={`mt-4 flex-wrap gap-2 relative z-50 pointer-events-auto ${showAllGenres || selectedGenres.length > 0 ? "flex" : "hidden"}`}
                                      >
                                        {visibleGenres
                                          .slice(
                                            0,
                                            showAllGenres ? undefined : 10,
                                          )
                                          .map((genre) => {
                                            const isActive =
                                              selectedGenres.includes(genre);
                                            return (
                                              <button
                                                key={genre}
                                                onClick={() => {
                                                  if (isActive) {
                                                    setSelectedGenres([]);
                                                  } else {
                                                    setSelectedGenres([genre]);
                                                  }
                                                }}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                                                  isActive
                                                    ? "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-900/30"
                                                    : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10 border border-white/5"
                                                }`}
                                              >
                                                {genre}
                                              </button>
                                            );
                                          })}
                                      </div>

                                      <div
                                        style={
                                          isDesktop
                                            ? {
                                                marginLeft: "-59px",
                                                marginTop: "12px",
                                                marginRight: "-56px",
                                              }
                                            : {}
                                        }
                                        className={PREVIEW_GRID_COLS + " mt-2"}
                                      >
                                        {allPreview.map((movie) => (
                                          <LazyRender key={movie.id}>
                                            <MovieCard
                                              movie={movie}
                                              onClick={onMovieCardClick}
                                              isAllContent={true}
                                            />
                                          </LazyRender>
                                        ))}
                                      </div>
                                    </div>
                                  </section>
                                )}

                                {activeTab === "home" && (
                                  <>
                                    <BottomHeroSection
                                      onSelectMovie={onMovieCardClick}
                                      onWatchNow={openStream}
                                      bottomHeroContent={homeBottomHeroContent}
                                      isDesktop={isDesktop}
                                    />
                                    <TopTenCarousel
                                      movies={topAll}
                                      onSelectMovie={onMovieCardClick}
                                      onViewAll={() =>
                                        setBrowseModal({
                                          title: "Top Watch This Month!",
                                          movies: topAll,
                                        })
                                      }
                                      innerStyle={
                                        isDesktop
                                          ? {
                                              marginLeft: "-36px",
                                              paddingLeft: "4px",
                                            }
                                          : {}
                                      }
                                      carouselStyle={
                                        isDesktop
                                          ? {
                                              marginRight: "0px",
                                              marginBottom: "-279px",
                                              width: "calc(100vw - 20px)",
                                              marginLeft: "9px",
                                            }
                                          : {}
                                      }
                                    />
                                  </>
                                )}
                              </>
                            )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Custom Internal Banner Ad */}
                    {!watchMovie &&
                      !isAdminRoute &&
                      !isPersonalTab &&
                      settings?.internalAdImage && (
                        <div
                          className={`relative z-10 w-full bg-[#000000] border-t border-white/5 flex justify-center overflow-hidden h-[60px] sm:h-[80px] md:h-[124px] ${settings.internalAdImage.includes("join.mp4") ? "cursor-pointer" : ""}`}
                          onClick={() => {
                            if (
                              settings.internalAdImage?.includes("join.mp4")
                            ) {
                              window.scrollTo({
                                top: document.body.scrollHeight,
                                behavior: "smooth",
                              });
                            }
                          }}
                        >
                          <div
                            className={`block w-full max-w-7xl relative mx-auto h-full ${settings.internalAdImage.includes("join.mp4") ? "pointer-events-none" : ""}`}
                          >
                            <MediaBanner
                              mediaUrl={settings.internalAdImage}
                              linkUrl={settings?.internalAdUrl || "#"}
                            />
                          </div>
                        </div>
                      )}

                    {/* Most Commented Section */}
                    {!watchMovie &&
                      !isAdminRoute &&
                      !isPersonalTab &&
                      activeMostCommented.length > 0 && (
                        <div className="relative z-10 w-full py-8 bg-[#000000] border-t border-white/5">
                          <div className="max-w-none w-full mx-auto overflow-visible relative">
                            <div className="px-7 sm:px-[47px] lg:px-[56px]">
                              <SectionHeader
                                innerStyle={
                                  isDesktop ? { marginLeft: "-36px" } : {}
                                }
                                title="Most Commented"
                                description="What everyone is talking about"
                                accent="from-blue-600 to-red-500"
                                icon={MessageCircle}
                                count={activeMostCommentedAll.length}
                                onViewAll={() =>
                                  setBrowseModal({
                                    title: "Most Commented",
                                    movies: activeMostCommentedAll,
                                  })
                                }
                              />
                            </div>
                            <div className="mt-2 pb-2 overflow-visible">
                              <ScrollCarousel
                                style={
                                  isDesktop
                                    ? { width: "100%", marginLeft: "0px" }
                                    : {}
                                }
                                className="flex gap-2 sm:gap-3 pl-4 sm:pl-12 lg:pl-16 pr-0 snap-x snap-mandatory overflow-x-auto overflow-y-visible"
                              >
                                {activeMostCommented.map((movie) => (
                                  <div
                                    key={movie.id}
                                    className="shrink-0 snap-start transition-all duration-300 w-[calc((100%-1rem)/3)] sm:w-[calc((100%-1.5rem)/3)] md:w-[calc((100%-3rem)/3.8)] lg:w-[calc((100%-5rem)/5.5)] xl:w-[calc((100%-7rem)/7.2)] 2xl:w-[calc((100%-8.5rem)/8.5)]"
                                  >
                                    <MovieCard
                                      movie={movie}
                                      onClick={openStream}
                                      showCommentBadge={true}
                                    />
                                  </div>
                                ))}
                              </ScrollCarousel>
                            </div>
                          </div>
                        </div>
                      )}

                    {/* Global Continue Watching */}
                    {!watchMovie && !isAdminRoute && !isPersonalTab && (
                      <ContinueWatching
                        contents={
                          activeTab === "movie" || activeTab === "tv"
                            ? contents.filter((c) => c.type === activeTab)
                            : contents
                        }
                        onSelectMovie={openStream}
                        onViewAll={() => {
                          setActiveTab("history");
                          window.history.pushState({}, "", "/history");
                          window.dispatchEvent(new PopStateEvent("popstate"));
                        }}
                        innerStyle={isDesktop ? { marginLeft: "-36px" } : {}}
                        carouselStyle={
                          isDesktop
                            ? {
                                width: "1382px",
                                paddingLeft: "55px",
                                marginLeft: "-50px",
                                marginTop: "1px",
                                marginRight: "0px",
                                paddingTop: "0px",
                                paddingRight: "0px",
                              }
                            : {}
                        }
                      />
                    )}

                    {/* Bottom Ad Slots */}
                    {!watchMovie &&
                      !isAdminRoute &&
                      !isAdFreeUser &&
                      (settings?.bottomAdLeftImage ||
                        settings?.bottomAdRightImage) && (
                        <>
                          <div className="relative z-10 w-full py-6 sm:py-8 bg-[#000000] border-t border-white/5">
                            <div className="max-w-[1920px] w-full mx-auto px-4 sm:px-6 md:px-[180px] lg:px-[200px]">
                              <div className="flex flex-col sm:flex-row justify-center items-stretch gap-4 w-full">
                                {settings?.bottomAdLeftImage && (
                                  <div className="relative overflow-hidden rounded-sm hover:opacity-80 transition-opacity flex-1 w-full flex items-center justify-center">
                                    <div className="absolute top-1 right-2 text-white/70 text-[9px] font-bold tracking-widest uppercase pointer-events-none z-10 drop-shadow-md bg-black/60 px-1 rounded backdrop-blur-sm">
                                      Ad
                                    </div>
                                    <MediaBanner
                                      mediaUrl={settings.bottomAdLeftImage}
                                      linkUrl={settings.bottomAdLeftUrl || "#"}
                                      className="w-full h-full object-contain max-h-[140px] md:max-h-[180px]"
                                    />
                                  </div>
                                )}
                                {settings?.bottomAdRightImage && (
                                  <div className="relative overflow-hidden rounded-sm hover:opacity-80 transition-opacity flex-1 w-full flex items-center justify-center">
                                    <div className="absolute top-1 right-2 text-white/70 text-[9px] font-bold tracking-widest uppercase pointer-events-none z-10 drop-shadow-md bg-black/60 px-1 rounded backdrop-blur-sm">
                                      Ad
                                    </div>
                                    <MediaBanner
                                      mediaUrl={settings.bottomAdRightImage}
                                      linkUrl={settings.bottomAdRightUrl || "#"}
                                      className="w-full h-full object-contain max-h-[140px] md:max-h-[180px]"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                    {/* Footer */}
                    <footer className="relative z-10 bg-[#000000] border-t border-white/5 px-7 sm:px-[47px] lg:px-[56px] pb-12">
                      <div
                        style={
                          isDesktop
                            ? {
                                paddingTop: "38px",
                                paddingBottom: "39px",
                                paddingLeft: "3px",
                                paddingRight: "10px",
                              }
                            : {}
                        }
                        className="max-w-[2000px] mx-auto px-7 sm:px-[47px] lg:px-[56px]"
                      >
                        {/* Top row: Logo (left) */}
                        <div className="flex flex-col md:flex-row items-start justify-start py-10 gap-6">
                          <div className="flex items-center gap-4">
                            <div
                              className="flex items-center gap-4 cursor-pointer"
                              onClick={() => {
                                setActiveTab("home");
                                setSearchQuery("");
                                window.history.pushState({}, "", homePath());
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                            >
                              <img
                                src={settings?.brandLogo || BRAND_LOGO_URL}
                                alt={BRAND_NAME}
                                className="h-8 md:h-10 w-auto object-contain"
                                draggable={false}
                              />
                            </div>
                            <div className="h-6 w-[1px] bg-white/10 hidden md:block" />
                            <div className="hidden md:block">
                              <p className="text-[10px] font-medium text-white/40 uppercase tracking-tighter">
                                {BRAND_NAME}
                              </p>
                              <p className="text-[9px] text-white/20 font-normal uppercase tracking-[0.2em]">
                                {BRAND_SLOGAN}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Bottom block: Disclaimer (Left-aligned) */}
                        <div
                          style={{
                            borderTop: "1px solid rgba(255,255,255,0.05)",
                            paddingTop: "24px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            position: "relative",
                            zIndex: 10,
                            width: "100%",
                            marginBottom: "40px",
                            overflow: "hidden",
                          }}
                          className="border-t border-white/5 pt-8 md:pt-10 flex flex-col items-start relative z-10 w-full mb-10 overflow-hidden"
                        >
                          <div
                            style={{
                              maxWidth: "1418px",
                              width: "100%",
                              marginLeft: "auto",
                              marginRight: "auto",
                            }}
                            className="w-full relative flex flex-col md:flex-row items-start justify-between gap-6 px-4 md:px-0"
                          >
                            <div className="flex-1 text-left font-normal uppercase tracking-wider opacity-100 drop-shadow-md max-w-2xl mr-auto">
                              <p className="text-[10px] md:text-[11px] text-white/40 leading-relaxed select-text">
                                {BRAND_NAME} does not host, store, or distribute
                                any media files on our servers. All content is
                                automatically retrieved from third-party
                                providers available on the internet.
                              </p>
                              <p className="text-[10px] md:text-[11px] text-white/40 leading-relaxed mt-2 select-text">
                                {BRAND_NAME} functions solely as an index or
                                intermediary for accessing such content.
                              </p>
                              <p className="text-[10px] md:text-[11px] text-white/40 font-medium uppercase tracking-widest mt-4">
                                © {new Date().getFullYear()} {BRAND_NAME}. All
                                rights reserved.
                              </p>

                              <div className="flex flex-wrap gap-3 items-center justify-start text-[10px] text-white/30 font-bold uppercase tracking-widest mt-4 select-none">
                                <span
                                  className="cursor-pointer hover:text-[#ff3838] transition-colors"
                                  onClick={() => {
                                    window.history.pushState(
                                      {},
                                      "",
                                      "/privacy",
                                    );
                                    setCurrentPath("/privacy");
                                  }}
                                >
                                  Privacy Policy
                                </span>
                                <span className="text-white/10">|</span>
                                <span
                                  className="cursor-pointer hover:text-[#ff3838] transition-colors"
                                  onClick={() => {
                                    window.history.pushState({}, "", "/terms");
                                    setCurrentPath("/terms");
                                  }}
                                >
                                  Terms of Service
                                </span>
                                <span className="text-white/10">|</span>
                                <span
                                  className="cursor-pointer hover:text-[#ff3838] transition-colors"
                                  onClick={() => {
                                    window.history.pushState(
                                      {},
                                      "",
                                      "/reportbug",
                                    );
                                    setCurrentPath("/reportbug");
                                  }}
                                >
                                  Report Bug
                                </span>
                                <span className="text-white/10">|</span>
                                <span
                                  className="cursor-pointer hover:text-[#ff3838] transition-colors"
                                  onClick={() => {
                                    window.history.pushState(
                                      {},
                                      "",
                                      "/needhelp",
                                    );
                                    setCurrentPath("/needhelp");
                                  }}
                                >
                                  Need Help
                                </span>
                                {settings?.appDownloadLink && (
                                  <>
                                    <span className="text-white/10">|</span>
                                    <a
                                      href={settings.appDownloadLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="cursor-pointer text-red-500 hover:text-white transition-colors font-extrabold"
                                    >
                                      DOWNLOAD APP
                                    </a>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-row items-center gap-4 shrink-0 mt-[90px] ml-0 pl-0 pt-0">
                              <motion.div className="flex flex-col items-center">
                                <motion.a
                                  href={
                                    settings?.telegramUrl ||
                                    "https://t.me/+Yt435-iYNcc1MWJl"
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  whileHover={{ scale: 1.1, opacity: 0.85 }}
                                  whileTap={{ scale: 0.9 }}
                                  className="p-2 transition-all duration-300 text-white opacity-55 hover:opacity-85"
                                  title="Join Telegram"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    className="w-6 h-6"
                                  >
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.11.03-1.84 1.18-5.2 3.45-.49.34-.94.51-1.34.5-.44-.01-1.28-.25-1.9-.45-.77-.25-1.38-.38-1.33-.8.02-.22.33-.44.92-.68 3.59-1.56 5.98-2.59 7.18-3.09 3.41-1.42 4.12-1.66 4.58-1.67.1 0 .32.02.46.14.12.1.16.24.17.33 0 .04.01.12.01.16z" />
                                  </svg>
                                </motion.a>
                              </motion.div>

                              {settings?.discordUrl && (
                                <motion.div className="flex flex-col items-center">
                                  <motion.a
                                    href={settings.discordUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    whileHover={{ scale: 1.1, opacity: 0.85 }}
                                    whileTap={{ scale: 0.9 }}
                                    className="p-2 transition-all duration-300 text-white opacity-55 hover:opacity-85"
                                    title="Join Discord"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 127.14 96.36"
                                      fill="currentColor"
                                      className="w-6 h-6"
                                    >
                                      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1,105.25,105.25,0,0,0,32.19-16.14h0c2.64-27.38-4.51-51.11-19.32-72.15ZM42.68,65.3c-5.36,0-9.81-4.93-9.81-11s4.38-11,9.81-11,9.88,4.93,9.81,11-4.43,11-9.81,11Zm41.74,0c-5.36,0-9.81-4.93-9.81-11s4.38-11,9.81-11,9.88,4.93,9.81,11-4.43,11-9.81,11Z" />
                                    </svg>
                                  </motion.a>
                                </motion.div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </footer>

                    {/* Floating Bottom Ad */}
                    {!watchMovie &&
                      !isAdminRoute &&
                      !isAdFreeUser &&
                      settings?.adImage &&
                      settings?.adUrl && (
                        <div className="fixed bottom-20 md:bottom-4 right-4 z-[90] w-64 md:w-80 rounded-xl overflow-hidden shadow-2xl shadow-black border border-white/10 hover:scale-105 transition-transform origin-bottom-right">
                          <MediaBanner
                            mediaUrl={settings.adImage}
                            linkUrl={settings?.adUrl || "#"}
                            className="w-full h-auto object-contain"
                          />
                          <div className="absolute top-1 right-2 text-[8px] bg-black/60 px-1 rounded text-white/50 backdrop-blur-sm pointer-events-none">
                            AD
                          </div>
                        </div>
                      )}

                    {/* Movie Modal */}
                    <AnimatePresence>
                      {selectedMovie && (
                        <MovieModal
                          movie={selectedMovie}
                          onClose={() => {
                            setSelectedMovie(null);
                            setTrailerAutoPlay(false);
                          }}
                          onSwitchMovie={onMovieCardClick}
                          onWatch={openStream}
                          onTrailerStateChange={setIsTrailerActive}
                          autoPlay={trailerAutoPlay}
                          onShare={setGlobalSharingMovie}
                        />
                      )}
                    </AnimatePresence>

                    {/* Full-page Browse view with pagination (performance-friendly) */}
                    <AnimatePresence>
                      {browseModal && (
                        <div className="fixed inset-0 z-[999] bg-[#000000] overflow-y-auto">
                          <MoviePagerPage
                            title={browseModal.title}
                            movies={browseModal.movies}
                            onClose={() => setBrowseModal(null)}
                            onSelectMovie={onMovieCardClick}
                            isMobile={isMobile}
                          />
                        </div>
                      )}
                    </AnimatePresence>

                    {/* Global toast notifications */}
                    <ToastStack />

                    {/* Offline Notification */}
                    <AnimatePresence>
                      {!isOnline && !showFullOfflineError && !isAdminRoute && (
                        <motion.div
                          initial={{ opacity: 0, y: -20, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -20, scale: 0.95 }}
                          className="fixed top-24 left-1/2 -translate-x-1/2 z-[150] w-[90%] max-w-sm bg-red-600/95 backdrop-blur-xl text-white p-4 rounded-3xl shadow-[0_30px_60px_rgba(220,38,38,0.3)] border border-white/20 flex flex-col gap-3"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
                              <WifiOff className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-[11px] font-black uppercase tracking-[0.1em] mb-1">
                                Connection Issue
                              </h3>
                              <p className="text-[10px] text-white/80 font-medium leading-[1.4]">
                                Cloud connection blocked by ISP or offline. Open
                                in new tab for a safer connection.
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                window.open(window.location.href, "_blank")
                              }
                              className="flex-1 py-2.5 bg-white text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-colors shadow-lg shadow-black/20 font-bold"
                            >
                              New Tab
                            </button>
                            <button
                              onClick={() => window.location.reload()}
                              className="flex-[1.2] flex items-center justify-center gap-1.5 py-2.5 bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
                            >
                              <RefreshCw
                                className="w-3.5 h-3.5 animate-spin"
                                style={{ animationDuration: "6s" }}
                              />
                              <span>Refresh Tab</span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Ad Consent Flow */}
                    <AnimatePresence>
                      {showAdConsent && !isViyiePlus && (
                        <motion.div
                          initial={{ opacity: 0, x: -50 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -50 }}
                          className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-[250] w-[90%] max-w-[340px] bg-[#111] border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col gap-3"
                        >
                          <button
                            onClick={() => {
                              setShowAdConsent(false);
                            }}
                            className="absolute top-3 right-3 p-1.5 hover:bg-white/10 rounded-full transition-colors"
                            aria-label="Close"
                          >
                            <X className="w-4 h-4 text-white/50 hover:text-white" />
                          </button>

                          <div className="pr-6">
                            <div className="w-8 h-8 rounded-full bg-red-600/20 flex items-center justify-center mb-3">
                              <AlertCircle className="w-4 h-4 text-red-500" />
                            </div>
                            <h3 className="text-sm font-bold text-white mb-1">
                              Third-Party Content
                            </h3>
                            <p className="text-[11px] text-white/60 leading-relaxed font-medium">
                              Some media streams may contain embedded
                              advertisements or similar materials. Do you agree
                              to proceed, acknowledging that video player ads
                              are from third-party sources and not us?
                            </p>
                          </div>

                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => {
                                localStorage.setItem(
                                  "ad_consent_given",
                                  "true",
                                );
                                setShowAdConsent(false);
                              }}
                              className="flex-1 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                            >
                              Deny
                            </button>
                            <button
                              onClick={() => {
                                localStorage.setItem(
                                  "ad_consent_given",
                                  "true",
                                );
                                setShowAdConsent(false);
                              }}
                              className="flex-1 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest bg-red-600 text-white shadow-lg shadow-red-900/40 hover:bg-red-700 transition-colors"
                            >
                              Accept All
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Global Share Dialog - Fixed at the highest layer */}
                    <AnimatePresence>
                      {globalSharingMovie && (
                        <ShareDialog
                          movie={globalSharingMovie}
                          onClose={() => setGlobalSharingMovie(null)}
                        />
                      )}
                    </AnimatePresence>

                    {/* Viyie+ Pending Claim Popup */}
                    <AnimatePresence>
                      {pendingRedeemPopup && (
                        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-[#0f0f0f] border border-red-500/20 rounded-2xl p-6 md:p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 blur-[50px] rounded-full pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-600/10 blur-[50px] rounded-full pointer-events-none" />

                            <div className="w-16 h-16 rounded-full bg-red-600/10 border border-red-500/20 mx-auto flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(220,38,38,0.2)]">
                              <Star className="w-8 h-8 text-red-500" />
                            </div>

                            <h3 className="text-xl font-bold text-white mb-3 tracking-tight">
                              Claim Viyie+ Access
                            </h3>
                            <p className="text-sm text-white/60 mb-8 leading-relaxed">
                              If you want to get Viyie+ access from the link you
                              are heading to, please link your account or log in
                              first.
                            </p>

                            <div className="flex flex-col gap-3">
                              <button
                                onClick={() => {
                                  setPendingRedeemPopup(false);
                                  openAuth();
                                }}
                                className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm tracking-wide transition-colors"
                              >
                                Log In / Sign Up
                              </button>
                              <button
                                onClick={() => {
                                  setPendingRedeemPopup(false);
                                  localStorage.removeItem(
                                    "pending_redeem_code",
                                  );
                                }}
                                className="w-full py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 font-semibold text-sm tracking-wide transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </>
    </MotionConfig>
  );
}

function MoviePagerPage({
  title,
  movies,
  onClose,
  onSelectMovie,
  isMobile,
}: {
  title: string;
  movies: Content[];
  onClose: () => void;
  onSelectMovie: (m: Content) => void;
  isMobile: boolean;
}) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("latest_upload");
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const sortedMovies = useMemo(() => {
    let result = [...movies];
    switch (sortBy) {
      case "latest_upload":
        result.sort((a, b) => {
          const ta =
            typeof a.createdAt?.seconds === "number"
              ? a.createdAt.seconds * 1000
              : typeof a.createdAt === "string"
                ? new Date(a.createdAt).getTime()
                : 0;
          const tb =
            typeof b.createdAt?.seconds === "number"
              ? b.createdAt.seconds * 1000
              : typeof b.createdAt === "string"
                ? new Date(b.createdAt).getTime()
                : 0;
          return tb - ta;
        });
        break;
      case "latest":
        result.sort((a, b) => {
          const da = new Date(a.releaseDate || a.year || 0).getTime();
          const db = new Date(b.releaseDate || b.year || 0).getTime();
          return (isNaN(db) ? 0 : db) - (isNaN(da) ? 0 : da);
        });
        break;
      case "oldest":
        result.sort((a, b) => {
          const da = new Date(a.releaseDate || a.year || 0).getTime();
          const db = new Date(b.releaseDate || b.year || 0).getTime();
          return (isNaN(da) ? 0 : da) - (isNaN(db) ? 0 : db);
        });
        break;
      case "az":
        result.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        break;
      case "za":
        result.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
        break;
      case "rating_high":
        result.sort((a, b) => {
          const ra = Number(a.rating) || 0;
          const rb = Number(b.rating) || 0;
          return (isNaN(rb) ? 0 : rb) - (isNaN(ra) ? 0 : ra);
        });
        break;
      case "rating_low":
        result.sort((a, b) => {
          const ra = Number(a.rating) || 0;
          const rb = Number(b.rating) || 0;
          return (isNaN(ra) ? 0 : ra) - (isNaN(rb) ? 0 : rb);
        });
        break;
    }
    return result;
  }, [movies, sortBy]);

  const [gridCols, setGridCols] = useState(6);
  useEffect(() => {
    const updateCols = () => {
      if (window.innerWidth >= 1536) setGridCols(8);
      else if (window.innerWidth >= 1280) setGridCols(6);
      else if (window.innerWidth >= 768) setGridCols(5);
      else if (window.innerWidth >= 640) setGridCols(4);
      else setGridCols(3);
    };
    updateCols();
    window.addEventListener("resize", updateCols);
    return () => window.removeEventListener("resize", updateCols);
  }, []);

  const perPage = gridCols * 6;
  const totalPages = Math.max(1, Math.ceil(sortedMovies.length / perPage));
  const pageItems = useMemo(
    () => sortedMovies.slice((page - 1) * perPage, page * perPage),
    [sortedMovies, page, perPage],
  );

  useEffect(() => {
    if (page > totalPages) setPage(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page, totalPages]);

  const sortOptions = [
    { id: "latest", label: "Release Date" },
    { id: "latest_upload", label: "Latest Upload" },
    { id: "oldest", label: "Oldest Upload" },
    { id: "az", label: "A - Z" },
    { id: "za", label: "Z - A" },
    { id: "rating_high", label: "Highest Rating" },
    { id: "rating_low", label: "Lowest Rating" },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="relative min-h-screen bg-[#000000] pt-24 px-4 sm:px-6 lg:px-8 pb-16 z-[60]"
    >
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-4 border-b border-white/10">
          <div className="flex-1">
            <h1 className="text-2xl md:text-4xl font-bold text-white mb-2 uppercase tracking-tighter">
              {title}
            </h1>
            <div className="flex items-center gap-3">
              <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest leading-none bg-white/5 px-2 py-1 rounded">
                {movies.length} titles found
              </p>

              {/* Sorting Filter */}
              <div className="relative">
                <button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all text-[10px] font-bold uppercase tracking-widest"
                >
                  <Filter className="w-3 h-3 text-red-500" />
                  Sort by: {sortOptions.find((o) => o.id === sortBy)?.label}
                  <ChevronDown
                    className={`w-3 h-3 text-white/30 transition-transform ${showSortDropdown ? "rotate-180" : ""}`}
                  />
                </button>

                <AnimatePresence>
                  {showSortDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-[70]"
                        onClick={() => setShowSortDropdown(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute left-0 top-full mt-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-[80] py-1 overflow-hidden"
                      >
                        {sortOptions.map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => {
                              setSortBy(opt.id);
                              setShowSortDropdown(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest transition-colors ${
                              sortBy === opt.id
                                ? "bg-red-600 text-white"
                                : "text-white/60 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest border border-white/10 transition-all text-sm active:scale-95 shadow-xl"
          >
            <X className="w-4 h-4 text-red-500" /> Close
          </button>
        </div>

        <div
          className={
            (isMobile
              ? GRID_COLS
              : "grid grid-cols-4 md:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2 sm:gap-3 xl:gap-4") +
            " mb-10"
          }
        >
          {pageItems.map((movie, idx) => (
            <LazyRender key={`${movie.id}-${idx}`}>
              <MovieCard
                movie={movie}
                onClick={onSelectMovie}
                showCommentBadge={title === "Most Commented"}
              />
            </LazyRender>
          ))}
        </div>

        <SimplePagination
          page={page}
          totalPages={totalPages}
          setPage={setPage}
        />
      </div>
    </motion.section>
  );
}

function CenterBannerCarousel({
  banners,
  activeTab = "home",
}: {
  banners: {
    id: string;
    image: string;
    url: string;
    page?: "home" | "movie" | "tv" | "soon";
  }[];
  activeTab?: string;
}) {
  let currentContext: "home" | "movie" | "tv" | "soon" = "home";
  if (activeTab === "movie") currentContext = "movie";
  else if (activeTab === "tv") currentContext = "tv";
  else if (activeTab === "upcoming" || activeTab === "soon")
    currentContext = "soon";

  // Filter banners based on selected page option
  let validBanners = banners.filter(
    (b) =>
      b.image && b.image.trim() !== "" && (b.page || "home") === currentContext,
  );

  // Fallback if none found ("selain yang di sebutkan auto tampilkan banner yang ada di home")
  if (validBanners.length === 0) {
    validBanners = banners.filter(
      (b) => b.image && b.image.trim() !== "" && (b.page || "home") === "home",
    );
  }

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex(0);
  }, [activeTab]);

  useEffect(() => {
    if (validBanners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % validBanners.length);
    }, 15000); // 15 seconds per slide
    return () => clearInterval(interval);
  }, [validBanners]);

  if (!validBanners || validBanners.length === 0) return null;

  return (
    <section className="relative w-full overflow-hidden block">
      <div className="relative w-full pt-[31.17%]">
        <AnimatePresence initial={false}>
          {validBanners.map(
            (banner, index) =>
              index === currentIndex && (
                <motion.div
                  key={banner.id || index}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                  className={`absolute inset-0 w-full h-full ${banner.image.includes("join.mp4") ? "cursor-pointer" : ""}`}
                  onClick={() => {
                    if (banner.image.includes("join.mp4")) {
                      window.scrollTo({
                        top: document.body.scrollHeight,
                        behavior: "smooth",
                      });
                    }
                  }}
                >
                  <div
                    className={`w-full h-full ${banner.image.includes("join.mp4") ? "pointer-events-none" : ""}`}
                  >
                    <MediaBanner mediaUrl={banner.image} linkUrl={banner.url} />
                  </div>
                </motion.div>
              ),
          )}
        </AnimatePresence>

        {/* Red Dots as requested (top hero style) */}
        {validBanners.length > 1 && (
          <div className="absolute bottom-4 left-6 sm:bottom-6 sm:left-10 z-10 flex gap-1.5 items-center">
            {validBanners.map((_, dotIdx) => (
              <div
                key={dotIdx}
                className={`transition-all duration-300 rounded-full ${
                  dotIdx === currentIndex
                    ? "w-2.5 h-1 md:w-3 md:h-1 bg-red-600"
                    : "w-1 h-1 md:w-1.5 md:h-1.5 bg-white/40"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// Component for the bottom hero layout section ("Recommended for You")
function BottomHeroSection({
  bottomHeroContent,
  onSelectMovie,
  onWatchNow,
  isDesktop = false,
}: {
  bottomHeroContent: Content[];
  onSelectMovie: (m: Content) => void;
  onWatchNow: (m: Content) => void;
  isDesktop?: boolean;
}) {
  if (bottomHeroContent.length === 0) return null;

  return (
    <div className="relative w-full z-10 bg-[#000000] py-4 md:py-6 border-t border-white/5">
      <div className="max-w-[2000px] mx-auto overflow-visible relative">
        <div className="px-7 sm:px-[47px] lg:px-[56px]">
          <SectionHeader
            innerStyle={
              isDesktop
                ? {
                    marginLeft: "-36px",
                    paddingTop: "0px",
                  }
                : {}
            }
            title="Recommendations"
            icon={Sparkles}
            description="Handpicked for you"
            accent="from-purple-500 to-red-500"
            count={bottomHeroContent.length}
          />
        </div>

        <div className="pb-6 overflow-visible">
          <ScrollCarousel
            hoverExpand={false}
            style={
              isDesktop
                ? {
                    marginLeft: "0px",
                    width: "100%",
                  }
                : {}
            }
            className="flex gap-4 sm:gap-6 snap-x snap-mandatory pl-4 sm:pl-12 lg:pl-16 pr-0"
          >
            {bottomHeroContent.map((movie) => (
              <div
                key={movie.id}
                onClick={() => onSelectMovie(movie)}
                className="relative cursor-pointer flex-shrink-0 w-[85vw] sm:w-[80vw] md:w-[70vw] lg:w-[55vw] xl:w-[45vw] aspect-[21/9] rounded-xl md:rounded-2xl overflow-hidden snap-start group border border-white/5 bg-[#111] transition-all duration-300 card-hover-trigger"
              >
                {/* Backdrop Background */}
                <div className="absolute inset-0">
                  <OptimizedImage
                    src={movie.backdrop || movie.poster || undefined}
                    alt={movie.title}
                    className="w-full h-full object-cover opacity-60 transition-transform duration-700"
                    style={{
                      objectPosition: movie.backdropPosition || "50% 50%",
                      transform: `scale(${movie.backdropScale || 1}) rotate(${movie.backdropRotate || 0}deg)`,
                      transformOrigin: movie.backdropPosition || "50% 50%",
                    }}
                    quality="high"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/90 via-[#0a0a0a]/50 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/80 via-transparent to-transparent" />
                </div>

                {/* Inner Content */}
                <div className="relative h-full flex items-center px-4 sm:px-6 lg:px-8 gap-5 sm:gap-8">
                  {/* Left: Poster */}
                  <div className="hidden sm:block shrink-0 h-[82%] sm:h-[82%] aspect-[2/3] max-h-[328px] rounded-xl overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,1)] border border-white/20 transition-all duration-300">
                    <OptimizedImage
                      src={movie.poster || undefined}
                      alt={movie.title}
                      className="w-full h-full object-cover shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] animate-scale-up"
                      quality="medium"
                    />
                  </div>

                  {/* Right: Info — fixed layout, tightened spacing and centered */}
                  <div className="flex-1 flex flex-col justify-center gap-2 md:gap-3 lg:gap-4 min-w-0 h-full py-2 overflow-hidden">
                    {/* Top: studio + title + meta */}
                    <div className="min-w-0">
                      <span className="block text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-white/40 mb-1 truncate">
                        Recommendation
                      </span>

                      <h2
                        className="notranslate font-semibold text-white leading-tight tracking-tight line-clamp-1 mb-1 md:mb-2"
                        style={{ fontSize: "clamp(0.95rem, 3vw, 1.65rem)" }}
                        translate="no"
                      >
                        {movie.title}
                      </h2>

                      <div className="flex flex-wrap items-center gap-2 text-[10px] md:text-xs font-medium mb-2 opacity-80">
                        <span className="flex items-center gap-1 text-yellow-500">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          {movie.rating}
                        </span>
                        <span className="text-white/40 font-semibold">
                          {movie.type === "tv"
                            ? (() => {
                                const last = getLastEpisodeNumber(movie);
                                return last === 1
                                  ? "1 Eps"
                                  : last
                                    ? `1-${last} Eps`
                                    : "TV";
                              })()
                            : movie.duration}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-white/30 border border-white/10 uppercase tracking-widest text-[9px] font-medium">
                          {movie.year || movie.releaseDate?.split("-")[0]}
                        </span>
                      </div>

                      <p className="text-[10px] md:text-sm text-white/80 leading-relaxed line-clamp-2 md:line-clamp-3 mb-1 max-w-xl">
                        {movie.synopsis}
                      </p>
                    </div>

                    <div className="mt-1 md:mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onWatchNow(movie);
                        }}
                        className="h-7 sm:h-11 px-4 sm:px-8 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[9px] sm:text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/20 active:scale-95"
                      >
                        <Play className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 fill-current" />
                        Watch Now
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </ScrollCarousel>
        </div>
      </div>
    </div>
  );
}

function TopTenCarousel({
  movies,
  onSelectMovie,
  onViewAll,
  innerStyle = {},
  carouselStyle = {},
}: {
  movies: Content[];
  onSelectMovie: (m: Content) => void;
  onViewAll?: () => void;
  innerStyle?: React.CSSProperties;
  carouselStyle?: React.CSSProperties;
}) {
  const topTen = useMemo(() => movies.slice(0, 15), [movies]);

  return (
    <section className="relative z-10 hover:z-[60] bg-[#000000] py-5 border-t border-white/5">
      <div className="max-w-[2000px] mx-auto overflow-visible relative">
        <div className="px-7 sm:px-[47px] lg:px-[56px]">
          <SectionHeader
            innerStyle={innerStyle}
            title={
              <span className="flex items-center gap-1.5">
                Top Watch This <span className="text-red-500">Month!</span>
              </span>
            }
            icon={Trophy}
            description="Our most popular content right now"
            accent="from-yellow-400 to-red-500"
            count={topTen.length}
            onViewAll={onViewAll}
          />
        </div>

        <div className="mt-4 pb-8 overflow-visible">
          <ScrollCarousel
            style={carouselStyle}
            className="flex gap-2 sm:gap-3 pl-8 sm:pl-12 lg:pl-16 pr-4 snap-x snap-mandatory overflow-x-auto overflow-y-visible"
          >
            {topTen.map((movie, index) => {
              const rank = index + 1;

              return (
                <div
                  key={movie.id}
                  className="relative group cursor-pointer shrink-0 snap-start transition-all duration-300 w-[calc((100%-0.75rem)/3)] sm:w-[calc((100%-1rem)/3)] md:w-[calc((100%-2rem)/3.1)] lg:w-[calc((100%-3rem)/4.5)] xl:w-[calc((100%-5rem)/6.2)] 2xl:w-[calc((100%-7rem)/7.5)] card-hover-trigger"
                >
                  <div
                    onClick={() => onSelectMovie(movie)}
                    className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-[#151515] border border-white/5 active:scale-95 shadow-xl transition-all duration-300 md:group-hover:border-red-500/50 md:group-hover:shadow-[0_0_20px_rgba(220,38,38,0.3)]"
                  >
                    <OptimizedImage
                      src={movie.poster || movie.backdrop || undefined}
                      alt={movie.title}
                      className="w-full h-full object-cover transition-transform duration-500 ease-out md:group-hover:scale-110"
                      quality="medium"
                    />

                    {/* Ranking number overlay */}
                    <div className="absolute top-1.5 left-1.5 z-20 w-8 h-8 rounded-md bg-black/90 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-2xl">
                      <span
                        className={`text-[12px] font-black ${rank <= 3 ? "text-red-500" : "text-white"}`}
                      >
                        #{rank}
                      </span>
                    </div>

                    <div className="absolute top-1.5 right-1.5 z-20 flex flex-col items-end gap-1">
                      {/* Rating & Viewer Count */}
                      {movie.status !== "coming_soon" && (
                        <div className="flex items-center justify-center px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm shadow-lg shadow-black/40 text-[8px] sm:text-[10px] font-semibold text-yellow-400 border border-white/10 shrink-0">
                          <Star className="w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 text-yellow-500 fill-yellow-500 shrink-0 mr-1" />
                          <span className="shrink-0">{movie.rating}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-col items-start px-0.5 transition-opacity duration-300">
                    <h4
                      className="notranslate text-[11px] md:text-[13px] font-bold text-white/90 line-clamp-1 leading-tight text-left"
                      translate="no"
                    >
                      {movie.title}
                    </h4>
                    <span className="text-[9px] md:text-[10px] text-white/50 font-medium uppercase tracking-widest mt-0.5 text-left line-clamp-1">
                      {movie.year || movie.releaseDate?.split("-")[0]}{" "}
                      {movie.type === "tv" ? `• TV` : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </ScrollCarousel>
        </div>
      </div>
    </section>
  );
}

// Reusable section block (for filter results)
function SectionBlock({
  title,
  count,
  showFilters,
  setShowFilters,
  selectedGenres,
  setSelectedGenres,
  sortBy,
  setSortBy,
  allGenres,
  onReset,
  hasReset = false,
}: {
  title: string;
  count: number;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  selectedGenres: string[];
  setSelectedGenres: (g: string[]) => void;
  sortBy: string;
  setSortBy: (s: any) => void;
  allGenres: string[];
  onReset: () => void;
  hasReset?: boolean;
}) {
  return (
    <div className="mb-8 pl-4 lg:pl-8">
      <SectionHeader
        title={title}
        description=""
        count={count}
        accent="from-white/10 to-transparent"
      />
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
            showFilters ||
            selectedGenres.length > 0 ||
            sortBy !== "latest_upload"
              ? "bg-red-600 border-red-500 text-white"
              : "bg-white/5 border-white/10 text-white/60 hover:text-white"
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters & Sort
          {(selectedGenres.length > 0 || sortBy !== "latest_upload") && (
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          )}
        </button>

        {hasReset && (
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-white/40 hover:text-white transition-all hover:bg-white/10"
          >
            <X className="w-4 h-4" />
            Reset
          </button>
        )}
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="py-6 space-y-6 pt-4">
              {/* Sort By Section */}
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30 block mb-3">
                  Sort By
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    {
                      id: "latest_upload",
                      label: "Latest Upload",
                      icon: Clock,
                    },
                    { id: "latest", label: "Release Date", icon: Calendar },
                    { id: "oldest", label: "Oldest", icon: History },
                    { id: "rating", label: "Top Rating", icon: Star },
                    { id: "year", label: "Year", icon: Calendar },
                    { id: "new", label: "New Status", icon: Flame },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSortBy(s.id)}
                      className={`px-4 py-2 rounded-xl text-[11px] font-semibold uppercase tracking-widest transition-all flex items-center gap-2 ${
                        sortBy === s.id
                          ? "bg-red-600 text-white shadow-lg shadow-red-900/40"
                          : "bg-white/5 text-white/40 border border-white/10 hover:text-white"
                      }`}
                    >
                      <s.icon
                        className={`w-3.5 h-3.5 ${sortBy === s.id ? "fill-white" : ""}`}
                      />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Genre Selection Section */}
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30 block mb-3">
                  Multi-select Genres
                </span>
                <div className="flex flex-wrap gap-2">
                  {allGenres
                    .filter((g) => g !== "All")
                    .map((genre) => {
                      const isActive = selectedGenres.includes(genre);
                      return (
                        <button
                          key={genre}
                          onClick={() => {
                            if (isActive) {
                              setSelectedGenres(
                                selectedGenres.filter((g) => g !== genre),
                              );
                            } else {
                              setSelectedGenres([...selectedGenres, genre]);
                            }
                          }}
                          className={`px-4 py-2 rounded-xl text-[11px] font-semibold uppercase tracking-widest transition-all flex items-center gap-2 ${
                            isActive
                              ? "bg-red-600 text-white shadow-lg shadow-red-900/20"
                              : "bg-white/5 text-white/40 border border-white/10 hover:text-white"
                          }`}
                        >
                          {isActive && <Check className="w-3 h-3" />}
                          {genre}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
        <Search className="w-8 h-8 text-white/20" />
      </div>
      <h3 className="text-lg font-bold text-white/60 mb-2">No results found</h3>
      <p className="text-sm text-white/30">Try another keyword or filter</p>
    </div>
  );
}
