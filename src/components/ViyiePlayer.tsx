// -----------------------------------------------------------------------------
// VIYIEPLAYER INTEGRATION & PORTING GUIDE FOR EXTERNAL AI OR DEVELOPERS
// -----------------------------------------------------------------------------
// Jika Anda (atau AI Anda) ingin memindahkan ViyiePlayer ke web/repo GitHub lain,
// silakan perhatikan komponen dan dependensi penting di bawah ini:
//
// 1. DEPENDENSI UTAMA (Instal via npm/yarn di proyek target):
//    - react & react-dom (React 18+)
//    - hls.js (Untuk streaming .m3u8)
//    - lucide-react (Untuk seluruh icon pemutar video)
//    - motion/react atau framer-motion (Untuk animasi transisi & UI yang mulus)
//
// 2. FILE DAN UTILITAS PENDUKUNG YANG HARUS IKUT DIPINDAHKAN:
//    - src/lib/videoUtils.tsx (Fungsi parser SRT/VTT, formatTime, getResolutionBadge)
//    - src/lib/translations.ts (Objek kamus multi-bahasa TRANSLATIONS)
//
// 3. STRUKTUR PROPS UTAMA:
//    interface ViyiePlayerProps {
//      videoUrl: string;       // URL video direct (.mp4) atau playlist HLS (.m3u8)
//      audioUrl?: string;      // URL audio eksternal jika ada dual-track audio
//      audioOffset?: number;   // Selisih waktu sinkronisasi audio (detik)
//      poster?: string;        // URL poster thumbnail video
//      title?: string;         // Judul video yang tampil di UI player
//      subtitles?: {           // Daftar subtitle eksternal
//        lang: string;
//        url: string;
//        offset?: number;      // <--- NEW: Nilai offset subtitle bawaan (detik)
//      }[];
//      videoId?: string;       // ID video unik untuk menyimpan history durasi tonton
//    }
// -----------------------------------------------------------------------------

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Settings, Maximize, Minimize, Check, ChevronLeft, Subtitles, PictureInPicture, X, Info, MoreHorizontal, Sliders, Leaf } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LangCode, TRANSLATIONS, getAutoDetectedLanguage } from '../lib/translations';
import { formatTime, formatTotalMinutes, getResolutionBadge, estimateHeightFromIndex, Cue, parseVttOrSrt, TooltipButton } from '../lib/videoUtils';

const obfuscateUrl = (url: string): string => {
  try {
    const utf8Bytes = encodeURIComponent(url);
    let result = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      const charCode = utf8Bytes.charCodeAt(i);
      result += String.fromCharCode(charCode ^ 0x1A);
    }
    return btoa(result)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch (e) {
    return url;
  }
};

class CustomPlaylistLoader {
  loader: any;
  constructor(config: any) {
    const DefaultLoader = (Hls as any).DefaultConfig?.loader || (Hls as any).DefaultConfig?.pLoader;
    this.loader = new DefaultLoader(config);
  }
  load(context: any, config: any, callbacks: any) {
    const originalSuccess = callbacks.onSuccess;
    callbacks.onSuccess = (response: any, stats: any, ctx: any, networkDetails: any) => {
      try {
        if (typeof response.data === 'string' && response.data.startsWith('VIYIE-SEC:')) {
          const base64 = response.data.substring(10);
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i) ^ 0x2C;
          }
          response.data = new TextDecoder('utf-8').decode(bytes);
        }
      } catch (err) {
        console.warn('Error decrypting playlist:', err);
      }
      originalSuccess(response, stats, ctx, networkDetails);
    };
    this.loader.load(context, config, callbacks);
  }
  abort() {
    this.loader.abort();
  }
  destroy() {
    this.loader.destroy();
  }
}

const isLanguageMatch = (subLang: string, preferredLang: string): boolean => {
  const s = subLang.toLowerCase().trim();
  const p = preferredLang.toLowerCase().trim();
  if (s === p) return true;
  if (s.includes(p) || p.includes(s)) return true;
  
  // Custom mappings for common language codes and names
  const mappings: Record<string, string[]> = {
    indonesian: ['id', 'ind', 'indo', 'indonesian', 'bahasa'],
    english: ['en', 'eng', 'english'],
    malay: ['ms', 'may', 'malay', 'malaysian', 'melayu'],
    spanish: ['es', 'spa', 'spanish', 'castilian'],
    portuguese: ['pt', 'por', 'portuguese'],
    french: ['fr', 'fra', 'fre', 'french'],
    german: ['de', 'ger', 'deu', 'german'],
    japanese: ['ja', 'jp', 'jpn', 'japanese'],
    korean: ['ko', 'kor', 'korean'],
    chinese: ['zh', 'chi', 'zho', 'chinese', 'mandarin', 'cantonese']
  };

  for (const [key, aliases] of Object.entries(mappings)) {
    if (p === key || aliases.includes(p)) {
      if (aliases.includes(s) || s.includes(key)) {
        return true;
      }
    }
  }

  return false;
};

interface ViyiePlayerProps {
  videoUrl: string;
  audioUrl?: string;
  audioOffset?: number;
  poster?: string;
  title?: string;
  subtitles?: { lang: string; url: string; offset?: number }[];
  videoId?: string;
}


