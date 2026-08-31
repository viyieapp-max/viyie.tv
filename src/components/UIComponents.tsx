import React, { memo, useState, useEffect, ReactNode, useRef } from 'react';
import { ChevronRight, ChevronLeft, LucideIcon } from 'lucide-react';
export function LanguageSwitcher() {
  return null;
}


const rand = (min: number, max: number) => 
  Math.floor(Math.random() * (max - min + 1)) + min;

const SparkleIcon = () => (
  <svg viewBox="0 0 160 160" stroke="none" className="w-full h-full fill-current">
    <path d="M80 0C80 0 84.2846 41.2925 101.43 58.5695C118.574 75.8455 160 80 160 80C160 80 118.574 84.1545 101.43 101.431C84.2846 118.708 80 160 80 160C80 160 75.7154 118.708 58.5695 101.431C41.4255 84.1545 0 80 0 80C0 80 41.4255 75.8455 58.5695 58.5695C75.7154 41.2925 80 0 80 0Z" />
  </svg>
);

const Sparkle = () => {
  const [style, setStyle] = useState({});

  useEffect(() => {
    // Generate initial random values
    setStyle({
      top: `${rand(-40, 80)}%`,
      left: `${rand(-10, 100)}%`,
      animationDelay: `${rand(0, 1000)}ms`,
      animationDuration: `${rand(1000, 2000)}ms`,
      scale: rand(50, 100) / 100,
    });
  }, []);

  return (
    <span
      className="absolute block pointer-events-none text-yellow-300 z-20 animate-sparkle"
      style={{
        ...style,
        width: '1.5em',
        height: '1.5em',
        opacity: 0,
      }}
    >
      <SparkleIcon />
    </span>
  );
};

export function MagicText({ children }: { children: ReactNode }) {
  const [sparkles, setSparkles] = useState<number[]>([1, 2, 3]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSparkles((current) => {
        const next = [...current.slice(1), Date.now()];
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="relative inline-block magic-text-container z-10">
      {sparkles.map((id) => (
        <Sparkle key={id} />
      ))}
      <span className="relative z-10 magic-text">
        {children}
      </span>
    </span>
  );
}

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  fallbackSrc?: string | null;
  alt: string;
  quality?: 'low' | 'medium' | 'high';
  priority?: boolean;
}

const FALLBACK_POSTER_URL = "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=1000";

function OptimizedImageComponent({ src, alt, className, quality = 'medium', priority = false, onError, fallbackSrc, ...props }: OptimizedImageProps) {
  const [imgSrc, setImgSrc] = useState<string | undefined>(src);
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    setImgSrc(src);
    setErrorCount(0);
  }, [src]);

  const getOptimizedUrl = (url?: string) => {
    if (!url) return undefined;
    if (url.includes('tmdb.org/t/p/original')) {
      const size = quality === 'low' ? 'w185' : quality === 'medium' ? 'w500' : 'w780';
      return url.replace('/t/p/original', `/t/p/${size}`);
    }
    return url;
  };

  const optimizedSrc = getOptimizedUrl(imgSrc);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (onError) onError(e);
    if (errorCount === 0 && fallbackSrc) {
      setImgSrc(fallbackSrc);
      setErrorCount(1);
    } else {
      setImgSrc(FALLBACK_POSTER_URL);
      setErrorCount(2);
      
      const target = e.target as HTMLImageElement;
      target.style.objectFit = "contain";
      target.style.padding = "18px";
      target.style.opacity = "0.22";
      target.style.background = "#0f0f0f";
      target.style.filter = "grayscale(1) contrast(0.95)";
    }
  };

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget;
    // YouTube returns a 120x90 placeholder when highres thumb does not exist.
    // Standard blank/broken images on some sites are also tiny, e.g. < 130px width.
    if ((img.naturalWidth === 120 && img.naturalHeight === 90) || (img.src && img.src.includes('youtube') && img.naturalWidth <= 120)) {
      handleError(e);
    }
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img
        src={optimizedSrc || fallbackSrc || FALLBACK_POSTER_URL}
        alt={alt}
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover transition-all duration-300"
        loading={priority ? undefined : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
    </div>
  );
}

