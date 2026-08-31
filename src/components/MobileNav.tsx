/**
 * Ultra-lightweight mobile navbar.
 * No framer-motion, no spring animations — pure CSS only.
 */
import { useState, useRef, useEffect } from "react";
import {
  Search,
  X,
  Menu,
  Heart,
  Bookmark,
  History,
  MonitorPlay,
  Check,
  Film,
  Tv,
  Calendar,
  Play,
  Trash,
  Upload,
  Music,
  Pause,
  ShieldCheck,
  Bell,
  Layers,
  Crown,
  ChevronDown,
  Filter,
} from "lucide-react";
import { BRAND_LOGO_URL, BRAND_NAME } from "../constants/brand";
import { useUserData } from "../hooks/useUserData";
import { useSettings } from "../hooks/useSettings";
import { LanguageSwitcher } from "./UIComponents";
import { saveTrack, deleteTrack } from "../utils/musicDb";

interface Props {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeTab: string;
  setActiveTab: (t: string) => void;
  selectedGenres: string[];
  setSelectedGenres: (g: string[]) => void;
  allGenres: string[];
  isMusicPlaying: boolean;
  onToggleMusic: () => void;
  computedIsUserAdmin: boolean;
  isStreaming?: boolean;
  isHidden?: boolean;
  unreadNotifsCount?: number;
  tracks?: { id?: string; title: string; url: string; isCustom: boolean }[];
  setCustomTracks?: React.Dispatch<React.SetStateAction<any[]>>;
  activeTrackIndex?: number;
  setActiveTrackIndex?: (idx: number) => void;
  onNavigateAway?: (targetPath?: string) => void;
  onNavigate?: (path: string) => void;
  onMenuToggle?: (open: boolean) => void;
}

