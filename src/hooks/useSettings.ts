import { useState, useEffect } from "react";
import { db, doc, onSnapshot } from "../lib/firebase";

export interface WebSettings {
  isMaintenance: boolean;
  seoTitle: string;
  seoDescription: string;
  brandLogo: string;
  contactEmail: string;
  footerText: string;
  appDownloadLink?: string;
  dailymotionVideoUrl?: string;
  driveApiKeys?: string[];
  adImage?: string;
  verticalLogo?: string;
  adUrl?: string;
  bottomAdLeftImage?: string;
  bottomAdLeftUrl?: string;
  bottomAdRightImage?: string;
  bottomAdRightUrl?: string;
  topAdLeftImage?: string;
  topAdLeftUrl?: string;
  topAdRightImage?: string;
  topAdRightUrl?: string;
  mainServerName?: string;
  linkvertiseToken?: string;
  maxGlobalComments?: number;
  downloadTutorials?: { name: string; url: string }[];
  systemNotification?: string;
  systemNotificationActive?: boolean;
  navbarNotifications?: string[];
  navbarNotificationActive?: boolean;
  navbarNotificationProbability?: number;
  discordUrl?: string;
  telegramUrl?: string;
  internalAdImage?: string;
  internalAdUrl?: string;
  internalUnderHeroAdImage?: string;
  internalUnderHeroAdUrl?: string;
  centerBannerHeroImage?: string;
  centerBannerHeroUrl?: string;
  centerBanners?: { id: string; image: string; url: string; page?: "home" | "movie" | "tv" | "soon" }[];
  adPopups?: { id: string; url: string; percentage: number; active: boolean }[];
  adVideos?: { id: string; url: string; linkUrl: string; percentage: number; active: boolean }[];
  adPopupYouTubeUrl?: string; // keeping for backward compatibility temporarily
  adPopupPercentage?: number; // keeping for backward compatibility temporarily
  staffs?: { email: string; role: "owner" | "admin" }[];
  blockNetworkActive?: boolean;
  blockedISPs?: string[];
  error500Title?: string;
  error500Msg?: string;
  simulateNetworkError?: boolean;
  hiddenGenres?: string[];
}

export interface GenreSettings {
  list: string[];
}

let cachedSettings: WebSettings | null = null;
let cachedGenres: string[] = [
  "Action", "Comedy", "Drama", "Fantasy", "Horror", "Mystery", "Romance", "Thriller", "Sci-Fi"
];
let cachedTags: string[] = [
  "NEW", "HOT", "HD", "KIDS"
];

let settingsSubscribers: ((data: WebSettings | null) => void)[] = [];
let genreSubscribers: ((data: string[]) => void)[] = [];
let tagSubscribers: ((data: string[]) => void)[] = [];

let isSettingsListening = false;
let isGenresListening = false;
let isTagsListening = false;

function notifySettingsSubscribers() {
  settingsSubscribers.forEach(sub => sub(cachedSettings));
}

function notifyGenreSubscribers() {
  genreSubscribers.forEach(sub => sub(cachedGenres));
}

function notifyTagSubscribers() {
  tagSubscribers.forEach(sub => sub(cachedTags));
}

export function useSettings() {
  const [settings, setSettings] = useState<WebSettings | null>(cachedSettings);
  const [genres, setGenres] = useState<string[]>(cachedGenres);
  const [tags, setTags] = useState<string[]>(cachedTags);

  useEffect(() => {
    const handleSettingsUpdate = (newData: WebSettings | null) => setSettings(newData);
    settingsSubscribers.push(handleSettingsUpdate);

    if (!isSettingsListening) {
      isSettingsListening = true;
      onSnapshot(doc(db, "settings", "main"), (docSnap) => {
        if (docSnap.exists()) {
          cachedSettings = docSnap.data() as WebSettings;
        } else {
          cachedSettings = {
            isMaintenance: false,
            seoTitle: "Vinet AI",
            seoDescription: "Watch your favorite movies and TV shows.",
            brandLogo: "",
            contactEmail: "admin@vinet.com",
            footerText: "© 2026 Vinet. All rights reserved.",
            appDownloadLink: "",
            dailymotionVideoUrl: "",
            adImage: "",
            adUrl: "",
            mainServerName: "Main Player",
            linkvertiseToken: "",
            maxGlobalComments: 100,
            downloadTutorials: [],
            discordUrl: "",
            telegramUrl: "https://t.me/+Yt435-iYNcc1MWJl",
            internalAdImage: "",
            internalAdUrl: "",
            internalUnderHeroAdImage: "",
            internalUnderHeroAdUrl: "",
            centerBannerHeroImage: "",
            centerBannerHeroUrl: "",
            topAdLeftImage: "",
            topAdLeftUrl: "",
            topAdRightImage: "",
            topAdRightUrl: "",
            adPopups: [],
            adPopupYouTubeUrl: "",
            adPopupPercentage: 0,
            driveApiKeys: [],
            blockNetworkActive: false,
            blockedISPs: ["Indihome"],
            error500Title: "Error 500: Database Connection Failed",
            error500Msg: "We could not establish a connection to our high-speed media database through your ISP network. Your network provider is actively restricting our secure servers.",
            simulateNetworkError: false,
          };
        }
        notifySettingsSubscribers();
      }, (error) => {
        console.error("Error fetching main settings:", error);
      });
    }

    return () => {
      settingsSubscribers = settingsSubscribers.filter(s => s !== handleSettingsUpdate);
    };
  }, []);

  useEffect(() => {
    const handleGenreUpdate = (newData: string[]) => setGenres(newData);
    genreSubscribers.push(handleGenreUpdate);

    if (!isGenresListening) {
      isGenresListening = true;
      onSnapshot(doc(db, "settings", "genres"), (docSnap) => {
        if (docSnap.exists() && docSnap.data().list) {
          cachedGenres = docSnap.data().list;
        }
        notifyGenreSubscribers();
      }, (error) => {
        console.error("Error fetching genres:", error);
      });
    }

    return () => {
      genreSubscribers = genreSubscribers.filter(s => s !== handleGenreUpdate);
    };
  }, []);

  useEffect(() => {
    const handleTagUpdate = (newData: string[]) => setTags(newData);
    tagSubscribers.push(handleTagUpdate);

    if (!isTagsListening) {
      isTagsListening = true;
      onSnapshot(doc(db, "settings", "tags"), (docSnap) => {
        if (docSnap.exists() && docSnap.data().list) {
          cachedTags = docSnap.data().list;
        }
        notifyTagSubscribers();
      }, (error) => {
        console.error("Error fetching tags:", error);
      });
    }

    return () => {
      tagSubscribers = tagSubscribers.filter(s => s !== handleTagUpdate);
    };
  }, []);

  return { settings, genres, tags };
}
