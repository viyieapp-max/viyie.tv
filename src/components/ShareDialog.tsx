import { motion } from "framer-motion";
import { X, Copy, Check, Link2, Send } from "lucide-react";
import { useEffect, useState } from "react";
import type { Movie } from "../types";
import { BRAND_NAME } from "../constants/brand";
import { useUserData } from "../hooks/useUserData";

export default function ShareDialog({
  movie,
  onClose,
}: {
  movie: Movie;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const { toast } = useUserData();

  // build a deep-link style url (works whether or not it's served at root)
  const shareUrl = `${window.location.origin}/home/${movie.id}`;
  const shareText = `🎬 Watch "${movie.title}" (${movie.year}) on ${BRAND_NAME} — ${shareUrl}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    // Lock body scroll
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = originalStyle;
    };
  }, [onClose]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast("Link copied to clipboard", "success");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Failed to copy link", "error");
    }
  };

  const platforms = [
    {
      name: "WhatsApp",
      color: "bg-emerald-500 hover:bg-emerald-600",
      url: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
      ),
    },
    {
      name: "Telegram",
      color: "bg-sky-500 hover:bg-sky-600",
      url: `https://t.me/share/url?url=${encodeURIComponent(
        shareUrl
      )}&text=${encodeURIComponent(shareText)}`,
      icon: <Send className="w-5 h-5" />,
    },
    {
      name: "X / Twitter",
      color: "bg-zinc-800 hover:bg-zinc-900 border border-white/10",
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        shareText
      )}`,
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      name: "Facebook",
      color: "bg-blue-600 hover:bg-blue-700",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
        shareUrl
      )}`,
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100000] flex items-center justify-center p-4 overflow-hidden touch-none"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: "spring", damping: 24, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-gradient-to-b from-[#1a0d0d] to-[#0a0a0a] rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
      >
        {/* decorative orbs */}
        <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-red-600/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-orange-500/20 blur-3xl pointer-events-none" />

        <div className="relative p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-orange-400/80 font-medium mb-1">
                Share
              </p>
              <h3 className="text-xl font-black text-white leading-tight">
                {movie.title}
              </h3>
              <p className="text-xs text-white/40 mt-1">
                {movie.year} • {movie.duration}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Link copy */}
          <div className="flex items-center gap-2 p-2 bg-black/40 border border-white/10 rounded-xl mb-5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center shrink-0">
              <Link2 className="w-4 h-4 text-white" />
            </div>
            <input
              readOnly
              value={shareUrl}
              className="flex-1 bg-transparent text-xs text-white/70 outline-none truncate"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              onClick={copyLink}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                copied
                  ? "bg-emerald-500 text-white"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>

          {/* Platforms */}
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2 font-medium">
            Or share to
          </p>
          <div className="grid grid-cols-2 gap-2">
            {platforms.map((p) => (
              <a
                key={p.name}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-white text-sm font-semibold transition ${p.color}`}
              >
                {p.icon}
                {p.name}
              </a>
            ))}
          </div>

          {/* Native share fallback */}
          {typeof navigator !== "undefined" &&
            "share" in navigator && (
              <button
                onClick={async () => {
                  try {
                    await (navigator as Navigator).share({
                      title: movie.title,
                      text: shareText,
                      url: shareUrl,
                    });
                  } catch {
                    /* user cancelled */
                  }
                }}
                className="w-full mt-3 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition"
              >
                Open device share menu
              </button>
            )}
        </div>
      </motion.div>
    </motion.div>
  );
}
