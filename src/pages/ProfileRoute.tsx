import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  Settings, 
  Eye, 
  EyeOff, 
  Heart, 
  Clock, 
  Share2, 
  Image as ImageIcon,
  Check,
  ExternalLink,
  Sparkles,
  Music,
  Play,
  Pause,
  Info,
  MessageSquare,
  BadgeCheck,
  Edit3,
  Crown,
  ShieldCheck,
  Star,
  AlertCircle
} from "lucide-react";
import { useUserData } from "../hooks/useUserData";
import { useContent, type Content } from "../hooks/useContent";
import { db, doc, collection, query, where, getDocs, onSnapshot } from "../lib/firebase";

// Types
export interface ParsedAchievement {
  id: string;
  title: string;
  desc: string;
  icon: any;
  color: string;
  bg: string;
}

// Logic for achievements
function calculateAchievements(user: any, totalMovies: number, totalComments: number): ParsedAchievement[] {
  const achs: ParsedAchievement[] = [];

  // 1. Account Age
  if (user?.createdAt) {
    const createdDate = new Date(user.createdAt);
    const now = new Date();
    const monthsDiff = (now.getFullYear() - createdDate.getFullYear()) * 12 + (now.getMonth() - createdDate.getMonth());
    
    // Check ascending to easily pick the highest tier
    if (monthsDiff >= 48) {
      achs.push({ id: 'age_4y', title: '4 Year Mythic', desc: 'A true legend', icon: Crown, color: 'text-purple-400', bg: 'bg-purple-900/40' });
    } else if (monthsDiff >= 24) {
      achs.push({ id: 'age_2y', title: '2 Year Legend', desc: 'Been here a while', icon: Crown, color: 'text-pink-400', bg: 'bg-pink-900/40' });
    } else if (monthsDiff >= 12) {
      achs.push({ id: 'age_1y', title: '1 Year Veteran', desc: 'Celebrating 1 Year!', icon: BadgeCheck, color: 'text-yellow-400', bg: 'bg-yellow-900/40' });
    } else if (monthsDiff >= 6) {
      achs.push({ id: 'age_6m', title: 'Half Year Hero', desc: '6 months strong', icon: Sparkles, color: 'text-orange-400', bg: 'bg-orange-900/40' });
    } else if (monthsDiff >= 3) {
      achs.push({ id: 'age_3m', title: 'Quarter Year', desc: '90 days milestone', icon: Star, color: 'text-blue-400', bg: 'bg-blue-900/40' });
    }
  }

  // 2. Movies Watched (History length)
  if (totalMovies >= 60) {
    achs.push({ id: 'mov_60', title: 'Grandmaster', desc: '60+ movies watched', icon: Crown, color: 'text-yellow-500', bg: 'bg-yellow-500/20' });
  } else if (totalMovies >= 40) {
    achs.push({ id: 'mov_40', title: 'Film Critic', desc: '40+ movies watched', icon: Eye, color: 'text-emerald-400', bg: 'bg-emerald-500/20' });
  } else if (totalMovies >= 20) {
    achs.push({ id: 'mov_20', title: 'Cinephile', desc: '20+ movies watched', icon: Heart, color: 'text-blue-400', bg: 'bg-blue-500/20' });
  } else if (totalMovies >= 10) {
    achs.push({ id: 'mov_10', title: 'Movie Buff', desc: '10+ movies watched', icon: Clock, color: 'text-orange-400', bg: 'bg-orange-500/20' });
  } else if (totalMovies > 0) {
    achs.push({ id: 'mov_1', title: 'First Watch', desc: 'Started the journey', icon: ExternalLink, color: 'text-gray-400', bg: 'bg-gray-500/20' });
  }

  // 3. Comments Length
  if (totalComments >= 400) {
    achs.push({ id: 'msg_400', title: 'Voice of the People', desc: '400+ comments', icon: MessageSquare, color: 'text-rose-400', bg: 'bg-rose-500/20' });
  } else if (totalComments >= 200) {
    achs.push({ id: 'msg_200', title: 'Community Pillar', desc: '200+ comments', icon: MessageSquare, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/20' });
  } else if (totalComments >= 100) {
    achs.push({ id: 'msg_100', title: 'Discussion Leader', desc: '100+ comments', icon: MessageSquare, color: 'text-cyan-400', bg: 'bg-cyan-500/20' });
  } else if (totalComments >= 50) {
    achs.push({ id: 'msg_50', title: 'Active Commentator', desc: '50+ comments', icon: MessageSquare, color: 'text-sky-400', bg: 'bg-sky-500/20' });
  }

  // 4. Special Tiers
  const tiers = user?.tiers || [];
  if (tiers.includes('viyie_plus')) {
    achs.push({ id: 'tier_viyie_plus', title: 'Diamond Sub', desc: 'Viyie+ Member', icon: Sparkles, color: 'text-yellow-400', bg: 'bg-yellow-400/20' });
  }
  if (tiers.includes('admin') || tiers.includes('owner')) {
    achs.push({ id: 'tier_admin', title: 'System Architect', desc: 'Platform Staff', icon: ShieldCheck, color: 'text-red-500', bg: 'bg-red-500/20' });
  }

  return achs;
}

// Tier Badge Component - Supports multiple badges
const TierBadges = ({ tiers = [], title }: { tiers?: string[], title?: string }) => {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {tiers.map((tier) => {
        if (tier === "owner") {
          return (
            <div key={tier} className="relative group flex items-center justify-center">
              <div className="relative bg-gradient-to-r from-yellow-600/20 to-orange-500/20 p-1.5 px-3 rounded-xl border border-yellow-500/30 backdrop-blur-md shadow-inner flex items-center justify-center gap-1.5">
                <Crown className="w-4 h-4 text-yellow-400 group-hover:scale-110 transition-transform duration-300" />
                <span className="text-yellow-400 text-xs font-black uppercase tracking-widest drop-shadow-md">Owner</span>
              </div>
            </div>
          );
        }

        if (tier === "admin") {
          return (
            <div key={tier} className="relative group flex items-center justify-center">
              <div className="relative bg-gradient-to-r from-red-600/20 to-orange-500/20 p-1.5 px-3 rounded-xl border border-red-500/30 backdrop-blur-md shadow-inner flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-red-400 group-hover:scale-110 transition-transform duration-300" />
                <span className="text-red-400 text-xs font-black uppercase tracking-widest drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">Admin</span>
              </div>
            </div>
          );
        }

        if (tier === "viyie_plus") {
          return (
            <div key={tier} className="relative group flex items-center justify-center">
              <div className="relative bg-gradient-to-r from-[#ffe100]/20 to-[#ff8c00]/20 p-1.5 px-3 rounded-xl border border-[#ffaa00]/30 backdrop-blur-md shadow-inner flex items-center justify-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#ffaa00] group-hover:animate-pulse transition-transform duration-300" />
                <span className="text-[#ffaa00] text-xs font-black uppercase tracking-widest animate-gold-shine">Viyie+</span>
              </div>
            </div>
          );
        }
        
        return null;
      })}
      
      {title && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/20 bg-white/10 backdrop-blur-md text-white shadow-lg text-[10px] font-black uppercase tracking-wider">
          <BadgeCheck className="w-3.5 h-3.5 text-blue-400" />
          {title}
        </div>
      )}
    </div>
  );
};

