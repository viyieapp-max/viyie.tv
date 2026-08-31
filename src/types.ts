export interface Episode {
  number: number;
  title: string;
  url: string; // the primary embed URL
  thumbnail?: string;
  duration?: string;
  updatedAt?: any;
  parentId?: string;
  parentTitle?: string;
  servers?: AlternateServer[];
  useExternalPopup?: boolean;
  useExternalTab?: boolean;
  useSandbox?: boolean;
  // Player styling
  playerScale?: number;
  playerTranslateX?: number;
  playerTranslateY?: number;
  // Custom Player
  isCustomPlayer?: boolean;
  customSubtitle?: string;
  customResolutions?: string;
  forceIframe?: boolean;
  play1DisplayName?: string;
  play2DisplayName?: string;
  hidePlay1?: boolean;
  dateUpload?: string;
  hideThumbnail?: boolean;
  subtitles?: { lang: string; url: string }[];
  thumbnails?: string[];
}

export interface Season {
  number: number;
  title?: string;
  episodes: Episode[];
}

export interface AlternateServer {
  name: string;
  embedUrl: string;
  streamUrl?: string;
  useExternalPopup?: boolean;
  useExternalTab?: boolean;
  useSandbox?: boolean;
  // Player styling
  playerScale?: number;
  playerTranslateX?: number;
  playerTranslateY?: number;
  // Custom Player
  isCustomPlayer?: boolean;
  customSubtitle?: string;
  customResolutions?: string; // stringified JSON array
  isViyiePlus?: boolean;
  visible?: boolean;
}

export interface Content {
  id: string | number;
  type?: "movie" | "tv";
  status?: "released" | "coming_soon";
  title: string;
  originalTitle?: string;
  director?: string;
  quality?: string;
  synopsis: string;
  releaseDate: string;
  year: number;
  rating: string;
  duration: string;
  poster: string;
  backdrop: string;
  mainServerName?: string;
  downloadLinks?: { name: string; url: string }[];
  backdropPosition?: string; // e.g. "50% 50%"
  backdropScale?: number; // e.g. 1.2
  backdropRotate?: number; // e.g. 45
  embedUrl: string;
  streamUrl?: string;
  play1DisplayName?: string;
  play2DisplayName?: string;
  hidePlay1?: boolean;
  servers?: AlternateServer[];
  genres: string[];
  tags?: string[];
  isTrending?: boolean;
  isNew?: boolean;
  isHero?: boolean;
  kind?: string;
  views?: number;
  likes?: string[];
  likesCount?: number;
  commentsCount?: number;
  monthlyCommentsCount?: number;
  monthlyStats?: {
    [period: string]: {
      views?: number;
      likes?: number;
    };
  };
  useExternalPopup?: boolean;
  useExternalTab?: boolean;
  useSandbox?: boolean;
  // Player styling
  playerScale?: number;
  playerTranslateX?: number;
  playerTranslateY?: number;
  // Custom Player
  isCustomPlayer?: boolean;
  customSubtitle?: string;
  customResolutions?: string;
  forceIframe?: boolean;
  subtitles?: { lang: string; url: string }[];
  thumbnails?: string[];
  episodes?: Episode[];
  seasons?: Season[];
  studio?: string;
  createdAt?: any;
  updatedAt?: any;
  seasonConnections?: {
    seasonNumber: number;
    contentId: string;
    title?: string;
  }[];
  customTags?: string[];
  networks?: string[];
  cast?: string[];

  // Legacy fields for compatibility
  posterUrl?: string;
  heroPosterUrl?: string;
  trailerUrl?: string;
  streamingUrl?: string;
  isSubPage?: boolean;
  syncMainId?: string | number;
  visible?: boolean;
  yearNumber?: number;
}

export interface Comment {
  id?: string;
  contentId: string;
  uid: string;
  userName: string;
  userUsername?: string;
  userPhoto?: string;
  userTier?: string;
  userBadgeTitle?: string;
  text: string;
  timestamp: any;
}
export type Movie = Content;

export interface HeroSlot {
  id: string;
  contentId: string;
  slotIndex: number;
  placement?: "home" | "movie" | "tv";
  embedUrl?: string;
}

export interface RedeemCode {
  id?: string;
  code: string;
  maxUses: number;
  uses: number;
  durationDays: number; // 0 for unlimited duration
  expiresAt: any; // Code expiration
  createdAt: any;
  type: "redeem" | "link";
}