export default function MobileNav({
  searchQuery,
  setSearchQuery,
  activeTab,
  setActiveTab,
  selectedGenres,
  setSelectedGenres,
  allGenres,
  isMusicPlaying,
  onToggleMusic,
  computedIsUserAdmin,
  isStreaming,
  isHidden,
  unreadNotifsCount = 0,
  tracks = [],
  setCustomTracks,
  activeTrackIndex = 0,
  setActiveTrackIndex,
  onNavigateAway,
  onNavigate,
  onMenuToggle,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [musicMenuOpen, setMusicMenuOpen] = useState(false);
  const [musicSettingsOpen, setMusicSettingsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { favorites, myList, history, user, openAuth, signOut } = useUserData();
  const { settings } = useSettings();
  const [isScrolled, setIsScrolled] = useState(false);
  const [showAllGenresMobile, setShowAllGenresMobile] = useState(false);
  const visibleGenres = allGenres.filter(g => !settings?.hiddenGenres?.includes(g));

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initialize on mount
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const hasAnnouncement =
    settings?.systemNotificationActive && settings?.systemNotification;
  const topOffset = hasAnnouncement ? 32 : 0;

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.height = "100vh";
      document.documentElement.style.overflow = "hidden";
      onMenuToggle?.(true);
    } else {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.documentElement.style.overflow = "";
      onMenuToggle?.(false);
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.documentElement.style.overflow = "";
    };
  }, [menuOpen]);

  const openSearch = () => {
    setMenuOpen(false);
    setSearchOpen(true);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
  };

  const navTabs = [
    { id: "home", label: "Home", icon: MonitorPlay, badge: 0 },
    { id: "movie", label: "Movies", icon: Film, badge: 0 },
    { id: "tv", label: "TV", icon: Tv, badge: 0 },
    { id: "network", label: "Network", icon: Layers, badge: 0 },
    { id: "upcoming", label: "Soon", icon: Calendar, badge: 0 },
    { id: "genre", label: "Genres", icon: Filter, badge: 0 },
    { id: "musicmenu", label: "Music", icon: Music, badge: 0 },
  ];
  const libraryTabs = [
    { id: "mylist", label: "Watch List", icon: Bookmark, badge: myList.length },
    {
      id: "favorites",
      label: "Favorites",
      icon: Heart,
      badge: favorites.length,
    },
    { id: "history", label: "History", icon: History, badge: history.length },
  ];

  const isGenreActive = selectedGenres.length > 0;

  return (
    <>
      {/* Main bar */}
      <div 
        className={`fixed left-0 right-0 top-0 h-24 pointer-events-none z-[249] transition-opacity duration-300 ${isScrolled || menuOpen || searchOpen ? "opacity-0" : "opacity-100 bg-gradient-to-b from-black/80 via-black/40 to-transparent"}`}
      />
      <nav
        className={`fixed left-0 right-0 z-[250] transition-all duration-300 ${isStreaming ? "drop-shadow-2xl" : ""} ${isHidden ? "pointer-events-none" : ""} ${isScrolled || menuOpen || searchOpen ? "backdrop-blur-md" : ""}`}
        style={{
          top: topOffset,
          transform: isHidden ? "translateY(-110%)" : "translateY(0)",
          overflow: menuOpen ? "visible" : "hidden",
          background: menuOpen || searchOpen || isScrolled ? "rgba(7,4,4,0.95)" : "transparent",
          borderBottom: menuOpen || searchOpen || isScrolled ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
        }}
      >
        <div
          className="flex items-center justify-between animate-fade-in"
          style={{
            height: "2.75rem",
            padding: "0 0.75rem",
          }}
        >
          {/* Left Side: Back button removed & Logo */}
          <div className="flex items-center gap-2">
            <div
              onClick={() => {
                setActiveTab("home");
                onNavigateAway?.("/home");
                closeSearch();
                window.history.pushState({}, "", "/home");
                window.dispatchEvent(new PopStateEvent("popstate"));
                onNavigate?.("/home");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="cursor-pointer transition-all active:scale-95"
            >
              <img
                src={settings?.brandLogo || BRAND_LOGO_URL}
                alt={BRAND_NAME}
                className="h-5 w-auto object-contain drop-shadow-[0_4px_10px_rgba(220,38,38,0.4)]"
                draggable={false}
              />
            </div>
          </div>{" "}
          {/* Right icons */}
          <div
            className={`flex items-center gap-0.5 ${isStreaming ? "drop-shadow-lg" : ""}`}
          >
            <button
              onClick={() => {
                window.history.pushState({}, "", "/notifuser");
                window.dispatchEvent(new PopStateEvent("popstate"));
                setMenuOpen(false);
                closeSearch();
                onNavigate?.("/notifuser");
              }}
              className="relative w-8 h-8 flex items-center justify-center rounded-full text-white hover:text-red-500 transition-all active:scale-90"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-black ring-1 ring-red-500/50 animate-pulse" />
              )}
            </button>
            <button
              onClick={openSearch}
              className={`w-8 h-8 flex items-center justify-center rounded-full text-white hover:text-red-500 transition-all active:scale-90 ${isStreaming ? "opacity-30 cursor-not-allowed pointer-events-none" : ""}`}
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setMenuOpen((v) => !v);
                setSearchOpen(false);
              }}
              className="w-8 h-8 flex items-center justify-center rounded-full text-white hover:text-red-500 transition-all active:scale-90"
            >
              {menuOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <div
            className="px-4 pb-4 flex items-center gap-2"
            style={{ background: "#050505" }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search movie, genre, year..."
                className="w-full h-10 pl-9 pr-9 rounded-xl text-sm text-white placeholder:text-white/35 focus:outline-none"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-white/40"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={closeSearch}
              className="text-sm text-red-500 font-medium shrink-0"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Mobile menu */}
        {menuOpen && (
          <div
            className="pb-32 px-4 space-y-4 overflow-y-auto overscroll-contain touch-auto"
            style={{
              background: "#050505",
              borderTop: "1px solid rgba(255,255,255,0.05)",
              maxHeight: "calc(100vh - 3.5rem)",
            }}
          >
            {musicMenuOpen ? (
              <div className="bg-black/40 border border-white/5 rounded-2xl p-4 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-medium text-white flex items-center gap-2">
                    <Music className="w-4 h-4 text-red-500" />
                    {musicSettingsOpen ? "Manage Music" : "Music Session"}
                  </h3>
                  <button
                    onClick={() => setMusicSettingsOpen(!musicSettingsOpen)}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors text-[10px]"
                  >
                    {musicSettingsOpen ? "Go Back" : "Upload Custom"}
                  </button>
                </div>

                {!musicSettingsOpen ? (
                  <div className="space-y-3">
                    <div className="max-h-32 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
                      {tracks.map((t, idx) => (
                        <button
                          key={t.id || idx}
                          onClick={() => {
                            if (activeTrackIndex === idx) {
                              onToggleMusic();
                            } else {
                              if (setActiveTrackIndex) setActiveTrackIndex(idx);
                              if (!isMusicPlaying) onToggleMusic();
                            }
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs transition-all ${
                            activeTrackIndex === idx
                              ? "bg-red-600 border border-red-500 shadow-md shadow-red-900/20 text-white"
                              : "bg-white/5 border border-white/5 hover:bg-white/10 text-white/70"
                          }`}
                        >
                          <span className="truncate pr-2 font-medium">
                            #{idx + 1} {t.title}
                          </span>
                          {activeTrackIndex === idx && isMusicPlaying && (
                            <div className="flex items-end gap-0.5 shrink-0 h-3">
                              <span
                                className="w-0.5 bg-white animate-pulse"
                                style={{
                                  height: "100%",
                                  animationDelay: "0ms",
                                }}
                              />
                              <span
                                className="w-0.5 bg-white animate-pulse"
                                style={{
                                  height: "60%",
                                  animationDelay: "150ms",
                                }}
                              />
                              <span
                                className="w-0.5 bg-white animate-pulse"
                                style={{
                                  height: "80%",
                                  animationDelay: "300ms",
                                }}
                              />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={onToggleMusic}
                      className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-medium uppercase tracking-widest transition-all ${isMusicPlaying ? "bg-white/5 border border-white/10 text-white hover:bg-white/10" : "bg-red-600 text-white shadow-lg"}`}
                    >
                      {isMusicPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      {isMusicPlaying ? "Pause Music" : "Play Music"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="audio/mp3,audio/wav,audio/ogg"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file && user && setCustomTracks) {
                              const saved = await saveTrack(file.name, file);
                              if (saved) {
                                setCustomTracks((prev) => [...prev, saved]);
                              }
                            }
                          }}
                        />
                        <div className="flex flex-col items-center justify-center gap-2 text-white/50 hover:text-white transition-colors">
                          <Upload className="w-6 h-6 mb-1" />
                          <span className="text-xs font-semibold">
                            Select MP3/WAV Audio
                          </span>
                          <span className="text-[9px] text-white/30">
                            Files are stored locally in IndexedDB
                          </span>
                        </div>
                      </label>
                    </div>
                    {tracks.filter((t) => t.isCustom).length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase font-medium text-white/30 mb-2 tracking-widest">
                          Your Uploads
                        </p>
                        {tracks.map(
                          (t, idx) =>
                            t.isCustom && (
                              <div
                                key={t.id || idx}
                                className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg border border-white/5 text-xs"
                              >
                                <span className="truncate text-white/70 flex-1 pr-2">
                                  {t.title}
                                </span>
                                <button
                                  onClick={async () => {
                                    if (t.id && setCustomTracks) {
                                      await deleteTrack(t.id);
                                      setCustomTracks((prev) =>
                                        prev.filter((p) => p.id !== t.id),
                                      );
                                    }
                                  }}
                                  className="p-1 hover:bg-red-500/20 text-red-500 rounded transition-colors"
                                >
                                  <Trash className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ),
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            {/* Nav tabs */}
            <div className="grid grid-cols-3 gap-2">
              {navTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (tab.id === "musicmenu") {
                        setMusicMenuOpen(!musicMenuOpen);
                        setMusicSettingsOpen(false);
                        return;
                      }
                      const tabPaths: Record<string, string> = {
                        home: "/home",
                        movie: "/movies",
                        tv: "/tv",
                        network: "/network",
                        upcoming: "/soon",
                        genre: "/genre",
                      };
                      const targetPath = tabPaths[tab.id] || "/home";
                      setActiveTab(tab.id);
                      onNavigateAway?.(targetPath);
                      setMenuOpen(false);
                      closeSearch();
                      if (window.location.pathname !== targetPath) {
                        window.history.pushState({}, "", targetPath);
                        window.dispatchEvent(new PopStateEvent("popstate"));
                        onNavigate?.(targetPath);
                      }
                    }}
                    className={`relative flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all active:scale-95 hover:bg-white/35 ${isActive ? "font-medium" : "hover:text-white hover:drop-shadow-[0_0_6px_rgba(220,38,38,0.9)] hover:shadow-[0_0_10px_rgba(220,38,38,0.5)]"}`}
                    style={{
                      background: isActive
                        ? "rgba(220,0,0,0.25)"
                        : "rgba(255,255,255,0.06)",
                      border: isActive
                        ? "1px solid rgba(220,0,0,0.5)"
                        : "1px solid rgba(255,255,255,0.1)",
                      color: "#fff",
                      textShadow: isActive
                        ? "0 0 12px rgba(220,38,38,0.75)"
                        : "none",
                    }}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {tab.badge > 0 && (
                      <span className="absolute top-1.5 right-2 min-w-[15px] h-[15px] rounded-full text-[9px] font-medium flex items-center justify-center bg-red-600 text-white px-1">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Genre section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                  Genre Multi-select
                </span>
                {isGenreActive && (
                  <button
                    onClick={() => setSelectedGenres([])}
                    className="text-[10px] text-orange-400 font-medium uppercase tracking-widest flex items-center gap-1"
                  >
                    <X className="w-2.5 h-2.5" />
                    reset
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {visibleGenres
                  .filter((g) => g !== "All")
                  .slice(0, showAllGenresMobile ? undefined : 10)
                  .map((g) => {
                    const active = selectedGenres.includes(g);
                    return (
                      <button
                        key={g}
                        onClick={() => {
                          if (active) {
                            setSelectedGenres([]);
                          } else {
                            setSelectedGenres([g]);
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all flex items-center gap-1.5 border"
                        style={{
                          background: active
                            ? "linear-gradient(to right, #dc2626, #f97316)"
                            : "rgba(255,255,255,0.04)",
                          borderColor: active
                            ? "transparent"
                            : "rgba(255,255,255,0.06)",
                          color: active ? "#fff" : "rgba(255,255,255,0.5)",
                        }}
                      >
                        {active && <Check className="w-3 h-3" />}
                        {g}
                      </button>
                    );
                  })}
              </div>
              {!showAllGenresMobile && visibleGenres.filter(g => g !== "All").length > 10 && (
                <button
                  onClick={() => setShowAllGenresMobile(true)}
                  className="w-full mt-2 py-2 flex items-center justify-center gap-2 text-[10px] font-medium text-white/50 hover:text-white uppercase tracking-wider bg-white/5 rounded-xl border border-dashed border-white/10"
                >
                  Show more genre <ChevronDown className="w-3 h-3" />
                </button>
              )}
              {showAllGenresMobile && (
                <button
                  onClick={() => setShowAllGenresMobile(false)}
                  className="w-full mt-2 py-2 flex items-center justify-center gap-2 text-[10px] font-medium text-white/50 hover:text-white uppercase tracking-wider bg-white/5 rounded-xl border border-dashed border-white/10"
                >
                  Show less <ChevronDown className="w-3 h-3 rotate-180" />
                </button>
              )}
            </div>

            {/* Account / Library section */}
            <div
              className="pt-3 border-t space-y-2"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-widest text-white/40">
                  Account
                </span>
                <button
                  onClick={() => {
                    if (user) {
                      signOut();
                    } else {
                      setMenuOpen(false);
                      openAuth();
                      onNavigate?.("/login");
                    }
                  }}
                  className="text-[10px] text-orange-400 font-semibold px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20"
                >
                  {user ? "Sign out" : "Sign In / Sign Up"}
                </button>
              </div>
              {user && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    closeSearch();
                    window.history.pushState({}, "", `/profile/${user.uid}`);
                    window.dispatchEvent(new PopStateEvent("popstate"));
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/5 border border-white/10 text-left hover:bg-white/10 transition-colors"
                >
                  {user.picture && (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="w-7 h-7 rounded-full"
                    />
                  )}
                  <div className="min-w-0">
                    <p
                      className="notranslate text-xs font-medium text-white truncate"
                      translate="no"
                    >
                      {user.name}
                    </p>
                    <p
                      className="notranslate text-[10px] text-white/35 truncate"
                      translate="no"
                    >
                      {user.email || user.provider}
                    </p>
                  </div>
                </button>
              )}

              {/* Action Links */}
              <div className="flex items-center justify-between gap-2 mt-2 py-1">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    closeSearch();
                    window.history.pushState({}, "", "/needhelp");
                    window.dispatchEvent(new PopStateEvent("popstate"));
                    onNavigate?.("/needhelp");
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors text-[10px] font-medium text-white/80"
                >
                  Need Help?
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    closeSearch();
                    window.history.pushState({}, "", "/reportbug");
                    window.dispatchEvent(new PopStateEvent("popstate"));
                    onNavigate?.("/reportbug");
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors text-[10px] font-medium text-white/80"
                >
                  Report a Bug
                </button>
              </div>

              {/* Viyie+ Premium Subscription Button */}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  closeSearch();
                  window.history.pushState({}, "", "/subsviyie");
                  window.dispatchEvent(new PopStateEvent("popstate"));
                  onNavigate?.("/subsviyie");
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-yellow-500/10 bg-yellow-500/5 text-yellow-500 hover:text-[#f59e0b] hover:bg-yellow-500/10 hover:border-yellow-500/25 transition-all text-left font-medium text-xs"
              >
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-yellow-500 animate-pulse" />
                  <span>VIYIE+ Subscription</span>
                </div>
                {(user?.tiers || [user?.tier || "regular"]).includes(
                  "viyie_plus",
                ) && (
                  <div className="text-[9px] bg-yellow-500/35 text-yellow-400 px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider font-medium">
                    ACTIVE
                  </div>
                )}
              </button>

              <button
                onClick={() => onToggleMusic?.()}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all text-sm font-medium"
              >
                {isMusicPlaying ? (
                  <Pause className="w-4 h-4 text-orange-500" />
                ) : (
                  <Music className="w-4 h-4" />
                )}
                <span>
                  {isMusicPlaying
                    ? "Pause Background Music"
                    : "Play Background Music"}
                </span>
              </button>

              {computedIsUserAdmin && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    closeSearch();
                    window.history.pushState({}, "", "/adminfirefury");
                    window.dispatchEvent(new PopStateEvent("popstate"));
                    onNavigate?.("/adminfirefury");
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black text-white bg-red-600 shadow-lg shadow-red-900/40 uppercase tracking-widest mt-3 transition-all active:scale-95"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Admin Panel
                </button>
              )}
              <div className="grid grid-cols-3 gap-2 mt-2">
                {libraryTabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        onNavigateAway?.("/");
                        setMenuOpen(false);
                        closeSearch();
                        window.history.pushState({}, "", "/");
                        window.dispatchEvent(new PopStateEvent("popstate"));
                        onNavigate?.("/");
                      }}
                      className="relative flex flex-col items-center gap-1 py-2.5 rounded-xl text-[11px] font-semibold transition-colors"
                      style={{
                        background: isActive
                          ? "rgba(220,38,38,0.15)"
                          : "rgba(255,255,255,0.04)",
                        border: isActive
                          ? "1px solid rgba(239,68,68,0.3)"
                          : "1px solid rgba(255,255,255,0.06)",
                        color: isActive ? "#fca5a5" : "rgba(255,255,255,0.6)",
                      }}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                      {tab.badge > 0 && (
                        <span className="absolute top-1.5 right-2 min-w-[15px] h-[15px] rounded-full text-[9px] font-medium flex items-center justify-center bg-red-600 text-white px-1">
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-[10px] font-medium uppercase tracking-widest text-white/40">
                  Language
                </span>
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
