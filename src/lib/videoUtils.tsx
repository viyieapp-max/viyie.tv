import React from 'react';

export const formatTime = (seconds: number) => {
  if (isNaN(seconds)) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
};

export const getResolutionBadge = (height: number, width: number) => {
  if (!width && !height) return '';

  // Jika depan (width) cocok dengan resolusi standar, terjemahkan secara akurat
  if (width === 1920) return '1080p';
  if (width === 1280) return '720p';
  if (width === 854) return '480p';
  if (width === 640) return '360p';

  // Periksa juga jika parameter terbalik (height berisi width standar)
  if (height === 1920) return '1080p';
  if (height === 1280) return '720p';
  if (height === 854) return '480p';
  if (height === 640) return '360p';

  if (height >= 2160) return '4K';
  if (height >= 1440) return '1440p';

  // Jika depan tidak sesuai dengan standar di atas, gunakan resolusi dinamis
  // Contoh: 1080x524 -> 524p
  if (height) return `${height}p`;
  if (width) return `${width}p`;
  return '';
};

export const estimateHeightFromIndex = (idx: number, total: number) => {
  if (total <= 1) return 1080;
  if (total === 2) {
    return idx === 1 ? 720 : 360;
  }
  if (total === 3) {
    if (idx === 2) return 1080;
    if (idx === 1) return 720;
    return 360;
  }
  if (total === 4) {
    if (idx === 3) return 1080;
    if (idx === 2) return 720;
    if (idx === 1) return 480;
    return 360;
  }
  const ratios = [240, 360, 480, 720, 1080, 1440, 2160];
  const targetIdx = Math.min(idx, ratios.length - 1);
  return ratios[targetIdx] || 720;
};

export interface Cue {
  start: number;
  end: number;
  text: string;
  isKaraoke?: boolean;
  karaokeSegments?: { time: number; text: string }[];
  isTypingAnimation?: boolean;
  typingSpeed?: number;
  alignment?: 'bottom' | 'top';
}

