import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from "react";
import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  fbSignOut,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateFbProfile,
  GoogleAuthProvider,
} from "../lib/firebase";
import type { Movie } from "../types";
import { checkSpamAndTriggerCooldown } from "../lib/spamProtector";

export interface AuthUser {
  uid: string;
  name: string;
  username?: string; // e.g. @nixi
  email: string;
  picture?: string;
  role: "user" | "admin";
  tier?: "user" | "admin" | "viyie_plus" | "regular";
  tiers?: string[];
  badgeTitle?: string;
  profileBackdrop?: string;
  profileBackdropScale?: number;
  profileBackdropPos?: number;
  bio?: string;
  favorites?: (string | number)[];
  history?: HistoryEntry[];
  profileSettings?: {
    showHistory: boolean;
    showFavorites: boolean;
    enableMusic: boolean;
    activeTrackIndex: number;
  };
  provider?: string;
  verifiedEmailCode?: boolean;
  commentBannedUntil?: string; // ISO date or "permanent"
}

export interface HistoryEntry {
  movieId: string | number;
  watchedAt: number;
  progress: number;
  episodeIndex?: number;
  seasonIndex?: number;
}

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: number;
  msg: string;
  kind: "info" | "success" | "error";
  duration?: number;
  action?: ToastAction;
}

interface UserDataContextValue {
  user: AuthUser | null;
  loading: boolean;
  authOpen: boolean;
  openAuth: () => void;
  closeAuth: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<AuthUser>) => Promise<void>;
  favorites: (string | number)[];
  myList: (string | number)[];
  history: HistoryEntry[];
  isFavorite: (id: string | number) => boolean;
  isInMyList: (id: string | number) => boolean;
  toggleFavorite: (movie: any) => Promise<void>;
  toggleMyList: (movie: any) => Promise<void>;
  addHistory: (
    movie: any,
    progress?: number,
    episodeIndex?: number,
    seasonIndex?: number,
  ) => Promise<void>;
  removeHistory: (id: string | number) => Promise<void>;
  clearHistory: () => Promise<void>;
  removeFavorite: (id: string | number) => Promise<void>;
  removeFromMyList: (id: string | number) => Promise<void>;
  toast: (
    msg: string,
    kind?: "info" | "success" | "error",
    opts?: { duration?: number; action?: ToastAction },
  ) => void;
  toasts: ToastItem[];
  accessToken: string | null;
}

const UserDataContext = createContext<UserDataContextValue | null>(null);

