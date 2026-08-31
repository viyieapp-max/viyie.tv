import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeft, 
  Bell, 
  Filter,
  ChevronDown, 
  CheckCircle2, 
  Trash2,
  Clock,
  Calendar,
  MessageCircle,
  AlertCircle,
  Sparkles
} from "lucide-react";
import { BRAND_LOGO_URL } from "../constants/brand";
import { useSettings } from "../hooks/useSettings";
import { db, collection, getDocs, query, orderBy } from "../lib/firebase";
import { useUserData } from "../hooks/useUserData";
import { useContent } from "../hooks/useContent";

interface Notification {
  id: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  image?: string;
  link?: string;
  type: "system" | "reminder" | "new_content" | "private" | "viyie_plus" | "movie_soon";
  refId?: string;
  userId?: string;
}

export function NotificationUser({ onBack, onSelectContent }: { onBack: () => void; onSelectContent?: (id: string) => void }) {
  const { settings } = useSettings();
  const { user } = useUserData();
  const { contents } = useContent();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Local storage keys for personalization
  const READ_STORAGE_KEY = `read_notifications_${user?.uid || "guest"}`;
  const DELETED_STORAGE_KEY = `deleted_notifications_${user?.uid || "guest"}`;

  useEffect(() => {
    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "notifications"), orderBy("date", "desc"));
        const snap = await getDocs(q);
        
        const readIds = JSON.parse(localStorage.getItem(READ_STORAGE_KEY) || "[]");
        const deletedIds = JSON.parse(localStorage.getItem(DELETED_STORAGE_KEY) || "[]");
        
        const now = Date.now();
        const expiryTime = 5 * 24 * 60 * 60 * 1000; // 5 days

        const list: Notification[] = [];
        snap.forEach(d => {
          const data = d.data() as Notification;
          const notifDate = new Date(data.date).getTime();
          
          // Conditions: 
          // 1. Is broadast (no userId) OR Is private for this user
          // 2. Is NOT expired (5 days) (except private ones, they stay longer)
          // 3. Is NOT deleted by user
          
          const isBroadcast = !data.userId;
          const isForMe = data.userId && user && data.userId === user.uid;
          const isExpired = (now - notifDate) > expiryTime;

          if ((isBroadcast || isForMe) && (!isExpired || isForMe) && !deletedIds.includes(d.id)) {
            list.push({
              ...data,
              id: d.id,
              read: readIds.includes(d.id)
            });
          }
        });

        // Inject dynamic notifications for reserved coming_soon movies
        const reserved = JSON.parse(localStorage.getItem(`reserved_movies`) || "[]");
        contents.forEach((content: any) => {
          if (reserved.includes(content.id) && content.status !== "coming_soon") {
            const dynamicId = `reserved_notif_${content.id}`;
            if (!deletedIds.includes(dynamicId)) {
              list.push({
                id: dynamicId,
                title: "Your Reservation is Available!",
                message: `Good news! ${content.title} is now available to watch.`,
                date: content.createdAt || new Date("2024-01-01").toISOString(),
                read: readIds.includes(dynamicId),
                type: "new_content",
                image: content.poster,
                refId: String(content.id)
              });
            }
          }
        });
        
        setNotifications(list);
      } catch (err: any) {
        console.error("Fetch notifications error:", err);
        setError("Failed to load notifications from cloud.");
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [user, contents, READ_STORAGE_KEY, DELETED_STORAGE_KEY]);

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      return sortBy === "newest" ? timeB - timeA : timeA - timeB;
    });
  }, [notifications, sortBy]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string | undefined) => {
    if (!id) return;
    const readIds = JSON.parse(localStorage.getItem(READ_STORAGE_KEY) || "[]");
    if (!readIds.includes(id)) {
      const newReadIds = [...readIds, id];
      try {
        localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(newReadIds));
      } catch(e) {}
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }
  };

  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id);
    const existingRead = JSON.parse(localStorage.getItem(READ_STORAGE_KEY) || "[]");
    const merged = Array.from(new Set([...existingRead, ...allIds]));
    try {
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(merged));
    } catch(e) {}
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    const deletedIds = JSON.parse(localStorage.getItem(DELETED_STORAGE_KEY) || "[]");
    const newDeletedIds = [...deletedIds, id];
    try {
      localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(newDeletedIds));
    } catch(e) {}
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    if (confirm("Clear all notifications from your inbox?")) {
      const allIds = notifications.map(n => n.id);
      const existingDeleted = JSON.parse(localStorage.getItem(DELETED_STORAGE_KEY) || "[]");
      const merged = Array.from(new Set([...existingDeleted, ...allIds]));
      try {
        localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(merged));
      } catch(e) {}
      setNotifications([]);
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      markAsRead(id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="min-h-screen bg-[#000000] pt-24 px-4 sm:px-6 lg:px-8 pb-16 relative z-[60]"
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b border-white/5 pb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={onBack}
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all active:scale-95"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h1 className="text-3xl md:text-4xl font-medium text-white uppercase tracking-tighter flex items-center gap-4">
                Notifications
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-medium tracking-widest animate-pulse">
                    {unreadCount} NEW
                  </span>
                )}
              </h1>
            </div>
            <p className="text-[11px] text-white/40 font-medium uppercase tracking-widest ml-13">
              Stay updated with your activities
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
               onClick={clearAllNotifications}
               disabled={notifications.length === 0}
               className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-red-400 hover:bg-red-400/10 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All
            </button>

            <button
               onClick={markAllAsRead}
               disabled={unreadCount === 0}
               className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              Mark All as Read
            </button>

            <div className="relative">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all text-[10px] font-medium uppercase tracking-widest"
              >
                <Filter className="w-3.5 h-3.5 text-red-500" />
                Sort: {sortBy === "newest" ? "Newest" : "Oldest"}
                <ChevronDown className={`w-3 h-3 transition-transform ${showSortDropdown ? "rotate-180" : ""}`} />
              </button>
              
              <AnimatePresence>
                {showSortDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowSortDropdown(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 top-full mt-2 w-40 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-20 py-1 overflow-hidden"
                    >
                      {[
                        { id: "newest", label: "Newest" },
                        { id: "oldest", label: "Oldest" }
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => {
                            setSortBy(opt.id as any);
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

        <div className="space-y-4">
          {loading ? (
            <div className="py-20 text-center space-y-6">
              <div className="w-16 h-16 border-2 border-red-500/20 border-t-red-500 rounded-full animate-spin mx-auto" />
              <p className="text-white/30 text-[10px] font-black uppercase tracking-widest animate-pulse">Syncing broadcasts...</p>
            </div>
          ) : error ? (
            <div className="py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <div className="space-y-1">
                <p className="text-white/60 text-sm font-black uppercase tracking-tighter">{error}</p>
                <p className="text-white/30 text-[10px] font-medium uppercase tracking-widest">Connect to cloud failed</p>
              </div>
            </div>
          ) : sortedNotifications.length === 0 ? (
            <div className="py-20 text-center space-y-4">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                <Bell className="w-8 h-8 text-white/10" />
              </div>
              <p className="text-white/30 text-xs font-black uppercase tracking-widest">No notifications yet</p>
            </div>
          ) : (
            sortedNotifications.map((notif) => (
              <motion.div
                key={notif.id}
                layout
                className={`group relative overflow-hidden rounded-[2rem] border transition-all duration-500 ${
                  notif.read 
                    ? "bg-white/[0.02] border-white/5 opacity-80" 
                    : "bg-gradient-to-br from-red-600/10 to-transparent border-red-500/20 shadow-xl shadow-red-900/10"
                }`}
              >
                {!notif.read && (
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
                )}
                
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 cursor-pointer" onClick={() => toggleExpand(notif.id)}>
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                        notif.type === "movie_soon"
                          ? "bg-purple-600/20 text-purple-400 group-hover:bg-purple-600/30 transition-colors"
                          : notif.type === "new_content" 
                          ? "bg-red-600/20 text-red-500" 
                          : notif.type === "reminder" 
                            ? "bg-blue-600/20 text-blue-500" 
                            : "bg-orange-600/20 text-orange-500"
                      }`}>
                        {notif.type === "movie_soon" ? (
                          <Sparkles className="w-5 h-5 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
                        ) : notif.type === "new_content" ? (
                          <Calendar className="w-5 h-5" />
                        ) : notif.type === "reminder" ? (
                          <Clock className="w-5 h-5" />
                        ) : (
                          <MessageCircle className="w-5 h-5" />
                        )}
                      </div>
                       <div className="space-y-1 pr-6 flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className={`text-sm md:text-base font-medium uppercase tracking-tight ${notif.read ? "text-white/60" : "text-white"}`}>
                            {notif.title}
                          </h3>
                          {!notif.read && (
                            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                          )}
                        </div>
                        {notif.type !== "new_content" && notif.type !== "movie_soon" && (
                          <p className={`text-[11px] md:text-xs font-medium leading-relaxed line-clamp-2 ${notif.read ? "text-white/40" : "text-white/70"}`}>
                            {notif.message}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                           <span className="text-[10px] text-white/30 font-black uppercase tracking-widest flex items-center gap-1">
                             <Clock className="w-3 h-3" />
                             {(() => {
                               const d = new Date(notif.date);
                               const day = String(d.getDate()).padStart(2, '0');
                               const month = String(d.getMonth() + 1).padStart(2, '0');
                               const year = String(d.getFullYear()).slice(-2);
                               return `${day}/${month}/${year}`;
                             })()}
                           </span>
                           {notif.type !== "new_content" && notif.type !== "movie_soon" && (
                             <button 
                               onClick={(e) => { e.stopPropagation(); toggleExpand(notif.id); }}
                               className="text-[10px] text-red-500 font-medium uppercase tracking-widest hover:underline"
                             >
                               {expandedId === notif.id ? "Close Details" : "Read More"}
                             </button>
                           )}
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => deleteNotification(notif.id)}
                      className="p-2 rounded-xl bg-white/5 border border-white/5 text-white/20 hover:text-red-500 hover:bg-red-500/10 transition-all active:scale-90"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <AnimatePresence>
                    {expandedId === notif.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="pt-6 mt-6 border-t border-white/5 space-y-6">
                          <p className="text-sm text-white/60 leading-relaxed font-medium">
                            {notif.message}
                          </p>
                          
                          {notif.image && (
                            <div className="w-full rounded-2xl overflow-hidden bg-black/40 border border-white/10 group-hover:border-red-500/30 transition-colors flex justify-center">
                              <img 
                                src={notif.image} 
                                alt={notif.title} 
                                className="max-w-full h-auto object-contain rounded-xl" 
                              />
                            </div>
                          )}
                          
                          <div className="flex flex-wrap gap-3">
                            {(notif.type === "new_content" || notif.type === "movie_soon") && notif.refId && (
                              <button 
                                onClick={() => onSelectContent?.(notif.refId!)}
                                className="px-6 py-2 rounded-xl bg-red-600 text-white text-[10px] font-medium uppercase tracking-widest hover:bg-red-500 transition-all shadow-lg shadow-red-900/40"
                              >
                                View Content
                              </button>
                            )}
                            {notif.link && (
                              <a 
                                href={notif.link}
                                target={notif.link.startsWith("http") ? "_blank" : "_self"}
                                rel="noreferrer"
                                className="px-6 py-2 rounded-xl bg-white/10 text-white text-[10px] font-medium uppercase tracking-widest hover:bg-white/20 transition-all border border-white/5 flex items-center gap-2"
                              >
                                Open Link
                              </a>
                            )}
                            <button 
                              onClick={() => toggleExpand(notif.id)}
                              className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 text-[10px] font-medium uppercase tracking-widest hover:text-white transition-all"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Decorative glow for unread */}
                {!notif.read && (
                  <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />
                )}
              </motion.div>
            ))
          )}
        </div>

        <div className="mt-12 flex justify-center opacity-40">
          <img src={settings?.brandLogo || BRAND_LOGO_URL} alt="Logo" className="h-6 filter grayscale brightness-200" />
        </div>
      </div>
    </motion.div>
  );
}