export function isPromotionalLine(line: string): boolean {
  const lower = line.toLowerCase().trim();
  if (!lower) return false;

  // 1. Detect any URLs or domains
  const urlPattern = /https?:\/\/\S+|www\.\S+|[a-zA-Z0-9-]+\.(com|net|org|co|info|biz|cc|xyz|tv|id|me|link|club|site|online|top|ws|vip|fit|app|dev)\b/gi;
  if (urlPattern.test(lower)) {
    return true;
  }

  // 2. Detect typical promotional words/phrases
  if (lower.includes("subtitle by") || lower.includes("subtitled by") || lower.includes("subtitles by")) {
    return true;
  }
  if (lower.includes("created by") || lower.includes("create by") || lower.includes("created:") || lower.includes("create:")) {
    return true;
  }
  if (lower.includes("translated by") || lower.includes("translation by") || lower.includes("edited by") || lower.includes("edit by")) {
    return true;
  }
  if (lower.includes("downloaded from") || lower.includes("download from") || lower.includes("support us") || lower.includes("join us")) {
    return true;
  }
  if (lower.includes("synchronized by") || lower.includes("sync by") || lower.includes("synced by")) {
    return true;
  }

  // 3. Handle explicit request for "create" word in promotional contexts
  if (lower.includes("create")) {
    const isNormalSentence = /\b(we|i|you|they|to|can|will|should|let|let's|how|make|making|something|some|new|a)\b/i.test(lower);
    if (!isNormalSentence || lower.startsWith("create:") || lower.includes("create :") || lower.includes("@") || lower.includes("create by")) {
      return true;
    }
  }

  return false;
}

export function parseVttOrSrt(text: string): Cue[] {
  const cues: Cue[] = [];
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = cleanText.split(/\n\n+/);
  
  const parseTimestamp = (str: string): number => {
    const parts = str.trim().replace(',', '.').split(':');
    let h = 0, m = 0, s = 0;
    if (parts.length === 3) {
      h = parseFloat(parts[0]);
      m = parseFloat(parts[1]);
      s = parseFloat(parts[2]);
    } else if (parts.length === 2) {
      m = parseFloat(parts[0]);
      s = parseFloat(parts[1]);
    } else if (parts.length === 1) {
      s = parseFloat(parts[0]);
    }
    return h * 3600 + m * 60 + s;
  };

  const timestampRegex = /(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}|\d{2}:\d{2}[.,]\d{1,3}|\d{1,2}:\d{2}:\d{2}|\d{2}:\d{2})\s*(?:-->|to|-)\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}|\d{2}:\d{2}[.,]\d{1,3}|\d{1,2}:\d{2}:\d{2}|\d{2}:\d{2})/;
  
  for (const block of blocks) {
    const lines = block.split('\n');
    let timeLineIdx = -1;
    let match: RegExpMatchArray | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(timestampRegex);
      if (m) {
        timeLineIdx = i;
        match = m;
        break;
      }
    }
    
    if (timeLineIdx !== -1 && match) {
      const start = parseTimestamp(match[1]);
      const end = parseTimestamp(match[2]);
      const cueLines = lines.slice(timeLineIdx + 1).filter(l => l.trim() !== '');
      if (cueLines.length > 0) {
        let originalText = cueLines.join('\n');
        
        let alignment: 'bottom' | 'top' = 'bottom';
        const alignMatch = originalText.match(/\{[\\\/]?an([1-9])\}/i);
        if (alignMatch) {
          const val = parseInt(alignMatch[1], 10);
          if (val === 7 || val === 8 || val === 9) {
            alignment = 'top';
          }
        }
        
        let isTypingAnimation = false;
        let typingSpeed = 80;
        const typingMatch = originalText.match(/\{[\\\/]?[nN](\d*)\}/);
        if (typingMatch) {
          isTypingAnimation = true;
          if (typingMatch[1]) {
            const speedDigit = parseInt(typingMatch[1], 10);
            typingSpeed = speedDigit < 10 ? speedDigit * 10 : speedDigit;
          } else {
            typingSpeed = 80; 
          }
          originalText = originalText.replace(/\{[\\\/]?[nN]\d*\}/gi, '');
        }
        
        const karaokeSegments: { time: number; text: string }[] = [];
        let isKaraoke = false;
        
        const webvttKaraokeRegex = /<\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}|\d{2}:\d{2}[.,]\d{1,3}|\d{1,2}:\d{2}:\d{2}|\d{2}:\d{2})\s*>/g;
        const assKaraokeRegex = /\{[\\\/]?[kK][fFoO]?(\d+)\}/g;
        
        if (originalText.match(webvttKaraokeRegex)) {
          isKaraoke = true;
          webvttKaraokeRegex.lastIndex = 0;
          let lastIdx = 0;
          let currentSegmentTime = start;
          let m: RegExpExecArray | null;
          
          while ((m = webvttKaraokeRegex.exec(originalText)) !== null) {
            const tagStart = m.index;
            const tagEnd = webvttKaraokeRegex.lastIndex;
            const segmentText = originalText.substring(lastIdx, tagStart);
            
            const cleanSegText = segmentText.replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '');
            karaokeSegments.push({
              time: currentSegmentTime,
              text: cleanSegText
            });
            
            currentSegmentTime = parseTimestamp(m[1]);
            lastIdx = tagEnd;
          }
          const remainingText = originalText.substring(lastIdx);
          const cleanRemainingText = remainingText.replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '');
          karaokeSegments.push({
            time: currentSegmentTime,
            text: cleanRemainingText
          });
        } else if (originalText.match(assKaraokeRegex)) {
          isKaraoke = true;
          assKaraokeRegex.lastIndex = 0;
          let lastIdx = 0;
          let lastTime = start;
          let m: RegExpExecArray | null;
          
          while ((m = assKaraokeRegex.exec(originalText)) !== null) {
            const tagStart = m.index;
            const tagEnd = assKaraokeRegex.lastIndex;
            const segmentText = originalText.substring(lastIdx, tagStart);
            
            const cleanSegText = segmentText.replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '');
            if (cleanSegText) {
              karaokeSegments.push({
                time: lastTime,
                text: cleanSegText
              });
            }
            
            const durationCentiseconds = parseInt(m[1], 10);
            const durationSeconds = durationCentiseconds / 100;
            lastTime += durationSeconds;
            lastIdx = tagEnd;
          }
          const remainingText = originalText.substring(lastIdx);
          const cleanRemainingText = remainingText.replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '');
          if (cleanRemainingText) {
            karaokeSegments.push({
              time: lastTime,
              text: cleanRemainingText
            });
          }
        }
        
        const textContent = originalText
          .replace(/<[^>]+>/g, '')
          .replace(/\{[^}]+\}/g, '');
        
        const linesOfText = textContent.split('\n');
        const cleanLines = linesOfText.filter(line => !isPromotionalLine(line));
        
        if (cleanLines.length > 0) {
          const cleanTextContent = cleanLines.join('\n');
          
          cues.push({ 
            start, 
            end, 
            text: cleanTextContent,
            isTypingAnimation,
            typingSpeed,
            isKaraoke,
            karaokeSegments: isKaraoke ? karaokeSegments.filter(seg => !isPromotionalLine(seg.text)) : karaokeSegments,
            alignment
          });
        }
      }
    }
  }
  
  return cues.sort((a, b) => a.start - b.start);
}

export const TooltipButton = ({ 
  title, onClick, children, className = '', active = false 
}: { 
  title: string, onClick: (e: React.MouseEvent<HTMLButtonElement>) => void, children: React.ReactNode, className?: string, active?: boolean 
}) => {
  const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  return (
    <div className="relative group/btn flex items-center justify-center">
      <button 
        onClick={onClick} 
        className={`opacity-80 hover:opacity-100 transition-opacity ${isTouch ? 'p-2' : ''} ${active ? 'opacity-100 text-[#ef4444]' : 'text-white'} ${className}`}
      >
        {children}
      </button>
      {!isTouch && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/90 text-white text-[11px] rounded opacity-0 group-hover/btn:opacity-100 pointer-events-none whitespace-nowrap transition-opacity shadow border border-white/10 z-50">
          {title}
        </div>
      )}
    </div>
  );
};

export const formatTotalMinutes = (sec: number) => {
  if (isNaN(sec) || sec <= 0) return '0 Min';
  const mins = Math.floor(sec / 60);
  return `${mins} Min`;
};