export function UserDataProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // User Preferences State
  const [favorites, setFavorites] = useState<(string | number)[]>(() => {
    try {
      const stored = localStorage.getItem("viyie_cached_favorites");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [myList, setMyList] = useState<(string | number)[]>(() => {
    try {
      const stored = localStorage.getItem("viyie_cached_mylist");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try {
      const stored = localStorage.getItem("viyie_cached_history") || localStorage.getItem("viyie_local_history");
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
      }
      return [];
    } catch {
      return [];
    }
  });

  const pendingSyncFavorites = useRef(!!localStorage.getItem("viyie_pending_favorites"));
  const pendingSyncMyList = useRef(!!localStorage.getItem("viyie_pending_mylist"));
  const pendingSyncHistory = useRef(!!localStorage.getItem("viyie_pending_history"));
  const latestFavorites = useRef<(string | number)[]>(favorites);
  const latestMyList = useRef<(string | number)[]>(myList);
  const latestHistory = useRef<HistoryEntry[]>(history);

  useEffect(() => { 
    latestFavorites.current = favorites; 
    try {
      localStorage.setItem("viyie_cached_favorites", JSON.stringify(favorites));
    } catch (e) {}
  }, [favorites]);

  useEffect(() => { 
    latestMyList.current = myList; 
    try {
      localStorage.setItem("viyie_cached_mylist", JSON.stringify(myList));
    } catch (e) {}
  }, [myList]);

  useEffect(() => { 
    latestHistory.current = history; 
    try {
      const sliced = history.slice(0, 10);
      localStorage.setItem("viyie_cached_history", JSON.stringify(sliced));
      localStorage.setItem("viyie_local_history", JSON.stringify(sliced));
    } catch (e) {}
  }, [history]);

  const syncOfflineListsToCloud = useCallback(() => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;
    const hasFavChanges = pendingSyncFavorites.current;
    const hasListChanges = pendingSyncMyList.current;
    const hasHistoryChanges = pendingSyncHistory.current;
    
    if (hasFavChanges || hasListChanges || hasHistoryChanges) {
      const payload: any = {};
      if (hasFavChanges) payload.favorites = latestFavorites.current;
      if (hasListChanges) payload.myList = latestMyList.current;
      if (hasHistoryChanges) payload.history = latestHistory.current.slice(0, 10);
      
      const userRef = doc(db, "users", currentUid);
      setDoc(userRef, payload, { merge: true }).catch(console.error);
      
      pendingSyncFavorites.current = false;
      pendingSyncMyList.current = false;
      pendingSyncHistory.current = false;
      localStorage.removeItem("viyie_pending_favorites");
      localStorage.removeItem("viyie_pending_mylist");
      localStorage.removeItem("viyie_pending_history");
    }
  }, []);

  // Periodic and debounced auto-sync to Firebase to minimize database read/write limits
  useEffect(() => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;

    const timer = setTimeout(() => {
      syncOfflineListsToCloud();
    }, 2500); // 2.5 seconds batch timer

    return () => clearTimeout(timer);
  }, [favorites, myList, history, syncOfflineListsToCloud]);

  useEffect(() => {
    const handleUnloadOrHidden = (e?: Event) => {
       if (!e || document.visibilityState === 'hidden' || document.visibilityState === undefined) {
         syncOfflineListsToCloud();
       }
    };
    window.addEventListener("beforeunload", handleUnloadOrHidden);
    window.addEventListener("visibilitychange", handleUnloadOrHidden);
    return () => {
      window.removeEventListener("beforeunload", handleUnloadOrHidden);
      window.removeEventListener("visibilitychange", handleUnloadOrHidden);
    };
  }, [syncOfflineListsToCloud]);

  const toast = useCallback(
    (
      msg: string,
      kind: "info" | "success" | "error" = "info",
      opts?: { duration?: number; action?: ToastAction },
    ) => {
      const id = Date.now() + Math.random();
      const duration = opts?.duration || 3000;
      setToasts((prev) => {
        // Prevent stacking duplicate message strings (fixes double notifications)
        if (prev.some((t) => t.msg === msg)) return prev;
        return [...prev, { id, msg, kind, duration, action: opts?.action }];
      });
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    [],
  );

  // Sync with Firestore in real-time
  useEffect(() => {
    let unsubscribeData: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          // Fetch or Create User Document
          const userRef = doc(db, "users", fbUser.uid);
          let userSnap = null;
          try {
            userSnap = await getDoc(userRef);
          } catch (e) {
            console.warn("Failed to get user document, trying offline cache or fallback", e);
          }

          let fullUser: AuthUser | null = null;

          let determinedRole: "user" | "admin" = "user";
          let determinedTier: string = "regular";
          try {
            const settingsSnap = await getDoc(doc(db, "settings", "main"));
            if (settingsSnap.exists()) {
              const settingsData = settingsSnap.data();
              const staffsList = settingsData.staffs || [];
              const userEmailLower = fbUser.email?.toLowerCase();
              const staffRecord = staffsList.find(
                (s: any) => s.email?.toLowerCase() === userEmailLower
              );
              if (staffRecord || userEmailLower === "firefuryggwp@gmail.com") {
                determinedRole = "admin";
                determinedTier = staffRecord?.role || (userEmailLower === "firefuryggwp@gmail.com" ? "owner" : "admin");
              }
            } else if (fbUser.email?.toLowerCase() === "firefuryggwp@gmail.com") {
              determinedRole = "admin";
              determinedTier = "owner";
            }
          } catch (err) {
            if (fbUser.email?.toLowerCase() === "firefuryggwp@gmail.com") {
              determinedRole = "admin";
              determinedTier = "owner";
            }
            console.warn("Failed to check staff configuration during login:", err);
          }

          if (!userSnap || !userSnap.exists()) {
            // New User or offline fallback
            fullUser = {
              uid: fbUser.uid,
              name: fbUser.displayName || "User",
              email: fbUser.email || "",
              picture: fbUser.photoURL || undefined,
              role: determinedRole,
              tier: (determinedTier === "owner" ? "admin" : determinedTier) as any,
              tiers: [determinedTier],
              profileSettings: {
                showHistory: true,
                showFavorites: true,
                enableMusic: true,
                activeTrackIndex: 0,
              },
              provider: fbUser.providerData[0]?.providerId || "unknown",
            };
            try {
              if (userSnap) {
                await setDoc(userRef, {
                  ...fullUser,
                  favorites: [],
                  myList: [],
                  history: [],
                  createdAt: new Date().toISOString(),
                });
              }
            } catch (err) {
              console.warn("Failed to set new user document offline:", err);
            }
          } else {
            const data = userSnap.data();
            let needUpdate = false;
            let tempRole = data.role || "user";
            let tempTier = data.tier || "regular";
            let tempTiers = data.tiers || [tempTier];

            if (determinedRole === "admin" && (data.role !== "admin" || (determinedTier !== "regular" && data.tier !== determinedTier))) {
              tempRole = "admin";
              tempTier = determinedTier === "owner" ? "admin" : determinedTier;
              if (!tempTiers.includes(determinedTier)) {
                tempTiers = [...tempTiers, determinedTier];
              }
              needUpdate = true;
            }

            fullUser = {
              uid: fbUser.uid,
              name: data.name || fbUser.displayName || "User",
              username: data.username,
              email: fbUser.email || "",
              picture: data.picture || fbUser.photoURL || undefined,
              role: tempRole,
              tier: tempTier,
              tiers: tempTiers,
              badgeTitle: data.badgeTitle,
              profileBackdrop: data.profileBackdrop,
              bio: data.bio,
              profileSettings: data.profileSettings || {
                showHistory: true,
                showFavorites: true,
                enableMusic: true,
                activeTrackIndex: 0,
              },
              provider: fbUser.providerData[0]?.providerId || "unknown",
            };

            if (needUpdate) {
              try {
                await setDoc(userRef, {
                  role: tempRole,
                  tier: tempTier,
                  tiers: tempTiers
                }, { merge: true });
              } catch (err) {
                console.warn("Failed to update staff credentials offline:", err);
              }
            }
          }

          setUser(fullUser);

          // Clear previous listener if any
          if (unsubscribeData) {
            unsubscribeData();
          }

          // Listen for data updates
          unsubscribeData = onSnapshot(
            userRef,
            (docSnap) => {
              if (docSnap.exists()) {
                const data = docSnap.data();

                const loadedFavorites = data.favorites || [];
                const loadedMyList = data.myList || [];
                
                // Attempt sync on auth load if we had uncommitted changes
                if (pendingSyncFavorites.current || pendingSyncMyList.current || pendingSyncHistory.current) {
                  syncOfflineListsToCloud();
                }

                setFavorites(prev => {
                  if (pendingSyncFavorites.current) return prev;
                  const next = loadedFavorites;
                  if (prev.length === next.length && prev.every((v, i) => v === next[i])) return prev;
                  return next;
                });
                
                setMyList(prev => {
                  if (pendingSyncMyList.current) return prev;
                  const next = loadedMyList;
                  if (prev.length === next.length && prev.every((v, i) => v === next[i])) return prev;
                  return next;
                });

                setHistory(prev => {
                  if (pendingSyncHistory.current) return prev;
                  const next = data.history || [];
                  if (prev.length === next.length && prev.every((v, i) => v.movieId === next[i].movieId && v.progress === next[i].progress)) return prev;
                  return next;
                });
                
                // Filter out large arrays from user object comparison
                setUser((prev) => {
                  if (!prev) return { ...fullUser, ...data } as AuthUser;
                  
                  // Shallow compare key profile fields
                  // Safe compare profile settings
                  const settingsChanged = (prev: any, next: any) => {
                    try {
                      return JSON.stringify(prev || {}) !== JSON.stringify(next || {});
                    } catch (e) {
                      console.warn("Circular structure in profileSettings detected, forcing change detection");
                      return true;
                    }
                  };

                  const hasChanged = 
                    prev.name !== (data.name || prev.name) ||
                    prev.username !== data.username ||
                    prev.picture !== (data.picture || prev.picture) ||
                    prev.role !== (data.role || prev.role) ||
                    prev.tier !== (data.tier || prev.tier) ||
                    settingsChanged(prev.profileSettings, data.profileSettings);
                  
                  if (!hasChanged) return prev;
                  return { ...prev, ...data };
                });
              }
            },
            (error) => {
              console.error("Error fetching user data:", error);
            },
          );
        } catch (error) {
          console.error("Fatal error loading user auth profile data:", error);
          // Always ensure a fallback minimal user representation to avoid infinite spinner
          setUser({
            uid: fbUser.uid,
            name: fbUser.displayName || "User",
            email: fbUser.email || "",
            picture: fbUser.photoURL || undefined,
            role: fbUser.email?.toLowerCase() === "firefuryggwp@gmail.com" ? "admin" : "user",
            tier: fbUser.email?.toLowerCase() === "firefuryggwp@gmail.com" ? "admin" : "regular",
            tiers: [fbUser.email?.toLowerCase() === "firefuryggwp@gmail.com" ? "owner" : "regular"],
            profileSettings: {
              showHistory: true,
              showFavorites: true,
              enableMusic: true,
              activeTrackIndex: 0,
            },
            provider: fbUser.providerData[0]?.providerId || "unknown",
          });
        } finally {
          setLoading(false);
        }
      } else {
        if (unsubscribeData) {
          unsubscribeData();
          unsubscribeData = null;
        }
        setUser(null);
        setFavorites([]);
        setMyList([]);
        setHistory([]);
        setAccessToken(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeData) {
        unsubscribeData();
      }
    };
  }, []);

  const openAuth = useCallback(() => {
    window.history.pushState({}, "", "/login");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  const signInInProgress = useRef(false);

  const signInWithGoogle = useCallback(async () => {
    if (signInInProgress.current) return;
    signInInProgress.current = true;
    try {
      const result = await signInWithPopup(auth, googleProvider);
      
      // Try to get token
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
      }

      setAuthOpen(false);
      toast("Successfully signed in with Google", "success");
    } catch (error: any) {
      if (error.code !== "auth/popup-closed-by-user") {
        toast(error.message || "Google Sign-In failed", "error");
      }
    } finally {
      signInInProgress.current = false;
    }
  }, [toast]);

  const signInWithEmail = useCallback(async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      setAuthOpen(false);
      toast("Successfully signed in", "success");
    } catch (error: any) {
      let friendlyMsg = error.message;
      if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password" || error.code === "auth/user-not-found") {
        friendlyMsg = "Invalid email or password.";
      } else if (error.code === "auth/invalid-email") {
        friendlyMsg = "Invalid email address format.";
      }
      toast(friendlyMsg, "error");
      throw error;
    }
  }, [toast]);

  const signUpWithEmail = useCallback(async (email: string, pass: string, name: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      if (result.user) {
        await updateFbProfile(result.user, { displayName: name });
        // Manually trigger Firestore document creation immediately to prevent index races or gaps
        const userRef = doc(db, "users", result.user.uid);
        const newUserDoc = {
          uid: result.user.uid,
          name: name || "User",
          email: email,
          role: "user",
          tier: "regular",
          tiers: ["regular"],
          profileSettings: {
            showHistory: true,
            showFavorites: true,
            enableMusic: true,
            activeTrackIndex: 0,
          },
          provider: "password",
          favorites: [],
          myList: [],
          history: [],
          createdAt: new Date().toISOString(),
        };
        await setDoc(userRef, newUserDoc);
      }
      setAuthOpen(false);
      toast("Account successfully registered", "success");
    } catch (error: any) {
      let friendlyMsg = error.message;
      if (error.code === "auth/email-already-in-use") {
        friendlyMsg = "This email is already registered.";
      } else if (error.code === "auth/weak-password") {
        friendlyMsg = "Password is too weak. Must be at least 6 characters.";
      } else if (error.code === "auth/invalid-email") {
        friendlyMsg = "Invalid email address format.";
      }
      toast(friendlyMsg, "error");
      throw error;
    }
  }, [toast]);

  const signOut = useCallback(async () => {
    try {
      await fbSignOut(auth);
      setAccessToken(null);
      toast("Signed out successfully", "info");
    } catch (error: any) {
      toast(error.message, "error");
    }
  }, [toast]);

  const isFavorite = useCallback(
    (id: string | number) => latestFavorites.current.includes(id),
    [],
  );
  const isInMyList = useCallback(
    (id: string | number) => latestMyList.current.includes(id),
    [],
  );

  const updateProfile = useCallback(
    async (data: Partial<AuthUser>) => {
      if (!user) return;
      const userRef = doc(db, "users", user.uid);
      try {
        // Use setDoc with merge instead of updateDoc to be more robust
        await setDoc(
          userRef,
          { ...data, updatedAt: new Date().toISOString() },
          { merge: true },
        );
        toast("Profile updated successfully", "success");
      } catch (e: any) {
        console.error("Profile update error:", e);
        const isOfflineLine =
          e.code === "unavailable" || e.message?.includes("offline");
        const msg = isOfflineLine
          ? "Firestore is OFFLINE. Changes saved locally only (simulated)."
          : "Failed to update profile: " + (e.message || "Unknown error");

        toast(msg, isOfflineLine ? "info" : "error");
      }
    },
    [user, toast],
  );

  const toggleFavorite = useCallback(
    async (movie: Movie) => {
      if (!auth.currentUser) return openAuth();
      if (!checkSpamAndTriggerCooldown(toast)) return;

      setFavorites((prev) => {
        const isFav = prev.includes(movie.id);
        let nextFavs = [...prev];
        const isPremium = (user?.tiers || [user?.tier || "regular"]).includes("viyie_plus") || user?.tier === "admin" || String(user?.role) === "admin";
        const limit = isPremium ? 40 : 20;

        if (!isFav) {
          nextFavs = [movie.id, ...nextFavs].slice(0, limit);
          toast(`${movie.title} added to favorites`, "success");
        } else {
          nextFavs = nextFavs.filter((id) => id !== movie.id);
          toast(`${movie.title} removed from favorites`, "info", {
            duration: 7000,
            action: {
              label: "Undo",
              onClick: () => {
                const undoneFavs = [movie.id, ...nextFavs].slice(0, limit);
                setFavorites(undoneFavs);
                pendingSyncFavorites.current = true;
                try { 
                  localStorage.setItem("viyie_pending_favorites", "1"); 
                  localStorage.setItem("viyie_cached_favorites", JSON.stringify(undoneFavs));
                } catch(e){}
              },
            },
          });
        }
        
        pendingSyncFavorites.current = true;
        try { 
          localStorage.setItem("viyie_pending_favorites", "1"); 
          localStorage.setItem("viyie_cached_favorites", JSON.stringify(nextFavs));
        } catch(e){}
        return nextFavs;
      });
    },
    [user?.tiers, user?.tier, user?.role, openAuth, toast],
  );

  const toggleMyList = useCallback(
    async (movie: Movie) => {
      if (!auth.currentUser) return openAuth();
      if (!checkSpamAndTriggerCooldown(toast)) return;

      setMyList((prev) => {
        const inList = prev.includes(movie.id);
        let nextList = [...prev];
        const isPremium = (user?.tiers || [user?.tier || "regular"]).includes("viyie_plus") || user?.tier === "admin" || String(user?.role) === "admin";
        const limit = isPremium ? 40 : 20;

        if (!inList) {
          nextList = [movie.id, ...nextList].slice(0, limit);
          toast(`${movie.title} added to Watch List`, "success");
        } else {
          nextList = nextList.filter((id) => id !== movie.id);
          toast(`${movie.title} removed from Watch List`, "info", {
            duration: 7000,
            action: {
              label: "Undo",
              onClick: () => {
                const undoneList = [movie.id, ...nextList].slice(0, limit);
                setMyList(undoneList);
                pendingSyncMyList.current = true;
                try { 
                  localStorage.setItem("viyie_pending_mylist", "1"); 
                  localStorage.setItem("viyie_cached_mylist", JSON.stringify(undoneList));
                } catch(e){}
              },
            },
          });
        }

        pendingSyncMyList.current = true;
        try { 
          localStorage.setItem("viyie_pending_mylist", "1"); 
          localStorage.setItem("viyie_cached_mylist", JSON.stringify(nextList));
        } catch(e){}
        return nextList;
      });
    },
    [user?.tiers, user?.tier, user?.role, openAuth, toast],
  );

  const addHistory = useCallback(
    async (
      movie: Movie | any,
      progress = 0.05,
      episodeIndex?: number,
      seasonIndex?: number,
    ) => {
      if (
        movie?.status === "coming_soon" ||
        movie?.type === "soon" ||
        movie?.kind === "trailer" ||
        movie?.type === "trailer"
      )
        return;

      const historyLimit = 10; // Forced to exactly 10 continue watching items for both regular and viyie+
      
      try {
        setHistory((prev) => {
          const filtered = prev.filter(
            (h: HistoryEntry) => String(h.movieId) !== String(movie.id),
          );
          const newEntry: HistoryEntry = {
            movieId: movie.id,
            watchedAt: Date.now(),
            progress,
          };
          if (episodeIndex !== undefined) {
            newEntry.episodeIndex = episodeIndex;
          }
          if (seasonIndex !== undefined) {
            newEntry.seasonIndex = seasonIndex;
          }
          const nextHistory = [newEntry, ...filtered].slice(0, historyLimit);
          pendingSyncHistory.current = true;
          try { 
            localStorage.setItem("viyie_pending_history", "1"); 
            localStorage.setItem("viyie_cached_history", JSON.stringify(nextHistory));
            localStorage.setItem("viyie_local_history", JSON.stringify(nextHistory));
          } catch(e){}
          return nextHistory;
        });

      } catch (e) {
        console.error("Failed to add to history", e);
      }
    },
    [user],
  );

  const removeHistory = useCallback(
    async (id: string | number) => {
      setHistory((prev) => {
        const nextHistory = prev.filter((h) => String(h.movieId) !== String(id));
        pendingSyncHistory.current = true;
        try { 
          localStorage.setItem("viyie_pending_history", "1"); 
          localStorage.setItem("viyie_cached_history", JSON.stringify(nextHistory));
          localStorage.setItem("viyie_local_history", JSON.stringify(nextHistory));
        } catch(e){}
        return nextHistory;
      });
      toast("Item removed from history", "success");
    },
    [toast],
  );

  const clearHistory = useCallback(async () => {
    setHistory(() => {
      pendingSyncHistory.current = true;
      try { 
        localStorage.setItem("viyie_pending_history", "1"); 
        localStorage.setItem("viyie_cached_history", JSON.stringify([]));
        localStorage.setItem("viyie_local_history", JSON.stringify([]));
      } catch(e){}
      return [];
    });
    toast("History cleared", "info");
  }, [toast]);

  const removeFavorite = useCallback(
    async (id: string | number) => {
      setFavorites((prev) => {
        const isMember = prev.includes(id);
        if (!isMember) return prev;
        const nextFavs = prev.filter((f) => f !== id);
        pendingSyncFavorites.current = true;
        try { 
          localStorage.setItem("viyie_pending_favorites", "1"); 
          localStorage.setItem("viyie_cached_favorites", JSON.stringify(nextFavs));
        } catch(e){}
        
        toast("Removed from favorites", "success", {
          duration: 7000,
          action: {
            label: "Undo",
            onClick: () => {
              const undone = [id, ...nextFavs];
              setFavorites(undone);
              pendingSyncFavorites.current = true;
              try { 
                localStorage.setItem("viyie_pending_favorites", "1"); 
                localStorage.setItem("viyie_cached_favorites", JSON.stringify(undone));
              } catch(e){}
            },
          },
        });
        return nextFavs;
      });
    },
    [toast],
  );

  const removeFromMyList = useCallback(
    async (id: string | number) => {
      setMyList((prev) => {
        const isMember = prev.includes(id);
        if (!isMember) return prev;
        const nextList = prev.filter((m) => m !== id);
        pendingSyncMyList.current = true;
        try { 
          localStorage.setItem("viyie_pending_mylist", "1"); 
          localStorage.setItem("viyie_cached_mylist", JSON.stringify(nextList));
        } catch(e){}
        
        toast("Removed from Watch List", "success", {
          duration: 7000,
          action: {
            label: "Undo",
            onClick: () => {
              const undone = [id, ...nextList];
              setMyList(undone);
              pendingSyncMyList.current = true;
              try { 
                localStorage.setItem("viyie_pending_mylist", "1"); 
                localStorage.setItem("viyie_cached_mylist", JSON.stringify(undone));
              } catch(e){}
            },
          },
        });
        return nextList;
      });
    },
    [toast],
  );

  const value = useMemo<UserDataContextValue>(
    () => ({
      favorites,
      user,
      loading,
      authOpen,
      openAuth,
      closeAuth,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      myList,
      history,
      isFavorite,
      isInMyList,
      toggleFavorite,
      toggleMyList,
      addHistory,
      removeHistory,
      clearHistory,
      removeFavorite,
      removeFromMyList,
      updateProfile,
      toast,
      toasts,
      accessToken,
    }),
    [
      favorites,
      user,
      loading,
      authOpen,
      openAuth,
      closeAuth,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      myList,
      history,
      isFavorite,
      isInMyList,
      toggleFavorite,
      toggleMyList,
      addHistory,
      removeHistory,
      clearHistory,
      removeFavorite,
      removeFromMyList,
      updateProfile,
      toast,
      toasts,
      accessToken,
    ],
  );

  return (
    <UserDataContext.Provider value={value}>
      {children}
    </UserDataContext.Provider>
  );
}

export function useUserData() {
  const ctx = useContext(UserDataContext);
  if (!ctx) throw new Error("useUserData must be used inside UserDataProvider");
  return ctx;
}