export default function ViyiePlayer({ videoUrl, audioUrl, audioOffset = 0, poster, title, subtitles = [], videoId }: ViyiePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const localSubInputRef = useRef<HTMLInputElement>(null);
  const dashPlayerRef = useRef<any>(null);

  const [lang, setLang] = useState<LangCode>(() => getAutoDetectedLanguage());

  const t = useCallback((key: string): string => {
    return TRANSLATIONS[lang]?.[key] || TRANSLATIONS['GB']?.[key] || key;
  }, [lang]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'viyie_player_language') {
        const val = e.newValue as LangCode;
        if (val && ['ID', 'GB', 'JP', 'CN', 'MY', 'HI'].includes(val)) {
          setLang(val);
        }
      }
    };

    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'viyie-language-change') {
        const val = e.data.lang as LangCode;
        if (val && ['ID', 'GB', 'JP', 'CN', 'MY', 'HI'].includes(val)) {
          setLang(val);
        }
      }
    };

    const handleFocus = () => {
      const stored = localStorage.getItem('viyie_player_language') as LangCode;
      if (stored && ['ID', 'GB', 'JP', 'CN', 'MY', 'HI'].includes(stored)) {
        setLang(stored);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('message', handleMessage);
    window.addEventListener('focus', handleFocus);

    const urlParams = new URLSearchParams(window.location.search);
    const paramLang = urlParams.get('lang')?.toUpperCase();
    const storedLang = localStorage.getItem('viyie_player_language')?.toUpperCase();

    if (!paramLang && !storedLang) {
      fetch('/api/detect-lang')
        .then(res => res.json())
        .then(data => {
          if (data.lang && ['ID', 'GB', 'JP', 'CN', 'MY', 'HI'].includes(data.lang)) {
            setLang(data.lang as LangCode);
          }
        })
        .catch(err => {
          console.warn('Failed to detect language from server, using client fallback:', err);
        });
    }

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState<{start: number, end: number}[]>([]);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isWebFullscreen, setIsWebFullscreen] = useState(false);
  const [isPipActive, setIsPipActive] = useState(false);

  const [audioTracks, setAudioTracks] = useState<any[]>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(-1);
  const [isAudioOnly, setIsAudioOnly] = useState<boolean>(false);
  const [selectedAudioOption, setSelectedAudioOption] = useState<string>('default');
  const activeVideoUrl = (selectedAudioOption === 'dubbing-video' && audioUrl) ? audioUrl : videoUrl;
  const [showDubNotice, setShowDubNotice] = useState<boolean>(false);
  const [audioDelay, setAudioDelay] = useState<number>(audioOffset);

  useEffect(() => {
    setAudioDelay(audioOffset);
  }, [audioOffset]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    try {
      window.parent.postMessage({ type: 'viyie-web-fullscreen', value: isWebFullscreen }, '*');
    } catch (e) {
      console.warn("Failed to post message for web fullscreen:", e);
    }

    if (typeof document !== 'undefined') {
      if (isWebFullscreen || isFullscreen) {
        document.body.classList.add('viyie-body-web-fullscreen');
      } else {
        document.body.classList.remove('viyie-body-web-fullscreen');
      }
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('viyie-body-web-fullscreen');
      }
    };
  }, [isWebFullscreen, isFullscreen]);
  
  const [showControls, setShowControls] = useState(true);
  const [isWaiting, setIsWaiting] = useState(true);
  const [isReloading, setIsReloading] = useState(false);
  const [generatedPoster, setGeneratedPoster] = useState<string | null>(null);
  const [bestThumbnails, setBestThumbnails] = useState<string[]>([]);
  const [activeThumbnailIndex, setActiveThumbnailIndex] = useState<number>(0);
  const [detectedThumbnailInfo, setDetectedThumbnailInfo] = useState<{
    sharpness: number;
    hasHumanCharacter: boolean;
    humanScore: number;
    hasTextCharacter: boolean;
    textScore: number;
  } | null>(null);

  const isGeneratingRef = useRef(false);
  const viyieImgThumbnailRef = useRef<(() => void) | null>(null);
  const proxyAudioStartTimeRef = useRef<number>(0);
  const lastLoadedVideoRef = useRef<string | null>(null);

  useEffect(() => {
    if (!videoId) {
      setBestThumbnails([]);
      setGeneratedPoster(null);
      return;
    }
    
    import('../lib/firebase').then(({ db }) => {
      import('firebase/firestore').then(({ doc, getDoc }) => {
        const docRef = doc(db, 'content', videoId);
        getDoc(docRef).then((snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data.thumbnails && data.thumbnails.length > 0) {
              setBestThumbnails(data.thumbnails);
              if (data.posterUrl) {
                setGeneratedPoster(data.posterUrl);
              } else {
                setGeneratedPoster(data.thumbnails[0]);
              }
            } else {
              setBestThumbnails([]);
              setGeneratedPoster(null);
            }
          }
        }).catch((err) => {
          console.warn('getDoc thumbnail sync error:', err);
        });
      });
    });
    }, [videoId]);

  useEffect(() => {
    if (bestThumbnails.length === 0) {
      isGeneratingRef.current = false;
      if (viyieImgThumbnailRef.current) {
        console.log('Triggering automatic thumbnail regeneration as bestThumbnails is empty.');
        viyieImgThumbnailRef.current();
      }
    }
  }, [bestThumbnails.length]);

  const [notice, setNotice] = useState('');
  const [noticeTimeout, setNoticeTimeout] = useState<any>(null);
  const noticeRef = useRef<string>('');

  const [ecoMode, setEcoMode] = useState(false);
  const controlsTimeoutRef = useRef<any>(null);

  const [skipFeedback, setSkipFeedback] = useState<{ side: 'left' | 'right'; text: string; id: number } | null>(null);
  const skipTimeoutRef = useRef<any>(null);

  const triggerSkipFeedback = (side: 'left' | 'right', text: string) => {
    if (skipTimeoutRef.current) {
      clearTimeout(skipTimeoutRef.current);
    }
    setSkipFeedback({
      side,
      text,
      id: Date.now()
    });
    skipTimeoutRef.current = setTimeout(() => {
      setSkipFeedback(null);
    }, 600);
  };


  const [centerIcon, setCenterIcon] = useState<{ type: 'play' | 'pause'; id: number } | null>(null);
  const [isTouchScrubbing, setIsTouchScrubbing] = useState(false);
  const [isMouseScrubbing, setIsMouseScrubbing] = useState(false);
  const isScrubbingRef = useRef(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const lastSeekTimeRef = useRef<number | null>(null);
  const lastPlaybackTimeRef = useRef<number>(0);
  const [showMobileVolume, setShowMobileVolume] = useState(false);
  
  const clickCountRef = useRef<number>(0);
  const clickSideRef = useRef<'left' | 'right' | null>(null);
  const clickTimeoutRef = useRef<any>(null);
  const touchStartRef = useRef<{ rect: DOMRect } | null>(null);

  useEffect(() => {
    if (centerIcon) {
      const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
      // If the video is paused and center icon is 'play', do not auto-clear so the user can tap it to resume!
      if (videoRef.current && videoRef.current.paused && centerIcon.type === 'play') {
        return;
      }
      const t = setTimeout(() => setCenterIcon(null), isTouch ? 3000 : 500);
      return () => clearTimeout(t);
    }
  }, [centerIcon]);

  useEffect(() => {
    if (!showControls) {
      setShowMobileVolume(false);
    }
  }, [showControls]);

  // Rotate poster thumbnails every 10 seconds with a smooth cross-fade when not playing
  useEffect(() => {
    if (isPlaying || bestThumbnails.length <= 1) return;
    const interval = setInterval(() => {
      setActiveThumbnailIndex((prev) => (prev + 1) % bestThumbnails.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [isPlaying, bestThumbnails.length]);

  const [showSettings, setShowSettings] = useState(false);
  const [settingView, setSettingView] = useState('main');
  const [videoDims, setVideoDims] = useState({ width: 0, height: 0 });
  const [playbackRate, setPlaybackRate] = useState(1);
  const [aspectRatio, setAspectRatio] = useState('default');
  const [flip, setFlip] = useState('normal');
  const [rotation, setRotation] = useState<number>(0);
  const [containerSize, setContainerSize] = useState({ width: 16, height: 9 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth || 16,
          height: containerRef.current.clientHeight || 9
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(updateSize);
      resizeObserver.observe(containerRef.current);
    }
    return () => {
      window.removeEventListener('resize', updateSize);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, []);
  const [activeSubtitle, setActiveSubtitle] = useState<string>('Off');
  const [cues, setCues] = useState<Cue[]>([]);
  const [activeCueText, setActiveCueText] = useState<string>('');
  const [activeCue, setActiveCue] = useState<Cue | null>(null);
  const [preciseTime, setPreciseTime] = useState<number>(0);

  const [hlsSubtitles, setHlsSubtitles] = useState<{ lang: string; url: string; isHlsTrack: boolean; trackId: number }[]>([]);
  const [detectedSubtitles, setDetectedSubtitles] = useState<{ lang: string; url: string; offset?: number }[]>([]);
  const [nativeTextTracks, setNativeTextTracks] = useState<{ lang: string; url: string; isNativeTrack: boolean; trackIndex: number }[]>([]);

  const allSubtitles = useMemo(() => {
    const list: { lang: string; url: string; isHlsTrack?: boolean; trackId?: number; isNativeTrack?: boolean; trackIndex?: number; offset?: number }[] = [];
    
    // 1. Props subtitles
    if (subtitles) {
      subtitles.forEach(s => {
        list.push({ ...s });
      });
    }

    // 2. Detected subtitles from client-side master playlist parse
    detectedSubtitles.forEach(s => {
      if (!list.some(item => item.lang.toLowerCase() === s.lang.toLowerCase())) {
        list.push({ ...s });
      }
    });

    // 3. Hls.js native subtitle tracks
    hlsSubtitles.forEach(s => {
      if (!list.some(item => item.lang.toLowerCase() === s.lang.toLowerCase() || item.lang.toLowerCase().includes(s.lang.toLowerCase()) || s.lang.toLowerCase().includes(item.lang.toLowerCase()))) {
        list.push({ ...s });
      }
    });

    // 4. Native text tracks (for Safari / iOS Native)
    nativeTextTracks.forEach(s => {
      if (!list.some(item => item.lang.toLowerCase() === s.lang.toLowerCase() || item.lang.toLowerCase().includes(s.lang.toLowerCase()) || s.lang.toLowerCase().includes(item.lang.toLowerCase()))) {
        list.push({ ...s });
      }
    });

    return list;
  }, [subtitles, detectedSubtitles, hlsSubtitles, nativeTextTracks]);

  const [localSubtitles, setLocalSubtitles] = useState<{ lang: string; cues: Cue[] }[]>([]);
  const [defaultSubLang, setDefaultSubLang] = useState<string>(() => {
    return localStorage.getItem('viyie_default_sub_lang') || 'Auto';
  });

  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [subOffset, setSubOffset] = useState<number>(() => {
    const saved = localStorage.getItem('viyie_sub_offset');
    return saved ? parseFloat(saved) : 0;
  });
  const [subSize, setSubSize] = useState<number>(() => {
    const saved = localStorage.getItem('viyie_sub_size');
    return saved ? parseInt(saved, 10) : 25;
  });
  const [subOffsetH, setSubOffsetH] = useState<number>(() => {
    const saved = localStorage.getItem('viyie_sub_offset_h');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [subOffsetV, setSubOffsetV] = useState<number>(() => {
    const saved = localStorage.getItem('viyie_sub_offset_v');
    return saved ? parseInt(saved, 10) : -30;
  });
  const [subBg, setSubBg] = useState<boolean>(() => {
    const saved = localStorage.getItem('viyie_sub_bg');
    return saved ? saved === 'true' : false;
  });

  const [subFontFamily, setSubFontFamily] = useState<string>(() => {
    const saved = localStorage.getItem('viyie_sub_font');
    return saved ? saved : 'Trebuchet MS';
  });
  const [subFontWeight, setSubFontWeight] = useState<string>(() => {
    const saved = localStorage.getItem('viyie_sub_weight');
    return saved ? saved : 'bold';
  });
  const [subOutline, setSubOutline] = useState<number>(() => {
    const saved = localStorage.getItem('viyie_sub_outline');
    return saved ? parseFloat(saved) : 2.5;
  });
  const [subColor, setSubColor] = useState<string>(() => {
    const saved = localStorage.getItem('viyie_sub_color');
    return saved ? saved : '#ffffff';
  });

  useEffect(() => {
    localStorage.setItem('viyie_sub_offset', subOffset.toString());
  }, [subOffset]);

  useEffect(() => {
    localStorage.setItem('viyie_sub_size', subSize.toString());
  }, [subSize]);

  useEffect(() => {
    localStorage.setItem('viyie_sub_offset_h', subOffsetH.toString());
  }, [subOffsetH]);

  useEffect(() => {
    localStorage.setItem('viyie_sub_offset_v', subOffsetV.toString());
  }, [subOffsetV]);

  useEffect(() => {
    localStorage.setItem('viyie_sub_bg', subBg.toString());
  }, [subBg]);

  useEffect(() => {
    localStorage.setItem('viyie_default_sub_lang', defaultSubLang);
  }, [defaultSubLang]);

  useEffect(() => {
    localStorage.setItem('viyie_sub_font', subFontFamily);
  }, [subFontFamily]);

  useEffect(() => {
    localStorage.setItem('viyie_sub_weight', subFontWeight);
  }, [subFontWeight]);

  useEffect(() => {
    localStorage.setItem('viyie_sub_outline', subOutline.toString());
  }, [subOutline]);

  useEffect(() => {
    localStorage.setItem('viyie_sub_color', subColor);
  }, [subColor]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const [isLoop, setIsLoop] = useState(true);
  const [showVideoInfo, setShowVideoInfo] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [contextMenuView, setContextMenuView] = useState<'main' | 'quick-access'>('main');
  const [brightness, setBrightness] = useState<number>(1.0);
  const [showMoreMobilePanel, setShowMoreMobilePanel] = useState<boolean>(false);
  const [showTouchShortcutsPanel, setShowTouchShortcutsPanel] = useState<boolean>(false);
  const beforeHoldPlaybackRateRef = useRef<number | null>(null);
  const wasSwipingRef = useRef<boolean>(false);
  const [morePanelPos, setMorePanelPos] = useState({ x: 16, y: 16 });
  const isDraggingMorePanelRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const panelStartPosRef = useRef({ x: 0, y: 0 });

  const touchXStartRef = useRef<number>(0);
  const touchYStartRef = useRef<number>(0);
  const touchStartTimeRef = useRef<number>(0);
  const touchActiveTypeRef = useRef<'none' | 'hold-speed' | 'swipe-x' | 'swipe-y-left' | 'swipe-y-right'>('none');
  const touchStartVolumeRef = useRef<number>(0);
  const touchStartBrightnessRef = useRef<number>(0);
  const touchStartVideoTimeRef = useRef<number>(0);
  const touchHoldTimerRef = useRef<any>(null);
  const touchHasMovedRef = useRef<boolean>(false);

  // High-level security: Block inspect element / view source and redirect to about:blank if devtools are opened
  useEffect(() => {
    const detectDevTools = () => {
      const hostname = window.location.hostname;
      if (hostname.includes('.run.app') || hostname.includes('aistudio.google.com') || hostname === 'localhost' || hostname === '127.0.0.1') {
        return;
      }

      const threshold = 160;
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      
      const ratioW = window.outerWidth / window.innerWidth;
      const ratioH = window.outerHeight / window.innerHeight;
      const ratioDifference = Math.abs(ratioW - ratioH);

      // Check if DevTools is docked to the side or bottom
      // Side dock: large widthDiff, small heightDiff (< 150)
      // Bottom dock: large heightDiff, small widthDiff (< 100)
      // Zoomed dock: ratio difference is substantial (> 0.22)
      const isSideDocked = widthDiff > threshold && heightDiff < 150;
      const isBottomDocked = heightDiff > threshold && widthDiff < 100;
      const isZoomedDocked = (widthDiff > threshold || heightDiff > threshold) && ratioDifference > 0.22;

      if (isSideDocked || isBottomDocked || isZoomedDocked) {
        window.location.replace('about:blank');
        return;
      }

      // Performance/Debugger check: Only pause/detect if DevTools is actually open
      const startTime = performance.now();
      // eslint-disable-next-line no-debugger
      debugger;
      const endTime = performance.now();
      if (endTime - startTime > 100) {
        window.location.replace('about:blank');
      }
    };

    const blockKeys = (e: KeyboardEvent) => {
      if (!e.key) return;
      const ctrlOrMeta = e.ctrlKey || e.metaKey;
      const isU = e.key.toLowerCase() === 'u';
      const isI = e.key.toLowerCase() === 'i';
      const isC = e.key.toLowerCase() === 'c';
      const isJ = e.key.toLowerCase() === 'j';
      const isShift = e.shiftKey;
      const isF12 = e.key === 'F12';

      if (
        (ctrlOrMeta && isU) || // Ctrl+U
        (ctrlOrMeta && isShift && isI) || // Ctrl+Shift+I
        (ctrlOrMeta && isShift && isC) || // Ctrl+Shift+C
        (ctrlOrMeta && isShift && isJ) || // Ctrl+Shift+J
        isF12
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', blockKeys, true);
    const blockContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.viyieplayer') && !target.closest('.custom-context-menu')) {
        e.preventDefault();
      }
    };
    window.addEventListener('contextmenu', blockContextMenu);

    const interval = setInterval(detectDevTools, 1000);
    return () => {
      window.removeEventListener('keydown', blockKeys, true);
      window.removeEventListener('contextmenu', blockContextMenu);
      clearInterval(interval);
    };
  }, []);

  // Click outside to close menus
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
      setShowSettings(false);
      setShowQualityMenu(false);
      setShowSubtitleMenu(false);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const [hlsLevels, setHlsLevels] = useState<any[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [activeLevelIndex, setActiveLevelIndex] = useState<number>(-1);
  const [measuredFps, setMeasuredFps] = useState<number>(30);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    // Skip loading the Chromecast SDK if inside an iframe to prevent cross-origin/sandbox script errors.
    const isIframe = typeof window !== 'undefined' && window.self !== window.top;
    if (isIframe) {
      console.log('Chromecast support bypassed inside iframe environment.');
      return;
    }

    // Dynamically load Google Cast Sender SDK for robust, error-free Chromecast support
    if (typeof window !== 'undefined' && !(window as any).chrome?.cast) {
      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
      script.async = true;
      script.onerror = (e) => {
        console.warn('Google Cast SDK failed to load, casting will fall back to native browser controls.', e);
      };
      document.head.appendChild(script);

      (window as any).__onGCastApiAvailable = (isAvailable: boolean) => {
        if (isAvailable) {
          try {
            const castContext = (window as any).cast.framework.CastContext.getInstance();
            castContext.setOptions({
              receiverApplicationId: (window as any).chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
              autoJoinPolicy: (window as any).chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
            });
          } catch (err) {
            console.warn('Google Cast Context initialization deferred:', err);
          }
        }
      };
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let frameCount = 0;
    let lastTime = performance.now();
    let callbackId: any = null;
    let animId: any = null;

    const checkFps = (now: number) => {
      frameCount++;
      const elapsed = now - lastTime;
      if (elapsed >= 1000) {
        const computed = Math.round((frameCount * 1000) / elapsed);
        if (computed > 10 && computed < 120) {
          setMeasuredFps(computed);
        }
        frameCount = 0;
        lastTime = now;
      }
      if ((video as any).requestVideoFrameCallback) {
        callbackId = (video as any).requestVideoFrameCallback(checkFps);
      }
    };

    const fallbackCheck = () => {
      if (isPlaying) {
        frameCount++;
      }
      const now = performance.now();
      const elapsed = now - lastTime;
      if (elapsed >= 1000) {
        const computed = Math.round((frameCount * 1000) / elapsed);
        if (computed > 10 && computed < 120) {
          setMeasuredFps(computed);
        }
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(fallbackCheck);
    };

    if ((video as any).requestVideoFrameCallback) {
      callbackId = (video as any).requestVideoFrameCallback(checkFps);
    } else {
      animId = requestAnimationFrame(fallbackCheck);
    }

    return () => {
      if ((video as any).cancelVideoFrameCallback && callbackId !== null) {
        (video as any).cancelVideoFrameCallback(callbackId);
      }
      if (animId !== null) {
        cancelAnimationFrame(animId);
      }
    };
  }, [isPlaying]);

  const [hoverTime, setHoverTime] = useState(0);
  const [hoverLeft, setHoverLeft] = useState(0);
  const [showHover, setShowHover] = useState(false);
  const [spriteUrl, setSpriteUrl] = useState<string | null>(null);
  const [spriteHeight, setSpriteHeight] = useState(90);

  const [showContinue, setShowContinue] = useState(false);
  const [lastWatched, setLastWatched] = useState(0);

  const showNotice = useCallback((msg: string) => {
    noticeRef.current = msg;
    setNotice(msg);
    if (noticeTimeout) clearTimeout(noticeTimeout);
    setNoticeTimeout(setTimeout(() => {
      setNotice('');
      noticeRef.current = '';
    }, 4000));
  }, [noticeTimeout]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    
    // Check if any settings menu/controls are active (even if considered invisible to mouse leave)
    const isAnySettingsMenuActive = showSettings || showQualityMenu || showSubtitleMenu || showVideoInfo || (contextMenu !== null);
    
    // If mini-progressbar is in full screen, we should keep showing controls if any settings menu is active/invisible
    if ((isFullscreen || isWebFullscreen) && !showControls && isPlaying) {
      if (isAnySettingsMenuActive) {
        setShowControls(true);
        return;
      }
    }

    if (isPlaying && !isAnySettingsMenuActive) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 5000);
    }
  };

  const handleMouseLeave = () => {
    const isAnySettingsMenuActive = showSettings || showQualityMenu || showSubtitleMenu || showVideoInfo || (contextMenu !== null);
    if (isPlaying && !isAnySettingsMenuActive) {
      setShowControls(false);
    }
  };

  // Automatically keep controls visible when any settings menu is open/active
  useEffect(() => {
    const isAnySettingsMenuActive = showSettings || showQualityMenu || showSubtitleMenu || showVideoInfo || (contextMenu !== null);
    if (isAnySettingsMenuActive) {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
  }, [showSettings, showQualityMenu, showSubtitleMenu, showVideoInfo, contextMenu]);

  const setPlayerVolume = (val: number) => {
    setVolume(val);
    if (videoRef.current) videoRef.current.volume = val;
    if (audioRef.current) audioRef.current.volume = val;
  };

  const getAudioProxyUrl = (vUrl: string, time: number) => {
    let target = vUrl;
    if (typeof vUrl === 'string' && vUrl.includes('.m3u8') && !vUrl.includes('proxy-playlist') && !vUrl.includes('v-stream') && !vUrl.includes('dynamic-icons.png')) {
      target = `/assets/images/dynamic-icons.png?s=${obfuscateUrl(vUrl)}`;
    }
    return `/api/proxy-audio-only?url=${encodeURIComponent(target)}&ss=${Math.floor(time)}`;
  };

  const seekTo = (time: number) => {
    lastSeekTimeRef.current = time;
    setCurrentTime(time);
    if (isAudioOnly) {
      if (audioRef.current) {
        proxyAudioStartTimeRef.current = time;
        audioRef.current.src = getAudioProxyUrl(videoUrl, time);
        audioRef.current.load();
        if (isPlaying) {
          audioRef.current.play().catch(e => console.warn(e));
        }
      }
    } else {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
      }
      if (audioRef.current && selectedAudioOption === 'external' && audioUrl) {
        // #----------------------------------------------------------------------
        // SINKRONISASI AUDIO EKSTERNAL (DUAL-TRACK AUDIO / DUBBING):
        // Konsep Utama:
        // 1. Memutar track video utama bersamaan dengan file audio (.mp3, .m4a, dll) atau playlist audio HLS (.m3u8).
        // 2. Mengendalikan sinkronisasi waktu antara <video> dan <audio> menggunakan `currentTime` dan `audioDelay` (offset).
        // 3. Jika audio berupa .m3u8 (HLS), audio dimuat pada segmen waktu spesifik melaui proxy.
        // 4. Jika audio standar, waktu audio diatur langsung ke `video.currentTime + offset` setiap kali seek terjadi.
        // #----------------------------------------------------------------------
        const isHls = typeof audioUrl === 'string' && (audioUrl.includes('.m3u8') || audioUrl.includes('proxy-playlist') || audioUrl.includes('v-stream') || audioUrl.includes('dynamic-icons.png'));
        const offsetToUse = audioDelay;
        if (isHls) {
          const fetchTime = Math.max(0, time + offsetToUse);
          proxyAudioStartTimeRef.current = fetchTime;
          audioRef.current.src = getAudioProxyUrl(audioUrl, fetchTime);
          audioRef.current.load();
          if (isPlaying) {
            audioRef.current.play().catch(e => console.warn(e));
          }
        } else {
          audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.duration || Infinity, time + offsetToUse));
        }
      }
    }
  };

  const toggleAudioOnly = (active: boolean) => {
    if (active === isAudioOnly) return;
    
    const timeToSeek = videoRef.current ? videoRef.current.currentTime : (audioRef.current ? audioRef.current.currentTime : currentTime);
    
    if (active) {
      if (videoRef.current) {
        videoRef.current.pause();
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (dashPlayerRef.current) {
        dashPlayerRef.current.reset();
        dashPlayerRef.current = null;
      }
      setIsAudioOnly(true);
      setSelectedAudioOption('audio-only');
      showNotice(t('Quota Saver Active (Audio Only)'));
      
      setTimeout(() => {
        if (audioRef.current) {
          proxyAudioStartTimeRef.current = timeToSeek;
          audioRef.current.src = getAudioProxyUrl(videoUrl, timeToSeek);
          audioRef.current.load();
          if (isPlaying) {
            audioRef.current.play().catch(e => console.warn(e));
          }
        }
      }, 50);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      setIsAudioOnly(false);
      setSelectedAudioOption('default');
      showNotice(t('Returning to Video Stream'));
      
      const onVideoReady = () => {
        if (videoRef.current) {
          videoRef.current.currentTime = timeToSeek;
          if (isPlaying) {
            videoRef.current.play().catch(e => console.warn(e));
          }
          videoRef.current.removeEventListener('loadedmetadata', onVideoReady);
        }
      };
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.addEventListener('loadedmetadata', onVideoReady);
        }
      }, 50);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncAudio = () => {
      const audio = audioRef.current;
      if (!audio || selectedAudioOption !== 'external' || !audioUrl) return;
      if (isScrubbingRef.current) return;
      const offsetToUse = audioDelay;
      const isHls = typeof audioUrl === 'string' && (audioUrl.includes('.m3u8') || audioUrl.includes('proxy-playlist') || audioUrl.includes('v-stream') || audioUrl.includes('dynamic-icons.png'));
      
      const currentExpectedTarget = video.currentTime + offsetToUse;
      
      if (currentExpectedTarget < 0) {
        if (!audio.paused) audio.pause();
        audio.currentTime = 0;
        return;
      }

      let didLoad = false;

      if (isHls) {
        const targetTimeInAudio = Math.max(0, currentExpectedTarget - proxyAudioStartTimeRef.current);
        const diff = targetTimeInAudio - audio.currentTime;
        if (Math.abs(diff) > 3.0) {
          proxyAudioStartTimeRef.current = currentExpectedTarget;
          audio.src = getAudioProxyUrl(audioUrl, currentExpectedTarget);
          audio.load();
          didLoad = true;
        } else if (Math.abs(diff) > 0.15) {
          audio.playbackRate = diff > 0 ? 1.15 : 0.85;
        } else {
          audio.playbackRate = 1.0;
        }
      } else {
        const targetTime = Math.max(0, Math.min(audio.duration || Infinity, currentExpectedTarget));
        const diff = targetTime - audio.currentTime;
        if (Math.abs(diff) > 0.5) {
          audio.currentTime = targetTime;
        } else if (Math.abs(diff) > 0.1) {
          audio.playbackRate = diff > 0 ? 1.1 : 0.9;
        } else {
          audio.playbackRate = 1.0;
        }
      }

      if (audio.paused && !video.paused) {
         const p = audio.play();
         if (p !== undefined) p.catch(e => console.warn("Audio play prevented:", e));
      } else if (!audio.paused && video.paused) {
         audio.pause();
      }
    };

    const onPlay = () => {
      setIsPlaying(true);
      setHasPlayed(true);
      if (selectedAudioOption === 'external' && audioRef.current && audioUrl) {
        syncAudio();
      }
    };
    const onPause = () => {
      setIsPlaying(false);
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    };
    const onTimeUpdate = () => {
      if (!isAudioOnly) {
        if (isScrubbingRef.current) {
          return;
        }
        if (video.seeking) {
          return;
        }
        if (lastSeekTimeRef.current !== null) {
          const diff = Math.abs(video.currentTime - lastSeekTimeRef.current);
          if (diff > 1.5) {
            return;
          } else {
            lastSeekTimeRef.current = null;
          }
        }
        setCurrentTime(video.currentTime);
        if (video.currentTime > 0) {
          lastPlaybackTimeRef.current = video.currentTime;
        }
        syncAudio();
      }
    };
    const onDurationChange = () => {
      if (!isAudioOnly) {
        setDuration(video.duration);
      }
    };
    const onWaiting = () => {
      setIsWaiting(true);
      if (selectedAudioOption === 'external' && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    };
    const onPlaying = () => {
      const isHls = typeof videoUrl === 'string' && (videoUrl.includes('.m3u8') || ((videoUrl.includes('proxy-playlist') || videoUrl.includes('v-stream') || videoUrl.includes('dynamic-icons.png')) && !videoUrl.includes('.mpd')));
      const isMpd = typeof videoUrl === 'string' && (videoUrl.includes('.mpd') || ((videoUrl.includes('proxy-playlist') || videoUrl.includes('v-stream') || videoUrl.includes('dynamic-icons.png')) && videoUrl.includes('.mpd')));
      if (isHls && (!hlsRef.current || !hlsRef.current.levels || hlsRef.current.levels.length === 0)) {
        return; // Defer hiding spinner until resolution levels are 100% parsed
      }
      if (isMpd && !dashPlayerRef.current) {
        return; // Defer hiding spinner
      }
      setIsWaiting(false);
      if (selectedAudioOption === 'external' && audioRef.current && audioUrl && !video.paused) {
        syncAudio();
      }
    };
    const onRateChange = () => {
      if (audioRef.current) audioRef.current.playbackRate = video.playbackRate;
    };
    const onVolumeChange = () => {
      if (audioRef.current) {
        if (selectedAudioOption === 'external') {
          // Do not sync audio.muted with video.muted because video is forcefully muted
          if (!video.muted) {
            video.muted = true;
          }
        } else {
          audioRef.current.volume = 0;
          audioRef.current.muted = true;
        }
      }
    };
    const onCanPlay = () => {
      const isHls = typeof videoUrl === 'string' && (videoUrl.includes('.m3u8') || ((videoUrl.includes('proxy-playlist') || videoUrl.includes('v-stream') || videoUrl.includes('dynamic-icons.png')) && !videoUrl.includes('.mpd')));
      const isMpd = typeof videoUrl === 'string' && (videoUrl.includes('.mpd') || ((videoUrl.includes('proxy-playlist') || videoUrl.includes('v-stream') || videoUrl.includes('dynamic-icons.png')) && videoUrl.includes('.mpd')));
      if (isHls && (!hlsRef.current || !hlsRef.current.levels || hlsRef.current.levels.length === 0)) {
        return; // Defer hiding spinner until resolution levels are 100% parsed
      }
      if (isMpd && !dashPlayerRef.current) {
        return; // Defer hiding spinner
      }
      setIsWaiting(false);
    };
    const onError = () => {
      console.warn('[ViyiePlayer] Native video error event triggered. Attempting silent recovery...', video.error);
      setIsWaiting(true);
      const savedTime = video.currentTime || lastPlaybackTimeRef.current;
      if (savedTime > 0) {
        lastPlaybackTimeRef.current = savedTime;
      }
      
      const isHls = typeof videoUrl === 'string' && (videoUrl.includes('.m3u8') || ((videoUrl.includes('proxy-playlist') || videoUrl.includes('v-stream') || videoUrl.includes('dynamic-icons.png')) && !videoUrl.includes('.mpd')));
      if (isHls && hlsRef.current) {
        console.log('[Native Error Handler] Re-initializing HLS to recover playback...');
        hlsRef.current.destroy();
        hlsRef.current.loadSource(activeVideoUrl);
        hlsRef.current.attachMedia(video);
      } else {
        video.load();
        if (savedTime > 0) {
          video.currentTime = savedTime;
        }
        if (isPlaying) {
          video.play().catch(e => console.warn('[Native Error Play Retry]', e));
        }
      }
    };
    const onSeeked = () => {
      lastSeekTimeRef.current = null;
      if (!isAudioOnly) {
        setCurrentTime(video.currentTime);
        if (video.currentTime > 0) {
          lastPlaybackTimeRef.current = video.currentTime;
        }
      }
      syncAudio();
    };
    const onProgress = () => {
      const ranges = [];
      for (let i = 0; i < video.buffered.length; i++) {
        ranges.push({ start: video.buffered.start(i), end: video.buffered.end(i) });
      }
      setBuffered(ranges);
    };

    const onResize = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (width && height) {
        setVideoDims({ width, height });
        
        // Dynamically correct the active level's dimensions in hlsLevels to ensure 100% accuracy in the settings menu!
        if (hlsRef.current) {
          let activeIdx = hlsRef.current.currentLevel;
          if (activeIdx === -1) {
            activeIdx = hlsRef.current.loadLevel;
          }
          if (activeIdx === -1) {
            activeIdx = hlsRef.current.nextLevel;
          }
          if (activeIdx === -1) {
            activeIdx = activeLevelIndex;
          }
          
          if (activeIdx !== -1 && activeIdx !== undefined) {
            setHlsLevels(prev => {
              const exists = prev.find(l => l.index === activeIdx);
              if (exists && (exists.height !== height || exists.width !== width)) {
                const updated = prev.map(l => {
                  if (l.index === activeIdx) {
                    return {
                      ...l,
                      width,
                      height,
                      name: getResolutionBadge(height, width)
                    };
                  }
                  return l;
                });
                return [...updated].sort((a, b) => b.index - a.index);
              }
              return prev;
            });
          }
        }
      }
    };

    const onEnterPip = () => setIsPipActive(true);
    const onLeavePip = () => setIsPipActive(false);

    const handleOnline = () => {
      console.log('[Player Online] Back online. Checking if recovery is needed...');
      setIsWaiting(true);
      if (hlsRef.current) {
        hlsRef.current.startLoad();
        if (video.paused && isPlaying) {
          video.play().catch(e => console.warn('[Online Play Recovery Error]', e));
        }
      } else if (dashPlayerRef.current) {
        dashPlayerRef.current.attachSource(activeVideoUrl);
      } else {
        const savedTime = video.currentTime;
        video.load();
        if (savedTime > 0) {
          video.currentTime = savedTime;
        }
        if (isPlaying) {
          video.play().catch(e => console.warn('[Online Play Recovery Error]', e));
        }
      }
    };

    const handleOffline = () => {
      console.log('[Player Offline] Offline detected.');
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('ratechange', onRateChange);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('loadeddata', onCanPlay);
    video.addEventListener('error', onError);
    video.addEventListener('progress', onProgress);
    video.addEventListener('resize', onResize);
    video.addEventListener('loadedmetadata', onResize);
    video.addEventListener('enterpictureinpicture', onEnterPip);
    video.addEventListener('leavepictureinpicture', onLeavePip);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const isHlsVideo = typeof videoUrl === 'string' && (videoUrl.includes('.m3u8') || ((videoUrl.includes('proxy-playlist') || videoUrl.includes('v-stream') || videoUrl.includes('dynamic-icons.png')) && !videoUrl.includes('.mpd')));
    const isMpdVideo = typeof videoUrl === 'string' && (videoUrl.includes('.mpd') || ((videoUrl.includes('proxy-playlist') || videoUrl.includes('v-stream') || videoUrl.includes('dynamic-icons.png')) && videoUrl.includes('.mpd')));
    if (video.readyState >= 3 && (!isHlsVideo && !isMpdVideo || (hlsRef.current && hlsRef.current.levels && hlsRef.current.levels.length > 0) || (dashPlayerRef.current))) {
      setIsWaiting(false);
    }

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('ratechange', onRateChange);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('loadeddata', onCanPlay);
      video.removeEventListener('error', onError);
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('resize', onResize);
      video.removeEventListener('loadedmetadata', onResize);
      video.removeEventListener('enterpictureinpicture', onEnterPip);
      video.removeEventListener('leavepictureinpicture', onLeavePip);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [audioUrl, selectedAudioOption, isAudioOnly, audioDelay]);

  // Stall Detector & Recovery Timer
  useEffect(() => {
    if (!isPlaying || isAudioOnly || !activeVideoUrl) return;

    let lastTime = videoRef.current?.currentTime || 0;
    let lastProgressTime = Date.now();
    let trueStallCount = 0;
    let networkBufferCount = 0;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;

      const isPausedOrSeeking = video.paused || video.seeking || video.ended;
      if (isPausedOrSeeking) {
        lastProgressTime = Date.now();
        trueStallCount = 0;
        networkBufferCount = 0;
        return;
      }

      if (video.currentTime !== lastTime) {
        lastTime = video.currentTime;
        lastProgressTime = Date.now();
        trueStallCount = 0;
        networkBufferCount = 0;
      } else {
        const secondsStalled = Math.floor((Date.now() - lastProgressTime) / 1000);
        
        // Let the video load/negotiate without interruption during its startup (currentTime === 0).
        // Slower sources (like moon.ironwallnet) can take up to 20-30s to download metadata and initial segments.
        if (video.currentTime === 0) {
          if (secondsStalled >= 45) {
            console.log('[Stall Detector] Initial load stalled for 45s. Performing silent reload of stream...');
            if (hlsRef.current) {
              hlsRef.current.destroy();
              hlsRef.current.loadSource(activeVideoUrl);
              hlsRef.current.attachMedia(video);
            } else {
              video.load();
            }
            lastProgressTime = Date.now();
          }
          return;
        }

        // Active playback stall (currentTime > 0)
        const isBuffering = video.readyState < 3;
        if (isBuffering) {
          networkBufferCount++;
          trueStallCount = 0;
          console.log(`[Stall Detector] Video buffering normally (readyState: ${video.readyState}) at ${video.currentTime}s. Buffer count: ${networkBufferCount}`);

          if (networkBufferCount >= 45) { // Slower sources need a longer timeout
            console.log('[Stall Detector] Buffering timed out after 45 seconds. Performing silent stream reload...');
            const savedTime = video.currentTime;
            if (savedTime > 0) {
              lastPlaybackTimeRef.current = savedTime;
            }
            if (hlsRef.current) {
              hlsRef.current.destroy();
              hlsRef.current.loadSource(activeVideoUrl);
              hlsRef.current.attachMedia(video);
            } else {
              video.load();
              video.currentTime = savedTime;
            }
            lastProgressTime = Date.now();
            networkBufferCount = 0;
          }
        } else {
          trueStallCount++;
          networkBufferCount = 0;
          console.warn(`[Stall Detector] Video true decode stall detected at ${video.currentTime}s. Stall count: ${trueStallCount}`);

          if (trueStallCount >= 20) { // Much safer threshold than 6s to prevent loops
            setIsWaiting(true);
            if (hlsRef.current) {
              console.log('[Stall Detector] Attempting HLS recoverMediaError...');
              hlsRef.current.recoverMediaError();
            }
          }

          if (trueStallCount >= 40) { // Generous 40s freeze timeout before full reload
            console.log('[Stall Detector] True stall persisted for 40s. Performing complete HLS reload...');
            const savedTime = video.currentTime;
            if (savedTime > 0) {
              lastPlaybackTimeRef.current = savedTime;
            }
            if (hlsRef.current) {
              hlsRef.current.destroy();
              hlsRef.current.loadSource(activeVideoUrl);
              hlsRef.current.attachMedia(video);
            } else {
              video.load();
              video.currentTime = savedTime;
            }
            lastProgressTime = Date.now();
            trueStallCount = 0;
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, activeVideoUrl, isAudioOnly]);

  useEffect(() => {
    if (audioUrl) {
      setShowDubNotice(true);
    } else {
      setShowDubNotice(false);
    }
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onAudioPlay = () => {
      if (isAudioOnly) {
        setIsPlaying(true);
      }
    };
    const onAudioPause = () => {
      if (isAudioOnly) {
        setIsPlaying(false);
      }
    };
    const onAudioTimeUpdate = () => {
      if (isAudioOnly) {
        if (isScrubbingRef.current) return;
        setCurrentTime(proxyAudioStartTimeRef.current + audio.currentTime);
      }
    };
    const onAudioDurationChange = () => {
      if (isAudioOnly && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onAudioWaiting = () => {
      if (isAudioOnly) {
        setIsWaiting(true);
      } else if (selectedAudioOption === 'external') {
        setIsWaiting(true);
        if (videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
        }
      }
    };
    const onAudioPlaying = () => {
      if (isAudioOnly) {
        setIsWaiting(false);
      } else if (selectedAudioOption === 'external') {
        setIsWaiting(false);
        if (videoRef.current && videoRef.current.paused) {
          videoRef.current.play().catch(e => console.warn(e));
        }
      }
    };
    const onAudioCanPlay = () => {
      if (isAudioOnly) {
        setIsWaiting(false);
      } else if (selectedAudioOption === 'external') {
        setIsWaiting(false);
      }
    };
    const onAudioProgress = () => {
      if (isAudioOnly) {
        const ranges = [];
        for (let i = 0; i < audio.buffered.length; i++) {
          ranges.push({ start: audio.buffered.start(i), end: audio.buffered.end(i) });
        }
        setBuffered(ranges);
      }
    };
    const onAudioEnded = () => {
      if (isAudioOnly) {
        setIsPlaying(false);
      }
    };

    audio.addEventListener('play', onAudioPlay);
    audio.addEventListener('pause', onAudioPause);
    audio.addEventListener('timeupdate', onAudioTimeUpdate);
    audio.addEventListener('durationchange', onAudioDurationChange);
    audio.addEventListener('waiting', onAudioWaiting);
    audio.addEventListener('playing', onAudioPlaying);
    audio.addEventListener('canplay', onAudioCanPlay);
    audio.addEventListener('progress', onAudioProgress);
    audio.addEventListener('ended', onAudioEnded);

    return () => {
      audio.removeEventListener('play', onAudioPlay);
      audio.removeEventListener('pause', onAudioPause);
      audio.removeEventListener('timeupdate', onAudioTimeUpdate);
      audio.removeEventListener('durationchange', onAudioDurationChange);
      audio.removeEventListener('waiting', onAudioWaiting);
      audio.removeEventListener('playing', onAudioPlaying);
      audio.removeEventListener('canplay', onAudioCanPlay);
      audio.removeEventListener('progress', onAudioProgress);
      audio.removeEventListener('ended', onAudioEnded);
    };
  }, [isAudioOnly, selectedAudioOption]);



  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    setGeneratedPoster(null);
    
    if (isAudioOnly) {
      if (video) {
        video.src = '';
        video.load();
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (dashPlayerRef.current) {
        dashPlayerRef.current.reset();
        dashPlayerRef.current = null;
      }
      return;
    }

    if (!activeVideoUrl) {
      setIsWaiting(true);
      return;
    }

    setIsWaiting(true);

    if (dashPlayerRef.current) {
      dashPlayerRef.current.reset();
      dashPlayerRef.current = null;
    }

    let hls: Hls | null = null;
    const isHls = (activeVideoUrl.includes('.m3u8') || activeVideoUrl.includes('proxy-playlist') || activeVideoUrl.includes('v-stream') || activeVideoUrl.includes('dynamic-icons.png')) && !activeVideoUrl.includes('.mpd');
    const isMpd = activeVideoUrl.includes('.mpd') || (activeVideoUrl.includes('proxy-playlist') || activeVideoUrl.includes('v-stream') || activeVideoUrl.includes('dynamic-icons.png')) && activeVideoUrl.includes('.mpd');

    if (isMpd) {
      const loadDashSdk = (): Promise<any> => {
        if ((window as any).dashjs) {
          return Promise.resolve((window as any).dashjs);
        }
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/dashjs/4.7.4/dash.all.min.js';
          script.async = true;
          script.onload = () => {
            if ((window as any).dashjs) {
              resolve((window as any).dashjs);
            } else {
              reject(new Error('dash.js loaded but object not found on window'));
            }
          };
          script.onerror = () => reject(new Error('Failed to load dash.js SDK'));
          document.head.appendChild(script);
        });
      };

      loadDashSdk().then((dashjs) => {
        if (!videoRef.current) return;
        const player = dashjs.MediaPlayer().create();
        dashPlayerRef.current = player;

        player.updateSettings({
          streaming: {
            buffer: {
              stableBufferDelay: 30,
              bufferTimeAtTopQuality: 30,
              bufferTimeAtTopQualityLongForm: 60,
            },
            lowLatencyEnabled: true
          }
        });

        player.initialize(videoRef.current, activeVideoUrl, isPlaying);

        player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
          const bitrates = player.getBitrateInfoListFor('video');
          if (bitrates && bitrates.length > 0) {
            const levels = bitrates.map((b: any, idx: number) => {
              const height = b.height;
              const width = b.width;
              return {
                index: idx,
                width,
                height,
                bitrate: b.bitrate,
                name: getResolutionBadge(height, width)
              };
            });
            setHlsLevels(levels.sort((a: any, b: any) => b.height - a.height));
          }
          setIsWaiting(false);
        });

        player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, (e: any) => {
          if (e.mediaType === 'video') {
            setActiveLevelIndex(e.newQuality);
          }
        });

        player.on(dashjs.MediaPlayer.events.PLAYBACK_NOT_ALLOWED, () => {
          setIsPlaying(false);
        });

        player.on(dashjs.MediaPlayer.events.ERROR, (e: any) => {
          console.error('dash.js playback error:', e);
          setIsWaiting(false);
          showNotice(t('Video playback error'));
        });
      }).catch((err) => {
        console.error(err);
        setIsWaiting(false);
        showNotice('Failed to load DASH Player');
      });
    } else if (isHls && Hls.isSupported()) {
      // #----------------------------------------------------------------------
      // INI ADALAH BLOK INISIALISASI HLS.JS (STREAMING ADAPTIF .m3u8)
      // Konsep Utama: 
      // 1. Memotong video m3u8 menjadi chunk-chunk kecil (.ts) untuk efisiensi load data.
      // 2. Mendukung kualitas adaptif (Auto-resolution) secara otomatis sesuai bandwidth user.
      // 3. Mengontrol buffer secara dinamis (maxBufferLength, maxBufferSize) untuk mencegah lag.
      // #----------------------------------------------------------------------
      hls = new Hls({
        pLoader: CustomPlaylistLoader as any,
        maxBufferLength: 20,
        maxMaxBufferLength: 40,
        maxBufferSize: 40 * 1000 * 1000,
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 10,
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 6,
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 6,
        fragLoadingTimeOut: 10000,
        fragLoadingMaxRetry: 6,
        nudgeMaxRetry: 8,
        maxFragLookUpTolerance: 0.2,
        startLevel: -1,
        capLevelToPlayerSize: true,
      });
      hlsRef.current = hls;
      hls.loadSource(activeVideoUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        // #----------------------------------------------------------------------
        // DETEKSI & PORTING KUALITAS/RESOLUSI:
        // Kode ini memetakan seluruh playlist resolusi yang disediakan oleh file m3u8.
        // Setiap tingkat (level) dikonversi menggunakan getResolutionBadge() ke label 
        // standar yang mudah dipahami (1080p, 720p, 480p, dsb).
        // #----------------------------------------------------------------------
        const totalLevels = data.levels.length;
        const levels = data.levels.map((l, idx) => {
          let height = l.height;
          let width = l.width;
          const name = l.name || '';
          
          let urlStr = '';
          if ((l as any).url) {
            if (Array.isArray((l as any).url)) {
              urlStr = (l as any).url.join(' ');
            } else if (typeof (l as any).url === 'string') {
              urlStr = (l as any).url;
            }
          }

          const attrs = (l as any).attrs || {};
          if (!height && attrs.RESOLUTION) {
            const resMatch = attrs.RESOLUTION.match(/(\d+)x(\d+)/);
            if (resMatch) {
              if (!width) width = parseInt(resMatch[1], 10);
              height = parseInt(resMatch[2], 10);
            }
          }

          if (!height) {
            const searchString = `${name} ${urlStr}`;
            const dimMatch = searchString.match(/(\d+)x(\d+)/i);
            if (dimMatch) {
              if (!width) width = parseInt(dimMatch[1], 10);
              height = parseInt(dimMatch[2], 10);
            } else {
              const pMatch = searchString.match(/(\d+)[pP]/);
              if (pMatch) {
                height = parseInt(pMatch[1], 10);
              } else {
                const numMatches = searchString.match(/\b(240|360|480|540|576|720|1080|1440|2160)\b/g);
                if (numMatches && numMatches.length > 0) {
                  height = parseInt(numMatches[numMatches.length - 1], 10);
                }
              }
            }
          }

          if (!height && l.bitrate) {
            if (l.bitrate < 400000) height = 360;
            else if (l.bitrate < 1000000) height = 480;
            else if (l.bitrate < 2500000) height = 720;
            else if (l.bitrate < 5000000) height = 1080;
            else height = 1440;
          }

          if (!height || height === 0) {
            height = estimateHeightFromIndex(idx, totalLevels);
          }

          return {
            index: idx,
            height: height || 0,
            width: width || 0,
            fps: l.frameRate ? Math.round(l.frameRate) : 0,
            name: name || (height ? getResolutionBadge(height, width) : 'Unknown')
          };
        });
        // Sort by level height descending to keep order of qualities perfectly stable (highest quality first)
        setHlsLevels(levels.sort((a,b) => (b.height - a.height) || (b.index - a.index)));
        setIsWaiting(false);
        if (lastPlaybackTimeRef.current > 0) {
          console.log('[HLS Restore] Restoring playback progress to:', lastPlaybackTimeRef.current);
          video.currentTime = lastPlaybackTimeRef.current;
        }
      });
      hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
        setHlsLevels(prev => {
          let updated = false;
          const newLevels = prev.map(l => {
            if (l.index === data.level) {
              const hlsLevel = hls?.levels?.[data.level];
              if (hlsLevel && (hlsLevel.width !== l.width || hlsLevel.height !== l.height || hlsLevel.frameRate !== l.fps)) {
                updated = true;
                return {
                  ...l,
                  width: hlsLevel.width || l.width,
                  height: hlsLevel.height || l.height,
                  fps: hlsLevel.frameRate ? Math.round(hlsLevel.frameRate) : l.fps,
                  name: getResolutionBadge(hlsLevel.height || l.height, hlsLevel.width || l.width)
                };
              }
            }
            return l;
          });
          if (updated) {
            return newLevels.sort((a,b) => (b.height - a.height) || (b.index - a.index));
          }
          return prev;
        });
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        setActiveLevelIndex(data.level);
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (event, data) => {
        if (data && data.audioTracks) {
          setAudioTracks(data.audioTracks);
        }
      });

      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (event, data) => {
        if (data && typeof data.id === 'number') {
          setCurrentAudioTrack(data.id);
        }
      });

      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (event, data) => {
        if (data && data.subtitleTracks) {
          const tracks = data.subtitleTracks.map((t: any) => ({
            lang: t.name || t.lang || `Subtitle ${t.id}`,
            url: t.url || '',
            isHlsTrack: true,
            trackId: t.id
          }));
          setHlsSubtitles(tracks);
        }
      });

      let networkRetryCount = 0;
      let mediaRetryCount = 0;
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.warn('[ViyiePlayer HLS Fatal Error]', data.type, data.details);
          setIsWaiting(true);
          
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('[HLS Recovery] Fatal network error. Retrying hls.startLoad()...');
              hls?.startLoad();
              networkRetryCount++;
              if (networkRetryCount > 5) {
                console.log('[HLS Recovery] Network error persisted. Performing silent stream reload...');
                const savedTime = video.currentTime || lastPlaybackTimeRef.current;
                if (savedTime > 0) {
                  lastPlaybackTimeRef.current = savedTime;
                }
                hls?.destroy();
                hls = new Hls({
                  pLoader: CustomPlaylistLoader as any,
                  maxBufferLength: 20,
                  maxMaxBufferLength: 40,
                  maxBufferSize: 40 * 1000 * 1000,
                  enableWorker: true,
                  lowLatencyMode: true,
                  backBufferLength: 10,
                  manifestLoadingTimeOut: 10000,
                  manifestLoadingMaxRetry: 6,
                  levelLoadingTimeOut: 10000,
                  levelLoadingMaxRetry: 6,
                  fragLoadingTimeOut: 10000,
                  fragLoadingMaxRetry: 6,
                  nudgeMaxRetry: 8,
                  maxFragLookUpTolerance: 0.2,
                  startLevel: -1,
                  capLevelToPlayerSize: true,
                });
                hlsRef.current = hls;
                hls.loadSource(activeVideoUrl);
                hls.attachMedia(video);
                networkRetryCount = 0;
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('[HLS Recovery] Fatal media error. Retrying hls.recoverMediaError()...');
              hls?.recoverMediaError();
              mediaRetryCount++;
              if (mediaRetryCount > 3) {
                console.log('[HLS Recovery] Multiple media errors. Swapping audio codec and recovering...');
                hls?.swapAudioCodec();
                hls?.recoverMediaError();
              }
              if (mediaRetryCount > 6) {
                console.log('[HLS Recovery] Media error unrecoverable. Performing silent stream reload...');
                const savedTime = video.currentTime || lastPlaybackTimeRef.current;
                if (savedTime > 0) {
                  lastPlaybackTimeRef.current = savedTime;
                }
                hls?.destroy();
                hls = new Hls({
                  pLoader: CustomPlaylistLoader as any,
                  maxBufferLength: 20,
                  maxMaxBufferLength: 40,
                  maxBufferSize: 40 * 1000 * 1000,
                  enableWorker: true,
                  lowLatencyMode: true,
                  backBufferLength: 10,
                  manifestLoadingTimeOut: 10000,
                  manifestLoadingMaxRetry: 6,
                  levelLoadingTimeOut: 10000,
                  levelLoadingMaxRetry: 6,
                  fragLoadingTimeOut: 10000,
                  fragLoadingMaxRetry: 6,
                  nudgeMaxRetry: 8,
                  maxFragLookUpTolerance: 0.2,
                  startLevel: -1,
                  capLevelToPlayerSize: true,
                });
                hlsRef.current = hls;
                hls.loadSource(activeVideoUrl);
                hls.attachMedia(video);
                mediaRetryCount = 0;
              }
              break;
            default:
              console.log('[HLS Recovery] Unhandled fatal error. Reloading source...');
              const savedTime = video.currentTime || lastPlaybackTimeRef.current;
              if (savedTime > 0) {
                lastPlaybackTimeRef.current = savedTime;
              }
              hls?.destroy();
              hls = new Hls({
                pLoader: CustomPlaylistLoader as any,
                maxBufferLength: 20,
                maxMaxBufferLength: 40,
                maxBufferSize: 40 * 1000 * 1000,
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 10,
                manifestLoadingTimeOut: 10000,
                manifestLoadingMaxRetry: 6,
                levelLoadingTimeOut: 10000,
                levelLoadingMaxRetry: 6,
                fragLoadingTimeOut: 10000,
                fragLoadingMaxRetry: 6,
                nudgeMaxRetry: 8,
                maxFragLookUpTolerance: 0.2,
                startLevel: -1,
                capLevelToPlayerSize: true,
              });
              hlsRef.current = hls;
              hls.loadSource(activeVideoUrl);
              hls.attachMedia(video);
              break;
          }
        }
      });
    } else if (!isMpd) {
      video.src = activeVideoUrl;
    }

    return () => {
      if (hls) hls.destroy();
      if (dashPlayerRef.current) {
        dashPlayerRef.current.reset();
        dashPlayerRef.current = null;
      }
    };
  }, [activeVideoUrl, isAudioOnly]);

  useEffect(() => {
    if (!hlsRef.current || !hlsRef.current.levels || hlsRef.current.levels.length === 0) return;
    const hls = hlsRef.current;
    if (ecoMode) {
      if (currentLevel !== -1) {
        const lvl = hls.levels[currentLevel];
        const h = lvl ? (lvl.height || 0) : 0;
        if (h > 720) {
          let bestIndex = -1;
          let bestHeight = 0;
          hls.levels.forEach((l, idx) => {
            const lh = l.height || 0;
            if (lh <= 720 && lh > bestHeight) {
              bestHeight = lh;
              bestIndex = idx;
            }
          });
          if (bestIndex !== -1) {
            setCurrentLevel(bestIndex);
            hls.currentLevel = bestIndex;
            hls.loadLevel = bestIndex;
            hls.nextLevel = bestIndex;
          } else {
            setCurrentLevel(-1);
            hls.currentLevel = -1;
          }
        }
      }
      
      let maxAutoIdx = -1;
      let bestHeight = 0;
      hls.levels.forEach((l, idx) => {
        const lh = l.height || 0;
        if (lh <= 720 && lh > bestHeight) {
          bestHeight = lh;
          maxAutoIdx = idx;
        }
      });
      if (maxAutoIdx !== -1) {
        hls.autoLevelCapping = maxAutoIdx;
      }
    } else {
      hls.autoLevelCapping = -1;
    }
  }, [ecoMode, currentLevel, hlsLevels]);

  useEffect(() => {
    let timer: any = null;

    if (!isPlaying && !ecoMode) {
      // Set a timer to stop loading after 5 minutes of pause (300,000ms)
      timer = setTimeout(() => {
        if (hlsRef.current) {
          hlsRef.current.stopLoad();
        }
      }, 300000); // 5 minutes
    } else {
      // If we play, or if ecoMode is enabled, ensure loading is active
      if (hlsRef.current) {
        hlsRef.current.startLoad();
      }
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [isPlaying, ecoMode]);

  useEffect(() => {
    if (!videoUrl) return;

    let isCancelled = false;
    let currentBlobUrl: string | null = null;
    const number = 50;
    const width = 160;

    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.setAttribute('playsinline', 'true');
    v.setAttribute('webkit-playsinline', 'true');
    v.playsInline = true;
    v.preload = 'auto';

    v.style.position = 'absolute';
    v.style.width = '1px';
    v.style.height = '1px';
    v.style.opacity = '0.001';
    v.style.pointerEvents = 'none';
    v.style.top = '0';
    v.style.left = '0';
    v.style.zIndex = '-9999';

    if (containerRef.current) {
      containerRef.current.appendChild(v);
    } else {
      document.body.appendChild(v);
    }
    
    let hls: Hls | null = null;
    let targetW = 0;
    let targetH = 0;
    
    const onLoadedMetadata = () => {
      setDuration(v.duration);
      if (v.videoWidth && v.videoHeight) {
        setVideoDims({ width: v.videoWidth, height: v.videoHeight });
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const seekAndDraw = (index: number) => {
        if (isCancelled || !v.duration || !isFinite(v.duration)) return;
        
        if (index >= number) {
          if (ctx) {
             canvas.toBlob((blob) => {
                if (blob && !isCancelled) {
                   const url = URL.createObjectURL(blob);
                   setSpriteUrl(url);
                   if (currentBlobUrl) {
                     const oldUrl = currentBlobUrl;
                     setTimeout(() => URL.revokeObjectURL(oldUrl), 1000);
                   }
                   currentBlobUrl = url;
                }
             }, 'image/jpeg', 0.6);
          }
          return;
        }

        if (index > 0 && index % 5 === 0) {
          if (ctx) {
             canvas.toBlob((blob) => {
                if (blob && !isCancelled) {
                   const url = URL.createObjectURL(blob);
                   setSpriteUrl(url);
                   if (currentBlobUrl) {
                     const oldUrl = currentBlobUrl;
                     setTimeout(() => URL.revokeObjectURL(oldUrl), 1000);
                   }
                   currentBlobUrl = url;
                }
             }, 'image/jpeg', 0.4);
          }
        }

        if (index === 0) {
          const height = Math.round((v.videoHeight / v.videoWidth) * width) || 90;
          setSpriteHeight(height);
          canvas.width = width;
          canvas.height = height * number;
        }

        let hasFired = false;
        const onSeeked = () => {
          if (hasFired) return;
          hasFired = true;
          v.removeEventListener('seeked', onSeeked);
          clearTimeout(seekTimeout);
          if (!isCancelled && ctx) {
            const height = canvas.height / number;
            ctx.drawImage(v, 0, index * height, width, height);
            seekAndDraw(index + 1);
          }
        };

        const seekTimeout = setTimeout(() => {
          if (hasFired) return;
          hasFired = true;
          v.removeEventListener('seeked', onSeeked);
          if (!isCancelled) {
            seekAndDraw(index + 1);
          }
        }, 1000);
        
        v.addEventListener('seeked', onSeeked);
        v.currentTime = (index / number) * v.duration;
      };

      // Dedicated viyie-img-thumbnail calculation
      const viyieImgThumbnail = async () => {
        if (isGeneratingRef.current) return;
        isGeneratingRef.current = true;
        viyieImgThumbnailRef.current = viyieImgThumbnail;

        const d = v.duration;

        try {
          if (videoId) {
            const { db } = await import('../lib/firebase');
            const { doc, getDoc } = await import('firebase/firestore');
            const docSnap = await getDoc(doc(db, 'content', videoId));
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (data.thumbnails && data.thumbnails.length > 0) {
                setBestThumbnails(data.thumbnails);
                setGeneratedPoster(data.posterUrl || data.thumbnails[0]);
                isGeneratingRef.current = false;
                seekAndDraw(0);
                return;
              }
            }
          }

          if (poster) {
            isGeneratingRef.current = false;
            seekAndDraw(0);
            return;
          }
          const evaluateFrame = (
            tempCanvas: HTMLCanvasElement,
            tempCtx: CanvasRenderingContext2D
          ): {
            isMostlyBlack: boolean;
            isFadeScene: boolean;
            sharpness: number;
            isBlurry: boolean;
            humanScore: number;
            hasHumanCharacter: boolean;
            textScore: number;
            hasTextCharacter: boolean;
            sideEdgeRatio: number;
            colorfulness: number;
            panoramaScore: number;
            standardScore: number;
          } => {
            const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            const data = imgData.data;
            const len = data.length;

            // 1. Check if mostly black/white and calculate contrast / fade conditions
            let darkCount = 0;
            let brightCount = 0;
            const sampleStep = 40;
            let totalSamples = 0;
            let sumLuminance = 0;
            let lumSamples: number[] = [];
            let colorfulnessSum = 0;

            for (let i = 0; i < len; i += sampleStep * 4) {
              const r = data[i];
              const g = data[i+1];
              const b = data[i+2];
              totalSamples++;
              const lum = 0.299 * r + 0.587 * g + 0.114 * b;
              sumLuminance += lum;
              lumSamples.push(lum);
              if (lum < 20) {
                darkCount++;
              }
              if (lum > 235) {
                brightCount++;
              }
              colorfulnessSum += (Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r));
            }

            const isMostlyBlack = totalSamples > 0 ? (darkCount / totalSamples) > 0.85 : true;
            const isMostlyWhite = totalSamples > 0 ? (brightCount / totalSamples) > 0.85 : false;

            const avgLuminance = lumSamples.length > 0 ? sumLuminance / lumSamples.length : 0;
            const colorfulness = totalSamples > 0 ? (colorfulnessSum / totalSamples) : 0;

            let sumAbsDiff = 0;
            let sumSqDiff = 0;
            for (const lum of lumSamples) {
              const diff = lum - avgLuminance;
              sumAbsDiff += Math.abs(diff);
              sumSqDiff += diff * diff;
            }
            const meanDev = lumSamples.length > 0 ? sumAbsDiff / lumSamples.length : 0;
            const stdDev = lumSamples.length > 0 ? Math.sqrt(sumSqDiff / lumSamples.length) : 0;

            // 2. Check for motion blur/sharpness with directional checks (step = 5)
            let totalHDiff = 0;
            let totalVDiff = 0;
            let diffCount = 0;
            const step = 5; // high detail capture
            const w = tempCanvas.width;
            const h = tempCanvas.height;

            for (let y = 10; y < h - 10; y += step) {
              for (let x = 10; x < w - 10; x += step) {
                const idx = (y * w + x) * 4;
                const current = 0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2];

                const idxRight = (y * w + Math.min(w - 1, x + 2)) * 4;
                const right = 0.299 * data[idxRight] + 0.587 * data[idxRight+1] + 0.114 * data[idxRight+2];

                const idxBottom = (Math.min(h - 1, y + 2) * w + x) * 4;
                const bottom = 0.299 * data[idxBottom] + 0.587 * data[idxBottom+1] + 0.114 * data[idxBottom+2];

                const hDiff = Math.abs(current - right);
                const vDiff = Math.abs(current - bottom);

                totalHDiff += hDiff;
                totalVDiff += vDiff;
                diffCount++;
              }
            }

            const hSharpness = diffCount > 0 ? (totalHDiff / diffCount) : 0;
            const vSharpness = diffCount > 0 ? (totalVDiff / diffCount) : 0;
            const sharpness = (hSharpness + vSharpness) / 2;

            // Enhanced motion blur and general blur detection
            const isMotionBlur = (sharpness < 9.0) || 
                                 (sharpness < 15.0 && (hSharpness < 4.5 || vSharpness < 4.5)) ||
                                 (sharpness < 13.0 && Math.max(hSharpness, vSharpness) / Math.max(0.1, Math.min(hSharpness, vSharpness)) > 2.2);
            const isBlurry = isMotionBlur;

            // Advanced Fade Scene, Transition, & Cross-fade Detection
            const isLowContrast = stdDev < 42.0 || meanDev < 32.0;
            const isExtremelyLowContrast = stdDev < 35.0 || meanDev < 26.0;

            const isFadeScene = 
              isMostlyBlack || 
              isMostlyWhite || 
              avgLuminance < 32.0 || 
              avgLuminance > 223.0 || 
              isExtremelyLowContrast || 
              (isLowContrast && (sharpness < 13.0 || colorfulness < 15.0)) || // typical cross-fade/dissolve signature
              (stdDev < 48.0 && sharpness < 11.0); // low-contrast and blurry (transition/fade state)

            // 3. Human and Anime/3D/CGI Character & Doraemon/Disney/Donghua color detection
            let skinCount = 0;
            let leftRightTopEdgeSkinCount = 0;

            for (let i = 0; i < len; i += 16 * 4) {
              const pixelIndex = i / 4;
              const x = pixelIndex % w;
              const y = Math.floor(pixelIndex / w);

              const r = data[i];
              const g = data[i+1];
              const b = data[i+2];

              // Heuristics for standard human skin
              const isHumanSkin = r > 95 && g > 40 && b > 20 &&
                                  (Math.max(r, g, b) - Math.min(r, g, b) > 15) &&
                                  Math.abs(r - g) > 15 && r > g && r > b;
                                  
              // Heuristics for Anime/3D/CGI peach/light skin
              const isCgiSkin = r > 190 && g > 155 && b > 130 &&
                                r > g && g > b &&
                                (r - b) < 65 && (r - b) > 15;

              // Heuristics for Doraemon blue
              const isDoraemonBlue = b > 115 && r < 130 && g > 85 && g < 195 && b > g;

              // Heuristics for bright animation character colors (like Pikachu, Minion Yellow, Mickey Red, Shrek Green)
              const isVibrantCharacterColor = (r > 185 && g > 145 && b < 100 && (r - g) < 55) || // Yellow
                                              (r > 185 && g < 70 && b < 70) || // Red
                                              (r < 75 && g > 155 && b < 110); // Green

              const isCharacterColor = isHumanSkin || isCgiSkin || isDoraemonBlue || isVibrantCharacterColor;

              if (isCharacterColor) {
                skinCount++;
                // Check if skin is near left/right (12% margins) or top (12% margin)
                const isNearSideEdge = x < (w * 0.12) || x > (w * 0.88);
                const isNearTopEdge = y < (h * 0.12);
                if (isNearSideEdge || isNearTopEdge) {
                  leftRightTopEdgeSkinCount++;
                }
              }
            }

            const skinTotal = Math.floor(len / (16 * 4));
            const humanScore = skinTotal > 0 ? (skinCount / skinTotal) * 100 : 0;
            // More accommodating bounds for 3D/Anime/CGI character detection
            const hasHumanCharacter = humanScore > 1.8 && humanScore < 55.0;
            const sideEdgeRatio = skinCount > 0 ? (leftRightTopEdgeSkinCount / skinCount) : 0;

            // 4. Text / Subtitle Character Detection
            let textEdgeCount = 0;
            let textSampleCount = 0;
            for (let y = 16; y < h - 16; y += 12) {
              for (let x = 16; x < w - 16; x += 12) {
                const idx = (y * w + x) * 4;
                const r = data[idx];
                const g = data[idx+1];
                const b = data[idx+2];
                const currentLum = 0.299 * r + 0.587 * g + 0.114 * b;

                const idxRight = (y * w + (x + 3)) * 4;
                const rightLum = 0.299 * data[idxRight] + 0.587 * data[idxRight+1] + 0.114 * data[idxRight+2];

                const idxBottom = ((y + 3) * w + x) * 4;
                const bottomLum = 0.299 * data[idxBottom] + 0.587 * data[idxBottom+1] + 0.114 * data[idxBottom+2];

                textSampleCount++;
                if ((Math.abs(currentLum - rightLum) > 70 || Math.abs(currentLum - bottomLum) > 70) && currentLum > 150) {
                  textEdgeCount++;
                }
              }
            }
            const textScore = textSampleCount > 0 ? (textEdgeCount / textSampleCount) * 100 : 0;
            const hasTextCharacter = textScore > 0.8 && textScore < 12.0;

            // Calculate standard score
            let standardScore = 0;
            if (isFadeScene || isMostlyBlack) {
              standardScore = -100000;
            } else if (!hasHumanCharacter || humanScore < 1.8) {
              // If we do not have a detected character, but the frame is a gorgeous scenic/3D Disney castle/Donghua landscape:
              if (colorfulness > 25 && sharpness > 18) {
                standardScore = -1200; // Scenic bypass! Give it a very soft penalty instead of -50000, allowing it to compete!
              } else {
                standardScore = -50000;
              }
            } else {
              // Blur penalty
              if (isBlurry) {
                standardScore -= 5000;
              }
              // Sharpness reward
              standardScore += sharpness * 25;
              // Text penalty
              if (hasTextCharacter) {
                standardScore -= (textScore * 500);
              }
              // Human/Character score reward
              if (humanScore >= 4.0 && humanScore <= 40.0) {
                standardScore += (humanScore * 1000);
              } else {
                standardScore += (humanScore * 100);
              }
              // Margin/composition
              if (sideEdgeRatio < 0.35) {
                standardScore += 8000;
              } else if (sideEdgeRatio > 0.6) {
                standardScore -= 10000;
              } else {
                standardScore += (1 - sideEdgeRatio) * 4000;
              }
            }

            // Calculate panorama score
            let panoramaScore = sharpness * 50 + colorfulness * 60;
            if (isFadeScene || isMostlyBlack || isBlurry) {
              panoramaScore = -100000;
            } else {
              if (humanScore > 4.0) {
                panoramaScore -= (humanScore * 300); // strong penalization of close-up faces to ensure scenic panorama
              }
              if (hasTextCharacter) {
                panoramaScore -= (textScore * 500); // penalize text overlay
              }
              // Reward well-composed shots (scenery shouldn't have elements hugging the side margin edge)
              if (sideEdgeRatio < 0.35) {
                panoramaScore += 6000;
              }
            }

            return {
              isMostlyBlack,
              isFadeScene,
              sharpness,
              isBlurry,
              humanScore,
              hasHumanCharacter,
              textScore,
              hasTextCharacter,
              sideEdgeRatio,
              colorfulness,
              panoramaScore,
              standardScore
            };
          };

          const captureFrame = (time: number): Promise<{
            url: string;
            base64?: string;
            isMostlyBlack: boolean;
            isFadeScene: boolean;
            sharpness: number;
            isBlurry: boolean;
            humanScore: number;
            hasHumanCharacter: boolean;
            textScore: number;
            hasTextCharacter: boolean;
            sideEdgeRatio: number;
            colorfulness: number;
            panoramaScore: number;
            standardScore: number;
          }> => {
            return new Promise((resolve) => {
              const startTime = Date.now();
              const onSeeked = () => {
                v.removeEventListener('seeked', onSeeked);
                if (isCancelled) {
                  resolve({
                    url: '',
                    isMostlyBlack: true,
                    isFadeScene: true,
                    sharpness: 0,
                    isBlurry: true,
                    humanScore: 0,
                    hasHumanCharacter: false,
                    textScore: 0,
                    hasTextCharacter: false,
                    sideEdgeRatio: 1.0,
                    colorfulness: 0,
                    panoramaScore: -100000,
                    standardScore: -100000
                  });
                  return;
                }

                const checkAndCapture = () => {
                  const elapsed = Date.now() - startTime;
                  if (isHls && targetW > 0 && v.videoWidth < targetW && elapsed < 1500) {
                    setTimeout(checkAndCapture, 50);
                    return;
                  }

                  try {
                    const aspect = (v.videoWidth && v.videoHeight) ? (v.videoWidth / v.videoHeight) : (16 / 9);
                    let finalW = v.videoWidth || 1280;
                    let finalH = v.videoHeight || 720;
                    
                    if (targetW > 0) {
                      if (finalW < targetW) {
                        finalW = targetW;
                        finalH = Math.round(targetW / aspect);
                      }
                    } else if (targetH > 0) {
                      if (finalH < targetH) {
                        finalH = targetH;
                        finalW = Math.round(targetH * aspect);
                      }
                    }

                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = finalW;
                    tempCanvas.height = finalH;
                    const tempCtx = tempCanvas.getContext('2d');
                    if (tempCtx) {
                      tempCtx.drawImage(v, 0, 0, finalW, finalH);
                      const evalResult = evaluateFrame(tempCanvas, tempCtx);
                      const base64Data = tempCanvas.toDataURL('image/jpeg', 0.85);

                      tempCanvas.toBlob((blob) => {
                        if (blob && !isCancelled) {
                          const url = URL.createObjectURL(blob);
                          resolve({
                            url,
                            base64: base64Data,
                            isMostlyBlack: evalResult.isMostlyBlack,
                            isFadeScene: evalResult.isFadeScene,
                            sharpness: evalResult.sharpness,
                            isBlurry: evalResult.isBlurry,
                            humanScore: evalResult.humanScore,
                            hasHumanCharacter: evalResult.hasHumanCharacter,
                            textScore: evalResult.textScore,
                            hasTextCharacter: evalResult.hasTextCharacter,
                            sideEdgeRatio: evalResult.sideEdgeRatio,
                            colorfulness: evalResult.colorfulness,
                            panoramaScore: evalResult.panoramaScore,
                            standardScore: evalResult.standardScore
                          });
                        } else {
                          resolve({
                            url: '',
                            isMostlyBlack: true,
                            isFadeScene: true,
                            sharpness: 0,
                            isBlurry: true,
                            humanScore: 0,
                            hasHumanCharacter: false,
                            textScore: 0,
                            hasTextCharacter: false,
                            sideEdgeRatio: 1.0,
                            colorfulness: 0,
                            panoramaScore: -100000,
                            standardScore: -100000
                          });
                        }
                      }, 'image/jpeg', 0.95);
                    } else {
                      resolve({
                        url: '',
                        isMostlyBlack: true,
                        isFadeScene: true,
                        sharpness: 0,
                        isBlurry: true,
                        humanScore: 0,
                        hasHumanCharacter: false,
                        textScore: 0,
                        hasTextCharacter: false,
                        sideEdgeRatio: 1.0,
                        colorfulness: 0,
                        panoramaScore: -100000,
                        standardScore: -100000
                      });
                    }
                  } catch (err) {
                    console.warn('Failed capturing frame from background video:', err);
                    resolve({
                      url: '',
                      isMostlyBlack: true,
                      isFadeScene: true,
                      sharpness: 0,
                      isBlurry: true,
                      humanScore: 0,
                      hasHumanCharacter: false,
                      textScore: 0,
                      hasTextCharacter: false,
                      sideEdgeRatio: 1.0,
                      colorfulness: 0,
                      panoramaScore: -100000,
                      standardScore: -100000
                    });
                  }
                };

                checkAndCapture();
              };

              v.addEventListener('seeked', onSeeked);
              v.currentTime = time;
            });
          };

          // Try different timestamps: 20%, 35%, 50%, 65%, 80% and 1 random aesthetic percentage.
          const randomAesthetic = parseFloat((0.15 + Math.random() * 0.7).toFixed(2));
          const candidatePercentages = [
            0.20, 0.35, 0.50, 0.65, 0.80, randomAesthetic
          ];

          let allCaptured: {
            url: string;
            base64?: string;
            isMostlyBlack: boolean;
            isFadeScene: boolean;
            sharpness: number;
            isBlurry: boolean;
            humanScore: number;
            hasHumanCharacter: boolean;
            textScore: number;
            hasTextCharacter: boolean;
            sideEdgeRatio: number;
            colorfulness: number;
            panoramaScore: number;
            standardScore: number;
          }[] = [];

          let selectedUrlsGlobal = new Set<string>();

          const updateSelectedThumbnails = () => {
            if (allCaptured.length === 0) return;

            // 1. Filter out absolute invalid scenes (fade or mostly black)
            const validCandidates = allCaptured.filter(c => !c.isFadeScene && !c.isMostlyBlack);

            if (validCandidates.length === 0) {
              // If none are valid, fallback to whatever we have sorted by sharpness
              const sortedAll = [...allCaptured].sort((a, b) => b.sharpness - a.sharpness);
              const topUrls = sortedAll.slice(0, 6).map(c => c.url);
              selectedUrlsGlobal = new Set(topUrls);
              setBestThumbnails(topUrls);
              if (sortedAll.length > 0) {
                setGeneratedPoster(sortedAll[0].url);
                setDetectedThumbnailInfo({
                  sharpness: sortedAll[0].sharpness,
                  hasHumanCharacter: sortedAll[0].hasHumanCharacter,
                  humanScore: sortedAll[0].humanScore,
                  hasTextCharacter: sortedAll[0].hasTextCharacter,
                  textScore: sortedAll[0].textScore
                });
              }
              return;
            }

            // 2. Select 1 Best Panorama image
            // We rank by panoramaScore. A panorama must not be blurry, mostly black, or fade.
            const panoramaCandidates = validCandidates.filter(c => !c.isBlurry && c.panoramaScore > -50000);
            const sortedPanorama = [...(panoramaCandidates.length > 0 ? panoramaCandidates : validCandidates)]
              .sort((a, b) => b.panoramaScore - a.panoramaScore);
            
            const selectedPanorama = sortedPanorama[0]; // best panorama candidate

            // 3. Select 5 Best Standard images
            // They cannot be the same URL as the chosen panorama image.
            const remainingCandidates = validCandidates.filter(c => c.url !== selectedPanorama.url);

            // Filter for standard requirements: hasHumanCharacter and not blurry
            let standardCandidates = remainingCandidates.filter(c => c.hasHumanCharacter && !c.isBlurry);
            if (standardCandidates.length === 0) {
              standardCandidates = remainingCandidates.filter(c => !c.isBlurry);
            }
            if (standardCandidates.length === 0) {
              standardCandidates = remainingCandidates;
            }

            const sortedStandard = [...standardCandidates].sort((a, b) => {
              const scoreA = a.standardScore + (a.panoramaScore * 0.3);
              const scoreB = b.standardScore + (b.panoramaScore * 0.3);
              return scoreB - scoreA;
            });
            const topStandard = sortedStandard.slice(0, 5);

            // 4. Combine: 1 Panorama and 5 Standard
            const selectedList: typeof allCaptured = [];
            if (selectedPanorama) {
              selectedList.push(selectedPanorama);
            }
            topStandard.forEach(c => {
              selectedList.push(c);
            });

            // If we still have fewer than 6, fill with other remaining candidates
            if (selectedList.length < 6) {
              const currentUrls = new Set(selectedList.map(c => c.url));
              const extraCandidates = validCandidates
                .filter(c => !currentUrls.has(c.url))
                .sort((a, b) => {
                  const scoreA = a.standardScore + (a.panoramaScore * 0.3);
                  const scoreB = b.standardScore + (b.panoramaScore * 0.3);
                  return scoreB - scoreA;
                });
              
              for (const extra of extraCandidates) {
                if (selectedList.length >= 6) break;
                selectedList.push(extra);
              }

              if (selectedList.length < 6) {
                const currentUrls2 = new Set(selectedList.map(c => c.url));
                const extraAll = allCaptured
                  .filter(c => !currentUrls2.has(c.url))
                  .sort((a, b) => b.sharpness - a.sharpness);
                for (const extra of extraAll) {
                  if (selectedList.length >= 6) break;
                  selectedList.push(extra);
                }
              }
            }

            // Update state
            const finalUrls = selectedList.map(c => c.url);
            selectedUrlsGlobal = new Set(finalUrls);
            setBestThumbnails(finalUrls);

            // Let the absolute best standard candidate (or panorama if standard isn't available) be the main generatedPoster
            const mainPosterCandidate = selectedList[1] || selectedList[0] || selectedPanorama;
            if (mainPosterCandidate) {
              setGeneratedPoster(mainPosterCandidate.url);
              setDetectedThumbnailInfo({
                sharpness: mainPosterCandidate.sharpness,
                hasHumanCharacter: mainPosterCandidate.hasHumanCharacter,
                humanScore: mainPosterCandidate.humanScore,
                hasTextCharacter: mainPosterCandidate.hasTextCharacter,
                textScore: mainPosterCandidate.textScore
              });
            }
          };

          for (const pct of candidatePercentages) {
            if (isCancelled) break;
            const targetTime = pct * d;
            const res = await captureFrame(targetTime);
            if (isCancelled) {
              if (res.url) URL.revokeObjectURL(res.url);
              break;
            }

            if (res.url) {
              allCaptured.push(res);
              updateSelectedThumbnails();
            }
          }

          if (!isCancelled && videoId) {
            const selectedList: typeof allCaptured = [];
            const validCandidates = allCaptured.filter(c => !c.isFadeScene && !c.isMostlyBlack);
            
            if (validCandidates.length === 0) {
              const sortedAll = [...allCaptured].sort((a, b) => b.sharpness - a.sharpness);
              selectedList.push(...sortedAll.slice(0, 6));
            } else {
              const panoramaCandidates = validCandidates.filter(c => !c.isBlurry && c.panoramaScore > -50000);
              const sortedPanorama = [...(panoramaCandidates.length > 0 ? panoramaCandidates : validCandidates)]
                .sort((a, b) => b.panoramaScore - a.panoramaScore);
              const selectedPanorama = sortedPanorama[0];

              if (selectedPanorama) {
                selectedList.push(selectedPanorama);
              }

              const remainingCandidates = validCandidates.filter(c => c.url !== (selectedPanorama ? selectedPanorama.url : ''));
              let standardCandidates = remainingCandidates.filter(c => c.hasHumanCharacter && !c.isBlurry);
              if (standardCandidates.filter(c => c.hasHumanCharacter && !c.isBlurry).length === 0) {
                standardCandidates = remainingCandidates.filter(c => !c.isBlurry);
              }
              if (standardCandidates.length === 0) {
                standardCandidates = remainingCandidates;
              }
              const sortedStandard = [...standardCandidates].sort((a, b) => b.standardScore - a.standardScore);
              const topStandard = sortedStandard.slice(0, 5);
              topStandard.forEach(c => selectedList.push(c));

              if (selectedList.length < 6) {
                const currentUrls = new Set(selectedList.map(c => c.url));
                const extraCandidates = validCandidates
                  .filter(c => !currentUrls.has(c.url))
                  .sort((a, b) => b.standardScore - a.standardScore);
                for (const extra of extraCandidates) {
                  if (selectedList.length >= 6) break;
                  selectedList.push(extra);
                }
              }

              if (selectedList.length < 6) {
                const currentUrls2 = new Set(selectedList.map(c => c.url));
                const extraAll = allCaptured
                  .filter(c => !currentUrls2.has(c.url))
                  .sort((a, b) => b.sharpness - a.sharpness);
                for (const extra of extraAll) {
                  if (selectedList.length >= 6) break;
                  selectedList.push(extra);
                }
              }
            }

            const base64s = selectedList.map(c => c.base64).filter(Boolean) as string[];
            if (base64s.length > 0) {
              if (typeof window !== 'undefined') {
              import('../lib/firebase').then(({ db }) => {
                import('firebase/firestore').then(({ doc, updateDoc, getDoc }) => {
                  const docRef = doc(db, 'content', videoId);
                  getDoc(docRef).then((docSnap) => {
                    if (docSnap.exists()) {
                      const data = docSnap.data();
                      if (!data.thumbnails || data.thumbnails.length === 0) {
                        const updateData: any = { thumbnails: base64s };
                        if (!data.posterUrl) {
                          updateData.posterUrl = base64s[0];
                        }
                        updateDoc(docRef, updateData)
                          .then(() => console.log('Successfully saved base64 thumbnails to Firestore'))
                          .catch(e => console.warn('updateDoc thumbnails failed', e));
                      }
                    }
                  });
                });
              });
            }
            }
          }

          // Cleanup unused Blob URLs to avoid memory leak
          for (const cap of allCaptured) {
            if (cap.url && !selectedUrlsGlobal.has(cap.url)) {
              URL.revokeObjectURL(cap.url);
            }
          }
        } catch (err) {
          console.warn('viyie-img-thumbnail failed', err);
        } finally {
          isGeneratingRef.current = false;
          if (!isCancelled) {
            seekAndDraw(0);
          }
        }
      };

      viyieImgThumbnail();
    };

    v.addEventListener('loadedmetadata', onLoadedMetadata);
    v.addEventListener('resize', () => {
      setVideoDims({ width: v.videoWidth, height: v.videoHeight });
    });

    const isHls = (videoUrl.includes('.m3u8') || videoUrl.includes('proxy-playlist') || videoUrl.includes('v-stream') || videoUrl.includes('dynamic-icons.png')) && !videoUrl.includes('.mpd');
    if (isHls && Hls.isSupported()) {
      hls = new Hls({
        pLoader: CustomPlaylistLoader as any,
        autoStartLoad: false,
        maxBufferLength: 1,
        maxMaxBufferLength: 2,
        maxBufferSize: 1 * 1024 * 1024,
        backBufferLength: 0,
        enableWorker: true,
        lowLatencyMode: true
      });
      hls.loadSource(videoUrl);
      hls.attachMedia(v);
      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        if (hls && data && data.levels && data.levels.length > 0) {
          let lowestIdx = 0;
          let minHeight = Infinity;
          data.levels.forEach((l, idx) => {
            let height = l.height;
            const attrs = (l as any).attrs || {};
            if (!height && attrs.RESOLUTION) {
              const resMatch = attrs.RESOLUTION.match(/(\d+)x(\d+)/);
              if (resMatch) height = parseInt(resMatch[2], 10);
            }
            if (!height && l.name) {
              const match = l.name.match(/(\d+)p/i) || l.name.match(/(\d+)/);
              if (match) {
                height = parseInt(match[1], 10);
              }
            }
            if (!height && l.bitrate) {
              if (l.bitrate < 400000) height = 360;
              else if (l.bitrate < 1000000) height = 480;
              else if (l.bitrate < 2500000) height = 720;
              else if (l.bitrate < 5000000) height = 1080;
              else height = 1440;
            }
            const currentHeight = height || 0;
            if (currentHeight > 0 && currentHeight < minHeight) {
              minHeight = currentHeight;
              lowestIdx = idx;
            }
          });
          
          if (minHeight === Infinity) {
            lowestIdx = 0;
          }
          
          const targetLevel = hls.levels[lowestIdx];
          if (targetLevel) {
            targetW = targetLevel.width || 0;
            targetH = targetLevel.height || 0;
            if (!targetW && targetLevel.attrs?.RESOLUTION) {
              const resMatch = targetLevel.attrs.RESOLUTION.match(/(\d+)x(\d+)/);
              if (resMatch) {
                targetW = parseInt(resMatch[1], 10);
                targetH = parseInt(resMatch[2], 10);
              }
            }
            if (!targetH && minHeight && minHeight !== Infinity) {
              targetH = minHeight;
              targetW = Math.round(minHeight * (16 / 9));
            }
          }
          
          hls.currentLevel = lowestIdx;
          hls.loadLevel = lowestIdx;
          hls.nextLevel = lowestIdx;
          hls.nextLoadLevel = lowestIdx;
          hls.startLoad();
        }
      });
    } else {
      v.src = videoUrl;
      v.load();
    }

    return () => {
      isCancelled = true;
      v.removeEventListener('loadedmetadata', onLoadedMetadata);
      if (v.parentNode) {
        v.parentNode.removeChild(v);
      }
      if (hls) hls.destroy();
      if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
    };
  }, [videoUrl]);

  useEffect(() => {
    if (!videoId) return;
    setHasPlayed(false);
  }, [videoId]);

  useEffect(() => {
    if (!videoUrl) return;
    try {
      const key = `viyie_progress_${encodeURIComponent(videoUrl)}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const time = parseFloat(saved);
        if (time > 5) {
          setLastWatched(time);
          setShowContinue(true);
          setTimeout(() => setShowContinue(false), 30000);
        }
      }
    } catch(e) {
      console.warn("localStorage error", e);
    }
  }, [videoUrl]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current && currentTime > 5 && duration > 0) {
        try {
          const key = `viyie_progress_${encodeURIComponent(videoUrl)}`;
          if (currentTime < duration - 5) {
            localStorage.setItem(key, currentTime.toString());
          } else {
            localStorage.removeItem(key);
          }
        } catch(e) {}
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [currentTime, duration, videoUrl]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Constrain position to prevent menu from overflowing screen boundaries
    const menuWidth = 220;
    const menuHeight = 250; // Approximated height of context menu to be safe
    const constrainedX = x + menuWidth > rect.width ? Math.max(10, rect.width - menuWidth - 10) : x;
    const constrainedY = y + menuHeight > rect.height ? Math.max(10, rect.height - menuHeight - 15) : y;

    setContextMenu({ x: constrainedX, y: constrainedY });
    setContextMenuView('main');
    setShowControls(true);
  };

  const togglePlay = () => {
    if (isAudioOnly) {
      if (audioRef.current) {
        if (!audioRef.current.paused) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          audioRef.current.play().catch(e => console.warn(e));
          setIsPlaying(true);
        }
      }
      return;
    }
    if (videoRef.current) {
      if (!videoRef.current.paused) videoRef.current.pause();
      else videoRef.current.play().catch(e => console.warn("Video play prevented:", e));
    }
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    if (videoRef.current) {
      videoRef.current.muted = (selectedAudioOption === 'external' || selectedAudioOption === 'audio-only') ? true : newMuted;
    }
    if (audioRef.current) {
      audioRef.current.muted = newMuted;
    }
    setIsMuted(newMuted);
    showNotice(newMuted ? `${t('Volume')}: 0%` : `${t('Volume')}: ${Math.round(volume * 100)}%`);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = (selectedAudioOption === 'external' || selectedAudioOption === 'audio-only') ? true : val === 0;
    }
    if (audioRef.current) {
      audioRef.current.volume = val;
      audioRef.current.muted = val === 0;
    }
    setIsMuted(val === 0);
    showNotice(`${t('Volume')}: ${Math.round(val * 100)}%`);
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        if (containerRef.current) {
          await containerRef.current.requestFullscreen();
        } else {
          await document.documentElement.requestFullscreen();
        }
      } catch (e) {
        console.warn('Fullscreen API error', e);
      }
      setIsFullscreen(true);
    } else {
      try {
        await document.exitFullscreen();
      } catch (e) {
        console.warn('Fullscreen API error', e);
      }
      setIsFullscreen(false);
    }
  };

  const toggleWebFullscreen = () => {
    setIsWebFullscreen(!isWebFullscreen);
  };

  const togglePip = async () => {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled && videoRef.current) {
      await videoRef.current.requestPictureInPicture();
    }
  };

  const handleScreenshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUri = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUri;
      a.download = `screenshot_${formatTime(currentTime)}.png`;
      a.click();
      showNotice(t('Screenshot Saved'));
    }
  };

  const handleVideoTouchStart = (e: React.TouchEvent<any>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const side = x < rect.width / 2 ? 'left' : 'right';

    touchXStartRef.current = touch.clientX;
    touchYStartRef.current = touch.clientY;
    touchStartTimeRef.current = Date.now();
    touchHasMovedRef.current = false;
    touchActiveTypeRef.current = 'none';
    
    touchStartVolumeRef.current = volume;
    touchStartBrightnessRef.current = brightness;
    touchStartVideoTimeRef.current = videoRef.current ? videoRef.current.currentTime : 0;

    // Start a timer for hold-to-speed up (e.g. 400ms)
    if (touchHoldTimerRef.current) clearTimeout(touchHoldTimerRef.current);
    touchHoldTimerRef.current = setTimeout(() => {
      if (!touchHasMovedRef.current && touchActiveTypeRef.current === 'none') {
        touchActiveTypeRef.current = 'hold-speed';
        beforeHoldPlaybackRateRef.current = playbackRate;
        if (side === 'right') {
          applySpeed(2.0);
          showNotice(t('2x Speed (Holding Right)'));
        } else {
          applySpeed(0.5);
          showNotice(t('0.5x Speed (Holding Left)'));
        }
      }
    }, 400);
  };

  const handleVideoTouchMove = (e: React.TouchEvent<any>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchXStartRef.current;
    const deltaY = touch.clientY - touchYStartRef.current;
    
    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      touchHasMovedRef.current = true;
      if (touchHoldTimerRef.current) {
        clearTimeout(touchHoldTimerRef.current);
        touchHoldTimerRef.current = null;
      }
    }

    if (touchActiveTypeRef.current === 'hold-speed') {
      return;
    }

    if (touchActiveTypeRef.current === 'none' && touchHasMovedRef.current) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        touchActiveTypeRef.current = 'swipe-x';
      } else {
        const rect = e.currentTarget.getBoundingClientRect();
        const startXFromLeft = touchXStartRef.current - rect.left;
        if (startXFromLeft < rect.width / 2) {
          touchActiveTypeRef.current = 'swipe-y-left';
        } else {
          touchActiveTypeRef.current = 'swipe-y-right';
        }
      }
    }

    if (touchActiveTypeRef.current === 'swipe-x') {
      if (e.cancelable) e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const pctChange = deltaX / rect.width;
      const maxChange = Math.max(120, duration * 0.2);
      const newTime = Math.max(0, Math.min(duration || 0, touchStartVideoTimeRef.current + pctChange * maxChange));
      seekTo(newTime);
      setIsTouchScrubbing(true);
      setScrubTime(newTime);
      setShowControls(true);
      showNotice(`${t('Duration')}: ${formatTime(newTime)}`);
    } else if (touchActiveTypeRef.current === 'swipe-y-left') {
      if (e.cancelable) e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const pctChange = -deltaY / rect.height;
      const newVolume = Math.max(0, Math.min(1.0, touchStartVolumeRef.current + pctChange));
      setVolume(newVolume);
      if (videoRef.current) videoRef.current.volume = newVolume;
      if (audioRef.current && selectedAudioOption === 'external') {
        audioRef.current.volume = newVolume;
      }
      showNotice(`${t('Volume')}: ${Math.round(newVolume * 100)}%`);
    } else if (touchActiveTypeRef.current === 'swipe-y-right') {
      if (e.cancelable) e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const pctChange = -deltaY / rect.height;
      const newBrightness = Math.max(0.1, Math.min(1.0, touchStartBrightnessRef.current + pctChange));
      setBrightness(newBrightness);
      showNotice(`${t('Brightness')}: ${Math.round(newBrightness * 100)}%`);
    }
  };

  const handleVideoTouchEnd = (e: React.TouchEvent<any>) => {
    if (touchHoldTimerRef.current) {
      clearTimeout(touchHoldTimerRef.current);
      touchHoldTimerRef.current = null;
    }

    if (touchActiveTypeRef.current === 'hold-speed') {
      if (beforeHoldPlaybackRateRef.current !== null) {
        const prevSpeed = beforeHoldPlaybackRateRef.current;
        beforeHoldPlaybackRateRef.current = null;
        applySpeed(prevSpeed);
        showNotice(t('Speed Reset'));
      }
      e.preventDefault();
      touchActiveTypeRef.current = 'none';
      return;
    }

    if (touchActiveTypeRef.current === 'swipe-x') {
      const deltaX = (e.changedTouches?.[0]?.clientX || touchXStartRef.current) - touchXStartRef.current;
      const rect = e.currentTarget.getBoundingClientRect();
      const pctChange = deltaX / rect.width;
      const maxChange = Math.max(120, duration * 0.2);
      const newTime = Math.max(0, Math.min(duration || 0, touchStartVideoTimeRef.current + pctChange * maxChange));
      seekTo(newTime);
      setCurrentTime(newTime);
      setIsTouchScrubbing(false);
      setScrubTime(null);
      touchActiveTypeRef.current = 'none';
      e.preventDefault();
      return;
    }

    if (touchActiveTypeRef.current !== 'none') {
      e.preventDefault();
      touchActiveTypeRef.current = 'none';
      return;
    }
  };

  const handleVideoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (showSettings || showQualityMenu || showSubtitleMenu || showMobileVolume || contextMenu) {
      setShowSettings(false);
      setShowQualityMenu(false);
      setShowSubtitleMenu(false);
      setShowMobileVolume(false);
      setContextMenu(null);
      return;
    }

    const v = videoRef.current;
    if (!v) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const side = x < rect.width / 2 ? 'left' : 'right';

    // Check if interaction is touch-based
    const isTouch = (e.nativeEvent as any).pointerType === 'touch' || 
                    (e.nativeEvent as any).type?.startsWith('touch') ||
                    (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    
    if (clickCountRef.current === 0 || clickSideRef.current === side) {
      clickCountRef.current += 1;
      clickSideRef.current = side;
    } else {
      clickCountRef.current = 1;
      clickSideRef.current = side;
    }
    
    const currentCount = clickCountRef.current;
    
    if (currentCount >= 2) {
      if (side === 'left') {
        const totalSkip = (currentCount - 1) * 5;
        const newTime = isAudioOnly ? Math.max(0, currentTime - 5) : Math.max(0, v.currentTime - 5);
        seekTo(newTime);
        triggerSkipFeedback('left', `-${totalSkip}s`);
      } else {
        const totalSkip = (currentCount - 1) * 5;
        const newTime = isAudioOnly ? Math.min(duration || 0, currentTime + 5) : Math.min(v.duration || 0, v.currentTime + 5);
        seekTo(newTime);
        triggerSkipFeedback('right', `+${totalSkip}s`);
      }
      
      setShowControls(true);
      
      clickTimeoutRef.current = setTimeout(() => {
        clickCountRef.current = 0;
        clickSideRef.current = null;
        setSkipFeedback(null);
      }, 600);
      
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        if (clickCountRef.current === 1) {
          if (isTouch) {
            // Touch 1x tap: ONLY toggle controls and show play/pause center icon
            const newShow = !showControls;
            setShowControls(newShow);
            
            if (newShow) {
              setCenterIcon({
                type: v.paused ? 'play' : 'pause',
                id: Date.now()
              });
            } else {
              setCenterIcon(null);
            }
          } else {
            // Windows / Desktop mouse click: 1x click triggers play/pause action immediately
            if (isAudioOnly) {
              const a = audioRef.current;
              if (a) {
                if (a.paused) {
                  a.play().catch(() => {});
                  setCenterIcon({ type: 'play', id: Date.now() });
                } else {
                  a.pause();
                  setCenterIcon({ type: 'pause', id: Date.now() });
                }
              }
            } else {
              if (v.paused) {
                v.play().catch(() => {});
                setCenterIcon({ type: 'play', id: Date.now() });
              } else {
                v.pause();
                setCenterIcon({ type: 'pause', id: Date.now() });
              }
            }
            setShowControls(true);
          }
          
          clickCountRef.current = 0;
          clickSideRef.current = null;
        }
      }, 250);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
      
      const v = videoRef.current;
      if (!v) return;
      if (!e.key) return;

      switch(e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'z':
          if (!e.repeat) {
            beforeHoldPlaybackRateRef.current = playbackRate;
            applySpeed(2.0);
            showNotice(t('2x Speed (Holding Z)'));
          }
          break;
        case 'shift':
          if (!e.repeat) {
            beforeHoldPlaybackRateRef.current = playbackRate;
            applySpeed(0.5);
            showNotice(t('0.5x Speed (Holding Shift)'));
          }
          break;
        case '<':
        case ',':
        case 'arrowleft':
          {
            const newTime = isAudioOnly ? Math.max(0, currentTime - 5) : Math.max(0, v.currentTime - 5);
            seekTo(newTime);
          }
          triggerSkipFeedback('left', '-5s');
          showNotice(t('Rewind 5s'));
          break;
        case '>':
        case '.':
        case 'arrowright':
          {
            const newTime = isAudioOnly ? Math.min(duration || 0, currentTime + 5) : Math.min(v.duration || 0, v.currentTime + 5);
            seekTo(newTime);
          }
          triggerSkipFeedback('right', '+5s');
          showNotice(t('Forward 5s'));
          break;
        case 'arrowup':
          e.preventDefault();
          const curV1 = isAudioOnly && audioRef.current ? audioRef.current.volume : v.volume;
          const upVol = Math.min(1, curV1 + 0.05);
          setVolume(upVol);
          if (videoRef.current) {
            videoRef.current.volume = upVol;
            videoRef.current.muted = (selectedAudioOption === 'external' || selectedAudioOption === 'audio-only') ? true : upVol === 0;
          }
          if (audioRef.current) {
            audioRef.current.volume = upVol;
            audioRef.current.muted = upVol === 0;
          }
          setIsMuted(upVol === 0);
          showNotice(`${t('Volume')}: ${Math.round(upVol * 100)}%`);
          break;
        case 'arrowdown':
          e.preventDefault();
          const curV2 = isAudioOnly && audioRef.current ? audioRef.current.volume : v.volume;
          const dnVol = Math.max(0, curV2 - 0.05);
          setVolume(dnVol);
          if (videoRef.current) {
            videoRef.current.volume = dnVol;
            videoRef.current.muted = (selectedAudioOption === 'external' || selectedAudioOption === 'audio-only') ? true : dnVol === 0;
          }
          if (audioRef.current) {
            audioRef.current.volume = dnVol;
            audioRef.current.muted = dnVol === 0;
          }
          setIsMuted(dnVol === 0);
          showNotice(`${t('Volume')}: ${Math.round(dnVol * 100)}%`);
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'w':
          toggleWebFullscreen();
          break;
        case 'r':
          e.preventDefault();
          {
            const hls = hlsRef.current;
            const curTime = v.currentTime;
            const wasPlaying = !v.paused;
            setIsReloading(true);

            if (hls) {
              const curLvl = hls.currentLevel;
              hls.stopLoad();
              hls.loadSource(videoUrl);

              const onManifestParsed = () => {
                hls.off(Hls.Events.MANIFEST_PARSED, onManifestParsed);

                // Keep the exact same quality level/resolution and load playlist
                hls.currentLevel = curLvl;
                hls.loadLevel = curLvl;
                hls.nextLevel = curLvl;
                hls.startLoad();

                v.currentTime = curTime;

                if (wasPlaying) {
                  v.play()
                    .then(() => setIsReloading(false))
                    .catch(() => setIsReloading(false));
                } else {
                  setIsReloading(false);
                }
              };

              hls.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);
              showNotice(t('Reloading Resolution Playlist...'));
            } else {
              v.load();
              v.currentTime = curTime;
              if (wasPlaying) {
                v.play()
                  .then(() => setIsReloading(false))
                  .catch(() => setIsReloading(false));
              } else {
                setIsReloading(false);
              }
              showNotice(t('Reloading Video...'));
            }
          }
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          showNotice(!isMuted ? t('Muted') : t('Unmuted'));
          break;
        case 's':
          handleScreenshot();
          break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
      if (!e.key) return;

      const k = e.key.toLowerCase();
      if (k === 'z' || k === 'shift') {
        if (beforeHoldPlaybackRateRef.current !== null) {
          const prevSpeed = beforeHoldPlaybackRateRef.current;
          beforeHoldPlaybackRateRef.current = null;
          applySpeed(prevSpeed);
          showNotice(t('Speed Reset'));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isFullscreen, isWebFullscreen, isMuted, videoUrl, playbackRate]);

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only left click
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = pos * duration;
    
    isScrubbingRef.current = true;
    setIsMouseScrubbing(true);
    setScrubTime(time);
    setHoverTime(time);
    setHoverLeft(pos * 100);
    setShowHover(true);

    if (isAudioOnly) {
      setCurrentTime(time);
    } else {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
      }
    }
  };

  const seekTimeout = useRef<any>(null);
  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMouseScrubbing || isTouchScrubbing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = pos * duration;
    setHoverTime(time);
    setHoverLeft(pos * 100);
    setShowHover(true);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    touchStartRef.current = { rect };
    isScrubbingRef.current = true;
    setIsTouchScrubbing(true);
    setShowHover(true);
    
    if (e.cancelable) e.preventDefault();

    const touch = e.touches[0];
    if (touch) {
      const pos = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
      const time = pos * duration;
      setHoverTime(time);
      setHoverLeft(pos * 100);
      setScrubTime(time);
      if (isAudioOnly) {
        setCurrentTime(time);
      } else {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
      }
    }
  };

  useEffect(() => {
    if (!isMouseScrubbing) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!progressBarRef.current) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const time = pos * duration;
      
      setScrubTime(time);
      setHoverTime(time);
      setHoverLeft(pos * 100);
      setShowHover(true);
      
      if (isAudioOnly) {
        setCurrentTime(time);
      } else {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
      }
    };

    const handleWindowMouseUp = (e: MouseEvent) => {
      isScrubbingRef.current = false;
      setIsMouseScrubbing(false);
      setScrubTime(null);
      setShowHover(false);

      if (!progressBarRef.current) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const time = pos * duration;
      seekTo(time);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isMouseScrubbing, duration, isAudioOnly]);

  useEffect(() => {
    if (!isTouchScrubbing) return;

    const handleWindowTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      if (e.cancelable) e.preventDefault();
      
      const { rect } = touchStartRef.current;
      const touch = e.touches[0];
      if (!touch) return;
      
      const pos = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
      const time = pos * duration;
      setHoverTime(time);
      setHoverLeft(pos * 100);
      setScrubTime(time);
      
      if (isAudioOnly) {
        setCurrentTime(time);
      } else {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
      }
    };

    const handleWindowTouchEnd = (e: TouchEvent) => {
      isScrubbingRef.current = false;
      setIsTouchScrubbing(false);
      setShowHover(false);
      setScrubTime(null);
      
      if (touchStartRef.current && e.changedTouches && e.changedTouches[0]) {
        const { rect } = touchStartRef.current;
        const touch = e.changedTouches[0];
        const pos = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
        const time = pos * duration;
        seekTo(time);
      }
      touchStartRef.current = null;
    };

    window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
    window.addEventListener('touchend', handleWindowTouchEnd);
    window.addEventListener('touchcancel', handleWindowTouchEnd);

    return () => {
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowTouchEnd);
      window.removeEventListener('touchcancel', handleWindowTouchEnd);
    };
  }, [isTouchScrubbing, duration, isAudioOnly]);

  // 1. Detect subtitles from master playlist (client-side auto-detection)
  useEffect(() => {
    if (!activeVideoUrl) {
      setDetectedSubtitles([]);
      return;
    }

    const detectSubtitlesFromPlaylist = async () => {
      try {
        let fetchUrl = activeVideoUrl;
        
        if (fetchUrl.startsWith('VIYIE-SEC:')) {
          const parts = fetchUrl.substring(10).split('::');
          if (parts.length >= 2) {
            const encryptedHex = parts[0];
            const keyStr = parts[1];
            let decrypted = '';
            for (let i = 0; i < encryptedHex.length; i += 2) {
              const hexByte = encryptedHex.substring(i, i + 2);
              const charCode = parseInt(hexByte, 16);
              const keyChar = keyStr.charCodeAt((i / 2) % keyStr.length);
              decrypted += String.fromCharCode(charCode ^ keyChar);
            }
            fetchUrl = decrypted;
          }
        }

        let proxyFetchUrl = fetchUrl;
        if (fetchUrl.startsWith('http://') || fetchUrl.startsWith('https://')) {
          proxyFetchUrl = `/api/v-stream?url=${encodeURIComponent(fetchUrl)}`;
        }

        const res = await fetch(proxyFetchUrl);
        if (!res.ok) return;
        let text = await res.text();

        // Decrypt if response content itself is encrypted
        if (text.startsWith('VIYIE-SEC:')) {
          const base64 = text.substring(10);
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i) ^ 0x2C;
          }
          text = new TextDecoder('utf-8').decode(bytes);
        }

        const lines = text.split('\n');
        const foundSubs: { lang: string; url: string }[] = [];

        for (let line of lines) {
          line = line.trim();
          if (line.includes('TYPE=SUBTITLES')) {
            const nameMatch = line.match(/NAME="([^"]+)"/i);
            const langMatch = line.match(/LANGUAGE="([^"]+)"/i);
            const uriMatch = line.match(/URI="([^"]+)"/i);

            if (uriMatch) {
              const subUri = uriMatch[1];
              let absoluteSubUrl = subUri;
              if (!subUri.startsWith('http://') && !subUri.startsWith('https://')) {
                try {
                  absoluteSubUrl = new URL(subUri, fetchUrl).toString();
                } catch (e) {
                  absoluteSubUrl = subUri;
                }
              }

              const langLabel = nameMatch?.[1] || langMatch?.[1] || 'Sub';
              
              if (!foundSubs.some(s => s.lang === langLabel)) {
                foundSubs.push({
                  lang: langLabel,
                  url: absoluteSubUrl
                });
              }
            }
          }
        }

        console.log('[Subtitle Auto-Detection] Found subtitles:', foundSubs);
        setDetectedSubtitles(foundSubs);
      } catch (err) {
        console.warn('[Subtitle Auto-Detection Error]', err);
      }
    };

    detectSubtitlesFromPlaylist();
  }, [activeVideoUrl]);

  // 2. Synchronize native text tracks (useful for iOS Safari/native HLS playback)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !video.textTracks || hlsRef.current) return;

    const syncNativeTracks = () => {
      const tracks: any[] = [];
      for (let i = 0; i < video.textTracks.length; i++) {
        const t = video.textTracks[i];
        if (t.kind === 'subtitles' || t.kind === 'captions') {
          tracks.push({
            lang: t.label || t.language || `Subtitle ${i + 1}`,
            url: '',
            isNativeTrack: true,
            trackIndex: i
          });
        }
      }
      setNativeTextTracks(tracks);
    };

    video.textTracks.addEventListener('addtrack', syncNativeTracks);
    video.textTracks.addEventListener('removetrack', syncNativeTracks);
    syncNativeTracks();

    return () => {
      if (video.textTracks) {
        video.textTracks.removeEventListener('addtrack', syncNativeTracks);
        video.textTracks.removeEventListener('removetrack', syncNativeTracks);
      }
    };
  }, [activeVideoUrl, hlsSubtitles]);

  // 3. Listen to native text tracks cue changes to channel them to our beautiful custom overlay
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !video.textTracks) return;

    const handleCueChange = (e: Event) => {
      const track = e.target as TextTrack;
      if (track.mode === 'showing') {
        track.mode = 'hidden';
      }
      if (track.activeCues && track.activeCues.length > 0) {
        const texts: string[] = [];
        for (let i = 0; i < track.activeCues.length; i++) {
          const cue = track.activeCues[i] as VTTCue;
          if (cue && cue.text) {
            texts.push(cue.text);
          }
        }
        setActiveCueText(texts.join('\n').replace(/<[^>]+>/g, ''));
      } else {
        setActiveCueText('');
      }
    };

    const tracks = video.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].addEventListener('cuechange', handleCueChange);
      tracks[i].mode = 'hidden';
    }

    const handleAddTrack = (e: TrackEvent) => {
      if (e.track) {
        e.track.addEventListener('cuechange', handleCueChange);
        e.track.mode = 'hidden';
      }
    };

    tracks.addEventListener('addtrack', handleAddTrack);

    return () => {
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].removeEventListener('cuechange', handleCueChange);
      }
      tracks.removeEventListener('addtrack', handleAddTrack);
    };
  }, [activeSubtitle]);

  // Load and parse selected subtitles (supports direct links, Dropbox, Google Drive via proxy)
  useEffect(() => {
    if (activeSubtitle === 'Off') {
      setCues([]);
      setActiveCueText('');
      return;
    }

    if (activeSubtitle.startsWith('Lokal: ')) {
      // For local subtitles, cues are already set when uploaded/parsed
      return;
    }

    const sub = allSubtitles.find(s => s.lang === activeSubtitle);
    if (!sub) return;

    if (sub.isHlsTrack || sub.isNativeTrack) {
      // Hls.js or Safari Native TextTrack handles this natively
      return;
    }

    let targetUrl = sub.url;
    if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
      targetUrl = `/api/proxy-subtitle?url=${encodeURIComponent(targetUrl)}`;
    }

    // #----------------------------------------------------------------------
    // PARSING SUBTITLE & KONSEP OFFSET BAWAAN ADMIN:
    // Konsep Utama:
    // 1. Mengunduh file subtitle (SRT / VTT).
    // 2. Jika url eksternal, dilewatkan melalui `/api/proxy-subtitle` untuk menghindari isu CORS.
    // 3. Menggunakan parser `parseVttOrSrt` untuk memecah teks menjadi array dari objek `Cue` (start, end, text).
    // 4. Jika Admin menentukan nilai `offset` pada daftar subtitle, nilai tersebut akan langsung
    //    diakumulasikan ke waktu 'start' dan 'end' dari masing-masing Cue di tingkat player.
    //    Ini membuat subtitle langsung pas di player tanpa memaksa user mengatur ulang offset di client.
    // #----------------------------------------------------------------------
    fetch(targetUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.text();
      })
      .then((text) => {
        let parsed = parseVttOrSrt(text);
        if (sub.offset) {
          const shiftSec = parseFloat(sub.offset.toString()) || 0;
          if (shiftSec !== 0) {
            parsed = parsed.map(cue => ({
              ...cue,
              start: Math.max(0, cue.start + shiftSec),
              end: Math.max(0, cue.end + shiftSec)
            }));
          }
        }
        setCues(parsed);
      })
      .catch((err) => {
        console.error('Failed to load subtitle track:', err);
        setCues([]);
        setActiveCueText('');
      });
  }, [activeSubtitle, allSubtitles]);

  // Auto subtitle selection on video load / subtitle change
  useEffect(() => {
    if (!videoUrl) return;

    // Only run this auto-selection if the video actually changed!
    if (lastLoadedVideoRef.current === videoUrl) {
      return;
    }

    if (!allSubtitles || allSubtitles.length === 0) {
      setActiveSubtitle('Off');
      return;
    }

    // Mark as loaded
    lastLoadedVideoRef.current = videoUrl;

    const selectDefaultSubtitle = async () => {
      // 1. Check if user configured a preferred default subtitle (and it's not 'Off' or 'Auto')
      if (defaultSubLang && defaultSubLang !== 'Off' && defaultSubLang !== 'Auto') {
        const matched = allSubtitles.find(s => isLanguageMatch(s.lang, defaultSubLang));
        if (matched) {
          setActiveSubtitle(matched.lang);
          return;
        }
      }

      // 2. Check if default subtitle preference is 'Off'
      if (defaultSubLang === 'Off') {
        setActiveSubtitle('Off');
        return;
      }

      // 3. Fallback to 'Auto' or if no matches found: detect country using server
      try {
        const response = await fetch('/api/detect-country');
        if (!response.ok) throw new Error('Failed to fetch country');
        const data = await response.json();
        const country = (data.country || '').toUpperCase();

        let targetKeywords: string[] = [];
        if (country === 'ID') {
          targetKeywords = ['indonesia', 'indonesian', 'indo', 'id', 'bahasa'];
        } else if (['US', 'GB', 'CA', 'AU', 'NZ'].includes(country)) {
          targetKeywords = ['english', 'eng', 'en'];
        } else if (country === 'MY') {
          targetKeywords = ['malay', 'malaysia', 'melayu', 'ms', 'indonesia', 'indonesian'];
        } else if (country === 'BR') {
          targetKeywords = ['portuguese', 'português', 'pt', 'br'];
        } else if (country === 'ES') {
          targetKeywords = ['spanish', 'español', 'es'];
        } else if (country === 'FR') {
          targetKeywords = ['french', 'français', 'fr'];
        } else if (country === 'DE') {
          targetKeywords = ['german', 'deutsch', 'de'];
        } else if (country === 'JP') {
          targetKeywords = ['japanese', '日本語', 'jp', 'ja'];
        } else if (country === 'KR') {
          targetKeywords = ['korean', '한국어', 'kr', 'ko'];
        } else if (['CN', 'TW', 'HK'].includes(country)) {
          targetKeywords = ['chinese', '中文', 'cn', 'zh', 'mandarin'];
        }

        if (targetKeywords.length > 0) {
          const matched = allSubtitles.find(s => {
            const langLower = s.lang.toLowerCase();
            return targetKeywords.some(keyword => langLower.includes(keyword));
          });
          if (matched) {
            setActiveSubtitle(matched.lang);
            return;
          }
        }
      } catch (e) {
        console.warn('Country auto subtitle selection failed:', e);
      }

      // 4. Default fallback: search for english, then first subtitle available, or Off
      const englishSub = allSubtitles.find(s => s.lang.toLowerCase().includes('eng'));
      if (englishSub) {
        setActiveSubtitle(englishSub.lang);
      } else if (allSubtitles.length > 0) {
        setActiveSubtitle(allSubtitles[0].lang);
      } else {
        setActiveSubtitle('Off');
      }
    };

    selectDefaultSubtitle();
  }, [allSubtitles, videoUrl, defaultSubLang]);

  // #----------------------------------------------------------------------
  // SINKRONISASI SUBTITLE PRESISI TINGGI (RAF LOOP):
  // Konsep Utama:
  // 1. Jika video di-pause, sinkronisasi waktu dan cue subtitle diperbarui dengan event-driven React standard.
  // 2. Jika video sedang dimainkan (playing), React hook useEffect mendaftarkan `requestAnimationFrame` (RAF).
  // 3. RAF loop berjalan 60fps+, membandingkan waktu video yang terus berjalan secara real-time 
  //    dengan start-end dari array `cues` untuk transisi teks subtitle yang instan, responsif, dan tanpa jeda/flicker.
  // #----------------------------------------------------------------------
  // Update active subtitle and precise time when paused or seeking
  useEffect(() => {
    if (isPlaying) return; // Let the high-precision RAF loop handle it when playing
    
    if (cues.length === 0) {
      setActiveCueText('');
      setActiveCue(null);
      setPreciseTime(currentTime);
      return;
    }
    
    const adjustedTime = currentTime + subOffset;
    const currentCue = cues.find(c => adjustedTime >= c.start && adjustedTime <= c.end);
    if (currentCue) {
      setActiveCueText(currentCue.text);
      setActiveCue(currentCue);
    } else {
      setActiveCueText('');
      setActiveCue(null);
    }
    setPreciseTime(currentTime);
  }, [isPlaying, currentTime, cues, subOffset]);

  // High-precision RAF loop for buttery-smooth typing/karaoke and instant active cue transitions when playing
  useEffect(() => {
    if (!isPlaying) return;
    const video = videoRef.current;
    if (!video || cues.length === 0) return;

    let animId: number;
    let lastTime = video.currentTime;
    let lastPerf = performance.now();

    const update = () => {
      const now = performance.now();
      const currentVideoTime = video.currentTime;
      
      if (currentVideoTime !== lastTime) {
        lastTime = currentVideoTime;
        lastPerf = now;
      }
      
      const elapsed = (now - lastPerf) / 1000;
      const interpolatedTime = lastTime + elapsed * video.playbackRate;
      
      // Clamp to prevent drift if video pauses/buffers without triggering events
      const maxDrift = 0.25;
      const clampedTime = Math.max(
        currentVideoTime,
        Math.min(currentVideoTime + maxDrift, interpolatedTime)
      );

      const adjustedTime = clampedTime + subOffset;
      
      let foundCue: Cue | null = null;
      for (let i = 0; i < cues.length; i++) {
        const c = cues[i];
        if (adjustedTime >= c.start && adjustedTime <= c.end) {
          foundCue = c;
          break;
        }
      }

      // Update active cue state only if it changed
      setActiveCue(prevCue => {
        if (prevCue !== foundCue) {
          setActiveCueText(foundCue ? foundCue.text : '');
          return foundCue;
        }
        return prevCue;
      });

      // Only update preciseTime state at 60fps if the active cue requires animation (isTypingAnimation or isKaraoke)
      if (foundCue && (foundCue.isTypingAnimation || foundCue.isKaraoke)) {
        setPreciseTime(clampedTime);
      } else {
        // Otherwise, sync with clampedTime without high-frequency renders if it drifts
        setPreciseTime(prev => {
          if (Math.abs(prev - clampedTime) > 0.05) {
            return clampedTime;
          }
          return prev;
        });
      }

      animId = requestAnimationFrame(update);
    };

    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, cues, subOffset]);

  const applySpeed = (s: number) => {
    setPlaybackRate(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
    setSettingView('main');
  };
  const applyAspect = (a: string) => {
    setAspectRatio(a);
    setSettingView('main');
  };
  const applyFlip = (f: string) => {
    setFlip(f);
    setSettingView('main');
  };
  const applySubtitle = (s: string) => {
    setActiveSubtitle(s);
    setDefaultSubLang(s);
    if (s === 'Off') {
      showNotice(t('Subtitle Disable'));
      if (hlsRef.current) {
        hlsRef.current.subtitleTrack = -1;
      }
      setCues([]);
      setActiveCueText('');
    } else {
      const localTrack = localSubtitles.find(t => t.lang === s);
      if (localTrack) {
        setCues(localTrack.cues);
        showNotice(`${t('Subtitle language')}: ${s}`);
        if (hlsRef.current) {
          hlsRef.current.subtitleTrack = -1;
        }
      } else {
        const sub = allSubtitles.find(x => x.lang === s);
        if (sub) {
          showNotice(`${t('Subtitle language')}: ${sub.lang}`);
          
          if (sub.isHlsTrack && typeof sub.trackId === 'number') {
            if (hlsRef.current) {
              hlsRef.current.subtitleTrack = sub.trackId;
            }
            setCues([]);
            setActiveCueText('');
          } else if (sub.isNativeTrack && typeof sub.trackIndex === 'number') {
            const video = videoRef.current;
            if (video && video.textTracks) {
              for (let i = 0; i < video.textTracks.length; i++) {
                if (i === sub.trackIndex) {
                  video.textTracks[i].mode = 'hidden';
                } else {
                  video.textTracks[i].mode = 'disabled';
                }
              }
            }
            setCues([]);
            setActiveCueText('');
          } else {
            if (hlsRef.current) {
              hlsRef.current.subtitleTrack = -1;
            }
            
            let targetUrl = sub.url;
            if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
              targetUrl = `/api/proxy-subtitle?url=${encodeURIComponent(targetUrl)}`;
            }

            fetch(targetUrl)
              .then((res) => {
                if (!res.ok) throw new Error(`HTTP error ${res.status}`);
                return res.text();
              })
              .then((text) => {
                let parsed = parseVttOrSrt(text);
                if (sub.offset) {
                  const shiftSec = parseFloat(sub.offset.toString()) || 0;
                  if (shiftSec !== 0) {
                    parsed = parsed.map(cue => ({
                      ...cue,
                      start: Math.max(0, cue.start + shiftSec),
                      end: Math.max(0, cue.end + shiftSec)
                    }));
                  }
                }
                setCues(parsed);
              })
              .catch((err) => {
                console.error('Failed to load subtitle track:', err);
                setCues([]);
                setActiveCueText('');
              });
          }
        }
      }
    }
  };

  const handleLocalSubtitleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const parsed = parseVttOrSrt(text);
        if (parsed && parsed.length > 0) {
          const newTrackName = `Lokal: ${file.name}`;
          setLocalSubtitles(prev => {
            const filtered = prev.filter(t => t.lang !== newTrackName);
            return [...filtered, { lang: newTrackName, cues: parsed }];
          });
          setActiveSubtitle(newTrackName);
          setCues(parsed);
          showNotice(`${t('Loaded')}: ${file.name}`);
        } else {
          showNotice(t('Failed: Unsupported format or empty'));
        }
      } catch (err) {
        console.error('Failed to parse local subtitle:', err);
        showNotice(t('Failed to read subtitle file.'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getQualityButtonLabel = () => {
    if (currentLevel === -1) {
      const activeLvl = hlsLevels.find(l => l.index === activeLevelIndex);
      if (activeLvl && activeLvl.height) {
        return `Auto (${getResolutionBadge(activeLvl.height, activeLvl.width)})`;
      }
      return 'Auto';
    }
    const selectedLvl = hlsLevels.find(l => l.index === currentLevel);
    if (selectedLvl && selectedLvl.height) {
      return getResolutionBadge(selectedLvl.height, selectedLvl.width);
    }
    return selectedLvl?.name || 'Auto';
  };

  const applyQuality = (index: number) => {
    setCurrentLevel(index);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = index;
      hlsRef.current.loadLevel = index;
      hlsRef.current.nextLevel = index;
    }
    if (dashPlayerRef.current) {
      dashPlayerRef.current.updateSettings({
        streaming: {
          abr: {
            autoSwitchBitrate: {
              video: index === -1
            }
          }
        }
      });
      if (index !== -1) {
        dashPlayerRef.current.setQualityFor('video', index, true);
      }
    }
    setShowQualityMenu(false);
    showNotice(`${t('Quality')}: ${index === -1 ? t('Auto') : hlsLevels.find(l => l.index === index)?.name}`);
  };

  const getMbps = () => {
    if (hlsRef.current && activeLevelIndex !== -1) {
      const level = hlsRef.current.levels[activeLevelIndex];
      if (level && level.bitrate) {
        return `${(level.bitrate / 1000000).toFixed(2)} Mbps`;
      }
    }
    if (dashPlayerRef.current && activeLevelIndex !== -1) {
      const bitrates = dashPlayerRef.current.getBitrateInfoListFor('video');
      const level = bitrates?.[activeLevelIndex];
      if (level && level.bitrate) {
        return `${(level.bitrate / 1000000).toFixed(2)} Mbps`;
      }
    }
    return '3.50 Mbps';
  };

  const handlePanelTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      isDraggingMorePanelRef.current = true;
      const touch = e.touches[0];
      dragStartPosRef.current = { x: touch.clientX, y: touch.clientY };
      panelStartPosRef.current = { ...morePanelPos };
    }
  };

  const handlePanelTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isDraggingMorePanelRef.current && e.touches.length === 1) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStartPosRef.current.x;
      const deltaY = touch.clientY - dragStartPosRef.current.y;
      
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newX = Math.max(10, Math.min(rect.width - 150, panelStartPosRef.current.x - deltaX));
        const newY = Math.max(10, Math.min(rect.height - 180, panelStartPosRef.current.y + deltaY));
        setMorePanelPos({ x: newX, y: newY });
      }
    }
  };

  const handlePanelTouchEnd = () => {
    isDraggingMorePanelRef.current = false;
  };

  return (
    <div 
      ref={containerRef}
      id="video-wrapper"
      onContextMenu={handleContextMenu}
      className={`relative w-full h-full bg-black group overflow-hidden select-none font-sans flex flex-col items-center justify-center viyieplayer ${isFullscreen ? 'fixed inset-0 z-[99999] w-screen h-screen viyie-fullscreen' : ''} ${isWebFullscreen ? 'fixed inset-0 z-[99999] w-screen h-screen viyie-fullscreen-web' : ''} ${showControls ? 'viyie-hover viyie-controls-show' : ''} ${!showControls && isPlaying ? 'cursor-none' : ''}`}
      style={{
        aspectRatio: isFullscreen || isWebFullscreen || window.location.pathname.includes('/embed') ? undefined : (aspectRatio === 'default' ? '16/9' : aspectRatio === '16:9' ? '16/9' : '4/3'),
      }}

      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Hidden file input for loading local subtitles */}
      <input 
        type="file" 
        ref={localSubInputRef} 
        onChange={handleLocalSubtitleUpload} 
        accept=".srt,.vtt" 
        className="hidden" 
        style={{ display: 'none' }}
      />

      <video
        ref={videoRef}
        loop={isLoop}
        className="max-w-full max-h-full touch-none"
        style={{
          aspectRatio: aspectRatio === 'default' ? 'auto' : aspectRatio === '16:9' ? '16/9' : '4/3',
          objectFit: aspectRatio === 'default' ? 'contain' : 'fill',
          width: aspectRatio === 'default' ? '100%' : 'auto',
          height: '100%',
          transform: (() => {
            let parts: string[] = [];
            parts.push(`rotate(-${rotation === 0 ? 0.0001 : rotation}deg)`);
            if ((rotation === 90 || rotation === 270) && containerSize.width > 0 && containerSize.height > 0) {
              const rotScale = Math.min(1, containerSize.height / containerSize.width);
              if (rotScale < 1) {
                parts.push(`scale(${rotScale})`);
              }
            }
            if (flip === 'horizontal') {
              parts.push('scaleX(-1)');
            } else if (flip === 'vertical') {
              parts.push('scaleY(-1)');
            }
            return parts.join(' ');
          })()
        }}
        poster={poster || generatedPoster || undefined}
        onClick={handleVideoClick}
        onTouchStart={handleVideoTouchStart}
        onTouchMove={handleVideoTouchMove}
        onTouchEnd={handleVideoTouchEnd}
        crossOrigin="anonymous"
        playsInline
        webkit-playsinline="true"
        x-webkit-airplay="allow"
      >
        
      </video>

      {/* Brightness overlay */}
      <div 
        className="absolute inset-0 bg-black pointer-events-none z-[42]" 
        style={{ opacity: Math.max(0, Math.min(0.9, 1.0 - brightness)) }} 
      />
      
      <audio ref={audioRef} preload="auto" />

      {isAudioOnly && (
        <div className="absolute inset-0 bg-[#0c0c0e] flex flex-col items-center justify-center z-[40] pointer-events-none select-none">
          <style>{`
            @keyframes bar-pulse-1 { 0%, 100% { height: 20%; } 50% { height: 100%; } }
            @keyframes bar-pulse-2 { 0%, 100% { height: 10%; } 50% { height: 85%; } }
            @keyframes bar-pulse-3 { 0%, 100% { height: 30%; } 50% { height: 95%; } }
            @keyframes bar-pulse-4 { 0%, 100% { height: 15%; } 50% { height: 75%; } }
            @keyframes bar-pulse-5 { 0%, 100% { height: 25%; } 50% { height: 100%; } }
          `}</style>
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex items-end gap-1.5 h-12">
              <div className="w-1 bg-[#ef4444] rounded-t animate-[bar-pulse-1_0.8s_ease-in-out_infinite]" style={{ animationPlayState: isPlaying ? 'running' : 'paused', height: '20%' }} />
              <div className="w-1 bg-[#ef4444] rounded-t animate-[bar-pulse-2_1.1s_ease-in-out_infinite]" style={{ animationPlayState: isPlaying ? 'running' : 'paused', height: '15%' }} />
              <div className="w-1 bg-[#ef4444] rounded-t animate-[bar-pulse-3_0.9s_ease-in-out_infinite]" style={{ animationPlayState: isPlaying ? 'running' : 'paused', height: '25%' }} />
              <div className="w-1 bg-[#ef4444] rounded-t animate-[bar-pulse-4_1.3s_ease-in-out_infinite]" style={{ animationPlayState: isPlaying ? 'running' : 'paused', height: '10%' }} />
              <div className="w-1 bg-[#ef4444] rounded-t animate-[bar-pulse-5_1.0s_ease-in-out_infinite]" style={{ animationPlayState: isPlaying ? 'running' : 'paused', height: '30%' }} />
            </div>
            
            <div className="space-y-1">
              <div className="text-[14px] font-semibold text-zinc-100 flex items-center justify-center gap-2">
                <Volume2 className="w-4 h-4 text-[#ef4444] animate-pulse" />
                <span>{t('Quota Saver (Audio Only)')}</span>
              </div>
              <p className="text-[11px] text-zinc-400 font-sans">{t('Video streaming is paused. Downloading audio only.')}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Thumbnail Layer - Top-most layer of player container before played */}
      {!hasPlayed && !isPlaying && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            if (contextMenu) {
              setContextMenu(null);
              return;
            }
            setHasPlayed(true);
            if (isAudioOnly) {
              const a = audioRef.current;
              if (a) {
                a.play().catch(err => console.warn("Failed to play audio:", err));
              }
            } else {
              const v = videoRef.current;
              if (v) {
                v.play().catch(err => console.warn("Failed to play video:", err));
              }
            }
          }}
          className="absolute inset-0 z-[999999] bg-black cursor-pointer pointer-events-auto"
        >
          {poster ? (
            <img 
              src={poster} 
              alt="Video Poster" 
              referrerPolicy="no-referrer"
              className="absolute select-none viyie-imgthumbnail block" 
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                minWidth: '100%',
                minHeight: '100%',
              }}
            />
          ) : bestThumbnails.length > 0 ? (
            <div className="absolute inset-0 w-full h-full overflow-hidden">
              {bestThumbnails.map((thumb, index) => (
                <img 
                  key={`${thumb}-${index}`}
                  src={thumb} 
                  alt={`Video Thumbnail ${index + 1}`} 
                  referrerPolicy="no-referrer"
                  className={`absolute select-none viyie-imgthumbnail transition-opacity duration-1000 ease-in-out block ${
                    index === activeThumbnailIndex ? 'opacity-100' : 'opacity-0'
                  }`} 
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    minWidth: '100%',
                    minHeight: '100%',
                  }}
                />
              ))}
            </div>
          ) : generatedPoster ? (
            <img 
              src={generatedPoster} 
              alt="Video Poster" 
              referrerPolicy="no-referrer"
              className="absolute select-none viyie-imgthumbnail block" 
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                minWidth: '100%',
                minHeight: '100%',
              }}
            />
          ) : null}
        </div>
      )}
      
      {hasPlayed && (
        <>
          {/* Click Capture Overlay covering video and black bars */}
          <div 
            className="absolute inset-0 z-10 cursor-pointer touch-none"
            onClick={handleVideoClick}
            onTouchStart={handleVideoTouchStart}
            onTouchMove={handleVideoTouchMove}
            onTouchEnd={handleVideoTouchEnd}
          />

      {/* Center Play/Pause Overlay Indicator */}
      <AnimatePresence>
        {centerIcon && (
          <motion.div
            key={centerIcon.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
          >
            <div 
              onClick={(e) => {
                e.stopPropagation();
                const v = videoRef.current;
                if (!v) return;
                if (v.paused) {
                  v.play().catch(e => console.warn("Center click play prevented:", e));
                  setCenterIcon({ type: 'pause', id: Date.now() });
                } else {
                  v.pause();
                  setCenterIcon({ type: 'play', id: Date.now() });
                }
                setShowControls(true);
              }}
              className="text-white drop-shadow-[0_10px_20px_rgba(0,0,0,0.95)] flex items-center justify-center pointer-events-auto cursor-pointer active:scale-95 transition-all p-5"
            >
              {centerIcon.type === 'play' ? (
                <Play fill="currentColor" className="w-16 h-16 ml-1 text-white" />
              ) : (
                <Pause fill="currentColor" className="w-16 h-16 text-white" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip Feedback Circular Red Overlay (15% opacity with smooth edge fade, cut in half at edges) */}
      <AnimatePresence>
        {skipFeedback && (
          <motion.div
            key={skipFeedback.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className={`absolute top-1/2 -translate-y-1/2 ${
              skipFeedback.side === 'left' ? 'left-[20%] -translate-x-1/2' : 'left-[80%] -translate-x-1/2'
            } w-64 h-64 rounded-full flex items-center justify-center z-30 pointer-events-none`}
            style={{
              background: 'radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 60%, rgba(239, 68, 68, 0) 100%)'
            }}
          >
            <span 
              className="viyie-skip-text text-white text-lg md:text-3xl font-bold tracking-wider select-none text-center"
            >
              {skipFeedback.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Subtitle Overlay */}
      {activeCueText && (
        <div 
          className="absolute left-1/2 w-[90%] max-w-[700px] text-center pointer-events-none z-30 select-none transition-all duration-300 custom-video-subtitle-overlay"
          style={{
            bottom: activeCue?.alignment === 'top'
              ? 'auto'
              : `calc(${showControls ? '6.5rem' : '2rem'} + ${subOffsetV}px + ${(!showControls && isPlaying) ? (isFullscreen ? '18px' : '8px') : '0px'} + ${!showControls ? '12px' : '0px'})`,
            top: activeCue?.alignment === 'top'
              ? `calc(${showControls ? '5.5rem' : '2rem'} + ${subOffsetV}px)`
              : 'auto',
            transform: `translate(calc(-50% + ${subOffsetH}px), 0)`,
          }}
        >
          <div 
            className={`inline-block ${subBg ? 'bg-black/85 px-4.5 py-2.5 rounded-lg border border-white/10 shadow-2xl backdrop-blur-sm' : 'px-2 py-1'}`}
          >
            <p 
              className="tracking-wide leading-relaxed whitespace-pre-line"
              style={{
                fontSize: `${subSize}px`,
                fontFamily: subFontFamily,
                fontWeight: subFontWeight,
                color: subColor,
                ...(subBg ? {} : {
                  WebkitTextStroke: `${subOutline}px #000000`,
                  paintOrder: 'stroke fill',
                  textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                }),
              }}
            >
              {(() => {
                if (!activeCue) return activeCueText;

                // 1. Karaoke Rendering
                if (activeCue.isKaraoke && activeCue.karaokeSegments) {
                  const adjustedTime = preciseTime + subOffset;
                  // Find the index of the latest segment that has started
                  let activeSegIdx = -1;
                  for (let i = 0; i < activeCue.karaokeSegments.length; i++) {
                    if (adjustedTime >= activeCue.karaokeSegments[i].time) {
                      activeSegIdx = i;
                    }
                  }

                  return (
                    <span className="inline-block text-center">
                      {activeCue.karaokeSegments.map((seg, i) => {
                        const isPast = i < activeSegIdx;
                        const isActive = i === activeSegIdx;
                        
                        return (
                          <span 
                            key={i} 
                            className={`transition-all duration-200 ${
                              isPast 
                                ? 'text-amber-400 font-semibold' 
                                : isActive 
                                ? 'text-red-500 font-bold scale-105 inline-block origin-center drop-shadow-[0_0_6px_rgba(239,68,68,0.8)] animate-pulse' 
                                : 'text-white/80'
                            }`}
                          >
                            {seg.text}
                          </span>
                        );
                      })}
                    </span>
                  );
                }

                // 2. Typing Animation Rendering
                if (activeCue.isTypingAnimation) {
                  const adjustedTime = preciseTime + subOffset;
                  const elapsedMs = (adjustedTime - activeCue.start) * 1000;
                  const speed = activeCue.typingSpeed || 80;
                  const totalChars = activeCue.text.length;
                  const visibleCount = Math.min(totalChars, Math.max(0, Math.floor(elapsedMs / speed)));
                  
                  const typedPart = activeCue.text.substring(0, visibleCount);
                  const untypedPart = activeCue.text.substring(visibleCount);

                  return (
                    <span className="relative">
                      <span>{typedPart}</span>
                      <span className="opacity-0 pointer-events-none select-none">{untypedPart}</span>
                      {visibleCount < totalChars && (
                        <span className="inline-block w-[2px] h-[1.1em] bg-red-500 animate-pulse ml-[2px] align-middle" />
                      )}
                    </span>
                  );
                }

                // Default fallback
                return activeCueText;
              })()}
            </p>
          </div>
        </div>
      )}

      <div 
        className={`absolute top-0 left-0 w-full p-4 bg-gradient-to-b from-black/80 to-transparent transition-all duration-500 pointer-events-none z-40 flex items-start justify-between ${showControls ? 'opacity-100' : 'opacity-0'}`}
        style={{
          transform: !showControls && isPlaying 
            ? 'translateY(-100%)' 
            : 'translateY(0)'
        }}
      >
        <h2 className="text-white text-lg font-medium drop-shadow-md truncate pointer-events-auto max-w-[70%]">{title}</h2>
        <div className="flex items-center gap-2 pointer-events-auto">
          <TooltipButton 
            title={ecoMode ? t("Eco Mode Enabled (Max 720p)") : t("Eco Mode")} 
            onClick={(e) => {
              e.stopPropagation();
              const nextEco = !ecoMode;
              setEcoMode(nextEco);
              showNotice(nextEco ? t("Eco Mode Enabled (Max 720p)") : t("Eco Mode Disabled"));
            }}
          >
            {ecoMode ? (
              <Leaf size={isMobile ? 22 : 18} className="text-white fill-white transition-all drop-shadow-md" />
            ) : (
              <Leaf size={isMobile ? 22 : 18} className="text-white transition-all drop-shadow-md opacity-70 hover:opacity-100" />
            )}
          </TooltipButton>
        </div>
      </div>



      {(isWaiting || isReloading) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-40 bg-black/20">
          <svg className="animate-spin text-white w-12 h-12 mb-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {isReloading && (
            <span className="text-white text-sm font-medium tracking-wide drop-shadow-md select-none bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-sm">
              Reloading video...
            </span>
          )}
        </div>
      )}

      {isPipActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-[45] bg-[#09090b]/90 backdrop-blur-md pointer-events-auto">
          <div className="flex flex-col items-center gap-4 text-center p-6 max-w-sm">
            <div className="w-16 h-16 bg-[#23ade5]/10 rounded-full flex items-center justify-center text-[#23ade5] shadow-lg shadow-[#23ade5]/10 border border-[#23ade5]/20 animate-pulse">
              <PictureInPicture size={28} />
            </div>
            <div className="space-y-1.5 select-none">
              <p className="text-white text-sm font-bold uppercase tracking-wider font-mono">{t('Picture-in-Picture Active')}</p>
              <p className="text-zinc-400 text-xs">{t('Video is playing in floating window.')}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (document.pictureInPictureElement) {
                  document.exitPictureInPicture().catch(console.warn);
                }
              }}
              className="mt-2 px-4 py-2 bg-[#23ade5] hover:bg-[#1fa1d6] text-white text-xs font-semibold rounded-lg shadow-lg shadow-[#23ade5]/20 transition-all cursor-pointer flex items-center gap-2 border border-white/5"
            >
              <PictureInPicture size={14} />
              Kembali ke Player
            </button>
          </div>
        </div>
      )}

      <div className={`absolute top-16 left-4 bg-black/80 text-white px-3 py-1.5 rounded text-[13px] pointer-events-none transition-opacity duration-200 z-50 shadow-md ${notice ? 'opacity-100' : 'opacity-0'}`}>
        {notice}
      </div>

      {/* Mini Progress Bar */}
      <div className={`viyie-mini-progressbar absolute bottom-0 left-0 w-full h-[3px] bg-white/20 transition-opacity duration-300 z-20 pointer-events-none ${!showControls && (isPlaying || contextMenu !== null) && !isPipActive ? 'opacity-100' : 'opacity-0'} ${isPipActive ? 'hidden' : ''}`}>
        <div className="absolute h-full bg-[#ef4444]" style={{ width: `${((scrubTime !== null ? scrubTime : currentTime) / duration) * 100}%` }} />
        <div className={`absolute inset-0 overflow-hidden bg-white/5 pointer-events-none transition-opacity duration-500 ${(isWaiting || isReloading) ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute inset-y-0 w-full bg-gradient-to-r from-transparent via-zinc-200/25 to-transparent animate-progress-shimmer" />
        </div>
      </div>

      {/* Invisible bottom mouse sensor zone that always wakes up controls */}
      <div 
        className="absolute bottom-0 left-0 w-full h-[50px] z-25 bg-transparent pointer-events-auto cursor-pointer" 
        onMouseMove={handleMouseMove}
      />

      <div 
        className="viyie-controls-container absolute bottom-0 left-0 w-full transition-all duration-500 z-30" 
        style={{ 
          transform: showControls || !isPlaying 
            ? 'translateY(0)' 
            : 'translateY(8px)', 
          opacity: showControls || !isPlaying ? 1 : 0, 
          pointerEvents: showControls || !isPlaying ? 'auto' : 'none' 
        }}
      >
        <div className="absolute bottom-0 w-full h-24 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
        
        <div className="relative px-3 pb-3">
          {/* Progress Bar Container */}
          <div 
            ref={progressBarRef}
            className={`relative bg-white/20 rounded cursor-pointer group/progress transition-all mb-2 ${
              isTouchScrubbing || isMouseScrubbing ? 'h-[10px]' : (isMobile ? 'h-[6px]' : 'h-[3px] hover:h-[5px]')
            }`}
            onMouseMove={handleProgressHover}
            onMouseLeave={() => setShowHover(false)}
            onMouseDown={handleProgressMouseDown}
            onTouchStart={handleTouchStart}
          >
            {buffered.map((range, i) => (
              <div key={i} className="absolute h-full bg-white/50 rounded" style={{ left: `${(range.start / duration) * 100}%`, width: `${((range.end - range.start) / duration) * 100}%` }} />
            ))}
            <div className="absolute h-full bg-[#ef4444] rounded" style={{ width: `${((scrubTime !== null ? scrubTime : currentTime) / duration) * 100}%` }} />
            
            <div 
              className={`absolute top-1/2 -mt-1.5 w-3 h-3 bg-[#ef4444] rounded-full transition-transform shadow-md ${
                isTouchScrubbing || isMouseScrubbing ? 'scale-150' : (isMobile ? 'scale-100' : 'scale-0 group-hover/progress:scale-100')
              }`} 
              style={{ left: `calc(${((scrubTime !== null ? scrubTime : currentTime) / duration) * 100}% - 6px)` }} 
            />

            <div className={`absolute inset-0 overflow-hidden rounded bg-white/5 pointer-events-none transition-opacity duration-500 ${isWaiting ? 'opacity-100' : 'opacity-0'}`}>
              <div className="absolute inset-y-0 w-full bg-gradient-to-r from-transparent via-zinc-200/25 to-transparent animate-progress-shimmer" />
            </div>
            
            {showHover && (
              <div className="absolute bottom-4 -ml-[80px] w-[160px] flex flex-col items-center pointer-events-none z-50 transition-opacity" style={{ left: `${hoverLeft}%` }}>
                <div className="w-[160px] bg-black border border-white/10 rounded shadow-2xl overflow-hidden mb-1 flex items-center justify-center" style={{ height: spriteHeight }}>
                  {spriteUrl ? (
                    <div 
                      style={{
                        width: 160,
                        height: spriteHeight,
                        backgroundImage: `url(${spriteUrl})`,
                        backgroundPosition: `0px -${Math.min(49, Math.floor((duration > 0 ? hoverTime / duration : 0) * 50)) * spriteHeight}px`
                      }}
                    />
                  ) : (
                    <div className="text-white/50 text-xs">...</div>
                  )}
                </div>
                <span className="text-[12px] text-white font-medium bg-black/80 px-2 py-0.5 rounded shadow">
                  {formatTime(hoverTime)}
                </span>
              </div>
            )}

            {/* Stacking popups on the left side, close buttons on the left */}
            <div className="absolute bottom-6 left-2 flex flex-col gap-2 z-50 pointer-events-auto">
              {showContinue && (
                <div className="bg-black/90 border border-white/10 text-white px-3 py-2 rounded shadow-2xl flex items-center gap-3 whitespace-nowrap cursor-default" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setShowContinue(false)} className="text-zinc-500 hover:text-zinc-300 order-1 cursor-pointer">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                  <span className="text-[12px] text-zinc-300 order-2">{t("Continue watching")} {formatTime(lastWatched)}?</span>
                  <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = lastWatched; setShowContinue(false); }} className="text-[#ef4444] hover:text-red-400 font-medium text-[12px] order-3 cursor-pointer">{t("Play")}</button>
                </div>
              )}


            </div>
          </div>

          <div className={`flex items-center justify-between ${isMobile ? 'h-10' : 'h-8'}`}>
            {/* Left Controls */}
            <div className="flex items-center gap-3">
              <TooltipButton title={isPlaying ? t("Pause") : t("Play")} onClick={togglePlay}>
                {isPlaying ? <Pause size={isMobile ? 22 : 18} fill="currentColor" /> : <Play size={isMobile ? 22 : 18} fill="currentColor" />}
              </TooltipButton>
              
              <div className="flex items-center gap-2 group/volume relative">
                <TooltipButton 
                  title={isMuted || volume === 0 ? "Unmute" : "Mute"} 
                  onClick={(e) => {
                    const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
                    if (isTouch) {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowMobileVolume(!showMobileVolume);
                    } else {
                      toggleMute();
                    }
                  }}
                >
                  {isMuted || volume === 0 ? <VolumeX size={isMobile ? 22 : 18} /> : <Volume2 size={isMobile ? 22 : 18} />}
                </TooltipButton>
                <div className={`h-6 transition-all duration-300 overflow-hidden flex items-center ${
                  showMobileVolume ? 'w-24 px-2' : 'w-0 group-hover/volume:w-24 group-hover/volume:px-2'
                }`}>
                  <input 
                    type="range" min="0" max="1" step="0.01" 
                    value={isMuted ? 0 : volume} 
                    onChange={handleVolumeChange}
                    style={{
                      background: `linear-gradient(to right, #ef4444 ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) ${(isMuted ? 0 : volume) * 100}%)`
                    }}
                    className="w-20 h-1.5 rounded-full appearance-none cursor-pointer outline-none transition-all duration-150
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#ef4444] [&::-webkit-slider-thumb]:shadow-md
                      [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#ef4444] [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:shadow-md"
                  />
                </div>
              </div>

              {!(isMobile && !isFullscreen && !isWebFullscreen && showMobileVolume) && (
                <div className="flex items-center gap-2">
                  <span className={`text-white/90 font-mono tracking-wide ml-1 ${isMobile ? 'text-[14px]' : 'text-[13px]'}`}>
                    {formatTime(currentTime)} <span className="text-white/40 mx-0.5">/</span> {formatTime(duration)}
                  </span>
                </div>
              )}
            </div>
            
             {/* Right Controls */}
            <div className="flex items-center gap-4">
                {true && (
                  <div className="relative flex items-center justify-center">
                    <TooltipButton 
                      title={t("Subtitle")} 
                      active={false} 
                      onClick={(e) => { 
                        e.stopPropagation();
                        setShowSubtitleMenu(!showSubtitleMenu); 
                        setShowSettings(false); 
                        setShowQualityMenu(false); 
                      }}
                    >
                      {activeSubtitle === 'Off' ? (
                        <Subtitles size={isMobile ? 22 : 18} />
                      ) : (
                        <span className={`text-white font-normal ${isMobile ? 'text-[14px]' : 'text-[13px]'}`}>
                          {activeSubtitle}
                        </span>
                      )}
                    </TooltipButton>

                    {showSubtitleMenu && !isMobile && (
                      <div 
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-[#0c0c0c]/90 backdrop-blur-md text-white py-2 z-50 rounded-sm shadow-xl text-[13px] font-sans border border-white/10 min-w-[120px] scale-100 origin-bottom transition-all duration-200 pointer-events-auto cursor-default viyie-menu-scroll overflow-y-auto"
                        style={{ maxHeight: '280px' }}
                      >
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation();
                            applySubtitle('Off'); 
                            setShowSubtitleMenu(false); 
                          }} 
                          className={`flex items-center justify-between w-full px-4 py-2 hover:bg-zinc-800 transition-none text-left font-normal ${activeSubtitle === 'Off' ? 'text-[#ef4444]' : 'text-zinc-200'}`}
                        >
                          {t("Off")} {activeSubtitle === 'Off' && <Check className="w-4 h-4 text-[#ef4444]" />}
                        </button>

                        <button 
                          onClick={(e) => { 
                            e.stopPropagation();
                            localSubInputRef.current?.click();
                          }} 
                          className="flex items-center gap-1.5 w-full px-4 py-2 hover:bg-zinc-800 transition-none text-left font-normal text-zinc-300 hover:text-white border-b border-white/10 mb-1 pb-2 text-[11px]"
                        >
                          <svg className="w-3.5 h-3.5 text-[#ef4444] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          <span>{t("Lokal Subtitle")}</span>
                        </button>

                        {localSubtitles.map((sub, idx) => (
                          <button 
                            key={`local-${sub.lang}-${idx}`} 
                            onClick={(e) => { 
                              e.stopPropagation();
                              applySubtitle(sub.lang); 
                              setShowSubtitleMenu(false); 
                            }} 
                            className={`flex items-center justify-between w-full px-4 py-2 hover:bg-zinc-800 transition-none text-left font-normal ${activeSubtitle === sub.lang ? 'text-[#ef4444]' : 'text-zinc-200'}`}
                          >
                            <span className="truncate max-w-[120px]">{sub.lang}</span>
                            {activeSubtitle === sub.lang && <Check className="w-4 h-4 text-[#ef4444] shrink-0" />}
                          </button>
                        ))}

                        {allSubtitles.map((sub, idx) => (
                          <button 
                            key={`online-${sub.lang}-${idx}`} 
                            onClick={(e) => { 
                              e.stopPropagation();
                              applySubtitle(sub.lang); 
                              setShowSubtitleMenu(false); 
                            }} 
                            className={`flex items-center justify-between w-full px-4 py-2 hover:bg-zinc-800 transition-none text-left font-normal ${activeSubtitle === sub.lang ? 'text-[#ef4444]' : 'text-zinc-200'}`}
                          >
                            {sub.lang} {activeSubtitle === sub.lang && <Check className="w-4 h-4 text-[#ef4444]" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {hlsLevels.length > 0 && (
                  <div className="relative flex items-center justify-center">
                    <button 
                      className={`text-white font-normal opacity-80 hover:opacity-100 transition-opacity flex items-center gap-1 ${isMobile ? 'text-[14px]' : 'text-[13px]'}`}
                      style={{ marginLeft: '-4px', paddingTop: '0px', paddingBottom: '0px', marginTop: '2px' }}
                      onClick={(e) => { e.stopPropagation(); setShowQualityMenu(!showQualityMenu); setShowSettings(false); setShowSubtitleMenu(false); }}
                    >
                      <span>{getQualityButtonLabel()}</span>
                    </button>

                    {showQualityMenu && !isMobile && (
                      <div 
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-[#0c0c0c]/90 backdrop-blur-md text-white py-2 z-50 rounded-sm shadow-xl text-[13px] font-sans border border-white/10 min-w-[120px] scale-100 origin-bottom transition-all duration-200 viyie-menu-scroll overflow-y-auto pointer-events-auto cursor-default"
                        style={{ maxHeight: '280px' }}
                      >
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            applyQuality(-1);
                            setShowQualityMenu(false);
                          }} 
                          className={`flex items-center justify-between w-full px-4 py-2 hover:bg-zinc-800 transition-none text-left font-normal ${currentLevel === -1 ? 'text-[#ef4444]' : 'text-zinc-200'}`}
                        >
                          Auto {currentLevel === -1 && <Check className="w-4 h-4 text-[#ef4444]" />}
                        </button>
                        {hlsLevels.map((level) => {
                          const badge = getResolutionBadge(level.height, level.width);
                          const isCurrent = currentLevel === level.index;
                          const isActiveInAuto = currentLevel === -1 && activeLevelIndex === level.index;
                          const isEcoDisabled = ecoMode && level.height > 720;
                          const resText = getResolutionBadge(level.height, level.width) || level.name;
                          return (
                            <button 
                              key={level.index} 
                              disabled={isEcoDisabled}
                              onClick={(e) => {
                                e.stopPropagation();
                                applyQuality(level.index);
                                setShowQualityMenu(false);
                              }} 
                              className={`flex items-center justify-between w-full px-4 py-2 transition-none text-left font-normal ${
                                isEcoDisabled 
                                  ? 'text-zinc-500 cursor-not-allowed opacity-55 hover:bg-transparent' 
                                  : (isCurrent ? 'text-[#ef4444] hover:bg-zinc-800' : 'text-zinc-200 hover:bg-zinc-800')
                              }`}
                            >
                              <span className="flex items-center gap-1">
                                <span>{resText}</span>
                                {resText.includes('1080p') && (
                                  <span className="text-[8px] font-extrabold text-white bg-red-600 px-1 py-0.5 rounded-[2px] leading-none select-none tracking-wide">
                                    HD
                                  </span>
                                )}
                              </span>
                              {isCurrent && <Check className="w-4 h-4 text-[#ef4444]" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                <TooltipButton title={t("Settings")} active={showSettings} onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); setShowQualityMenu(false); setShowSubtitleMenu(false); }}>
                  <Settings size={isMobile ? 22 : 18} />
                </TooltipButton>
                {!isMobile && (
                  <TooltipButton title={t("Web Fullscreen")} onClick={toggleWebFullscreen}>
                    <img src={isWebFullscreen ? "/viyieplayer/webfullscreen_exit.svg" : "/viyieplayer/webfullscreen.svg"} className="pointer-events-none opacity-90" style={{ width: 18, height: 18 }} />
                  </TooltipButton>
                )}
                <TooltipButton title={t("Fullscreen")} onClick={toggleFullscreen}>
                  {isFullscreen ? <Minimize size={isMobile ? 22 : 18} /> : <Maximize size={isMobile ? 22 : 18} />}
                </TooltipButton>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Menu */}
      {showSettings && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className={`absolute ${isMobile ? 'right-2 bottom-16' : 'right-4 bottom-16'} bg-[#0c0c0c]/95 backdrop-blur-md text-white ${
            isMobile 
              ? (settingView === 'subtitle-edit' ? 'w-[260px]' : 'w-[230px]') 
              : (settingView === 'subtitle-edit' ? 'w-[240px]' : 'w-[200px]')
          } ${isMobile ? 'py-3 text-[14px]' : 'py-2 text-[13px]'} z-50 rounded shadow-2xl font-sans border border-white/10 scale-110 origin-bottom-right transition-all duration-200 viyie-menu-scroll overflow-y-auto`}
          style={{ maxHeight: isMobile ? '280px' : '320px' }}
        >
          {settingView === 'main' && (
            <div className="flex flex-col">
              <button onClick={() => setSettingView('speed')} className="flex items-center justify-between px-4 py-2 hover:bg-zinc-800 transition-none text-left w-full font-normal">
                <div className="flex items-center gap-2 text-zinc-200 font-normal"><img src="/viyieplayer/playspeed.svg" className="w-[14px] h-[14px] opacity-80" /> {t("Play Speed")}</div>
                <span className="text-zinc-400 flex items-center gap-1 font-normal">{playbackRate === 1 ? t('Normal') : `${playbackRate}x`} <ChevronLeft className="w-3 h-3 rotate-180" /></span>
              </button>
              <button onClick={() => setSettingView('aspect')} className="flex items-center justify-between px-4 py-2 hover:bg-zinc-800 transition-none text-left w-full font-normal">
                <div className="flex items-center gap-2 text-zinc-200 font-normal"><img src="/viyieplayer/aspectratio.svg" className="w-[14px] h-[14px] opacity-80" /> {t("Aspect Ratio")}</div>
                <span className="text-zinc-400 flex items-center gap-1 capitalize font-normal">{aspectRatio === 'default' ? t('Normal') : aspectRatio} <ChevronLeft className="w-3 h-3 rotate-180" /></span>
              </button>
              <button onClick={() => setSettingView('flip')} className="flex items-center justify-between px-4 py-2 hover:bg-zinc-800 transition-none text-left w-full font-normal">
                <div className="flex items-center gap-2 text-zinc-200 font-normal"><img src="/viyieplayer/videoflip.svg" className="w-[14px] h-[14px] opacity-80" /> {t("Video Flip")}</div>
                <span className="text-zinc-400 flex items-center gap-1 capitalize font-normal">
                  {flip === 'normal' ? t('Normal') : flip === 'horizontal' ? t('Horizontal') : t('Vertical')} <ChevronLeft className="w-3 h-3 rotate-180" />
                </span>
              </button>
              <button 
                onClick={() => {
                  togglePip();
                  setShowSettings(false);
                }} 
                className="flex items-center justify-between px-4 py-2 hover:bg-zinc-800 transition-none text-left w-full font-normal"
              >
                <div className="flex items-center gap-2 text-zinc-200 font-normal">
                  <PictureInPicture size={14} className="opacity-80" /> {t("PIP Mode")}
                </div>
                <span className="text-zinc-400 flex items-center gap-1 font-normal">{t("Toggle")} <ChevronLeft className="w-3 h-3 rotate-180" /></span>
              </button>
              <button 
                onClick={() => {
                  setShowSettings(false);
                  try {
                    const cast = (window as any).cast;
                    const chrome = (window as any).chrome;
                    if (cast && cast.framework && chrome && chrome.cast) {
                      const castContext = cast.framework.CastContext.getInstance();
                      castContext.requestSession().then((session: any) => {
                        if (session) {
                          const mediaInfo = new chrome.cast.media.MediaInfo(videoUrl, 'video/mp4');
                          mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
                          mediaInfo.metadata.title = title || 'Viyie Player';
                          mediaInfo.metadata.metadataType = chrome.cast.media.MetadataType.GENERIC;
                          
                          const request = new chrome.cast.media.LoadRequest(mediaInfo);
                          request.currentTime = currentTime;
                          
                          session.loadMedia(request).then(() => {
                            showNotice(t('Casting started successfully'));
                          }).catch((err: any) => {
                            console.error('Failed to load media on Cast:', err);
                            showNotice(t('Failed to load video on Chromecast'));
                          });
                        }
                      }).catch((err: any) => {
                        console.warn('Cast session request canceled/failed:', err);
                      });
                    } else {
                      // Fallback to HTML5 Remote Playback / target picker
                      const video = videoRef.current;
                      if (video && (video as any).remote) {
                        (video as any).remote.prompt().then(() => {
                          showNotice(t('Chromecast Prompt Opened'));
                        }).catch((err: any) => {
                          console.warn("Remote playback error:", err);
                          if (video && (video as any).webkitShowPlaybackTargetPicker) {
                            (video as any).webkitShowPlaybackTargetPicker();
                            showNotice(t('Playback target picker opened'));
                          } else {
                            showNotice(t('Cast option not supported by browser'));
                          }
                        });
                      } else if (video && (video as any).webkitShowPlaybackTargetPicker) {
                        (video as any).webkitShowPlaybackTargetPicker();
                        showNotice(t('Playback target picker opened'));
                      } else {
                        showNotice(t('Chromecast not supported by this browser'));
                      }
                    }
                  } catch (e) {
                    showNotice(t('Chromecast failed to open'));
                  }
                }} 
                className="flex items-center justify-between px-4 py-2 hover:bg-zinc-800 transition-none text-left w-full font-normal"
              >
                <div className="flex items-center gap-2 text-zinc-200 font-normal">
                  <svg className="w-[14px] h-[14px] opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
                    <line x1="2" y1="20" x2="2.01" y2="20" />
                  </svg>
                  Chromecast
                </div>
                <span className="text-zinc-400 flex items-center gap-1 font-normal">{t("Open")} <ChevronLeft className="w-3 h-3 rotate-180" /></span>
              </button>
              {true && (
                <button onClick={() => setSettingView('subtitle-edit')} className="flex items-center justify-between px-4 py-2 hover:bg-zinc-800 transition-none text-left w-full font-normal">
                  <div className="flex items-center gap-2 text-zinc-200 font-normal">
                    <svg className="w-[14px] h-[14px] opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="4" y1="21" x2="4" y2="14" />
                      <line x1="4" y1="10" x2="4" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12" y2="3" />
                      <line x1="20" y1="21" x2="20" y2="16" />
                      <line x1="20" y1="12" x2="20" y2="3" />
                      <line x1="2" y1="14" x2="6" y2="14" />
                      <line x1="10" y1="8" x2="14" y2="8" />
                      <line x1="18" y1="16" x2="22" y2="16" />
                    </svg>
                    {t("Subtitle Settings")}
                  </div>
                  <span className="text-zinc-400 flex items-center gap-1 font-normal"><ChevronLeft className="w-3 h-3 rotate-180" /></span>
                </button>
              )}
              <button onClick={() => setSettingView('audio')} className="flex items-center justify-between px-4 py-2 hover:bg-zinc-800 transition-none text-left w-full font-normal border-t border-white/5">
                <div className="flex items-center gap-2 text-zinc-200 font-normal">
                  <Volume2 className="w-[14px] h-[14px] opacity-80" /> {t("Dubbing")}
                </div>
                <span className="text-zinc-400 flex items-center gap-1 font-normal capitalize">
                  {selectedAudioOption === 'default' ? t('Original') : selectedAudioOption === 'external' ? t('Dubbing') : selectedAudioOption === 'audio-only' ? t('Audio Only') : t('Track')} <ChevronLeft className="w-3 h-3 rotate-180" />
                </span>
              </button>
              {isMobile && (
                <button 
                  onClick={() => setSettingView('info')}
                  className="flex items-center justify-between px-4 py-2 hover:bg-zinc-800 transition-none text-left w-full font-normal border-t border-[#ef4444]/20"
                >
                  <div className="flex items-center gap-2 text-[#ef4444] font-medium">
                    <MoreHorizontal className="w-[14px] h-[14px]" /> {t("Others")}
                  </div>
                  <ChevronLeft className="w-3 h-3 rotate-180 text-[#ef4444]" />
                </button>
              )}
            </div>
          )}

          {settingView !== 'main' && (
            <div className="flex flex-col">
              {settingView !== 'subtitle-edit' ? (
                <>
                  <button onClick={() => setSettingView('main')} className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-800 transition-none border-b border-white/10 text-zinc-300 font-normal">
                    <ChevronLeft className="w-4 h-4 -ml-1" /> {t("Back")}
                  </button>
                  
                  {settingView === 'info' && (
                    <div className="flex flex-col gap-2 px-4 py-2 text-[13px] text-zinc-200">
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-zinc-400">{t("Resolution")}</span>
                        <span className="font-mono">
                          {videoRef.current?.videoWidth 
                            ? `${videoRef.current.videoWidth}x${videoRef.current.videoHeight} (${getResolutionBadge(videoRef.current.videoHeight, videoRef.current.videoWidth)})` 
                            : (videoDims.width ? `${videoDims.width}x${videoDims.height}` : 'Unknown')}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-zinc-400">FPS</span>
                        <span className="font-mono">{measuredFps} fps</span>
                      </div>
                      
                      {isMobile && (
                        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-white/10">
                          <button 
                            onClick={() => {
                              setShowTouchShortcutsPanel(true);
                              setShowSettings(false);
                            }}
                            className="flex items-center gap-3 px-3 py-2 bg-white/5 active:bg-[#ef4444]/20 hover:bg-white/5 hover:text-white transition-colors text-left text-zinc-200 rounded-md font-medium text-[13px]"
                          >
                            <Sliders size={16} className="opacity-80 text-[#ef4444]" /> {t("Touch Shortcuts Guide")}
                          </button>
                          
                          <button 
                            onClick={() => {
                              setShowVideoInfo(true);
                              setShowSettings(false);
                            }}
                            className="flex items-center gap-3 px-3 py-2 bg-white/5 active:bg-[#ef4444]/20 hover:bg-white/5 hover:text-white transition-colors text-left text-zinc-200 rounded-md font-medium text-[13px]"
                          >
                            <Info size={16} className="opacity-80 text-[#ef4444]" /> {t("Video Info")}
                          </button>
                          
                          <button 
                            onClick={() => {
                              const nextRot = (rotation + 90) % 360;
                              setRotation(nextRot);
                              showNotice(t("Rotate Display") + `: ${nextRot === 0 ? t('Normal') : `${nextRot}°`}`);
                            }}
                            className="flex items-center gap-3 px-3 py-2 bg-white/5 active:bg-[#ef4444]/20 hover:bg-white/5 hover:text-white transition-colors text-left text-zinc-200 rounded-md font-medium text-[13px]"
                          >
                            <img src="/viyieplayer/videoflip.svg" className="w-[16px] h-[16px] opacity-80" /> {t("Rotate Display")}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {settingView === 'speed' && [0.5, 0.75, 1, 1.25, 1.5, 2].map(s => (
                    <button key={s} onClick={() => applySpeed(s)} className="flex items-center justify-between px-4 py-2 hover:bg-zinc-800 transition-none text-zinc-200 text-left w-full font-normal">
                      {s === 1 ? t('Normal') : `${s}x`} {playbackRate === s && <Check className="w-4 h-4 text-[#ef4444]" />}
                    </button>
                  ))}

                  {settingView === 'aspect' && ['default', '4:3', '16:9'].map(a => (
                    <button key={a} onClick={() => applyAspect(a)} className="flex items-center justify-between px-4 py-2 hover:bg-zinc-800 transition-none capitalize text-zinc-200 text-left w-full font-normal">
                      {a === 'default' ? t('Normal') : a} {aspectRatio === a && <Check className="w-4 h-4 text-[#ef4444]" />}
                    </button>
                  ))}

                  {settingView === 'flip' && ['normal', 'horizontal', 'vertical'].map(f => (
                    <button key={f} onClick={() => applyFlip(f)} className="flex items-center justify-between px-4 py-2 hover:bg-zinc-800 transition-none capitalize text-zinc-200 text-left w-full font-normal">
                      {f === 'normal' ? t('Normal') : f === 'horizontal' ? t('Horizontal') : t('Vertical')} {flip === f && <Check className="w-4 h-4 text-[#ef4444]" />}
                    </button>
                  ))}

                  {settingView === 'audio' && (
                    <div className="flex flex-col gap-1 py-1 text-[13px]">
                      <div className="px-4 py-1 text-[11px] text-zinc-500 font-semibold uppercase tracking-wider select-none">
                        {t("Dubbing")}
                      </div>
                        
                      <button 
                        onClick={() => {
                          setSelectedAudioOption('default');
                          toggleAudioOnly(false);
                          if (audioRef.current) {
                            audioRef.current.pause();
                            audioRef.current.src = '';
                          }
                          if (videoRef.current) videoRef.current.muted = isMuted;
                          showNotice(t('Original Audio Selected'));
                        }} 
                        className={`flex items-center justify-between px-4 py-1.5 hover:bg-zinc-800 transition-none text-left w-full font-normal ${selectedAudioOption === 'default' ? 'text-[#ef4444]' : 'text-zinc-200'}`}
                      >
                        <span>{t("Original Audio")}</span>
                        {selectedAudioOption === 'default' && <Check className="w-4 h-4 text-[#ef4444]" />}
                      </button>

                      {audioUrl ? (
                        <button 
                          onClick={() => {
                            setSelectedAudioOption('external');
                            toggleAudioOnly(false);
                            if (audioRef.current) {
                              const syncTime = videoRef.current ? videoRef.current.currentTime : 0;
                              const isHls = typeof audioUrl === 'string' && (audioUrl.includes('.m3u8') || audioUrl.includes('proxy-playlist') || audioUrl.includes('v-stream') || audioUrl.includes('dynamic-icons.png'));
                              
                              if (isHls) {
                                proxyAudioStartTimeRef.current = syncTime;
                                audioRef.current.src = getAudioProxyUrl(audioUrl, syncTime);
                              } else {
                                audioRef.current.src = audioUrl;
                                audioRef.current.currentTime = syncTime;
                              }
                              audioRef.current.load();
                              audioRef.current.volume = volume;
                              audioRef.current.muted = isMuted;
                              if (isPlaying) {
                                audioRef.current.play().catch(e => console.warn(e));
                              }
                            }
                            if (videoRef.current) videoRef.current.muted = true;
                            showNotice(t('External Dubbing Enabled'));
                          }} 
                          className={`flex items-center justify-between px-4 py-1.5 hover:bg-zinc-800 transition-none text-left w-full font-normal ${selectedAudioOption === 'external' ? 'text-[#ef4444]' : 'text-zinc-200'}`}
                        >
                          <span className="flex items-center gap-1.5">
                            <span>{t("Dubbing Track (External)")}</span>
                            <span className="text-[9px] bg-[#ef4444]/10 text-[#ef4444] px-1 py-0.5 rounded leading-none font-semibold">{t("Loaded")}</span>
                          </span>
                          {selectedAudioOption === 'external' && <Check className="w-4 h-4 text-[#ef4444]" />}
                        </button>
                      ) : (
                        <div className="px-4 py-1.5 text-zinc-500 text-[11px] select-none italic">
                          {t("External dubbing not uploaded.")}
                        </div>
                      )}

                      {audioTracks.length > 1 && (
                        <>
                          <div className="border-t border-white/5 my-1" />
                          <div className="px-4 py-1 text-[11px] text-zinc-500 font-semibold uppercase tracking-wider select-none">
                            {t("Playlist Audio Tracks")}
                          </div>
                          {audioTracks.map((track, idx) => (
                            <button
                              key={track.id}
                              onClick={() => {
                                setSelectedAudioOption(`track-${idx}`);
                                toggleAudioOnly(false);
                                if (hlsRef.current) {
                                  hlsRef.current.audioTrack = track.id;
                                }
                                showNotice(t("Audio Track: ") + (track.name || track.lang || `Track ${idx + 1}`));
                              }}
                              className={`flex items-center justify-between px-4 py-1.5 hover:bg-zinc-800 transition-none text-left w-full font-normal ${selectedAudioOption === `track-${idx}` ? 'text-[#ef4444]' : 'text-zinc-200'}`}
                            >
                              <span>{track.name || track.lang || `Track ${idx + 1}`}</span>
                              {selectedAudioOption === `track-${idx}` && <Check className="w-4 h-4 text-[#ef4444]" />}
                            </button>
                          ))}
                        </>
                      )}

                      <div className="border-t border-white/5 my-1" />
                      <div className="px-4 py-1 text-[11px] text-zinc-500 font-semibold uppercase tracking-wider select-none">
                        {t("Dubbing Video")}
                      </div>
                      {audioUrl ? (
                        <button 
                          onClick={() => {
                            setSelectedAudioOption('dubbing-video');
                            toggleAudioOnly(false);
                            if (audioRef.current) {
                              audioRef.current.pause();
                              audioRef.current.src = '';
                            }
                            if (videoRef.current) videoRef.current.muted = isMuted;
                            showNotice(t('Dubbing Video (External) Enabled'));
                          }} 
                          className={`flex items-center justify-between px-4 py-1.5 hover:bg-zinc-800 transition-none text-left w-full font-normal ${selectedAudioOption === 'dubbing-video' ? 'text-[#ef4444]' : 'text-zinc-200'}`}
                        >
                          <span className="flex items-center gap-1.5">
                            <span>{t("Dubbing Video (External)")}</span>
                            <span className="text-[9px] bg-[#ef4444]/10 text-[#ef4444] px-1 py-0.5 rounded leading-none font-semibold">{t("Loaded")}</span>
                          </span>
                          {selectedAudioOption === 'dubbing-video' && <Check className="w-4 h-4 text-[#ef4444]" />}
                        </button>
                      ) : (
                        <div className="px-4 py-1.5 text-zinc-500 text-[11px] select-none italic">
                          {t("External dubbing video not uploaded.")}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col px-4 py-2 gap-3">
                  <button onClick={() => setSettingView('main')} className="flex items-center gap-2 -mx-4 -mt-2 px-4 py-2 hover:bg-zinc-800 transition-none border-b border-white/10 text-zinc-300 font-normal mb-1">
                    <ChevronLeft className="w-4 h-4 -ml-1" /> {t("Back")}
                  </button>
 
                  {/* Delay */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[11px] text-zinc-300">
                      <span>{t("Delay Subtitle")}</span>
                      <span className="font-mono text-[#ef4444] font-medium">{subOffset > 0 ? `+${subOffset.toFixed(1)}s` : `${subOffset.toFixed(1)}s`}</span>
                    </div>
                    <input 
                      type="range" min="-10" max="10" step="0.1" 
                      value={subOffset} 
                      onChange={(e) => setSubOffset(parseFloat(e.target.value))}
                      className="w-full h-1 accent-[#ef4444] bg-white/20 rounded cursor-pointer appearance-none outline-none"
                    />
                  </div>
 
                  {/* Size */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[11px] text-zinc-300">
                      <span>{t("Font Size")}</span>
                      <span className="font-mono text-[#ef4444] font-medium">{subSize}px</span>
                    </div>
                    <input 
                      type="range" min="12" max="36" step="1" 
                      value={subSize} 
                      onChange={(e) => setSubSize(parseInt(e.target.value, 10))}
                      className="w-full h-1 accent-[#ef4444] bg-white/20 rounded cursor-pointer appearance-none outline-none"
                    />
                  </div>
 
                  {/* Font Family Selection */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[11px] text-zinc-300">
                      <span>{t("Font Family")}</span>
                    </div>
                    <select
                      value={subFontFamily}
                      onChange={(e) => setSubFontFamily(e.target.value)}
                      className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[11px] text-zinc-200 outline-none focus:border-[#ef4444] transition-colors font-sans"
                    >
                      <option value="ArialCustom">Arial Custom ({t("Default")})</option>
                      <option value="Arial Black">Arial Black ({t("Very Bold")})</option>
                      <option value="Trebuchet MS">Trebuchet MS ({t("Rounded Bold")})</option>
                      <option value="Impact">Impact ({t("Very Compact")})</option>
                      <option value="Boldfinger">Boldfinger (Display)</option>
                      <option value="Tommy">Tommy (Clean Bold)</option>
                      <option value="Poppins">Poppins (Google Font)</option>
                      <option value="Rubik">Rubik (Google Font Rounded)</option>
                      <option value="Montserrat">Montserrat (Google Font Bold)</option>
                      <option value="Inter">Inter (Google Font Modern)</option>
                    </select>
                  </div>
 
                  {/* Font Weight Selection */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[11px] text-zinc-300">
                      <span>{t("Font Weight")}</span>
                    </div>
                    <select
                      value={subFontWeight}
                      onChange={(e) => setSubFontWeight(e.target.value)}
                      className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[11px] text-zinc-200 outline-none focus:border-[#ef4444] transition-colors font-sans"
                    >
                      <option value="normal">{t("Normal")} (400)</option>
                      <option value="medium">{t("Medium")} (500)</option>
                      <option value="semibold">{t("Semi Bold")} (600)</option>
                      <option value="bold">{t("Bold")} (700)</option>
                      <option value="800">Extra Bold (800)</option>
                      <option value="900">Black (900 - {t("Thickest")})</option>
                    </select>
                  </div>
 
                  {/* Outline Thickness Selection */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[11px] text-zinc-300">
                      <span>{t("Outline Thickness")}</span>
                      <span className="font-mono text-[#ef4444] font-medium">{subOutline.toFixed(1)}px</span>
                    </div>
                    <input 
                      type="range" min="0" max="6" step="0.5" 
                      value={subOutline} 
                      onChange={(e) => setSubOutline(parseFloat(e.target.value))}
                      className="w-full h-1 accent-[#ef4444] bg-white/20 rounded cursor-pointer appearance-none outline-none"
                    />
                  </div>

                  {/* Default Subtitle Selection */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[11px] text-zinc-300">
                      <span>{t("Default Subtitle")}</span>
                    </div>
                    <select
                      value={defaultSubLang}
                      onChange={(e) => {
                        setDefaultSubLang(e.target.value);
                        lastLoadedVideoRef.current = null;
                      }}
                      className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[11px] text-zinc-200 outline-none focus:border-[#ef4444] transition-colors font-sans"
                    >
                      <option value="Auto">{t("Auto")} ({t("IP/Country")})</option>
                      <option value="Off">{t("Always Off")}</option>
                      <option value="Indonesian">{t("Indonesian")}</option>
                      <option value="English">{t("English")}</option>
                      <option value="Malay">{t("Malay")}</option>
                      <option value="Spanish">{t("Spanish")}</option>
                      <option value="Portuguese">{t("Portuguese")}</option>
                      <option value="French">{t("French")}</option>
                      <option value="German">{t("German")}</option>
                      <option value="Japanese">{t("Japanese")}</option>
                      <option value="Korean">{t("Korean")}</option>
                      <option value="Chinese">{t("Chinese")}</option>
                    </select>
                  </div>

                  {/* Subtitle Color Selection */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[11px] text-zinc-300">
                      <span>{t("Text Color")}</span>
                    </div>
                    <div className="flex gap-2">
                      {[
                        { name: t('White'), value: '#ffffff', bg: 'bg-white' },
                        { name: t('Yellow'), value: '#facc15', bg: 'bg-yellow-400' },
                        { name: t('Green'), value: '#4ade80', bg: 'bg-green-400' },
                        { name: t('Cyan'), value: '#22d3ee', bg: 'bg-cyan-400' },
                        { name: t('Red'), value: '#f87171', bg: 'bg-red-400' }
                      ].map((color) => (
                        <button
                          key={color.value}
                          onClick={() => setSubColor(color.value)}
                          className={`w-5 h-5 rounded-full border ${subColor === color.value ? 'border-[#ef4444] ring-2 ring-[#ef4444]/50 scale-110' : 'border-white/20 hover:scale-105'} ${color.bg} transition-all`}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Offset Horizontal */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[11px] text-zinc-300">
                      <span>{t("Horizontal Offset")}</span>
                      <span className="font-mono text-[#ef4444] font-medium">{subOffsetH > 0 ? `+${subOffsetH}px` : `${subOffsetH}px`}</span>
                    </div>
                    <input 
                      type="range" min="-150" max="150" step="1" 
                      value={subOffsetH} 
                      onChange={(e) => setSubOffsetH(parseInt(e.target.value, 10))}
                      className="w-full h-1 accent-[#ef4444] bg-white/20 rounded cursor-pointer appearance-none outline-none"
                    />
                  </div>

                  {/* Offset Vertical */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[11px] text-zinc-300">
                      <span>{t("Vertical Offset")}</span>
                      <span className="font-mono text-[#ef4444] font-medium">{subOffsetV > 0 ? `+${subOffsetV}px` : `${subOffsetV}px`}</span>
                    </div>
                    <input 
                      type="range" min="-150" max="150" step="1" 
                      value={subOffsetV} 
                      onChange={(e) => setSubOffsetV(parseInt(e.target.value, 10))}
                      className="w-full h-1 accent-[#ef4444] bg-white/20 rounded cursor-pointer appearance-none outline-none"
                    />
                  </div>

                  {/* Background Toggle */}
                  <div className="flex items-center justify-between text-[11px] text-zinc-300 mt-1 font-normal">
                     <span className="font-normal">{t("Background Subtitle")}</span>
                     <button 
                       onClick={() => setSubBg(!subBg)}
                       className={`px-2 py-1 rounded text-[10px] font-normal transition-none ${subBg ? 'bg-[#ef4444] text-white' : 'bg-white/10 text-zinc-400 hover:bg-zinc-800'}`}
                     >
                       {subBg ? t('ON') : t('OFF')}
                     </button>
                  </div>

                  {/* Reset Default */}
                  <button 
                    onClick={() => {
                      setSubOffset(0);
                      setSubSize(25);
                      setSubOffsetH(0);
                      setSubOffsetV(-30);
                      setSubBg(false);
                      setSubFontFamily('Trebuchet MS');
                      setSubFontWeight('bold');
                      setSubOutline(2.5);
                      setSubColor('#ffffff');
                      setDefaultSubLang('Auto');
                      lastLoadedVideoRef.current = null;
                    }}
                    className="-mx-4 -mb-2 mt-2 py-2 border-t border-white/10 hover:bg-zinc-800 text-zinc-200 text-[13px] font-normal transition-none text-center rounded-b-sm"
                  >
                    {t("Reset to Default")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Video Information Overlay Panel */}
      {showVideoInfo && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute top-4 left-4 z-[9999] w-[260px] bg-[#030303]/80 backdrop-blur-md border border-white/10 rounded-sm shadow-2xl p-3 font-mono text-[11px] text-zinc-300 flex flex-col gap-2 select-text scale-110 origin-top-left transition-all duration-200"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-1">
            <span className="font-medium text-white uppercase tracking-wider text-[10px]">{t("Video Information")}</span>
            <button 
              onClick={() => setShowVideoInfo(false)} 
              className="text-zinc-400 hover:text-red-500 transition-colors p-0.5"
            >
              <X size={14} />
            </button>
          </div>
          
          <div className="flex flex-col gap-1 text-[11px] leading-relaxed">
            <div className="flex justify-between">
              <span className="text-zinc-500">{t("Player")}</span>
              <span className="text-zinc-200">ViyiePlayer</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t("Player Version")}</span>
              <span className="text-zinc-200">2.5.1</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t("Total Duration")}</span>
              <span className="text-zinc-200">{formatTotalMinutes(duration)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t("Current Time")}</span>
              <span className="text-zinc-200 font-medium">{formatTime(currentTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t("Volume")}</span>
              <span className="text-zinc-200">{isMuted ? t('Muted') : `${Math.round(volume * 100)}%`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t("Playback Speed")}</span>
              <span className="text-zinc-200">{playbackRate}x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t("Aspect Ratio")}</span>
              <span className="text-zinc-200 capitalize">{aspectRatio === 'default' ? t('Normal') : aspectRatio}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t("Resolution")}</span>
              <span className="text-zinc-200 font-medium font-mono">
                {videoRef.current?.videoWidth 
                  ? `${videoRef.current.videoWidth}x${videoRef.current.videoHeight} (${getResolutionBadge(videoRef.current.videoHeight, videoRef.current.videoWidth)})` 
                  : (videoDims.width ? `${videoDims.width}x${videoDims.height}` : 'Unknown')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t("Frame Rate")}</span>
              <span className="text-zinc-200 font-medium font-mono">
                {measuredFps} fps
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t("Connection Speed")}</span>
              <span className="text-zinc-200 font-medium font-mono">
                {getMbps()}
              </span>
            </div>
          </div>
           {/* Mobile Draggable "More Options" Panel - Removed */}      </div>
      )}

      {/* Touch Shortcuts Overlay Panel */}
      {showTouchShortcutsPanel && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] w-[280px] bg-[#0c0c0c]/90 backdrop-blur-md border border-white/10 rounded-sm shadow-2xl p-4 font-sans text-xs text-zinc-300 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="font-semibold text-white tracking-wide text-xs uppercase">{t("Touch Shortcuts Guide")}</span>
            <button 
              onClick={() => setShowTouchShortcutsPanel(false)} 
              className="text-zinc-400 hover:text-[#ef4444] transition-colors p-0.5"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto pr-1">
            <div className="flex flex-col gap-0.5 leading-relaxed">
              <span className="text-[#ef4444] font-medium text-[11px]">{t("1 Click / Tap")}</span>
              <span className="text-zinc-300 text-[11px]">{t("Show play/pause icon, overlay controls, and seeker.")}</span>
            </div>
            <div className="flex flex-col gap-0.5 leading-relaxed">
              <span className="text-[#ef4444] font-medium text-[11px]">{t("2x Click Right Screen")}</span>
              <span className="text-zinc-300 text-[11px]">{t("Skip forward by 5 seconds.")}</span>
            </div>
            <div className="flex flex-col gap-0.5 leading-relaxed">
              <span className="text-[#ef4444] font-medium text-[11px]">{t("2x Click Left Screen")}</span>
              <span className="text-zinc-300 text-[11px]">{t("Undo/rewind backward by 5 seconds.")}</span>
            </div>
            <div className="flex flex-col gap-0.5 leading-relaxed">
              <span className="text-[#ef4444] font-medium text-[11px]">{t("Horizontal Hold & Swipe (Swap)")}</span>
              <span className="text-zinc-300 text-[11px]">{t("Hold then swipe left/right to scrub and select exact duration.")}</span>
            </div>
            <div className="flex flex-col gap-0.5 leading-relaxed">
              <span className="text-[#ef4444] font-medium text-[11px]">{t("Left Screen Vertical Hold & Swipe")}</span>
              <span className="text-zinc-300 text-[11px]">{t("Hold and swipe up/down on left side to adjust volume.")}</span>
            </div>
            <div className="flex flex-col gap-0.5 leading-relaxed">
              <span className="text-[#ef4444] font-medium text-[11px]">{t("Right Screen Vertical Hold & Swipe")}</span>
              <span className="text-zinc-300 text-[11px]">{t("Hold and swipe up/down on right side to adjust screen brightness.")}</span>
            </div>
          </div>
        </div>
      )}

      {/* Custom Right-Click Context Menu */}
      {contextMenu && (
        <div 
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute z-[99999] w-[220px] bg-[#0c0c0c]/90 backdrop-blur-md border border-white/10 rounded-sm shadow-2xl flex flex-col py-0.5 text-[11px] font-sans text-white custom-context-menu"
          style={{
            left: (() => {
              const menuWidth = 220;
              if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                return contextMenu.x + menuWidth > rect.width 
                  ? Math.max(10, rect.width - menuWidth - 10) 
                  : contextMenu.x;
              }
              return contextMenu.x;
            })(),
            top: (() => {
              const menuHeight = 350; 
              if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                return contextMenu.y + menuHeight > rect.height 
                  ? Math.max(10, rect.height - menuHeight - 15) 
                  : Math.max(10, contextMenu.y);
              }
              return contextMenu.y;
            })(),
            maxHeight: 'calc(100% - 20px)',
            overflowY: 'auto'
          }}
        >
          {contextMenuView === 'main' ? (
            <div className="flex flex-col">
              {/* Display Rotate at the top */}
              <button
                onClick={() => {
                  const nextRot = (rotation + 90) % 360;
                  setRotation(nextRot);
                  showNotice(t("Rotate Display") + `: ${nextRot === 0 ? t('Normal') : `${nextRot}°`}`);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-white/5 hover:text-white transition-colors border-b border-white/10 text-white text-[11px] font-sans flex items-center justify-between"
              >
                <span className="font-semibold text-white">{t("Display Rotate")}</span>
                <span className="text-[#ef4444] font-medium font-sans">
                  {rotation === 0 ? t('Normal') : `${rotation}°`}
                </span>
              </button>

              {/* Play Speed direct cycle */}
              <button
                onClick={() => {
                  const speeds = [0.5, 0.8, 1.0, 1.3, 1.5, 2.0];
                  const currentIdx = speeds.indexOf(playbackRate);
                  const nextIdx = (currentIdx + 1) % speeds.length;
                  const nextVal = speeds[nextIdx];
                  applySpeed(nextVal);
                  showNotice(t("Play Speed") + `: ${nextVal === 1.0 ? t('Normal') : `${nextVal}x`}`);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-white/5 hover:text-white transition-colors border-b border-white/10 text-white text-[11px] font-sans flex items-center justify-between"
              >
                <span className="font-semibold text-white">{t("Play Speed")}</span>
                <span className="text-[#ef4444] font-medium font-sans">
                  {playbackRate === 1.0 ? t('Normal') : `${playbackRate}x`}
                </span>
              </button>

              {/* Aspect Ratio direct cycle */}
              <button
                onClick={() => {
                  const aspects = ['default', '4:3', '16:9'];
                  const currentIdx = aspects.indexOf(aspectRatio);
                  const nextIdx = (currentIdx + 1) % aspects.length;
                  const nextVal = aspects[nextIdx];
                  applyAspect(nextVal);
                  showNotice(t("Aspect Ratio") + `: ${nextVal === 'default' ? t('Normal') : nextVal}`);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-white/5 hover:text-white transition-colors border-b border-white/10 text-white text-[11px] font-sans flex items-center justify-between"
              >
                <span className="font-semibold text-white">{t("Aspect Ratio")}</span>
                <span className="text-[#ef4444] font-medium font-sans capitalize">
                  {aspectRatio === 'default' ? t('Normal') : aspectRatio}
                </span>
              </button>

              {/* Video Flip direct cycle */}
              <button
                onClick={() => {
                  const flips = ['normal', 'horizontal', 'vertical'];
                  const currentIdx = flips.indexOf(flip);
                  const nextIdx = (currentIdx + 1) % flips.length;
                  const nextVal = flips[nextIdx];
                  applyFlip(nextVal);
                  showNotice(t("Video Flip") + `: ${nextVal === 'normal' ? t('Normal') : nextVal === 'horizontal' ? t('Horizontal') : t('Vertical')}`);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-white/5 hover:text-white transition-colors border-b border-white/10 text-white text-[11px] font-sans flex items-center justify-between"
              >
                <span className="font-semibold text-white">{t("Video Flip")}</span>
                <span className="text-[#ef4444] font-medium font-sans capitalize">
                  {flip === 'normal' ? t('Normal') : flip === 'horizontal' ? t('Horizontal') : t('Vertical')}
                </span>
              </button>

              {/* Replay Video direct cycle */}
              <button
                onClick={() => {
                  const nextVal = !isLoop;
                  setIsLoop(nextVal);
                  showNotice(t("Replay Video") + `: ${nextVal ? t('Enable') : t('Disable')}`);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-white/5 hover:text-white transition-colors border-b border-white/10 text-white text-[11px] font-sans flex items-center justify-between"
              >
                <span className="font-semibold text-white">{t("Replay Video")}</span>
                <span className="text-[#ef4444] font-medium font-sans">
                  {isLoop ? t('Enable') : t('Disable')}
                </span>
              </button>

              <button
                onClick={() => {
                  setShowVideoInfo(!showVideoInfo);
                  setContextMenu(null);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-white/5 hover:text-white transition-colors border-b border-white/10 text-white text-[11px] font-sans"
              >
                {t("Video Info")}
              </button>

              <button
                onClick={() => {
                  setContextMenuView('quick-access');
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-white/5 hover:text-white transition-colors border-b border-white/10 text-white text-[11px] font-sans flex items-center justify-between"
              >
                <span className="text-white">{t("Keyboard Shortcuts")}</span>
                <svg className="w-3.5 h-3.5 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
                  <line x1="6" y1="8" x2="6.01" y2="8" />
                  <line x1="10" y1="8" x2="10.01" y2="8" />
                  <line x1="14" y1="8" x2="14.01" y2="8" />
                  <line x1="18" y1="8" x2="18.01" y2="8" />
                  <line x1="6" y1="12" x2="6.01" y2="12" />
                  <line x1="10" y1="12" x2="10.01" y2="12" />
                  <line x1="14" y1="12" x2="14.01" y2="12" />
                  <line x1="18" y1="12" x2="18.01" y2="12" />
                  <line x1="7" y1="16" x2="17" y2="16" />
                </svg>
              </button>

              <div className="w-full text-left px-4 py-2 text-[10px] font-sans text-white border-b border-white/10 select-none">
                ViyiePlayer 2.8.1
              </div>

              <button
                onClick={() => {
                  setContextMenu(null);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-white/5 hover:text-white transition-colors text-white text-[11px] font-sans"
              >
                {t("Close")}
              </button>
            </div>
          ) : (
            <div className="flex flex-col">
              <button 
                onClick={() => setContextMenuView('main')} 
                className="flex items-center gap-1.5 px-4 py-2.5 hover:bg-white/5 hover:text-white transition-colors border-b border-white/10 text-white font-sans"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> {t("Back")}
              </button>

              <div className="flex flex-col gap-1 px-4 py-2.5 text-[11px] text-zinc-400 select-none">
                <div className="text-[9px] uppercase tracking-wider text-[#ef4444] font-medium mb-1.5 flex items-center justify-between">
                  <span>{isMobile ? t('Touch Shortcuts Guide') : t('Keyboard Shortcuts')}</span>
                  <svg className="w-3.5 h-3.5 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
                    <line x1="6" y1="8" x2="6.01" y2="8" />
                    <line x1="10" y1="8" x2="10.01" y2="8" />
                    <line x1="14" y1="8" x2="14.01" y2="8" />
                    <line x1="18" y1="8" x2="18.01" y2="8" />
                    <line x1="6" y1="12" x2="6.01" y2="12" />
                    <line x1="10" y1="12" x2="10.01" y2="12" />
                    <line x1="14" y1="12" x2="14.01" y2="12" />
                    <line x1="18" y1="12" x2="18.01" y2="12" />
                    <line x1="7" y1="16" x2="17" y2="16" />
                  </svg>
                </div>

                <ShortcutsInfo isMobile={isMobile} t={t} />
              </div>
            </div>
          )}
        </div>
      )}
        </>
      )}

      {/* Right Side Panel for Subtitles or Quality */}
      <AnimatePresence>
        {isMobile && (showSubtitleMenu || showQualityMenu) && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-y-0 right-0 z-[101] w-[260px] md:w-[300px] bg-[#030303]/95 backdrop-blur-md border-l border-white/10 flex flex-col p-5 shadow-2xl pointer-events-auto"
          >
            {showSubtitleMenu && (
              <>
                <div className="flex items-center justify-between pb-3.5 border-b border-white/10 mb-4">
                  <span className="text-[14px] font-semibold uppercase tracking-wider text-white flex items-center gap-2">
                    <Subtitles size={16} className="text-[#ef4444]" /> {t("Subtitle")}
                  </span>
                  <button onClick={() => setShowSubtitleMenu(false)} className="text-zinc-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10">
                    <X size={16} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1 pr-1.5 viyie-menu-scroll">
                  <button 
                    onClick={() => { applySubtitle('Off'); setShowSubtitleMenu(false); }} 
                    className={`flex items-center justify-between w-full px-3.5 py-3 rounded text-left hover:bg-white/5 transition-colors text-[13px] font-medium ${activeSubtitle === 'Off' ? 'bg-[#ef4444]/10 text-[#ef4444]' : 'text-zinc-300 hover:text-white'}`}
                  >
                    <span>{t("Off")}</span>
                    {activeSubtitle === 'Off' && <Check className="w-4 h-4 text-[#ef4444]" />}
                  </button>

                  <button 
                    onClick={(e) => { 
                      e.stopPropagation();
                      localSubInputRef.current?.click();
                    }} 
                    className="flex items-center gap-1.5 w-full px-3.5 py-3 rounded text-left hover:bg-white/5 transition-colors text-[13px] font-medium text-zinc-300 hover:text-white border-b border-white/10 mb-1.5 pb-3"
                  >
                    <svg className="w-4 h-4 text-[#ef4444] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>{t("Lokal Subtitle")}</span>
                  </button>

                  {localSubtitles.map((sub, idx) => (
                    <button 
                      key={`local-${sub.lang}-${idx}`} 
                      onClick={() => { applySubtitle(sub.lang); setShowSubtitleMenu(false); }} 
                      className={`flex items-center justify-between w-full px-3.5 py-3 rounded text-left hover:bg-white/5 transition-colors text-[13px] font-medium ${activeSubtitle === sub.lang ? 'bg-[#ef4444]/10 text-[#ef4444]' : 'text-zinc-300 hover:text-white'}`}
                    >
                      <span className="truncate max-w-[150px]">{sub.lang}</span>
                      {activeSubtitle === sub.lang && <Check className="w-4 h-4 text-[#ef4444] shrink-0" />}
                    </button>
                  ))}

                  {allSubtitles.map((sub, idx) => (
                    <button 
                      key={`online-${sub.lang}-${idx}`} 
                      onClick={() => { applySubtitle(sub.lang); setShowSubtitleMenu(false); }} 
                      className={`flex items-center justify-between w-full px-3.5 py-3 rounded text-left hover:bg-white/5 transition-colors text-[13px] font-medium ${activeSubtitle === sub.lang ? 'bg-[#ef4444]/10 text-[#ef4444]' : 'text-zinc-300 hover:text-white'}`}
                    >
                      <span className="truncate max-w-[150px]">{sub.lang}</span>
                      {activeSubtitle === sub.lang && <Check className="w-4 h-4 text-[#ef4444] shrink-0" />}
                    </button>
                  ))}
                </div>
              </>
            )}
            {showQualityMenu && (
              <>
                <div className="flex items-center justify-between pb-3.5 border-b border-white/10 mb-4">
                  <span className="text-[14px] font-semibold uppercase tracking-wider text-white flex items-center gap-2">
                    <Settings size={16} className="text-[#ef4444]" /> {t("Quality")}
                  </span>
                  <button onClick={() => setShowQualityMenu(false)} className="text-zinc-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10">
                    <X size={16} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1 pr-1.5 viyie-menu-scroll">
                  <button 
                    onClick={() => { applyQuality(-1); setShowQualityMenu(false); }} 
                    className={`flex items-center justify-between w-full px-3.5 py-3 rounded text-left hover:bg-white/5 transition-colors text-[13px] font-medium ${currentLevel === -1 ? 'bg-[#ef4444]/10 text-[#ef4444]' : 'text-zinc-300 hover:text-white'}`}
                  >
                    <span>{t("Auto")}</span>
                    {currentLevel === -1 && <Check className="w-4 h-4 text-[#ef4444]" />}
                  </button>
                  {hlsLevels.map((level) => {
                    const badge = getResolutionBadge(level.height, level.width);
                    const isCurrent = currentLevel === level.index;
                    const isActiveInAuto = currentLevel === -1 && activeLevelIndex === level.index;
                    const isEcoDisabled = ecoMode && level.height > 720;
                    const resText = getResolutionBadge(level.height, level.width) || level.name;
                    return (
                      <button 
                        key={level.index} 
                        disabled={isEcoDisabled}
                        onClick={() => { applyQuality(level.index); setShowQualityMenu(false); }} 
                        className={`flex items-center justify-between w-full px-3.5 py-3 rounded text-left transition-colors text-[13px] font-medium ${
                          isEcoDisabled 
                            ? 'text-zinc-500 cursor-not-allowed opacity-55 hover:bg-transparent' 
                            : (isCurrent ? 'bg-[#ef4444]/10 text-[#ef4444]' : 'text-zinc-300 hover:text-white hover:bg-white/5')
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          <span>{resText}</span>
                          {resText.includes('1080p') && (
                            <span className="text-[8px] font-extrabold text-white bg-red-600 px-1 py-0.5 rounded-[2px] leading-none select-none tracking-wide">
                              HD
                            </span>
                          )}
                        </span>
                        {isCurrent && <Check className="w-4 h-4 text-[#ef4444]" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ShortcutsInfo({ isMobile, t }: { isMobile: boolean; t: (key: string) => string }) {
  return (
    <>
      {isMobile ? (
        <>
          <div className="flex items-center justify-between py-1 border-b border-white/5">
            <span className="text-zinc-300 font-sans">{t("1 Click / Tap")}</span>
            <span className="text-zinc-400 font-sans text-right max-w-[130px]">{t("Show play/pause icon, overlay controls, and seeker.")}</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-white/5">
            <span className="text-zinc-300 font-sans">{t("2x Click Right Screen")}</span>
            <span className="text-zinc-400 font-sans text-right">{t("Skip forward by 5 seconds.")}</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-white/5">
            <span className="text-zinc-300 font-sans">{t("2x Click Left Screen")}</span>
            <span className="text-zinc-400 font-sans text-right">{t("Undo/rewind backward by 5 seconds.")}</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-white/5">
            <span className="text-zinc-300 font-sans">{t("Horizontal Hold & Swipe (Swap)")}</span>
            <span className="text-zinc-400 font-sans text-right">{t("Choose Duration")}</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-white/5">
            <span className="text-zinc-300 font-sans">{t("Left Screen Vertical Hold & Swipe")}</span>
            <span className="text-zinc-400 font-sans text-right">{t("Adjust Volume")}</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
            <span className="text-zinc-300 font-sans">{t("Right Screen Vertical Hold & Swipe")}</span>
            <span className="text-zinc-400 font-sans text-right">{t("Adjust Brightness")}</span>
          </div>
        </>
      ) : (
        <>
          {/* Play / Pause */}
          <div className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
            <span className="text-zinc-300 font-sans">{t("Play / Pause")}</span>
            <div className="flex items-center gap-1.5">
              <kbd className="font-mono text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded-sm border border-white/10 text-[9px] shadow-[0_1.5px_0_rgba(255,255,255,0.1)]">Space</kbd>
            </div>
          </div>
          {/* Skip Frame */}
          <div className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
            <span className="text-zinc-300 font-sans">{t("Skip Frame")}</span>
            <div className="flex items-center gap-1">
              <kbd className="font-mono text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded-sm border border-white/10 text-[9px] shadow-[0_1.5px_0_rgba(255,255,255,0.1)]">&lt;</kbd>
              <kbd className="font-mono text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded-sm border border-white/10 text-[9px] shadow-[0_1.5px_0_rgba(255,255,255,0.1)]">&gt;</kbd>
            </div>
          </div>
          {/* Seek 5s */}
          <div className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
            <span className="text-zinc-300 font-sans">{t("Seek 5s")}</span>
            <div className="flex items-center gap-1">
              <kbd className="font-mono text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded-sm border border-white/10 text-[9px] shadow-[0_1.5px_0_rgba(255,255,255,0.1)]">◀</kbd>
              <kbd className="font-mono text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded-sm border border-white/10 text-[9px] shadow-[0_1.5px_0_rgba(255,255,255,0.1)]">▶</kbd>
            </div>
          </div>
          {/* Volume */}
          <div className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
            <span className="text-zinc-300 font-sans">{t("Volume")}</span>
            <div className="flex items-center gap-1">
              <kbd className="font-mono text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded-sm border border-white/10 text-[9px] shadow-[0_1.5px_0_rgba(255,255,255,0.1)]">▲</kbd>
              <kbd className="font-mono text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded-sm border border-white/10 text-[9px] shadow-[0_1.5px_0_rgba(255,255,255,0.1)]">▼</kbd>
            </div>
          </div>
          {/* Fullscreen */}
          <div className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
            <span className="text-zinc-300 font-sans">{t("Fullscreen")}</span>
            <div className="flex items-center gap-1.5">
              <kbd className="font-mono text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded-sm border border-white/10 text-[9px] shadow-[0_1.5px_0_rgba(255,255,255,0.1)]">F</kbd>
            </div>
          </div>
          {/* Web Fullscreen */}
          <div className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
            <span className="text-zinc-300 font-sans">{t("Web Fullscreen")}</span>
            <div className="flex items-center gap-1.5">
              <kbd className="font-mono text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded-sm border border-white/10 text-[9px] shadow-[0_1.5px_0_rgba(255,255,255,0.1)]">W</kbd>
            </div>
          </div>
          {/* Reload Video */}
          <div className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
            <span className="text-zinc-300 font-sans">{t("Reload Video")}</span>
            <div className="flex items-center gap-1.5">
              <kbd className="font-mono text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded-sm border border-white/10 text-[9px] shadow-[0_1.5px_0_rgba(255,255,255,0.1)]">R</kbd>
            </div>
          </div>
          {/* Mute/Unmute */}
          <div className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
            <span className="text-zinc-300 font-sans">{t("Mute/Unmute")}</span>
            <div className="flex items-center gap-1.5">
              <kbd className="font-mono text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded-sm border border-white/10 text-[9px] shadow-[0_1.5px_0_rgba(255,255,255,0.1)]">M</kbd>
            </div>
          </div>
          {/* Screenshot */}
          <div className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
            <span className="text-zinc-300 font-sans">{t("Screenshot")}</span>
            <div className="flex items-center gap-1.5">
              <kbd className="font-mono text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded-sm border border-white/10 text-[9px] shadow-[0_1.5px_0_rgba(255,255,255,0.1)]">S</kbd>
            </div>
          </div>
          {/* Hold Z (2x speed) */}
          <div className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
            <span className="text-zinc-300 font-sans">{t("2x Speed (Hold)")}</span>
            <div className="flex items-center gap-1.5">
              <kbd className="font-mono text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded-sm border border-white/10 text-[9px] shadow-[0_1.5px_0_rgba(255,255,255,0.1)]">Z</kbd>
            </div>
          </div>
          {/* Hold Shift (0.5x speed) */}
          <div className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
            <span className="text-zinc-300 font-sans">{t("0.5x Speed (Hold)")}</span>
            <div className="flex items-center gap-1.5">
              <kbd className="font-mono text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded-sm border border-white/10 text-[9px] shadow-[0_1.5px_0_rgba(255,255,255,0.1)]">Shift</kbd>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export function ViyiePlayerUI({ video }: { video: any }) {
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    const resolveVideo = async () => {
      if (!video || !video.videoUrl) {
        setResolvedVideoUrl('');
        return;
      }
      
      const videoData = { ...video };
      if (videoData.videoUrl && videoData.videoUrl.includes('d.tube')) {
        try {
          const res = await fetch(`/api/dtube-parse?url=${encodeURIComponent(videoData.videoUrl)}`);
          if (res.ok) {
            const parsed = await res.json();
            if (parsed.master) {
              videoData.videoUrl = parsed.master;
            }
          }
        } catch(e) {
          console.warn('Failed to parse dtube url:', e);
        }
      }

      // Proxy absolute HLS (.m3u8), DASH (.mpd), and JSON configs to spoof referrers & bypass CORS perfectly.
      if (videoData.videoUrl && (
        videoData.videoUrl.toLowerCase().includes('.m3u8') || 
        videoData.videoUrl.toLowerCase().includes('.mpd') || 
        videoData.videoUrl.toLowerCase().includes('.json')
      )) {
        if (videoData.videoUrl.startsWith('http') && 
            !videoData.videoUrl.includes('/api/proxy-playlist') && 
            !videoData.videoUrl.includes('/api/v-stream') &&
            !videoData.videoUrl.includes('/api/v-dash') &&
            !videoData.videoUrl.includes('/assets/images/dynamic-icons.png') &&
            !videoData.videoUrl.includes('/assets/js/vendors/vendor-polyfills.js')
        ) {
          const lowerUrl = videoData.videoUrl.toLowerCase();
          let ext = '';
          if (lowerUrl.includes('.mpd')) {
            ext = '&ext=.mpd';
          }
          
          // Exclude certain domains that use Cloudflare or other anti-bot/IP detection systems that block cloud servers
          // but have CORS enabled (Access-Control-Allow-Origin: *) so they can be loaded directly in the client.
          const isBlockedCloudIpDomain = lowerUrl.includes('ironwallnet') || 
                                        lowerUrl.includes('hydrax') || 
                                        lowerUrl.includes('turbovip') || 
                                        lowerUrl.includes('dailymotion') ||
                                        lowerUrl.includes('.site/') ||
                                        lowerUrl.includes('.online/');
          
          if (!isBlockedCloudIpDomain) {
            videoData.videoUrl = `/assets/images/dynamic-icons.png?s=${obfuscateUrl(videoData.videoUrl)}${ext}`;
          }
        }
      }

      if (active) {
        setResolvedVideoUrl(videoData.videoUrl);
      }
    };
    resolveVideo();
    return () => {
      active = false;
    };
  }, [video]);

  const subtitles = video?.subtitles || (video?.subtitleUrl ? [{ lang: 'Default', url: video.subtitleUrl }] : []);

  return (
    <ViyiePlayer 
       videoUrl={resolvedVideoUrl}
       audioUrl={video?.audioUrl}
       audioOffset={(video as any)?.audioOffset}
       poster={video?.posterUrl}
       title={video?.title}
       subtitles={subtitles}
       videoId={video?.id}
    />
  );
}