export const OptimizedImage = memo(OptimizedImageComponent);

export function SectionHeader({
  title,
  description,
  icon: Icon,
  accent,
  count,
  onViewAll,
  children,
  disableTitleClick,
  className = "",
  style = {},
  innerStyle = {},
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description: string;
  icon?: React.ElementType;
  accent: string;
  count: number;
  onViewAll?: () => void;
  children?: React.ReactNode;
  disableTitleClick?: boolean;
  className?: string;
  style?: React.CSSProperties;
  innerStyle?: React.CSSProperties;
}) {
  const isClickable = onViewAll && !disableTitleClick;

  return (
    <div 
      className={`flex flex-col sm:flex-row sm:items-end justify-between gap-1.5 mb-2.5 md:mb-3 relative z-30 pointer-events-auto ${className}`}
      style={style}
    >
      <div 
        onClick={isClickable ? onViewAll : undefined}
        className={`min-w-0 flex-1 ${isClickable ? 'cursor-pointer group/header select-none' : ''} relative z-30 pointer-events-auto`}
      >
        <div className="min-w-0 section-header-title-container" style={innerStyle}>
          <div className="flex items-center gap-2 mb-1 flex-wrap sm:flex-nowrap">
            {Icon && <Icon className="w-5 h-5 text-red-600 shrink-0" />}
            <h2 className={`font-cocogoose text-xl sm:text-2xl md:text-3xl font-black text-white tracking-normal truncate transition-colors duration-300 ${isClickable ? 'group-hover/header:text-red-500' : ''}`}>
              {title}
            </h2>
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 rounded-md border border-white/5 shrink-0">
               <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-gradient-to-br ${accent} shadow-[0_0_8px_rgba(255,255,255,0.2)]`} />
               <span className="text-[9px] sm:text-[10px] text-white/50 font-medium tracking-widest">{count}</span>
            </div>
          </div>
          
          {/* Subtitle - precisely aligned to the content left edge with simple chevron > inline right next to it */}
          {description && (
            <div className="flex items-center gap-1.5 mt-1">
              <p className={`text-[9px] sm:text-[10px] md:text-[11px] text-white/40 font-normal tracking-[0.1em] leading-relaxed line-clamp-1 transition-colors duration-300 ${isClickable ? 'group-hover/header:text-white/60' : ''}`}>
                {description}
              </p>
              {isClickable && (
                <ChevronRight className="w-4 h-4 text-white/40 transition-all duration-300 group-hover/header:translate-x-1 group-hover/header:text-red-500 shrink-0" />
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Any children/toolbar buttons can be rendered here */}
      {children && (
        <div className="flex items-center gap-4 shrink-0 overflow-x-auto hide-scroll-bar py-1">
          {children}
        </div>
      )}
    </div>
  );
}

export function SimplePagination({
  page,
  totalPages,
  setPage,
}: {
  page: number;
  totalPages: number;
  setPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  let start = Math.max(1, page - 2);
  let end = Math.min(totalPages, page + 2);

  if (end - start < 4) {
    if (start === 1) {
      end = Math.min(totalPages, start + 4);
    } else if (end === totalPages) {
      start = Math.max(1, end - 4);
    }
  }

  const pages = [];
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-8 mb-4">
      <button
        disabled={page === 1}
        onClick={() => setPage(page - 1)}
        className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/70 disabled:opacity-40 hover:bg-white/10 hover:text-white transition-all"
      >
        <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>
      
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => setPage(p)}
          className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full text-[11px] sm:text-xs font-medium transition-all ${
            p === page
              ? "bg-red-600 text-white border border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.3)]"
              : "bg-transparent text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          {p}
        </button>
      ))}

      <button
        disabled={page === totalPages}
        onClick={() => setPage(page + 1)}
        className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/70 disabled:opacity-40 hover:bg-white/10 hover:text-white transition-all"
      >
        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>
    </div>
  );
}

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function CollectionEmpty({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-white/40" />
      </div>
      <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
      <p className="text-sm text-white/50 max-w-sm mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export function MediaBanner({
  mediaUrl,
  linkUrl,
  className = "w-full h-full object-contain object-center",
}: {
  mediaUrl: string;
  linkUrl?: string;
  className?: string;
}) {
  if (!mediaUrl) return null;

  const isIframeCode = mediaUrl.trim().startsWith("<iframe") || mediaUrl.includes("youtube.com/embed") || mediaUrl.includes("player.vimeo.com") || mediaUrl.includes("embed.screenapp.io") || mediaUrl.includes("embed=true");
  const isVideo = mediaUrl.match(/\.(mp4|webm|ogg)$/i);

  let content;
  if (isIframeCode) {
    if (mediaUrl.trim().startsWith("<iframe")) {
      content = (
        <div
          className={`w-full h-full flex justify-center items-center [&>iframe]:max-w-full [&>iframe]:max-h-full [&>iframe]:object-contain ${className}`}
          dangerouslySetInnerHTML={{ __html: mediaUrl }}
        />
      );
    } else {
       content = (
         <iframe
           src={mediaUrl}
           className={`w-full h-full object-contain ${className}`}
           allow="autoplay; encrypted-media"
           allowFullScreen
         />
       );
    }
  } else if (isVideo) {
    content = (
      <video
        src={mediaUrl}
        autoPlay
        loop
        muted
        playsInline
        className={className}
      />
    );
  } else {
    content = (
      <img
        src={mediaUrl}
        alt="Promotional Ad"
        className={className}
        referrerPolicy="no-referrer"
      />
    );
  }

  if (linkUrl && linkUrl !== "#" && !isIframeCode) {
    return (
      <a href={linkUrl} target="_blank" rel="noreferrer" className="block w-full h-full relative">
        {content}
      </a>
    );
  }

  return <div className="w-full h-full relative">{content}</div>;
}

interface AudioPlayerProps {
  isPlaying: boolean;
  onPause: () => void;
  enabled: boolean;
  trackIndex: number;
  tracks?: { title: string; url: string }[];
}

const DEFAULT_TRACKS = ["/k1.mp3", "/k2.mp3"];

export function AudioPlayer({ isPlaying, onPause, enabled, trackIndex, tracks }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const trackUrls = tracks ? tracks.map(t => t.url) : DEFAULT_TRACKS;
    if (trackUrls.length === 0) return;
    const currentTrackUrl = trackUrls[trackIndex] || trackUrls[0] || "";
    if (!currentTrackUrl) return;

    // Create audio element if it doesn't exist
    if (!audioRef.current) {
      audioRef.current = new Audio(currentTrackUrl);
      audioRef.current.loop = true;
      audioRef.current.volume = 0.3;
    }

    const audio = audioRef.current;

    // Handle track changes smoothly
    const currentOrigin = window.location.origin;
    const cleanSrc = audio.src.replace(currentOrigin, "");
    
    // Check if the current src matches the expected relative/absolute track URL
    if (cleanSrc !== currentTrackUrl && audio.src !== currentTrackUrl) {
      const wasPlaying = !audio.paused;
      
      // Stop and reload the source
      audio.pause();
      audio.src = currentTrackUrl;
      audio.load();
      
      if (wasPlaying && isPlaying && enabled) {
        audio.play().catch(() => onPause());
      }
    }

    // Handle play/pause
    if (isPlaying && enabled) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          if (e.name !== 'AbortError') {
             console.log("Autoplay blocked", e);
             onPause();
          }
        });
      }
    } else {
      audio.pause();
    }

    return () => {
    };
  }, [isPlaying, enabled, trackIndex, onPause, tracks]);

  return null;
}