export function ProfileRoute({ userId, onBack, onSelectMovie }: { userId: string, onBack: () => void, onSelectMovie: (m: Content) => void }) {
  const { user: currentUser, updateProfile, toast } = useUserData();
  const { contents } = useContent();
  const [profileUser, setProfileUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [totalComments, setTotalComments] = useState(0);
  const [userCommentsList, setUserCommentsList] = useState<any[]>([]);
  const [showAllFavorites, setShowAllFavorites] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState("");
  const [showBackdropModal, setShowBackdropModal] = useState(false);
  const [backdropUrlInput, setBackdropUrlInput] = useState("");
  const [backdropError, setBackdropError] = useState("");
  const [backdropScale, setBackdropScale] = useState(100);
  const [backdropPos, setBackdropPos] = useState(50);
  
  const isOwnProfile = currentUser?.uid === userId;

  /*
  const [googleTokens, setGoogleTokens] = useState<any>(() => {
    const saved = localStorage.getItem("google_drive_tokens");
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        const tokens = e.data.tokens;
        setGoogleTokens(tokens);
        localStorage.setItem("google_drive_tokens", JSON.stringify(tokens));
        toast("Google Drive Connected!", "success");
      }
    };
    window.addEventListener("message", handleMsg);
    return () => window.removeEventListener("message", handleMsg);
  }, [toast]);
  */

/* 
  const connectDrive = async () => {
    try {
      const res = await fetch("/api/auth/google/url");
      const { url } = await res.json();
      window.open(url, "google_auth", "width=600,height=700");
    } catch (e) {
      toast("Error connecting Drive", "error");
    }
  };

  const backupToDrive = async () => {
    if (!googleTokens) return connectDrive();
    try {
      toast("Backing up to Drive...", "info");
      const backupData = {
        favorites: displayedUser.favorites || [],
        history: displayedUser.history || [],
        profileSettings: displayedUser.profileSettings || {}
      };
      const res = await fetch("/api/drive/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens: googleTokens, data: backupData })
      });
      const result = await res.json();
      
      let errorString = "";
      try {
        errorString = JSON.stringify(result).toLowerCase();
      } catch (err) {
        errorString = String(result).toLowerCase();
      }
      const isScopeError = errorString.includes("insufficient authentication scopes") || 
                          errorString.includes("insufficient_scope") ||
                          (result && result.error === "insufficient_scope");

      if (res.ok) {
        toast("Backup successful!", "success");
      } else {
        if (isScopeError) {
          setGoogleTokens(null);
          localStorage.removeItem("google_drive_tokens");
          toast("Drive scope changed. Please reconnect Google Drive.", "error");
        } else {
          throw new Error(result.error || "Sync failed");
        }
      }
    } catch (e: any) {
      toast("Backup failed: " + e.message, "error");
    }
  };

  const restoreFromDrive = async () => {
    if (!googleTokens) return connectDrive();
    try {
      toast("Fetching backup...", "info");
      const res = await fetch("/api/drive/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens: googleTokens })
      });
      const result = await res.json();
      
      let errorString = "";
      try {
        errorString = JSON.stringify(result).toLowerCase();
      } catch (err) {
        errorString = String(result).toLowerCase();
      }
      const isScopeError = errorString.includes("insufficient authentication scopes") || 
                          errorString.includes("insufficient_scope") ||
                          (result && result.error === "insufficient_scope");

      if (res.ok) {
        if (result.data) {
          await updateProfile(result.data);
          toast("Data restored from Drive!", "success");
        } else {
          toast("No backup found in your Drive", "info");
        }
      } else {
        if (isScopeError) {
          setGoogleTokens(null);
          localStorage.removeItem("google_drive_tokens");
          toast("Drive scope changed. Please reconnect Google Drive.", "error");
        } else {
          throw new Error(result.error || "Restore failed");
        }
      }
    } catch (e: any) {
      toast("Restore failed: " + e.message, "error");
    }
  };
*/

  useEffect(() => {
    setLoading(true);
    const unsubscribeUser = onSnapshot(doc(db, "users", userId), (snap: any) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfileUser(data);
        if (!bioInput) setBioInput(data.bio || "");
      } else {
        setProfileUser(null);
      }
      setLoading(false);
    }, (error: any) => {
      console.error(error);
      setLoading(false);
    });

    const q = query(collection(db, "comments"), where("uid", "==", userId));
    getDocs(q).then(commentsSnap => {
      setTotalComments(commentsSnap.size);
      setUserCommentsList(commentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => b.createdAt - a.createdAt));
    }).catch(console.error);

    return () => unsubscribeUser();
  }, [userId, currentUser]);

  if (loading) return (
    <div className="min-h-screen bg-[#070404] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  if (!currentUser) return (
    <div className="min-h-screen bg-[#070404] flex flex-col items-center justify-center p-8 text-center text-white">
      <h2 className="text-2xl font-black text-white mb-2">Access Denied</h2>
      <p className="text-white/60 mb-6 font-medium">Please login to view this profile.</p>
      <button onClick={onBack} className="px-6 py-2 bg-orange-600 hover:bg-orange-500 rounded-xl text-sm font-medium text-white transition-colors shadow-lg shadow-orange-900/20">
        Back to Home
      </button>
    </div>
  );

  if (!profileUser) return (
    <div className="min-h-screen bg-[#070404] flex flex-col items-center justify-center p-8 text-center">
      <p className="text-white/40 mb-4 font-medium">User not found</p>
      <button onClick={onBack} className="text-sm font-medium text-orange-500 hover:underline">Back to safety</button>
    </div>
  );
  
  // Use currentUser data if own profile for reactivity, else use profileUser data
  let displayedUser = isOwnProfile ? (currentUser || profileUser) : profileUser;
  
  // Inject owner tier for dev
  if (displayedUser && displayedUser.email === "firefuryggwp@gmail.com") {
    const ts = displayedUser.tiers || [displayedUser.tier || "regular"];
    if (!ts.includes("owner")) {
      displayedUser = { ...displayedUser, tiers: ["owner", ...ts] };
    }
  }

  const favoritesIds = displayedUser?.favorites;
  const historyData = displayedUser?.history;

  const favMovies = contents.filter(c => favoritesIds?.includes(String(c.id)));
  const historyMovies = historyData
    ? historyData
        .slice(0, 5)
        .map((h: any) => contents.find(c => String(c.id) === String(h.movieId)))
        .filter(Boolean)
    : [];

  const handleUpdateSetting = async (key: string, value: any) => {
    if (!isOwnProfile) return;
    const nextSettings = { ...profileUser.profileSettings, [key]: value };
    await updateProfile({ profileSettings: nextSettings });
    setProfileUser({ ...profileUser, profileSettings: nextSettings });
  };

  const submitBackdrop = async () => {
    setBackdropError("");
    let url = backdropUrlInput;
    if (!url) return;
    url = url.trim();

    const lowerUrl = url.toLowerCase();
    const isGifUrl = lowerUrl.includes('.gif');
    if (isGifUrl && !isViyiePlus) {
      setBackdropError("Viyie+ Required. GIF / moving backdrops are exclusive to Viyie+ members.");
      toast("Viyie+ Required. GIF / moving backdrops are exclusive to Viyie+ members.", "error");
      return;
    }
    
    // Auto convert Google drive link to direct image link
    const gDriveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (gDriveMatch && gDriveMatch[1]) {
      url = `https://drive.google.com/uc?id=${gDriveMatch[1]}&export=download`;
    } else if (url.includes("drive.google.com/open?id=")) {
      const id = url.split("id=")[1].split("&")[0];
      url = `https://drive.google.com/uc?id=${id}&export=download`;
    }

    try {
      await updateProfile({ 
        profileBackdrop: url,
        profileBackdropScale: backdropScale,
        profileBackdropPos: backdropPos
      });
      setProfileUser((prev: any) => ({ 
        ...prev, 
        profileBackdrop: url,
        profileBackdropScale: backdropScale,
        profileBackdropPos: backdropPos
      }));
      toast("Backdrop updated successfully!", "success");
      setShowBackdropModal(false);
      setBackdropUrlInput("");
    } catch (e: any) {
      console.error(e);
      toast("Failed to update backdrop: " + e.message, "error");
    }
  };

  const handleUpdateBio = async () => {
    if (!isOwnProfile) return;
    if (bioInput.length > 70) {
      toast("Bio can be at most 70 characters", "error");
      return;
    }
    await updateProfile({ bio: bioInput });
    setProfileUser({ ...profileUser, bio: bioInput });
    setIsEditingBio(false);
  };

  const isViyiePlus = (displayedUser.tiers || [displayedUser.tier || "regular"]).includes("viyie_plus");
  const userAchievements = calculateAchievements(displayedUser, displayedUser?.history?.length || 0, totalComments);

  return (
    <div className="min-h-screen bg-[#070404] text-white pb-24">
      {/* Backdrop - Adjusted to 16:7 Aspect Ratio */}
      <div className="relative aspect-[16/7] w-full overflow-hidden bg-gradient-to-b from-orange-500/20 to-transparent">
        {displayedUser.profileBackdrop && (
          <img 
            src={displayedUser.profileBackdrop} 
            className="w-full h-full opacity-60"
            style={{ 
              objectFit: 'cover',
              objectPosition: `center ${displayedUser.profileBackdropPos ?? 50}%`,
              transform: `scale(${(displayedUser.profileBackdropScale || 100) / 100})`,
              transformOrigin: `center ${displayedUser.profileBackdropPos ?? 50}%`,
              transition: 'transform 0.3s ease-out, object-position 0.3s ease-out'
            }} 
            alt="Backdrop" 
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#070404] via-transparent to-transparent" />
        {/* Viyie+ specific overlay ambient glow */}
        {isViyiePlus && (
          <>
            {/* Removed gold fade per user request: "fade emas ganti hitam saja" */}
          </>
        )}
        
        {/* Actions Overlay */}
        <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
          <button onClick={onBack} className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
             {isOwnProfile && (
               <div className="flex flex-col items-end gap-2 text-right">
                 <button 
                   onClick={() => {
                     setBackdropUrlInput(displayedUser.profileBackdrop || "");
                     setBackdropScale(displayedUser.profileBackdropScale || 100);
                     setBackdropPos(displayedUser.profileBackdropPos ?? 50);
                     setShowBackdropModal(true);
                   }}
                   className="px-4 py-2 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 text-xs font-medium hover:bg-white/10 transition-all flex items-center gap-2 shadow-xl"
                 >
                   <ImageIcon className="w-3.5 h-3.5" />
                   Change Backdrop
                 </button>
                 <a 
                   href="https://sigmawire.net/image-to-url-converter" 
                   target="_blank" 
                   rel="noreferrer"
                   className="group flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-white/40 hover:text-orange-500 transition-colors"
                 >
                   <Info className="w-3 h-3" />
                   Upload Image {isViyiePlus ? "or GIF" : ""}
                 </a>
               </div>
             )}
             <button 
               onClick={async () => {
                 const shareUrl = `${window.location.origin}/profile/${displayedUser.uid}`;
                 const shareData = {
                   title: `${displayedUser.name || 'User'}'s Profile`,
                   text: `Check out this profile.`,
                   url: shareUrl
                 };
                 try {
                   if (navigator.share) {
                     await navigator.share(shareData);
                   } else {
                     await navigator.clipboard.writeText(shareUrl);
                     toast("Profile link copied to clipboard!", "success");
                   }
                 } catch (err: any) {
                   if (err.name !== "AbortError") {
                     await navigator.clipboard.writeText(shareUrl);
                     toast("Profile link copied to clipboard!", "success");
                   }
                 }
               }}
               className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
             >
               <Share2 className="w-4 h-4" />
             </button>
          </div>
        </div>
      </div>

      <div className="w-full max-w-full mx-auto px-4 sm:px-8 lg:px-12 -mt-20 relative z-10">
        {/* Profile Info Header */}
        <div className="flex flex-col md:flex-row items-center md:items-end gap-6 mb-12 text-center md:text-left">
          <div className="relative group">
            {/* Outer container with glow effect */}
            <div className={`relative w-32 h-32 md:w-40 md:h-40 rounded-[2.5rem] shadow-2xl transition-all overflow-hidden ${
              isViyiePlus ? 'p-[3px]' : 'border-4 border-[#070404] bg-[#1a1a1a]'
            }`}>
              {/* Spinning gradient background */}
              {isViyiePlus && (
                <div className="absolute inset-[-100%] bg-[conic-gradient(from_0deg,transparent_0_300deg,#fef08a_360deg)] animate-spin-slow" />
              )}
              {/* Inner content */}
              <div className="relative w-full h-full rounded-[2.3rem] overflow-hidden bg-[#1a1a1a] z-10 z-[1] inset-[0]">
                <img 
                  src={displayedUser.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayedUser.uid}`} 
                  className="w-full h-full object-cover" 
                  alt="Avatar" 
                />
              </div>
            </div>
            
            {/* Blurry glow under it */}
            {isViyiePlus && (
              <div className="absolute inset-0 rounded-[2.5rem] shadow-[0_0_40px_rgba(251,191,36,0.3)] pointer-events-none" />
            )}
          </div>

          <div className="flex-1 space-y-4 flex flex-col items-center md:items-start">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
              <h1 
                className={`text-4xl md:text-5xl font-black tracking-tighter notranslate ${
                  isViyiePlus 
                    ? 'animate-gold-shine' 
                    : 'text-white'
                }`} 
                translate="no"
              >
                {displayedUser.name}
              </h1>
              <TierBadges tiers={displayedUser.tiers || [displayedUser.tier || "regular"]} title={displayedUser.badgeTitle} />
            </div>
            
            <div className="space-y-4">
              {isEditingBio ? (
                <div className="flex items-center gap-2 max-w-md">
                  <input 
                    type="text" 
                    value={bioInput}
                    onChange={(e) => setBioInput(e.target.value.slice(0, 70))}
                    placeholder="Write something about yourself..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-orange-500/50"
                    autoFocus
                  />
                  <button 
                    onClick={handleUpdateBio}
                    className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center hover:scale-105 transition-all shadow-lg shadow-orange-500/20"
                  >
                    <Check className="w-4 h-4 text-white" />
                  </button>
                  <button 
                    onClick={() => { setIsEditingBio(false); setBioInput(displayedUser.bio || ""); }}
                    className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all"
                  >
                    <ArrowLeft className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <div className="group relative inline-block">
                  <p className="text-sm font-medium text-white/60 leading-relaxed max-w-lg">
                    {displayedUser.bio || (isOwnProfile ? "No bio yet. Add a bio to make your profile more interesting." : "A true fan of quality content on Viyie.")}
                  </p>
                  {isOwnProfile && (
                    <button 
                      onClick={() => setIsEditingBio(true)}
                      className="absolute -right-8 top-0 p-1 bg-white/5 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-white/10"
                    >
                      <Edit3 className="w-3 h-3 text-orange-500" />
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center justify-center md:justify-start gap-4 text-white/40 font-medium text-[11px] uppercase tracking-wider">
                <span className="text-orange-500 notranslate" translate="no">{displayedUser.username || "@user"}</span>
                <span className="w-1 h-1 rounded-full bg-white/20" />
                <span>Joined {new Date(displayedUser.createdAt).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</span>
              </div>
            </div>
          </div>

          {isOwnProfile && (
            <button 
              onClick={() => setEditing(!editing)}
              className="px-6 py-2.5 rounded-2xl bg-white text-black font-black text-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Profile Settings
            </button>
          )}
        </div>

        {/* Content Tabs/Grid */}
        <AnimatePresence>
          {editing && isOwnProfile && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-12 p-6 rounded-3xl bg-white/[0.03] border border-white/5 overflow-hidden"
            >
              <h3 className="text-sm font-black uppercase tracking-widest text-white/40 mb-6">Privacy settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={() => handleUpdateSetting("showHistory", !displayedUser.profileSettings?.showHistory)}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${displayedUser.profileSettings?.showHistory ? "bg-orange-500/10 border-orange-500/20" : "bg-white/5 border-white/5"}`}
                >
                  <div className="flex items-center gap-3">
                    {displayedUser.profileSettings?.showHistory ? <Eye className="w-4 h-4 text-orange-500" /> : <EyeOff className="w-4 h-4 text-white/20" />}
                    <span className="text-sm font-medium">Watch History</span>
                  </div>
                  <span className={`text-[10px] font-black uppercase ${displayedUser.profileSettings?.showHistory ? "text-orange-500" : "text-white/20"}`}>
                    {displayedUser.profileSettings?.showHistory ? "Public" : "Private"}
                  </span>
                </button>
 
                <button 
                  onClick={() => handleUpdateSetting("showFavorites", !displayedUser.profileSettings?.showFavorites)}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${displayedUser.profileSettings?.showFavorites ? "bg-orange-500/10 border-orange-500/20" : "bg-white/5 border-white/5"}`}
                >
                  <div className="flex items-center gap-3">
                    {displayedUser.profileSettings?.showFavorites ? <Eye className="w-4 h-4 text-orange-500" /> : <EyeOff className="w-4 h-4 text-white/20" />}
                    <span className="text-sm font-medium">Favorites List</span>
                  </div>
                  <span className={`text-[10px] font-black uppercase ${displayedUser.profileSettings?.showFavorites ? "text-orange-500" : "text-white/20"}`}>
                    {displayedUser.profileSettings?.showFavorites ? "Public" : "Private"}
                  </span>
                </button>

                <button 
                  onClick={() => handleUpdateSetting("showComments", !displayedUser.profileSettings?.showComments)}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${displayedUser.profileSettings?.showComments ? "bg-orange-500/10 border-orange-500/20" : "bg-white/5 border-white/5"}`}
                >
                  <div className="flex items-center gap-3">
                    {displayedUser.profileSettings?.showComments ? <Eye className="w-4 h-4 text-orange-500" /> : <EyeOff className="w-4 h-4 text-white/20" />}
                    <span className="text-sm font-medium">Comments</span>
                  </div>
                  <span className={`text-[10px] font-black uppercase ${displayedUser.profileSettings?.showComments ? "text-orange-500" : "text-white/20"}`}>
                    {displayedUser.profileSettings?.showComments ? "Public" : "Private"}
                  </span>
                </button>
 
                <button 
                  onClick={() => handleUpdateSetting("enableMusic", !displayedUser.profileSettings?.enableMusic)}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${displayedUser.profileSettings?.enableMusic ? "bg-orange-500/10 border-orange-500/20" : "bg-white/5 border-white/5"}`}
                >
                  <div className="flex items-center gap-3">
                    <Music className={`w-4 h-4 ${displayedUser.profileSettings?.enableMusic ? "text-orange-500" : "text-white/20"}`} />
                    <span className="text-sm font-medium">Background Music</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {displayedUser.profileSettings?.enableMusic ? <Play className="w-3 h-3 text-orange-500" /> : <Pause className="w-3 h-3 text-white/20" />}
                    <span className={`text-[10px] font-black uppercase ${displayedUser.profileSettings?.enableMusic ? "text-orange-500" : "text-white/20"}`}>
                      {displayedUser.profileSettings?.enableMusic ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left: Last Watched (5 items) */}
          <div className="lg:col-span-2 space-y-12">
            {(isOwnProfile || displayedUser.profileSettings?.showHistory) && (
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-orange-500" />
                  </div>
                  <h2 className="text-xl font-black tracking-tight">Last Watched</h2>
                </div>
                
                {historyMovies.length > 0 ? (
                  <div className="flex overflow-x-auto gap-4 pb-4 snap-x no-scrollbar">
                    {historyMovies.map((movie: Content) => (
                      <button 
                        key={movie.id}
                        onClick={() => onSelectMovie(movie)}
                        className={`snap-start shrink-0 w-32 sm:w-40 group relative aspect-[2/3] rounded-2xl overflow-hidden transition-all duration-300 ${
                          isViyiePlus 
                            ? 'bg-black/40 border border-yellow-500/30 shadow-[0_0_15px_rgba(251,191,36,0.15)] hover:shadow-[0_0_25px_rgba(251,191,36,0.4)] hover:border-yellow-500/60' 
                            : 'bg-white/5 border border-white/5 hover:border-white/20'
                        }`}
                      >
                        <img src={movie.poster || movie.posterUrl || movie.heroPosterUrl || undefined} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                          <p className={`text-[10px] font-medium line-clamp-1 translate-y-2 group-hover:translate-y-0 transition-transform ${isViyiePlus ? 'text-yellow-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]' : 'text-white'}`}>{movie.title}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center rounded-3xl border-2 border-dashed border-white/5">
                    <p className="text-sm text-white/20 font-medium">No watch history yet</p>
                  </div>
                )}
              </section>
            )}

            {/* Favorites Section */}
            {(isOwnProfile || displayedUser.profileSettings?.showFavorites) && (
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center">
                    <Heart className="w-5 h-5 text-red-500" />
                  </div>
                  <h2 className="text-xl font-black tracking-tight">Favorite Collection</h2>
                </div>

                {favMovies.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {(showAllFavorites ? favMovies : favMovies.slice(0, 20)).map((movie: Content) => (
                         <button 
                           key={movie.id}
                           onClick={() => onSelectMovie(movie)}
                           className={`group relative aspect-[2/3] rounded-2xl overflow-hidden transition-all duration-300 ${
                             isViyiePlus 
                               ? 'bg-black/40 border border-yellow-500/30 shadow-[0_0_15px_rgba(251,191,36,0.15)] hover:shadow-[0_0_25px_rgba(251,191,36,0.4)] hover:border-yellow-500/60' 
                               : 'bg-white/5 border border-white/5 hover:border-white/20'
                           }`}
                         >
                           <img src={movie.poster || movie.posterUrl || movie.heroPosterUrl || undefined} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="" />
                           <div className={`absolute top-2 right-2 w-6 h-6 rounded-lg flex items-center justify-center shadow-lg ${isViyiePlus ? 'bg-yellow-500 shadow-yellow-500/50' : 'bg-red-500 shadow-red-500/50'}`}>
                             <Heart className="w-3 h-3 text-black fill-current" />
                           </div>
                           <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3 pointer-events-none">
                             <p className={`text-[10px] font-medium line-clamp-1 translate-y-2 group-hover:translate-y-0 transition-transform ${isViyiePlus ? 'text-yellow-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]' : 'text-white'}`}>{movie.title}</p>
                           </div>
                         </button>
                      ))}
                    </div>
                    {!showAllFavorites && favMovies.length > 20 && (
                      <button 
                        onClick={() => setShowAllFavorites(true)}
                        className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-medium text-sm transition-colors border border-white/5"
                      >
                        Show More
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="py-12 text-center rounded-3xl border-2 border-dashed border-white/5">
                    <p className="text-sm text-white/20 font-medium">No favorite movies yet</p>
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Right: Stats and Sidebar */}
          <div className="space-y-8">
            <div className="p-8 rounded-[2.5rem] bg-gradient-to-b from-white/[0.04] to-transparent border border-white/5 space-y-6 shadow-2xl backdrop-blur-xl">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Engagement Stats</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 group hover:bg-orange-500/5 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
                      <Heart className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-white/60">Favorites</span>
                  </div>
                  <p className="text-xl font-black text-white">{favMovies.length}</p>
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 group hover:bg-orange-500/5 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
                      <Clock className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-white/60">History</span>
                  </div>
                  <p className="text-xl font-black text-white">{displayedUser.history?.length || 0}</p>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 group hover:bg-orange-500/5 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-white/60">Comments</span>
                  </div>
                  <p className="text-xl font-black text-white">{totalComments}</p>
                </div>
              </div>
            </div>

            {/* Achievement/Badge Section */}
            <div className={`p-8 rounded-[2.5rem] border ${isViyiePlus ? 'bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/20 shadow-[0_0_50px_rgba(251,191,36,0.1)]' : 'bg-gradient-to-br from-orange-500/10 to-red-600/10 border-orange-500/10'}`}>
              <div className="flex items-center gap-3 mb-6">
                 {isViyiePlus ? (
                   <Crown className="w-5 h-5 text-yellow-400 animate-pulse" />
                 ) : (
                   <Sparkles className="w-4 h-4 text-orange-400" />
                 )}
                 <h3 className={`text-sm font-black uppercase tracking-wider ${isViyiePlus ? 'text-yellow-400' : 'text-white'}`}>Achievements & Badges</h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                 {userAchievements.length > 0 ? userAchievements.map(ach => (
                   <div key={ach.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:scale-[1.02] ${isViyiePlus ? 'bg-black/40 border-yellow-500/10 hover:bg-yellow-500/10' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                     <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${ach.bg}`}>
                        <ach.icon className={`w-5 h-5 ${ach.color}`} />
                     </div>
                     <div className="min-w-0 break-words flex-1">
                       <p className={`text-xs font-medium ${isViyiePlus ? 'text-yellow-100' : 'text-white'}`}>{ach.title}</p>
                       <p className={`text-[10px] ${isViyiePlus ? 'text-yellow-500/50' : 'text-white/30'}`}>{ach.desc}</p>
                     </div>
                   </div>
                 )) : (
                   <p className="text-xs text-white/30 italic">No achievements yet. Keep watching and chatting!</p>
                 )}
              </div>
            </div>

            {/* Google Drive Backup Section - Hidden per user request */}
            {/* 
            {isOwnProfile && (
              <div className="p-8 rounded-[2.5rem] bg-gradient-to-br from-blue-600/10 to-blue-400/10 border border-blue-500/20 space-y-6 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                    <Cloud className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-blue-400">Personal Cloud Backup</h3>
                    <p className="text-[10px] text-white/40 font-medium italic">Save your favs & history to your own Drive</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {!googleTokens ? (
                    <button 
                      onClick={connectDrive}
                      className="w-full py-3 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center justify-center gap-2"
                    >
                      <HardDrive className="w-4 h-4" />
                      Connect Google Drive
                    </button>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                       <button 
                        onClick={backupToDrive}
                        className="w-full py-3 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 text-[10px] font-black uppercase tracking-widest hover:bg-blue-600/30 transition-all flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Sync to Drive
                      </button>
                      <button 
                        onClick={restoreFromDrive}
                        className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                      >
                        <Cloud className="w-3.5 h-3.5" />
                        Restore Backup
                      </button>
                      <button 
                        onClick={() => {
                          setGoogleTokens(null);
                          localStorage.removeItem("google_drive_tokens");
                          toast("Disconnected Drive", "info");
                        }}
                        className="text-[9px] font-medium text-white/20 hover:text-red-400 self-center mt-2"
                      >
                        Disconnect Drive
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            */}

            {/* User Comments Section */}
            {(isOwnProfile || displayedUser.profileSettings?.showComments) && (
              <div className="p-8 rounded-[2.5rem] bg-white/5 border border-white/5">
                <div className="flex items-center gap-3 mb-6">
                  <MessageSquare className="w-5 h-5 text-orange-500" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">Recent Comments</h3>
                </div>
                {userCommentsList.length > 0 ? (
                  <div className="flex flex-col gap-4 max-h-[800px] overflow-y-auto no-scrollbar pr-2">
                    {userCommentsList.map(comment => {
                       return (
                         <div key={comment.id} className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                               <span className="text-[10px] font-medium text-white/40">{new Date(comment.createdAt).toLocaleDateString("id-ID", { month: "short", day: "numeric", year: "numeric" })}</span>
                             </div>
                           </div>
                           <p translate="no" className="notranslate text-sm text-white/80 whitespace-pre-wrap">{comment.text}</p>
                         </div>
                       )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-white/30 italic">No comments yet.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {showBackdropModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#0f0f0f] border border-white/10 rounded-[2.5rem] p-6 w-full max-w-3xl shadow-2xl relative flex flex-col md:flex-row gap-8 my-auto overflow-y-auto max-h-[90vh]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-orange-500 rounded-t-full" />
            
            <div className="flex-1">
              <h3 className="text-xl font-black text-white mb-2">Change Backdrop</h3>
              <p className="text-xs text-white/40 mb-4 tracking-wide leading-relaxed">Customize your profile backdrop. You can convert images or GIFs to direct links.</p>
              
              <div className="flex gap-4 items-center mb-4">
                <a href="https://www.image2url.com/" target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-orange-500 hover:text-white bg-orange-500/10 hover:bg-orange-500 transition-colors py-3 px-4 rounded-xl flex-1 text-center inline-flex justify-center items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Convert Image / GIF to Link
                </a>
              </div>
              <textarea
                value={backdropUrlInput}
                onChange={(e) => {
                  setBackdropUrlInput(e.target.value);
                  setBackdropError("");
                }}
                placeholder="Enter Image or GIF URL (e.g., direct image link)..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-orange-500/50 transition-all resize-none outline-none mb-2 font-mono"
                rows={4}
                autoFocus
              />
              {backdropError && (
                <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-500 text-xs py-2 px-3 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{backdropError}</span>
                </div>
              )}
              {!backdropError && <div className="mb-6" />}

              <div className="space-y-6 mb-8">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-black text-white/60 flex justify-between mb-3">
                    <span>Zoom / Scale</span>
                    <span className="text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-md">{backdropScale}%</span>
                  </label>
                  <input 
                    type="range" 
                    min="50" max="250" 
                    value={backdropScale} 
                    onChange={(e) => setBackdropScale(Number(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-black text-white/60 flex justify-between mb-3">
                    <span>Vertical Position</span>
                    <span className="text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-md">{backdropPos}%</span>
                  </label>
                  <input 
                    type="range" 
                    min="0" max="100" 
                    value={backdropPos} 
                    onChange={(e) => setBackdropPos(Number(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-500"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowBackdropModal(false);
                    setBackdropUrlInput("");
                  }}
                  className="flex-1 py-3 rounded-xl bg-white/5 text-white/40 text-xs font-medium hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={submitBackdrop}
                  disabled={!backdropUrlInput.trim()}
                  className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-red-600 to-orange-500 text-white text-xs font-black shadow-lg shadow-red-900/40 disabled:opacity-50 transition-all"
                >
                  Save Backdrop
                </button>
              </div>
            </div>

            {/* Live Preview Pane */}
            <div className="w-full md:w-96 shrink-0 flex flex-col gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Visual Preview</span>
              <div className="relative w-full rounded-3xl overflow-hidden bg-[#070404] border-2 border-white/5 shadow-inner pb-12 md:pb-8">
                
                {/* Backdrop Area */}
                <div className="relative w-full aspect-[16/7] overflow-hidden bg-[#1a1a1a]">
                  {backdropUrlInput ? (
                    <img 
                      src={backdropUrlInput} 
                      alt="Preview" 
                      className="w-full h-full opacity-60"
                      style={{ 
                        objectFit: 'cover',
                        objectPosition: `center ${backdropPos}%`,
                        transform: `scale(${backdropScale / 100})`,
                        transformOrigin: `center ${backdropPos}%`,
                        transition: 'transform 0.1s ease-out, object-position 0.1s ease-out'
                      }} 
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMzMzMiIC8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW52YWxpZCBJbWFnZTwvdGV4dD48L3N2Zz4=';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white/20">
                      <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                      <span className="text-[10px] font-medium">No Image</span>
                    </div>
                  )}

                  {/* Actions Overlay Mock */}
                  <div className="absolute top-3 left-3 flex items-center gap-1">
                    <div className="w-6 h-6 rounded-full bg-black/50 border border-white/10 flex items-center justify-center">
                      <ArrowLeft className="w-3 h-3 text-white" />
                    </div>
                  </div>
                </div>
                
                {/* Mock UI overlaid on preview */}
                <div className="relative px-4 -mt-8 md:-mt-6 w-full pointer-events-none">
                   <div className="flex flex-col md:flex-row items-center md:items-end gap-2 md:gap-3 text-center md:text-left">
                     <div className={`relative w-16 h-16 md:w-14 md:h-14 rounded-[1rem] border-4 md:border-2 border-[#070404] bg-[#1a1a1a] shadow-lg overflow-hidden shrink-0`}>
                       <img src={displayedUser.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayedUser.uid}`} className="w-full h-full object-cover" alt="Avatar" />
                     </div>
                     <div className="flex-1 pb-1 flex flex-col items-center md:items-start">
                       <div className="h-4 bg-white/20 rounded w-24 shadow-xl mb-1 mt-1 md:mt-0" />
                       <div className="h-2 bg-white/10 rounded w-16" />
                     </div>
                   </div>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}
