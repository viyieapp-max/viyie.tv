import { useState, useEffect, useMemo } from "react";
import { db, collection, query, orderBy, onSnapshot } from "../lib/firebase";
import type { Content, HeroSlot } from "../types";
import { isDateInCurrentPeriod } from "../lib/dateUtils";

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

export type { Content, HeroSlot };

let globalContents: Content[] = [];
let globalHeroSlots: HeroSlot[] = [];
let globalBottomHeroSlots: HeroSlot[] = [];
let globalCommentsCounts: Record<string, number> = {};
let globalMonthlyCommentsCounts: Record<string, number> = {};
let globalLoading = true;

let isListening = false;

let subscribers: (() => void)[] = [];

function notifySubscribers() {
  subscribers.forEach(sub => sub());
}

export function getGlobalContents(): Content[] {
  return globalContents;
}

export function useContent(activeTab?: string) {
  const [_, setTick] = useState(0);

  useEffect(() => {
    const triggerUpdate = () => setTick(t => t + 1);
    subscribers.push(triggerUpdate);

    if (!isListening) {
      isListening = true;

      const qContent = query(collection(db, "content"));
      onSnapshot(qContent, (snap) => {
        let list: Content[] = [];
        snap.forEach((doc) => {
          const data = doc.data();
          const item: Content = {
            ...data,
            id: doc.id,
            type: (data.type === "tv" || data.kind === "tv") ? "tv" : "movie",
            kind: (data.type === "tv" || data.kind === "tv") ? "tv" : "movie",
            title: data.title || "Untitled",
            synopsis: data.synopsis || "No synopsis available.",
            releaseDate: data.releaseDate || new Date().toISOString().split('T')[0],
            rating: data.rating || "0.0",
            duration: data.duration || "N/A",
            poster: data.poster || data.posterUrl || undefined,
            backdrop: data.backdrop || data.heroPosterUrl || data.poster || data.posterUrl || undefined,
            embedUrl: data.embedUrl || undefined,
            trailerUrl: data.trailerUrl || undefined,
            streamUrl: data.streamUrl || data.streamingUrl || undefined,
            genres: Array.isArray(data.genres)
              ? data.genres
              : typeof data.genres === "string"
                ? data.genres.split(",").map((s) => s.trim()).filter(Boolean)
                : [],
            year: data.year || (data.releaseDate ? new Date(data.releaseDate).getFullYear() : new Date().getFullYear()),
            useExternalPopup: data.useExternalPopup || false,
            useExternalTab: data.useExternalTab || false,
          } as Content;
          list.push(item);
        });
        list.sort((a, b) => {
          const da = a.createdAt?.seconds || 0;
          const db = b.createdAt?.seconds || 0;
          return db - da;
        });
        globalContents = list;
        globalLoading = false;
        notifySubscribers();
      }, (error) => {
        console.error("Error fetching content:", error);
        globalLoading = false;
        notifySubscribers();
      });

      const qHero = query(collection(db, "hero_slots"), orderBy("slotIndex", "asc"));
      onSnapshot(qHero, (snap) => {
        const slots: HeroSlot[] = [];
        snap.forEach((doc) => slots.push({ ...doc.data() as HeroSlot, id: doc.id }));
        globalHeroSlots = slots;
        notifySubscribers();
      }, (error) => console.error("Error fetching hero slots:", error));

      const qBottomHero = query(collection(db, "bottom_hero_slots"), orderBy("slotIndex", "asc"));
      onSnapshot(qBottomHero, (snap) => {
        const slots: HeroSlot[] = [];
        snap.forEach((doc) => slots.push({ ...doc.data() as HeroSlot, id: doc.id }));
        globalBottomHeroSlots = slots;
        notifySubscribers();
      }, (error) => console.error("Error fetching bottom hero slots:", error));

      const qComments = query(collection(db, "comments"));
      onSnapshot(qComments, snap => {
        const counts: Record<string, number> = {};
        const monthlyCounts: Record<string, number> = {};
        snap.docs.forEach(doc => {
          const data = doc.data();
          if (data.contentId && !data.parentId) {
            counts[data.contentId] = (counts[data.contentId] || 0) + 1;
            if (isDateInCurrentPeriod(data.createdAt)) {
              monthlyCounts[data.contentId] = (monthlyCounts[data.contentId] || 0) + 1;
            }
          }
        });
        globalCommentsCounts = counts;
        globalMonthlyCommentsCounts = monthlyCounts;
        notifySubscribers();
      }, (error) => console.error("Error fetching comments:", error));
    }

    return () => {
      subscribers = subscribers.filter(s => s !== triggerUpdate);
    };
  }, []);

  const rawContents = useMemo(() => {
    return globalContents.map(c => ({
      ...c,
      commentsCount: globalCommentsCounts[c.id] || 0,
      monthlyCommentsCount: globalMonthlyCommentsCounts[c.id] || 0
    }));
  }, [globalContents, globalCommentsCounts, globalMonthlyCommentsCounts, _]);

  const mergedContents = useMemo(() => {
    const mains = rawContents.filter(c => 
      !c.isSubPage && 
      !c.syncMainId && 
      !String(c.id).includes("-page")
    );
    const updated = mains.map(main => {
      const subPages = rawContents.filter(c => c.syncMainId === main.id || c.id === `${main.id}-page`);
      const allCommentsCount = main.commentsCount + subPages.reduce((sum, c) => sum + c.commentsCount, 0);
      const allMonthlyCommentsCount = main.monthlyCommentsCount + subPages.reduce((sum, c) => sum + c.monthlyCommentsCount, 0);
      return { ...main, commentsCount: allCommentsCount, monthlyCommentsCount: allMonthlyCommentsCount };
    });
    return updated;
  }, [rawContents, _]);

  const currentPeriod = isDateInCurrentPeriod(new Date());

  const getViews = (c: Content) => {
    if (!c.monthlyStats) return 0;
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
    const periodKey = `${year}-${String(month + 1).padStart(2, '0')}-16`;
    return c.monthlyStats[periodKey]?.views || 0;
  };

  const getScore = (c: Content) => {
    const views = getViews(c);
    const comments = c.monthlyCommentsCount || 0;
    return (views * 0.4) + (comments * 0.6);
  };

  const latestAll = useMemo(() => {
    if (activeTab && activeTab !== "home" && activeTab !== "latest") return [];
    return [...mergedContents].filter(c => c.status !== "coming_soon").slice(0, 20);
  }, [mergedContents, activeTab, _]);

  const latestMovies = useMemo(() => {
    if (activeTab && activeTab !== "movie" && activeTab !== "latest") return [];
    return mergedContents.filter(c => c.type === "movie" && c.status !== "coming_soon").slice(0, 20);
  }, [mergedContents, activeTab, _]);

  const latestTv = useMemo(() => {
    if (activeTab && activeTab !== "tv" && activeTab !== "latest") return [];
    return mergedContents.filter(c => c.type === "tv" && c.status !== "coming_soon").slice(0, 20);
  }, [mergedContents, activeTab, _]);

  const popularAll = useMemo(() => {
    if (activeTab && activeTab !== "home" && activeTab !== "popular") return [];
    return [...mergedContents].filter(c => c.status !== "coming_soon").sort((a, b) => {
      const scoreA = getScore(a);
      const scoreB = getScore(b);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return Number(b.rating || 0) - Number(a.rating || 0);
    }).slice(0, 20);
  }, [mergedContents, currentPeriod, activeTab, _]);

  const popularMovie = useMemo(() => {
    if (activeTab && activeTab !== "movie" && activeTab !== "popular") return [];
    return mergedContents.filter(c => c.type === "movie" && c.status !== "coming_soon").sort((a, b) => {
      const scoreA = getScore(a);
      const scoreB = getScore(b);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return Number(b.rating || 0) - Number(a.rating || 0);
    }).slice(0, 20);
  }, [mergedContents, currentPeriod, activeTab, _]);

  const popularTv = useMemo(() => {
    if (activeTab && activeTab !== "tv" && activeTab !== "popular") return [];
    return mergedContents.filter(c => c.type === "tv" && c.status !== "coming_soon").sort((a, b) => {
      const scoreA = getScore(a);
      const scoreB = getScore(b);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return Number(b.rating || 0) - Number(a.rating || 0);
    }).slice(0, 20);
  }, [mergedContents, currentPeriod, activeTab, _]);

  const topAll = useMemo(() => {
    if (activeTab && activeTab !== "home") return [];
    return [...mergedContents].filter(c => c.status !== "coming_soon").sort((a, b) => {
      const va = getViews(a);
      const vb = getViews(b);
      if (va !== vb) return vb - va;
      return Number(b.rating || 0) - Number(a.rating || 0);
    }).slice(0, 15);
  }, [mergedContents, currentPeriod, activeTab, _]);

  const topMovies = useMemo(() => {
    if (activeTab && activeTab !== "movie") return [];
    return mergedContents.filter(c => c.type === "movie" && c.status !== "coming_soon").sort((a, b) => {
      const va = getViews(a);
      const vb = getViews(b);
      if (va !== vb) return vb - va;
      return Number(b.rating || 0) - Number(a.rating || 0);
    }).slice(0, 15);
  }, [mergedContents, currentPeriod, activeTab, _]);

  const topTv = useMemo(() => {
    if (activeTab && activeTab !== "tv") return [];
    return mergedContents.filter(c => c.type === "tv" && c.status !== "coming_soon").sort((a, b) => {
      const va = getViews(a);
      const vb = getViews(b);
      if (va !== vb) return vb - va;
      return Number(b.rating || 0) - Number(a.rating || 0);
    }).slice(0, 15);
  }, [mergedContents, currentPeriod, activeTab, _]);

  const getTime = (val: any) => {
    if (!val) return 0;
    if (typeof val.toMillis === 'function') return val.toMillis();
    if (val.seconds) return val.seconds * 1000;
    return new Date(val).getTime() || 0;
  };

  const comingSoonAll = useMemo(() => {
    if (activeTab && activeTab !== "upcoming") return [];
    return mergedContents.filter(c => c.status === "coming_soon").sort((a, b) => {
      return getTime(b.createdAt) - getTime(a.createdAt);
    });
  }, [mergedContents, activeTab, _]);

  const comingSoonMovie = useMemo(() => {
    if (activeTab && activeTab !== "upcoming") return [];
    return mergedContents.filter(c => c.type === "movie" && c.status === "coming_soon").sort((a, b) => {
      return getTime(b.createdAt) - getTime(a.createdAt);
    });
  }, [mergedContents, activeTab, _]);

  const comingSoonTv = useMemo(() => {
    if (activeTab && activeTab !== "upcoming") return [];
    return mergedContents.filter(c => c.type === "tv" && c.status === "coming_soon").sort((a, b) => {
      return getTime(b.createdAt) - getTime(a.createdAt);
    });
  }, [mergedContents, activeTab, _]);

  // For latest episodes, we flatten all episodes from all TV series, sort them by upload date.
  const latestEpisodes = useMemo(() => {
    if (activeTab && activeTab !== "home" && activeTab !== "tv") return [];
    let allEps: any[] = [];
    mergedContents.filter(c => c.type === "tv").forEach(tv => {
      const episodes = tv.episodes || [];
      if (episodes.length === 0) return;
      // Find the latest episode for this TV show by date, fallback to highest episode number
      const latestEp = [...episodes].sort((a, b) => {
        const da = a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : (typeof a.updatedAt === "string" ? new Date(a.updatedAt).getTime() : 0);
        const db = b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : (typeof b.updatedAt === "string" ? new Date(b.updatedAt).getTime() : 0);
        if (db !== da) return db - da;
        return (b.number || 0) - (a.number || 0);
      })[0];
      
      const ep = latestEp;
      const ytId = getYouTubeId(ep.url || "");
      const epThumb = (ep.thumbnail && !ep.thumbnail.includes("videoseries")) ? ep.thumbnail : null;
      const finalThumb = epThumb || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null);
      
      allEps.push({
        ...tv,
        originalId: tv.id,
        episodeId: `${tv.id}-${ep.number}`,
        episode: ep,
        url: ep.url,
        title: tv.title,
        episodeNumber: ep.number,
        episodeTitle: ep.title,
        episodeThumbnail: finalThumb,
        poster: tv.poster,
        backdrop: tv.backdrop,
        sortDate: ep.updatedAt || tv.updatedAt || tv.createdAt || { seconds: 0 }
      });
    });
    return allEps.sort((a, b) => {
      const da = typeof a.sortDate === 'string' ? new Date(a.sortDate).getTime() : a.sortDate?.seconds ? a.sortDate.seconds * 1000 : 0;
      const db = typeof b.sortDate === 'string' ? new Date(b.sortDate).getTime() : b.sortDate?.seconds ? b.sortDate.seconds * 1000 : 0;
      return db - da;
    }).slice(0, 20);
  }, [mergedContents, activeTab, _]);

  const homeHeroContent = useMemo(() => {
    if (activeTab && activeTab !== "home") return [];
    const sortedSlots = [...globalHeroSlots].filter(s => !s.placement || s.placement === "home").sort((a, b) => a.slotIndex - b.slotIndex);
    const selected = sortedSlots.map(s => {
      const c = mergedContents.find(c => c.id === s.contentId);
      if (c) {
        return { ...c, embedUrl: s.embedUrl || c.embedUrl } as Content;
      }
      return null;
    }).filter(Boolean) as Content[];
    if (selected.length === 0 && mergedContents.length > 0) return mergedContents.filter(c => c.isTrending || c.isNew).slice(0, 5);
    return selected;
  }, [globalHeroSlots, mergedContents, activeTab, _]);

  const movieHeroContent = useMemo(() => {
    if (activeTab && activeTab !== "movie") return [];
    const sortedSlots = [...globalHeroSlots].filter(s => s.placement === "movie").sort((a, b) => a.slotIndex - b.slotIndex);
    const selected = sortedSlots.map(s => {
      const c = mergedContents.find(c => c.id === s.contentId);
      if (c) {
        return { ...c, embedUrl: s.embedUrl || c.embedUrl } as Content;
      }
      return null;
    }).filter(Boolean) as Content[];
    if (selected.length === 0 && mergedContents.length > 0) return mergedContents.filter(c => c.type === "movie").slice(0, 5);
    return selected;
  }, [globalHeroSlots, mergedContents, activeTab, _]);

  const tvHeroContent = useMemo(() => {
    if (activeTab && activeTab !== "tv") return [];
    const sortedSlots = [...globalHeroSlots].filter(s => s.placement === "tv").sort((a, b) => a.slotIndex - b.slotIndex);
    const selected = sortedSlots.map(s => {
      const c = mergedContents.find(c => c.id === s.contentId);
      if (c) {
        return { ...c, embedUrl: s.embedUrl || c.embedUrl } as Content;
      }
      return null;
    }).filter(Boolean) as Content[];
    if (selected.length === 0 && mergedContents.length > 0) return mergedContents.filter(c => c.type === "tv").slice(0, 5);
    return selected;
  }, [globalHeroSlots, mergedContents, activeTab, _]);

  const homeBottomHeroContent = useMemo(() => {
    if (activeTab && activeTab !== "home") return [];
    const sortedSlots = [...globalBottomHeroSlots].filter(s => !s.placement || s.placement === "home").sort((a, b) => a.slotIndex - b.slotIndex);
    const selected = sortedSlots.map(s => mergedContents.find(c => c.id === s.contentId)).filter(Boolean) as Content[];
    if (selected.length === 0) return mergedContents.filter(c => c.isTrending).slice(0, 8);
    return selected;
  }, [globalBottomHeroSlots, mergedContents, activeTab, _]);

  return { 
    contents: mergedContents, 
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
    topMovies,
    topTv,
    comingSoonAll,
    comingSoonMovie,
    comingSoonTv,
    latestEpisodes,
    loading: globalLoading 
  };
}
