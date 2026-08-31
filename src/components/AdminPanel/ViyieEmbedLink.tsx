import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  PlayCircle,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Sparkles,
} from "lucide-react";

interface ViyieEmbedLinkProps {
  contentId?: string | number;
  episodeNumber?: number;
  className?: string;
  label?: string;
  compact?: boolean;
}

// Generate pure lowercase alphabetic characters only (no digits, no uppercase)
export function generatePureAlphaRandomId(length = 6): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return result;
}

export function ViyieEmbedLink({
  contentId,
  episodeNumber,
  className = "",
  label = "ViyiePlayer Embed Link",
  compact = false,
}: ViyieEmbedLinkProps) {
  const [randomSeed, setRandomSeed] = useState(() => generatePureAlphaRandomId(6));
  const [copied, setCopied] = useState(false);

  const embedPath = useMemo(() => {
    const safeId = String(contentId || "item").trim();
    const epPart =
      episodeNumber !== undefined && episodeNumber !== null
        ? `_ep${episodeNumber}`
        : "";
    return `/e/${safeId}${epPart}-${randomSeed}`;
  }, [contentId, episodeNumber, randomSeed]);

  const fullEmbedUrl = useMemo(() => {
    const origin =
      typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : "";
    return `${origin}${embedPath}`;
  }, [embedPath]);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(fullEmbedUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    },
    [fullEmbedUrl]
  );

  const handleRegenerate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setRandomSeed(generatePureAlphaRandomId(6));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`relative overflow-hidden rounded-xl border border-red-500/25 bg-gradient-to-r from-red-950/40 via-black/60 to-red-950/30 p-2.5 sm:p-3 shadow-md backdrop-blur-sm ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-6 h-6 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center shrink-0">
            <PlayCircle className="w-3.5 h-3.5 text-red-500 animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] sm:text-[10px] font-semibold text-red-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-red-400" />
                {label}
              </span>
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-300/80 border border-red-500/20 font-mono">
                /e/
              </span>
            </div>
            <div className="text-[10px] sm:text-xs font-mono text-white/80 truncate mt-0.5 select-all hover:text-white transition-colors">
              {fullEmbedUrl}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleRegenerate}
            title="Generate new random embed key"
            className="h-7 w-7 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border border-white/10 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3 hover:rotate-180 transition-transform duration-500" />
          </button>

          <button
            type="button"
            onClick={handleCopy}
            title="Copy Embed Link"
            className={`h-7 px-2.5 rounded-lg text-[10px] font-medium flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer border ${
              copied
                ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-300"
                : "bg-red-600 hover:bg-red-500 border-red-500 text-white shadow-sm hover:shadow-red-600/20"
            }`}
          >
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.span
                  key="check"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  className="flex items-center gap-1"
                >
                  <Check className="w-3 h-3 text-emerald-300" />
                  <span>Copied</span>
                </motion.span>
              ) : (
                <motion.span
                  key="copy"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  className="flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy Link</span>
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          <a
            href={fullEmbedUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Test Embed Player in New Tab"
            className="h-7 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 text-[10px] flex items-center gap-1 transition-all"
          >
            <ExternalLink className="w-3 h-3" />
            {!compact && <span className="hidden md:inline">Open</span>}
          </a>
        </div>
      </div>
    </motion.div>
  );
}
