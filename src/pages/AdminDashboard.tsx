import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import firebaseConfig from "../../firebase-applet-config.json";
import AdminSubtitleTool from "../components/AdminSubtitleTool";
import AdminResizeVideoTool from "../components/AdminResizeVideoTool";
import AdminBotAnoboyTool from "../components/AdminBotAnoboyTool";
import { ServerEmbedInput } from "../components/AdminPanel/ServerEmbedInput";
import { ViyieEmbedLink } from "../components/AdminPanel/ViyieEmbedLink";
import {
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Check,
  Film,
  LogOut,
  Search,
  MessageCircle,
  Image,
  MessageSquare,
  Calendar,
  Clock,
  Star,
  Upload,
  Layers,
  Play,
  Settings,
  ArrowLeft,
  Users,
  Flag,
  Menu,
  ArrowUpDown,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Trophy,
  Crown,
  Flame,
  Bell,
  MonitorPlay,
  ExternalLink,
  ShieldCheck,
  Crop,
  UserPlus,
  Globe,
  Eye,
  EyeOff,
  FileJson,
  Copy,
  AlertTriangle,
  Undo,
  Redo,
  ShieldAlert,
  Edit2,
  Folder,
  ListFilter,
  Database,
  Sliders,
} from "lucide-react";
import AssetManager from "../components/AssetManager";
import { MediaBanner } from "../components/UIComponents";
import { useUndoRedo } from "../hooks/useUndoRedo";
import { RedeemCodeManager } from "../components/RedeemCodeManager";
import {
  db,
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
  query,
  limit,
  orderBy,
  updateDoc,
  serverTimestamp,
  auth,
  onSnapshot,
} from "../lib/firebase";
import { BRAND_LOGO_URL, BRAND_NAME } from "../constants/brand";
import { useUserData } from "../hooks/useUserData";
import { useSettings } from "../hooks/useSettings";
import { useStudios } from "../hooks/useStudios";

import type { Content, HeroSlot, Comment } from "../types";
import { useRef } from "react";

interface AdminSubtitle {
  name: string;
  url: string;
  offset?: number;
}

interface AdminSubtitleManagerProps {
  value: string;
  onChange: (newValue: string) => void;
  label?: string;
}

const COUNTRIES_LIST = [
  "Indonesia",
  "English",
  "Malaysia",
  "Thailand",
  "Vietnam",
  "Philippines",
  "Japan",
  "Korea",
  "China",
  "Spain",
  "France",
  "Germany",
  "Italy",
  "Portugal",
  "Brazil",
  "Russia",
  "Turkey",
  "Arabic",
  "India",
  "Netherlands",
];

function AdminSubtitleManager({
  value,
  onChange,
  label = "Custom Subtitles List",
}: AdminSubtitleManagerProps) {
  const [subtitles, setSubtitles] = useState<AdminSubtitle[]>([]);
  const [tempName, setTempName] = useState("");
  const [tempUrl, setTempUrl] = useState("");
  const [tempOffset, setTempOffset] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [inlineName, setInlineName] = useState("");
  const [inlineUrl, setInlineUrl] = useState("");
  const [inlineOffset, setInlineOffset] = useState("");
  const [showTempDropdown, setShowTempDropdown] = useState(false);
  const [showInlineDropdown, setShowInlineDropdown] = useState<number | null>(null);

  useEffect(() => {
    if (!value || typeof value !== "string") {
      setSubtitles([]);
      return;
    }
    try {
      const trimmed = value.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          setSubtitles(parsed);
          return;
        }
      }
    } catch (e) {
      // Ignored
    }
    setSubtitles([{ name: "English Subtitle", url: value }]);
  }, [value]);

  const saveList = (list: AdminSubtitle[]) => {
    if (list.length === 0) {
      onChange("");
    } else {
      onChange(JSON.stringify(list));
    }
  };

  const handleAdd = () => {
    if (!tempUrl.trim()) return;
    const finalName = tempName.trim() || `Subtitle ${subtitles.length + 1}`;
    let finalUrl = tempUrl.trim();
    if (
      !finalUrl.startsWith("http://") &&
      !finalUrl.startsWith("https://") &&
      !finalUrl.startsWith("//") &&
      !finalUrl.startsWith("data:") &&
      !finalUrl.startsWith("/")
    ) {
      if (!finalUrl.includes(":")) {
        finalUrl = "/" + finalUrl;
      }
    }
    const offsetVal = tempOffset.trim() ? Number(tempOffset) : 0;
    const newList = [...subtitles, { name: finalName, url: finalUrl, offset: offsetVal }];
    setSubtitles(newList);
    saveList(newList);
    setTempName("");
    setTempUrl("");
    setTempOffset("");
  };

  const startEdit = (idx: number) => {
    setEditingIndex(idx);
    setInlineName(subtitles[idx].name);
    setInlineUrl(subtitles[idx].url);
    setInlineOffset(subtitles[idx].offset !== undefined ? String(subtitles[idx].offset) : "");
  };

  const handleSaveInline = (idx: number) => {
    if (!inlineUrl.trim()) return;
    const finalName = inlineName.trim() || `Subtitle ${idx + 1}`;
    let finalUrl = inlineUrl.trim();
    if (
      !finalUrl.startsWith("http://") &&
      !finalUrl.startsWith("https://") &&
      !finalUrl.startsWith("//") &&
      !finalUrl.startsWith("data:") &&
      !finalUrl.startsWith("/")
    ) {
      if (!finalUrl.includes(":")) {
        finalUrl = "/" + finalUrl;
      }
    }
    const offsetVal = inlineOffset.trim() ? Number(inlineOffset) : 0;
    const newList = [...subtitles];
    newList[idx] = { name: finalName, url: finalUrl, offset: offsetVal };
    setSubtitles(newList);
    saveList(newList);
    setEditingIndex(null);
    setInlineName("");
    setInlineUrl("");
    setInlineOffset("");
  };

  const handleRemove = (index: number) => {
    const newList = subtitles.filter((_, idx) => idx !== index);
    setSubtitles(newList);
    saveList(newList);
  };

  return (
    <div className="space-y-2.5 p-3.5 bg-blue-500/5 border border-blue-500/10 rounded-xl">
      <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block">
        {label}
      </label>

      {subtitles.length > 0 && (
        <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1">
          {subtitles.map((sub, idx) => {
            const isEditing = editingIndex === idx;
            return isEditing ? (
              <div
                key={idx}
                className="flex items-center gap-2 p-1.5 px-2 bg-black/60 border border-blue-500/30 rounded-lg text-xs text-white relative"
              >
                <div className="relative w-[25%]">
                  <input
                    type="text"
                    placeholder="Sub name"
                    value={inlineName}
                    onFocus={() => setShowInlineDropdown(idx)}
                    onBlur={() => {
                      setTimeout(() => setShowInlineDropdown(null), 200);
                    }}
                    onChange={(e) => {
                      setInlineName(e.target.value);
                      setShowInlineDropdown(idx);
                    }}
                    className="w-full h-7 bg-white/5 border border-white/10 rounded px-2 text-[10.5px] text-white outline-none focus:border-blue-500 font-sans"
                  />
                  {showInlineDropdown === idx && (
                    <div className="absolute left-0 right-0 top-full mt-1 max-h-36 overflow-y-auto bg-zinc-950 border border-red-600/30 rounded-lg shadow-xl z-50 divide-y divide-white/5">
                      {COUNTRIES_LIST.filter(country => 
                        country.toLowerCase().includes(inlineName.toLowerCase())
                      ).map(country => (
                        <button
                          key={country}
                          type="button"
                          onMouseDown={() => {
                            setInlineName(country);
                            setShowInlineDropdown(null);
                          }}
                          className="w-full text-left px-2 py-1 text-[10px] text-white/80 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        >
                          {country}
                        </button>
                      ))}
                      {COUNTRIES_LIST.filter(country => 
                        country.toLowerCase().includes(inlineName.toLowerCase())
                      ).length === 0 && (
                        <div className="px-2 py-1 text-[9px] text-white/40 italic">
                          No match
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Sub URL"
                  value={inlineUrl}
                  onChange={(e) => setInlineUrl(e.target.value)}
                  className="flex-1 h-7 bg-white/5 border border-white/10 rounded px-2 text-[10px] text-white font-mono outline-none focus:border-blue-500"
                />
                <input
                  type="number"
                  step="0.1"
                  placeholder="Offset (s)"
                  value={inlineOffset}
                  onChange={(e) => setInlineOffset(e.target.value)}
                  className="w-[60px] h-7 bg-white/5 border border-white/10 rounded px-1.5 text-[10px] text-white outline-none focus:border-blue-500"
                  title="Offset (Seconds)"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSaveInline(idx)}
                    className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-white/5 rounded transition-all cursor-pointer"
                    title="Save changes"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingIndex(null);
                      setInlineName("");
                      setInlineUrl("");
                      setInlineOffset("");
                    }}
                    className="p-1 text-white/40 hover:text-white hover:bg-white/5 rounded transition-all cursor-pointer"
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 p-1.5 px-2.5 bg-black/40 border border-white/5 rounded-lg text-xs text-white"
              >
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="font-medium text-blue-400 text-[10.5px] truncate flex items-center gap-1.5">
                    {sub.name}
                    {sub.offset !== undefined && sub.offset !== 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-300 rounded font-mono font-normal">
                        Offset: {sub.offset}s
                      </span>
                    )}
                  </span>
                  <span className="text-[9.5px] text-white/45 font-mono truncate">
                    {sub.url}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(idx)}
                    className="p-1 text-white/40 hover:text-blue-500 hover:bg-white/5 rounded transition-colors shrink-0 cursor-pointer"
                    title="Edit Subtitle"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="p-1 text-white/40 hover:text-red-500 hover:bg-white/5 rounded transition-colors shrink-0 cursor-pointer"
                    title="Remove Subtitle"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-1.5 items-center relative font-sans">
        <div className="relative w-[30%]">
          <input
            type="text"
            placeholder="Sub Name (e.g. Indo)"
            value={tempName}
            onFocus={() => setShowTempDropdown(true)}
            onBlur={() => {
              setTimeout(() => setShowTempDropdown(false), 200);
            }}
            onChange={(e) => {
              setTempName(e.target.value);
              setShowTempDropdown(true);
            }}
            className="w-full h-8 bg-black/50 border border-white/10 rounded-lg px-2 text-[10.5px] text-white placeholder-white/20 outline-none focus:border-blue-500 font-sans"
          />
          {showTempDropdown && (
            <div className="absolute left-0 right-0 bottom-full mb-1 max-h-36 overflow-y-auto bg-zinc-950 border border-red-600/30 rounded-lg shadow-xl z-50 divide-y divide-white/5">
              {COUNTRIES_LIST.filter(country => 
                country.toLowerCase().includes(tempName.toLowerCase())
              ).map(country => (
                <button
                  key={country}
                  type="button"
                  onMouseDown={() => {
                    setTempName(country);
                    setShowTempDropdown(false);
                  }}
                  className="w-full text-left px-2.5 py-1 text-[10px] text-white/80 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  {country}
                </button>
              ))}
              {COUNTRIES_LIST.filter(country => 
                country.toLowerCase().includes(tempName.toLowerCase())
              ).length === 0 && (
                <div className="px-2 py-1 text-[9px] text-white/40 italic">
                  No match
                </div>
              )}
            </div>
          )}
        </div>
        <input
          type="text"
          placeholder="VTT/SRT URL link"
          value={tempUrl}
          onChange={(e) => setTempUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          className="flex-1 h-8 bg-black/50 border border-white/10 rounded-lg px-2 text-[10.5px] text-white placeholder-white/20 outline-none focus:border-blue-500 font-sans font-mono"
        />
        <input
          type="number"
          step="0.1"
          placeholder="Offset"
          value={tempOffset}
          onChange={(e) => setTempOffset(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          className="w-[70px] h-8 bg-black/50 border border-white/10 rounded-lg px-2 text-[10.5px] text-white placeholder-white/20 outline-none focus:border-blue-500 font-sans"
          title="Pre-configured subtitle delay in seconds"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="h-8 bg-blue-600 hover:bg-blue-700 hover:scale-105 active:scale-95 text-white p-1 px-2.5 rounded-lg transition-all flex items-center justify-center shrink-0 cursor-pointer text-[10.5px] font-medium gap-0.5 font-sans"
          title="Add Subtitle"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

const LOCAL_ASSET_OPTIONS = [
  {
    name: "Viyie New Logo",
    path: "/viyie.png",
    desc: "Newly Uploaded Brand Logo PNG",
  },
  {
    name: "Viyie Chine Logo",
    path: "/viyiechine.png",
    desc: "Main Branding Logo PNG",
  },
  {
    name: "Placeholder Poster",
    path: "/placeholder-episode.jpg",
    desc: "Default TV/Movie Poster fallback",
  },
  {
    name: "Offline Media file 1",
    path: "/k1.mp3",
    desc: "Sponsor background / audio 1",
  },
  {
    name: "Offline Media file 2",
    path: "/k2.mp3",
    desc: "Sponsor background / audio 2",
  },
  {
    name: "Embedded Ad Frame",
    path: "/banner-ad.html",
    desc: "Local sponsorship direct iframe",
  },
];

interface AdminUrlInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  onOpenPicker?: () => void;
}

function AdminUrlInput({
  value = "",
  onChange,
  placeholder = "Enter URL or local/asset file route...",
  className = "",
  label,
  onOpenPicker,
}: AdminUrlInputProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [dynamicOptions, setDynamicOptions] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (showPicker) {
      setIsSyncing(true);
      fetch("/api/public-assets")
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error("Failed to fetch public assets");
        })
        .then((data) => {
          if (Array.isArray(data)) {
            const formatted = data.map((f: any) => ({
              name: f.name,
              path: f.url || `/${f.name}`,
              desc: `Type: ${f.type || "unknown"} ‚Ä¢ Size: ${(f.size / 1024).toFixed(1)} KB`,
            }));
            setDynamicOptions(formatted);
          }
        })
        .catch((err) => {
          console.warn("Could not load dynamic public-assets", err);
        })
        .finally(() => {
          setIsSyncing(false);
        });
    }
  }, [showPicker]);

  const mergedOptions = useMemo(() => {
    const list = [...LOCAL_ASSET_OPTIONS];
    const existingPaths = new Set(list.map((o) => o.path));
    dynamicOptions.forEach((d) => {
      if (!existingPaths.has(d.path)) {
        list.push(d);
      }
    });
    return list;
  }, [dynamicOptions]);

  const safeValue = value || "";
  const isLink =
    safeValue.startsWith("http://") ||
    safeValue.startsWith("https://") ||
    safeValue.startsWith("//") ||
    safeValue.startsWith("data:");

  const handleInputChange = (val: string) => {
    let finalVal = val || "";
    if (
      finalVal.trim() &&
      !finalVal.startsWith("http://") &&
      !finalVal.startsWith("https://") &&
      !finalVal.startsWith("//") &&
      !finalVal.startsWith("data:")
    ) {
      if (!finalVal.startsWith("/")) {
        if (!finalVal.includes(":")) {
          finalVal = "/" + finalVal;
        }
      }
    }
    onChange(finalVal);
  };

  const selectAsset = (path: string) => {
    onChange(path);
    setShowPicker(false);
  };

  return (
    <div className="relative space-y-1.5 w-full">
      {label && (
        <span className="block text-[10px] font-black uppercase text-white/40 tracking-widest pl-1">
          {label}
        </span>
      )}
      <div className="relative flex items-center">
        <div className="absolute left-3.5 flex items-center gap-1.5 pointer-events-none">
          {isLink ? (
            <Globe className="w-4 h-4 text-emerald-400" />
          ) : safeValue.trim() ? (
            <Image className="w-4 h-4 text-blue-400" />
          ) : (
            <Image className="w-4 h-4 text-white/20" />
          )}
        </div>

        <input
          type="text"
          value={safeValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={() => {
            handleInputChange(safeValue.trim());
          }}
          placeholder={placeholder}
          className={`w-full mt-1.5 h-11 bg-black/40 border border-white/10 rounded-xl pl-10 pr-16 text-sm outline-none focus:border-red-500/50 transition-colors text-white ${className}`}
        />

        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="absolute right-2 px-2 py-1.5 text-[9px] uppercase font-black tracking-wider text-white/50 bg-white/5 hover:bg-white/10 hover:text-white rounded-lg transition-all flex items-center gap-0.5 cursor-pointer"
          title="Pick from Assets or Logos library"
        >
          <Plus className="w-2.5 h-2.5" /> PIK
        </button>
      </div>

      <div className="flex items-center justify-between px-1 text-[8px] font-black tracking-widest uppercase">
        {safeValue.trim() ? (
          isLink ? (
            <span className="text-emerald-500/75 flex items-center gap-1">
              ‚óè External Web Link
            </span>
          ) : (
            <span className="text-blue-500/75 flex items-center gap-1">
              ‚óè Local Asset / Path
            </span>
          )
        ) : (
          <span className="text-white/20">Empty Url</span>
        )}

        {safeValue.trim() && !isLink && (
          <span className="text-white/40 normal-case font-mono">
            {safeValue}
          </span>
        )}
      </div>

      {showPicker && (
        <>
          <div
            className="fixed inset-0 z-[105]"
            onClick={() => setShowPicker(false)}
          />
          <div className="absolute top-12 right-0 w-80 bg-[#0c0c0e] border border-white/10 rounded-xl shadow-[0_4px_30px_rgba(0,0,0,0.8)] p-3 z-[110] space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-white/40">
                {isSyncing
                  ? "Syncing Public Files..."
                  : "Select Local Asset / Logo"}
              </span>
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="text-white/40 hover:text-white p-1"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            {onOpenPicker && (
              <button
                type="button"
                onClick={() => {
                  setShowPicker(false);
                  onOpenPicker();
                }}
                className="w-full py-2.5 px-3 text-[10px] font-black uppercase bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 rounded-xl flex items-center justify-center gap-1.5 transition-all outline-none cursor-pointer"
              >
                <Folder className="w-3.5 h-3.5" />
                <span>DYNAMIC ASSET MANAGER</span>
              </button>
            )}
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {mergedOptions.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectAsset(opt.path)}
                  className="w-full text-left p-2 hover:bg-white/5 rounded-lg transition-all flex items-start gap-2 group cursor-pointer"
                >
                  <div className="p-1.5 bg-white/5 rounded group-hover:bg-red-500/10 transition-colors">
                    <Image className="w-3.5 h-3.5 text-white/50 group-hover:text-red-500 transition-colors" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-white group-hover:text-red-400 transition-colors truncate">
                      {opt.name}
                    </div>
                    <div className="text-[9px] text-white/40 font-mono truncate">
                      {opt.path}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Helper component for searchable select
function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Choose...",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string; poster?: string }[];
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((o) => o.value === value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="relative" ref={wrapperRef}>
      <div
        className="w-full h-11 bg-black/40 border border-white/10 rounded-2xl px-4 text-xs font-medium text-white/60 hover:text-white flex items-center justify-between cursor-pointer"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch("");
        }}
      >
        <span className="truncate">
          {selected ? selected.label : placeholder}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
      {isOpen && (
        <div className="absolute top-12 left-0 right-0 max-h-60 bg-[#151515] border border-white/10 rounded-2xl z-[100] overflow-hidden flex flex-col shadow-2xl">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black/40 px-4 py-3 text-xs outline-none border-b border-white/5"
            autoFocus
          />
          <div className="overflow-y-auto flex-1 custom-scroll">
            <div
              className={`px-4 py-2 text-xs flex items-center gap-3 cursor-pointer hover:bg-white/5 ${!value ? "text-red-500" : "text-white/40"}`}
              onClick={() => {
                onChange("");
                setIsOpen(false);
              }}
            >
              -- Clear --
            </div>
            {filtered.map((o) => (
              <div
                key={o.value}
                className={`px-4 py-2 text-xs flex items-center gap-3 cursor-pointer hover:bg-white/5 ${value === o.value ? "bg-white/5 text-white font-medium" : "text-white/70"}`}
                onClick={() => {
                  onChange(o.value);
                  setIsOpen(false);
                }}
              >
                {o.poster && (
                  <img
                    src={o.poster}
                    className="w-6 h-8 object-cover rounded"
                    alt=""
                  />
                )}
                <span className="truncate">{o.label}</span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="p-4 text-xs text-white/30 text-center">
                No results
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface SafeInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function cleanStreamPayloadUrl(input: string): string {
  if (!input) return "";
  let val = input.trim();

  // 1. If it's a full HTML with iframe/script element, extract the src URL
  if (val.includes("<iframe") && val.includes("src=")) {
    const match = val.match(/src="([^"]+)"/) || val.match(/src='([^']+)'/);
    if (match && match[1]) {
      val = match[1];
    }
  } else if (val.includes("<script") && val.includes("src=")) {
    const match = val.match(/src="([^"]+)"/) || val.match(/src='([^']+)'/);
    if (match && match[1]) {
      val = match[1];
    }
  }

  // Remove HTML tags inside of the string (e.g. script/integrity stuff)
  val = val.replace(/<[^>]*>?/gm, "").trim();

  // 2. Clear any cloudflare cf-beacon, integrity parameter, script elements from the URL itself
  try {
    if (
      val.startsWith("http://") ||
      val.startsWith("https://") ||
      val.startsWith("//")
    ) {
      const isProtocolRelative = val.startsWith("//");
      const tempUrl = isProtocolRelative ? `https:${val}` : val;
      const urlObj = new URL(tempUrl);

      const badParams = [
        "integrity",
        "data-cf-beacon",
        "cf-beacon",
        "token",
        "cf_beacon",
      ];
      badParams.forEach((p) => {
        urlObj.searchParams.delete(p);
      });

      let cleaned = urlObj.toString();
      if (isProtocolRelative) {
        cleaned = cleaned.replace(/^https:/, "");
      }
      val = cleaned;
    }
  } catch (err) {
    val = val.replace(/([?&])integrity=[^&]*/g, "");
    val = val.replace(/([?&])data-cf-beacon=[^&]*/g, "");
    val = val.replace(/([?&])cf-beacon=[^&]*/g, "");
    val = val.replace(/([?&])token=[^&]*/g, "");
  }

  // Remove trailing and leading quotes or script residuals if any
  val = val.replace(/["']/g, "").trim();

  if (val.endsWith("?") || val.endsWith("&")) {
    val = val.substring(0, val.length - 1);
  }

  return val;
}

function SafeInput({ value, onChange, ...props }: SafeInputProps) {
  const [localValue, setLocalValue] = useState(value || "");
  const typingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    if (!typingRef.current && value !== localValue) {
      setLocalValue(value || "");
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    typingRef.current = true;
    const val = e.target.value;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      typingRef.current = false;
      if (onChange) onChange({ target: { value: val } } as any);
    }, 200);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (typingRef.current) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      typingRef.current = false;
      if (onChange) onChange(e as any);
    }
  };

  return <input value={localValue} onChange={handleChange} onBlur={handleBlur} {...props} />;
}

interface SafeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

function SafeTextarea({ value, onChange, ...props }: SafeTextareaProps) {
  const [localValue, setLocalValue] = useState(value || "");
  const typingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    if (!typingRef.current && value !== localValue) {
      setLocalValue(value || "");
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalValue(e.target.value);
    typingRef.current = true;
    const val = e.target.value;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      typingRef.current = false;
      if (onChange) onChange({ target: { value: val } } as any);
    }, 200);
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (typingRef.current) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      typingRef.current = false;
      if (onChange) onChange(e as any);
    }
  };

  return <textarea value={localValue} onChange={handleChange} onBlur={handleBlur} {...props} />;
}

function getYouTubeId(url: string) {
  if (!url) return null;
  try {
    let id = "";
    // Handle embed URLs
    if (url.includes("/embed/")) {
      id = url.split("/embed/")[1].split(/[?&]/)[0];
    } else if (url.includes("v=")) {
      id = url.split("v=")[1].split(/[&?]/)[0];
    } else if (url.includes("youtu.be/")) {
      id = url.split("youtu.be/")[1].split(/[&?]/)[0];
    } else if (url.includes("/shorts/")) {
      const parts = url.split("/shorts/");
      if (parts.length > 1) {
        id = parts[1].split(/[?&/]/)[0];
      }
    }

    if (id && id !== "videoseries" && id.length > 2) {
      return id;
    }
  } catch (e) {}
  return null;
}

export default function AdminDashboard({
  onLogout,
  onExit,
  isOwner,
}: {
  onLogout: () => void;
  onExit: () => void;
  isOwner?: boolean;
}) {
  const { toast } = useUserData();
  const { settings, genres, tags = [] } = useSettings();
  const [localNavbarNotifs, setLocalNavbarNotifs] = useState<string[]>([]);

  useEffect(() => {
    if (settings?.navbarNotifications) {
      setLocalNavbarNotifs(settings.navbarNotifications);
    }
  }, [settings?.navbarNotifications]);

  const saveNavbarTooltips = async () => {
    setIsUploading(true);
    try {
      await saveSettings({ navbarNotifications: localNavbarNotifs });
      toast("Tooltip messages saved successfully!", "success");
    } catch (e) {
      toast("Failed to save tooltips", "error");
    } finally {
      setIsUploading(false);
    }
  };
  const [activeTab, setActiveTab] = useState<
    | "content"
    | "hero"
    | "comments"
    | "users"
    | "settings"
    | "system"
    | "reports"
    | "bugs"
    | "notifications"
    | "web"
    | "tools"
    | "assets"
    | "genres"
  >("content");
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [toolSearchQuery, setToolSearchQuery] = useState("");
  const [webSubTab, setWebSubTab] = useState<
    "ads" | "studio" | "api" | "redeem"
  >("ads");
  const [newDriveApiKey, setNewDriveApiKey] = useState("");
  const [localDriveApiKeys, setLocalDriveApiKeys] = useState<string[]>([]);

  useEffect(() => {
    if (settings?.driveApiKeys && Array.isArray(settings.driveApiKeys)) {
      setLocalDriveApiKeys(settings.driveApiKeys);
    } else {
      setLocalDriveApiKeys([]);
    }
  }, [settings?.driveApiKeys]);
  const [editingStudio, setEditingStudio] = useState<any>(null);
  const [assetPickerTarget, setAssetPickerTarget] = useState<{
    type: "movie" | "episode" | "studio" | "banner" | "settings";
    field: string;
    episodeIndex?: number;
    bannerIndex?: number;
  } | null>(null);
  const [newStudio, setNewStudio] = useState<any>(null);

  const [customPrompt, setCustomPrompt] = useState<{
    isOpen: boolean;
    title: string;
    value: string;
    onSave: (val: string) => void;
  } | null>(null);

  const handleSelectAsset = (url: string) => {
    if (!assetPickerTarget) return;

    const { type, field, episodeIndex } = assetPickerTarget;

    if (type === "movie" && editing) {
      setEditing({
        ...editing,
        [field]: url,
      });
    } else if (type === "episode" && editing && episodeIndex !== undefined) {
      const ne = [...(editing.episodes || [])];
      if (ne[episodeIndex]) {
        ne[episodeIndex].thumbnail = url;
        setEditing({
          ...editing,
          episodes: ne,
        });
      }
    } else if (type === "studio") {
      if (editingStudio) {
        setEditingStudio({
          ...editingStudio,
          logoUrl: url,
        });
      }
      if (newStudio) {
        setNewStudio({
          ...newStudio,
          logoUrl: url,
        });
      }
    } else if (
      type === "banner" &&
      assetPickerTarget.bannerIndex !== undefined
    ) {
      if (field === "centerBanners") {
        const banners = settings?.centerBanners || [];
        const newBanners = [...banners];
        if (newBanners[assetPickerTarget.bannerIndex]) {
          newBanners[assetPickerTarget.bannerIndex] = {
            ...newBanners[assetPickerTarget.bannerIndex],
            image: url,
          };
          saveSettings({ centerBanners: newBanners });
        }
      }
    } else if (type === "settings") {
      saveSettings({ [field]: url });
    }

    setAssetPickerTarget(null);
    toast("Asset URL sync succeeded!", "success");
  };
  const [studioSearchQuery, setStudioSearchQuery] = useState("");
  const [isSearchingSettings, setIsSearchingSettings] = useState(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  const [showAutoTagSettings, setShowAutoTagSettings] = useState(false);
  const [userTab, setUserTab] = useState<"management" | "ultra">("management");
  const [imdbIdInput, setImdbIdInput] = useState("");
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [isJsonImportOpen, setIsJsonImportOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [publicNotif, setPublicNotif] = useState({
    title: "",
    message: "",
    image: "",
    link: "",
    type: "new_content" as
      | "new_content"
      | "movie_soon"
      | "viyie_plus"
      | "private",
  });
  const [clearHours, setClearHours] = useState("");
  const [notificationTab, setNotificationTab] = useState<
    "broadcast" | "manual"
  >("broadcast");
  const [manualNotif, setManualNotif] = useState({
    title: "",
    message: "",
    type: "new_content" as "new_content" | "private" | "viyie_plus",
    userId: "",
    image: "",
  });
  const [ultraSettings, setUltraSettings] = useState({
    autoNotifyUpload: true,
    autoNotifyEpisode: true,
    autoNotifyComingSoon: true,
    autoTagNew: false,
    newTagLimit: 5,
    uploadTemplate: "üéâ New {kind}: {title} is now available! üé¨",
    episodeTemplate:
      "üî• Episode update! {title} just dropped a new episode. Watch now! üì∫",
    comingSoonTemplate: "Get ready! {title} is coming soon to Viyie. ‚ú®",
    banTemplate:
      "‚ö†Ô∏è Your account has been banned from commenting until {time} for violation of community rules. üö´",
    customCommand: "",
  });

  useEffect(() => {
    getDoc(doc(db, "settings", "ultra")).then((snap) => {
      if (snap.exists())
        setUltraSettings((prev) => ({ ...prev, ...snap.data() }));
    });
  }, []);

  const [quickLinks, setQuickLinks] = useState<
    { id: string; name: string; url: string }[]
  >([]);
  const [isQuickLinksOpen, setIsQuickLinksOpen] = useState(false);
  const [newQuickLink, setNewQuickLink] = useState({ name: "", url: "" });

  useEffect(() => {
    // Load quick links
    getDocs(query(collection(db, "quick_links"), limit(20))).then((snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id }));
      setQuickLinks(list);
    });
  }, []);

  const saveQuickLink = async () => {
    if (!newQuickLink.name || !newQuickLink.url) return;
    setIsUploading(true);
    try {
      const id = doc(collection(db, "quick_links")).id;
      const data = { id, ...newQuickLink, createdAt: serverTimestamp() };
      await setDoc(doc(db, "quick_links", id), data);
      setQuickLinks([data as any, ...quickLinks]);
      setNewQuickLink({ name: "", url: "" });
      toast("Quick link saved to cloud", "success");
    } catch (e) {
      toast("Failed to save quick link", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const deleteQuickLink = async (id: string) => {
    setIsUploading(true);
    try {
      await deleteDoc(doc(db, "quick_links", id));
      setQuickLinks(quickLinks.filter((l) => l.id !== id));
      toast("Quick link deleted", "info");
    } catch (e) {
      toast("Delete failed", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const applyAutoTagging = async (
    allCollections: Content[],
    cfg: { enabled: boolean; limit: number },
  ) => {
    if (!cfg.enabled) return;

    // Sort logic
    const sorted = [...allCollections].sort((a, b) => {
      const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      return dateB - dateA;
    });

    const mLimit = sorted
      .filter((c) => c.type === "movie")
      .slice(0, cfg.limit)
      .map((x) => x.id);
    const tLimit = sorted
      .filter((c) => c.type === "tv")
      .slice(0, cfg.limit)
      .map((x) => x.id);

    const updates: { id: string; isNew: boolean }[] = [];
    allCollections.forEach((c) => {
      const target =
        (c.type === "movie" && mLimit.includes(c.id)) ||
        (c.type === "tv" && tLimit.includes(c.id));
      if (c.isNew !== target) {
        updates.push({ id: String(c.id), isNew: target });
      }
    });

    if (updates.length > 0) {
      await Promise.all(
        updates.map((u) =>
          updateDoc(doc(db, "content", u.id), { isNew: u.isNew }),
        ),
      );
      // Local sync happens in the caller or via setContents
    }
  };

  const saveStaffs = async (newStaffs: any[]) => {
    try {
      const staffEmails = newStaffs.map((s) => s.email.toLowerCase());
      await updateDoc(doc(db, "settings", "main"), {
        staffs: newStaffs,
        staffEmails: staffEmails,
      });
      setAdminStaffs(newStaffs);
      toast("Staff updated successfully", "success");
    } catch (error) {
      toast("Failed to update staff", "error");
    }
  };

  const saveUltraSettings = async (updates: Partial<typeof ultraSettings>) => {
    try {
      const newData = { ...ultraSettings, ...updates };
      setUltraSettings(newData);
      await setDoc(doc(db, "settings", "ultra"), newData, { merge: true });

      // If autoTag was just enabled or limit changed, re-apply
      if (newData.autoTagNew) {
        await applyAutoTagging(contents, {
          enabled: true,
          limit: newData.newTagLimit,
        });
      }

      toast("Ultra settings saved", "success");
    } catch (e) {
      toast("Failed to save ultra settings", "error");
    }
  };

  const replacePlaceholders = (
    text: string,
    data: {
      title?: string;
      kind?: string;
      user?: string;
      time?: string;
      ep?: string;
    },
  ) => {
    return text
      .replace(/{titlemov}/g, data.title || "")
      .replace(/{title}/g, data.title || "")
      .replace(/{tv\/movi}/g, data.kind || "")
      .replace(/{kind}/g, data.kind || "")
      .replace(/{user}/g, data.user || "User")
      .replace(/{time}/g, data.time || "")
      .replace(/{ep}/g, data.ep || "");
  };

  const sendAutoNotification = async (
    type: "upload" | "episode" | "coming_soon" | "ban",
    info: any,
  ) => {
    try {
      const template =
        type === "upload"
          ? ultraSettings.uploadTemplate
          : type === "episode"
            ? ultraSettings.episodeTemplate
            : type === "coming_soon"
              ? ultraSettings.comingSoonTemplate
              : ultraSettings.banTemplate;

      const message = replacePlaceholders(template, info);
      const title =
        type === "upload"
          ? `New ${info.kind}`
          : type === "episode"
            ? `Episode Update`
            : type === "coming_soon"
              ? `Coming Soon Alert`
              : `Notice Profile`;

      const notifId = doc(collection(db, "notifications")).id;
      await setDoc(doc(db, "notifications", notifId), {
        id: notifId,
        title,
        message,
        date: new Date().toISOString(),
        type:
          type === "ban"
            ? "private"
            : type === "coming_soon"
              ? "movie_soon"
              : "new_content",
        userId: info.userId || null,
        image: "", // user requested to not give auto image
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Auto notification failed:", e);
    }
  };

  const autoFillFromImdb = async () => {
    if (!imdbIdInput.trim()) {
      toast("Please enter an IMDb ID first!", "error");
      return;
    }

    // Clean ID if full URL pasted
    let cleanId = imdbIdInput.trim();
    if (cleanId.includes("imdb.com/title/")) {
      try {
        const parts = cleanId.split("imdb.com/title/");
        if (parts.length > 1) {
          cleanId = parts[1].split("/")[0];
        }
      } catch (e) {}
    }

    if (!cleanId.startsWith("tt")) {
      toast("Invalid IMDb ID format (should start with tt)", "error");
      return;
    }

    setIsAutoFilling(true);
    try {
      const res = await fetch(`/api/imdb/${cleanId}`);
      const data = await res
        .json()
        .catch(() => ({ error: "Invalid response from server" }));

      if (!res.ok) {
        throw new Error(
          data.error || "Failed to fetch data. Check ID or TMDB API Key.",
        );
      }

      setEditing((prev) => {
        const title = data.title || prev?.title || "Untitled";
        const slugId = title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        return {
          ...prev,
          title: title,
          synopsis: data.synopsis || "",
          releaseDate: data.releaseDate || "",
          rating: data.rating || "0.0",
          poster: data.poster || "",
          backdrop: data.backdrop || "",
          genres: Array.isArray(data.genres)
            ? data.genres
            : typeof data.genres === "string"
              ? data.genres
                  .split(",")
                  .map((s: any) => s.trim())
                  .filter(Boolean)
              : [],
          type: data.type || "movie",
          duration: data.duration || "",
          cast: data.cast || [],
          // Auto-generate ID if it was empty or matched title slug
          id:
            !prev?.id ||
            prev.id ===
              prev.title
                ?.toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "")
              ? slugId
              : prev.id,
        } as any;
      });

      setImdbIdInput("");
      toast(`Successfully fetched: ${data.title}`, "success");
    } catch (e: any) {
      toast(e.message || "Something went wrong", "error");
      console.error("Auto-fill error:", e);
    } finally {
      setIsAutoFilling(false);
    }
  };
  const [contents, setContents] = useState<Content[]>([]);
  const [heroSlots, setHeroSlots] = useState<HeroSlot[]>([]);
  const [bottomHeroSlots, setBottomHeroSlots] = useState<HeroSlot[]>([]);
  const [searchUser, setSearchUser] = useState("");
  const [userList, setUserList] = useState<any[]>([]);
  const [isPlaylistImportOpen, setIsPlaylistImportOpen] = useState(false);
  const [isJsonEpisodeMergeOpen, setIsJsonEpisodeMergeOpen] = useState(false);
  const [jsonEpisodeMergeText, setJsonEpisodeMergeText] = useState("");
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [importReverse, setImportReverse] = useState(false);
  const [playlistEpisodeCount, setPlaylistEpisodeCount] = useState("24");
  const [playlistImportMode, setPlaylistImportMode] = useState<"direct" | "custom">("direct");
  const [playlistConflictMode, setPlaylistConflictMode] = useState<"timpa" | "tambah">("tambah");
  const [playlistCustomRanges, setPlaylistCustomRanges] = useState("1-6, 7-12, 13-18");
  const [draggedEpIndex, setDraggedEpIndex] = useState<number | null>(null);
  const [hoveredInputEpIdx, setHoveredInputEpIdx] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (activeTab === "users" && !fetchedTabs.current["users"]) {
      const q = query(collection(db, "users"), limit(50));
      getDocs(q).then((snap) => {
        const list: any[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id }));
        setUserList(list);
        fetchedTabs.current["users"] = true;
      });
    }
  }, [activeTab]);

  const handleUpdateUser = async (uid: string, data: any) => {
    try {
      await updateDoc(doc(db, "users", uid), data);
      setUserList((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, ...data } : u)),
      );
      toast("User updated successfully", "success");
    } catch (e) {
      console.error(e);
      toast("Failed to update user", "error");
    }
  };

  const filteredUsers = userList.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchUser.toLowerCase()),
  );
  const [comments, setComments] = useState<Comment[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [adminStaffs, setAdminStaffs] = useState<
    { email: string; role: "owner" | "admin" }[]
  >([]);
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<"owner" | "admin">("admin");

  useEffect(() => {
    if (settings && settings.staffs) {
      setAdminStaffs(settings.staffs);
    }
  }, [settings]);

  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [editingNotif, setEditingNotif] = useState<any>(null);
  const [editing, setEditing] = useState<Partial<Content> | null>(null);

  const existingPagesForEditing = useMemo(() => {
    if (!editing || editing.type !== "tv") return [];
    const mainId = editing.syncMainId || editing.id;
    if (!mainId) return [];

    const subItems = contents.filter(
      (c) =>
        c.id !== mainId &&
        (c.syncMainId === mainId ||
          String(c.id).startsWith(String(mainId) + "-page")),
    );

    const getPageSuffix = (idStr: string) => {
      const match = idStr.match(/-page(\d+)$/);
      return match ? `page${match[1]}` : "";
    };

    const pages = [
      { pageKey: "main", label: "Main", id: mainId, isMain: true },
    ];

    subItems.forEach((item) => {
      const suffix = getPageSuffix(String(item.id));
      if (suffix) {
        pages.push({
          pageKey: suffix,
          label: `Page ${suffix.replace("page", "")}`,
          id: String(item.id),
          isMain: false,
        });
      }
    });

    pages.sort((a, b) => {
      if (a.isMain) return -1;
      if (b.isMain) return 1;
      const numA = parseInt(a.pageKey.replace("page", ""), 10);
      const numB = parseInt(b.pageKey.replace("page", ""), 10);
      return numA - numB;
    });

    return pages;
  }, [editing?.id, editing?.syncMainId, contents]);

  const isEditingSubPage = useMemo(() => {
    if (!editing) return false;
    return !!(
      editing.isSubPage ||
      editing.syncMainId ||
      String(editing.id).includes("-page")
    );
  }, [editing?.id, editing?.isSubPage, editing?.syncMainId]);

  // Search state for filtering episodes list in Visual Edit mode
  const [episodesSearchQuery, setEpisodesSearchQuery] = useState("");

  useEffect(() => {
    setEpisodesSearchQuery("");
  }, [editing?.id]);

  const serializeEditing = (obj: any) => {
    if (!obj) return "";
    const isSub =
      obj.isSubPage || obj.syncMainId || String(obj.id || "").includes("-page");
    if (isSub) {
      return JSON.stringify({ episodes: obj.episodes || [] }, null, 2);
    }
    
    const template: any = {
      id: "",
      title: "",
      originalTitle: "",
      synopsis: "",
      director: "",
      year: new Date().getFullYear(),
      releaseDate: "",
      duration: "",
      rating: "",
      quality: "",
      type: "movie",
      kind: "movie",
      status: "released",
      poster: "",
      backdrop: "",
      backdropPosition: "",
      backdropScale: 1,
      backdropRotate: 0,
      embedUrl: "",
      streamUrl: "",
      mainServerName: "",
      genres: [],
      tags: [],
      servers: [],
      episodes: [],
      seasons: [],
      downloadLinks: [],
      isTrending: false,
      isNew: false,
      isHero: false,
      isCustomPlayer: false,
      customSubtitle: "",
      customResolutions: "",
      forceIframe: false,
      useExternalPopup: false,
      useExternalTab: false,
      useSandbox: false,
      playerScale: 1,
      playerTranslateX: 0,
      playerTranslateY: 0,
      studio: "",
    };

    const normalizedObj = { ...template };
    Object.keys(obj).forEach((key) => {
      if (obj[key] !== undefined) {
        normalizedObj[key] = obj[key];
      }
    });

    if (!normalizedObj.genres) normalizedObj.genres = [];
    if (!normalizedObj.tags) normalizedObj.tags = [];

    return JSON.stringify(normalizedObj, null, 2);
  };

  const [editorMode, setEditorMode] = useState<"visual" | "json">("visual");
  const {
    state: jsonText,
    setState: setJsonText,
    undo: undoJson,
    redo: redoJson,
    canUndo: canUndoJson,
    canRedo: canRedoJson,
    resetHistory: resetJsonHistory,
  } = useUndoRedo("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isViyieConfigOpen, setIsViyieConfigOpen] = useState(false);

  // Decoupled local state and debounce tracking for high-performance JSON edit mode
  const [localJsonText, setLocalJsonText] = useState("");
  const lastSyncedJsonText = useRef("");

  useEffect(() => {
    if (jsonText !== lastSyncedJsonText.current) {
      lastSyncedJsonText.current = jsonText;
      setLocalJsonText(jsonText);
    }
  }, [jsonText]);

  useEffect(() => {
    if (localJsonText === lastSyncedJsonText.current) return;

    const handler = setTimeout(() => {
      lastSyncedJsonText.current = localJsonText;
      setJsonText(localJsonText);
      try {
        const parsed = JSON.parse(localJsonText);
        setEditing((prev) => {
          if (!prev) return parsed;
          const isSub =
            prev.isSubPage ||
            prev.syncMainId ||
            String(prev.id || "").includes("-page");
          if (isSub) {
            const eps = Array.isArray(parsed) ? parsed : parsed.episodes || [];
            return {
              ...prev,
              episodes: eps,
            };
          }
          return parsed;
        });
        setJsonError(null);
      } catch (err: any) {
        setJsonError(err.message || "Syntactically invalid JSON structure");
      }
    }, 450);

    return () => clearTimeout(handler);
  }, [localJsonText]);

  const runAutoFix = (customEditing?: any) => {
    const targetObj = customEditing || editing;
    if (!targetObj) return;

    // 1. Determine correct type (default to "movie" if not specified, or use kind if type is falsy)
    let finalType =
      targetObj.type || (targetObj.kind === "tv" ? "tv" : "movie");
    if (finalType) {
      finalType = String(finalType).toLowerCase() as any;
    }
    if (finalType !== "movie" && finalType !== "tv") {
      finalType = "movie";
    }

    // 2. Initialize default required servers if missing: YouTube, Hydrax, TurboVIP, Dailymotion
    const requiredNames = ["YouTube", "Hydrax", "TurboVIP", "Dailymotion"];

    let updatedServers = [...(targetObj.servers || [])];

    requiredNames.forEach((name) => {
      const exists = updatedServers.some(
        (s) => s.name && s.name.toLowerCase() === name.toLowerCase(),
      );
      if (!exists) {
        updatedServers.push({
          name: name,
          embedUrl: "",
          useExternalPopup: false,
          useExternalTab: false,
        });
      }
    });

    // Remove any non-mandatory players with empty embed fields
    updatedServers = updatedServers.filter((sv: any) => {
      const isRequired = requiredNames.some(
        (name) => sv.name && sv.name.toLowerCase() === name.toLowerCase(),
      );
      return isRequired || (sv.embedUrl && sv.embedUrl.trim() !== "");
    });

    // 3. Update episodes if it is a TV show
    let updatedEpisodes = targetObj.episodes ? [...targetObj.episodes] : [];
    if (finalType === "tv" && updatedEpisodes.length > 0) {
      updatedEpisodes = updatedEpisodes.map((ep) => {
        let epServers = ep.servers ? [...ep.servers] : [];
        requiredNames.forEach((name) => {
          const exists = epServers.some(
            (s) => s.name && s.name.toLowerCase() === name.toLowerCase(),
          );
          if (!exists) {
            epServers.push({
              name: name,
              embedUrl: "",
              useExternalPopup: false,
              useExternalTab: false,
            });
          }
        });

        // Remove any non-mandatory players with empty embed fields for TV episode
        epServers = epServers.filter((sv: any) => {
          const isRequired = requiredNames.some(
            (name) => sv.name && sv.name.toLowerCase() === name.toLowerCase(),
          );
          return isRequired || (sv.embedUrl && sv.embedUrl.trim() !== "");
        });

        return {
          ...ep,
          servers: epServers,
        };
      });
    }

    const repaired = {
      ...targetObj,
      type: finalType,
      kind: finalType,
      servers: updatedServers,
      episodes: updatedEpisodes,
    };

    if (customEditing) {
      return repaired;
    } else {
      setEditing(repaired);
      toast(
        "Auto Fix Applied! Type normalized & 4 Required Players added.",
        "success",
      );
    }
  };

  useEffect(() => {
    if (editing) {
      try {
        const parsed = jsonText ? JSON.parse(jsonText) : null;
        if (!parsed || String(parsed.id) !== String(editing.id)) {
          resetJsonHistory(serializeEditing(editing));
          setJsonError(null);
        }
      } catch (e) {
        // preserve invalid state while typing
      }
    } else {
      resetJsonHistory("");
      setJsonError(null);
    }
  }, [editing?.id]);

  const { studios } = useStudios();
  const [showStudioList, setShowStudioList] = useState(false);
  const [playerPreviewUrl, setPlayerPreviewUrl] = useState<{
    url: string;
    sandbox: boolean;
    scale?: number;
    translateX?: number;
    translateY?: number;
  } | null>(null);
  const [playerPosEditor, setPlayerPosEditor] = useState<{
    url: string;
    sandbox: boolean;
    scale: number;
    translateX: number;
    translateY: number;
    onSave: (val: {
      scale: number;
      translateX: number;
      translateY: number;
    }) => void;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [contentFilter, setContentFilter] = useState<
    | "all"
    | "released_movie"
    | "released_tv"
    | "coming_soon_movie"
    | "coming_soon_tv"
  >("all");

  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isSearchingSettings) {
          setIsSearchingSettings(false);
        } else {
          onExit();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchingSettings, onExit]);

  // Auto-cleanup notifications older than 5 days
  useEffect(() => {
    const cleanupOldNotifications = async () => {
      try {
        const now = Date.now();
        const fiveDaysAgo = now - 5 * 24 * 60 * 60 * 1000;
        const q = query(collection(db, "notifications"));
        const snap = await getDocs(q);

        const deletePromises: Promise<void>[] = [];
        snap.forEach((d) => {
          const data = d.data();
          const notifDate = new Date(data.date).getTime();
          if (notifDate < fiveDaysAgo) {
            deletePromises.push(deleteDoc(doc(db, "notifications", d.id)));
          }
        });

        if (deletePromises.length > 0) {
          await Promise.all(deletePromises);
          console.log(`Cleaned up ${deletePromises.length} old notifications.`);
        }
      } catch (err) {
        console.error("Cleanup notifications error:", err);
      }
    };
    cleanupOldNotifications();
  }, []);

  // Load initial data
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "content")), (snap) => {
      const list: Content[] = [];
      snap.forEach((doc) => {
        const data = doc.data() as any;
        const resolvedType = (data.type === "tv" || data.kind === "tv") ? "tv" : "movie";
        list.push({
          ...data,
          id: doc.id,
          type: resolvedType,
          kind: resolvedType,
          genres: Array.isArray(data.genres)
            ? data.genres
            : typeof data.genres === "string"
              ? data.genres
                  .split(",")
                  .map((s: string) => s.trim())
                  .filter(Boolean)
              : [],
        } as Content);
      });
      list.sort((a, b) => {
        const getTime = (val: any) => {
          if (!val) return 0;
          if (typeof val.toMillis === "function") return val.toMillis();
          if (val.seconds) return val.seconds * 1000;
          return new Date(val).getTime() || 0;
        };
        return getTime(b.createdAt) - getTime(a.createdAt);
      });
      setContents(list);
    }, (error) => {
      console.error("Error fetching content in admin:", error);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "hero_slots"), orderBy("slotIndex", "asc")), (snap) => {
      const list: HeroSlot[] = [];
      snap.forEach((doc) =>
        list.push({ ...(doc.data() as HeroSlot), id: doc.id }),
      );
      setHeroSlots(list);
    }, (error) => {
      console.error("Error fetching hero slots in admin:", error);
    });

    return () => unsub();
  }, []);

  const fetchedTabs = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (activeTab === "comments" && !fetchedTabs.current["comments"]) {
      getDocs(query(collection(db, "comments"), orderBy("timestamp", "desc")))
        .then((snap) => {
          const list: Comment[] = [];
          snap.forEach((doc) =>
            list.push({ ...(doc.data() as Comment), id: doc.id }),
          );
          setComments(list);
          fetchedTabs.current["comments"] = true;
        })
        .catch((err) => console.error("Comments snapshot error:", err));
    } else if (
      (activeTab === "reports" || activeTab === "bugs") &&
      !fetchedTabs.current["reports"]
    ) {
      getDocs(query(collection(db, "reports"), orderBy("timestamp", "desc")))
        .then((snap) => {
          const list: any[] = [];
          snap.forEach((doc) => list.push({ ...doc.data(), id: doc.id }));
          setReports(list);
          fetchedTabs.current["reports"] = true;
        })
        .catch((err) => console.error("Reports snapshot error:", err));
    } else if (
      activeTab === "notifications" &&
      !fetchedTabs.current["notifications"]
    ) {
      getDocs(query(collection(db, "notifications"), orderBy("date", "desc")))
        .then((snap) => {
          const list: any[] = [];
          snap.forEach((doc) => list.push({ ...doc.data(), id: doc.id }));
          setNotificationsList(list);
          fetchedTabs.current["notifications"] = true;
        })
        .catch((err) => console.error("Notifications snapshot error:", err));
    }
  }, [activeTab]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "bottom_hero_slots"), orderBy("slotIndex", "asc")),
      (snap) => {
        const list: HeroSlot[] = [];
        snap.forEach((doc) =>
          list.push({ ...(doc.data() as HeroSlot), id: doc.id }),
        );
        setBottomHeroSlots(list);
      },
      (error) => {
        console.error("Error fetching bottom hero in admin:", error);
      }
    );
    return () => unsub();
  }, []);

  const filtered = contents.filter((m) => {
    const searchLower = search.toLowerCase();
    const matchesTitle = m.title.toLowerCase().includes(searchLower);
    const matchesId = String(m.id).toLowerCase().includes(searchLower);
    const matchesGenre = m.genres?.some((g) =>
      g.toLowerCase().includes(searchLower),
    );
    const matchesTag = m.customTags?.some((t) =>
      t.toLowerCase().includes(searchLower),
    );
    const matchesEpisodes =
      m.type === "tv" &&
      m.episodes?.some(
        (ep) =>
          ep &&
          (ep.title?.toLowerCase().includes(searchLower) ||
            String(ep.number || "") === searchLower),
      );

    const matchesSearch =
      matchesTitle ||
      matchesId ||
      matchesGenre ||
      matchesTag ||
      matchesEpisodes;

    let matchesFilter = true;
    if (contentFilter === "released_movie")
      matchesFilter = m.type === "movie" && m.status !== "coming_soon";
    if (contentFilter === "released_tv")
      matchesFilter = m.type === "tv" && m.status !== "coming_soon";
    if (contentFilter === "coming_soon_movie")
      matchesFilter = m.type === "movie" && m.status === "coming_soon";
    if (contentFilter === "coming_soon_tv")
      matchesFilter = m.type === "tv" && m.status === "coming_soon";

    return matchesSearch && matchesFilter;
  });

  const [connectionStatus, setConnectionStatus] = useState<
    "online" | "offline" | "checking"
  >("checking");
  const [heroPlacement, setHeroPlacement] = useState<
    "home" | "banner" | "movie" | "tv"
  >("home");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [contentLimit, setContentLimit] = useState(12);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        await getDoc(doc(db, "settings", "main"));
        setConnectionStatus("online");
      } catch (e: any) {
        if (e.code === "unavailable" || e.message?.includes("offline")) {
          setConnectionStatus("offline");
        } else {
          setConnectionStatus("online");
        }
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const saveContent = async () => {
    let activeItem = editing;

    // Force synchronize the JSON text area input immediately on clicking SAVE to avoid any debounce timeouts truncation
    if (editorMode === "json") {
      try {
        const parsed = JSON.parse(localJsonText);
        if (parsed && typeof parsed === "object") {
          const isSub =
            editing?.isSubPage ||
            editing?.syncMainId ||
            String(editing?.id || "").includes("-page");
          if (isSub) {
            const eps = Array.isArray(parsed) ? parsed : parsed.episodes || [];
            activeItem = {
              ...editing,
              episodes: eps,
            } as any;
            setEditing(activeItem);
          } else {
            activeItem = parsed;
            setEditing(parsed);
          }
        }
      } catch (err: any) {
        toast("JSON Syntax Error! Please fix before saving.", "error");
        return;
      }
    }

    if (!activeItem || isUploading) return;

    if (!activeItem.title?.trim()) {
      toast("Movie Title is required!", "error");
      return;
    }

    if (activeItem.status !== "coming_soon") {
      if (
        activeItem.type === "movie" &&
        !activeItem.streamUrl &&
        (!activeItem.servers || activeItem.servers.length === 0)
      ) {
        toast("Movie needs a Streaming URL or at least one Server!", "error");
        return;
      }

      if (
        activeItem.type === "tv" &&
        (!activeItem.episodes || activeItem.episodes.length === 0)
      ) {
        toast("TV needs at least one Episode!", "error");
        return;
      }
    }

    const id = String(activeItem.id || doc(collection(db, "content")).id)
      .trim()
      .toLowerCase()
      .replace(/ /g, "-");
    const now = serverTimestamp();

    const template: any = {
      id: "",
      title: "",
      originalTitle: "",
      synopsis: "",
      director: "",
      year: new Date().getFullYear(),
      releaseDate: "",
      duration: "",
      rating: "",
      quality: "",
      type: "movie",
      kind: "movie",
      status: "released",
      poster: "",
      backdrop: "",
      backdropPosition: "",
      backdropScale: 1,
      backdropRotate: 0,
      embedUrl: "",
      streamUrl: "",
      mainServerName: "",
      genres: [],
      tags: [],
      servers: [],
      episodes: [],
      seasons: [],
      downloadLinks: [],
      isTrending: false,
      isNew: false,
      isHero: false,
      isCustomPlayer: false,
      customSubtitle: "",
      customResolutions: "",
      forceIframe: false,
      useExternalPopup: false,
      useExternalTab: false,
      useSandbox: false,
      playerScale: 1,
      playerTranslateX: 0,
      playerTranslateY: 0,
      studio: "",
    };

    const normalizedData = { ...template };
    Object.keys(activeItem).forEach((key) => {
      if ((activeItem as any)[key] !== undefined) {
        normalizedData[key] = (activeItem as any)[key];
      }
    });

    const data = {
      ...normalizedData,
      id,
      kind: normalizedData.type,
      updatedAt: now,
      year: activeItem.releaseDate
        ? new Date(activeItem.releaseDate).getFullYear()
        : new Date().getFullYear(),
    };

    setIsUploading(true);
    let finalData: any = { ...data };

    const requiredNames = ["YouTube", "Hydrax", "TurboVIP", "Dailymotion"];

    // Purge non-required empty players and ensure required players exist for movies
    if (!finalData.servers || !Array.isArray(finalData.servers)) {
      finalData.servers = [];
    }
    
    // 1. Keep valid custom players and ANY existing required players
    finalData.servers = finalData.servers.filter((sv: any) => {
      const isRequired = requiredNames.some(
        (name) => sv.name && sv.name.toLowerCase() === name.toLowerCase(),
      );
      return isRequired || (sv.embedUrl && sv.embedUrl.trim() !== "");
    });
    
    // 2. Append any missing required players
    requiredNames.forEach(reqName => {
      const exists = finalData.servers.some((s: any) => s.name?.toLowerCase() === reqName.toLowerCase());
      if (!exists) {
        finalData.servers.push({
          name: reqName,
          embedUrl: "",
          useExternalPopup: false,
          useExternalTab: false
        });
      }
    });

    // Purge non-required empty players and ensure required players exist for TV show episodes
    if (finalData.episodes && Array.isArray(finalData.episodes)) {
      finalData.episodes = finalData.episodes.map((ep: any) => {
        let epServers = ep.servers && Array.isArray(ep.servers) ? ep.servers : [];
        
        epServers = epServers.filter((sv: any) => {
          const isRequired = requiredNames.some(
            (name) => sv.name && sv.name.toLowerCase() === name.toLowerCase(),
          );
          return isRequired || (sv.embedUrl && sv.embedUrl.trim() !== "");
        });

        requiredNames.forEach(reqName => {
          const exists = epServers.some((s: any) => s.name?.toLowerCase() === reqName.toLowerCase());
          if (!exists) {
            epServers.push({
              name: reqName,
              embedUrl: "",
              useExternalPopup: false,
              useExternalTab: false
            });
          }
        });

        return { ...ep, servers: epServers };
      });

      // Deduplicate TV show episodes on saving to database (to solve double sync completely in DB)
      const uniqueEpIds = new Set();
      finalData.episodes = finalData.episodes.filter((ep: any) => {
        if (ep && ep.number !== undefined) {
          const epNum = Number(ep.number);
          if (uniqueEpIds.has(epNum)) {
            return false;
          }
          uniqueEpIds.add(epNum);
          return true;
        }
        return true;
      });

      // Sort in ascending order by episode number to make sure they are sequenced right
      finalData.episodes.sort(
        (a: any, b: any) => (Number(a.number) || 0) - (Number(b.number) || 0),
      );
    }
    try {
      const isBrandNew = !contents.some((c) => String(c.id) === String(id));
      if (isBrandNew) {
        finalData.createdAt = now;
        finalData.views = 0;

        // Auto broadcast notification
        if (activeItem.status === "coming_soon") {
          if (ultraSettings.autoNotifyComingSoon) {
            await sendAutoNotification("coming_soon", {
              title: activeItem.title,
              kind: activeItem.type === "tv" ? "TV" : "Movie",
              image: activeItem.poster || "",
            });
          }
        } else if (ultraSettings.autoNotifyUpload) {
          await sendAutoNotification("upload", {
            title: activeItem.title,
            kind: activeItem.type === "tv" ? "TV" : "Movie",
            image: activeItem.poster || "",
          });
        }
      } else {
        // Check if episodes were added for TV
        const oldContent = contents.find((c) => String(c.id) === String(id));
        if (activeItem.type === "tv") {
          const oldEpCount = oldContent?.episodes?.length || 0;
          const newEpCount = activeItem.episodes?.length || 0;
          if (newEpCount > oldEpCount) {
            // Force series to the top of "New" list by updating releaseDate to today
            finalData.releaseDate = new Date().toISOString().split("T")[0];

            if (ultraSettings.autoNotifyEpisode) {
              const latestEp = activeItem.episodes?.[newEpCount - 1];
              await sendAutoNotification("episode", {
                title: activeItem.title,
                ep: String(latestEp?.number || newEpCount),
                image: latestEp?.thumbnail || activeItem.poster || "",
              });
            }
          }
        }
      }

      await setDoc(doc(db, "content", id), finalData, { merge: true });

      // Update local state immediately with a fake timestamp for UI
      const uiData = {
        ...finalData,
        id,
        updatedAt: { seconds: Math.floor(Date.now() / 1000) },
        createdAt: isBrandNew
          ? { seconds: Math.floor(Date.now() / 1000) }
          : finalData.createdAt,
      } as Content;

      const newContents = [uiData, ...contents.filter((c) => c.id !== id)];
      setContents(newContents);

      // Auto Tagging Logic
      if (ultraSettings.autoTagNew) {
        await applyAutoTagging(newContents, {
          enabled: true,
          limit: ultraSettings.newTagLimit,
        });
      }

      // Remove from local drafts if any
      try {
        const drafts = JSON.parse(
          localStorage.getItem("vinet_local_drafts") || "[]",
        );
        const updatedDrafts = drafts.filter((d: any) => d.id !== finalData.id);
        localStorage.setItem(
          "vinet_local_drafts",
          JSON.stringify(updatedDrafts),
        );
      } catch (err) {}

      toast("Successfully saved to Cloud Database!", "success");
      setEditing(null);
    } catch (e: any) {
      console.error("Save error:", e);
      const isOffline =
        e.code === "unavailable" || e.message?.includes("offline");
      const isQuota =
        e.code === "resource-exhausted" ||
        String(e).toLowerCase().includes("quota");

      let msg =
        "Failed to save to cloud: " + (e.message || "Unknown permission error");
      if (isOffline) {
        msg = "Cloud is OFFLINE. Saving locally. Please upload later.";
      } else if (isQuota) {
        msg = "Firebase Quota Limit Reached! Saving locally. Upload later.";
      } else {
        msg = "Error sharing to cloud. Saving locally just in case.";
      }

      // Auto backup locally
      try {
        const drafts = JSON.parse(
          localStorage.getItem("vinet_local_drafts") || "[]",
        );
        const existingDraftIdx = drafts.findIndex(
          (d: any) => d.id === finalData.id,
        );
        if (existingDraftIdx >= 0) {
          drafts[existingDraftIdx] = {
            ...finalData,
            updatedAt: new Date().toISOString(),
          };
        } else {
          drafts.push({
            ...finalData,
            id: finalData.id,
            updatedAt: new Date().toISOString(),
          });
        }
        localStorage.setItem("vinet_local_drafts", JSON.stringify(drafts));
        msg += " (Draft Saved)";

        // Let's also update the UI so they don't lose progress visually
        const uiData = {
          ...finalData,
          id,
          updatedAt: { seconds: Math.floor(Date.now() / 1000) },
          createdAt: finalData.createdAt || {
            seconds: Math.floor(Date.now() / 1000),
          },
        } as Content;
        setContents([uiData, ...contents.filter((c) => c.id !== id)]);

        setEditing(null);
      } catch (err) {}

      toast(msg, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const deleteContent = async (id: string) => {
    setIsUploading(true);
    try {
      await deleteDoc(doc(db, "content", id));
      const updatedContents = contents.filter((c) => c.id !== id);
      setContents(updatedContents);

      // Auto tag after deletion
      if (ultraSettings.autoTagNew) {
        await applyAutoTagging(updatedContents, {
          enabled: true,
          limit: ultraSettings.newTagLimit,
        });
      }

      toast("Content deleted from cloud", "info");
    } catch (e: any) {
      const errorMsg = e.message || String(e);
      toast("Delete failed: " + errorMsg, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const updateHeroSlot = async (
    slotIndex: number,
    contentId: string,
    placement: string,
  ) => {
    const slotId =
      placement === "home"
        ? `slot_${slotIndex}`
        : `slot_${placement}_${slotIndex}`;
    setIsUploading(true);
    try {
      if (!contentId) {
        await deleteDoc(doc(db, "hero_slots", slotId));
        setHeroSlots((prev) => prev.filter((s) => s.id !== slotId));
        toast(`Hero Slot ${slotIndex} cleared`, "info");
      } else {
        const data: any = {
          id: slotId,
          slotIndex,
          contentId,
          placement: placement === "home" ? null : placement,
        };
        await setDoc(doc(db, "hero_slots", slotId), data, { merge: true });
        setHeroSlots((prev) => {
          const filtered = prev.filter((s) => s.id !== slotId);
          // Preserve embedUrl if it exists in previous state
          const existing = prev.find((s) => s.id === slotId);
          if (existing?.embedUrl) data.embedUrl = existing.embedUrl;
          return [...filtered, data as HeroSlot];
        });
        toast(`Hero Slot ${slotIndex} updated`, "success");
      }
    } catch (e: any) {
      toast("Update failed: " + e.message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const updateHeroSlotEmbedUrl = async (
    slotIndex: number,
    placement: string,
    embedUrl: string,
  ) => {
    const slotId =
      placement === "home"
        ? `slot_${slotIndex}`
        : `slot_${placement}_${slotIndex}`;
    setIsUploading(true);
    try {
      await setDoc(
        doc(db, "hero_slots", slotId),
        { embedUrl },
        { merge: true },
      );
      setHeroSlots((prev) => {
        return prev.map((s) => (s.id === slotId ? { ...s, embedUrl } : s));
      });
      toast(`Hero Slot ${slotIndex} embed URL updated`, "success");
    } catch (e: any) {
      toast("Update failed: " + e.message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const updateBottomHeroSlot = async (
    slotIndex: number,
    contentId: string,
    placement: string,
  ) => {
    const slotId =
      placement === "home"
        ? `slot_${slotIndex}`
        : `slot_${placement}_${slotIndex}`;
    setIsUploading(true);
    try {
      if (!contentId) {
        await deleteDoc(doc(db, "bottom_hero_slots", slotId));
        setBottomHeroSlots((prev) => prev.filter((s) => s.id !== slotId));
        toast(`Bottom Hero Slot ${slotIndex} cleared`, "info");
      } else {
        const data = {
          id: slotId,
          slotIndex,
          contentId,
          placement: placement === "home" ? null : placement,
        };
        await setDoc(doc(db, "bottom_hero_slots", slotId), data, {
          merge: true,
        });
        setBottomHeroSlots((prev) => {
          const filtered = prev.filter((s) => s.id !== slotId);
          return [...filtered, data as HeroSlot];
        });
        toast(`Bottom Hero Slot ${slotIndex} updated`, "success");
      }
    } catch (e: any) {
      toast("Update failed: " + e.message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const seedAnimationData = async () => {
    const animationMovies = [
      {
        title: "The Super Mario Bros. Movie",
        type: "movie",
        releaseDate: "2023-04-05",
        rating: "7.7",
        duration: "1h 32m",
        genres: ["Animation", "Adventure", "Family", "Comedy", "Fantasy"],
        poster:
          "https://image.tmdb.org/t/p/w500/qNBAXBIQlnOFiAwgP6iCG432snw.jpg",
        backdrop:
          "https://image.tmdb.org/t/p/original/9n2tFqJu012Xn7A4y4S2YwZ4hX7.jpg",
        synopsis:
          "While working underground to fix a water main, Brooklyn plumbers Mario and brother Luigi are transported down a mysterious pipe and wander into a magical new world.",
        embedUrl: "https://www.youtube.com/embed/TnGl01FkMMo",
        streamUrl: "https://www.youtube.com/embed/TnGl01FkMMo",
        isTrending: true,
        isNew: false,
      },
      {
        title: "Inside Out 2",
        type: "movie",
        releaseDate: "2024-06-14",
        rating: "8.3",
        duration: "1h 36m",
        genres: ["Animation", "Family", "Comedy", "Drama"],
        poster:
          "https://image.tmdb.org/t/p/w500/vpnVM9B6NMmQpWeZvzRxq2RxGQw.jpg",
        backdrop:
          "https://image.tmdb.org/t/p/original/stKGOm8UyhuLPR9sZLjs5AkmncA.jpg",
        synopsis:
          "Teenager Riley's headquarters is undergoing a sudden demolition to make room for something entirely unexpected: new Emotions! Joy, Sadness, Anger, Fear and Disgust, who‚Äôve long been running a successful operation by all accounts, aren‚Äôt sure how to feel when Anxiety shows up.",
        embedUrl: "https://www.youtube.com/embed/LEjhY15eCx0",
        streamUrl: "https://www.youtube.com/embed/LEjhY15eCx0",
        isTrending: true,
        isNew: true,
      },
      {
        title: "Spider-Man: Across the Spider-Verse",
        type: "movie",
        releaseDate: "2023-06-02",
        rating: "8.6",
        duration: "2h 20m",
        genres: ["Animation", "Action", "Adventure", "Sci-Fi", "Superhero"],
        poster:
          "https://image.tmdb.org/t/p/w500/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg",
        backdrop:
          "https://image.tmdb.org/t/p/original/4HodYYKEIsGOdinkGi2Ucz6X9i0.jpg",
        synopsis:
          "Miles Morales returns for the next chapter of the Oscar-winning Spider-Verse saga, an epic adventure that will transport Brooklyn‚Äôs full-time, friendly neighborhood Spider-Man across the Multiverse.",
        embedUrl: "https://www.youtube.com/embed/cqGjhVJWtEg",
        streamUrl: "https://www.youtube.com/embed/cqGjhVJWtEg",
        isTrending: true,
        isNew: false,
      },
      {
        title: "Demon Slayer: Mugen Train",
        type: "movie",
        releaseDate: "2020-10-16",
        rating: "8.2",
        duration: "1h 57m",
        genres: ["Animation", "Action", "Adventure", "Fantasy", "Shounen"],
        poster:
          "https://image.tmdb.org/t/p/w500/h8Rb9gBr48ODIwYUttZNYeMWeUU.jpg",
        backdrop:
          "https://image.tmdb.org/t/p/original/h8Rb9gBr48ODIwYUttZNYeMWeUU.jpg",
        synopsis:
          "Tanjiro Kamado and his friends from the Demon Slayer Corps accompany Ky≈çjur≈ç Rengoku, the Flame Hashira, to investigate a mysterious series of disappearances occurring inside a train.",
        embedUrl: "https://www.youtube.com/embed/ARaeNt1ROHM",
        streamUrl: "https://www.youtube.com/embed/ARaeNt1ROHM",
        isTrending: true,
        isNew: false,
      },
      {
        title: "Suzume",
        type: "movie",
        releaseDate: "2022-11-11",
        rating: "7.8",
        duration: "2h 2m",
        genres: ["Animation", "Adventure", "Drama", "Fantasy", "Romance"],
        poster:
          "https://image.tmdb.org/t/p/w500/7rjFjQzJZTXDdbeY2wnP0mvOSnY.jpg",
        backdrop:
          "https://image.tmdb.org/t/p/original/qnPrmoQXxLO9aczJESsPMtmrV5N.jpg",
        synopsis:
          "A modern action fantasy adventure where a 17-year-old girl named Suzume helps a mysterious young man close doors from the other side that are releasing disasters all over Japan.",
        embedUrl: "https://www.youtube.com/embed/5pTcio2hCSw",
        streamUrl: "https://www.youtube.com/embed/5pTcio2hCSw",
        isTrending: true,
        isNew: false,
      },
      {
        title: "Kimi no Na wa",
        type: "movie",
        releaseDate: "2016-08-26",
        rating: "8.4",
        duration: "1h 46m",
        genres: ["Animation", "Romance", "Drama", "Fantasy"],
        poster:
          "https://image.tmdb.org/t/p/w500/q719jXZAceOFoUhUZ6dLuR9eXTH.jpg",
        backdrop:
          "https://image.tmdb.org/t/p/original/mMtUybQ6hL24FXo0F3Z4j2KG7kZ.jpg",
        synopsis:
          "Two strangers find themselves linked in a bizarre way. When a connection forms, will distance be the only thing to keep them apart?",
        embedUrl: "https://www.youtube.com/embed/xU47nhruN-Q",
        streamUrl: "https://www.youtube.com/embed/xU47nhruN-Q",
        isTrending: false,
        isNew: false,
      },
      {
        title: "Coco",
        type: "movie",
        releaseDate: "2017-11-22",
        rating: "8.4",
        duration: "1h 45m",
        genres: ["Animation", "Adventure", "Family", "Music", "Fantasy"],
        poster:
          "https://image.tmdb.org/t/p/w500/gGEsBPAijhVUFoiNpgZXqRVWJt2.jpg",
        backdrop:
          "https://image.tmdb.org/t/p/original/askg3SMvhqEl4OL52YuvdtY40Yb.jpg",
        synopsis:
          "Aspiring musician Miguel, confronted with his family's ancestral ban on music, enters the Land of the Dead to find his great-great-grandfather, a legendary singer.",
        embedUrl: "https://www.youtube.com/embed/Rvr68u6k5sI",
        streamUrl: "https://www.youtube.com/embed/Rvr68u6k5sI",
        isTrending: true,
        isNew: false,
      },
      {
        title: "Toy Story 4",
        type: "movie",
        releaseDate: "2019-06-21",
        rating: "7.7",
        duration: "1h 40m",
        genres: ["Animation", "Adventure", "Comedy", "Family"],
        poster:
          "https://image.tmdb.org/t/p/w500/w9kR8qbmQ01HwnvK4alvnQ2ca0L.jpg",
        backdrop:
          "https://image.tmdb.org/t/p/original/pTL14cPkCHKUKpDOXUjwZpvw9w7.jpg",
        synopsis:
          "When a new toy called 'Forky' joins Woody and the gang, a road trip alongside old and new friends reveals how big the world can be for a toy.",
        embedUrl: "https://www.youtube.com/embed/wmiIUN-7qhE",
        streamUrl: "https://www.youtube.com/embed/wmiIUN-7qhE",
        isTrending: false,
        isNew: false,
      },
    ];

    setIsUploading(true);
    try {
      const newContents: Content[] = [];
      for (const movie of animationMovies) {
        const id = movie.title
          .toLowerCase()
          .replace(/ /g, "-")
          .replace(/[^a-z0-9-]/g, "");
        const data = {
          ...movie,
          id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          views: Math.floor(Math.random() * 5000),
        };
        await setDoc(doc(db, "content", id), data, { merge: true });
        newContents.push({
          ...data,
          createdAt: { seconds: Math.floor(Date.now() / 1000) },
        } as any);
      }
      setContents((prev) => [...newContents, ...prev]);
      toast("Animation movies seeded directly to cloud", "success");
    } catch (e: any) {
      toast("Seeding failed: " + e.message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const saveSettings = async (updates: any) => {
    setIsUploading(true);
    try {
      const cleanUpdates: any = {};
      Object.keys(updates).forEach((key) => {
        if (updates[key] !== undefined) {
          cleanUpdates[key] = updates[key];
        }
      });

      await setDoc(doc(db, "settings", "main"), cleanUpdates, { merge: true });
      toast("Settings updated on cloud", "success");
    } catch (e: any) {
      toast("Failed to update settings: " + e.message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const saveGenres = async (newList: string[]) => {
    setIsUploading(true);
    try {
      await setDoc(
        doc(db, "settings", "genres"),
        { list: newList },
        { merge: true },
      );
      toast("Genres updated on cloud", "success");
    } catch (e: any) {
      toast("Failed to update genres: " + e.message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const saveTags = async (newList: string[]) => {
    setIsUploading(true);
    try {
      await setDoc(
        doc(db, "settings", "tags"),
        { list: newList },
        { merge: true },
      );
      toast("Tags updated on cloud", "success");
    } catch (e: any) {
      toast("Failed to update tags: " + e.message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const deleteComment = async (id: string) => {
    setIsUploading(true);
    try {
      await deleteDoc(doc(db, "comments", id));
      setComments((prev) => prev.filter((c) => c.id !== id));
      toast("Comment deleted from cloud", "info");
    } catch (e: any) {
      toast("Failed to delete comment: " + e.message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const parseRanges = (rangeStr: string): { start: number; end: number }[] => {
    const parts = rangeStr.split(/[,;]/);
    const ranges: { start: number; end: number }[] = [];
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const match = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = parseInt(match[2], 10);
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          ranges.push({ start, end });
        }
      }
    }
    return ranges;
  };

  const importFromPlaylist = async () => {
    if (!editing) {
      toast("Please open a TV for editing first!", "error");
      return;
    }

    if (!playlistUrl.includes("list=")) {
      toast(
        "Invalid YouTube Playlist URL! Look for 'list=' in the link.",
        "error",
      );
      return;
    }

    let listId = "";

    try {
      const urlObj = new URL(playlistUrl);
      listId = urlObj.searchParams.get("list") || "";

      if (!listId && playlistUrl.includes("list=")) {
        listId = playlistUrl.split("list=")[1].split(/[&?]/)[0];
      }
    } catch (e) {
      listId = playlistUrl.split("list=")[1]?.split(/[&?]/)[0] || "";
    }

    if (!listId) {
      toast("Could not find Playlist ID in URL!", "error");
      return;
    }

    // Determine counts to fetch
    let countToFetch = 100; // default for parsing custom or direct limit
    let parsedRanges: { start: number; end: number }[] = [];

    if (playlistImportMode === "custom") {
      if (!playlistCustomRanges.trim()) {
        toast("Please enter custom ranges (e.g., 1-6, 7-12).", "error");
        return;
      }
      parsedRanges = parseRanges(playlistCustomRanges);
      if (parsedRanges.length === 0) {
        toast("Invalid custom range format! Use e.g. 1-6, 7-12.", "error");
        return;
      }
      countToFetch = Math.max(...parsedRanges.map(r => r.end));
    } else {
      countToFetch = parseInt(playlistEpisodeCount || "50");
      if (isNaN(countToFetch) || countToFetch <= 0) {
        toast("Please enter a valid number of episodes.", "error");
        return;
      }
    }

    setIsUploading(true);

    try {
      const API_KEY = "AIzaSyBhXnw9__qkSYI85OVi7hkVpvrR_TTKIFg";
      let allItems: any[] = [];
      let nextPageToken = "";
      
      const capLimit = Math.min(countToFetch, 200);
      while (allItems.length < capLimit) {
        const fetchCount = Math.min(50, capLimit - allItems.length);
        const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${listId}&maxResults=${fetchCount}&key=${API_KEY}${nextPageToken ? `&pageToken=${nextPageToken}` : ""}`;
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Failed to fetch playlist data from YouTube API.");
        }
        
        const data = await response.json();
        if (data.items && data.items.length > 0) {
          allItems = allItems.concat(data.items);
        }
        
        if (data.nextPageToken) {
          nextPageToken = data.nextPageToken;
        } else {
          break;
        }
      }

      // Filter out deleted/private videos
      const validItems = allItems.filter(item => {
        const title = item.snippet?.title;
        return title !== "Private video" && title !== "Deleted video";
      });

      // 1. Collect all video IDs to batch fetch details (duration & actual upload dates)
      const videoIdsToFetch = validItems.map(item => item.snippet?.resourceId?.videoId).filter(Boolean);
      const videoDetailsMap: { [key: string]: { duration: string; publishedAt: string } } = {};

      const parseISO8601Duration = (durationStr: string): string => {
        if (!durationStr) return "24m";
        const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
        const matches = durationStr.match(regex);
        if (!matches) return "24m";
        const hours = parseInt(matches[1] || "0", 10);
        const minutes = parseInt(matches[2] || "0", 10);
        const seconds = parseInt(matches[3] || "0", 10);
        
        let parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (hours === 0 && minutes === 0 && seconds > 0) parts.push(`${seconds}s`);
        else if (hours === 0 && minutes === 0) return "0m";
        return parts.join(" ");
      };

      const iso8601ToSeconds = (durationStr: string): number => {
        if (!durationStr) return 0;
        const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
        const matches = durationStr.match(regex);
        if (!matches) return 0;
        const hours = parseInt(matches[1] || "0", 10);
        const minutes = parseInt(matches[2] || "0", 10);
        const seconds = parseInt(matches[3] || "0", 10);
        return hours * 3600 + minutes * 60 + seconds;
      };

      const formatSecondsToDuration = (totalSeconds: number): string => {
        if (totalSeconds <= 0) return "24m";
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        let parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (hours === 0 && minutes === 0 && seconds > 0) parts.push(`${seconds}s`);
        else if (hours === 0 && minutes === 0) return "0m";
        return parts.join(" ");
      };

      // Batch fetch from videos endpoint in chunks of 50
      for (let i = 0; i < videoIdsToFetch.length; i += 50) {
        const chunk = videoIdsToFetch.slice(i, i + 50);
        const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${chunk.join(",")}&key=${API_KEY}`;
        try {
          const detRes = await fetch(detailsUrl);
          if (detRes.ok) {
            const detData = await detRes.json();
            if (detData.items) {
              detData.items.forEach((vItem: any) => {
                videoDetailsMap[vItem.id] = {
                  duration: vItem.contentDetails?.duration || "",
                  publishedAt: vItem.snippet?.publishedAt || "",
                };
              });
            }
          }
        } catch (e) {
          console.error("Failed to fetch video details chunk:", e);
        }
      }

      const mergeServers = (existingServers: any[] | undefined, importedUrl: string) => {
        const requiredNames = ["YouTube", "Hydrax", "TurboVIP", "Dailymotion"];
        const baseServers = existingServers && existingServers.length > 0 
          ? [...existingServers] 
          : requiredNames.map(name => ({
              name,
              embedUrl: "",
              useExternalPopup: false,
              useExternalTab: false,
            }));

        // Ensure all required names exist in the base list
        requiredNames.forEach(name => {
          const found = baseServers.some((s: any) => s.name?.toLowerCase() === name.toLowerCase());
          if (!found) {
            baseServers.push({
              name,
              embedUrl: "",
              useExternalPopup: false,
              useExternalTab: false,
            });
          }
        });

        // Update YouTube alternative URL
        const updated = baseServers.map((s: any) => {
          if (s.name?.toLowerCase() === "youtube") {
            return { ...s, embedUrl: importedUrl };
          }
          return s;
        });

        return updated;
      };

      const newEpisodes: any[] = [];

      if (playlistImportMode === "custom") {
        // Create custom embed group for each parsed range
        parsedRanges.forEach((range, rangeIdx) => {
          const startIdx = range.start - 1;
          const endIdx = range.end - 1;

          const groupItems = validItems.slice(startIdx, endIdx + 1);
          if (groupItems.length === 0) return;

          const videoIds = groupItems.map(item => item.snippet?.resourceId?.videoId).filter(Boolean);
          if (videoIds.length === 0) return;

          const firstVideoId = videoIds[0];
          const epUrl = `https://www.youtube.com/embed/${firstVideoId}?playlist=${videoIds.join(",")}`;

          const firstItem = groupItems[0];
          const thumb =
            firstItem.snippet?.thumbnails?.maxres?.url ||
            firstItem.snippet?.thumbnails?.high?.url ||
            firstItem.snippet?.thumbnails?.medium?.url ||
            firstItem.snippet?.thumbnails?.default?.url ||
            `https://img.youtube.com/vi/${firstVideoId}/hqdefault.jpg`;

          const title = `Episodes ${range.start}-${range.end}`;

          // Calculate sum of durations for group
          let totalSecs = 0;
          groupItems.forEach(item => {
            const vId = item.snippet?.resourceId?.videoId;
            if (vId && videoDetailsMap[vId]) {
              totalSecs += iso8601ToSeconds(videoDetailsMap[vId].duration);
            }
          });
          const customDuration = formatSecondsToDuration(totalSecs);

          // Get first video's upload date as group upload date
          const firstVId = groupItems[0]?.snippet?.resourceId?.videoId;
          const uploadDate = (firstVId && videoDetailsMap[firstVId]?.publishedAt) || new Date().toISOString();

          newEpisodes.push({
            number: rangeIdx + 1,
            title: title,
            url: "", // Leave Server 1 empty
            thumbnail: thumb,
            duration: customDuration,
            updatedAt: uploadDate,
            servers: mergeServers([], epUrl),
          });
        });
      } else {
        // Direct All Playlist mode
        let epNumber = 1;
        for (let i = 0; i < validItems.length; i++) {
          const item = validItems[i];
          const videoId = item.snippet?.resourceId?.videoId;
          if (!videoId) continue;
          
          let title = item.snippet?.title || `Episode ${epNumber}`;
          const epUrl = `https://www.youtube.com/embed/${videoId}?list=${listId}`;
          const thumb =
            item.snippet?.thumbnails?.maxres?.url ||
            item.snippet?.thumbnails?.high?.url ||
            item.snippet?.thumbnails?.medium?.url ||
            item.snippet?.thumbnails?.default?.url ||
            `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

          // Get duration & upload date from details map
          const details = videoDetailsMap[videoId];
          const itemDuration = details ? parseISO8601Duration(details.duration) : "24m";
          const uploadDate = details?.publishedAt || new Date().toISOString();
            
          newEpisodes.push({
            number: epNumber,
            title: title,
            url: "", // Leave Server 1 empty
            thumbnail: thumb,
            duration: itemDuration,
            updatedAt: uploadDate,
            servers: mergeServers([], epUrl),
          });
          
          epNumber++;
          if (newEpisodes.length >= countToFetch) break;
        }

        if (importReverse) {
          newEpisodes.reverse();
          newEpisodes.forEach((ep, idx) => {
            ep.number = idx + 1;
          });
        }
      }

      const existing = editing.episodes || [];
      let updatedEpisodes = [...existing];

      if (playlistConflictMode === "timpa") {
        newEpisodes.forEach((newEp) => {
          const idx = updatedEpisodes.findIndex((ep: any) => ep.number === newEp.number);
          if (idx !== -1) {
            // Overwrite existing episode with merge strategy
            const oldEp = updatedEpisodes[idx];
            
            // Get YouTube embed URL from newEp's servers
            const newYoutubeEmbed = newEp.servers?.find((s: any) => s.name?.toLowerCase() === "youtube")?.embedUrl || "";

            updatedEpisodes[idx] = {
              ...oldEp,
              title: oldEp.title || newEp.title,
              thumbnail: oldEp.thumbnail || newEp.thumbnail, // CRITICAL: NEVER overwrite existing thumbnail
              url: oldEp.url || "", // CRITICAL: DO NOT delete or overwrite existing main URL (Server 1)
              duration: oldEp.duration || newEp.duration,
              updatedAt: oldEp.updatedAt || newEp.updatedAt,
              servers: mergeServers(oldEp.servers, newYoutubeEmbed), // Merge into Server 2 (YouTube in servers list)
            };
          } else {
            // Episode doesn't exist, append it
            updatedEpisodes.push(newEp);
          }
        });
        
        // Sort episodes by episode number
        updatedEpisodes.sort((a: any, b: any) => a.number - b.number);
      } else {
        // "tambah" mode (Append / Add)
        updatedEpisodes = [...existing, ...newEpisodes];
      }

      setEditing({
        ...editing,
        episodes: updatedEpisodes,
      });

      setPlaylistUrl("");
      setIsPlaylistImportOpen(false);
      setIsUploading(false);
      toast(
        `Generated ${newEpisodes.length} episodes! Click SAVE CHANGES to sync to cloud.`,
        "success",
      );

    } catch (error: any) {
      console.error("YouTube API Error:", error);
      toast(error.message || "An error occurred fetching the playlist.", "error");
      setIsUploading(false);
    }
  };

  const formatGenre = (g: string) =>
    g ? g.trim().charAt(0).toUpperCase() + g.trim().slice(1).toLowerCase() : "";

  const handleJsonImport = async () => {
    if (!jsonInput.trim()) {
      toast("Please paste JSON data first!", "error");
      return;
    }

    setIsUploading(true);
    try {
      let data = JSON.parse(jsonInput);
      if (!Array.isArray(data)) {
        data = [data];
      }

      let successCount = 0;
      const now = serverTimestamp();

      for (const item of data) {
        if (!item.title) continue;

        const id = String(item.id || doc(collection(db, "content")).id)
          .trim()
          .toLowerCase()
          .replace(/ /g, "-");

        const finalItem = {
          ...item,
          id,
          type: item.type || (item.kind === "tv" ? "tv" : "movie"),
          kind: item.kind || (item.type === "tv" ? "tv" : "movie"),
          genres: Array.isArray(item.genres)
            ? item.genres.map(formatGenre).filter(Boolean)
            : [],
          createdAt: item.createdAt || now,
          updatedAt: now,
          views: item.views || 0,
          year: item.releaseDate
            ? new Date(item.releaseDate).getFullYear()
            : new Date().getFullYear(),
        };

        if (finalItem.genres.length > 0) {
          const newGlobalGenres = [
            ...new Set([...genres, ...finalItem.genres]),
          ];
          if (newGlobalGenres.length > genres.length) {
            await saveGenres(newGlobalGenres);
          }
        }

        await setDoc(doc(db, "content", id), finalItem, { merge: true });
        successCount++;
      }

      toast(`Successfully imported ${successCount} items!`, "success");
      setJsonInput("");
      setIsJsonImportOpen(false);
    } catch (e: any) {
      toast("Invalid JSON format or upload error: " + e.message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070404] text-white flex relative">
      <AnimatePresence>
        {isQuickLinksOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: -20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: -20 }}
            className="fixed top-24 left-4 right-4 sm:left-64 sm:right-auto sm:ml-4 sm:w-80 bg-[#0d0707] border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col z-[9999]"
          >
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-red-500" />
                <h4 className="text-xs font-black uppercase tracking-widest">
                  Link Library
                </h4>
              </div>
              <button
                onClick={() => setIsQuickLinksOpen(false)}
                className="text-white/20 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto p-3 space-y-2 custom-scroll">
              {quickLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center gap-2 p-2 rounded-xl bg-white/5 group/link border border-white/5 hover:border-red-500/30 transition-all"
                >
                  <a href={link.url} target="_blank" className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      {link.name}
                    </p>
                    <p className="text-[9px] text-white/20 truncate">
                      {link.url}
                    </p>
                  </a>
                  <button
                    onClick={() => deleteQuickLink(link.id)}
                    className="p-1.5 rounded-lg text-white/10 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover/link:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {quickLinks.length === 0 && (
                <div className="py-8 text-center text-white/20">
                  <ExternalLink className="w-8 h-8 mx-auto mb-2 opacity-10" />
                  <p className="text-[10px] font-medium uppercase tracking-widest">
                    No links yet
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/5 space-y-3 bg-black/40">
              <div className="space-y-2">
                <input
                  value={newQuickLink.name}
                  onChange={(e) =>
                    setNewQuickLink({
                      ...newQuickLink,
                      name: e.target.value,
                    })
                  }
                  placeholder="Link Title (e.g. YouTube Source)"
                  className="w-full h-9 bg-white/5 border border-white/10 rounded-xl px-3 text-xs outline-none focus:border-red-500/50 transition-all"
                />
                <input
                  value={newQuickLink.url}
                  onChange={(e) =>
                    setNewQuickLink({
                      ...newQuickLink,
                      url: e.target.value,
                    })
                  }
                  placeholder="https://..."
                  className="w-full h-9 bg-white/5 border border-white/10 rounded-xl px-3 text-xs outline-none focus:border-red-500/50 transition-all font-mono"
                />
              </div>
              <button
                onClick={saveQuickLink}
                className="w-full h-10 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase shadow-lg shadow-red-900/40 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Save Link
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSearchingSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-10"
          >
            <div
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
              onClick={() => setIsSearchingSettings(false)}
            />

            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0a0505] rounded-[2rem] border border-white/10 shadow-3xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-600/20 flex items-center justify-center">
                      <Search className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <h3 className="font-black text-lg uppercase tracking-tight">
                        Admin Quick Search
                      </h3>
                      <p className="text-[10px] text-white/40 font-medium uppercase tracking-widest">
                        Find settings, actions, or modules
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsSearchingSettings(false)}
                    className="p-2 rounded-lg hover:bg-white/5 text-white/20 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                  <input
                    autoFocus
                    value={adminSearchQuery}
                    onChange={(e) => setAdminSearchQuery(e.target.value)}
                    placeholder="Search for: SEO, Discord, Ads, Maintenance, Genre..."
                    className="w-full h-14 bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 text-white placeholder:text-white/20 outline-none focus:border-red-500/50 transition-all font-medium"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setIsSearchingSettings(false);
                    }}
                  />
                  {adminSearchQuery && (
                    <button
                      onClick={() => setAdminSearchQuery("")}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {[
                  {
                    label: "Branding & SEO",
                    keywords: [
                      "seo",
                      "title",
                      "description",
                      "logo",
                      "brand",
                      "footer",
                      "branding",
                    ],
                    tab: "settings",
                  },
                  {
                    label: "Social Community",
                    keywords: [
                      "discord",
                      "community",
                      "social",
                      "contact",
                      "email",
                    ],
                    tab: "settings",
                  },
                  {
                    label: "Advertisements",
                    keywords: [
                      "ads",
                      "advertisement",
                      "banner",
                      "internal",
                      "floating",
                    ],
                    tab: "settings",
                  },
                  {
                    label: "Maintenance Mode",
                    keywords: ["maintenance", "lock", "offline"],
                    tab: "settings",
                  },
                  {
                    label: "Content Tags & Genres",
                    keywords: [
                      "genre",
                      "category",
                      "collection",
                      "tags",
                      "new",
                      "hot",
                    ],
                    tab: "content",
                  },
                  {
                    label: "Download Tutorials",
                    keywords: ["tutorial", "guide", "download", "linkvertise"],
                    tab: "settings",
                  },
                  {
                    label: "Notifications & Broadcast",
                    keywords: [
                      "broadcast",
                      "notification",
                      "bell",
                      "push",
                      "message",
                    ],
                    tab: "notifications",
                  },
                  {
                    label: "Content Management",
                    keywords: [
                      "content",
                      "movie",
                      "tv",
                      "series",
                      "upload",
                      "edit",
                    ],
                    tab: "content",
                  },
                  {
                    label: "User Management",
                    keywords: ["user", "member", "ban", "ultra"],
                    tab: "users",
                  },
                  {
                    label: "Reported Items",
                    keywords: ["report", "flag", "violation"],
                    tab: "reports",
                  },
                  {
                    label: "System Information",
                    keywords: [
                      "system",
                      "info",
                      "database",
                      "firebase",
                      "token",
                    ],
                    tab: "system",
                  },
                ]
                  .filter((item) => {
                    if (!adminSearchQuery) return false;
                    const query = adminSearchQuery.toLowerCase();
                    return (
                      item.label.toLowerCase().includes(query) ||
                      item.keywords.some((k) => k.includes(query))
                    );
                  })
                  .map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setActiveTab(result.tab as any);
                        setIsSearchingSettings(false);
                        setAdminSearchQuery("");
                      }}
                      className="w-full p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/5 hover:border-red-500/30 transition-all text-left flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-red-600/10 transition-colors">
                          <Sparkles className="w-4 h-4 text-white/40 group-hover:text-red-500" />
                        </div>
                        <div>
                          <h4 className="font-medium text-sm text-white group-hover:text-red-400 transition-colors">
                            {result.label}
                          </h4>
                          <p className="text-[10px] text-white/20 uppercase tracking-widest font-black mt-0.5">
                            Found in {result.tab} Tab
                          </p>
                        </div>
                      </div>
                      <ArrowLeft className="w-4 h-4 rotate-180 text-white/20 group-hover:text-white transition-all transform translate-x-0 group-hover:translate-x-1" />
                    </button>
                  ))}

                {!adminSearchQuery && (
                  <div className="h-full flex flex-col items-center justify-center py-20 text-center">
                    <Search className="w-12 h-12 text-white/5 mb-4" />
                    <p className="text-sm text-white/40 font-medium">
                      Type something to search...
                    </p>
                    <div className="flex gap-2 mt-4">
                      {["SEO", "Ads", "Users", "Genre"].map((tag) => (
                        <button
                          key={tag}
                          onClick={() => setAdminSearchQuery(tag)}
                          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white hover:bg-white/10"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-black/40 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4 text-[9px] font-black text-white/20 uppercase tracking-widest">
                  Admin Dashboard Helper
                </div>
                <div className="text-[9px] font-black text-red-500/40 uppercase tracking-widest">
                  Press ESC to Exit
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Loading Overlay */}
      <AnimatePresence>
        {isUploading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md"
          >
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-red-500/10 border-t-red-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-red-500 animate-spin-slow" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-medium text-white uppercase tracking-tighter flex items-center justify-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-red-500" />
                  Syncing with Cloud
                </h3>
                <p className="text-xs text-white/40 font-medium uppercase tracking-widest mt-2 flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3" /> Please wait while we update your
                  database...
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Nav Overlay */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileNavOpen(false)}
          />
          <aside className="w-64 bg-[#0a0505] flex flex-col h-screen relative z-10 border-r border-white/5">
            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <img
                  src={settings?.brandLogo || BRAND_LOGO_URL}
                  alt={BRAND_NAME}
                  className="h-8 w-auto"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsQuickLinksOpen(!isQuickLinksOpen)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all border ${
                      isQuickLinksOpen
                        ? "bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/40"
                        : "bg-white/5 text-white/40 hover:text-white border-white/10 hover:border-red-500/30"
                    }`}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsSearchingSettings(true)}
                    className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 group active:scale-95 transition-all"
                  >
                    <Search className="w-4 h-4 group-hover:text-red-500" />
                  </button>
                </div>
              </div>
              <button
                onClick={() => setIsMobileNavOpen(false)}
                className="text-white/40 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav
              className="flex-1 p-4 space-y-2 overflow-y-auto"
              style={{ scrollbarWidth: "none" }}
            >
              {[
                { id: "content", label: "Manage Content", icon: Film },
                { id: "notifications", label: "Broadcast", icon: Bell },
                { id: "hero", label: "Hero Management", icon: Trophy },
                { id: "web", label: "Manage Web", icon: Globe },
                { id: "genres", label: "Genre Manage", icon: ListFilter },
                { id: "comments", label: "Comments", icon: MessageSquare },
                { id: "users", label: "Users", icon: Users },
                { id: "reports", label: "Comment Report", icon: Flag },
                { id: "bugs", label: "Bug Reports", icon: AlertTriangle },
                { id: "settings", label: "Settings", icon: Settings },
                { id: "system", label: "System Info", icon: RefreshCw },
                { id: "tools", label: "Tools", icon: RefreshCw },
                {
                  id: "assets",
                  label: "Asset Management",
                  icon: Folder,
                  ownerOnly: true,
                },
              ]
                .filter((tab) => !tab.ownerOnly || isOwner)
                .map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setIsMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? "bg-red-600/10 text-red-400 border border-red-500/20"
                        : "text-white/40 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <tab.icon className="w-4 h-4 text-red-500" />
                    <span className="font-semibold">{tab.label}</span>
                  </button>
                ))}
            </nav>

            <div className="p-4 border-t border-white/5 space-y-2 shrink-0">
              <div
                className={`px-4 py-2 mb-2 text-[10px] font-black rounded-lg border text-center uppercase tracking-widest flex items-center justify-center gap-2 ${
                  connectionStatus === "online"
                    ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                    : connectionStatus === "offline"
                      ? "text-red-400 bg-red-400/10 border-red-400/20 animate-pulse"
                      : "text-white/20 bg-white/5 border-white/10"
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    connectionStatus === "online"
                      ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                      : "bg-red-500"
                  }`}
                />
                Cloud: {connectionStatus}
              </div>
              {isOwner && (
                <a
                  href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId || "(default)"}/data`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-orange-400/80 hover:text-orange-400 hover:bg-orange-500/10 transition-all border border-orange-500/10"
                >
                  <Layers className="w-4 h-4" />
                  Manage Firebase
                </a>
              )}
              <button
                onClick={onExit}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Exit to Site
              </button>
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400/60 hover:text-red-400 hover:bg-red-500/5 transition-all"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-[#0a0505] hidden lg:flex flex-col sticky top-0 h-screen z-10">
        <div className="p-6 border-b border-white/5 flex items-center gap-2 shrink-0">
          <img
            src={settings?.brandLogo || BRAND_LOGO_URL}
            alt={BRAND_NAME}
            className="h-8 w-auto"
          />
          <div className="ml-auto flex items-center gap-2">
            <div className="relative group/ql">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsQuickLinksOpen(!isQuickLinksOpen)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all border ${
                  isQuickLinksOpen
                    ? "bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/40"
                    : "bg-white/5 text-white/40 hover:text-white border-white/10 hover:border-red-500/30"
                }`}
                title="Link Library"
              >
                <ExternalLink
                  className={`w-4 h-4 ${isQuickLinksOpen ? "animate-pulse" : ""}`}
                />
              </motion.button>
            </div>

            <button
              onClick={() => setIsSearchingSettings(true)}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-red-500 hover:bg-white/10 transition-all group"
              title="Search Settings"
            >
              <Search className="w-4 h-4 group-active:scale-95 transition-transform" />
            </button>
          </div>
        </div>

        <nav
          className="flex-1 p-4 space-y-2 overflow-y-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {[
            { id: "content", label: "Manage Content", icon: Film },
            { id: "hero", label: "Hero Management", icon: Trophy },
            { id: "web", label: "Manage Web", icon: Globe },
            { id: "genres", label: "Genre Manage", icon: ListFilter },
            { id: "comments", label: "Comments", icon: MessageSquare },
            { id: "users", label: "Users", icon: Users },
            { id: "reports", label: "Comment Report", icon: Flag },
            { id: "bugs", label: "Bug Reports", icon: AlertTriangle },
            { id: "settings", label: "Settings", icon: Settings },
            { id: "system", label: "System Info", icon: RefreshCw },
            { id: "tools", label: "Tools", icon: RefreshCw },
            {
              id: "assets",
              label: "Asset Management",
              icon: Folder,
              ownerOnly: true,
            },
          ]
            .filter((tab) => !tab.ownerOnly || isOwner)
            .map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                  activeTab === tab.id
                    ? "bg-red-600/10 text-red-400 border border-red-500/20 font-medium"
                    : "text-white/40 hover:text-white hover:bg-white/5 font-medium"
                }`}
              >
                <tab.icon
                  className={`w-4 h-4 ${activeTab === tab.id ? "text-red-500" : "text-white/40"}`}
                />
                {tab.label}
              </button>
            ))}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-2 shrink-0">
          <div
            className={`px-4 py-2 mb-2 text-[10px] font-black rounded-lg border text-center uppercase tracking-widest flex items-center justify-center gap-2 ${
              connectionStatus === "online"
                ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                : connectionStatus === "offline"
                  ? "text-red-400 bg-red-400/10 border-red-400/20 animate-pulse"
                  : "text-white/20 bg-white/5 border-white/10"
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                connectionStatus === "online"
                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                  : "bg-red-500"
              }`}
            />
            Cloud: {connectionStatus}
          </div>
          {isOwner && (
            <a
              href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId || "(default)"}/data`}
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-orange-400/80 hover:text-orange-400 hover:bg-orange-500/10 transition-all border border-orange-500/10"
            >
              <Layers className="w-4 h-4" />
              Manage Firebase
            </a>
          )}
          <button
            onClick={onExit}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Exit to Site
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400/60 hover:text-red-400 hover:bg-red-500/5 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-white/5 bg-[#0a0505]/50 backdrop-blur-xl px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileNavOpen(true)}
              className="lg:hidden text-white/60 hover:text-white p-1"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-black uppercase tracking-widest text-white/40">
              {activeTab === "content"
                ? "Movie & TV Manager"
                : activeTab === "hero"
                  ? "Hero Slots Manager"
                  : activeTab === "web"
                    ? "Web Management"
                    : activeTab === "settings"
                      ? "Global Web Settings"
                      : activeTab === "notifications"
                        ? "Broadcast & Notifications"
                        : activeTab === "tools"
                          ? "Subtitle Tools"
                          : "Admin Panel"}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onExit}
              className="lg:hidden h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-white/60 text-[10px] font-black hover:bg-white/10 hover:text-white transition-all flex items-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              EXIT
            </button>
            {activeTab === "content" && (
              <>
                <button
                  onClick={seedAnimationData}
                  className="hidden md:flex h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-white/60 text-[10px] font-black hover:bg-white/10 hover:text-white transition-all items-center gap-2"
                >
                  <Upload className="w-3.5 h-3.5" />
                  SEED
                </button>
                {(() => {
                  try {
                    const drafts = JSON.parse(
                      localStorage.getItem("vinet_local_drafts") || "[]",
                    );
                    if (drafts.length > 0) {
                      return (
                        <button
                          onClick={async () => {
                            setIsUploading(true);
                            let successCount = 0;
                            let failCount = 0;
                            try {
                              for (const draft of drafts) {
                                await setDoc(
                                  doc(db, "content", draft.id),
                                  draft,
                                  { merge: true },
                                );
                                successCount++;
                              }
                              if (successCount === drafts.length) {
                                localStorage.removeItem("vinet_local_drafts");
                                toast(
                                  `Successfully uploaded ${successCount} drafts!`,
                                  "success",
                                );
                              } else {
                                toast(
                                  `Uploaded ${successCount}, failed ${failCount}`,
                                  "error",
                                );
                              }
                            } catch (e: any) {
                              toast(
                                "Draft upload failed: " + e.message,
                                "error",
                              );
                            } finally {
                              setIsUploading(false);
                            }
                          }}
                          className="h-10 px-4 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/50 text-xs font-black shadow-lg shadow-orange-900/40 hover:bg-orange-500/30 active:scale-95 transition-all flex items-center gap-2 relative"
                        >
                          <Upload className="w-4 h-4" />
                          <span className="hidden sm:inline">SYNC DRAFTS</span>
                          <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                            {drafts.length}
                          </span>
                        </button>
                      );
                    }
                  } catch (e) {}
                  return null;
                })()}
                <button
                  onClick={() =>
                    setEditing({
                      type: "movie",
                      genres: [],
                      isNew: true,
                      isTrending: false,
                      servers: [
                        { name: "YouTube", embedUrl: "" },
                        { name: "Hydrax", embedUrl: "" },
                        { name: "TurboVIP", embedUrl: "" },
                        { name: "Dailymotion", embedUrl: "" },
                      ],
                    })
                  }
                  className="h-10 px-4 sm:px-6 rounded-xl bg-gradient-to-r from-red-600 to-orange-500 text-white text-xs font-black shadow-lg shadow-red-900/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">CREATE NEW</span>
                  <span className="sm:hidden">NEW</span>
                </button>
              </>
            )}
          </div>
        </header>

        <div className="p-4 sm:p-8">
          <AnimatePresence>
            {activeTab === "content" ? (
              <motion.div
                key="content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Filters Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { id: "all", label: "All Content" },
                      { id: "released_movie", label: "Released Movies" },
                      { id: "released_tv", label: "Released TV" },
                      { id: "coming_soon_movie", label: "Coming Soon Movies" },
                      { id: "coming_soon_tv", label: "Coming Soon TV" },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setContentFilter(f.id as any)}
                        className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                          contentFilter === f.id
                            ? "bg-red-600 text-white shadow-lg shadow-red-900/40"
                            : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsJsonImportOpen(!isJsonImportOpen)}
                      className={`h-10 px-4 rounded-xl border flex items-center gap-2 text-xs font-medium transition-all ${isJsonImportOpen ? "bg-orange-600 border-orange-500 text-white" : "bg-white/5 border-white/10 text-white/40 hover:text-white"}`}
                    >
                      <Upload className="w-4 h-4" />
                      IMPORT JSON
                    </button>
                    <button
                      onClick={() =>
                        setShowAutoTagSettings(!showAutoTagSettings)
                      }
                      className={`h-10 px-4 rounded-xl border flex items-center gap-2 text-xs font-medium transition-all ${showAutoTagSettings ? "bg-red-600 border-red-500 text-white" : "bg-white/5 border-white/10 text-white/40 hover:text-white"}`}
                    >
                      <Settings className="w-4 h-4" />
                      CONTENT SETTINGS
                    </button>
                  </div>
                </div>

                {isJsonImportOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-4 overflow-hidden"
                  >
                    <div className="space-y-1">
                      <h4 className="text-xs font-black uppercase tracking-widest text-white">
                        Import Content from JSON
                      </h4>
                      <p className="text-[10px] text-white/30">
                        Paste your JSON data below. It can be a single object or
                        an array of objects.
                      </p>
                    </div>
                    <textarea
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                      placeholder='[ { "title": "Example", "type": "movie", ... } ]'
                      className="w-full h-48 bg-black/40 border border-white/10 rounded-2xl p-4 text-xs font-mono outline-none focus:border-orange-500 transition-all resize-none"
                    />
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setIsJsonImportOpen(false)}
                        className="px-6 py-2 rounded-xl text-xs font-medium text-white/40 hover:text-white transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleJsonImport}
                        className="px-6 py-2 rounded-xl bg-orange-600 text-white text-xs font-black shadow-lg shadow-orange-900/40 hover:bg-orange-500 transition-all"
                      >
                        RUN IMPORT
                      </button>
                    </div>
                  </motion.div>
                )}

                {showAutoTagSettings && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-6 overflow-hidden"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/5">
                      <div className="space-y-1">
                        <h4 className="text-xs font-black uppercase tracking-widest text-white">
                          Auto "NEW" Tag Logic
                        </h4>
                        <p className="text-[10px] text-white/30">
                          Automatically marks the latest{" "}
                          {ultraSettings.newTagLimit} movies/TV as "NEW" based
                          on release date.
                        </p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-white/40 uppercase">
                            Limit
                          </span>
                          <input
                            type="number"
                            value={ultraSettings.newTagLimit || ""}
                            onChange={(e) =>
                              saveUltraSettings({
                                newTagLimit: parseInt(e.target.value) || 5,
                              })
                            }
                            className="w-16 h-9 bg-black/40 border border-white/10 rounded-lg px-3 text-xs text-center outline-none focus:border-red-500"
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-white/40 uppercase">
                            Status
                          </span>
                          <button
                            onClick={() =>
                              saveUltraSettings({
                                autoTagNew: !ultraSettings.autoTagNew,
                              })
                            }
                            className={`w-12 h-6 rounded-full transition-all relative ${ultraSettings.autoTagNew ? "bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.4)]" : "bg-white/10"}`}
                          >
                            <div
                              className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${ultraSettings.autoTagNew ? "left-7" : "left-1"}`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-widest text-white">
                            Genres Collection
                          </h4>
                          <p className="text-[10px] text-white/30">
                            Manage global genres available for content.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {genres.map((g) => (
                            <span
                              key={g}
                              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                            >
                              {g}
                              <button
                                onClick={() =>
                                  saveGenres(genres.filter((x) => x !== g))
                                }
                                className="text-white/20 hover:text-red-500"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                          <input
                            placeholder="+ Add Genre..."
                            className="w-24 h-7 bg-black/40 border border-white/10 rounded-lg px-2 text-[10px] outline-none focus:border-red-500/50"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const val = formatGenre(
                                  e.currentTarget.value.trim(),
                                );
                                if (val && !genres.includes(val)) {
                                  saveGenres([...genres, val]);
                                  e.currentTarget.value = "";
                                }
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-widest text-white">
                            Custom Tags Collection
                          </h4>
                          <p className="text-[10px] text-white/30">
                            Manage tags like NEW, HOT, HD, KIDS, etc.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {tags.map((t) => (
                            <span
                              key={t}
                              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                            >
                              {t}
                              <button
                                onClick={() =>
                                  saveTags(tags.filter((x) => x !== t))
                                }
                                className="text-white/20 hover:text-red-500"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                          <input
                            placeholder="+ Add Tag..."
                            className="w-24 h-7 bg-black/40 border border-white/10 rounded-lg px-2 text-[10px] outline-none focus:border-red-500/50"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const val = e.currentTarget.value
                                  .trim()
                                  .toUpperCase();
                                if (val && !tags.includes(val)) {
                                  saveTags([...tags, val]);
                                  e.currentTarget.value = "";
                                }
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Search Bar */}
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-red-600/20 to-orange-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  <div className="relative flex items-center h-12 bg-white/5 border border-white/10 rounded-2xl px-4">
                    <Search className="w-5 h-5 text-white/30" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by title, ID..."
                      className="flex-1 bg-transparent border-none focus:outline-none px-3 text-sm text-white placeholder:text-white/20"
                    />
                    {search && (
                      <button
                        onClick={() => setSearch("")}
                        className="text-white/30 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Main Content Area */}
                {!editing ? (
                  <div
                    key="list-view"
                    className="space-y-6"
                    style={{ animation: "fade-in 0.3s" }}
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                      {filtered.slice(0, contentLimit).map((item, idx) => (
                        <div
                          key={`admin-content-grid-${idx}`}
                          className="group flex flex-col rounded-2xl border transition-all bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10 overflow-hidden"
                        >
                          <div className="relative aspect-[2/3] w-full bg-white/5 shrink-0">
                            {item.poster ? (
                              <img
                                src={item.poster || undefined}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center opacity-20">
                                <Image className="w-8 h-8" />
                              </div>
                            )}
                            <div className="absolute top-3 right-3 flex items-center gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setEditing(item)}
                                className="w-9 h-9 rounded-xl bg-black/60 hover:bg-black/90 flex items-center justify-center text-white/90 hover:text-white border border-white/20 backdrop-blur-md transition-all shadow-xl"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteContent(String(item.id))}
                                className="w-9 h-9 rounded-xl bg-red-600/60 hover:bg-red-600/90 flex items-center justify-center text-white border border-red-500/50 backdrop-blur-md transition-all shadow-xl"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="p-4 flex-1 flex flex-col min-w-0">
                            <div className="flex items-start justify-between gap-3 mb-1">
                              <h3 className="font-black text-sm line-clamp-2 leading-tight">
                                {item.title}
                              </h3>
                              <span
                                className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase ${item.type === "movie" ? "bg-red-600/20 text-red-400" : "bg-orange-500/20 text-orange-400"}`}
                              >
                                {item.type}
                              </span>
                            </div>
                            <p className="text-[10px] text-white/30 font-mono mb-3 truncate">
                              ID: {item.id}
                            </p>

                            <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-white/40">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />{" "}
                                {item.releaseDate}
                              </span>
                              <span className="flex items-center gap-1">
                                <Star className="w-3.5 h-3.5 text-orange-500" />{" "}
                                {item.rating}
                              </span>
                              {item.isNew && (
                                <span className="text-red-400 font-medium uppercase tracking-tighter">
                                  NEW
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {contentLimit < filtered.length && (
                      <div className="flex justify-center pt-4 border-t border-white/5">
                        <button
                          onClick={() => setContentLimit((limit) => limit + 12)}
                          className="px-8 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                        >
                          Show More ({filtered.length - contentLimit} remaining)
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div
                      key="editor-view"
                      className="rounded-3xl border border-white/10 bg-[#0d0707] shadow-2xl overflow-hidden w-full flex flex-col"
                      style={{
                        maxHeight: "calc(100vh - 120px)",
                        animation: "fade-in-up 0.4s",
                      }}
                    >
                      <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0 font-sans">
                        <div className="flex items-center gap-4 flex-wrap">
                          <h3 className="font-black text-sm uppercase tracking-widest transition-all text-white/95">
                            {editing.id ? "Edit Content" : "New Content"}
                          </h3>
                          <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditorMode("visual");
                                setJsonError(null);
                              }}
                              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                editorMode === "visual"
                                  ? "bg-red-600 text-white shadow-md shadow-red-900/20"
                                  : "text-white/40 hover:text-white/80"
                              }`}
                            >
                              Visual Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                      setEditorMode("json");
                                      setJsonText(serializeEditing(editing));
                                      setJsonError(null);
                                    }}
                              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                      editorMode === "json"
                                        ? "bg-red-600 text-white shadow-md shadow-red-900/20"
                                        : "text-white/40 hover:text-white/80"
                                    }`}
                            >
                              JSON Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsViyieConfigOpen(true)}
                              className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-red-400 hover:text-white hover:bg-red-600/20 border border-red-500/20 flex items-center gap-1.5 shadow-sm ml-2"
                            >
                              <Sliders className="w-3 h-3 text-red-500" />
                              ViyiePlayer Config
                            </button>
                          </div>

                          {editing.views !== undefined && (
                            <div
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-black/40 text-[10px] font-medium uppercase tracking-widest rounded-xl border border-white/10 shrink-0 select-none cursor-default ml-2"
                              title="Total Views"
                            >
                              <Eye className="w-3.5 h-3.5 text-sky-400" />
                              <span className="leading-none mt-0.5 text-white/80">
                                {editing.views || 0}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {existingPagesForEditing.length > 1 && (
                            <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10 mr-1">
                              {existingPagesForEditing.map((pg) => {
                                const isActive =
                                  (pg.isMain && !isEditingSubPage) ||
                                  (!pg.isMain && editing.id === pg.id);
                                return (
                                  <button
                                    key={pg.pageKey}
                                    type="button"
                                    onClick={async () => {
                                      const found = contents.find(
                                        (c) => c.id === pg.id,
                                      );
                                      if (found) {
                                        setEditing(found);
                                        if (editorMode === "json") {
                                          setJsonText(serializeEditing(found));
                                        }
                                      }
                                    }}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                      isActive
                                        ? "bg-red-600 text-white shadow-md shadow-red-900/20"
                                        : "text-white/40 hover:text-white/80"
                                    }`}
                                  >
                                    {pg.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <button
                            onClick={() => setEditing(null)}
                            className="text-white/30 hover:text-white shrink-0 p-1 hover:bg-white/5 rounded-lg transition-all"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scroll">
                        {editorMode === "visual" ? (
                          <>
                            {!isEditingSubPage && (
                              <>
                                {/* IMDb Import */}
                                <div className="hidden p-5 bg-gradient-to-br from-red-600/10 to-transparent border border-red-500/20 rounded-2xl space-y-4 shadow-xl">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-4 bg-red-600 rounded-full" />
                                      <p className="text-[10px] font-black text-white/80 uppercase tracking-widest">
                                        IMDb Auto-Fill
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-yellow-500/20 rounded text-[8px] font-black text-yellow-500 uppercase tracking-widest border border-yellow-500/20">
                                      Powered by TMDB
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <div className="relative flex-1">
                                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                                      <input
                                        value={imdbIdInput}
                                        onChange={(e) =>
                                          setImdbIdInput(e.target.value)
                                        }
                                        placeholder="Enter IMDb ID (tt1234567) or paste URL"
                                        className="w-full h-11 bg-black/60 border border-white/5 pl-10 pr-4 rounded-xl text-xs outline-none focus:border-red-500/50 transition-all font-medium"
                                        onKeyDown={(e) =>
                                          e.key === "Enter" &&
                                          autoFillFromImdb()
                                        }
                                      />
                                    </div>
                                    <button
                                      onClick={autoFillFromImdb}
                                      disabled={isAutoFilling}
                                      className="h-11 px-6 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase shadow-lg shadow-red-900/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                      {isAutoFilling ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Sparkles className="w-4 h-4" />
                                      )}
                                      <span>AUTO FILL</span>
                                    </button>
                                  </div>
                                  <p className="text-[9px] text-white/30 font-medium ml-1 flex items-center gap-2">
                                    <AlertCircle className="w-3 h-3 text-red-500/40" />
                                    Automatically fetches title, date, synopsis,
                                    rating, duration, and cast.
                                  </p>
                                </div>

                                {/* Diagnostics & Auto-Fix Widget */}
                                {(() => {
                                  const required = [
                                    "YouTube",
                                    "Hydrax",
                                    "TurboVIP",
                                    "Dailymotion",
                                  ];
                                  const curSrvs = editing.servers || [];
                                  const missingSrvs = required.filter(
                                    (name) =>
                                      !curSrvs.some(
                                        (s) =>
                                          s.name &&
                                          s.name.toLowerCase() ===
                                            name.toLowerCase(),
                                      ),
                                  );
                                  const hasBadType =
                                    !editing.type ||
                                    (editing.type !== "movie" &&
                                      editing.type !== "tv");
                                  const totalMissing = missingSrvs.length;

                                  return (
                                    <div className="p-4 bg-[#140b0b] border border-red-500/20 rounded-2xl space-y-3 shadow-xl">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="flex h-2 w-2 relative">
                                            <span
                                              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${totalMissing > 0 || hasBadType ? "bg-red-500" : "bg-emerald-500"}`}
                                            ></span>
                                            <span
                                              className={`relative inline-flex rounded-full h-2 w-2 ${totalMissing > 0 || hasBadType ? "bg-red-500" : "bg-emerald-500"}`}
                                            ></span>
                                          </span>
                                          <span className="text-[10px] font-black uppercase text-white/80 tracking-wider">
                                            System Structure & Player
                                            Diagnostics
                                          </span>
                                        </div>
                                        <span
                                          className={`text-[8px] font-extrabold px-2 py-0.5 rounded uppercase tracking-widest ${totalMissing > 0 || hasBadType ? "bg-red-500/15 text-red-500 border border-red-500/10" : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/10"}`}
                                        >
                                          {totalMissing > 0 || hasBadType
                                            ? "ACTION REQUIRED"
                                            : "STATUS OPTIMAL"}
                                        </span>
                                      </div>

                                      <p className="text-[10px] leading-relaxed text-white/50">
                                        {totalMissing > 0 || hasBadType ? (
                                          <>
                                            This content has missing or
                                            misconfigured elements. It is
                                            missing{" "}
                                            <span className="text-red-400 font-medium">
                                              {totalMissing} essential server
                                              player(s)
                                            </span>
                                            {missingSrvs.length > 0 &&
                                              ` (${missingSrvs.join(", ")})`}
                                            . Run Auto Fix to restore standard
                                            players instantly.
                                          </>
                                        ) : (
                                          "All standard server players (YouTube, Hydrax, TurboVIP, Dailymotion) are loaded and active under this content."
                                        )}
                                      </p>

                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => runAutoFix()}
                                          className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                                            totalMissing > 0 || hasBadType
                                              ? "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/30 scale-100 hover:scale-[1.01] active:scale-95"
                                              : "bg-white/5 text-white/40 border border-white/5 hover:bg-white/10 hover:text-white"
                                          }`}
                                        >
                                          <RefreshCw
                                            className={`w-3.5 h-3.5 ${totalMissing > 0 || hasBadType ? "animate-spin" : ""}`}
                                          />
                                          <span>
                                            üîß FORCE AUTO-FIX STRUCTURE &
                                            SERVERS
                                          </span>
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* Basics */}
                                {!isEditingSubPage && (
                                  <>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-white/40 uppercase">
                                          Type
                                        </label>
                                        <div className="flex bg-white/5 rounded-xl p-1 border border-white/5">
                                          {["movie", "tv"].map((t) => (
                                            <button
                                              key={t}
                                              onClick={() =>
                                                setEditing({
                                                  ...editing,
                                                  type: t as any,
                                                  kind: t as any,
                                                })
                                              }
                                              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                                                editing.type === t
                                                  ? "bg-white/10 text-white"
                                                  : "text-white/30"
                                              }`}
                                            >
                                              {t}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-white/40 uppercase">
                                          Release
                                        </label>
                                        <div className="flex bg-white/5 rounded-xl p-1 border border-white/5">
                                          {[
                                            {
                                              id: "released",
                                              label: "Released",
                                            },
                                            {
                                              id: "coming_soon",
                                              label: "Coming Soon",
                                            },
                                          ].map((s) => (
                                            <button
                                              key={s.id}
                                              onClick={() =>
                                                setEditing({
                                                  ...editing,
                                                  status: s.id as any,
                                                })
                                              }
                                              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap ${
                                                (!editing.status &&
                                                  s.id === "released") ||
                                                editing.status === s.id
                                                  ? "bg-white/10 text-white"
                                                  : "text-white/30"
                                              }`}
                                            >
                                              {s.label}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-black text-white/40 uppercase">
                                        Tags
                                      </label>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() =>
                                            setEditing({
                                              ...editing,
                                              isNew: !editing.isNew,
                                            })
                                          }
                                          className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${editing.isNew ? "bg-red-600/20 text-red-400 border border-red-500/20" : "bg-white/5 text-white/20"}`}
                                        >
                                          NEW
                                        </button>
                                        <button
                                          onClick={() =>
                                            setEditing({
                                              ...editing,
                                              isTrending: !editing.isTrending,
                                            })
                                          }
                                          className={`flex-1 py-1.5 rounded-xl text-[10px] font-medium uppercase transition-all ${editing.isTrending ? "bg-red-600/20 text-red-500 border border-red-500/20" : "bg-white/5 text-white/20"}`}
                                        >
                                          HOT
                                        </button>
                                        <button
                                          onClick={() =>
                                            setEditing({
                                              ...editing,
                                              isNew: false,
                                              isTrending: false,
                                            })
                                          }
                                          className={`flex-1 py-1.5 rounded-xl text-[10px] font-medium uppercase transition-all ${!editing.isNew && !editing.isTrending ? "bg-white/20 text-white border border-white/20" : "bg-white/5 text-white/20"}`}
                                        >
                                          NONE
                                        </button>
                                      </div>
                                    </div>

                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-black text-white/40 uppercase">
                                        Manual Content ID (Unique)
                                      </label>
                                      <SafeInput
                                        value={editing.id || ""}
                                        onChange={(e) =>
                                          setEditing({
                                            ...editing,
                                            id: e.target.value,
                                          })
                                        }
                                        placeholder="e.g. spider-man-2024"
                                        className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-xs font-mono focus:border-red-500/50 outline-none transition-all"
                                        disabled={Boolean(
                                          editing.id &&
                                          contents.some(
                                            (c) => c.id === editing.id,
                                          ),
                                        )}
                                      />
                                      <p className="text-[8px] text-white/20">
                                        Leaving this blank will auto-generate an
                                        ID if creating new.
                                      </p>
                                    </div>

                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-black text-white/40 uppercase">
                                        Title
                                      </label>
                                      <SafeInput
                                        value={editing.title || ""}
                                        onChange={(e) => {
                                          const newTitle = e.target.value;
                                          const slug = newTitle
                                            .toLowerCase()
                                            .replace(/[^a-z0-9]+/g, "-")
                                            .replace(/^-+|-+$/g, "");

                                          const updates: any = {
                                            title: newTitle,
                                          };
                                          // Auto-fill ID only if it was empty or matched previous title slug
                                          const oldSlug = editing.title
                                            ? editing.title
                                                .toLowerCase()
                                                .replace(/[^a-z0-9]+/g, "-")
                                                .replace(/^-+|-+$/g, "")
                                            : "";
                                          if (
                                            !editing.id ||
                                            editing.id === oldSlug
                                          ) {
                                            updates.id = slug;
                                          }

                                          setEditing({
                                            ...editing,
                                            ...updates,
                                          });
                                        }}
                                        className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm focus:border-red-500/50 outline-none transition-all"
                                      />
                                    </div>

                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-white/40 uppercase">
                                          Release Date
                                        </label>
                                        <SafeInput
                                          type="date"
                                          value={editing.releaseDate || ""}
                                          onChange={(e) =>
                                            setEditing({
                                              ...editing,
                                              releaseDate: e.target.value,
                                            })
                                          }
                                          className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm outline-none"
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-white/40 uppercase">
                                          Rating (0-10)
                                        </label>
                                        <SafeInput
                                          value={editing.rating || ""}
                                          onChange={(e) =>
                                            setEditing({
                                              ...editing,
                                              rating: e.target.value,
                                            })
                                          }
                                          className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm outline-none"
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-white/40 uppercase">
                                          Duration
                                        </label>
                                        <SafeInput
                                          value={editing.duration || ""}
                                          onChange={(e) =>
                                            setEditing({
                                              ...editing,
                                              duration: e.target.value,
                                            })
                                          }
                                          placeholder="e.g. 1h 30m"
                                          className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm outline-none"
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-white/40 uppercase">
                                          Quality
                                        </label>
                                        <SafeInput
                                          value={editing.quality || ""}
                                          onChange={(e) =>
                                            setEditing({
                                              ...editing,
                                              quality: e.target.value,
                                            })
                                          }
                                          placeholder="e.g. 1080p HD"
                                          className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm outline-none"
                                        />
                                      </div>
                                    </div>

                                    <div className="space-y-2">
                                      <label className="text-[10px] font-black text-white/40 uppercase">
                                        Networks / Platforms (Available On)
                                      </label>
                                      <div className="flex flex-wrap gap-1.5 p-3 bg-white/5 border border-white/5 rounded-2xl">
                                        {(() => {
                                          const defaultNetworks = [
                                            "Netflix",
                                            "HBO Max",
                                            "Disney+",
                                            "Prime Video",
                                            "Apple TV+",
                                            "Hulu",
                                            "iQIYI",
                                            "Viu",
                                            "Crunchyroll",
                                            "Bilibili",
                                          ];
                                          const allNetworks = [
                                            ...new Set([
                                              ...defaultNetworks,
                                              ...(editing.networks || []),
                                            ]),
                                          ];
                                          return (
                                            <>
                                              {allNetworks.map((net) => {
                                                const isSelected =
                                                  editing.networks?.includes(
                                                    net,
                                                  );
                                                return (
                                                  <button
                                                    key={net}
                                                    type="button"
                                                    onClick={() => {
                                                      const cur =
                                                        editing.networks || [];
                                                      const next = isSelected
                                                        ? cur.filter(
                                                            (x) => x !== net,
                                                          )
                                                        : [...cur, net];
                                                      setEditing({
                                                        ...editing,
                                                        networks: next,
                                                      });
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all flex items-center gap-1.5 border shadow-sm ${
                                                      isSelected
                                                        ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/20"
                                                        : "bg-black/20 text-white/40 border-white/5 hover:border-white/20 hover:text-white"
                                                    }`}
                                                  >
                                                    {net}
                                                  </button>
                                                );
                                              })}
                                              <input
                                                type="text"
                                                placeholder="+ Add Platform..."
                                                className="h-8 w-32 bg-black/40 border border-white/10 rounded-lg px-2 text-xs outline-none focus:border-red-500/50 text-white placeholder-white/30"
                                                onKeyDown={(e) => {
                                                  if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    const val =
                                                      e.currentTarget.value.trim();
                                                    if (val) {
                                                      const cur =
                                                        editing.networks || [];
                                                      if (!cur.includes(val)) {
                                                        setEditing({
                                                          ...editing,
                                                          networks: [
                                                            ...cur,
                                                            val,
                                                          ],
                                                        });
                                                      }
                                                      e.currentTarget.value =
                                                        "";
                                                    }
                                                  }
                                                }}
                                              />
                                            </>
                                          );
                                        })()}
                                      </div>
                                    </div>

                                    <div className="space-y-1.5 relative">
                                      <label className="text-[10px] font-black text-white/40 uppercase">
                                        Studio
                                      </label>
                                      <SafeInput
                                        value={editing.studio || ""}
                                        onFocus={() => setShowStudioList(true)}
                                        onBlur={() =>
                                          setTimeout(
                                            () => setShowStudioList(false),
                                            200,
                                          )
                                        }
                                        onChange={(e) => {
                                          setEditing({
                                            ...editing,
                                            studio: e.target.value,
                                          });
                                          setShowStudioList(true);
                                        }}
                                        placeholder="e.g. Disney, Universal"
                                        className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm outline-none transition-all focus:border-red-500/50"
                                      />
                                      {showStudioList &&
                                        (editing.studio || "").length > 0 && (
                                          <div className="absolute z-50 top-[calc(100%+4px)] left-0 w-full bg-[#111] border border-white/10 rounded-xl max-h-[300px] overflow-y-auto shadow-2xl flex flex-col hide-scrollbar">
                                            {studios
                                              .filter((s) => {
                                                const parts = (
                                                  editing.studio || ""
                                                ).split(",");
                                                const currentSearch = parts[
                                                  parts.length - 1
                                                ]
                                                  .trim()
                                                  .toLowerCase();
                                                if (currentSearch.length === 0)
                                                  return true; // show all if empty after comma
                                                return s.name
                                                  .toLowerCase()
                                                  .includes(currentSearch);
                                              })
                                              .slice(0, 10)
                                              .map((s, idx) => (
                                                <button
                                                  key={`${s.name}-${idx}`}
                                                  type="button"
                                                  onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    const parts = (
                                                      editing.studio || ""
                                                    ).split(",");
                                                    parts.pop(); // remove the currently typed portion
                                                    const newStudio =
                                                      parts.length > 0
                                                        ? [
                                                            ...parts,
                                                            " " + s.name,
                                                          ].join(",")
                                                        : s.name;
                                                    setEditing({
                                                      ...editing,
                                                      studio: newStudio,
                                                    });
                                                    // intentionally keep list open if they want to add another?
                                                    // Or maybe close it. The user might type a comma next. Let's just hide it.
                                                    setShowStudioList(false);
                                                  }}
                                                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0"
                                                >
                                                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center shrink-0 p-1.5 border border-white/5 bg-black">
                                                    <img
                                                      src={s.logoUrl}
                                                      alt={s.name}
                                                      className="w-full h-full object-contain opacity-100"
                                                    />
                                                  </div>
                                                  <span className="text-sm font-medium text-white/90">
                                                    {s.name}
                                                  </span>
                                                </button>
                                              ))}
                                          </div>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-black text-white/40 uppercase">
                                        Synopsis
                                      </label>
                                      <SafeTextarea
                                        value={editing.synopsis || ""}
                                        onChange={(e) =>
                                          setEditing({
                                            ...editing,
                                            synopsis: e.target.value,
                                          })
                                        }
                                        rows={3}
                                        className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-sm outline-none resize-none"
                                      />
                                    </div>

                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-black text-white/40 uppercase">
                                        Artists / Cast (comma separated)
                                      </label>
                                      <SafeInput
                                        value={editing.cast?.join(", ") || ""}
                                        onChange={(e) =>
                                          setEditing({
                                            ...editing,
                                            cast: e.target.value
                                              .split(",")
                                              .map((t) => t.trim())
                                              .filter(Boolean),
                                          })
                                        }
                                        placeholder="e.g. Leonardo DiCaprio, Brad Pitt"
                                        className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm outline-none transition-all"
                                      />
                                    </div>

                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-black text-white/40 uppercase">
                                        Director
                                      </label>
                                      <SafeInput
                                        value={editing.director || ""}
                                        onChange={(e) =>
                                          setEditing({
                                            ...editing,
                                            director: e.target.value,
                                          })
                                        }
                                        placeholder="e.g. Christopher Nolan, Maggie Kang"
                                        className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm outline-none transition-all"
                                      />
                                    </div>

                                    <div className="space-y-4">
                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-white/40 uppercase">
                                          Poster URL (2:3)
                                        </label>
                                        <div className="flex gap-2">
                                          <SafeInput
                                            value={editing.poster || ""}
                                            onChange={(e) =>
                                              setEditing({
                                                ...editing,
                                                poster: e.target.value,
                                              })
                                            }
                                            className="flex-1 h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-xs font-mono outline-none"
                                          />
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setAssetPickerTarget({
                                                type: "movie",
                                                field: "poster",
                                              })
                                            }
                                            className="h-11 px-4 rounded-xl bg-red-600/10 hover:bg-red-600 border border-red-500/20 text-red-400 hover:text-white font-medium text-xs flex items-center gap-1.5 transition-all outline-none shrink-0"
                                            title="Select from Asset Manager"
                                          >
                                            <Folder className="w-4 h-4" />
                                            <span>PICK</span>
                                          </button>
                                        </div>
                                      </div>
                                      <div className="space-y-4">
                                        <div className="space-y-1.5">
                                          <label className="text-[10px] font-black text-white/40 uppercase">
                                            Hero Backdrop URL (16:9)
                                          </label>
                                          <div className="flex gap-2">
                                            <SafeInput
                                              value={editing.backdrop || ""}
                                              onChange={(e) =>
                                                setEditing({
                                                  ...editing,
                                                  backdrop: e.target.value,
                                                })
                                              }
                                              className="flex-1 h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-xs font-mono outline-none"
                                            />
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setAssetPickerTarget({
                                                  type: "movie",
                                                  field: "backdrop",
                                                })
                                              }
                                              className="h-11 px-4 rounded-xl bg-red-600/10 hover:bg-red-600 border border-red-500/20 text-red-400 hover:text-white font-medium text-xs flex items-center gap-1.5 transition-all outline-none shrink-0"
                                              title="Select from Asset Manager"
                                            >
                                              <Folder className="w-4 h-4" />
                                              <span>PICK</span>
                                            </button>
                                          </div>
                                        </div>
                                        {editing.backdrop && (
                                          <div className="p-4 border border-white/10 bg-white/5 rounded-xl space-y-4">
                                            <h5 className="text-xs font-medium uppercase tracking-widest text-white/60">
                                              Backdrop Adjustments
                                            </h5>

                                            <div className="flex flex-col gap-4">
                                              <div className="flex flex-col sm:flex-row gap-4">
                                                <div className="flex-1 space-y-3">
                                                  <div>
                                                    <div className="flex justify-between text-[10px] text-white/40 mb-1">
                                                      <span>Zoom (Scale)</span>
                                                      <span>
                                                        {Math.round(
                                                          (editing.backdropScale ||
                                                            1) * 100,
                                                        )}
                                                        %
                                                      </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                      <SafeInput
                                                        type="range"
                                                        min="-1"
                                                        max="5"
                                                        step="0.05"
                                                        value={
                                                          editing.backdropScale ||
                                                          1
                                                        }
                                                        onChange={(e) =>
                                                          setEditing({
                                                            ...editing,
                                                            backdropScale:
                                                              parseFloat(
                                                                e.target.value,
                                                              ),
                                                          })
                                                        }
                                                        className="flex-1 accent-red-500"
                                                      />
                                                      <input
                                                        type="number"
                                                        step="0.05"
                                                        min="-1"
                                                        max="5"
                                                        value={
                                                          editing.backdropScale ??
                                                          1
                                                        }
                                                        onChange={(e) =>
                                                          setEditing({
                                                            ...editing,
                                                            backdropScale:
                                                              parseFloat(
                                                                e.target.value,
                                                              ) || 1,
                                                          })
                                                        }
                                                        className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white text-[10px] font-mono outline-none focus:border-red-500/50 text-right"
                                                      />
                                                    </div>
                                                  </div>
                                                  <div>
                                                    <div className="flex justify-between text-[10px] text-white/40 mb-1">
                                                      <span>Rotation</span>
                                                      <span>
                                                        {editing.backdropRotate ||
                                                          0}
                                                        ¬∞
                                                      </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                      <SafeInput
                                                        type="range"
                                                        min="-180"
                                                        max="180"
                                                        step="1"
                                                        value={
                                                          editing.backdropRotate ||
                                                          0
                                                        }
                                                        onChange={(e) =>
                                                          setEditing({
                                                            ...editing,
                                                            backdropRotate:
                                                              parseInt(
                                                                e.target.value,
                                                              ),
                                                          })
                                                        }
                                                        className="flex-1 accent-red-500"
                                                      />
                                                      <input
                                                        type="number"
                                                        min="-180"
                                                        max="180"
                                                        value={
                                                          editing.backdropRotate ??
                                                          0
                                                        }
                                                        onChange={(e) =>
                                                          setEditing({
                                                            ...editing,
                                                            backdropRotate:
                                                              parseInt(
                                                                e.target.value,
                                                              ) || 0,
                                                          })
                                                        }
                                                        className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white text-[10px] font-mono outline-none focus:border-red-500/50 text-right"
                                                      />
                                                    </div>
                                                  </div>
                                                </div>

                                                <div className="flex-1 space-y-3">
                                                  <div>
                                                    <div className="flex justify-between text-[10px] text-white/40 mb-1">
                                                      <span>Position X</span>
                                                      <span>
                                                        {(() => {
                                                          const pos =
                                                            editing.backdropPosition ||
                                                            "50% 50%";
                                                          return (
                                                            pos.split(" ")[0] ||
                                                            "50%"
                                                          );
                                                        })()}
                                                      </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                      <SafeInput
                                                        type="range"
                                                        min="0"
                                                        max="100"
                                                        step="1"
                                                        value={parseInt(
                                                          (
                                                            editing.backdropPosition ||
                                                            "50% 50%"
                                                          ).split(" ")[0] ||
                                                            "50",
                                                        ) || 50}
                                                        onChange={(e) => {
                                                          const y =
                                                            (
                                                              editing.backdropPosition ||
                                                              "50% 50%"
                                                            ).split(" ")[1] ||
                                                            "50%";
                                                          setEditing({
                                                            ...editing,
                                                            backdropPosition: `${e.target.value}% ${y}`,
                                                          });
                                                        }}
                                                        className="flex-1 accent-red-500"
                                                      />
                                                      <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        value={parseInt(
                                                          (
                                                            editing.backdropPosition ||
                                                            "50% 50%"
                                                          ).split(" ")[0] ||
                                                            "50",
                                                        ) || 50}
                                                        onChange={(e) => {
                                                          const y =
                                                            (
                                                              editing.backdropPosition ||
                                                              "50% 50%"
                                                            ).split(" ")[1] ||
                                                            "50%";
                                                          setEditing({
                                                            ...editing,
                                                            backdropPosition: `${e.target.value}% ${y}`,
                                                          });
                                                        }}
                                                        className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white text-[10px] font-mono outline-none focus:border-red-500/50 text-right"
                                                      />
                                                    </div>
                                                  </div>
                                                  <div>
                                                    <div className="flex justify-between text-[10px] text-white/40 mb-1">
                                                      <span>Position Y</span>
                                                      <span>
                                                        {(() => {
                                                          const pos =
                                                            editing.backdropPosition ||
                                                            "50% 50%";
                                                          return (
                                                            pos.split(" ")[1] ||
                                                            "50%"
                                                          );
                                                        })()}
                                                      </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                      <SafeInput
                                                        type="range"
                                                        min="0"
                                                        max="100"
                                                        step="1"
                                                        value={parseInt(
                                                          (
                                                            editing.backdropPosition ||
                                                            "50% 50%"
                                                          ).split(" ")[1] ||
                                                            "50",
                                                        ) || 50}
                                                        onChange={(e) => {
                                                          const x =
                                                            (
                                                              editing.backdropPosition ||
                                                              "50% 50%"
                                                            ).split(" ")[0] ||
                                                            "50%";
                                                          setEditing({
                                                            ...editing,
                                                            backdropPosition: `${x} ${e.target.value}%`,
                                                          });
                                                        }}
                                                        className="flex-1 accent-red-500"
                                                      />
                                                      <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        value={parseInt(
                                                          (
                                                            editing.backdropPosition ||
                                                            "50% 50%"
                                                          ).split(" ")[1] ||
                                                            "50",
                                                        ) || 50}
                                                        onChange={(e) => {
                                                          const x =
                                                            (
                                                              editing.backdropPosition ||
                                                              "50% 50%"
                                                            ).split(" ")[0] ||
                                                            "50%";
                                                          setEditing({
                                                            ...editing,
                                                            backdropPosition: `${x} ${e.target.value}%`,
                                                          });
                                                        }}
                                                        className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white text-[10px] font-mono outline-none focus:border-red-500/50 text-right"
                                                      />
                                                    </div>
                                                  </div>
                                                </div>

                                                <div className="w-full sm:w-64 md:w-80 aspect-video rounded-xl overflow-hidden bg-black/40 border border-white/20 shrink-0 relative flex items-center justify-center group/preview">
                                                  <div
                                                    className="absolute inset-0 bg-[#070404]"
                                                    style={{
                                                      backgroundImage: `url(${editing.backdrop})`,
                                                      backgroundSize: "cover",
                                                      backgroundRepeat:
                                                        "no-repeat",
                                                      backgroundPosition:
                                                        editing.backdropPosition ||
                                                        "50% 50%",
                                                      transform: `scale(${editing.backdropScale || 1}) rotate(${editing.backdropRotate || 0}deg)`,
                                                      transformOrigin:
                                                        editing.backdropPosition ||
                                                        "50% 50%",
                                                      transition:
                                                        "transform 0.2s ease-out",
                                                    }}
                                                  />
                                                  <div className="absolute inset-x-0 bottom-0 p-2 bg-black/60 backdrop-blur-sm border-t border-white/10 opacity-0 group-hover/preview:opacity-100 transition-opacity">
                                                    <p className="text-[8px] font-medium text-white/50 text-center uppercase tracking-[0.2em]">
                                                      Hero Preview
                                                    </p>
                                                  </div>
                                                  <div className="absolute inset-0 border-[0.5px] border-white/10 pointer-events-none"></div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div className="space-y-4">
                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-white/40 uppercase">
                                          Trailer URL (Optional)
                                        </label>
                                        <SafeInput
                                          value={
                                            editing.trailerUrl ||
                                            editing.embedUrl ||
                                            ""
                                          }
                                          onChange={(e) =>
                                            setEditing({
                                              ...editing,
                                              trailerUrl: cleanStreamPayloadUrl(e.target.value),
                                            })
                                          }
                                          className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm outline-none"
                                          placeholder="YouTube Trailer URL"
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                          <label className="text-[10px] font-black text-white/40 uppercase">
                                            Primary Server
                                          </label>
                                          {editing.streamUrl && (
                                            <div className="flex bg-black/20 rounded-md p-1 border border-white/5 space-x-1">
                                              <button
                                                onClick={() =>
                                                  setPlayerPosEditor({
                                                    url: editing.streamUrl!,
                                                    sandbox:
                                                      editing.useSandbox ||
                                                      false,
                                                    scale:
                                                      editing.playerScale ??
                                                      100,
                                                    translateX:
                                                      editing.playerTranslateX ??
                                                      0,
                                                    translateY:
                                                      editing.playerTranslateY ??
                                                      0,
                                                    onSave: (val) =>
                                                      setEditing({
                                                        ...editing,
                                                        playerScale: val.scale,
                                                        playerTranslateX:
                                                          val.translateX,
                                                        playerTranslateY:
                                                          val.translateY,
                                                      }),
                                                  })
                                                }
                                                className="text-[9px] font-black uppercase tracking-widest flex items-center text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-md hover:bg-orange-400/20"
                                              >
                                                <Crop className="w-3 h-3 mr-1" />
                                                Pos
                                              </button>
                                              <button
                                                onClick={() =>
                                                  setPlayerPreviewUrl({
                                                    url: editing.streamUrl!,
                                                    sandbox:
                                                      editing.useSandbox ||
                                                      false,
                                                    scale:
                                                      editing.playerScale ??
                                                      100,
                                                    translateX:
                                                      editing.playerTranslateX ??
                                                      0,
                                                    translateY:
                                                      editing.playerTranslateY ??
                                                      0,
                                                  })
                                                }
                                                className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md hover:bg-emerald-400/20"
                                              >
                                                Preview Player
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                        {editing.isCustomPlayer && (
                                          <ViyieEmbedLink
                                            contentId={editing.id}
                                            label="ViyiePlayer Embed Link"
                                            className="mb-2.5"
                                          />
                                        )}
                                        <SafeInput
                                          value={editing.streamUrl || ""}
                                          onChange={(e) =>
                                            setEditing({
                                              ...editing,
                                              streamUrl: e.target.value,
                                            })
                                          }
                                          className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm outline-none"
                                          placeholder="Primary Server URL or Embed Code"
                                        />
                                        <div className="mt-3.5 flex justify-start">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setCustomPrompt({
                                                isOpen: true,
                                                title:
                                                  "Enter AbyssPlayer / Hydrax Video Code / ID / Embed Code:",
                                                value: "",
                                                onSave: (id) => {
                                                  if (id && id.trim()) {
                                                    const trimmed = id.trim();
                                                    const cleaned =
                                                      cleanStreamPayloadUrl(
                                                        trimmed,
                                                      );
                                                    const finalUrl =
                                                      cleaned.startsWith(
                                                        "http",
                                                      ) ||
                                                      cleaned.startsWith("//")
                                                        ? cleaned
                                                        : `https://abyssplayer.com/${cleaned}`;
                                                    setEditing({
                                                      ...editing,
                                                      streamUrl: finalUrl,
                                                    });
                                                  }
                                                },
                                              });
                                            }}
                                            className="text-[9.5px] font-black uppercase tracking-wider text-red-500 bg-red-500/10 px-2 py-1 rounded-lg hover:bg-red-500/20 flex items-center gap-1.5 transition-all active:scale-95 border border-red-500/10"
                                          >
                                            <ExternalLink className="w-3 h-3" />
                                            Quick Abyss/Hydrax Link
                                          </button>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                        <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                                          <div className="space-y-0.5">
                                            <label className="text-[10px] font-black text-white uppercase flex items-center gap-2">
                                              <MonitorPlay className="w-3 h-3 text-red-500" />{" "}
                                              Popup Mode
                                            </label>
                                            <p className="text-[9px] text-white/40">
                                              Open in window popup
                                            </p>
                                          </div>
                                          <button
                                            onClick={() =>
                                              setEditing({
                                                ...editing,
                                                useExternalPopup:
                                                  !editing.useExternalPopup,
                                                useExternalTab: false,
                                              })
                                            }
                                            className={`w-10 h-5 md:w-12 md:h-6 rounded-full transition-all relative shrink-0 ${editing.useExternalPopup ? "bg-red-600" : "bg-white/10"}`}
                                          >
                                            <div
                                              className={`absolute top-0.5 md:top-1 w-4 h-4 rounded-full bg-white transition-all ${editing.useExternalPopup ? "right-1" : "left-1"}`}
                                            />
                                          </button>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                                          <div className="space-y-0.5">
                                            <label className="text-[10px] font-black text-white uppercase flex items-center gap-2">
                                              <ExternalLink className="w-3 h-3 text-red-500" />{" "}
                                              New Tab
                                            </label>
                                            <p className="text-[9px] text-white/40">
                                              Open in browser tab
                                            </p>
                                          </div>
                                          <button
                                            onClick={() =>
                                              setEditing({
                                                ...editing,
                                                useExternalTab:
                                                  !editing.useExternalTab,
                                                useExternalPopup: false,
                                              })
                                            }
                                            className={`w-10 h-5 md:w-12 md:h-6 rounded-full transition-all relative shrink-0 ${editing.useExternalTab ? "bg-red-600" : "bg-white/10"}`}
                                          >
                                            <div
                                              className={`absolute top-0.5 md:top-1 w-4 h-4 rounded-full bg-white transition-all ${editing.useExternalTab ? "right-1" : "left-1"}`}
                                            />
                                          </button>
                                        </div>
                                        <div className="flex items-center justify-between col-span-2 lg:col-span-1 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                                          <div className="space-y-0.5">
                                            <label className="text-[10px] font-black text-emerald-400 uppercase flex items-center gap-2">
                                              <ShieldCheck className="w-3 h-3" />{" "}
                                              Ad Protect
                                            </label>
                                            <p className="text-[9px] text-emerald-400/50">
                                              Sandbox Iframe Mode
                                            </p>
                                          </div>
                                          <button
                                            onClick={() =>
                                              setEditing({
                                                ...editing,
                                                useSandbox: !editing.useSandbox,
                                              })
                                            }
                                            className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${editing.useSandbox ? "bg-emerald-500" : "bg-emerald-500/20"}`}
                                          >
                                            <div
                                              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${editing.useSandbox ? "right-1" : "left-1"}`}
                                            />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Toggle Iframe Mode and Remote Drive for Main Server */}
                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                                          <div className="space-y-0.5">
                                            <label className="text-[10px] font-black text-white uppercase flex items-center gap-2">
                                              <MonitorPlay className="w-3 h-3 text-red-500" />{" "}
                                              Iframe Playback
                                            </label>
                                            <p className="text-[9px] text-white/40">
                                              Force HTML Iframe player
                                            </p>
                                          </div>
                                          <button
                                            onClick={() =>
                                              setEditing({
                                                ...editing,
                                                forceIframe:
                                                  !editing.forceIframe,
                                                isCustomPlayer: false,
                                              })
                                            }
                                            className={`w-10 h-5 md:w-12 md:h-6 rounded-full transition-all relative shrink-0 ${editing.forceIframe ? "bg-red-600" : "bg-white/10"}`}
                                          >
                                            <div
                                              className={`absolute top-0.5 md:top-1 w-4 h-4 rounded-full bg-white transition-all ${editing.forceIframe ? "right-1" : "left-1"}`}
                                            />
                                          </button>
                                        </div>

                                        <div className="flex items-center justify-between p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl hover:bg-blue-500/10 transition-colors">
                                          <div className="space-y-0.5">
                                            <label className="text-[10px] font-black text-blue-400 uppercase flex items-center gap-2">
                                              <Sparkles className="w-3 h-3 text-blue-400 animate-pulse" />{" "}
                                              Remote Drive
                                            </label>
                                            <p className="text-[9px] text-blue-400/50">
                                              Custom HTML5 Player
                                            </p>
                                          </div>
                                          <button
                                            onClick={() =>
                                              setEditing({
                                                ...editing,
                                                isCustomPlayer:
                                                  !editing.isCustomPlayer,
                                                forceIframe: false,
                                              })
                                            }
                                            className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${editing.isCustomPlayer ? "bg-blue-500" : "bg-blue-500/20"}`}
                                          >
                                            <div
                                              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${editing.isCustomPlayer ? "right-1" : "left-1"}`}
                                            />
                                          </button>
                                        </div>
                                      </div>

                                      {editing.isCustomPlayer && (
                                        <div className="space-y-3 p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl transition-all duration-300">
                                          <ViyieEmbedLink
                                            contentId={editing.id}
                                            label="ViyiePlayer Embed Link"
                                            className="mb-1"
                                          />
                                          <AdminSubtitleManager
                                            value={editing.customSubtitle || ""}
                                            onChange={(val) =>
                                              setEditing((prev) =>
                                                prev
                                                  ? {
                                                      ...prev,
                                                      customSubtitle: val,
                                                    }
                                                  : null,
                                              )
                                            }
                                            label="Custom Subtitles (.vtt/.srt)"
                                          />
                                          <div className="space-y-1">
                                            <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block">
                                              Custom Resolutions JSON
                                            </label>
                                            <textarea
                                              value={
                                                editing.customResolutions || ""
                                              }
                                              onChange={(e) => {
                                                const newVal = e.target.value;
                                                setEditing((prev) =>
                                                  prev
                                                    ? {
                                                        ...prev,
                                                        customResolutions:
                                                          newVal,
                                                      }
                                                    : null,
                                                );
                                              }}
                                              className="w-full h-20 bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white/80 font-mono outline-none focus:border-blue-500"
                                              placeholder='[\n  { "res": "1080p", "url": "..." }\n]'
                                            />
                                          </div>
                                        </div>
                                      )}

                                      {/* PLAY1 / PLAY2 Custom Naming & Visibility Hide-Show Toggle */}
                                      <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-3">
                                        <div className="flex items-center justify-between">
                                          <div className="space-y-0.5">
                                            <label className="text-[10px] font-black text-white/90 uppercase tracking-wider flex items-center gap-2">
                                              {editing.hidePlay1 ? (
                                                <EyeOff className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                                              ) : (
                                                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                              )}
                                              PLAY1 Option (Failsafe Iframe)
                                            </label>
                                            <p className="text-[9px] text-white/40">
                                              {editing.hidePlay1
                                                ? "Hidden from users (Admin can still edit fields safely)"
                                                : "Visible & accessible on client players"}
                                            </p>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setEditing({
                                                ...editing,
                                                hidePlay1: !editing.hidePlay1,
                                              })
                                            }
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                              editing.hidePlay1
                                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                                            }`}
                                          >
                                            {editing.hidePlay1 ? (
                                              <EyeOff className="w-4 h-4" />
                                            ) : (
                                              <Eye className="w-4 h-4" />
                                            )}
                                            {editing.hidePlay1
                                              ? "Hidden"
                                              : "Visible"}
                                          </button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 pt-1">
                                          <div className="space-y-1">
                                            <label className="text-[9px] font-black text-white/40 uppercase tracking-widest pl-0.5 block">
                                              PLAY1 Display Name
                                            </label>
                                            <SafeInput
                                              value={
                                                editing.play1DisplayName || ""
                                              }
                                              onChange={(e) =>
                                                setEditing({
                                                  ...editing,
                                                  play1DisplayName:
                                                    e.target.value,
                                                })
                                              }
                                              className="w-full h-9 bg-black/40 border border-white/10 rounded-lg px-3 text-xs outline-none focus:border-red-500/50 text-white"
                                              placeholder="Default: PLAY1"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[9px] font-black text-white/40 uppercase tracking-widest pl-0.5 block">
                                              PLAY2 Display Name
                                            </label>
                                            <SafeInput
                                              value={
                                                editing.play2DisplayName || ""
                                              }
                                              onChange={(e) =>
                                                setEditing({
                                                  ...editing,
                                                  play2DisplayName:
                                                    e.target.value,
                                                })
                                              }
                                              className="w-full h-9 bg-black/40 border border-white/10 rounded-lg px-3 text-xs outline-none focus:border-blue-500/50 text-white"
                                              placeholder="Default: PLAY2"
                                            />
                                          </div>
                                        </div>
                                      </div>

                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-white/40 uppercase">
                                          Main Server Display Name (Custom per
                                          film)
                                        </label>
                                        <SafeInput
                                          value={editing.mainServerName || ""}
                                          onChange={(e) =>
                                            setEditing({
                                              ...editing,
                                              mainServerName: e.target.value,
                                            })
                                          }
                                          className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm outline-none"
                                          placeholder="e.g. Server 1 (Default: Main Player)"
                                        />
                                      </div>
                                    </div>

                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-black text-white/40 uppercase">
                                        Genres
                                      </label>
                                      <div className="flex flex-wrap gap-2 mt-1">
                                        {(() => {
                                          // Merge global genres and current edited item's custom genres so buttons always show up
                                          const allGenres = [
                                            ...new Set([
                                              ...genres,
                                              ...(editing.genres || []),
                                            ]),
                                          ];
                                          return (
                                            <>
                                              {allGenres.map((g) => {
                                                const isSelected =
                                                  editing.genres?.includes(g);
                                                return (
                                                  <button
                                                    key={g}
                                                    onClick={() => {
                                                      const cur =
                                                        editing.genres || [];
                                                      setEditing({
                                                        ...editing,
                                                        genres: isSelected
                                                          ? cur.filter(
                                                              (x) => x !== g,
                                                            )
                                                          : [...cur, g],
                                                      });
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                                      isSelected
                                                        ? "bg-red-500 text-white"
                                                        : "bg-white/5 text-white/40 hover:text-white"
                                                    }`}
                                                  >
                                                    {g}
                                                  </button>
                                                );
                                              })}
                                              <input
                                                type="text"
                                                placeholder="+ Add Genre..."
                                                className="h-8 w-28 bg-black/40 border border-white/10 rounded-lg px-2 text-xs outline-none focus:border-red-500/50 text-white placeholder-white/30"
                                                onKeyDown={(e) => {
                                                  if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    const val =
                                                      e.currentTarget.value.trim();
                                                    if (val) {
                                                      const formatted =
                                                        val
                                                          .charAt(0)
                                                          .toUpperCase() +
                                                        val
                                                          .slice(1)
                                                          .toLowerCase();
                                                      const cur =
                                                        editing.genres || [];
                                                      if (
                                                        !cur.includes(formatted)
                                                      ) {
                                                        setEditing({
                                                          ...editing,
                                                          genres: [
                                                            ...cur,
                                                            formatted,
                                                          ],
                                                        });
                                                        // Save immediately to global genres so they can be selected next time!
                                                        if (
                                                          !genres.includes(
                                                            formatted,
                                                          )
                                                        ) {
                                                          saveGenres([
                                                            ...genres,
                                                            formatted,
                                                          ]);
                                                        }
                                                      }
                                                      e.currentTarget.value =
                                                        "";
                                                    }
                                                  }
                                                }}
                                              />
                                            </>
                                          );
                                        })()}
                                      </div>
                                    </div>

                                    <div className="space-y-1.5 mt-4">
                                      <label className="text-[10px] font-black text-white/40 uppercase">
                                        Tags
                                      </label>
                                      <div className="flex flex-wrap gap-2 mt-1">
                                        {(() => {
                                          const allTags = [
                                            ...new Set([
                                              ...tags,
                                              ...(editing.tags || []),
                                            ]),
                                          ];
                                          return (
                                            <>
                                              {allTags.map((t) => {
                                                const isSelected =
                                                  editing.tags?.includes(t) ||
                                                  (t === "NEW" &&
                                                    editing.isNew);
                                                return (
                                                  <button
                                                    key={t}
                                                    type="button"
                                                    onClick={() => {
                                                      let cur =
                                                        editing.tags || [];

                                                      // Legacy 'isNew' backwards compatibility handling
                                                      if (t === "NEW") {
                                                        setEditing({
                                                          ...editing,
                                                          isNew: !isSelected,
                                                          tags: isSelected
                                                            ? cur.filter(
                                                                (x) => x !== t,
                                                              )
                                                            : [...cur, t],
                                                        });
                                                        return;
                                                      }

                                                      setEditing({
                                                        ...editing,
                                                        tags: isSelected
                                                          ? cur.filter(
                                                              (x) => x !== t,
                                                            )
                                                          : [...cur, t],
                                                      });
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                                      isSelected
                                                        ? "bg-red-500 text-white"
                                                        : "bg-white/5 text-white/40 hover:text-white"
                                                    }`}
                                                  >
                                                    {t}
                                                  </button>
                                                );
                                              })}
                                              <input
                                                type="text"
                                                placeholder="+ Add Tag..."
                                                className="h-8 w-28 bg-black/40 border border-white/10 rounded-lg px-2 text-xs outline-none focus:border-red-500/50 text-white placeholder-white/30"
                                                onKeyDown={(e) => {
                                                  if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    const val =
                                                      e.currentTarget.value.trim();
                                                    if (val) {
                                                      const cur =
                                                        editing.tags || [];
                                                      if (!cur.includes(val)) {
                                                        setEditing({
                                                          ...editing,
                                                          tags: [...cur, val],
                                                        });
                                                        // Save immediately to global settings so they can be selected next time!
                                                        if (
                                                          !tags.includes(val)
                                                        ) {
                                                          saveTags([
                                                            ...tags,
                                                            val,
                                                          ]);
                                                        }
                                                      }
                                                      e.currentTarget.value =
                                                        "";
                                                    }
                                                  }
                                                }}
                                              />
                                            </>
                                          );
                                        })()}
                                      </div>
                                    </div>

                                    <div className="space-y-4 pt-4 border-t border-white/10">
                                      <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-white/40 uppercase">
                                          Download Links
                                        </label>
                                        <button
                                          onClick={() => {
                                            const cur =
                                              editing.downloadLinks || [];
                                            setEditing({
                                              ...editing,
                                              downloadLinks: [
                                                ...cur,
                                                {
                                                  name: "Server Download",
                                                  url: "",
                                                },
                                              ],
                                            });
                                          }}
                                          className="text-[10px] font-medium text-red-400 hover:text-red-300 flex items-center gap-1"
                                        >
                                          <Plus className="w-3 h-3" /> ADD
                                          DOWNLOAD
                                        </button>
                                      </div>
                                      {editing.downloadLinks?.map((dl, idx) => (
                                        <div
                                          key={idx}
                                          className="flex gap-2 items-center"
                                        >
                                          <SafeInput
                                            value={dl.name || ""}
                                            onChange={(e) => {
                                              const ndl = [
                                                ...(editing.downloadLinks ||
                                                  []),
                                              ];
                                              ndl[idx].name = e.target.value;
                                              setEditing({
                                                ...editing,
                                                downloadLinks: ndl,
                                              });
                                            }}
                                            className="w-1/3 h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-xs outline-none"
                                            placeholder="Server Name"
                                          />
                                          <SafeInput
                                            value={dl.url || ""}
                                            onChange={(e) => {
                                              const ndl = [
                                                ...(editing.downloadLinks ||
                                                  []),
                                              ];
                                              ndl[idx].url = e.target.value;
                                              setEditing({
                                                ...editing,
                                                downloadLinks: ndl,
                                              });
                                            }}
                                            className="flex-1 h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-xs outline-none"
                                            placeholder="Download URL (Linkvertise, etc.)"
                                          />
                                          <button
                                            onClick={() => {
                                              setEditing({
                                                ...editing,
                                                downloadLinks:
                                                  editing.downloadLinks?.filter(
                                                    (_, i) => i !== idx,
                                                  ),
                                              });
                                            }}
                                            className="p-2 text-white/20 hover:text-red-500"
                                          >
                                            <X className="w-4 h-4" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </>
                            )}

                            {(editing.type === "tv" || isEditingSubPage) && (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-black text-white/40 uppercase">
                                    Episodes (TV)
                                  </label>
                                  <div className="flex items-center gap-2">
                                    {editing.episodes &&
                                      editing.episodes.length > 0 && (
                                        <button
                                          onClick={() => {
                                            if (
                                              confirm("Clear all episodes?")
                                            ) {
                                              setEditing({
                                                ...editing,
                                                episodes: [],
                                              });
                                            }
                                          }}
                                          className="text-[10px] font-medium text-white/20 hover:text-red-400 flex items-center gap-1 transition-colors"
                                        >
                                          <Trash2 className="w-3 h-3" /> CLEAR
                                          ALL
                                        </button>
                                      )}
                                    <button
                                      onClick={() =>
                                        setIsJsonEpisodeMergeOpen(
                                          !isJsonEpisodeMergeOpen,
                                        )
                                      }
                                      className={`text-[10px] font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${isJsonEpisodeMergeOpen ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40" : "text-white/70 hover:text-white bg-white/5 border border-white/10 hover:border-white/20"}`}
                                    >
                                      <Database className="w-3.5 h-3.5" />{" "}
                                      {isJsonEpisodeMergeOpen
                                        ? "CANCEL MERGE"
                                        : "JSON MERGE"}
                                    </button>
                                    <button
                                      onClick={() =>
                                        setIsPlaylistImportOpen(
                                          !isPlaylistImportOpen,
                                        )
                                      }
                                      className={`text-[10px] font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${isPlaylistImportOpen ? "bg-red-600 text-white shadow-lg shadow-red-900/40" : "text-white/70 hover:text-white bg-white/5 border border-white/10 hover:border-white/20"}`}
                                    >
                                      <Flame className="w-3.5 h-3.5" />{" "}
                                      {isPlaylistImportOpen
                                        ? "CANCEL IMPORT"
                                        : "PLAYLIST IMPORT"}
                                    </button>
                                    <button
                                      onClick={() => {
                                        const curEps = editing.episodes || [];
                                        setEditing({
                                          ...editing,
                                          episodes: [
                                            ...curEps,
                                            {
                                              number:
                                                (curEps[curEps.length - 1]
                                                  ?.number || 0) + 1,
                                              title: "",
                                              url: "",
                                              thumbnail: "",
                                              updatedAt:
                                                new Date().toISOString(),
                                              servers: [
                                                {
                                                  name: "YouTube",
                                                  embedUrl: "",
                                                  useExternalPopup: false,
                                                  useExternalTab: false,
                                                },
                                                {
                                                  name: "Hydrax",
                                                  embedUrl: "",
                                                  useExternalPopup: false,
                                                  useExternalTab: false,
                                                },
                                                {
                                                  name: "TurboVIP",
                                                  embedUrl: "",
                                                  useExternalPopup: false,
                                                  useExternalTab: false,
                                                },
                                                {
                                                  name: "Dailymotion",
                                                  embedUrl: "",
                                                  useExternalPopup: false,
                                                  useExternalTab: false,
                                                },
                                              ],
                                              useExternalPopup: false,
                                              useExternalTab: false,
                                            },
                                          ],
                                        });
                                      }}
                                      className="text-[10px] font-medium text-red-400 hover:text-red-300 bg-red-500/10 px-2 py-1 rounded-lg flex items-center gap-1"
                                    >
                                      <Plus className="w-3 h-3" /> ADD EPISODE
                                    </button>
                                  </div>
                                </div>

                                {isPlaylistImportOpen && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    className="p-5 bg-gradient-to-br from-red-600/10 to-transparent border border-red-500/20 rounded-2xl space-y-4 overflow-hidden shadow-2xl relative"
                                  >
                                    <div className="absolute top-2 right-2 opacity-10">
                                      <Flame className="w-12 h-12" />
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-4 bg-red-600 rounded-full" />
                                        <p className="text-[10px] font-black text-white/80 uppercase tracking-widest">
                                          Viyie Auto-Sync
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-600/20 rounded text-[8px] font-black text-red-500 uppercase tracking-widest border border-red-500/20">
                                        Powered by Viyie
                                      </div>
                                    </div>

                                    {/* Switch mode */}
                                    <div className="flex flex-col md:flex-row gap-4">
                                      <div className="flex-1 space-y-1.5">
                                        <p className="text-[9px] font-black text-white/40 uppercase ml-1">
                                          Import Mode
                                        </p>
                                        <div className="flex bg-black/60 p-1 rounded-xl border border-white/5 gap-1 w-full">
                                          <button
                                            type="button"
                                            onClick={() => setPlaylistImportMode("direct")}
                                            className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                              playlistImportMode === "direct"
                                                ? "bg-red-600 text-white shadow-lg"
                                                : "text-white/40 hover:text-white"
                                            }`}
                                          >
                                            <Play className="w-3 h-3" />
                                            Direct All Playlist
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setPlaylistImportMode("custom")}
                                            className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                              playlistImportMode === "custom"
                                                ? "bg-red-600 text-white shadow-lg"
                                                : "text-white/40 hover:text-white"
                                            }`}
                                          >
                                            <Settings className="w-3 h-3" />
                                            Custom Grouping
                                          </button>
                                        </div>
                                      </div>

                                      <div className="flex-1 space-y-1.5">
                                        <p className="text-[9px] font-black text-white/40 uppercase ml-1">
                                          Conflict Mode
                                        </p>
                                        <div className="flex bg-black/60 p-1 rounded-xl border border-white/5 gap-1 w-full">
                                          <button
                                            type="button"
                                            onClick={() => setPlaylistConflictMode("tambah")}
                                            className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                              playlistConflictMode === "tambah"
                                                ? "bg-red-600 text-white shadow-lg"
                                                : "text-white/40 hover:text-white"
                                            }`}
                                          >
                                            <Plus className="w-3 h-3" />
                                            Tambah (Append)
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setPlaylistConflictMode("timpa")}
                                            className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                              playlistConflictMode === "timpa"
                                                ? "bg-red-600 text-white shadow-lg"
                                                : "text-white/40 hover:text-white"
                                            }`}
                                          >
                                            <Copy className="w-3 h-3" />
                                            Timpa (Overwrite)
                                          </button>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-3">
                                      <div className="flex-1 space-y-1.5">
                                        <p className="text-[9px] font-medium text-white/40 uppercase ml-1">
                                          YouTube Playlist URL
                                        </p>
                                        <SafeInput
                                          value={playlistUrl}
                                          onChange={(e) =>
                                            setPlaylistUrl(e.target.value)
                                          }
                                          placeholder="https://www.youtube.com/playlist?list=..."
                                          className="w-full h-11 bg-black/60 border border-white/5 px-4 rounded-xl text-xs outline-none focus:border-red-500/50 transition-all font-medium"
                                        />
                                      </div>
                                      {playlistImportMode === "direct" ? (
                                        <div className="w-full sm:w-28 space-y-1.5">
                                          <p className="text-[9px] font-medium text-white/40 uppercase ml-1">
                                            Total Ep
                                          </p>
                                          <SafeInput
                                            type="number"
                                            value={playlistEpisodeCount}
                                            onChange={(e) =>
                                              setPlaylistEpisodeCount(
                                                e.target.value,
                                              )
                                            }
                                            placeholder="24"
                                            className="w-full h-11 bg-black/60 border border-white/5 px-4 rounded-xl text-xs outline-none focus:border-red-500/50 transition-all font-medium text-red-500"
                                          />
                                        </div>
                                      ) : (
                                        <div className="w-full sm:w-64 space-y-1.5">
                                          <p className="text-[9px] font-medium text-white/40 uppercase ml-1">
                                            Custom Ranges (e.g., 1-6, 7-12)
                                          </p>
                                          <SafeInput
                                            type="text"
                                            value={playlistCustomRanges}
                                            onChange={(e) =>
                                              setPlaylistCustomRanges(
                                                e.target.value,
                                              )
                                            }
                                            placeholder="1-6, 7-12, 13-18"
                                            className="w-full h-11 bg-black/60 border border-white/5 px-4 rounded-xl text-xs outline-none focus:border-red-500/50 transition-all font-medium text-red-500 font-mono"
                                          />
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                      <div className="flex gap-2 flex-1">
                                        <button
                                          onClick={() =>
                                            setImportReverse(!importReverse)
                                          }
                                          className={`px-4 h-11 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 border ${importReverse ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/40" : "bg-white/5 text-white/40 border-white/10"}`}
                                        >
                                          <ArrowUpDown className="w-3.5 h-3.5" />
                                          {importReverse ? "NEWEST" : "OLDEST"}
                                        </button>
                                        <div className="flex-1 flex items-center gap-2 px-3 bg-white/5 border border-white/10 rounded-xl">
                                          <Image className="w-3.5 h-3.5 text-white/20" />
                                          <span className="text-[9px] font-medium text-white/30 uppercase">
                                            Auto Thumbnails where possible
                                          </span>
                                        </div>
                                      </div>
                                      <button
                                        onClick={importFromPlaylist}
                                        disabled={isUploading}
                                        className="w-full sm:px-12 h-11 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white text-[10px] font-black uppercase shadow-lg shadow-red-900/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                      >
                                        {isUploading ? (
                                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <Sparkles className="w-3.5 h-3.5" />
                                        )}
                                        VIYIE SYNC
                                      </button>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <AlertCircle className="w-3 h-3 text-red-500/60 shrink-0 mt-0.5" />
                                      <p className="text-[9px] text-white/30 font-medium">
                                        The system will automatically extract
                                        video IDs and create an embedded
                                        playlist for each episode.
                                      </p>
                                    </div>
                                  </motion.div>
                                )}

                                {isJsonEpisodeMergeOpen && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    className="p-5 bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/20 rounded-2xl space-y-4 overflow-hidden shadow-2xl relative mt-4"
                                  >
                                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                                      Paste Episode JSON Array
                                    </p>
                                    <textarea
                                      value={jsonEpisodeMergeText}
                                      onChange={(e) => setJsonEpisodeMergeText(e.target.value)}
                                      className="w-full h-32 bg-black/60 border border-white/10 rounded-xl p-3 text-xs text-white"
                                      placeholder="[{...}]"
                                    />
                                    <button
                                      onClick={() => {
                                        try {
                                          const parsed = JSON.parse(jsonEpisodeMergeText);
                                          const newEps = [...(editing.episodes || [])];
                                          
                                          parsed.forEach((ep: any) => {
                                            const index = newEps.findIndex((e) => e.number === ep.number);
                                            if (index !== -1) {
                                                newEps[index] = {
                                                    ...newEps[index],
                                                    thumbnail: ep.thumbnail || newEps[index].thumbnail,
                                                    dateUpload: ep.dateUpload || newEps[index].dateUpload,
                                                    servers: [...(newEps[index].servers || []), ...(ep.servers || [])]
                                                };
                                            } else {
                                                newEps.push(ep);
                                            }
                                          });
                                          
                                          setEditing({...editing, episodes: newEps});
                                          toast("Successfully merged JSON episode data!", "success");
                                          setIsJsonEpisodeMergeOpen(false);
                                        } catch (e) {
                                          toast("Invalid JSON format!", "error");
                                        }
                                      }}
                                      className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
                                    >
                                      RUN MERGE
                                    </button>
                                  </motion.div>
                                )}
                                {editing.type === "tv" && (
                                  <div className="p-4 bg-[#e11d48]/5 border border-[#e11d48]/10 rounded-2xl space-y-3.5 shadow-xl mb-4 animate-fade-in font-sans">
                                    <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
                                      {/* Search Episode input */}
                                      <div className="relative flex-1 max-w-sm">
                                        <Search className="w-3.5 h-3.5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                          type="text"
                                          value={episodesSearchQuery}
                                          onChange={(e) => {
                                            setEpisodesSearchQuery(
                                              e.target.value,
                                            );
                                            // Reset page on filter
                                          }}
                                          placeholder="Search Episode # or Title..."
                                          className="w-full h-9 bg-black/60 border border-white/5 pl-9 pr-3 rounded-xl text-[11px] outline-none text-white placeholder-white/20 focus:border-red-500/50 transition-all font-medium"
                                        />
                                        {episodesSearchQuery && (
                                          <button
                                            onClick={() => {
                                              setEpisodesSearchQuery("");
                                            }}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/45 hover:text-white text-[10px]"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>

                                      <div className="text-[10px] font-medium text-white/50 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                                        Showing{" "}
                                        {
                                          (editing.episodes || []).filter(
                                            (ep) => {
                                              if (!episodesSearchQuery)
                                                return true;
                                              const q =
                                                episodesSearchQuery.toLowerCase();
                                              const epNumStr = String(
                                                ep.number || "",
                                              ).toLowerCase();
                                              const titleStr = (
                                                ep.title || ""
                                              ).toLowerCase();
                                              return (
                                                epNumStr.includes(q) ||
                                                titleStr.includes(q) ||
                                                `ep${epNumStr}`.includes(q) ||
                                                `ep ${epNumStr}`.includes(q)
                                              );
                                            },
                                          ).length
                                        }{" "}
                                        of {(editing.episodes || []).length}{" "}
                                        episodes
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {(() => {
                                  const eps = editing.episodes || [];
                                  const filteredWithIdx = eps
                                    .map((ep, originalIdx) => ({
                                      ep,
                                      originalIdx,
                                    }))
                                    .filter(({ ep }) => {
                                      if (!episodesSearchQuery) return true;
                                      const q =
                                        episodesSearchQuery.toLowerCase();
                                      const epNumStr = String(
                                        ep.number || "",
                                      ).toLowerCase();
                                      const titleStr = (
                                        ep.title || ""
                                      ).toLowerCase();
                                      return (
                                        epNumStr.includes(q) ||
                                        titleStr.includes(q) ||
                                        `ep${epNumStr}`.includes(q) ||
                                        `ep ${epNumStr}`.includes(q)
                                      );
                                    });

                                  return filteredWithIdx.map(
                                    ({ ep, originalIdx: idx }) => (
                                      <div
                                        key={idx}
                                        draggable={hoveredInputEpIdx !== idx}
                                        onDragStart={() => {
                                          setDraggedEpIndex(idx);
                                        }}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          if (
                                            draggedEpIndex === null ||
                                            draggedEpIndex === idx
                                          )
                                            return;
                                          const items = Array.from(
                                            editing.episodes || [],
                                          );
                                          const [reorderedItem] = items.splice(
                                            draggedEpIndex,
                                            1,
                                          );
                                          items.splice(idx, 0, reorderedItem);

                                          // The user just wants to reorder list items.
                                          setEditing({
                                            ...editing,
                                            episodes: items,
                                          });
                                          setDraggedEpIndex(null);
                                        }}
                                        onDragEnd={() =>
                                          setDraggedEpIndex(null)
                                        }
                                        className={`p-4 border rounded-xl space-y-3 relative group/ep transition-all ${draggedEpIndex === idx ? "bg-red-500/10 border-red-500/50 scale-[0.98] opacity-80 cursor-grabbing" : hoveredInputEpIdx === idx ? "bg-white/5 border-white/10 cursor-default" : "bg-white/5 border-white/10 cursor-grab hover:border-white/20"}`}
                                      >
                                        <button
                                          onClick={() =>
                                            setEditing({
                                              ...editing,
                                              episodes:
                                                editing.episodes?.filter(
                                                  (_, i) => i !== idx,
                                                ),
                                            })
                                          }
                                          onMouseEnter={() =>
                                            setHoveredInputEpIdx(idx)
                                          }
                                          onMouseLeave={() =>
                                            setHoveredInputEpIdx(null)
                                          }
                                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/ep:opacity-100 transition-opacity z-10"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>

                                        <div className="flex flex-col sm:flex-row gap-4">
                                          <div className="w-full sm:w-40 shrink-0 flex flex-col gap-1.5">
                                            {/* Switch Button above thumbnail */}
                                            <div className="flex bg-white/5 border border-white/10 p-0.5 rounded-lg w-full">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const ne = [...(editing.episodes || [])];
                                                  ne[idx].isCustomPlayer = false;
                                                  setEditing({ ...editing, episodes: ne });
                                                }}
                                                className={`flex-1 py-1 text-[8px] font-black uppercase tracking-wider rounded transition-all cursor-pointer ${
                                                  !ep.isCustomPlayer
                                                    ? "bg-red-600 text-white shadow"
                                                    : "text-white/40 hover:text-white/80"
                                                }`}
                                              >
                                                Server
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const ne = [...(editing.episodes || [])];
                                                  ne[idx].isCustomPlayer = true;
                                                  setEditing({ ...editing, episodes: ne });
                                                }}
                                                className={`flex-1 py-1 text-[8px] font-black uppercase tracking-wider rounded transition-all cursor-pointer ${
                                                  ep.isCustomPlayer
                                                    ? "bg-red-600 text-white shadow"
                                                    : "text-white/40 hover:text-white/80"
                                                }`}
                                              >
                                                Player
                                              </button>
                                            </div>

                                            <div className="w-full aspect-video bg-black rounded-lg overflow-hidden border border-white/10 relative group/thumb">
                                            <img
                                              src={
                                                ep.thumbnail || editing.poster
                                              }
                                              className="w-full h-full object-cover opacity-50 group-hover/thumb:opacity-100 transition-all duration-500 scale-105 group-hover/thumb:scale-100"
                                              referrerPolicy="no-referrer"
                                            />
                                            {!ep.thumbnail && (
                                              <div className="absolute inset-x-0 bottom-0 py-1 bg-black/80 backdrop-blur-sm border-t border-white/10 flex justify-center">
                                                <span className="text-[7px] font-black text-red-500 uppercase tracking-widest">
                                                  Main Poster Fallback
                                                </span>
                                              </div>
                                            )}
                                            <div className="absolute top-2 left-2 bg-red-600 px-1.5 py-0.5 rounded text-[8px] font-black text-white shadow-xl">
                                              EP {ep.number}
                                            </div>
                                          </div>
                                        </div>

                                          <div
                                            className="flex-1 space-y-3"
                                            onMouseEnter={() =>
                                              setHoveredInputEpIdx(idx)
                                            }
                                            onMouseLeave={() =>
                                              setHoveredInputEpIdx(null)
                                            }
                                          >
                                            <div className="grid grid-cols-[80px_1fr] gap-3">
                                              <div>
                                                <label className="text-[8px] font-black text-white/40 uppercase mb-1 block">
                                                  EPNum
                                                </label>
                                                <SafeInput
                                                  type="number"
                                                  value={ep.number ?? ""}
                                                  onChange={(e) => {
                                                    const ne = [
                                                      ...(editing.episodes ||
                                                        []),
                                                    ];
                                                    ne[idx].number = Number(
                                                      e.target.value,
                                                    );
                                                    setEditing({
                                                      ...editing,
                                                      episodes: ne,
                                                    });
                                                  }}
                                                  className="w-full h-8 bg-black/40 border border-white/10 px-2 rounded-lg text-xs font-medium text-red-400 outline-none"
                                                />
                                              </div>
                                              <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                  <label className="text-[8px] font-black text-white/40 uppercase mb-1 block">
                                                    Title
                                                  </label>
                                                  <SafeInput
                                                    value={ep.title || ""}
                                                    onChange={(e) => {
                                                      const ne = [
                                                        ...(editing.episodes ||
                                                          []),
                                                      ];
                                                      ne[idx].title =
                                                        e.target.value;
                                                      setEditing({
                                                        ...editing,
                                                        episodes: ne,
                                                      });
                                                    }}
                                                    className="w-full h-8 bg-black/40 border border-white/10 px-2 rounded-lg text-xs font-medium text-white outline-none"
                                                    placeholder="Episode Title"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="text-[8px] font-black text-white/40 uppercase mb-1 block">
                                                    Date Upload
                                                  </label>
                                                  <SafeInput
                                                    value={ep.dateUpload || ""}
                                                    onChange={(e) => {
                                                      const ne = [
                                                        ...(editing.episodes ||
                                                          []),
                                                      ];
                                                      ne[idx].dateUpload =
                                                        e.target.value;
                                                      setEditing({
                                                        ...editing,
                                                        episodes: ne,
                                                      });
                                                    }}
                                                    className="w-full h-8 bg-black/40 border border-white/10 px-2 rounded-lg text-xs font-medium text-white outline-none"
                                                    placeholder="YYYY-MM-DD"
                                                  />
                                                </div>
                                              </div>
                                              <div>
                                                <label className="text-[8px] font-black text-white/40 uppercase mb-1 block">
                                                  Episode Thumbnail (16:9)
                                                </label>
                                                <SafeInput
                                                  value={ep.thumbnail || ""}
                                                  onChange={(e) => {
                                                    const ne = [
                                                      ...(editing.episodes ||
                                                        []),
                                                    ];
                                                    ne[idx].thumbnail =
                                                      e.target.value;
                                                    setEditing({
                                                      ...editing,
                                                      episodes: ne,
                                                    });
                                                  }}
                                                  className="w-full h-8 bg-black/40 border border-white/10 px-2 rounded-lg text-xs text-white/60 outline-none"
                                                  placeholder="https://.../image.jpg"
                                                />
                                              </div>
                                              {ep.isCustomPlayer && (
                                                <div>
                                                  <label className="text-[8px] font-black text-white/40 uppercase mb-1 block">
                                                    Episode Subtitle URL (.vtt)
                                                  </label>
                                                  <SafeInput
                                                    value={ep.customSubtitle || ""}
                                                    onChange={(e) => {
                                                      const ne = [
                                                        ...(editing.episodes ||
                                                          []),
                                                      ];
                                                      ne[idx].customSubtitle =
                                                        e.target.value;
                                                      setEditing({
                                                        ...editing,
                                                        episodes: ne,
                                                      });
                                                    }}
                                                    className="w-full h-8 bg-black/40 border border-white/10 px-2 rounded-lg text-xs text-white/60 outline-none"
                                                    placeholder="https://.../subtitle.vtt"
                                                  />
                                                </div>
                                              )}
                                            </div>
                                            <div>
                                              <div className="flex items-center justify-between mb-1">
                                                <label className="text-[8px] font-black text-white/40 uppercase block">
                                                  Primary Stream URL
                                                </label>
                                                {ep.url && (
                                                  <div className="flex bg-black/20 rounded-md p-1 border border-white/5 space-x-1">
                                                    <button
                                                      onClick={() =>
                                                        setPlayerPosEditor({
                                                          url: ep.url,
                                                          sandbox:
                                                            ep.useSandbox ||
                                                            false,
                                                          scale:
                                                            ep.playerScale ??
                                                            100,
                                                          translateX:
                                                            ep.playerTranslateX ??
                                                            0,
                                                          translateY:
                                                            ep.playerTranslateY ??
                                                            0,
                                                          onSave: (val) => {
                                                            const ne = [
                                                              ...(editing.episodes ||
                                                                []),
                                                            ];
                                                            ne[idx] = {
                                                              ...ne[idx],
                                                              playerScale:
                                                                val.scale,
                                                              playerTranslateX:
                                                                val.translateX,
                                                              playerTranslateY:
                                                                val.translateY,
                                                            };
                                                            setEditing({
                                                              ...editing,
                                                              episodes: ne,
                                                            });
                                                          },
                                                        })
                                                      }
                                                      className="text-[8px] font-medium uppercase flex items-center text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded shadow-xl hover:bg-orange-400/20"
                                                    >
                                                      <Crop className="w-3 h-3 mr-1" />
                                                      Pos
                                                    </button>
                                                    <button
                                                      onClick={() =>
                                                        setPlayerPreviewUrl({
                                                          url: ep.url,
                                                          sandbox:
                                                            ep.useSandbox ||
                                                            false,
                                                          scale:
                                                            ep.playerScale ??
                                                            100,
                                                          translateX:
                                                            ep.playerTranslateX ??
                                                            0,
                                                          translateY:
                                                            ep.playerTranslateY ??
                                                            0,
                                                        })
                                                      }
                                                      className="text-[8px] font-medium uppercase text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded shadow-xl hover:bg-emerald-400/20"
                                                    >
                                                      Preview
                                                    </button>
                                                  </div>
                                                )}
                                              </div>
                                              {ep.isCustomPlayer && (
                                                <ViyieEmbedLink
                                                  contentId={editing.id}
                                                  episodeNumber={ep.number}
                                                  label="ViyiePlayer Episode Embed Link"
                                                  className="mb-2"
                                                  compact
                                                />
                                              )}
                                              <input
                                                value={ep.url || ""}
                                                onChange={(e) => {
                                                  const newUrl = e.target.value;
                                                  const ne = [
                                                    ...(editing.episodes || []),
                                                  ];
                                                  ne[idx].url = newUrl;

                                                  // Auto-fill thumbnail if empty or default
                                                  const ytId =
                                                    getYouTubeId(newUrl);
                                                  if (
                                                    ytId &&
                                                    (!ne[idx].thumbnail ||
                                                      ne[idx].thumbnail ===
                                                        editing.poster)
                                                  ) {
                                                    ne[idx].thumbnail =
                                                      `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
                                                  }

                                                  setEditing({
                                                    ...editing,
                                                    episodes: ne,
                                                  });
                                                }}
                                                className="w-full h-8 bg-black/40 border border-white/10 px-2 rounded-lg text-xs text-white/60 outline-none focus:border-red-500/30 transition-all font-mono"
                                                placeholder="e.g. https://www.youtube.com/watch?v=..."
                                              />
                                              <div className="mt-1 flex justify-start">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setCustomPrompt({
                                                      isOpen: true,
                                                      title:
                                                        "Enter AbyssPlayer / Hydrax Video Code / ID / Embed Code:",
                                                      value: "",
                                                      onSave: (id) => {
                                                        if (id && id.trim()) {
                                                          const trimmed =
                                                            id.trim();
                                                          const cleaned =
                                                            cleanStreamPayloadUrl(
                                                              trimmed,
                                                            );
                                                          const finalUrl =
                                                            cleaned.startsWith(
                                                              "http",
                                                            ) ||
                                                            cleaned.startsWith(
                                                              "//",
                                                            )
                                                              ? cleaned
                                                              : `https://abyssplayer.com/${cleaned}`;
                                                          const ne = [
                                                            ...(editing.episodes ||
                                                              []),
                                                          ];
                                                          ne[idx].url =
                                                            finalUrl;
                                                          setEditing({
                                                            ...editing,
                                                            episodes: ne,
                                                          });
                                                        }
                                                      },
                                                    });
                                                  }}
                                                  className="mt-2 text-[8px] font-black uppercase tracking-wider text-red-500 bg-red-500/10 px-2 py-0.5 rounded-md hover:bg-red-500/20 flex items-center gap-1 transition-all active:scale-95 border border-red-500/10"
                                                >
                                                  <ExternalLink className="w-2.5 h-2.5" />
                                                  Quick Abyss/Hydrax Link
                                                </button>
                                              </div>
                                              {ep.isCustomPlayer && ep.url && (ep.url.includes(".m3u8") || ep.url.includes(".json") || ep.url.includes("hls") || ep.url.includes("stream")) && (
                                                <div className="mt-2 p-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-lg flex items-center justify-between">
                                                  <div className="space-y-0.5">
                                                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-wider block">
                                                      ‚óè ViyiePlayer Auto-Thumbnail Active
                                                    </span>
                                                    <p className="text-[7px] text-white/40">
                                                      6 visual timeline frames will be auto-generated and saved.
                                                    </p>
                                                  </div>
                                                  {ep.thumbnails && ep.thumbnails.length > 0 && (
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        const ne = [...(editing.episodes || [])];
                                                        ne[idx].thumbnails = [];
                                                        setEditing({ ...editing, episodes: ne });
                                                        alert("Episode thumbnails reset successfully! Frames will regenerate on play.");
                                                      }}
                                                      className="text-[7px] font-black uppercase text-red-400 bg-red-400/10 border border-red-500/15 px-2 py-1 rounded hover:bg-red-400/20 cursor-pointer"
                                                    >
                                                      Reset Frames
                                                    </button>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                              <div className="flex items-center justify-between p-2 bg-black/20 border border-white/5 rounded-lg">
                                                <div className="space-y-0.5">
                                                  <label className="text-[8px] font-black text-white uppercase flex items-center gap-1.5">
                                                    <Image className="w-2.5 h-2.5 text-red-500" />{" "}
                                                    Hide Thmb
                                                  </label>
                                                </div>
                                                <button
                                                  onClick={() => {
                                                    const ne = [
                                                      ...(editing.episodes ||
                                                        []),
                                                    ];
                                                    ne[idx].hideThumbnail =
                                                      !ne[idx].hideThumbnail;
                                                    setEditing({
                                                      ...editing,
                                                      episodes: ne,
                                                    });
                                                  }}
                                                  className={`w-9 h-4.5 rounded-full transition-all relative shrink-0 ${ep.hideThumbnail ? "bg-red-600" : "bg-white/10"}`}
                                                >
                                                  <div
                                                    className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${ep.hideThumbnail ? "right-0.5" : "left-0.5"}`}
                                                  />
                                                </button>
                                              </div>
                                              <div className="flex items-center justify-between p-2 bg-black/20 border border-white/5 rounded-lg">
                                                <div className="space-y-0.5">
                                                  <label className="text-[8px] font-black text-white uppercase flex items-center gap-1.5">
                                                    <MonitorPlay className="w-2.5 h-2.5 text-red-500" />{" "}
                                                    Popup
                                                  </label>
                                                </div>
                                                <button
                                                  onClick={() => {
                                                    const ne = [
                                                      ...(editing.episodes ||
                                                        []),
                                                    ];
                                                    ne[idx].useExternalPopup =
                                                      !ne[idx].useExternalPopup;
                                                    ne[idx].useExternalTab =
                                                      false;
                                                    setEditing({
                                                      ...editing,
                                                      episodes: ne,
                                                    });
                                                  }}
                                                  className={`w-9 h-4.5 rounded-full transition-all relative shrink-0 ${ep.useExternalPopup ? "bg-red-600" : "bg-white/10"}`}
                                                >
                                                  <div
                                                    className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${ep.useExternalPopup ? "right-0.5" : "left-0.5"}`}
                                                  />
                                                </button>
                                              </div>
                                              <div className="flex items-center justify-between p-2 bg-black/20 border border-white/5 rounded-lg">
                                                <div className="space-y-0.5">
                                                  <label className="text-[8px] font-black text-white uppercase flex items-center gap-1.5">
                                                    <ExternalLink className="w-2.5 h-2.5 text-red-500" />{" "}
                                                    Tab
                                                  </label>
                                                </div>
                                                <button
                                                  onClick={() => {
                                                    const ne = [
                                                      ...(editing.episodes ||
                                                        []),
                                                    ];
                                                    ne[idx].useExternalTab =
                                                      !ne[idx].useExternalTab;
                                                    ne[idx].useExternalPopup =
                                                      false;
                                                    setEditing({
                                                      ...editing,
                                                      episodes: ne,
                                                    });
                                                  }}
                                                  className={`w-9 h-4.5 rounded-full transition-all relative shrink-0 ${ep.useExternalTab ? "bg-red-600" : "bg-white/10"}`}
                                                >
                                                  <div
                                                    className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${ep.useExternalTab ? "right-0.5" : "left-0.5"}`}
                                                  />
                                                </button>
                                              </div>
                                              <div className="flex items-center justify-between col-span-2 md:col-span-1 p-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                                                <div className="space-y-0.5">
                                                  <label className="text-[8px] font-black text-emerald-400 uppercase flex items-center gap-1.5">
                                                    <ShieldCheck className="w-2.5 h-2.5" />{" "}
                                                    Ad Protect
                                                  </label>
                                                </div>
                                                <button
                                                  onClick={() => {
                                                    const ne = [
                                                      ...(editing.episodes ||
                                                        []),
                                                    ];
                                                    ne[idx].useSandbox =
                                                      !ne[idx].useSandbox;
                                                    setEditing({
                                                      ...editing,
                                                      episodes: ne,
                                                    });
                                                  }}
                                                  className={`w-9 h-4.5 rounded-full transition-all relative shrink-0 ${ep.useSandbox ? "bg-emerald-500" : "bg-emerald-500/20"}`}
                                                >
                                                  <div
                                                    className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${ep.useSandbox ? "right-0.5" : "left-0.5"}`}
                                                  />
                                                </button>
                                              </div>

                                              <div className="flex items-center justify-between p-2 bg-black/20 border border-white/5 rounded-lg">
                                                <div className="space-y-0.5">
                                                  <label className="text-[8px] font-black text-white uppercase flex items-center gap-1.5">
                                                    <MonitorPlay className="w-2.5 h-2.5 text-red-500" />{" "}
                                                    Iframe
                                                  </label>
                                                </div>
                                                <button
                                                  onClick={() => {
                                                    const ne = [
                                                      ...(editing.episodes ||
                                                        []),
                                                    ];
                                                    ne[idx].forceIframe =
                                                      !ne[idx].forceIframe;
                                                    ne[idx].isCustomPlayer =
                                                      false;
                                                    setEditing({
                                                      ...editing,
                                                      episodes: ne,
                                                    });
                                                  }}
                                                  className={`w-9 h-4.5 rounded-full transition-all relative shrink-0 ${ep.forceIframe ? "bg-red-600" : "bg-white/10"}`}
                                                >
                                                  <div
                                                    className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${ep.forceIframe ? "right-0.5" : "left-0.5"}`}
                                                  />
                                                </button>
                                              </div>

                                              <div className="flex items-center justify-between p-2 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                                                <div className="space-y-0.5">
                                                  <label className="text-[8px] font-black text-blue-400 uppercase flex items-center gap-1.5">
                                                    <Sparkles className="w-2.5 h-2.5 text-blue-400" />{" "}
                                                    Remote
                                                  </label>
                                                </div>
                                                <button
                                                  onClick={() => {
                                                    const ne = [
                                                      ...(editing.episodes ||
                                                        []),
                                                    ];
                                                    ne[idx].isCustomPlayer =
                                                      !ne[idx].isCustomPlayer;
                                                    ne[idx].forceIframe = false;
                                                    setEditing({
                                                      ...editing,
                                                      episodes: ne,
                                                    });
                                                  }}
                                                  className={`w-9 h-4.5 rounded-full transition-all relative shrink-0 ${ep.isCustomPlayer ? "bg-blue-500" : "bg-blue-500/20"}`}
                                                >
                                                  <div
                                                    className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${ep.isCustomPlayer ? "right-0.5" : "left-0.5"}`}
                                                  />
                                                </button>
                                              </div>
                                            </div>

                                            {ep.isCustomPlayer && (
                                              <div className="space-y-2 p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg transition-all duration-300">
                                                <AdminSubtitleManager
                                                  value={
                                                    ep.customSubtitle || ""
                                                  }
                                                  onChange={(val) => {
                                                    setEditing((prev) => {
                                                      if (!prev) return null;
                                                      const ne = (
                                                        prev.episodes || []
                                                      ).map(
                                                        (epItem, epIndex) => {
                                                          if (epIndex !== idx)
                                                            return epItem;
                                                          return {
                                                            ...epItem,
                                                            customSubtitle: val,
                                                          };
                                                        },
                                                      );
                                                      return {
                                                        ...prev,
                                                        episodes: ne,
                                                      };
                                                    });
                                                  }}
                                                  label="Episode Custom Subtitles (.vtt/.srt)"
                                                />
                                                <div className="space-y-1">
                                                  <label className="text-[8px] font-black text-blue-400 uppercase tracking-wider block">
                                                    Custom Resolutions JSON
                                                  </label>
                                                  <textarea
                                                    value={
                                                      ep.customResolutions || ""
                                                    }
                                                    onChange={(e) => {
                                                      const newVal =
                                                        e.target.value;
                                                      setEditing((prev) => {
                                                        if (!prev) return null;
                                                        const ne = (
                                                          prev.episodes || []
                                                        ).map(
                                                          (epItem, epIndex) => {
                                                            if (epIndex !== idx)
                                                              return epItem;
                                                            return {
                                                              ...epItem,
                                                              customResolutions:
                                                                newVal,
                                                            };
                                                          },
                                                        );
                                                        return {
                                                          ...prev,
                                                          episodes: ne,
                                                        };
                                                      });
                                                    }}
                                                    className="w-full h-16 bg-black/40 border border-white/10 p-2 rounded-lg text-[10px] text-white/80 font-mono outline-none focus:border-blue-500"
                                                    placeholder='[\n  { "res": "1080p", "url": "..." }\n]'
                                                  />
                                                </div>
                                              </div>
                                            )}

                                            {/* Episode PLAY1 / PLAY2 Custom Naming & Visibility Hide-Show Toggle */}
                                            <div className="space-y-2 p-2.5 bg-white/5 border border-white/5 rounded-lg">
                                              <div className="flex items-center justify-between">
                                                <span className="text-[8px] font-black text-white/50 uppercase flex items-center gap-1">
                                                  {ep.hidePlay1 ? (
                                                    <EyeOff className="w-3 h-3 text-red-500 animate-pulse" />
                                                  ) : (
                                                    <Eye className="w-3 h-3 text-emerald-400" />
                                                  )}
                                                  PLAY1 Option (Failsafe)
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const ne = [
                                                      ...(editing.episodes ||
                                                        []),
                                                    ];
                                                    ne[idx].hidePlay1 =
                                                      !ne[idx].hidePlay1;
                                                    setEditing({
                                                      ...editing,
                                                      episodes: ne,
                                                    });
                                                  }}
                                                  className={`text-[8px] font-medium px-2 py-0.5 rounded transition-all ${
                                                    ep.hidePlay1
                                                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                                                  }`}
                                                >
                                                  {ep.hidePlay1
                                                    ? "Hidden"
                                                    : "Visible"}
                                                </button>
                                              </div>
                                              <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                  <label className="text-[8px] font-medium text-white/30 uppercase block mb-0.5">
                                                    PLAY1 Name
                                                  </label>
                                                  <SafeInput
                                                    value={
                                                      ep.play1DisplayName || ""
                                                    }
                                                    onChange={(e) => {
                                                      const ne = [
                                                        ...(editing.episodes ||
                                                          []),
                                                      ];
                                                      ne[idx].play1DisplayName =
                                                        e.target.value;
                                                      setEditing({
                                                        ...editing,
                                                        episodes: ne,
                                                      });
                                                    }}
                                                    className="w-full h-8 bg-black/40 border border-white/10 rounded px-2 text-[10px] text-white outline-none"
                                                    placeholder="Default: PLAY1"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="text-[8px] font-medium text-white/30 uppercase block mb-0.5">
                                                    PLAY2 Name
                                                  </label>
                                                  <SafeInput
                                                    value={
                                                      ep.play2DisplayName || ""
                                                    }
                                                    onChange={(e) => {
                                                      const ne = [
                                                        ...(editing.episodes ||
                                                          []),
                                                      ];
                                                      ne[idx].play2DisplayName =
                                                        e.target.value;
                                                      setEditing({
                                                        ...editing,
                                                        episodes: ne,
                                                      });
                                                    }}
                                                    className="w-full h-8 bg-black/40 border border-white/10 rounded px-2 text-[10px] text-white outline-none"
                                                    placeholder="Default: PLAY2"
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Alternate Servers for Episode */}
                                        <div className="pt-2 border-t border-white/5 space-y-2 mt-2">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[8px] font-black text-white/40 uppercase block">
                                              Alt Servers
                                            </span>
                                            <div className="flex items-center gap-1">
                                              {[
                                                "YouTube",
                                                "Hydrax",
                                                "TurboVIP",
                                                "Dailymotion",
                                                "Remote Drive",
                                                "RemoteRum",
                                              ].map((sname) => (
                                                <button
                                                  key={sname}
                                                  onClick={() => {
                                                    const ne = [
                                                      ...(editing.episodes ||
                                                        []),
                                                    ];
                                                    ne[idx].servers = [
                                                      ...(ne[idx].servers ||
                                                        []),
                                                      {
                                                        name: sname === "RemoteRum" ? "Video Remote" : sname,
                                                        embedUrl: sname === "RemoteRum" ? JSON.stringify({
                                                          type: "remotevideo",
                                                          displayName: "Video Remote",
                                                          subtitleUrl: "",
                                                          streams: [],
                                                        }, null, 2) : "",
                                                        useExternalPopup: false,
                                                        useExternalTab: false,
                                                      },
                                                    ];
                                                    setEditing({
                                                      ...editing,
                                                      episodes: ne,
                                                    });
                                                  }}
                                                  className="text-[7px] font-medium px-1.5 py-0.5 rounded bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all text-[8px]"
                                                >
                                                  + {sname}
                                                </button>
                                              ))}
                                              <button
                                                onClick={() => {
                                                  const ne = [
                                                    ...(editing.episodes || []),
                                                  ];
                                                  ne[idx].servers = [
                                                    ...(ne[idx].servers || []),
                                                    {
                                                      name: "New Server",
                                                      embedUrl: "",
                                                      useExternalPopup: false,
                                                      useExternalTab: false,
                                                    },
                                                  ];
                                                  setEditing({
                                                    ...editing,
                                                    episodes: ne,
                                                  });
                                                }}
                                                className="text-[8px] font-medium text-orange-400 hover:text-orange-300 flex items-center gap-1 ml-1.5"
                                              >
                                                + ADD
                                              </button>

                                            </div>
                                          </div>

                                          {ep.servers?.map((sv, svIdx) => {
                                            const isSrvVisible =
                                              sv.visible !== false;
                                            const isSrvViyiePlus =
                                              sv.isViyiePlus === true;
                                            const isCustomPlay =
                                              sv.isCustomPlayer ||
                                              sv.name === "Remote Drive" ||
                                              sv.name === "Remote Drive Player" ||
                                              sv.name === "Video Remote" ||
                                              sv.name
                                                ?.toLowerCase()
                                                .includes("remote drive") ||
                                              sv.name
                                                ?.toLowerCase()
                                                .includes("remotevideo") ||
                                              (sv.embedUrl
                                                ? /(?:drive|docs)\.google\.com/i.test(
                                                    sv.embedUrl,
                                                  ) || sv.embedUrl.includes("remotevideo")
                                                : false);

                                            return (
                                              <div
                                                key={svIdx}
                                                className={`space-y-2 p-2 rounded-lg border transition-all ${
                                                  isSrvViyiePlus
                                                    ? "border-amber-500/40 bg-amber-500/[0.02]"
                                                    : "border-white/5 bg-black/20"
                                                }`}
                                              >
                                                <div className="flex gap-2 items-center justify-between">
                                                  <div className="flex-1 flex gap-1 items-center">
                                                    <SafeInput
                                                      value={sv.name || ""}
                                                      onChange={(e) => {
                                                        const ne = [
                                                          ...(editing.episodes ||
                                                            []),
                                                        ];
                                                        const ns = [
                                                          ...(ne[idx].servers ||
                                                            []),
                                                        ];
                                                        ns[svIdx].name =
                                                          e.target.value;
                                                        ne[idx].servers = ns;
                                                        setEditing({
                                                          ...editing,
                                                          episodes: ne,
                                                        });
                                                      }}
                                                      className={`w-2/5 h-7 bg-transparent border-b border-white/10 px-1 text-[10px] font-medium outline-none transition-colors ${
                                                        isSrvViyiePlus
                                                          ? "text-amber-400 placeholder-amber-400/50"
                                                          : "text-red-500"
                                                      }`}
                                                      placeholder="Server Name"
                                                    />

                                                    <div className="flex-1 flex items-center justify-end gap-1 shrink-0">
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          const ne = [
                                                            ...(editing.episodes ||
                                                              []),
                                                          ];
                                                          const ns = [
                                                            ...(ne[idx]
                                                              .servers || []),
                                                          ];
                                                          ns[
                                                            svIdx
                                                          ].isViyiePlus =
                                                            !isSrvViyiePlus;
                                                          ne[idx].servers = ns;
                                                          setEditing({
                                                            ...editing,
                                                            episodes: ne,
                                                          });
                                                        }}
                                                        className={`px-1 py-0.5 rounded text-[7px] font-black uppercase flex items-center gap-0.5 border transition-all ${
                                                          isSrvViyiePlus
                                                            ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                                                            : "bg-white/5 text-white/40 border-transparent hover:text-white"
                                                        }`}
                                                        title="Restrict to Viyie+ users"
                                                      >
                                                        <Sparkles className="w-2 h-2" />
                                                        V+
                                                      </button>

                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          const ne = [
                                                            ...(editing.episodes ||
                                                              []),
                                                          ];
                                                          const ns = [
                                                            ...(ne[idx]
                                                              .servers || []),
                                                          ];
                                                          ns[svIdx].visible =
                                                            !isSrvVisible;
                                                          ne[idx].servers = ns;
                                                          setEditing({
                                                            ...editing,
                                                            episodes: ne,
                                                          });
                                                        }}
                                                        className={`w-6 h-6 rounded flex items-center justify-center border transition-all ${
                                                          isSrvVisible
                                                            ? "bg-white/5 text-white border-white/10 hover:bg-white/10"
                                                            : "bg-red-500/10 text-red-400 border-red-500/20"
                                                        }`}
                                                        title={
                                                          isSrvVisible
                                                            ? "Server is Visible"
                                                            : "Server is Hidden"
                                                        }
                                                      >
                                                        {isSrvVisible ? (
                                                          <Eye className="w-2.5 h-2.5" />
                                                        ) : (
                                                          <EyeOff className="w-2.5 h-2.5" />
                                                        )}
                                                      </button>
                                                    </div>
                                                  </div>

                                                  <button
                                                    onClick={() => {
                                                      const ne = [
                                                        ...(editing.episodes ||
                                                          []),
                                                      ];
                                                      ne[idx].servers = ne[
                                                        idx
                                                      ].servers?.filter(
                                                        (_, i) => i !== svIdx,
                                                      );
                                                      setEditing({
                                                        ...editing,
                                                        episodes: ne,
                                                      });
                                                    }}
                                                    className="text-white/20 hover:text-red-400 px-1 shrink-0"
                                                  >
                                                    <X className="w-3 h-3" />
                                                  </button>
                                                </div>

                                                {isSrvVisible ? (
                                                  <div className="space-y-2">
                                                    {isCustomPlay && (
                                                      <ViyieEmbedLink
                                                        contentId={editing.id}
                                                        episodeNumber={ep.number}
                                                        label={`ViyiePlayer Embed Link (${sv.name || "Remote Drive"})`}
                                                        className="mb-1"
                                                        compact
                                                      />
                                                    )}
                                                    <div className="flex gap-2 items-center">
                                                      <ServerEmbedInput
                                                        value={sv.embedUrl || ""}
                                                        onChange={(val) => {
                                                          const ne = [
                                                            ...(editing.episodes ||
                                                              []),
                                                          ];
                                                          const ns = [
                                                            ...(ne[idx]
                                                              .servers || []),
                                                          ];
                                                          ns[svIdx].embedUrl = val;
                                                          ne[idx].servers = ns;
                                                          setEditing({
                                                            ...editing,
                                                            episodes: ne,
                                                          });
                                                        }}
                                                        className="w-full h-7 bg-transparent px-1 text-[10px] text-white/60 outline-none border-b border-white/10"
                                                        placeholder={
                                                          isCustomPlay
                                                            ? "Default Video URL (.mp4)"
                                                            : "URL"
                                                        }
                                                      />
                                                      {sv.embedUrl &&
                                                        !isCustomPlay && (
                                                          <div className="flex bg-black/20 rounded pl-1 pr-1 border border-white/5 space-x-1 shrink-0 mr-1">
                                                            <button
                                                              onClick={() =>
                                                                setPlayerPosEditor(
                                                                  {
                                                                    url: sv.embedUrl,
                                                                    sandbox:
                                                                      sv.useSandbox ||
                                                                      false,
                                                                    scale:
                                                                      sv.playerScale ??
                                                                      100,
                                                                    translateX:
                                                                      sv.playerTranslateX ??
                                                                      0,
                                                                    translateY:
                                                                      sv.playerTranslateY ??
                                                                      0,
                                                                    onSave: (
                                                                      val,
                                                                    ) => {
                                                                      const ne =
                                                                        [
                                                                          ...(editing.episodes ||
                                                                            []),
                                                                        ];
                                                                      const ns =
                                                                        [
                                                                          ...(ne[
                                                                            idx
                                                                          ]
                                                                            .servers ||
                                                                            []),
                                                                        ];
                                                                      ns[
                                                                        svIdx
                                                                      ] = {
                                                                        ...ns[
                                                                          svIdx
                                                                        ],
                                                                        playerScale:
                                                                          val.scale,
                                                                        playerTranslateX:
                                                                          val.translateX,
                                                                        playerTranslateY:
                                                                          val.translateY,
                                                                      };
                                                                      ne[
                                                                        idx
                                                                      ].servers =
                                                                        ns;
                                                                      setEditing(
                                                                        {
                                                                          ...editing,
                                                                          episodes:
                                                                            ne,
                                                                        },
                                                                      );
                                                                    },
                                                                  },
                                                                )
                                                              }
                                                              className="text-[8px] font-medium uppercase flex items-center text-orange-400 bg-orange-400/10 px-1 py-0.5 rounded hover:bg-orange-400/20"
                                                            >
                                                              <Crop className="w-3 h-3 mr-0.5" />
                                                              Pos
                                                            </button>
                                                            <button
                                                              onClick={() =>
                                                                setPlayerPreviewUrl(
                                                                  {
                                                                    url: sv.embedUrl,
                                                                    sandbox:
                                                                      sv.useSandbox ||
                                                                      false,
                                                                    scale:
                                                                      sv.playerScale ??
                                                                      100,
                                                                    translateX:
                                                                      sv.playerTranslateX ??
                                                                      0,
                                                                    translateY:
                                                                      sv.playerTranslateY ??
                                                                      0,
                                                                  },
                                                                )
                                                              }
                                                              className="text-[8px] font-medium uppercase text-emerald-400 bg-emerald-400/10 px-1 py-0.5 rounded hover:bg-emerald-400/20"
                                                            >
                                                              Preview
                                                            </button>
                                                          </div>
                                                        )}
                                                    </div>
                                                    <div className="mt-3 flex justify-start">
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          setCustomPrompt({
                                                            isOpen: true,
                                                            title:
                                                              "Enter AbyssPlayer / Hydrax Video Code / ID / Embed Code:",
                                                            value: "",
                                                            onSave: (id) => {
                                                              if (
                                                                id &&
                                                                id.trim()
                                                              ) {
                                                                const trimmed =
                                                                  id.trim();
                                                                const cleaned =
                                                                  cleanStreamPayloadUrl(
                                                                    trimmed,
                                                                  );
                                                                const finalUrl =
                                                                  cleaned.startsWith(
                                                                    "http",
                                                                  ) ||
                                                                  cleaned.startsWith(
                                                                    "//",
                                                                  )
                                                                    ? cleaned
                                                                    : `https://abyssplayer.com/${cleaned}`;
                                                                const ne = [
                                                                  ...(editing.episodes ||
                                                                    []),
                                                                ];
                                                                const ns = [
                                                                  ...(ne[idx]
                                                                    .servers ||
                                                                    []),
                                                                ];
                                                                ns[
                                                                  svIdx
                                                                ].embedUrl =
                                                                  finalUrl;
                                                                ne[
                                                                  idx
                                                                ].servers = ns;
                                                                setEditing({
                                                                  ...editing,
                                                                  episodes: ne,
                                                                });
                                                              }
                                                            },
                                                          });
                                                        }}
                                                        className="mt-2 text-[8px] font-black uppercase tracking-wider text-red-500 bg-red-500/10 px-2 py-0.5 rounded-md hover:bg-red-500/20 flex items-center gap-1 transition-all active:scale-95 border border-red-500/10"
                                                      >
                                                        <ExternalLink className="w-2.5 h-2.5" />
                                                        Quick Abyss/Hydrax Link
                                                      </button>
                                                    </div>

                                                    {isCustomPlay && (
                                                      <div className="flex flex-col gap-2 pt-1 font-sans">
                                                        <AdminSubtitleManager
                                                          value={
                                                            sv.customSubtitle ||
                                                            ""
                                                          }
                                                          onChange={(val) => {
                                                            setEditing(
                                                              (prev) => {
                                                                if (!prev)
                                                                  return null;
                                                                const ne = (
                                                                  prev.episodes ||
                                                                  []
                                                                ).map(
                                                                  (
                                                                    epItem,
                                                                    epIndex,
                                                                  ) => {
                                                                    if (
                                                                      epIndex !==
                                                                      idx
                                                                    )
                                                                      return epItem;
                                                                    const ns = (
                                                                      epItem.servers ||
                                                                      []
                                                                    ).map(
                                                                      (
                                                                        srvItem,
                                                                        srvIndex,
                                                                      ) => {
                                                                        if (
                                                                          srvIndex !==
                                                                          svIdx
                                                                        )
                                                                          return srvItem;
                                                                        return {
                                                                          ...srvItem,
                                                                          customSubtitle:
                                                                            val,
                                                                        };
                                                                      },
                                                                    );
                                                                    return {
                                                                      ...epItem,
                                                                      servers:
                                                                        ns,
                                                                    };
                                                                  },
                                                                );
                                                                return {
                                                                  ...prev,
                                                                  episodes: ne,
                                                                };
                                                              },
                                                            );
                                                          }}
                                                          label="Server Custom Subtitles (.vtt/.srt)"
                                                        />
                                                        <textarea
                                                          value={
                                                            sv.customResolutions ||
                                                            ""
                                                          }
                                                          onChange={(e) => {
                                                            const newVal =
                                                              e.target.value;
                                                            setEditing(
                                                              (prev) => {
                                                                if (!prev)
                                                                  return null;
                                                                const ne = (
                                                                  prev.episodes ||
                                                                  []
                                                                ).map(
                                                                  (
                                                                    epItem,
                                                                    epIndex,
                                                                  ) => {
                                                                    if (
                                                                      epIndex !==
                                                                      idx
                                                                    )
                                                                      return epItem;
                                                                    const ns = (
                                                                      epItem.servers ||
                                                                      []
                                                                    ).map(
                                                                      (
                                                                        srvItem,
                                                                        srvIndex,
                                                                      ) => {
                                                                        if (
                                                                          srvIndex !==
                                                                          svIdx
                                                                        )
                                                                          return srvItem;
                                                                        return {
                                                                          ...srvItem,
                                                                          customResolutions:
                                                                            newVal,
                                                                        };
                                                                      },
                                                                    );
                                                                    return {
                                                                      ...epItem,
                                                                      servers:
                                                                        ns,
                                                                    };
                                                                  },
                                                                );
                                                                return {
                                                                  ...prev,
                                                                  episodes: ne,
                                                                };
                                                              },
                                                            );
                                                          }}
                                                          className="w-full h-12 bg-black/40 border border-white/10 rounded p-1 text-[9px] text-white/60 outline-none focus:border-blue-500 font-mono"
                                                          placeholder='Resolutions JSON: [{"res":"1080p","url":"http..."}]'
                                                        />

                                                        {/* Dynamic Share & Iframe link route builder */}
                                                        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-2 space-y-2 mt-1">
                                                          <div className="text-[9px] font-medium text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                                                            <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                                                            Embed & Secure Share
                                                            Details
                                                          </div>
                                                          <div className="space-y-1">
                                                            <div className="flex items-center justify-between text-[8px] text-white/50">
                                                              <span>
                                                                Direct Stream
                                                                Link:
                                                              </span>
                                                              <button
                                                                type="button"
                                                                onClick={() => {
                                                                  navigator.clipboard.writeText(
                                                                    `${window.location.origin}/play.id/${editing.id}_ep${ep.number}`,
                                                                  );
                                                                  alert(
                                                                    "Direct Stream link copied successfully!",
                                                                  );
                                                                }}
                                                                className="text-red-400 hover:underline hover:text-red-300"
                                                              >
                                                                Copy
                                                              </button>
                                                            </div>
                                                            <input
                                                              readOnly
                                                              value={`${window.location.origin}/play.id/${editing.id}_ep${ep.number}`}
                                                              className="w-full h-6 bg-black/60 border border-white/5 rounded px-1.5 text-[8px] text-white/40 select-all outline-none"
                                                            />
                                                          </div>
                                                          <div className="space-y-1">
                                                            <div className="flex items-center justify-between text-[8px] text-white/50">
                                                              <span>
                                                                Iframe Code
                                                                Snippet:
                                                              </span>
                                                              <button
                                                                type="button"
                                                                onClick={() => {
                                                                  const code = `<iframe src="${window.location.origin}/play.id/${editing.id}_ep${ep.number}" width="100%" height="450px" allowfullscreen style="border:none;border-radius:12px;"></iframe>`;
                                                                  navigator.clipboard.writeText(
                                                                    code,
                                                                  );
                                                                  alert(
                                                                    "Iframe snippet copied successfully!",
                                                                  );
                                                                }}
                                                                className="text-red-400 hover:underline hover:text-red-300"
                                                              >
                                                                Copy
                                                              </button>
                                                            </div>
                                                            <input
                                                              readOnly
                                                              value={`<iframe src="${window.location.origin}/play.id/${editing.id}_ep${ep.number}" width="100%" height="450px" allowfullscreen style="border:none;border-radius:12px;"></iframe>`}
                                                              className="w-full h-6 bg-black/60 border border-white/5 rounded px-1.5 text-[8px] text-white/40 select-all outline-none"
                                                            />
                                                          </div>
                                                          <div className="space-y-1">
                                                            <div className="flex items-center justify-between text-[8px] text-white/50 animate-pulse">
                                                              <span>
                                                                Secure Download
                                                                Page:
                                                              </span>
                                                              <button
                                                                type="button"
                                                                onClick={() => {
                                                                  navigator.clipboard.writeText(
                                                                    `${window.location.origin}/dow.id/${editing.id}_ep${ep.number}`,
                                                                  );
                                                                  alert(
                                                                    "Download link copied successfully!",
                                                                  );
                                                                }}
                                                                className="text-red-400 hover:underline hover:text-red-300"
                                                              >
                                                                Copy
                                                              </button>
                                                            </div>
                                                            <input
                                                              readOnly
                                                              value={`${window.location.origin}/dow.id/${editing.id}_ep${ep.number}`}
                                                              className="w-full h-6 bg-black/60 border border-white/5 rounded px-1.5 text-[8px] text-white/40 select-all outline-none"
                                                            />
                                                          </div>
                                                        </div>
                                                      </div>
                                                    )}

                                                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 font-sans">
                                                      <div className="flex items-center justify-between p-1 px-2 bg-white/5 rounded-md border border-white/5">
                                                        <div className="flex items-center gap-1.5">
                                                          <MonitorPlay className="w-2.5 h-2.5 text-red-500" />
                                                          <span className="text-[7px] font-black text-white/40 uppercase">
                                                            Popup
                                                          </span>
                                                        </div>
                                                        <button
                                                          onClick={() => {
                                                            const ne = [
                                                              ...(editing.episodes ||
                                                                []),
                                                            ];
                                                            const ns = [
                                                              ...(ne[idx]
                                                                .servers || []),
                                                            ];
                                                            ns[
                                                              svIdx
                                                            ].useExternalPopup =
                                                              !ns[svIdx]
                                                                .useExternalPopup;
                                                            ns[
                                                              svIdx
                                                            ].useExternalTab =
                                                              false;
                                                            ne[idx].servers =
                                                              ns;
                                                            setEditing({
                                                              ...editing,
                                                              episodes: ne,
                                                            });
                                                          }}
                                                          className={`w-7 h-3.5 rounded-full transition-all relative shrink-0 ${sv.useExternalPopup ? "bg-red-600" : "bg-white/10"}`}
                                                        >
                                                          <div
                                                            className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${sv.useExternalPopup ? "right-0.5" : "left-0.5"}`}
                                                          />
                                                        </button>
                                                      </div>
                                                      <div className="flex items-center justify-between p-1 px-2 bg-white/5 rounded-md border border-white/5">
                                                        <div className="flex items-center gap-1.5">
                                                          <ExternalLink className="w-2.5 h-2.5 text-red-500" />
                                                          <span className="text-[7px] font-black text-white/40 uppercase">
                                                            Tab
                                                          </span>
                                                        </div>
                                                        <button
                                                          onClick={() => {
                                                            const ne = [
                                                              ...(editing.episodes ||
                                                                []),
                                                            ];
                                                            const ns = [
                                                              ...(ne[idx]
                                                                .servers || []),
                                                            ];
                                                            ns[
                                                              svIdx
                                                            ].useExternalTab =
                                                              !ns[svIdx]
                                                                .useExternalTab;
                                                            ns[
                                                              svIdx
                                                            ].useExternalPopup =
                                                              false;
                                                            ne[idx].servers =
                                                              ns;
                                                            setEditing({
                                                              ...editing,
                                                              episodes: ne,
                                                            });
                                                          }}
                                                          className={`w-7 h-3.5 rounded-full transition-all relative shrink-0 ${sv.useExternalTab ? "bg-red-600" : "bg-white/10"}`}
                                                        >
                                                          <div
                                                            className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${sv.useExternalTab ? "right-0.5" : "left-0.5"}`}
                                                          />
                                                        </button>
                                                      </div>
                                                      <div className="flex items-center justify-between col-span-2 lg:col-span-1 p-1 px-2 bg-emerald-500/5 rounded-md border border-emerald-500/10">
                                                        <div className="flex items-center gap-1.5">
                                                          <ShieldCheck className="w-2 h-2 text-emerald-400" />
                                                          <span className="text-[7px] font-black text-emerald-400 uppercase">
                                                            Sandbox
                                                          </span>
                                                        </div>
                                                        <button
                                                          onClick={() => {
                                                            const ne = [
                                                              ...(editing.episodes ||
                                                                []),
                                                            ];
                                                            const ns = [
                                                              ...(ne[idx]
                                                                .servers || []),
                                                            ];
                                                            ns[
                                                              svIdx
                                                            ].useSandbox =
                                                              !ns[svIdx]
                                                                .useSandbox;
                                                            ne[idx].servers =
                                                              ns;
                                                            setEditing({
                                                              ...editing,
                                                              episodes: ne,
                                                            });
                                                          }}
                                                          className={`w-7 h-3.5 rounded-full transition-all relative shrink-0 ${sv.useSandbox ? "bg-emerald-500" : "bg-emerald-500/20"}`}
                                                        >
                                                          <div
                                                            className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${sv.useSandbox ? "right-0.5" : "left-0.5"}`}
                                                          />
                                                        </button>
                                                      </div>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <div className="text-[7px] text-white/30 italic px-1 font-sans">
                                                    Configuration options
                                                    hidden. Enable the eye
                                                    toggle above to edit.
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ),
                                  );
                                })()}
                              </div>
                            )}

                            {editing.type === "tv" && !isEditingSubPage && (
                              <div className="pt-6 border-t border-white/5 space-y-4">
                                <div className="flex flex-col">
                                  <label className="text-[10px] font-black text-white/40 uppercase">
                                    Season Connections
                                  </label>
                                  <p className="text-[9px] text-white/30 font-medium italic">
                                    Link other TV Show entries as different
                                    seasons
                                  </p>
                                </div>
                                <div className="space-y-3">
                                  {editing.seasonConnections?.map(
                                    (conn, sIdx) => (
                                      <div
                                        key={sIdx}
                                        className="flex gap-2 items-end bg-white/5 border border-white/10 p-3 rounded-xl relative group/conn"
                                      >
                                        <button
                                          onClick={() => {
                                            const nc = [
                                              ...(editing.seasonConnections ||
                                                []),
                                            ];
                                            nc.splice(sIdx, 1);
                                            setEditing({
                                              ...editing,
                                              seasonConnections: nc,
                                            });
                                          }}
                                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover/conn:opacity-100 transition-opacity z-10"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                        <div className="w-20">
                                          <label className="text-[8px] font-medium text-white/40 uppercase mb-1 block">
                                            Season #
                                          </label>
                                          <SafeInput
                                            type="number"
                                            value={conn.seasonNumber ?? ""}
                                            onChange={(e) => {
                                              const nc = [
                                                ...(editing.seasonConnections ||
                                                  []),
                                              ];
                                              nc[sIdx].seasonNumber =
                                                parseInt(e.target.value) || 0;
                                              setEditing({
                                                ...editing,
                                                seasonConnections: nc,
                                              });
                                            }}
                                            className="w-full h-8 bg-black/40 border border-white/10 rounded-lg px-2 text-xs text-white outline-none focus:border-red-500"
                                          />
                                        </div>
                                        <div className="flex-1">
                                          <label className="text-[8px] font-medium text-white/40 uppercase mb-1 block">
                                            Search TV Show Entry
                                          </label>
                                          <SearchableSelect
                                            value={conn.contentId || ""}
                                            onChange={(val) => {
                                              const target = contents.find(
                                                (c) => String(c.id) === val,
                                              );
                                              const nc = [
                                                ...(editing.seasonConnections ||
                                                  []),
                                              ];
                                              nc[sIdx].contentId = val;
                                              nc[sIdx].title =
                                                target?.title || "";
                                              setEditing({
                                                ...editing,
                                                seasonConnections: nc,
                                              });
                                            }}
                                            options={contents
                                              .filter(
                                                (c) =>
                                                  c.type === "tv" &&
                                                  String(c.id) !==
                                                    String(editing.id),
                                              )
                                              .map((c) => ({
                                                label: c.title,
                                                value: String(c.id),
                                                poster: c.poster,
                                              }))}
                                            placeholder="Select TV Show..."
                                          />
                                        </div>
                                      </div>
                                    ),
                                  )}
                                  <button
                                    onClick={() =>
                                      setEditing({
                                        ...editing,
                                        seasonConnections: [
                                          ...(editing.seasonConnections || []),
                                          {
                                            seasonNumber:
                                              (editing.seasonConnections
                                                ?.length || 0) + 1,
                                            contentId: "",
                                          },
                                        ],
                                      })
                                    }
                                    className="w-full h-11 border-2 border-dashed border-white/5 hover:border-red-500/50 hover:bg-red-500/5 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase text-white/30 hover:text-red-500 transition-all"
                                  >
                                    <Plus className="w-3 h-3" /> Connect Another
                                    Season
                                  </button>
                                </div>
                              </div>
                            )}

                            {editing.type === "movie" && (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-black text-white/40 uppercase">
                                    Alternate Servers
                                  </label>
                                  <div className="flex items-center gap-1">
                                    {[
                                      "YouTube",
                                      "Hydrax",
                                      "TurboVIP",
                                      "Dailymotion",
                                      "Remote Drive",
                                    ].map((sname) => (
                                      <button
                                        key={sname}
                                        onClick={() =>
                                          setEditing({
                                            ...editing,
                                            servers: [
                                              ...(editing.servers || []),
                                              {
                                                name: sname,
                                                embedUrl: "",
                                                useExternalPopup: false,
                                                useExternalTab: false,
                                              },
                                            ],
                                          })
                                        }
                                        className="text-[8px] font-medium px-2 py-1 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all"
                                      >
                                        + {sname}
                                      </button>
                                    ))}
                                    <button
                                      onClick={() =>
                                        setEditing({
                                          ...editing,
                                          servers: [
                                            ...(editing.servers || []),
                                            {
                                              name: "New Server",
                                              embedUrl: "",
                                              useExternalPopup: false,
                                              useExternalTab: false,
                                            },
                                          ],
                                        })
                                      }
                                      className="text-[10px] font-medium text-red-400 hover:text-red-300 flex items-center gap-1 ml-1.5"
                                    >
                                      <Plus className="w-3 h-3" /> NEW
                                    </button>

                                  </div>
                                </div>
                                {editing.servers?.map((sv, idx) => {
                                  const isCustomPlay =
                                    sv.isCustomPlayer ||
                                    sv.name === "Remote Drive" ||
                                    sv.name === "Remote Drive Player" ||
                                    sv.name === "Video Remote" ||
                                    sv.name
                                      ?.toLowerCase()
                                      .includes("remote drive") ||
                                    sv.name
                                      ?.toLowerCase()
                                      .includes("remotevideo") ||
                                    (sv.embedUrl
                                      ? /(?:drive|docs)\.google\.com/i.test(
                                          sv.embedUrl,
                                        ) || sv.embedUrl.includes("remotevideo")
                                      : false);
                                  const isSrvVisible = sv.visible !== false;
                                  const isSrvViyiePlus =
                                    sv.isViyiePlus === true;

                                  return (
                                    <div
                                      key={idx}
                                      className={`p-3 bg-white/5 border rounded-xl space-y-3 relative group/sv transition-all ${
                                        isSrvViyiePlus
                                          ? "border-amber-500/40 bg-amber-500/[0.02]"
                                          : "border-white/10"
                                      }`}
                                    >
                                      <button
                                        onClick={() =>
                                          setEditing({
                                            ...editing,
                                            servers: editing.servers?.filter(
                                              (_, i) => i !== idx,
                                            ),
                                          })
                                        }
                                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/sv:opacity-100 transition-opacity z-20"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>

                                      <div className="flex gap-3 items-center justify-between">
                                        <div className="flex-1 flex gap-2 items-center">
                                          <SafeInput
                                            value={sv.name || ""}
                                            onChange={(e) => {
                                              const ns = [
                                                ...(editing.servers || []),
                                              ];
                                              ns[idx].name = e.target.value;
                                              setEditing({
                                                ...editing,
                                                servers: ns,
                                              });
                                            }}
                                            className={`h-8 bg-transparent border-b border-white/10 px-2 text-xs font-medium outline-none focus:border-red-500 font-sans flex-1 transition-colors ${
                                              isSrvViyiePlus
                                                ? "text-amber-400 placeholder-amber-400/50"
                                                : "text-orange-400"
                                            }`}
                                            placeholder="Server Name"
                                          />
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const ns = [
                                                ...(editing.servers || []),
                                              ];
                                              ns[idx].isViyiePlus =
                                                !isSrvViyiePlus;
                                              setEditing({
                                                ...editing,
                                                servers: ns,
                                              });
                                            }}
                                            className={`px-2 py-1 rounded text-[8px] font-black uppercase flex items-center gap-1 border transition-all ${
                                              isSrvViyiePlus
                                                ? "bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse"
                                                : "bg-white/5 text-white/40 border-transparent hover:text-white"
                                            }`}
                                            title="Restrict to Viyie+ users"
                                          >
                                            <Sparkles className="w-2.5 h-2.5" />
                                            VIYIE+
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              const ns = [
                                                ...(editing.servers || []),
                                              ];
                                              ns[idx].visible = !isSrvVisible;
                                              setEditing({
                                                ...editing,
                                                servers: ns,
                                              });
                                            }}
                                            className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
                                              isSrvVisible
                                                ? "bg-white/5 text-white border-white/10 hover:bg-white/10"
                                                : "bg-red-500/10 text-red-400 border-red-500/20"
                                            }`}
                                            title={
                                              isSrvVisible
                                                ? "Server is Visible"
                                                : "Server is Hidden"
                                            }
                                          >
                                            {isSrvVisible ? (
                                              <Eye className="w-3.5 h-3.5" />
                                            ) : (
                                              <EyeOff className="w-3.5 h-3.5" />
                                            )}
                                          </button>
                                        </div>
                                      </div>

                                      {isSrvVisible ? (
                                        <div className="space-y-3 font-mono">
                                          {isCustomPlay && (
                                            <ViyieEmbedLink
                                              contentId={editing.id}
                                              label={`ViyiePlayer Embed Link (${sv.name || "Remote Drive"})`}
                                              className="mb-1 font-sans"
                                              compact
                                            />
                                          )}
                                          <div className="flex gap-2 items-center">
                                            <ServerEmbedInput
                                              value={sv.embedUrl || ""}
                                              onChange={(val) => {
                                                const ns = [
                                                  ...(editing.servers || []),
                                                ];
                                                ns[idx].embedUrl =
                                                  cleanStreamPayloadUrl(val);
                                                setEditing({
                                                  ...editing,
                                                  servers: ns,
                                                });
                                              }}
                                              className="w-full h-8 bg-transparent px-2 text-xs text-white/60 outline-none"
                                              placeholder={
                                                isCustomPlay
                                                  ? "Default Video URL (.mp4)"
                                                  : "Server URL (Embed)"
                                              }
                                            />
                                            {sv.embedUrl && !isCustomPlay && (
                                              <div className="flex bg-black/20 rounded-md p-1 border border-white/5 space-x-1 shrink-0 font-sans">
                                                <button
                                                  onClick={() =>
                                                    setPlayerPosEditor({
                                                      url: sv.embedUrl,
                                                      sandbox:
                                                        sv.useSandbox || false,
                                                      scale:
                                                        sv.playerScale ?? 100,
                                                      translateX:
                                                        sv.playerTranslateX ??
                                                        0,
                                                      translateY:
                                                        sv.playerTranslateY ??
                                                        0,
                                                      onSave: (val) => {
                                                        const ns = [
                                                          ...(editing.servers ||
                                                            []),
                                                        ];
                                                        ns[idx] = {
                                                          ...ns[idx],
                                                          playerScale:
                                                            val.scale,
                                                          playerTranslateX:
                                                            val.translateX,
                                                          playerTranslateY:
                                                            val.translateY,
                                                        };
                                                        setEditing({
                                                          ...editing,
                                                          servers: ns,
                                                        });
                                                      },
                                                    })
                                                  }
                                                  className="text-[9px] font-black uppercase tracking-widest flex items-center text-orange-400 bg-orange-400/10 px-2 py-1 rounded-md hover:bg-orange-400/20"
                                                >
                                                  <Crop className="w-3 h-3 mr-1" />
                                                  Pos
                                                </button>
                                                <button
                                                  onClick={() =>
                                                    setPlayerPreviewUrl({
                                                      url: sv.embedUrl,
                                                      sandbox:
                                                        sv.useSandbox || false,
                                                      scale:
                                                        sv.playerScale ?? 100,
                                                      translateX:
                                                        sv.playerTranslateX ??
                                                        0,
                                                      translateY:
                                                        sv.playerTranslateY ??
                                                        0,
                                                    })
                                                  }
                                                  className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md hover:bg-emerald-400/20"
                                                >
                                                  Preview
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                          <div className="mt-1 flex justify-start">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setCustomPrompt({
                                                  isOpen: true,
                                                  title:
                                                    "Enter AbyssPlayer / Hydrax Video Code / ID / Embed Code:",
                                                  value: "",
                                                  onSave: (id) => {
                                                    if (id && id.trim()) {
                                                      const trimmed = id.trim();
                                                      const cleaned =
                                                        cleanStreamPayloadUrl(
                                                          trimmed,
                                                        );
                                                      const finalUrl =
                                                        cleaned.startsWith(
                                                          "http",
                                                        ) ||
                                                        cleaned.startsWith("//")
                                                          ? cleaned
                                                          : `https://abyssplayer.com/${cleaned}`;
                                                      const ns = [
                                                        ...(editing.servers ||
                                                          []),
                                                      ];
                                                      ns[idx].embedUrl =
                                                        finalUrl;
                                                      setEditing({
                                                        ...editing,
                                                        servers: ns,
                                                      });
                                                    }
                                                  },
                                                });
                                              }}
                                              className="mt-2 text-[8.5px] font-black uppercase tracking-wider text-red-500 bg-red-500/10 px-2 py-0.5 rounded-md hover:bg-red-500/20 flex items-center gap-1 transition-all active:scale-95 border border-red-500/10"
                                            >
                                              <ExternalLink className="w-2.5 h-2.5" />
                                              Quick Abyss/Hydrax Link
                                            </button>
                                          </div>
                                          {isCustomPlay && (
                                            <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-white/10 font-sans">
                                              <AdminSubtitleManager
                                                value={sv.customSubtitle || ""}
                                                onChange={(val) => {
                                                  setEditing((prev) => {
                                                    if (!prev) return null;
                                                    const ns = (
                                                      prev.servers || []
                                                    ).map(
                                                      (srvItem, srvIndex) => {
                                                        if (srvIndex !== idx)
                                                          return srvItem;
                                                        return {
                                                          ...srvItem,
                                                          customSubtitle: val,
                                                        };
                                                      },
                                                    );
                                                    return {
                                                      ...prev,
                                                      servers: ns,
                                                    };
                                                  });
                                                }}
                                                label="Server Custom Subtitles (.vtt/.srt)"
                                              />
                                              <textarea
                                                value={
                                                  sv.customResolutions || ""
                                                }
                                                onChange={(e) => {
                                                  const newVal = e.target.value;
                                                  setEditing((prev) => {
                                                    if (!prev) return null;
                                                    const ns = (
                                                      prev.servers || []
                                                    ).map(
                                                      (srvItem, srvIndex) => {
                                                        if (srvIndex !== idx)
                                                          return srvItem;
                                                        return {
                                                          ...srvItem,
                                                          customResolutions:
                                                            newVal,
                                                        };
                                                      },
                                                    );
                                                    return {
                                                      ...prev,
                                                      servers: ns,
                                                    };
                                                  });
                                                }}
                                                className="w-full h-16 bg-black/40 hover:bg-black border border-white/10 rounded-md p-2 text-[10px] text-white/60 outline-none focus:border-blue-500 font-mono"
                                                placeholder='Resolutions JSON: [{"res":"1080p","url":"http..."}]'
                                              />

                                              {/* Dynamic Share & Iframe link route builder */}
                                              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 space-y-2 mt-2">
                                                <div className="text-[10px] font-medium text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                                  Embed & Secure Share Details
                                                </div>
                                                <ViyieEmbedLink
                                                  contentId={editing.id}
                                                  label="ViyiePlayer Embed Link (/e/)"
                                                  className="mb-2"
                                                />
                                                <div className="space-y-1">
                                                  <div className="flex items-center justify-between text-[9px] text-white/60 font-medium">
                                                    <span>
                                                      Direct Stream Page:
                                                    </span>
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        navigator.clipboard.writeText(
                                                          `${window.location.origin}/play.id/${editing.id}`,
                                                        );
                                                        alert(
                                                          "Direct Stream link copied successfully!",
                                                        );
                                                      }}
                                                      className="text-red-400 hover:underline hover:text-red-300 font-medium"
                                                    >
                                                      Copy
                                                    </button>
                                                  </div>
                                                  <input
                                                    readOnly
                                                    value={`${window.location.origin}/play.id/${editing.id}`}
                                                    className="w-full h-7 bg-black/60 border border-white/5 rounded px-2 text-[9px] text-white/40 select-all outline-none"
                                                  />
                                                </div>
                                                <div className="space-y-1">
                                                  <div className="flex items-center justify-between text-[9px] text-white/60 font-medium">
                                                    <span>
                                                      Iframe Code Snippet:
                                                    </span>
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        const code = `<iframe src="${window.location.origin}/play.id/${editing.id}" width="100%" height="450px" allowfullscreen style="border:none;border-radius:12px;"></iframe>`;
                                                        navigator.clipboard.writeText(
                                                          code,
                                                        );
                                                        alert(
                                                          "Iframe snippet copied successfully!",
                                                        );
                                                      }}
                                                      className="text-red-400 hover:underline hover:text-red-300 font-medium"
                                                    >
                                                      Copy
                                                    </button>
                                                  </div>
                                                  <input
                                                    readOnly
                                                    value={`<iframe src="${window.location.origin}/play.id/${editing.id}" width="100%" height="450px" allowfullscreen style="border:none;border-radius:12px;"></iframe>`}
                                                    className="w-full h-7 bg-black/60 border border-white/5 rounded px-2 text-[9px] text-white/40 select-all outline-none"
                                                  />
                                                </div>
                                                <div className="space-y-1">
                                                  <div className="flex items-center justify-between text-[9px] text-white/60 font-medium font-sans">
                                                    <span>
                                                      Secure Download Page:
                                                    </span>
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        navigator.clipboard.writeText(
                                                          `${window.location.origin}/dow.id/${editing.id}`,
                                                        );
                                                        alert(
                                                          "Download link copied successfully!",
                                                        );
                                                      }}
                                                      className="text-red-400 hover:underline hover:text-red-300 font-medium"
                                                    >
                                                      Copy
                                                    </button>
                                                  </div>
                                                  <input
                                                    readOnly
                                                    value={`${window.location.origin}/dow.id/${editing.id}`}
                                                    className="w-full h-7 bg-black/60 border border-white/5 rounded px-2 text-[9px] text-white/40 select-all outline-none"
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 font-sans">
                                            <div className="flex items-center justify-between p-2 bg-black/40 rounded-lg border border-white/5">
                                              <div className="flex items-center gap-2">
                                                <MonitorPlay className="w-3 h-3 text-red-500" />
                                                <span className="text-[9px] font-black text-white/60 uppercase">
                                                  Popup
                                                </span>
                                              </div>
                                              <button
                                                onClick={() => {
                                                  const ns = [
                                                    ...(editing.servers || []),
                                                  ];
                                                  ns[idx].useExternalPopup =
                                                    !ns[idx].useExternalPopup;
                                                  ns[idx].useExternalTab =
                                                    false;
                                                  setEditing({
                                                    ...editing,
                                                    servers: ns,
                                                  });
                                                }}
                                                className={`w-10 h-5 md:w-12 md:h-6 rounded-full transition-all relative shrink-0 ${sv.useExternalPopup ? "bg-red-600" : "bg-white/10"}`}
                                              >
                                                <div
                                                  className={`absolute top-0.5 md:top-1 w-4 h-4 rounded-full bg-white transition-all ${sv.useExternalPopup ? "right-1" : "left-1"}`}
                                                />
                                              </button>
                                            </div>
                                            <div className="flex items-center justify-between p-2 bg-black/40 rounded-lg border border-white/5">
                                              <div className="flex items-center gap-2">
                                                <ExternalLink className="w-3 h-3 text-red-500" />
                                                <span className="text-[9px] font-black text-white/60 uppercase">
                                                  Tab
                                                </span>
                                              </div>
                                              <button
                                                onClick={() => {
                                                  const ns = [
                                                    ...(editing.servers || []),
                                                  ];
                                                  ns[idx].useExternalTab =
                                                    !ns[idx].useExternalTab;
                                                  ns[idx].useExternalPopup =
                                                    false;
                                                  setEditing({
                                                    ...editing,
                                                    servers: ns,
                                                  });
                                                }}
                                                className={`w-10 h-5 md:w-12 md:h-6 rounded-full transition-all relative shrink-0 ${sv.useExternalTab ? "bg-red-600" : "bg-white/10"}`}
                                              >
                                                <div
                                                  className={`absolute top-0.5 md:top-1 w-4 h-4 rounded-full bg-white transition-all ${sv.useExternalTab ? "right-1" : "left-1"}`}
                                                />
                                              </button>
                                            </div>
                                            <div className="flex items-center justify-between col-span-2 lg:col-span-1 p-2 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                                              <div className="flex items-center gap-2">
                                                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                                <span className="text-[9px] font-black text-emerald-400 uppercase">
                                                  Sandbox
                                                </span>
                                              </div>
                                              <button
                                                onClick={() => {
                                                  const ns = [
                                                    ...(editing.servers || []),
                                                  ];
                                                  ns[idx].useSandbox =
                                                    !ns[idx].useSandbox;
                                                  setEditing({
                                                    ...editing,
                                                    servers: ns,
                                                  });
                                                }}
                                                className={`w-10 h-5 md:w-12 md:h-6 rounded-full transition-all relative shrink-0 ${sv.useSandbox ? "bg-emerald-500" : "bg-emerald-500/20"}`}
                                              >
                                                <div
                                                  className={`absolute top-0.5 md:top-1 w-4 h-4 rounded-full bg-white transition-all ${sv.useSandbox ? "right-1" : "left-1"}`}
                                                />
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-[9px] text-white/30 italic px-2 font-sans">
                                          Configuration options hidden. Enable
                                          the eye toggle above to edit stream
                                          credentials.
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        ) : (
                          /* JSON Editor */
                          <div className="flex flex-col gap-4 font-sans select-none text-white h-full pb-4">
                            {/* VS Code Single Column High Performance Layout */}
                            <div className="grid grid-cols-1 gap-5 items-stretch min-h-[500px]">
                              {/* Left Textarea Code Editor */}
                              <div className="bg-[#1a0e0e] rounded-2xl border border-white/10 flex flex-col overflow-hidden shadow-2xl">
                                {/* Editor Header / File Tab */}
                                <div className="flex items-center justify-between px-4 py-2.5 bg-[#221313] border-b border-white/10 shrink-0">
                                  <div className="flex items-center gap-2">
                                    <FileJson className="w-4 h-4 text-red-500 animate-pulse" />
                                    <span className="text-xs font-mono font-medium text-white/90">
                                      {editing.title
                                        ? `${editing.title.toLowerCase().replace(/\s+/g, "_")}.json`
                                        : "content_object.json"}
                                    </span>
                                    {jsonError ? (
                                      <span
                                        className="w-2 h-2 rounded-full bg-red-600 shadow-md shadow-red-500/50"
                                        title="Has Syntax Errors"
                                      />
                                    ) : (
                                      <span
                                        className="w-2 h-2 rounded-full bg-emerald-500 shadow-md shadow-emerald-400/50"
                                        title="Valid JSON"
                                      />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      disabled={!canUndoJson}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        undoJson();
                                      }}
                                      className="px-2.5 py-1 text-[10px] font-black uppercase text-white/80 bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/10 rounded-md transition-all cursor-pointer flex items-center gap-1"
                                    >
                                      <Undo className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!canRedoJson}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        redoJson();
                                      }}
                                      className="px-2.5 py-1 text-[10px] font-black uppercase text-white/80 bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/10 rounded-md transition-all cursor-pointer flex items-center gap-1"
                                    >
                                      <Redo className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        try {
                                          const parsed = JSON.parse(
                                            localJsonText || jsonText,
                                          );
                                          const beautified = JSON.stringify(
                                            parsed,
                                            null,
                                            2,
                                          );
                                          setLocalJsonText(beautified);
                                          setJsonText(beautified);
                                          setJsonError(null);
                                          setEditing(parsed);
                                          toast(
                                            "JSON auto-formatted!",
                                            "success",
                                          );
                                        } catch (e: any) {
                                          toast(
                                            `Cannot format: ${e.message}`,
                                            "error",
                                          );
                                        }
                                      }}
                                      className="px-2.5 py-1 text-[10px] font-black uppercase text-red-500 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 rounded-md transition-all cursor-pointer hover:scale-105 animate-fade-in font-sans"
                                    >
                                      Format JSON
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(
                                          localJsonText || jsonText,
                                        );
                                        toast(
                                          "JSON copied to clipboard!",
                                          "success",
                                        );
                                      }}
                                      className="px-2.5 py-1 text-[10px] font-black uppercase text-white/80 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition-all cursor-pointer flex items-center gap-1 hover:scale-105 font-sans"
                                    >
                                      <Copy className="w-3 h-3" />
                                      Copy
                                    </button>
                                  </div>
                                </div>

                                <div className="flex flex-1 relative font-mono text-xs bg-[#0f0707] overflow-hidden min-h-[420px] border-b border-white/5">
                                  {/* Raw Editable Textarea */}
                                  <textarea
                                    value={localJsonText}
                                    onChange={(e) => {
                                      setLocalJsonText(e.target.value);
                                    }}
                                    spellCheck={false}
                                    className="flex-1 w-full bg-transparent text-[#e5e5e5] p-5 border-0 outline-none focus:ring-0 font-mono text-xs leading-5 resize-none h-full overflow-y-auto custom-scroll"
                                    placeholder="Write or edit content JSON here..."
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Error Alert Display */}
                            {jsonError && (
                              <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-400 text-[10px] font-mono rounded-xl flex items-start gap-2.5 animate-pulse shrink-0">
                                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                  <p className="font-medium uppercase tracking-wider text-red-300">
                                    JSON Syntax Error Detector
                                  </p>
                                  <p className="opacity-80">{jsonError}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="p-6 border-t border-white/5 shrink-0 bg-[#0d0707] relative z-10 flex gap-3">
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                "Discard all unsaved changes for this items?",
                              )
                            ) {
                              setEditing(null);
                            }
                          }}
                          className="h-12 px-6 rounded-2xl bg-white/5 border border-white/10 text-white/40 text-xs font-black uppercase hover:bg-white/10 hover:text-white transition-all"
                        >
                          CANCEL
                        </button>
                        <button
                          onClick={saveContent}
                          disabled={isUploading}
                          className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 text-white text-sm font-black shadow-lg shadow-red-900/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                          {isUploading ? (
                            <Upload className="w-5 h-5 animate-bounce" />
                          ) : (
                            <Save className="w-5 h-5" />
                          )}
                          {isUploading ? "SAVING TO CLOUD..." : "SAVE CHANGES"}
                        </button>
                      </div>
                    </div>
                    <div className="fixed bottom-8 right-8 z-[100] flex items-center gap-4">
                      {(editing?.type === "tv" || isEditingSubPage) && (
                        <>
                          {/* Create Sync Page button */}
                          <div className="relative group/addpage">
                            <motion.button
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              onClick={() => {
                                const mainId = editing.syncMainId || editing.id;
                                if (!mainId) {
                                  toast(
                                    "Please save the main page first!",
                                    "error",
                                  );
                                  return;
                                }
                                // Find current maximum page number
                                const subPages = contents.filter(
                                  (c) =>
                                    c.syncMainId === mainId ||
                                    String(c.id).startsWith(
                                      String(mainId) + "-page",
                                    ),
                                );
                                let maxPage = 1;
                                subPages.forEach((p) => {
                                  const match = String(p.id).match(
                                    /-page(\d+)$/,
                                  );
                                  if (match) {
                                    const num = parseInt(match[1], 10);
                                    if (num > maxPage) maxPage = num;
                                  }
                                });
                                const nextPageNum = maxPage + 1;
                                const subPageId = `${mainId}-page${nextPageNum}`;

                                // Determine starting episode number based on the previous pages' max episode number
                                const mainItem =
                                  contents.find((c) => c.id === mainId) ||
                                  editing;
                                let maxEpNum = 0;
                                if (mainItem && mainItem.episodes) {
                                  maxEpNum = Math.max(
                                    maxEpNum,
                                    ...mainItem.episodes.map(
                                      (e) => e.number || 0,
                                    ),
                                    mainItem.episodes.length,
                                  );
                                }
                                subPages.forEach((p) => {
                                  if (p.episodes) {
                                    maxEpNum = Math.max(
                                      maxEpNum,
                                      ...p.episodes.map((e) => e.number || 0),
                                      p.episodes.length,
                                    );
                                  }
                                });

                                const nextEpNum = maxEpNum + 1;

                                const newSubPage: Content = {
                                  id: subPageId,
                                  syncMainId: mainId,
                                  type: "tv",
                                  kind: "tv",
                                  title: `${mainItem?.title || editing.title} (Page ${nextPageNum})`,
                                  isSubPage: true,
                                  embedUrl: "",
                                  synopsis:
                                    mainItem?.synopsis ||
                                    editing.synopsis ||
                                    "Sync Page",
                                  poster:
                                    mainItem?.poster || editing.poster || "",
                                  backdrop:
                                    mainItem?.backdrop ||
                                    editing.backdrop ||
                                    "",
                                  releaseDate:
                                    mainItem?.releaseDate ||
                                    editing.releaseDate ||
                                    new Date().toISOString().split("T")[0],
                                  year:
                                    mainItem?.year ||
                                    editing.year ||
                                    new Date().getFullYear(),
                                  rating:
                                    mainItem?.rating || editing.rating || "0.0",
                                  duration:
                                    mainItem?.duration ||
                                    editing.duration ||
                                    "N/A",
                                  genres:
                                    mainItem?.genres || editing.genres || [],
                                  yearNumber: mainItem?.year || editing.year,
                                  episodes: [
                                    {
                                      number: nextEpNum,
                                      title: "",
                                      url: "",
                                      thumbnail: "",
                                      updatedAt: new Date().toISOString(),
                                      servers: [],
                                      useExternalPopup: false,
                                      useExternalTab: false,
                                    },
                                  ],
                                };

                                // Save this new subpage to contents locally
                                setContents((prev) => [newSubPage, ...prev]);
                                // Set currently edited item to this new subpage
                                setEditing(newSubPage);
                                if (editorMode === "json") {
                                  setJsonText(serializeEditing(newSubPage));
                                }
                                toast(
                                  `Created & switched to Page ${nextPageNum}!`,
                                  "success",
                                );
                              }}
                              className="w-16 h-16 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all relative overflow-hidden"
                            >
                              <Layers className="w-6 h-6 relative z-10 text-orange-400" />
                            </motion.button>
                            <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl bg-black/90 backdrop-blur-md border border-white/10 text-white text-[10px] font-black uppercase tracking-widest opacity-0 group-hover/addpage:opacity-100 pointer-events-none transition-all whitespace-nowrap">
                              Create New Sync Page
                            </div>
                          </div>
                        </>
                      )}
                      {(editing?.type === "tv" || isEditingSubPage) && (
                        <div className="relative group/addep">
                          <motion.button
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            onClick={() => {
                              const curEps = editing.episodes || [];
                              setEditing({
                                ...editing,
                                episodes: [
                                  ...curEps,
                                  {
                                    number:
                                      (curEps[curEps.length - 1]?.number || 0) +
                                      1,
                                    title: "",
                                    url: "",
                                    thumbnail: "",
                                    updatedAt: new Date().toISOString(),
                                    servers: [
                                      {
                                        name: "YouTube",
                                        embedUrl: "",
                                        useExternalPopup: false,
                                        useExternalTab: false,
                                      },
                                      {
                                        name: "Hydrax",
                                        embedUrl: "",
                                        useExternalPopup: false,
                                        useExternalTab: false,
                                      },
                                      {
                                        name: "TurboVIP",
                                        embedUrl: "",
                                        useExternalPopup: false,
                                        useExternalTab: false,
                                      },
                                      {
                                        name: "Dailymotion",
                                        embedUrl: "",
                                        useExternalPopup: false,
                                        useExternalTab: false,
                                      },
                                    ],
                                    useExternalPopup: false,
                                    useExternalTab: false,
                                  },
                                ],
                              });
                            }}
                            className="w-16 h-16 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all relative overflow-hidden"
                          >
                            <Plus className="w-7 h-7 relative z-10" />
                          </motion.button>
                          <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl bg-black/90 backdrop-blur-md border border-white/10 text-white text-[10px] font-black uppercase tracking-widest opacity-0 group-hover/addep:opacity-100 pointer-events-none transition-all whitespace-nowrap">
                            Add Episode
                          </div>
                        </div>
                      )}

                      <div className="relative group">
                        <motion.button
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{
                            scale: 1,
                            opacity: 1,
                            ...(editing
                              ? {
                                  boxShadow: [
                                    "0 0 0px rgba(239, 68, 68, 0)",
                                    "0 0 30px rgba(239, 68, 68, 0.4)",
                                    "0 0 0px rgba(239, 68, 68, 0)",
                                  ],
                                }
                              : {}),
                          }}
                          transition={{
                            ...(editing
                              ? { boxShadow: { repeat: Infinity, duration: 2 } }
                              : {}),
                          }}
                          onClick={saveContent}
                          disabled={isUploading || !editing}
                          className="w-16 h-16 rounded-full bg-gradient-to-tr from-red-600 to-red-500 text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all relative overflow-hidden disabled:grayscale disabled:opacity-50"
                        >
                          <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/0 to-orange-500/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <Save className="w-7 h-7 relative z-10" />
                        </motion.button>
                        <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl bg-black/90 backdrop-blur-md border border-white/10 text-white text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap flex items-center gap-2">
                          <Sparkles className="w-3 h-3 text-red-500" />
                          Quick Save
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            ) : activeTab === "hero" ? (
              <motion.div
                key="hero_combined"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-6xl mx-auto space-y-12 pb-20"
              >
                {/* Top Hero Section */}
                <section className="space-y-8">
                  <div className="text-center">
                    <h3 className="text-2xl font-black mb-1 uppercase tracking-tighter text-white">
                      Top Hero Slots
                    </h3>
                    <p className="text-xs text-white/40 font-medium uppercase tracking-widest">
                      Main Header Display (Placement: {heroPlacement})
                    </p>
                  </div>

                  <div className="flex bg-white/5 p-1 rounded-2xl w-fit mx-auto border border-white/10">
                    {(["home", "banner", "movie", "tv"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setHeroPlacement(p)}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                          heroPlacement === p
                            ? "bg-red-600 text-white shadow-lg"
                            : "text-white/40 hover:text-white"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  {heroPlacement === "banner" ? (
                    <div className="max-w-4xl mx-auto bg-white/5 border border-white/10 rounded-[32px] p-8 space-y-6">
                      <div className="text-center space-y-2">
                        <h4 className="text-xl font-medium text-white">
                          Center Banner Config
                        </h4>
                        <p className="text-sm text-white/50">
                          Displayed under "The Last Episode Added" on home page,
                          and under Network banner. Use ratio 1700x530.
                        </p>
                      </div>

                      <div className="space-y-6">
                        {(() => {
                          // Merge legacy single banner into array or use array
                          const banners =
                            settings?.centerBanners ||
                            (settings?.centerBannerHeroImage
                              ? [
                                  {
                                    id: "legacy-banner",
                                    image: settings.centerBannerHeroImage,
                                    url: settings.centerBannerHeroUrl || "",
                                  },
                                ]
                              : []);

                          return (
                            <>
                              {banners.map((banner, idx) => (
                                <div
                                  key={banner.id}
                                  className="relative p-6 bg-black/40 border border-white/10 rounded-2xl group"
                                >
                                  <button
                                    onClick={() => {
                                      const newBanners = banners.filter(
                                        (b) => b.id !== banner.id,
                                      );
                                      if (newBanners.length === 0) {
                                        saveSettings({
                                          centerBanners: newBanners,
                                          centerBannerHeroImage: "",
                                          centerBannerHeroUrl: "",
                                        });
                                      } else {
                                        saveSettings({
                                          centerBanners: newBanners,
                                        });
                                      }
                                    }}
                                    className="absolute -top-3 -right-3 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-600 shadow-lg"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>

                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                      <AdminUrlInput
                                        value={banner.image || ""}
                                        onChange={(val) => {
                                          const newBanners = [...banners];
                                          newBanners[idx] = {
                                            ...banner,
                                            image: val,
                                          };
                                          saveSettings({
                                            centerBanners: newBanners,
                                          });
                                        }}
                                        label={`Banner Image URL ${idx + 1}`}
                                        placeholder="/banner.jpg or https://..."
                                        onOpenPicker={() =>
                                          setAssetPickerTarget({
                                            type: "banner",
                                            field: "centerBanners",
                                            bannerIndex: idx,
                                          })
                                        }
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <AdminUrlInput
                                        value={banner.url || ""}
                                        onChange={(val) => {
                                          const newBanners = [...banners];
                                          newBanners[idx] = {
                                            ...banner,
                                            url: val,
                                          };
                                          saveSettings({
                                            centerBanners: newBanners,
                                          });
                                        }}
                                        label={`Banner Click URL ${idx + 1}`}
                                        placeholder="/movie/123 or https://..."
                                      />
                                    </div>
                                    <div className="space-y-2 col-span-1">
                                      <label className="text-[10px] font-black text-white/50 block uppercase tracking-wide">
                                        Target Placement
                                      </label>
                                      <div className="relative">
                                        <select
                                          value={banner.page || "home"}
                                          onChange={(e) => {
                                            const newBanners = [...banners];
                                            newBanners[idx] = {
                                              ...banner,
                                              page: e.target.value as any,
                                            };
                                            saveSettings({
                                              centerBanners: newBanners,
                                            });
                                          }}
                                          className="w-full bg-[#151010] border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs outline-none focus:border-red-500 transition-all font-mono appearance-none"
                                        >
                                          <option value="home">
                                            Home (Default)
                                          </option>
                                          <option value="movie">
                                            Movie Page
                                          </option>
                                          <option value="tv">TV Page</option>
                                          <option value="soon">
                                            Soon (Coming Soon)
                                          </option>
                                        </select>
                                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-white/50">
                                          <svg
                                            className="w-4 h-4 fill-current"
                                            viewBox="0 0 20 20"
                                          >
                                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                                          </svg>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {banner.image && (
                                    <div className="w-full mt-4 aspect-[1700/530] rounded-xl overflow-hidden border border-white/10 relative">
                                      <div className="absolute inset-0 pointer-events-none">
                                        <MediaBanner mediaUrl={banner.image} />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}

                              <button
                                onClick={() => {
                                  const newBanners = [
                                    ...banners,
                                    {
                                      id: `banner-${Date.now()}`,
                                      image: "",
                                      url: "",
                                      page: "home" as const,
                                    },
                                  ];
                                  saveSettings({ centerBanners: newBanners });
                                }}
                                className="w-full py-4 border-2 border-dashed border-white/10 rounded-2xl text-white/40 font-medium hover:text-white hover:border-white/30 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                              >
                                <Plus className="w-5 h-5" />
                                Add Slide Banner
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {Array.from({ length: 10 }).map((_, i) => {
                        const slotIndex = i + 1;
                        const slot = heroSlots.find(
                          (s) =>
                            s.slotIndex === slotIndex &&
                            (s.placement || "home") === heroPlacement,
                        );
                        const content = contents.find(
                          (c) => c.id === slot?.contentId,
                        );

                        return (
                          <div
                            key={i}
                            className="group relative p-6 rounded-[32px] bg-white/[0.03] border border-white/5 hover:border-red-500/20 transition-all flex flex-col items-center"
                          >
                            <div className="absolute top-4 left-4 w-10 h-10 rounded-2xl bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center text-sm font-black text-white shadow-lg shadow-red-900/40 z-10">
                              {slotIndex}
                            </div>

                            <div className="w-full space-y-4">
                              <div className="flex items-center gap-4">
                                <div className="w-16 h-24 rounded-xl overflow-hidden bg-white/5 border border-white/10 shrink-0 shadow-2xl">
                                  {content?.poster ? (
                                    <img
                                      src={content.poster}
                                      className="w-full h-full object-cover"
                                      alt=""
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white/10">
                                      <Image className="w-6 h-6" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm text-white truncate">
                                    {content?.title || "Empty Slot"}
                                  </h4>
                                  <p className="text-[10px] font-mono text-white/30 truncate mt-1">
                                    {slot?.contentId || "No content assigned"}
                                  </p>
                                </div>
                              </div>

                              <SearchableSelect
                                value={slot?.contentId || ""}
                                onChange={(val) =>
                                  updateHeroSlot(slotIndex, val, heroPlacement)
                                }
                                options={contents.map((c) => ({
                                  label: `${c.title} (${c.type})`,
                                  value: String(c.id),
                                  poster: c.poster,
                                }))}
                                placeholder="-- Choose Content --"
                              />

                              <div
                                className={`pt-2 ${!slot?.contentId ? "opacity-50 pointer-events-none" : ""}`}
                              >
                                <label className="text-[10px] font-medium text-white/30 uppercase tracking-widest block mb-1">
                                  Trailer / Cuplikan Embed URL (Optional)
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. https://www.youtube.com/embed/..."
                                  value={slot?.embedUrl || ""}
                                  onChange={(e) =>
                                    updateHeroSlotEmbedUrl(
                                      slotIndex,
                                      heroPlacement,
                                      e.target.value,
                                    )
                                  }
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-red-500/50 transition-colors"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                <div className="h-px bg-white/5" />

                {/* Bottom Hero Section */}
                <section className="space-y-8">
                  <div className="text-center">
                    <h3 className="text-2xl font-black mb-1 uppercase tracking-tighter text-white">
                      Bottom Hero Slots
                    </h3>
                    <p className="text-xs text-white/40 font-medium uppercase tracking-widest text-[#999]">
                      Featured Section Display (Home Recommended)
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 10 }).map((_, i) => {
                      const slotIndex = i + 1;
                      const slot = bottomHeroSlots.find(
                        (s) =>
                          s.slotIndex === slotIndex &&
                          (s.placement || "home") === "home",
                      );
                      const content = contents.find(
                        (c) => c.id === slot?.contentId,
                      );

                      return (
                        <div
                          key={i}
                          className="group relative p-6 rounded-[32px] bg-white/[0.03] border border-white/5 hover:border-orange-500/20 transition-all flex flex-col items-center"
                        >
                          <div className="absolute top-4 left-4 w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-600 to-yellow-500 flex items-center justify-center text-sm font-black text-white shadow-lg shadow-orange-900/40 z-10">
                            {slotIndex}
                          </div>

                          <div className="w-full space-y-4">
                            <div className="flex items-center gap-4">
                              <div className="w-16 h-24 rounded-xl overflow-hidden bg-white/5 border border-white/10 shrink-0 shadow-2xl">
                                {content?.poster ? (
                                  <img
                                    src={content.poster}
                                    className="w-full h-full object-cover"
                                    alt=""
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-white/10">
                                    <Image className="w-6 h-6" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm text-white truncate">
                                  {content?.title || "Empty Slot"}
                                </h4>
                                <p className="text-[10px] font-mono text-white/30 truncate mt-1">
                                  {slot?.contentId || "No content assigned"}
                                </p>
                              </div>
                            </div>

                            <SearchableSelect
                              value={slot?.contentId || ""}
                              onChange={(val) =>
                                updateBottomHeroSlot(slotIndex, val, "home")
                              }
                              options={contents.map((c) => ({
                                label: `${c.title} (${c.type})`,
                                value: String(c.id),
                                poster: c.poster,
                              }))}
                              placeholder="-- Choose Content --"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </motion.div>
            ) : activeTab === "comments" ? (
              <motion.div
                key="comments"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-5xl mx-auto space-y-4"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-black">Recent Comments</h3>
                    <p className="text-xs text-white/30">
                      Moderate user discussions across all content.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-red-500">
                      {comments.length}
                    </p>
                    <p className="text-[10px] font-medium text-white/20 uppercase tracking-widest">
                      Total Comments
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {comments.length > 0 ? (
                    comments.map((comment, index) => (
                      <div
                        key={`comment-${index}`}
                        className="group p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all"
                      >
                        <div className="flex items-start gap-4">
                          <img
                            src={
                              comment.userPhoto ||
                              `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.uid}`
                            }
                            className="w-10 h-10 rounded-full border border-white/10 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div>
                                <span className="font-medium text-sm text-white">
                                  {comment.userName}
                                </span>
                                <span className="mx-2 text-white/20">¬∑</span>
                                <span className="text-[10px] text-white/40">
                                  {comment.timestamp?.seconds
                                    ? new Date(
                                        comment.timestamp.seconds * 1000,
                                      ).toLocaleString("en-GB", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "2-digit",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : "Just now"}
                                </span>
                              </div>
                              <button
                                onClick={() =>
                                  comment.id && deleteComment(comment.id)
                                }
                                className="opacity-0 group-hover:opacity-100 p-2 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <p
                              translate="no"
                              className="notranslate text-sm text-white/70 leading-relaxed"
                            >
                              {comment.text}
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-[10px] font-medium text-red-500/50 uppercase">
                                On Content:
                              </span>
                              <span className="text-[10px] text-white/30 truncate">
                                {contents.find(
                                  (c) =>
                                    String(c.id) === String(comment.contentId),
                                )?.title || `ID: ${comment.contentId}`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-20 text-center border border-dashed border-white/10 rounded-3xl opacity-20">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4" />
                      <p className="font-medium uppercase tracking-widest text-xs">
                        No comments yet
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : activeTab === "users" ? (
              <motion.div
                key="users"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-4xl mx-auto space-y-8 pb-20"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-3xl font-black mb-2">User Section</h2>
                    <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 w-fit">
                      <button
                        onClick={() => setUserTab("management")}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${userTab === "management" ? "bg-red-600 text-white" : "text-white/40 hover:text-white"}`}
                      >
                        User Management
                      </button>
                      <button
                        onClick={() => setUserTab("ultra")}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${userTab === "ultra" ? "bg-red-600 text-white" : "text-white/40 hover:text-white"}`}
                      >
                        <Bell className="w-3 h-3" />
                        Notification User
                      </button>
                    </div>
                  </div>

                  {userTab === "management" && (
                    <div className="relative group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-red-500 transition-colors" />
                      <input
                        value={searchUser}
                        onChange={(e) => setSearchUser(e.target.value)}
                        placeholder="Search name, email..."
                        className="h-11 w-64 md:w-80 bg-white/[0.03] border border-white/10 rounded-xl pl-12 pr-4 text-xs font-medium outline-none focus:border-red-500/50 transition-all placeholder:text-white/20"
                      />
                    </div>
                  )}
                </div>

                {userTab === "management" ? (
                  <div className="bg-white/[0.03] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 text-[10px] font-black text-white/20 uppercase tracking-widest bg-white/[0.02]">
                            <th className="px-6 py-5">User</th>
                            <th className="px-6 py-5">Email</th>
                            <th className="px-6 py-5 text-center">
                              Tiers / Status
                            </th>
                            <th className="px-6 py-5">Badge Title</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {filteredUsers.map((user) => (
                            <tr
                              key={user.uid}
                              className="hover:bg-white/[0.02] transition-colors group/row"
                            >
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="relative shrink-0">
                                    <img
                                      src={
                                        user.picture ||
                                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`
                                      }
                                      className="w-10 h-10 rounded-2xl border border-white/10 shadow-lg object-cover"
                                    />
                                    {user.tiers?.includes("admin") && (
                                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center border-2 border-[#0a0505] shadow-lg">
                                        <Trophy className="w-2 h-2 text-white" />
                                      </div>
                                    )}
                                    {user.tiers?.includes("viyie_plus") && (
                                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#f59e0b] rounded-full flex items-center justify-center border-2 border-[#0a0505] shadow-[0_0_8px_rgba(245,158,11,0.6)]">
                                        <Crown className="w-2.5 h-2.5 text-black" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-white truncate group-hover/row:text-red-400 transition-colors flex items-center gap-1.5">
                                      {user.name}
                                      {user.tiers?.includes("viyie_plus") && (
                                        <span className="text-[7px] font-black uppercase tracking-wider bg-yellow-500/15 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-500/20">
                                          VIYIE+
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-[10px] text-white/20 truncate font-medium">
                                      {user.username || "@user"}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-xs text-white/40 font-medium">
                                  {user.email}
                                </p>
                              </td>
                              <td className="px-6 py-4">
                     xúÏ}Îv€F≤Óˇ˝mN&C%‚Uí«Êñ¢%_í—Zé£mŸôì„ÂÂÄDãƒ\$q?¬˛}~ûG9?ŒùG8’\	†´ARñdˆÃr(ËkUuuıWUÑ$Â–¥.…ƒ6Ç‡µ1ßG≠õ^ˆOÁ 7<25ºŒÄX!ùù	uBÍìEAh],‰ü≠˛É(ÀÕ{ƒCÑ¥|:çl√oÌ‚ø¥˝ËŸQÄ}√0ÁñÉ}ÿΩr(∫/c√q®âz˙CwnxÌv∏Cé~ 7®Í'ÆÑd˘>L˙[ã˙9BΩHHPøÚW˛¸˘N;yâì˜…»àºOÈ√ŒjÙ}f¨ﬂ‰(7äÆÂLÏ»§ÃÆ6üÜëÔê6r$á„(]˘4!üË‚Ë&¸å~ﬁuû€÷‰”—M[c5E±iHz%W3û ç
,Nn2/,8;5ii_èH˙ñ3ÂÉ∏&èééHà#¸¥Ïh=î‘Ìv≥›ﬂ%·áˇ¸çJ¨“é'∞kSgŒ»ÙºØ◊ìÃdàGçK5ú¯æ±Ë^¯Ó\o†
rN√d<;:≥ø£5m3√1m˙Œ3çêæ÷ÃYÊÆ˘¬Ö (ΩΩ∞ó”wﬂ˜?Ëº˛),¯≥xfN∑¡õﬂΩÎŒêxÿ¸|7rLjvÏ)	Èuÿyˇƒª˛@.\'ÏåmcÚâDûG˝âP˙ÜX°Â:√∂…ÿıMyﬂËLk31r¬è7!M∆=Üß˙>•ùÉ~ø7Ïãë¶_…°d⁄ÔÎ∂3äªôŸ∑µeïËÏÇ⁄∂{ïÎÏ˚ø\<•˝Òá∏Ø…ΩÉ>	fÜ	/ºÔÏÙΩÎè˛tl¥á˚ªÉÉ'ªÉ¡nø;‹˘@«ö[tº»®~ÁFºs>K∂gÚÔ∏_Òœ∫(*øöÅ2÷;5ã?ÜI’Òè3˜∏+˜Â†/øÕº®”Éœøc˘£ärv}Í—vÎckó¥Hk€ aOÏÏ∏÷PÚ‚3¢Ò√ËÀ™6{°©|&4≥j7àõ«L‹Ï#ÙÈCÀÒ¢1†p·A’l¡1Îl“#≤√_;»7Ö±aNÈ[+¥)Ëé§’¬,éÎ<≥#" î	‘Í¨aGJ{:"¥˛îÜ›K6‹æÚ£3`Üœ…yÊ⁄¿yG≠”Ñç:™f	2q’πàÿ2960ÿˇb¡VdˆÃ˛ƒˆ´Ób⁄ìBë…:πYÕ©iEs‚F°m9¥„∏Ö&Q0*¶Ω~q#À»åø#dFouÅ'¸∫'vjxﬁªÊ¢Íu¯Ÿ€¥¸ÁJ˛Æ¯aƒrô¶W<VêEñgX¡‡7ΩÔ»œÜ69ã∆p¶ Ø]8f[É≠˘—ıÁ‰ª^˘†ãçyù'	UºﬂÁ t4ı”eª∫ù±Oòé ó¸1,9Ïóñ!ıˆ;ˇêß∑Ã∂&w”·µÁ1zxI	€\.ÿ¶<≥Lì:ïr¨ÿYc∏vÇÚ‰zù>Ò≠È,Ñˇ≤1∏0iV∏Ë‘≈√g†
‰gˇ	ô±≤õo´ö(Â "ªõå˜ﬂò¥xYü‘ı∞Ã¬í≥®0#K›ÀVxüHMñ/]Ï·>[lπ<∞:Ú{Ó©P9lwJY~6√d>ŒHÄöôÃÃf˝PùòÌeª¿õf§ñïbô˛®ÑÕsü¬æR∆U
	4€SÙ”[Í¶î∑y	¬4€Ô‹YaÚ	é‹†ìvát˛ÅÃ√Œ@9òsÍò†•:∞‡:Ú∂!LD≥-3P»[a·ÍπdôBßæeˆOg‚⁄£ÊÊ(˝s»i˛	Ûc-¬ènOE»∂1¶v’˙T¨HN•N÷Á 2i¬∆ﬁ©í›i9è∆ˇ¢ìêÙà–ö⁄ß¨KXØ\ˆxg™íCS`~OŸ±√ó¶ñä]õ^Ñ MòÙÙÜ§√∑~õÇ¸êßLúfá∑⁄·ÍLP8≥úQÓ¨ìQ `¡]?PàﬁGú^{)TèÛ3gÁn®£¢∫ŒÛ;≈j®®œ“Ê⁄8•tæLqjhÿTÉEËØÍôYV?gùﬂhb]≥L§˚ì“¿'É!Ò¸òdÇyÖ‡Fh¢KöhFΩŒûd≠4ßôø¶W‰g˜“¢‰‰“∞l¶>"ˇÔˇ˜ˇQ’£†bıˆáŸ7$ÒñÃU´ºgÃ‚‰ì”π1•‰›õW§}b=ÒmpƒûËÿCï{›ê{| [π∑yπ7C/ız÷|˘›â;Ôf–ıúÈVÓi…Ωì	?ñÉû«	Vàæ_<ˆ•aﬂπW<«=(±‹ÛÈ!H=6é≠–€º–Î]·d÷3.òÈN8£{ÿ1,«iÍaŸß{¥∆I∆/!¶A¿4ígÆπ¿ú}¢êu ©Q€pâêòÀæ ‰Ñ¶å–ñ∫≤Av]W4(ƒB˝î^= %¡ì±ëpΩ"`÷Ÿü÷øÂ{eBNº]xî,‹»'N÷∆SÃå˙™õâp∏9w¡ÊlEN®M'ı~ômá-÷=db÷Ô"# Ü≥∏eFn≤Ø_ofGüD~‡˙œµ8v¥f ä-◊ıî¸òöZΩ˙8Å1PGyûôºÏÕk˝k*Rc∂¶Á¢}80ú:ÆBùÉCÕ@<∆9≥e}\◊iUB’Oa;á:H˚‹3¸O6»Àã`Z’â¶Aè3 †∆=˛ï’Ò=LÍôOÁ@û+˜Ú∞'Ñ‘˙ƒª*‰,°ö†Lç`·Lk ‡ëèJ≠‰èJÙ§‘"tAm∆‡[‚ˆ√pÃD%ˆÒ?"Ñ√#L∫E}ﬂ≈‡Ø‡ÅV=ß:4¡ûqºÛl◊0a'má~Dïmá˛1≥#mô‰àòÓ3≈pÃfÑ
Ù‹6«ª§ï’dÇ>∫”µLıƒWÜ≤ÅøÄn±Æï4∂ﬂ¡Au,≥Ú˙giÜ‚hRÚ>µw∫°{z˛À9«4∑QX⁄	ø%6O¬å÷ø§˛[8#4ÊÊ} œ=Ú™:ßúl˜¢…¯âÌÍ$…W÷√F,#ÚF´ÖÍmr¡=.≠∆∏áÖ±˜¨–›rä√zh†◊#oËúgfπ’†w¿ˇÅK¨oÄ¸fó˙$∏≤¬…∂‚–◊ﬂ≥2Â¨`ËÏèà˙L}ei√
Wü-⁄-∆≠Ó	ë	Óeî<g‘i∑«–æBÓ≤…1≈¸˝ÊÄ¬˛≥f∫Æˇ“òÃ⁄L2¢—é¨5êo¡¨}√$º⁄Ö	1@ÃÄx1˘í®	5/®Æ“0{î^A⁄¨à∑’D˝ôLòuç¥)üBº—˙—∞lj2 7yã|Á%)v„˝—ÅÀÅ√fü-Ï‡Ü®∑zµ@·_∞|õõ£´é¡∞·î5≤„Ÿ„,òKÇ∑ß©q==se˙Ÿ„Zè∑Ñ¯íı√¶ùAˇÄvë øxzP<¢-√”Úπ≥WdñÖuÀPæòùÂ]EÈ·ª‘ÒZ£mÕèuPSú»ﬂ˜ª˝aÊ˜ñòÉ:‹‡·9CXˇnpo(åwyÉª√¨«ﬂ/Øﬂ^∫`yäÍ÷29`ﬂA∞eåµîp`<‘Ú§Zás‡ÇƒT°8ìØdπﬂØÙ« =Á@ÿ›z§m<ÊdíÛE bÔæRZ)1≈|Ÿå"ÃÑ1ﬂÌÁ=é≤PπÕE≈Jç∑¢1ØhçåKjúÌ/Sw†¥ó?V·§YjDn√Q©Á@Ó˚ .#=ñÛû«5–∏§ÔlXêò3ë7€LU<-F<BΩE»£(€X∑XÕ∏Ëæ˘˝äÌ†R$TÃ5≤ÇîÏ-ﬂ‹‘A:#J≈≠ïÛ–É-SÌ2áıñ¿úcrc‹c;o≤1Â«ö€Ì≈°cFÃ$è˘h˘«b†(ü åC¬ˇÆÍÇMÍ©∫d{Z∏cÀﬂ¨%!3ﬁ“π«¿6 π@@Ñ∞w„¨»{µ¸‚F|I„.mP”PÚ‰;xáê2™m2ï/¸f\:„≈Oì´¥eüºÏ•¯¨3Tbb‘X¢i=)(Z@ÓVh¿æÉ†ı≥Ù =ëõ÷hbÊÁ]r√MÇ‚√ú~VíúBØ¬„o∂∫–∆t°óû∏&˝öî!9‰ïµ!YœΩVá‚ÂˇäÙ°Ãê∑
—Qà®X”;¨z∏UâÓπJî®B‘€*DI!zÓŒÅ≠òÍ+Räƒ∞Ÿ®W÷ã“™Óµjî„k“éÚ£ﬁ*HDAö$Àzáu§ÂNn’§á¢&›≤Ç§¯}Y∑äˆTá∑!Êô·$»]ÑRi-ZN\yë36¥dçÆ»≤å!ôó¸7÷ÔbuØ§A=açR`I0$$N ‘2ˇä†ÙK—È{sóMywÈqAN@≤ﬁc5èÆ™“<L+[jöE∞.‘∞ÙåÂ¿˙ˆ—ÕMÒë~íM∆CÕ=8({ê^[°∫∫Îq±wÀìYî¶¬Ed0PDnâO2`©R™´éÄ?q9Zèˆ›´⁄”¶ \ê˘∏ÑTá≈©yVT!K zìß%/5R«»+8>Á≠V≤Q5¶ßtÆ3Æi^&ﬁ2˘ÉÙ¥8òßv» Sr!v{&‹ÿnç}◊0a˜Î”GÛHÆ√¨ÏV;kêJK'-'ﬂ5Ô9È^˛pô%I˝ˆ¥ä3hFUå\{R´ì·é˘,ÓaçHV"1◊±ís[Û/c9„´ñWˆ˘Œ≠≠åS⁄>Û≠Kÿ™u"’⁄Æ	F[!3iLbaMçã≠X¨:ë£äh"2;—|\Ô¸öÛVˇá_&]jÕõ˛?‹»»Ò±BM.*…åaû'Ô∑Û:/íc`G∞-é1xWc·i,1¬ríWVqjTÿ:ø}ºî¡{arÃÃ“¿	∆Ç˘z›~Õi†ù˛¥≥£ˆú@zêµŒ†VFb>F!ñI’˜‰ ¥áphB:`*˝'0Œóı''6çäF&Æsa˘à¨øü¯<¯	"˘· aT˘b¸≤8íÿÑt∫Zü≈$ˇÆúú⁄ﬂ’KæióS‘⁄#Ó4ŸÖèmÑGêLÁ√Ü2uQiàX#≤LÚ‰;Ú∏ˇ3Ë˜˚ÿ÷ˇÄ>£Ω◊V˜î≈vã˘ÑAœÑœlÏà˜˙ı1Û£ë3ﬂù[=ºt-Û¥Gö®¬ßswŒ4ÔŒ¶|ª‡Õ¶È?«‹◊òÁ≤Ùc√¯§≈‘K¡àﬁNúwQF^÷keÀ›È¬b0^\ﬂx^°§gá	≠c\€X·Î(<¸êó`&µiHk]¨ÕÆeÓ -qŸ.µaì¿)°´¨„",ÅtYã®V’VuL6#¡bíS∫†Z∑˘§„\òóù!Og p}‘Ñ¥a~∆høPí≤¿òìvÜlIG∑
£X≈∫‹l◊ËË˛;W:©	[´‡ëƒÎ3€uÛ˚#ÂFÀ :ù›õªµÚAëÓ‹zoùZk~≠uxÕß¥ŸÁ'ËÓAˆHê∏∑ \R2˝DÂQU>∂ﬂÔ/Y√‰I<{@/M¿U<~Tü◊´Œ|çé…áœm∫öœM¡Çk*º˙=[ê‘DÙG≠´~Uv¥è:J©ü∑⁄˘…´Wñrn8∞Xˆ‚X¡¯u ∏ä¡ıqå^Tg∫™í´W“CW÷BK¥H•“Sñ÷®()QŒWS%§TyØNß*˜ólyòàmÙã©oÅä⁄¥∑∑ımn¯≠≠¡∆VªqU˛V≥•ï‰h´⁄–2…î*w3ˆÃù‹ jco}#òu˜1A)@¨ïT˝¶ºÒ¯ˆ€ö-G˜Œ@%˚Y˙ò\\‹#tÃ#çxGB≠Àßp8Áπ˙Gk1x]ÒIÜµ4C°‡8®Ú≤dø£®4‘ó”maDPrıãµ
√æ
ÍPÚ‚r≤úSQÃœ7»8πu€·∫Ë#ßÀ !ßÊN&ÛsEe˝ ˆy
◊>ŸªFë˝•ê,IƒñΩ!èÿíìÃ&»J8—Â¥$9ãÂE©Gt-ﬂ‘ãAπH*P„¸ZöèïÙRÇÃIíì’C∆
°}Í≈‰kóà∞}$YzV/LV]ﬂ√u™R/ W5„eÿ”Ãü{àÀ$Z;9ïÙ[ˇ÷‹⁄¬â≤… 8í¡Àkè⁄DXÁS”?È§{oq…•÷Ê»wd∏Øm◊7D ;4¿ùa†ƒ˙¿a ìµ5wÛZ^ë≈≥`ØwƒÆ5+B1âÙÂn0ÀÄºon“ı;&≠8”æ∏“GAÁ1«öÎÓ 4¸p	‡ƒŒîyxÜ⁄?Eîb“uñøV?Ìznœ÷H∏Ó§1∆Ù+:[éÎÎT4R‰bﬂ«WáÕÿçµNﬂ§sÖ´¯∞«» I1e‘®¬[™@∫E≈E€=*.K«v¬'óFZl¢Ûºûú«#ïùB«vîPNÊ‡…øﬁÔ/9›!{Åüü•Lì8ù6WÖVn˜V^'úv∂ ˘[?[/∏ãÑ3+»qé[x ¡‡ÚEX™R„ô÷Àí∫“wYô-EcûvÒûØ˚&Úb5ys’ôñRÉ_€ÛÈ•¶‰aÖΩ+ì⁄Û#µOá]ÿ>Ç˝ÓnŒ˙1[Z9Ñ≤†uSõÑZñs·jæ•5:ºÿWñÕΩ"£¶,ì∑±?43'*—⁄!.†∫ñ¯]çô*öµJ˘ë3aíå—
thuéoQbuãªæ°˙ÆˆÁœ-‡¯ü7XsÑ%<5g(ZõrÛ{áùnÆi5~∂¥˚“¬âÄ¬kO>V–Y
Òö†≈ÿ` ÂïWYˇ*‚ês…ﬁÒöÎs√¶éi¯Ö∫]˛˛’`åõ“#|Ëærô°í˝ Ìøh~mQßÛ”3¥H¨Öße˝,ü˜yJ‹⁄ªÅ\ıÀ‘¥Oå¿£ì∞s	ßI7ÁéR<◊ó∫ß‡ó›öO—À¯ì£ÏmIB(˛óÁ™ÔLÿ®dÜœ\¨An3‡/\NÃ»ÁõlÁÔ:g[√èZÿ«ëÙé&U¢ÍR›>÷¥SoÀ¨≤≈óΩPm¯¨
d¿Ã≈∆uGóÜc¥D‚©áåM^‘Æ\ôÿ∂AÿÚzV<îŒÁD,9QuÚ‘S+àU>„‡å[Òe2&«âíYJì”§˝ÓÙ≈:Ú$cíK·N%≤^	„;.zÖvÏ
8Ô˝ú∂Ö
[—Ìv3›√l∂b˙°-î&*’tî&Í∆7Æ;™ÉeÓ=Eky÷Hµª‰‹™^ruégÿRT‰˚Tπæ7Mn~7YU'Ò'ñO…?Kõ˛ÛÆ≤È
i@øb^UFú…ÁíÙÑ#jÎÈë«.¡%¶\™.ìöÚá◊÷µı=˘Â‚Ç˙kÀ^)˝pbŒ-nÇÏù:%Â⁄√’‡§”óêMÁ?≥ê·&kßDùêX≠;î	§8ãÊ˙ÎI#]Y$Qi_4ß¯˝ê>9=!ÉƒßÔˆ”Çﬂ=å'‰ôk.Vd@ù∞PYå3µﬂC.L ü_îuYp˝»˛˝l)ñ¸ÁÃâÈÊ‹Cc¡˛√/VôR¸’ÛÈ)(l£úEÛ±cX6iˇ¬’√&Ôﬁº™£ßçÌù¬8{πVfö›Óùzå:C/ız|˙:ëo≥¢Ωn¢ã·Qn;zT≤)≠/åGl1;}±R&ıª∆cì>t¸j‰ù@}≈†ò‰ÈπÿIÊ(¥˙·UÛ£Øí˝3ŒèNÊòW• ÒONb4<r¡™ÏÄ‰‚ﬂœ®M7VZy&wPUæ)1HwêN¥›ﬂ%Ov>E ‹ﬁ—NÔøDΩ]T#∑ªVfwÈÎ[u‘/ƒ∂pLÂË§Ò™ÄM](y∂‚{ÍAâék,¸“pÍCÛ@ıù–Ì¯‰¬wÁi0;7sΩñ’JJ!5…µ‚pøp≠Xüˆ˙˝ÄﬂWn,Ûu».ÎB∫iz¸ÿú
‘áHzT⁄Îc,áamt\w«[´äWe®≈Çi>.E©ÂMÉ6º°¨	†_π5ôèÎ°ZU'ÃzÁã’‹ëêﬁH…ÓtÄq[≤›)Ø\µI¢úz∏KœÔPeÁõ¯óXAˇŸg]‡b”ù∑w0:	dH.l˚∞ØéL´∫ÄTﬂI-·ë,ßs’¡dú©BˆUú˙bt"Œ«Ê<5}øvÖë˘Ï√d˙Œ#Ï¥2i∞Ú÷Â ÑëOQÁÙô“µÆ!¡IxÁÖ‹: TÍ⁄Ç◊élM(˘,:æv_ßQÌ8;Ô≈[¿ÜS™[˝U{≠Üª∆"ÆTø”%◊$@I[•œjË˜©Á˙a≥–¸ÒªKø~A˘≈u¬„¨Ó^@ñÈ/	ê_øÅÚw¯£mLÛºq¿”Òj†°CˇÍÄœ›˘ú)ÄoƒÚñÅ«≈/˘·FíD≠WO€~„~ÇàÒ3n´—zK|/ˇ*7e&‘ÑFPÑE —ï†,´µPd_à£àPæ«VÛ0öêí
„cõñY˘0Yí≤ƒjŒIJ0Ü„≤`‚uÁópFqÕS<ºî^˚Ï≈&˛Œx…»ü˙ı‘üfB_Å.B(	qgçÛ–£‡∞Œö÷ XÅ·fV©√ÄÓ*50Ëé√“ÀπaŸÕkJ˝yî˙˝∞Ø8Õä"C}õ+åètWW=ò˝¢ı√	7à+◊~Ø°*ˆ60Aìå]sëÌ01∞AgA‰e«Bu U,ëê≠JhuŸõÃ˘YåwÑ´≤±§Eú†E•pà÷péN¸
s÷†%-V¸W?!áf'`î`t`äbXä\PäL,©Ú|èf*öB.O¿•∞ 4‰‘ÑwπQ)RÂ%âLó—g–ïâ»tN}√6sµeæ√UáãLÅ4L‰'ä'‚y¬Ÿ&p1*@™’à¥‰©ïh≥L„ ƒ:”r*åß≈ó{0ﬂ¸pÇ≥Z¨4≈ê&⁄Lá«‘ås◊J››s7	ó+ø«ôÊ‚˛ ›ÅŸ†6ﬁÈ%}ÂÄk°´ı¸-åÛ=/ãP¶’€0æûF1À±fÚVäu:q3êØ–Ó≤âoÆºåè›m5"|òÌ[√éiM-uT»¥ Aá≥Fo.®·7zë•Rh÷WÀâÑA˚UdDû*ãÒ:ËöÎ⁄2ΩÎ52º—Mç6P‹0◊-≠(9+∆»Á»c¿Õà3â—9∂îÌíDW’ä;rCƒ|çXUÅk_R≥E>„k–àÎ–P~≈u·Vk°ÛkGÑÒô
œ("ô$≠◊ôÙ„¨¸›“È“¨lD|ù%“XOÙj†„¶‰ytèk¯"˛l¨—Êb–f‘‹•8¥Ÿ˚5–≤±ÎñŒAy˚hV°ﬁCÍœXy#ñ'4"™‘GﬁÃ’˙ÀúD@oEN±îàút∂æJâ#O‰9Åìû“◊(o2÷Äuãõwéø)ÅÉ:πj»öï$çVÙø“»ÚTn∆∑#¯Ë:ëˇpy s]B2· Í¸©ÔT	vŒëÙR&ZÍÌå•ÿf±ó©˛-æÄ;}áÖ  Y¬ëÜr$õÈ∂Rt≈dÁëSÕ∂û	
≈ºRoÌík‹'W◊Œ5áΩ‚vπ⁄ÜπÜ-sÕz∫ˆæ©ÛQkmƒ{Lÿ]z$ﬂ ô%…úËçN#w\Z4FŸ ü\Zòdvm⁄ÂË∂:π[∂l˘}ÀÔ¨‹s~ìÁn“>±YÜöE≤Ÿª>·Ï±£À¯⁄_u∏{Ç¿›õ·´>eƒ™Ü˝•¨UπàıYX¢Ó©c9YUöÍ sﬁ¿qh”(dÖ(:gç[;Fu;≤0Y:‚R∏Fó˜ÚKW]ﬁ©]„¬5uË^Sóô:¥9∏ı≥d”Hƒ”b8§kZ0)ÑEëNö2¢%|<83xCk=3úÙ˝∂∏ßvé…@‹Ø@ï˚{√~øKÿ-ßü¶´ÏÚ»Z‰où¡ﬂò7`‰åß´1∆ØóUá&“˘`1¬#€ﬁAyˇ¶EL+LF¿¶‘zÍÑIµ∫À9°ekpâhó¡5àÏò<Õç7GiÉùÅ÷ﬁsÃ'WÎïQ6cœ˜¢Â\¶dmz∆Å¢ôËÖåùôV»ÑàŒù%âM¿>5ﬂ±âÖ÷ëV<[Õà<sAO6ú6ØICÉAeOZ4∞Ø∞„Û–◊ gVë4+«§uãùD4¨d<∆≈pãó’⁄J®v8Èl—Àyó¶∑„Ÿ“¸¶<[ﬂögK„Ùli|õû-Zg7Q\–iN¢–Õ∫µ[∞WjA$Xâùƒ#›t˜[Fp∞˚†9}Låb9†Û™ #=˜,^úi+s\hnt|¢»òãi=94íÔr…—4Ï40Î‡Ø}öõtÙıgÅÕÆà∞a]˜‡-ùa%j∞xåMø.Ì^Ôa6ìömùÁYvä`T~_≥çÓƒt»6QbÏÖ¥˘fØ“éu˙\µ≠Á hU£Ï0®6K\%ùﬂ¸ÿì7Ó›≤h∆F $˘T∫˝4∫)∏≠KÇ;f•\JXïxΩeÄ¡´ ıı⁄"≈ ØUzc¿¶ıÆX¨‘;[sW¨jwkÓ%yÆ«—¥ô∑5qÈß≠´ıótµ>±©æı-P§ä>∏üÎ8ynï√ı≥h∫gÎdkI˙ÄfZ∑Ï%Mn=§∑“MÍxÚiÍ˙ãuz6†<õ †§ıÌnΩõ7Í›\%¬Í_ﬁ∫◊uÎbå,[ce˘™\å˘Ïú8Æ≥òªQÄúü[Û8ˆ›@òõ˙O‰fÀá˘uUﬁÇﬂ`aﬁ[…ìùíwÎ≈ªı‚--wÿãW.(√) ´ŒêMÊÂUÆ∫\qÎ›dÆr•Ω⁄UˆJWÿ+]]Øte≠„Åá|rÎ0^(ÀysÎ0^]ö√xìÎ¯gâ¡î2ˇú◊å†ôÎ…F
˜ÿûL"?p˝éÁZNml˝lŸz∆óñ;&\∑ûÒïÂÅy∆ØM¥∆ì†%Y5={æøˇFeÍ÷˝ø§¨Íî^n·N[∏ì∫‹-ŒåXOQz5‹öáˆwµA‹UÉ=√¢(´ﬂÇï|©¡∫¢„F,ˆﬁ“/• ,–yô¡>uü>A£±í∑ê∏,e+ŸÏK¸æeˇ⁄&só!1lÎ	Ò∆ù·“e§º≈±RÏüC î†¶*-¨¡Ú[æ:Õ'—tÑéª⁄?È¯<√≤∂[Ü¥*h≥p7Ωœƒƒpô—Éyëª3|ˇÕÕU‹ñ !÷ûº1Œx¢Á—^p‡…gr+JõV˘’n9ã¸l8,ÂÊ	ã¬]À0uÚ†Ò‹adZÓ≠NØlÚãÃ+wÍísﬁÅ€öa√≥nóz°Ω€ù[,99;%=Ú¬QLﬁ∏aUÇ«çÃ0ã“˘≠N≤lÚvÁ˘oî<wM
s˝ r>iÕpU⁄Ã
ÒW¶7WÂ||RÖ°DÚjΩ<ë•{—“¥Wﬂ¸ŸÖù€ıœlcë«Üj wyEyêq\§Qïfµˆ˛ÎÃı"è¸jô‘eBˇúÜ!ºXõâsØZ˜“…Ü Ä÷1aÔ±¸ê®Ï®)
ºzT7mµ}B∏ñ{lÙ,‚B «}‹5Ã3ÒÂüí˜Íé&“;Då}Ù¿‰˙ë¨¥ãM»ä∂1ôÏ2˝^ú_·/Ú=i≥øª^Z%Ù§Ø8ö÷/jXbVO√wX∏ë£•˝¿êµŒ˛2∆I˝X´8∂n%EπI{˜Ì∑S“2•Ì'î&-∞3ËWDﬁ… œ˝ÿº‡†O≤Ø#ÚñM$…,§œ IVp”"(ú◊Ma%>ˇµKNCÃ‹»6YˆvP÷'îöl}˛ä…¬yz¬Kæ∑v	»X2¶◊’ê+6á^¢<+«îıÊ Q7é¬¨Ì(}∞Kr1mV@#Vå„O+≥(/%ÇÌ=¡°«N¯iê	U!PSÑÑ=ÍÁ?’±◊
Å‡–´≥X8æGZ]∫›Æê}X{ﬁhdôŸ0.›–ï #ã]‰€∏|˜qIé hdâì¶3"⁄—yØWª•%0.iºì∑oHº•ç2´äãå†ùÆµ4z⁄Rñ˙8…r@Á÷ÿYñQpsa÷J≥ªVzO)˚äB¸ûŸQê◊‘ˆ@S€CÂ|Æ7%ø#ÿ]+?¨¶`ƒÂ@ÂFj,¸
óﬁÜªF99ƒm£ËRx;:ﬂ‹@8–9)nÊIäÒ˝‚˛ù`3˚ΩOmÉãbî≥+8ÛiC@Ç.aYÀÂ“ø*i{ºm/æ&·i›íËÄ
÷%ÑXirÅlå◊é@ÊtBiD‡·√UÁ	pÙí2©Ñä)á˚ÓUßºó∆êÚæ†Æé_Ò∑Éº¸í_ìw%Ò$ˇïıﬁ2Øò∆öWëà*‹„Y4ıÅﬁÿ?LÄùôõ£Ùœ!óﬁ8wå≤⁄cIá√y :lcLÌeß›†‹i∑˜∏_Â=‘ØãÂ77zÅ÷,‹/Ác–ﬁﬂΩyÖÔxè˜\c§ñ„E7˚∏\vDèƒñ–ùâ;n†é+qI7c!_@‘QMY«Jâ˛ô(ñH˝'.I%ÔaØ˘ 5ÈDã÷‹≈uM⁄J√.üRΩ*>Î4/k5;["ô5;´uéÂ¨x¿ât*"ıèZ≥0Ñ^ˆzWWW›ÖÖ¿H,∫Xè26Í¡ZÈÑ…Zˆ”ûuM’Ç[q„„"Ù»∂Ê“Ì∞ﬁIå
VÖÉmﬂg§∞F˚á…áÔ≥8=ÅZò—	%oòm•˝W|`ﬁÕãRÊ]|‘r" O$rLî §ﬁQ´ﬂÌtﬁö[º§ıÜq}‘Ë¯õ∂áåiÎ¯xªKËÓY√kN%˙ÒAWŸd4O€]).π]âÒ)ÈM>⁄n?∫èˆ©y»“Wœ§-∏Ò©Bˇ¶o©F-Û +çM¨<Å[NâÌE¸πQÒ”:"*ã5∏‚ÊÜÃu´K¥dWMeﬂ‹d -à°…]Ì∞_Å(/:∫⁄™X>dn·»è8Ó5I,CÃ04»Œˇx·˙Ûí9`!ú:|¸¸„@kËTÎ/ﬂ(Ωƒ<ßvk)◊K n¥¯ú:‚kï{Ω?Ω˛M˘`˙4.±…<Ûu9≠Åˆò‰Å:Ò˛ûWL#òQ≥F9@.ıkWXÅ˘=0˜ΩòF¿Èd*ÂßT5£àzîè‘”œ;Ì .‘‘$+PCÜœ-®®ºúá>5ÊØÒµãX‹2∑,˙U|ŸX$*›ã
e,⁄ãè=D`—©”r6≤iø∞|ÿíHè¸‰∫S„€#Ä“=ÚÛŸæ⁄vz◊ Jø∆bV¢$§Ë√Ä(ŸñÛÈ›WåkÎ? ê¬◊TQ÷ÄkäÂBL‹hì‘ô∂–&YÓ&¥)ë„rπÓ¥©©bemZ*[h”=ºãß‘']üHUTl.bC¯ä@N©õ®¶˙∑5¢í-»©¶î»Ë;sWS
r2ußú©8 )ö”k‰D©cªÜ˘≠e¡‚1fÎŒΩ˝Ìı3/[Ù™”[Ù”C@?›„Ìcã~™)˜fª⁄¢ü
e=€;G@;Ã‹z?6£∑úπ¢œ<H˚áp≥¿]⁄ìrÚ[O∑∫·ùû∑˙˘”+ÎˇÙ⁄ò{BıﬂJV^∂∏RQ„¬ïﬁciuÔp•wWVmq•[\ÈW⁄ËAÆT^Ä=\iê† ˘†∂”“üÓ(¬ÙGﬁºãÿRîîúòó‘≠ÄŒa@+°J+~\+®¥**aYK8x√·lˇV˘?⁄Æ¡¥ÚÃÖçc^è˛ÄŸﬁØÌÙnOOLê1p=Eÿ‰˘? =ùK$¨⁄ê9˜CE"¸g	¿´±Ü@$®*Ã¸NL"˙¬≠'?ù˛ÿ;{˝”éÍÂ:øx‘9ıÍ
æRV¬O¯Gº%7(%ïôÙaìéßÖ9ª∞®méX,O>:ƒ; ‘Öı”™PáV•¥≈C-‹Ñ“ÄV§±çS
ÌNªª$6¿IA3µÛ£ÿU?W!±â¬?R8Ü)Y/ÁÇønK>r 6T÷PÓLÌÁ|ã≠'bï§‹“Dã˙KËﬂíÉ=—ëõeºÄên)4ÛçZú(ü»±ñ\≈D´YMD
B∏ôNqaQoØaöïß‘ıë¶ÜQΩÑôÁÎ&ÀT‚´Rµˇ©9ÍÓüH~Á0Â¸‘w∂XÊ„d√º}˘åíAU˝‰\sKÇËkï˜≈9pÇ?3¿/¥‰{‡∑Õ” FT>y»'iByE/Br>gâ=æ4àÌh•”ÏòwËƒd=Z…¢69‰f©a$Øhí—"˝ﬁÿPñ¶Ìû[S≤„Y¡Æ≤
ı·ÂtCÕÊå1˜H‰Ωaf˝ª%Ûxóæà–K[ﬁJΩ∫RîzÈº=±«Ù‰^‹Ó}|[ΩSOøuΩ;§tÜÆ˜4Œ|´[¡[Wb¡õü≥{.tì¡‹¢¿Õ∂y_ÖÌ}pwH≈‰À~˚˙e°Ÿ≠å´+9˜`4Àt4∑-Â¥Nâ°ﬂcπ‚+3QﬂÂd∑x'àu∏=
i≥
qc(DíÕﬂÕ¬~c®°ñ¸™Åàj‚T∫|‰]<j;“‚5Ω=WäWf]ÃÜŸ@"cè˛O◊ùè»†´å>∆ÊIº°®áœg÷E¯?t˛˘≥ÈsÊŒ¿ˆÊ˜5⁄Ûô¡7(ÊAÖz·?}é»ÖaJ?ˆÔŸœÆ…Zq}kj9ÜçjÈ’öﬁg<–êCÉ Ω|œÅÂ|#—/¸‰ã`bÿ¨O∏7NF<^ª/’ÌI˘Xp2s{&¿—rt∑Â®K◊v>J\ 2üÎΩ"\B)˛ƒZz #äVÔäµíq9 \:âá{"¢Ff’˚í‘wªÈ}GŒ©·Of‰ô·√Ñ¯≤ΩÄ|◊´“vïÿ±®n#íçîœ‚ﬁ6˚¬Yß7$¬Ijd€$˚"vˆ…˘M‘cﬁU…"(´∞Nïâı:>!b ˇQQG°KN… Áœã¥ÛÓ∫µ†”ú
&gQÙàå|cPd‹™pEıl˛Øœú«r(˙Ω*ΩdÆÇKJï+jÜ›rÆ´ÀéKŸ!é2ãº◊_b î_´G\CÀK©rÍ¡xy¸:Kº’R ãÀ#é&W√èπ„ü2Ü\& f≤÷©¥L3Ôö$~œF◊Ã/Gâ)¡p¨9ÎﬂÖa“éÂ‘—eΩzÙˇW≠ßÚüS9Uâ√∂ÎdÏÿî∆NW‚ã†ï ˆ–…≠‡%TJé»£Gπ⁄’!ºÌ˛2˛ºú{ïı4È∂∫;ø¬Ÿà¥?—≈àπáAMªƒ§#Xæ¬7Ÿ∫ ÌGIwv‚‡PCΩø´|.yÛ=t‡…®ÛDÑ*¶Èq·e≈„#Uüj›âÂ¥óOnùÈÀæ£tµÜ÷^f◊axÒü#µÈÑO
ÎßÚ`˛L(®∆òQeŒ:¨«	ΩÓfz£nÆ~)ïk)èG∞òÇ	⁄-˘MkNLà0˙Ò°©P˚
™ ≈YáPˆµà/°l-‚êU®E|©[Àoeµ¸¶Qã<ñ•’‘.d+Ûä‚ÄÑ>Ê°áß¿•—¬wå¯—;b°$Âk_BU¸Ãà¨)96ÍÃ^Úíj˛PQdOìsjaÿ…˜:ìúaãsò¸†≈SÒ∑P[¸µV]…Ÿ∑PYÚ='∫6q..T%æLÍQV‰˘ƒ®:»>“îÙ≥·_RµqBÑ¬èΩ⁄"è≈ªÏ^Yü,¶Ö]◊üˆÿ_˚´7qÁsËkØﬂÎÔ˜DÂiÚ„∞?x¸ëçª\NïÕ˛kòÚ±Vì kê
∞∆®qbà˙=Ë?Ï+GHî‘∆ïœèÒˆ'EÄ$Qº∞á.6C{Ω=⁄|‰é!∂À≠º_È≈ÀÖ≤ÈQ\≤1¢PßXM∞l7TµI7§â«Ω«˚=—¿«g>H	mÒiAG@ÙyA”¬ƒÚ'∂⁄F}€§öÜ∂uΩZ†=∫◊ì-∞›‚@ó˙›ßíÓÏvÒŒ±@á	wM)bøó¥ÒÒÃöÑ(A˙tÒ‰“EGgÀË}„!ËgÜoÃ°sÍ{πFÑaÙåa/i#%åa8‘⁄=˜D^ò˝ãÅqW5âà√ã·yˆ‚åü`ò%Õª∑¶≥‰ÇùÁ´¿=/nŸΩ.£:‹Ò]∞◊à{+æs˜∫Ç5ﬁ˙-yÎ7‹[…-º◊ïÑämç”(k> €ít
MÒO∏∑›≈Îﬂ∆7∫èop#ﬂ‰N^ÛV~CÊ^¶Ê‡-n9pÀÅ’ø7æiî√˜¬∫¶&±‡ËNü¸ªÛ˛)îÍ˚Ê\
Ωßdˇ5}◊Éo"ø37ã˜ƒÑ›4_ÿÓUg—1¢–UGÍ(t{ˇó˛∏–?(á/˙Ñ≈Ê#Êeﬂáø˙t˛ÅH\ƒ‹∏Ó\uˆØÌ€3ÃÊˆ„Éfˇ0á%Êºƒ?˚ÓïÙ\boœ`Ü˙ó≥≈Òê	Ãè;Ôﬂµ1±;.á˚
ùawÊ√|˘¬(¶òú:,ä≠¡—•’@ùöÖe}†≤m◊WRÇ&ç'~\êxct∂Â∏èYúWm^gÌ©ù‰˛'õ+¢\35ÍE>Gw4ÔÀ¡Å–=ﬂ‡iNc(mäÿ–|#ÙlÙÛÏ2æ≈±ÖpÊªñMu¢‰√∆‹ßÏ:©P6Ï∞⁄Ö$Û¨∑‰Û~–˜Æ?P/ï˛/9¯~bc÷ç—…YﬁE”€L¨‰LØìˆµÓ}|6ïä\*rÒ2‡£Ã ÂC,÷ëAﬂ4P“&kΩ^ZT4ÛßHXb|ô»l.øÄ÷]D)jlêo∂ÄdDWÑÔ´i∆ÿ¶ÊëîP¯7s–…ó<>ß∏ïå1ÆxYU
¢f¡t»tÀX» õ|ìŸÉAÔ‚IIÚ¿†?ÈÌ`∑≈„z¡ß‚"YAû	—?>⁄T\Ç%Ï´cîœÖ»Qãª∏≥gØÍùˇ™éFúñÙ.≠ÖE'3†øÆÁLY¬ LºZ|•Õ"Ø≈eÖlqâ=Ö∑ñ^Réÿ„0Y=ç∑AƒíGø7≤≥√s~ﬁ g4r>s˝pÖ‰è9/6+∏z/èT·≈ΩLÇe|›€˝ò!t7˝ˇäÄ<…ØtóHÀu<ã’qÓ#—TÍfÏ	ï^bÜ∫s√kÀÃÏ:…ıSÚâ.énº.”tíßƒ.¢Eù3ƒ˛>s◊ c÷Î Ì2ÕÂ1d{˙Q“gÊ>Ô≤î— ‘äDAòD~‡˙œÂÒ	C™„^˘Ü«.xú	;eÂì≈hÃåé|gtßΩ˛˙q0i\‚∫7ñkf-FìòÆ®cJJ]2q&2Ÿº7NQ∂t˘ÊÄé¨ë˛*we†ı.:mVﬁwÄÛo˜ ÎìÛ,q%ÃÛ$é∑∞ƒ˛úÂñ∂ë¨√Gâ√ŒÑËíàÑ±v«Oé4ÑC3oó|a7…M>ä˚˘Áüﬁ‚‚Ø·´R/≈ÀA≠Ù}°k°^ÇÁ÷37úeç ƒ AïJüü˛Y∞°=“‘≈[‘˜ï ˘¢ïRO‹y‡ﬂ¿ÔX°ø–öw„ ∞∏/—w¢7˝&º`éw„”√ƒg©L3y∂nDË…6®◊^ˆæ6O‡MÍ·˜∏öÔë\√‹yG«„¨¨«â“ã5„èáiAﬁ=ÊKÊäz•ÈêŒôQw≥)i4!Úˆ}•	ë.UôQ˜mO»okòêﬂ68!ø›‚Ñƒòâïf$ˆt”⁄ﬁE—
YR,)xc≈e˛o,&*JY/$dµYß‹’ÈÍôÎ⁄‘p⁄Àï7#,T∞ób…√]Vöò‘∞	Åi‡lÚ%è∫Yi©ì ¨ÆvMkë2ﬁe•t∫3) mJµ˙¥K¶ô˜y·“a‹Ê 5T‚⁄ä2C∫æ~±u+ÎÕ≠NdäÀ[i&S«ﬂ˚Ã…(nUv5[8	é\i’§ÉıFîTQ˜-Mâ¬˝&_¥L!´hW1—≤“ƒ$mN,Œ©IÇh2ôŒ∞m;ì|ySñ¶œdbÑìiSÈÿ≤iì‹π¡ ©Ü≈ §Eæ'¥;áÒSMéﬂ¥éŸ|A=ÔÚföåQF:„Ôè4W]k.tV˚ˆn&¶>•N>≤°¯™€Pq9Åf(*·7z•q»W∑"Í!ˇMˆ0Wô∆•ÚÜ{ø«∞"‰πjsª¯â…ÓÙÊ®˝O◊ˇƒ/c…ØV6yÁ’OV∏
j{n∆ 1{Èö~ÛÏŒìŸ]¿≠„cWwcUh9÷‡∆ÎCÁ{Óª^	e5√q3»ıÅ
rùGU‡á}‡'"I/'∂5u8)I Aﬂzœ6É-z≈º!Œ|zi—+Óê`X,uÁïŒΩ6&!1é1∑&ƒà˚^M¥–ô2ZI®7K4xä(T)‡Ohç|‡…j8√ë˘»ïèÆP˚¢ÑÜØŒèêñì	w)…Œ$zYu‹‡Y¸˝l2C7øÁbﬁüphÀ¨≥á5…Q_±œL‚3≥Lì:K(÷»Á0¯Œlg…KﬂËhOôê^,Äªåú°•''.”b‘F‡—	pıª€îs0ÿﬂá9–´xTÏù®RØí\ˇ∏…VÛı•^xv7ØËü%–TÎ◊≤‘ôÿYΩ—q≠ï˜„jRIÍ/œºΩ5|2Õÿ±èY~4æi%€òi38∑†‹˚˝X◊zﬂˇÿˇ8Œ˙ËO«F{∏˜t˜Òˆˇ~wp∞Û°EFqù≈Mæı˘w¸Mu.l`iûbﬁzS>+ÆKr¡ Ÿ
gÔ<Ù)?ˇˆˇ  ˇˇÏ}[w€F∂Ê_©∞ù’)ííGGéèlŸâ¶}kKv:+À+	àD ‘%äfù_0O≥Œ<ŒÛ<ÕYÛ0OÛ‘?•¡¸ÑŸª™ @ µ§.vT›ÀëD¢P◊Ωø}7j;ÍXLdÅl˛¢ÇÀMŒÉ¨Äπeª–C{k€v∆ÎÏOÉ!˛è∂ø\g ˇ˛!˘:¸≤∂Œ(}˛©?¬ˇÂYËÀ|KÃ≠NŸn∫ø°€wˇ˛Ïå·?ªy]ıXoù=ÄÓıFñÏ|uì‹§Â•G™⁄Æ;ÌAéƒK`≥º¯a¢íQÅãŸPpò‡¨)–òàÉ·ﬂë˚éÆd“´µ„ú åa3 π+ÊÃ∞-ƒ∆Ø∆ÏÌ∞\≠⁄¥]>.◊dí˘7a3∫Ñµ∆“t›Ú3· p9;[g ~Ç?¨}0UùfH™…ù¬vÏz1ıRWó7t©+§/Ez'Oõ(LeàzkòZp⁄Ω5Êrlªø÷2—<’ë#˛’±·¿ºæd.„4%©qÀ,@˙⁄Ê≥ö˘ã»˙ìop‚”ÈòÃùNÓﬁßÊbqıïÛ!qb˙†#i!ìü%3¯$[VÒQj…πL/Ç¯@ò%.◊>òØΩŸWf-ËåÈ/◊⁄ÜNäå…®∆÷@2kñ/Úü¢j9≠÷az&Ãq0b&˚·Ë≈s1üz™I;[Î77Ú§-Õ∑v‚Z]%B∞;
¶˝Ìﬁ#‘Ö<¸—r„Øyr÷n◊p”ç6Å¨â€å–Qe»ø©‚«D{áÌµÁ`B%bq∫Öﬁ“&cß∆¸cªäXòä≥A£SLB‘E*ùNu„‡Êúi÷.œÿÔL˙#]¥9'Ñƒ“íˇ„?†Ã§≤¡’ÙÚUâë{ú·XﬁŒ6ˆÉ”©⁄b∑’Ø|√`O+≥:Ã¬ éqÏ:˚äE‡Ê*XSuøTøõÈÜ#2¿Û\ıCKıh˙›˙z‡Ö^‡1_ñI!•°i,)cœBåõxaEŸ!^0oO;[:€›¿ôLºRüŒC—b∂í∞ªı	Ëã≠âtBŒaYxåò8πîTÀ>≈’®&œºq∏—ƒ8∑Y(Æ∆ç&¶ÄØy(ÆQÃ≤ïTÂÄ3ÖúÜﬂWM<¢w∆ÈãZ6KK/2À∆atÔÙÕ¨¢ÂU‰—§ôn\â1Æå.NÃ°ÕÁJË§B.∑ãππ™√+ã±œ¶„0—Éc3=è∆w«<åŸ$êŸæ¿¡≥]ˆ8Uìrû} x`áßËﬁ¥∂mWœ¥E.#n'V‡±L`®Æœc—˝ı≤n√‚Õ§>õÄ c∞dÙπû∆‚Éƒt˚ãÀ∫îºëñ«Ω‰AZ¶Ô|ì∏b‘ V4ZåÃUIÀ`ã•—E_§ı«ÿ»\j>ÛºÖ(‹ô≥®KÆYëhÄçê£}0≈®ùîSÊ™»NøﬂÀ\õ`ñŸ∂ã`@æ°∑mﬁØ)¿÷–"Ñm)+y“FK€àìˆ(£t{ÿa#ÛxC}+∂ÿçqÕçâá˘}ø(Y^]≈ﬂ™VÆ{êbë§å∏
Ñ9j“éöœfÕ0?R3ÑkÜqÃ•¬O67&†ì˜gñêS4ZMÒ≤¶d1îD€tWñ»Á)ZD(;YﬁJyñ∑|QÛÆZ9êK°ò†–∆
Ü,}ËÉÏ°ﬁ˝Ì©C.ã(1e®†RÅà^§—T¯6∞⁄_Ë+ór∑Öá57Ω1ÅíûqoàU∏‰ÏàõM≤#ﬁ©òØﬂtº!QD<»µ‰∆˘ˆì√C9_ˇœYnä1ß∆ï3ÚçÁûÑ^5Î¿(±ÒÏÂi:µgA8rÿè˙∏ûŸ	?£Âf˜∏A◊3ªÃÛ®Èøoÿ√ıÃOz5ùú¥ >˚€UNNÍ~¶◊kRövqâ>Q≥íR8ùââ\≥y	Ò«
L*ö[Ã˝⁄–¸îw≤ÀtgÜ™hWnÜöv9Qπï∂(Ú˜z'Œ*n$›∏-º¡):÷<vA8í+<xÃa  •ÔOπã®©Êß:ˇ˘,⁄z≈≠LÌ*∞N?ÃÈ˙d4˘∫Qõ9¨îıƒ!s!~8oè‚f˛öJâÊM¢i§dS∏}‰˙Ú{ò
 Ès:ÒMU$"a‹Í5õb¡-˘ˇqMSl§â$Üà79\Mtyÿ\	Q≠÷Ñ1M]ˇa´KõZg[õf	⁄ì≈ŒÏa´ﬂ‰QEôùö˝,≠ãƒ÷\â≠ïõD#≠$∂ôFŒÅ∑EéÆ/´Rìı_‘ÉOPŒïÑ9Ω°5¬´ï¢3)∏‘™kÖòÅ\<ïØ6`~–åá¢5µQ/km^ÅΩ9/z(Gíın‡<Tÿ¨êmô§ßKà/FAß∏,Änb€cÏñ¯h¿‘ö∞±5SÑåç£dëŒÏ˘]ÚìãÀEj!e¿∑ıΩ∞‚Ió_”∂íÔœ¨ﬂÎ{±}yç⁄J`c∑9pÏ7{V Gxq«õvîÅâü0p3X5>ÛÀ0©ü⁄ñµâãvTÔÄ*Ω©@5πò¡Ùß*Ìß Ü8UI~áUØ´f¸’|VÑ\‡Ô‰4j797or*π5>aÿôÕ‚zö¥;ËâÌsÄû7|{TûÌ!+Ì!À∆3s$ÖYÓÒU‡„dy?StúLÔﬂac£¶`„4∑‹'ååì9‹·bìváã±}∏∏p	®ﬁAN•›ANŸrfÏÓ0ÁU`Œl}€˚Nd≈X¬¢AïÎ€è@GÇFƒ+_Në; 4a~wN=™(˘¶ù≤4Àü0LnMóµ;úLlw89k∑'+∑‡Œ{°–>g†|eòÊ÷&~±˙fóäX∑C'∆⁄ºÀdXáÆÕåç:é"Ë9õWÖˇØ˚/ó√YafrÜ’á¶9§\"ÛêœkWõÖB«)â¬1|¸¶S·ò%.jmëz›~3h#KìØ ©¡C◊!ﬂ:ÌÙ9NRkò…¯ZA^Q¬ÅÄsro	 ª=IéÆJ\ÇÇ4íˇ§ÏgL>öZGöÀ|TÇ•HuKSèk$∑M∞2™ö	T∑$Gä8kMKlxÖ&ÛÜÂ&”Ö4óóö»JÕ2Í›âKã<~◊5º◊üÑ$†∞«f¡ˇ7Õ óàˆ_∏æ√…˙ˆG∆…ù˛c¿+$Êœ5LÚG&´K¯qáì©Ìì∆…Õ≥y‹·‰[åìçæl†ÔﬂÍ≤gx3èÊp«í2ÙløÛzoüù∫ÒÑrsBwƒF2I≤®⁄˙ljÔ,ò»	´∑&¨ÆLΩ£HÂ… Uæn&l,!l.§≈ûç≈Ÿ≈Óâ√^'–Ó¨eùVS9A≥·õIbkv⁄òÿÇ“æˇ ‘º)ÿU`ÅçÏq÷aÉ€1DôñeáΩù-UÒ‡@'ﬂ∞E‹^∏˚e<´$w,øÕkhœVaL°ÑP±Ô#2¨oz§˛˘Ôˇ˚ π⁄››‘¥Ïnöfﬂ-{¸ˆﬂM,n}w;âÌüˇ˝ﬂÆ„vﬁM3Œx_,º+.H5ˇ≤|G?5Í»∏ÆòºO¯aEµ!Dåg_ÎI≥äÀKÇ≈ÛäÚUE ˜|s5C|1¸’^ïˇ˜?˛Îˇ˙‹ïOì+}}€π“‘2ﬂ±%b˚Áøˇü;–(€-∏ûKt∑˛zÓß◊À?Ì€˘oÂÌº!'Ä´”‡›ú“ŒX_ÒD¿B’öjcﬂ°≈«$ﬂ⁄ ïvÉfˆÃ’EoÚb3ç£*E5A^X∞A€AË˛Ô∞<÷˛õ)E‹›‡C7ûp≥∞πeú-rvVÅÈÃ£NVx∂LÿŸ≤pv•>Õ∆œ,S¿}5E\s¸ØºÑkâAW-˜ïñt5=~¶ ∞ATŒÁAéﬁãpGHå~˙#£ü>ab‘ºﬂ£œñôg“–{úΩXß1¨Â,Ê¶÷ä≤p¶xÆÇÏQÎ<Á]xd±=·€gz7ü˙÷–sÿw%bè˘¨Ã27¢ÖKxËç&ŒË„083qÒ9«ñie˘D?5˜71ÍF40%}rnü
#Gı∂Ä‰•.)Ñ.upΩü:∏¢Y ˝SN± ﬂ/8 Ù◊ÊwK+˝*Òã§Øæ§˝Jç°Èr≠ΩvY≈yN’P“ã(û€nPG&ª«ºÊ}ª-æ™%‚k]∆ßY»n<Nù	∞Ö∂ÓNv]‰Õm'í„8t¨p4˘Î‹	œÛ˝‘b°∫∑à’¢˜uÊ⁄gÑj’∏öÅÛR‘Ó](ÎrŸπw˝ÎÚôªpÑS]‹g^ﬁ1nPÂógK|pÎΩ©ÈNwQ.⁄T3Ô(£ò˝ÜÒÎìîx±Gè0¬KoôùÑ¢\jÆYB:"w	VÆi‘2ÓÊßín~2Íf8ÊÖ¿ÿC©SﬁÙX>ˆ˚Ô¨•`¥Ë£∑fNq¯'Ïêc4ÚƒëÃu%  Æ√±ÂEŒøË°ØÁ»1=¡{ΩµOO˝P‹c÷ñS‚ıñ›p‰9-
()óg¨hÜà5˙ukKÑS-éD>‹|$ƒΩ({˜Ãıºe◊ D¥ÕÜØó˝,1Çﬂ{£sòÙ!~#ºƒóïÇﬂÙpTvp⁄˘π˜KÔe˙%≠ˆ`Û€ı˚ˇæˆûÇ≈väoID2¬ÙB'ûá>©p8ÅgâñqüãËòã¡˜aæ P?v@Fw<ãª#/9ˆ`&ÆmÉî©5∑Õ ô§OgL˜ı~S∂àZ±>äœ=$’ùhÈòNw»06%√xrUÇjÄú5~r'y?U‡…Êy0µ∆Œµœ0VÿáñÌ¬”Ì≠m€Ø≥?Ü¯?6ÿ˛rù©qÅ¯ˇê|~Y[gî>ˇ‘·ˇÚø,Ùe∂ÙÇ›ôØ<¶„Åßë00¸ßAâÕ∫È±ﬁ:€ÜÆ∂…=ë<‘à“ñ;GÖ£á
ØzT!⁄Ú‚á9∞L|N¡ SÎ¨#’ç¯„D¸ˇéúzÑf;◊gRHÓ8'pé"°(T’O‘ôö—&¯qNwÿ.◊∑Ô] ÚΩ\ìÿ~?\¬—^ﬂ˜ƒﬂ*Ωúù≠3˘ÀOÀ⁄∫
$É¯;Új„PXØ;àòÚS'òõ$0≤·##˝¨	Ü<lák≥¶+N¶^`àHÉ–ªæEÅÇYC<"ÅƒNDîôÈá$Îm”⁄.Ìﬁsym¬vmâ—p’È*F≥ƒ∆i¢¬f„Hü_n)D®YkÕ–gX≤	MrRõr»“rËDëmÒ˝√•ﬁØ‘/§ä¬ãCÀ!-”| „•÷ À–å{–lp#óÇ,Q›‰˝Ú.|òÃùNJ„'°†Ô E…’ÜﬂG¸û]°{c¸Ç§-˜.‡áÀµ&É1Qe'Wò(]¶ØXkìÌëdˇ˘¿ÜAhlÆhõX(ÀıÏá£œ9l~Í9S@‰n÷∫tm7öy÷9ä™|©‰ì∂"$m=QÎ≠çz*iÕªJåë®èv}Äb %'^y≥ﬁÓ,◊Q1]|ˇÁ˛C⁄)´`&w7fîﬁª`âNÚˆœt&ÑÖg¨1¨6Y#rß¥e*3P”ΩMú∫ëEë?µ]ÃU{»'ñ/hóK2™∂0YA_MV†ÜÕàøJíŸ»3[É÷∫Ú1& a äl∏
y{‰&õt6[@@~F¢"t?·F[fEÁ˛àôIà…$Í±NMXAkDA~ö∏ëD 0±ØõH*Hxül=2¬®ú≈<«·π‘∂N-8h6_¥˝`dÊ`√ˆpùµ§5≤µÆ.ùësìQ_  2€AO‰LmÕG#Än®`8ˇ¬–ù°%6zÃ`Çó8Àh¬⁄Œ≥¸s3Ÿ©…⁄<≥\Ûµ$À”¯‚ õ¬  ¸2\RQ‚ï-ËJ!˚V3#ÈÇÃß<jE“y€x’=ìA∑y•¸Í˙‹=™=:23G™õÖÅì≈*\,÷∫û„è„	◊⁄ÙÿW_’≤È"@^√T§YNz1äßŒ¨§∫yfQ@ıiÉl8rE∑¨ÌúwÖP$k k^d)@¸Ú,áäG§Y|–À $ÛhÓ≈t„‘MN/yŒœ®eDÚ≥)Á8Á¡}9Ò¯∞_Ò¸ –Ùq±pÊ.Î—ÃLs'+%ÅöÁv7"gÑ±Ï„äÁ÷ÿ;uÜáÛ·ë5™LkÊ∂ÿ£“{Qé ¯∑KÎté-€9+vdWéØ¨ãj/0Z‚ ÕöS∞˚∆9Ü#9yrö'ﬁ€@º∑Û¨(ôG4s˝N‰ß≠:U∆ÓdsA†§ 6Urãb”]w6æÇ±Á∞˝Ìœ{Ø“tπÏÖÂÊ®’˜ÏnL6+ó≤÷áª∏–≥Œ˝î“lí˝∏íΩ_∑!oRì¢©ÿ≥≥Vy6‰íØ&!¨µwÆRq”,ÍÓ·Ã
?zNT‚QÀ1¡ﬁ∞&)◊ÒœxVK/Í…Inj”∏”/âIÿ∏Ø£ïO˘‹9yúwgpm@ÕÁãgÚ/ŒyΩ˜˙–ÅÎ”eG'Iƒ˜Œ=wÜZGx…©,MúûÁéaÕΩÛ⁄ﬁ¶ÅÔ∆Aà≤≤/©»ØsÀs„s∏≥6 ˙˛*á@•tX\Æaû;u„®ÀéAéN&˙ÎˆÑÜW9QÊ÷O5t¨∞Èuﬁç:? –å}ÇÆ•Ôú	¯^má>Ïzf¬Ò>=7äyn√`R¨ÖÛ*è¯gÛ»	øhzrtQòoQÜ¯‚:<Ccl]"≈*Qü5Ø"J„,™»ËrøWO`ô0FMÑ´ë˚KÁ¥Ùp◊Æ®6£>[c4›·?á¡©ñyÒﬁ(12˙ÃwN˘<ˆf.ÃB'√«YDN¸2˜Üb®óNWØ˘nœ»ô–˙á≠ΩÉﬂ¨√Ûn∑´Cg•â|˚»H¯Ÿ·åıë\g‹Mp+U·Á¥™bπí©·[ÛMMŸPA)¨çqËNÒF?d˘”≈⁄•j8øêΩ–T7*õ÷kΩ=ò‡≈ûm◊Nn&Uèe†l!)YÑΩQˇMΩﬁD⁄ºÁ!∫ë!#Öm Çey FD¥-P:…‰„d[Vø/G®oŒ∏"≥<‡}v ßl+∂Ü∞qüÀÕg0#«ñ[Ù3P"eΩ◊ìKÙû‡ ª±¡^œû#óh@Ùí)ˇ7 ¯…¢Ip¡∞úg-&¬Ù¯yÒ‰¥ïañmë§∑ZkÑ)QuB˜Y'NRü±M”Ù⁄ úv‘Ω†úóK“Å19˚àr!ß]gñ|Ñ|MtÎÑôd∫Ù04–¶o`z?Ó7¬…è<å@Wp∑ÿ1 bJÑjÈT.  w‚{kÉ1ÿö≠…GÀOvÑ´Ú¨Åôz~µdHG\¥äuÕp¿‰æ"/ÊD,ÊÄ*®ÀœºL‘©Õ:K.'1ﬁ8˘	_¸-`†≠^Íoø\,÷Óko^%FÎÂâÉæ∂f.êˇiKOI(DQ≈kuÍ9Jo¡1{zÜ‘ƒ6ŒOâQØë•&[+§4Ç…!êâóây∂/êå‘π_÷…ªì≠⁄Ïï›JU~π∆≤zIgù9ç|!bQ»ÉrπaªòAK,2E-U!y=
;ÒâkJÂÅ¶/€9∂Ê^,µ	l8wΩ∏0å{ç˚@è·Ç£ó~ÚñÓí6"∂c∏¬©ç£´œ⁄P≤ª<‹ı£sæS≤J¥k2ÁQØº_äï≥†™‘âï€*Â’gΩQ≥ ,i|^Z’3IN04Öz‚GLtQÏ5In®ÿlâz]-SJÖlñ£n™^¢Nπ’%S
 }ö˘€$@1Mﬂ‚<≤ÚMÊ|óƒ}XZ;ü2èèµ*¨|{Ñ˜!!ßﬂ±~è¸$>˚·æ¨yÓ»i˜÷Ÿ˝µKî‘?v∂÷.?Ù	0Óœº—É†‡ëu«®ôÈ)oà≈’LècEbGa´Ö€‰Lù–Úƒ≈Y∏QÍáâµ$˘^û∏mÿÈù⁄πãTçd e4›q}Æ%£®[≥ˆÜ´6ÑeÑVﬁ$=§Y≤›•‹¸˝2Wø÷Ä™'“/≤òπL	ï∆,tN}Ü¡√å¡ù^`“&éLÔM\ﬂƒXÖ«I¢1Ì"ûêÓ+FΩ0÷˛?.˚Ä&gfN_]J÷™E]î „ÍZöç»‘◊r	çO÷Ú∫ufãOSe≠Å_!c≠RÖêÙ¡4uªlËxiË[⁄PaîµTudÙTÈ—LH“µl’Ç®™:2Ïåô´öîëò˚ÇöÓ1˘ªdœ——ŒºƒÓ§ì∑µ©¢@URÛJ˜P≠ÄPõv¨B†HW¢…˚π„C{òúc¨Ã◊î™ì]òÑE¨0˝ÿö&àEØh®Qã’={ıûqpTgzªú„ﬁ1=	lG¯ÜÖUÁ£È¯¿Àä;≤ª1∞´Ó¬S¯Ñ®ﬁòÆ⁄ÿÒC'*[µ›¨óÖW£Ç&yt·C◊áÀmy/.X K‰∆@ΩA‰A®S˜€eîJnCÓ©~˙TøÏÁÃçﬂ≤êÁa»›Ù¨ÉÆ@,;≥ag∞@qwÄ™´ëƒl∏PntXqxvQY˚å√*ùSd…ŸÕ”ß¢Çf])@VgqÇŸ;7ö[˚ûo~ÈaùJV™BX/Æ ]yá>è≥
?∆JáÍÌTå’OÔ´u≈¨èÇ1:ù∏ë;tπC€q2Ù(c¸¸wŸB‹∑A8ñ˘A9Ó%®s¸,ÑË›∑N‹± ÖÆòFÛŸ<ÇÀQTÈê˝≠3`$xÑÌ£ø1˘E {+á:SÀı#‘?(S6sG4·\(‰Mw‘b¨πí[µTbpBóÃÆÔe ~$ºZ‚å§XÛ®+T!‚¨> <0‰ª~ˇ=IWﬁè6-ñFùÕ’ÿ¸]uLWMî•WG#9Qëö∏#HuØ^XHñPÉ0oY1◊vÊö%â. B∏⁄·˝dHNómª,Zø>Z]≤ØZ{*Æj«ØnO‚~¶Í·Ó]§'≥sÂÇ7∏ˆ-û¿~ç'-\•x}z≤zß?TzçEgXq1sú¬\ç•óÔ‹œZ]™ÌíU•Hæ∆∫uH;|ƒi¸‘òOuÃ’IÇNËe@Ω„R‰/ºÚ©$NPÎbÏÔW2ˆ⁄œ5Bg> ó5Ôóàà˘åêËoD—»4-O’`8	}çb+$§®À—≤Ùa«∑Î]Ê≤l¶˘EŒÂ+öÃ8!¥Sª∞¿ö\âﬂiÂBΩ@[€E≈!º,7+z*˝≥ë0î–¨F‚P˙ù@¥(eó"@Ùæy«–F‰˙;|˙äJ1ª‹˝¶âNï—–‡Fér;Ö%¡Z$ÂÊsÇïº.¸™&nâ"˘Ò>jU1Wóﬂ« aUEø’sØ+Ú≠Iz|ì8:b¥ç>`º¢j Bêpåö ˚Y;DŒÅob¸í°äU£F$‘B1âõ…–d‰¸˝<i£÷©¿<Ç&áøXÚ∂ñ§aµÓrÿ‹Hìl£¢¥ŒÕƒ∆Ë†O.ÚÁÙ≥Ωˆ;;åC«ö‚≈ÌY1¶]"∂Fè2ÙócœÜ—ºΩÉ&ákàTÏy0åOt’‰|•/‹¡¡,™¯µ{ÿ‚‘òÒâº}Û‹ho7N0t4Å-ÓŒ`[ÉêM‚xÌllBΩˇ’ÃÒ_É–ËÑ‘Í∆∞¸{¸#û:‚∑å$˙`§µQåu«Æ„Ÿà‚ìÖ'<µ‰Æ,s‰uNN∫qÕºπ√æçBw¶	™¶DiZ«ŒåÀS˚⁄2&°Érô≈"õPﬁg ,ÍGß—√ãm™òùpä+lûãî2ê–â‹ﬂ‰œíA≠àß‰®Œè‹›·8t‡-¡âÎDZSóˆÅ`Ü$"@tÁoPÍn’óNñ˜úy §∫£˘,P÷xÃŒybXÜ◊ßf•4wPã–.ﬁ1 æUÈåÆ\·¬eÔ1ªl4E|VnÚ∂A±‹•˘«ˇdÉﬁ‡æ»‹–e{0bæÎhÓâúƒ±kÓPŸ±Ú#≈|]!Á# ŒWp6ß”πèÜ¥OZ÷¬Q[Ö∞ˇ6™Z“Áoπm¢˛‚Vﬁâ˚Ï÷A±}7¡í(˜$Å%YeF^	tâ2
œßU|DV≠¢¯º5åo;ÃséëS«¡¨”ﬂ∞NZıãqoí¡ã^ß¡'º»W√¿GRz@Z˘◊6kãÕ1ó&®6*ŸZ`πŸ;Õï!§ò˛ï∞_èá‰Ü$&úP◊F
ë/NddπJ›Òò".Î2çËœP˘°–dN‰}◊ãTÿ&°súù:•˝fä„Ò∞ıÏùˇQøñ!j-¸ ò9>l∞¿õù0§T°-	«ﬁ*2Ë¸πI∑}–£Ö™"ìá3Øÿ‰E%âRs&6˝T§ÎÍ;JË∑Ó)1{z&bNüª˛«¶¥Ã™ˇJ≠W©^´WLè6»•ΩÃQoÿ!ÀsG"Œ°pW,L⁄¡Ω≠~xÏwïˆJÃ%¶À˜ÖÆSˆƒ©“]*ë◊-√GéÁåCkz>GÀ›ΩVÙ†ºÙ>V
‚Ó‘πv‡†à+A Ó†√’CáÑ|ﬂaáaáî∫£1H‰`7k≥ß ÜÍíüPêÄûo-¨ëx=˚’õs‘∑≠÷òÛIY˝s Bª˙ør„0ÏF-m—g>ïSø7õ¡±˚¡©≤ÉÕ8-l√GlÉÌΩ˛B„˙‹IWr#¨Ÿ,–ï_ä¬ÔÓÖ∏ "°4y¿·!EzZ4˛üœ]Ÿ«›¬IñΩÉ‡C«^Å‰ÿ‡vÿŸ`¯Xà≤ŒR7Dã¶JUºE:gî?Ë%Sœñ8U'¸ÑÕa[€Nw‹]OùîNOO’›G^µ·‡#¸Æj´∑/ÈY`Ù¡lzÅX¡æb{")˛'m3]ï¥ºqüîta#?ã)%Zqã)1Ñπ,éeÉ0¶.?ßzﬂj"ÖL£ï˙fí˛=Ö	π—ìZ¯ñ?rd‡QvZ2ò(…˙%ˇ∫T®–ûÁÑ±P<jI~¶"¨ºvÏ˘õïƒ2*iÃ4#ø◊ﬂ|n’í“øZÌ≠:ÁÅ≠sr«§®µﬂ–ï«⁄“+îü£ÎÍ"ë@8d7Án#ŒŸ»ô≈åãfë.ÉË2ØtkcIÛë§µ#5Uπc∫√æ®8¿ı∞jcú\xpc.Æ∆ò-(d"πhJ∏bÌ[!ÂÃ4çÃM)5úpã…b†fÕƒ∏©Â>)˛c_C3j±X}ºaΩÑ–Í%® ¸»Döî·⁄ºJ<CÌcÙ∏Ù‹è;ÖF!W'Ñ^»aQ ^ãïgù<?ÃíHs¬¡™.≈¨XÀó+‚ñÙbƒuñÂØ‹-Vn£(—U…d|°„QZmˆ·8ü5∞/îÛÿÚÒó3⁄î_Ëf∞
€PU‰Zèê+ZœÖU¯-≈¢ö‹‘7NáÆêpîªzËNÁ@VÉPgF‘3l
À÷/KGä—3ëû√ˆü¸--¬¢‘J”v«s—E≥—¸pp¯zC.J=◊◊Ú}
“ÊŸ5O%±ZΩ ‚=⁄—>√T¨∞ÿ¡5ÈaLaCí°ÿàÅà+ F∞,î(ü£)û–  ƒïü#Æÿ≥m>ÀcáÛa'‡!Aı%Í'jXyw6ª€Ua+åÖ,¶"ì_IÀT£%0©Ò(h‹RñÃŸ;Oe˜ëã&µì/õ-Râf°Åb°|
Àc"1¬œﬂl˘û‚ˇSó<”©j•\	Á|zMzÓÓ∑Í6({¶01{w	k\¥≤$ZlœÇp$JÕC kc„·BAóª€y"ù °´ÜzÇ˛j>X„rÔyù"i°3ÜUy∫∑YnZÍK«g	úñÍ÷ELênƒQ±5»¯ú`Iê¯öRx+6ÖøñuC´¶˝íâcÁ∂X|rªªm.¶óMb)FãçpÎh%S2]$o5l∑jŒ<Ãÿ≠Á≈Fp¢§≈•T~‡πeêvb∏â"Ω¶|(·˜“
cÎ∑E[k!¥≥ ˆJ•˚…üXaËb¡\xwƒ⁄Ë∏ku"gfÖXñO/Úuê=N1._Ã_Ô∏&-∑Ìrlæi<[‹Z˜ÔÅÎ∑[Î¨•…^å≠h¬%%NóUWaƒÔÄw>,e)YΩE¸ê=L:" n4Û‹fG¨,!≤e t∏|≤&,ÒiôÊÓqxéÂìñSVd˚≥#&L…‚O»Mû≥¯ ˚üS«»ã3s¸Ìôõ≥4/ ˚$€ˆíﬁ∫Â–Í€≤⁄$˙/b{zfMg&L÷±Àˆ¸s§Ñ ØbÃÓ¡Àì°∫nÎÀH
H«· -SΩà¿tﬂV•â†ëu©óeOD≈∂wXd˙L©|2e}˙•[@–3zŒïWpX≤6≠ ‡ÄDsC3u≈¡∂Äö£{È›⁄a˚â`£H‹¢>∆Å(.Cd{ÿÁü;5xzÁ«⁄9Ô—Üòíz[ÂïçØ/¬HyÈ’DÂÓÈc@€«ÃVí9∏Æèúıtrû+∏éµÿ√ƒxÅY⁄EıeŒé33Ä.Áçhe7{–fœx˘œ¶<ó(©¢Åø\uíÊïBÇYÚüœ,ö‚Ÿ!fÖBbÌ˙^âO.Íıƒ x.…+wXœøÔÙW7pêÂª˚öó'æ
Á÷[xöœÿ˜^0iU@LÎdò’hÅÇ˝˘t®.,9˙gb¥…`ÒÙ˜{ΩõÙF_E±;≥¬»9„v˛2≠…˘|˙ÓÎ7ìtÆ¶„ÎºWøÇE]xnœè›Œ„Ûºók2Î_A9/˜’&ì+æÌ*S ]ÛëÕ1	î`˝¡Ê÷ˆ˝[ìnœñ+/»‚'ﬂÑxW‚p0EÒµ*æAæÁ∂Ö8∂Ú¿?*«¶	s(˝hQ’;\U2l´Gﬂ≥#¢2ÛÉS‡´X'ÕN™|˝ËeÈ4\&Opï≤¥RI∫ƒKCèÊq∫ñWÂè°ïÄ¶îór(øõ∑&•ÓÆ]≈U`ŸZ◊∞Õ™K¿?5t©◊òπ““Lπ L∂<Ÿ¡ îg2Çôoÿ!‘55åÙ˙◊Ês¡Æı“9MºµéQÅ«ª‘u°)èTo◊™µh©ó‡πÀ9g˚J›\U›Ì§™Æ,°[8ÑŒCEç¢¬á®ôCÍÔ◊ËƒVspIÆ˜Vh[ÎúÀUÎp≈ë]f—xØ3◊>„7BÁ4Wª˜ºvÙDI8‚π®ÄX ƒVj±æÅ†:¿7ÜÔœÍùôÁv9⁄©:i?Fπ•`Ÿª>QßÉm	Ωèˆu=	¡dÑpp(fm¡:l~¸3úó˜b!ö∏Ûm.íNe∂ˆ¬È†W‘∑™C•FB√ÈZ¢:¶´≠∞Â§íÔÁ@√∏Jry3z#◊9√”G:{5ÁÓQ‚ÉAÍà±ˆ/@“¯8]^î≠*}ÁéÎ:t3ŒÛŸôî$X)O4M´Fß++ﬁæ…Er¯óî– ¿G≠ˆ+ıèê¬Œ©˘˙êWC‚∫*“J ¨	Y≈ŸõS’oÌ·.≥ ]=ÕQ”∑oûs5ﬁ’UaZ”Ÿ◊ ?2ØoøÇzé<ÈB≥jé‚—ÖÔj9ñãÂJ≤í=ﬂáS=˙ÙΩ5h:áïAÕYºDj˝Ë•ïÄTÖÅF[ØU&4‰-VKÛw;ûó'A"ÿ¥òÖÒ‚h5=©[◊Tq±dŒû~q*x∏€°bØ2+bZ>f˘Ã•A®v<¨q94RÕ„°kÉÄ‘òXE¶W]=kóHƒÖ’Ã∫>ûÁÊ≤5¢˙HÔ±Ã™G◊TÉI*:π±i¥»ZÕ«RTå[∆ê®ôTn$ÎC!≥æét]ÃHÕ<Ø?DÕG$Nëpñ€©L›bâ∫Öe“Å{g±<›¬ªLLú’# !œ£Û∫Å)º?°‚'tj}€J}⁄å ◊ÈÏ<A——4Gh´úÿrûnÖc≠Ão''´VM•⁄Gâù§d(>rg;®¯s∞¬¨3†;◊«“´2-ê5ÑIg±rF’d—9A;›:Ê(pß≥ ƒ@GÊÃ*≠SUWçß`±NÜ¿Ÿsó@c.ÊZ!KX&\z„ùÄ`ùë©§Í›h∫√ÉS¸π6Rπ>-ôûLA§zÆ J:`;T◊Ç¿ã›Yno%rå¶"&]9jx0ÍÊÜÊ[ºQl«ÆÁÙﬂwh≥8µ€ä6}~vóDõUù‹v¥Y5Óœm÷ÕÛ”Eõ’¸B§Â‡4∑.≠Üy«î$ı>SºÀrÔE Îy°$_¢hë‰D2fY`ìúFHñßL∂¶^_lªë5Ù˚·ÖΩù°Bfifi^‰¯¨‡hêœ+ äÈ:xI˘#Mãe°˝M´ùRœe∫
'ÈíÏH}gß>ÄLcY9Ñij··œ
I´˛-õ,®â+ /YﬁÀåÏE¬ıÅ#õulGÔ˛ _.úâÀä“\‹aN¥ﬁcÄ\≠õá˘†Ø÷_¿9´Ññ-BVèf€Oz˘ôØ÷˚fˆ}'~^|{;Ìyı1ÙíxOl2˚öı/aô:J„Gü†Dû¥[‡;∞⁄ì»ÛFåú6ﬂŸu÷ßY˚Ø·Êå9õ,Ûp√”ë≥Ó/∏¿-0	ı0-‚›4û6kh¬T§Uáø…Z n˙zê‰’_ï ?_ë˜óΩØœÛ†⁄Äã≠Ñøxé?é'lómÎÀ√—ÆëÒ%*=∏DOÖÖ	Q‹gZ-Ç˜¬J˝UVz1R™™‹âÑ®@ZëæV‡ƒ≈ã$mƒı«[{:_{Û≤ö“h' ]sxıGºæ`‹™≠ÿ∏≤á>ü°íu+¬Ö p]åo@‰h[ÄìdU{Ãbù)íÍ0Í2~ˆπ.{µf≥˙Ùrî2rµ÷àíØ√`h]SÊôKì s`È‘äTì¶¢fQ∫Ã›ôÆ∆ÎuäöáXPY∫%EÕRÌ]rô˜ÅD1[?∏ZÂà∫ﬂøˇŒzó_÷é]£⁄”ÑÎ¸€D@-f™#=po∂˙µﬂ∞Œ‡ΩZ∏`Ä”.Nˇä‚ç’ñ ∏Ù∫À⁄›+◊Z&“PF«œNlÂ≥u*∑’QrN«·||…f<"Ìﬁ©u¡Â?GBåÂ>ª¨/øT”<ÇîÎùÛGVÓ“–ò&ΩØ^t8qù”Ê˛V!Zï˛V:?® Ìí≥8‡ˆLa¶˘ä=sCÛ®T,We0·•#g4Ò·˛yò£Ω"f˘6ZÇ˛Óåb%k≥ùÿrΩäS¿O@È'∏eù±≈ûûM,`}éÕxYÅJ>\‹∫i{W„/◊/ Ëâ∂ô9Ã!§±Ï‡%¨%¬ÌXö˚”N±a´£¯ÙiÖ∫T¸´û•ò€œΩ_zøÙ∑ggøÑ„°’l~ª~ˇ˛ø◊¨’ßtﬁ}ÊY„¸»øÅÅC-4¶gí∫º˘r
9˘πx≠`	´bk√ç±•…∆ûªS†o∫∫R
%W/ŸóozâJπ_4Oz◊Ñs<}Êÿö!ˇÃ√,≈“ƒ¬K÷h˜àóg1[!¶D=QlÚp^µ˝µΩı,+ˇ~¥a[Ák]|â‡~ ¯÷a®§ÊÃ¬™±âbÛÅca8´Îi8w∂é|‰§◊√ÒjdË‡&DmDp4Ur"mjK∞-r≈ÀÁ~^yXŒyÚ~9Ú¿Oï6∂æXî$€,M’>jÉÁ^¢cŒ‹±¶∂∏N9«èbæèF. é'<ç\UíÅƒx≥•°oÿzΩ∏7ØèjglT…]lÀÉ*∏«Ûhh&ÿÊUCôÉa˚HŸkkÑ®ö∆¿Ã≠–d8uÍã77ΩXå√˛ñ;€†Îﬂ5vJbˆ#ß‡∑Í0>Cv4Ëayh`,◊{‚˝{ıô+"Ø´<vä±ßÈ¡€‡˚•„ÿµä∑&gØBıî0Æfx?ZÆà}—3Ç•N¢vÈgÒbêqhŸN*Y°a≠Niø4¿®˘à$ÏdÂÒPÏ©uèyÁûªéuAB|¨Ê_1(„7Ó¸¸ßû’€ÓmWâ¡9['»R®∂?ˆ@‚ò∏∂]üudŸ¥^"Û6\î≠AâT˚èÎ¯rk∆Ep}UòrΩ•ät;pbwÿØƒ7*15’*¯µJI©p%SIZE$∫C∞y·DJ ∞Pñ:S`p:3d‚\·úÚU}äœ«Ÿz©vP‘'Í:Ã≈`Çñà_E“ıâ∞æß"éQ¶+–y"l/§N„&≥≈Ñ$7Ñ%¢iÒû8û3"z'õˆ&”=”ÍÜï=≈˛)
a" d∑ÇS∏?˚ùµ¯Õ%JuŸóÕ£´≥ÛpΩA∫îcA[RlvÊÈ˜ÖΩ¬ÖC∫∫…"RY¨ÈíµIE©9yí‰Ê|«i˙ÓÜ¯L◊≈Ö2H˝È(ºPÃ·;Ÿ€wN/ ~E}πÜ§`9ﬁ#Õeªˇ˜òµø»‘§Ï
…(¨(n∑¯É,t~ùÏ≤±†OZﬁ"˘ÓÑN<}Çãi2UGw>9™Fs{ÌÑS7äÑF‹woxzÑ™∞#
¶$j»X;"fß«uqTÇÁ¡©>‡ÜÓ!-áce.ﬂ≈ïEü˚æ¡!∂º–±ÏsXE˚∑öV˘RùÅî]ß¨±é.…Œä∂÷'¿,Í%’"YÖ√[ƒ}-˝¶6Hèíc‡ï9Ò»æNµ⁄–Ç›h¡™6O6-Á≈˜'o”ª=Í0/J∞thœ∫6àA…¥¬©9·ç˚°sòüd¨“—TRqC·•nú”L[?vﬁúÑrû…˜*µL'òT@˝|p•á—/A”§éñ45ûK%rOé7,é§‰ΩÃjº•VΩ∞‰°Tó§Ï∂äÅy2w·RüÖiq8NHëHﬁ/Í◊àÓÌç‹Ê™ÿ_c@âmE†m`£ÏKu«†RIô˝èßıìôJ·ø"µ êÊNp’œ_·ô¬f…Vﬂ_e”ªú˙-èÊaÑ *«ÿ	 !;ª‹©V≥$Ò_	–™ÈbÀ$n˝xı˝ëËeôO ˚	ò‚’O∫Ëıû˝¨L’ ó¶Gë˜ÀåKä9('®7.ò‹À •ã§†πP„˘\¡B’kòu@ãª€°˚ˆWÏØsÙÂﬁçú(i©ÊÒ$›ﬂ[πÕœw«’˘±æ"›E;πMøˇ^;	Sñ(∫6ZqÍ]Y€Ò#—”#hmçcR<â5NËå®ß/À⁄°”€k/Tôn™*Í\¥∞	;MÓ–·A¥±F‰±;÷ﬁùMáÀ4ŒäŒ˝£√Î≠£
UN2âµ	t@bï-’≤%.‰à/’<‰ﬁ•áÕØÓØ|Y-æ¨_‘⁄ºˇhŒøO˙˙ ÏJ≠#·‰Í˚Iıø“@Ì|äUº.
‚IÄÖ.*ºÔ-◊ø3ÄÓE⁄Œûﬁ≤Ûm1ïèö>Hù:°»üíœø›¶î%0‰≈Ëq:7Áœ
´ÛıúioÊjB˚™OœíÅBOº`n√ƒ@J;“ÌÁùÕÅ3ﬂô‘ã#·T6øb_•∂WoX3˜y“ÄP·¥∂˝Ú÷Ùã∂ûã Ëy‰ÿ/k®˜7∑Ÿ◊â„l
RˇÃêR}Õ≥1=w£8˚{Øª˝/lcÉΩ¿Ω≥f≥08sß∫'∆£ˇàm˜=ﬁÀ6˚˛±Ê’¥]ÃFò1˚Ö∏¯Kª-ß∏ëÙXèó≈√jâøËŒç~¥Bæuy◊ﬂ±Ω∫ßÑhkàñhi& ûTnÖ„€êIh≥? ‡òÊEóÀûÊ˜)Fó¡§]àÕ∞˙Ã=sÏvÌíΩx¨ÀΩ´™*å/Ooùq`åâÉI	‚âo.£Ω‘`\≥x §]¿°O◊∞v˘%f:‘â{s°~ç6·Ì$ùÅ∂î⁄1m%˛ÀE;!OI8◊
'ìªî^Û⁄–æTXæIgìùÊ3z)åûˇΩ¿Â´∞ÅL}F°/5˘›õí‘Œk<Ÿa=ö˙L…Î.¸pÒÂóhd®˙ ùå8Ô∞~wõ&£8p#wXˇÛjì$cÂa.üöõ ÕN·ûx≠áhRﬁ&2–•±S;	È.+∑˙˜◊˚∂◊˚Éo◊ÅÌØΩ'Ë	à—Ì+¸(”ä«ì–â–o≠.ΩZ÷à∆Â:‘Æ‘œz_æá€2;ÀÓä>π∂ÿç=Ëûg…BÛP.˝≥Ñº#n}!TH‘Kﬂ¬ÑõË¬€$kÄ˙™Êå´˝ê„[Ä˛iÑ°xáï`ûUr)∫W∫º)`ÍKvÄHÓFòÎÕoﬁgbÑDHTß∏ıªWê|.W=ÏU±Ωä¢Z†π\kÎjÀ\ï¢aÎFıA.il∆´ô–T∂ù—élµCóæ˜,tj°Ì@•œC]RqéÒ)	ÔúÜ÷åC«˙»=gÍ¶pÒü_ΩÏFqÏD≈zAUá∫›Ó±\°Z”kÊ˛≈9ﬂa˘ß∫‚œ⁄Ò±\È£›àg^±˛˛Ê”´ˇZgkÌÚÉˆmÄÇ˛Ãõûiºº|@”ıﬂ‘}\´?ÑΩ_MÒÁu;˜ÊÒÑÌÕf<g≈JÓËº4çë2ﬁ˚Yá>QÌ≤Îπ∫(Ö8¸Ò¬õ%ó⁄{}¿2ÌnàÔ}ßWå\p{†5õuÖˇwDªy¸ﬁU<∫xÛÍøHπ{ŸÕ´7
◊/‡“Îãßh?òZÆø‰√D?79ù◊2O ¡˛r≥ë˘VÏÊìŸ›òW^6ç›£h–Æ7M_+ôª>BíéXiD=
>:>k«·‹a÷ª˙y}ˆ≥2¥º@Ó20BB¨ˇ—av‡ˇßòù 2)òØIdA≠SÃgÇBÑD€çœ◊Ÿpgu¨Ë£4'^>É∆≠z`·¯tÁÆ}…˛˘oˇπÑj{gyÆfuÒ¡k}>i–¶‚V]õtRu”î0+’⁄»y ±€‡‹Q∏õ¡¢S ÿz¬Oq[kêGøF˛>äÎ¢où∏c+¬Ó»sg√¿
Ì.O&Éi±e7z ≤sCÎ`_^∆Q0s1ÌM¿“ì¥|Œ˙ÄzÿZ˜±Ü˙≥sˆÔk2ﬂ⁄ÎBÃ ^˛!‡ﬂ*^ ‰Ö∂øw¥«û˛mÔ≈ÎÁOØ∆ˆ˝ÛÊ ÔYÆLë	ÆçTj8˘Êaq≥aMp=Ôº$Uïn£±=hÔƒr=ûiI¶ÉC€9k?BÃ˜‡Äó´™'õö¸T∫ƒFS€(±QYü2˚F]}™\Üæ‘\˙¶%Y?AÈîm¡˜é÷&S·#“3˙≤% é&W*‡*S4xc>¶G"‚dL
5·ØG€(Iﬂ∆cN4%9í¶n˘:Wù‚”KlÜr´‰Óóüä÷ü®=$ÕÑj:÷yÛ7∂ø{ÑiG≈O9ácÇóß—√RSƒ*k/y7F-≤Û˙§jÈ®Î¢[ñU®O?[2sdçoëâ≠qBb‚´"1ÒgCbH3Y1â¡BÉˇΩ#/w‰e°¬ó)¬fºt‚” ¸xÀH%hΩC?ˆ‹3öD˜√„WÏÖE¸Úæ˘Œ˘◊¥/ø›)˙¸⁄N@{`o6C∫˛éÿˇsoN˚¶˚◊Éüh_}Á˚|ÇÍ¨…yxÌÅ«ÆÁbNvJùY°Î™òH≠¶7k4&¢z€?Ë-Ü(◊≤ı·>…mÖ»]HS\w°Y√)ô˘j""¶1lÇQD‹üŸìI@W»d⁄˚ØÿÀWGÏÌ·SˆÍËáßoÿÎÁ{Gœ^Ωyq®À¯°IäH—:jQñæ[“ﬂæD'Qô,∑yÜÏ$⁄[Ë ﬁ8Q0Gö4£fZà¨ûN’p5YéÑ~’Ú<Æoy»(ÏânÔ∞÷48qùN‰Õ«ùπÔ˛:wà1V‹µûÅœ≥#¸ç˙‰˘ÃI^L|NÑm¯:d˙cxËAwõ˙à„°;&¨3éo–lu˙É†L⁄„ôhk0a˝Ì)ÒπË‹fë¡s˚ºlF© ø±q ‚˙ƒ	ùn∑KÏo†Ù6â„Y¥≥±1ΩNtƒﬂªüçâ·*⁄a0[Ï*˘ƒ†≥(k˙6ÙîﬁúÈ2ˆ…g8
®KTñ)ƒﬁHﬂgŸ;œÉy<ÚómúZÒhÚË‰!}mÖ÷dá˝‹πn1ı¡û}‰q:≠˜¥N|	{wHwôèﬁnÚL '¿vÚL°'»~ÚG»îõC˘◊©PÙˇ  ˇˇÏ]yw€Fíˇ?EáìÒPoDäá$Kä?G∂Ôÿâ◊RØ◊/Üà¶à	p P≠ßÔæU›çª/Pî≠(‰ÃºëI†—ËÆ„WGW±ãõ¬QvSH*ÓPCrFcÑ)çÈ&•¿√_ ˙∞|Ñ%ïÇ:N°áÈ3JglÈ<NÊÆøü∞?ÍSÀ9˛gÓ∞ŒJ§µ˝/Ú√≥∑ñ∑yÒiDó	˛$ö[ïË¬ª~§ódÏ¯±Ânx`áËW^–Ñçm≠`‘rä:Ëôxé5Ò2/IX{…fU´?∂õO£›Â‚ú∞' 9⁄/S8?ﬂã≤´éK.n‚ûœ∞ˇç<ê-∏T π‰¢å≥æ>√p˚]€]ñ`∏^˛{,∆◊%˝ÈœƒrÛ,r¶ ı◊–çk¸bºiç_Ãw¨ÒKà4¿âÿC:Û‚–•w£fÁ†-A|T?}Ç”"∂b?e‡BØú)∞3”íã≠∏OõåïL`Ó÷µæÖ»üMg˝ﬂŸh$,~√¸ÿÔ~˙a·F%ˇHÄ–Ñç”·æÂπM€·«íı>;÷˙`Œ‘gZL£rÓF∏Ù6˘˘2∞®3∏“LEñæ˜zÓ'^'=6…ú®ØÅs˝X‰/⁄ï\ZiŒbÉ∫≈“úYY4¥ê8õ÷H™á4uﬁ1Ç_(â»›÷ïÚIÍÃ:ÌôB,◊íÔœ±#ß‰ \C∏¿∫|±·gÎàÅ>aèü6÷g2≤sﬂÃ£¸úaCB˜≤uTVÎ`#6
úèNPÓ]µDuéºÛIÁ\ÕöcÛecÃkå4Ÿ≈”õñú≥/6«c.h¨ÉÎ`≈=≥ë◊¡äÏ≥6ˆ◊∆æÊéµ±øV¨Éöœ√Vÿ æµ}\≥ê›ÜÊ±e˛&ïäèC¥B*‡53êõX∆_∫q°Bè<yw(±k•HçylÚπ-ãKi¥QVR{Wz‰œ¢Ÿ7≥œD{f…¨ÍXª·|f6•^Ú]aá®œ£2Ë‡ÿW ´≥g^Ò2“#∞H√i'1ùnQ=HöF?-¿
∫}{›∫n›ÿ¶g^∑˛œ¶C uãÿîÊîO-5ä≠≤˙[û€2„iÒzvCÂ≥ZPÏëa?Ø∫çj;K„uõ˜oòe}?7¢hÏ?Ë-XÃæ¿ˇ∆üx›RÀˆÛ¨].wﬂﬂÅÃΩ≈¢5e´‘∫ˇ",µ¢˜ñ˜}û!B˝˚§ús˙˝ ¶uYö˚QøÄ0Døm∫,˜bªö≠[ÊÔºüöºh˛>dM^Ú‘¸≈’R>1ãïc¶ÃÁXÆ|?[Ëÿi|n»¸l´cÛ€ŒQ6¨Zjt‹jh®‡~ô¥u≠π™i≠p)¥UD”KÏŒjÆ¿–˛È/<Æ?õGr∑éÏ≥‘X,ëí˝∞É˙ÀeÆﬂqÍyö1 v†I @!k›6øŒZ7}$YÎ'#ØÛ¬[«±ç7≠„ÿÊ;ÓY˚u\¬"ÿç„◊¢®äÂºn9FOY‚Ã“π„˘`<\‰É?¯L&Qf¸‹˚ÙÔΩŒ” ÀQÈ<‚¸óà&g0ŸêøhDYXÎòr˛˘,xfê˝π£ #ÈœÂm∫	_(¢	∆·ΩÚ·7]∂u@s–ºO\ˇe"ÜMπ&µÄ˛‚\s˜:¸v”k*ôÌ˘yˆ4X{.Ê÷ø¬ﬁËs≠‹|ñ|>˚6∑¡góJ´éS≠P,≠c{_4∂∑‘œöï?)~ê~}∏ï7/ˇ∂Aà3BÉ˙‘9c»[I˙qã<©’˚’u&«jæ‚Œ⁄oÖÂ·Ã±C@ΩMèÙbˆ∫˚{2K°AyvW?ª´/ªÖ^yI√ß»G4zü:WùÀŒ„+¯KòˇY'õÍ´’WˇZ¨%,ƒKW≤ÑlQ[’ôo}0≤ÇåiÚ¥0Ö6:÷î5Éµ!`VÃ’∂ﬂV¡ëU¨ P>˘_+»O	,∫™—∑íYûFQx˘äéìÚÓmìIgª•Ó	˛Û¬ÖW&&Øi0W0úŒVﬁ`∆/Ò(r–y◊¬ ˝á¨”‹waÚ4œ¬^3íoÄl¨˘œœ«:_5*¢±˜©8–[ˆãäi∆RàîMàyOEÃ⁄OS˜Ä˝˚´ÕG045“7Í>újZ=ëÚ¢Àr∆–gXærÄJ ‰˘»Û1˘Ãü3ßÜXÒÛ∆wíqM9≈j4Àd†y€z©Ô¨A Ñ”ƒPÛˇµ8Á“Ö(ì±vzÉl§	:Å‚ñ'p|2O<ÿû∆Í&ö:ﬁzMY°üÃúJo˜‡≤≥ßCèá'‘âFì‚ ŒY˙sÿlÑJgÿ›11ÎÙ∑§√DV¡ÜµÖ3ï∫}<ÙÇŸ<—,.˙Ò¯ŒË ˚ìNBﬂ•—QKº”∑†· ±]„•¸Æˇô”h°CW†Q&h™ÅJ°©N9-ﬂﬁ¶›ƒâŒi“e√kã“◊5l£*4ìNø/ﬂ¡p@î.<k€6ö«i38¡P$ú'æ–NÄeÊÂ5hL-ï[πH#ƒJ
öJ¬¯ÁµñnÍ
1ö÷∫Ä)À2 tôŒ2O√œøxèíq•ßΩÕ•0∫7ı4û
Y¬${,%®õàèyΩÑ:±Á/∫‰ªπÁ'/ ¸iBaRN˝⁄Gz#|÷!êb-PK¥8˛ó‰m.êµ„MAb¿Ïﬂqwƒ¿ûÒÑ≈ægì0	;˝›·˛p0ÿ>ˆ:„«˝ûª∑Ω;Ï˜ú'¯
G(◊ù‰Äü£QŒ˝ÁhØ˜ËÚh∑◊{49¬ô®ß°	˙ö˜7≈6˚õ"ÏíÁÆ∑ƒ˛z ø˝–ólbö’à´ä±wïk÷¶ñÌ}‹%O›'±ñ†∂€˚¬ÛÈ«a†‹ﬁ¥∑«jwxˆx–ﬂﬁºΩ˜∏C{{„≥˛˛„˛p¸EwX¿>õ˝ÂÄ–"O™º≥\;fuΩ)∞pL¸êÔ5Í 8ÏL^8qBféã·UÚ≈3ËB‰tJL.Ωd_¯'Í_dj?åÌ6˝uVeFZ(˜›\Ô<\ı∂o˜vwvz√«;É˝éKG˚{˝ùÒ≠Ä±ø|ËéA“®ù†6N∫lˇ∫I¯*º§—1»µˆF◊F˛ˆ©]QÙÂÀ6XÀ±na?ófCÙñÉãùÅò¶”,<o%„t=m£tÉô+F∞",wÄ∞æ∂˝~_ﬁ‘∂_ŒS®Ê!åÊQFùYË1£@òƒe8¬⁄ïm‡x‚∏òX‡ã;ƒøŸ˚p«†GJ&ëß4ÈŒàµó"dUBE√úÒ3{lFßWj«ƒ÷∑ìπ	¯˜É⁄b|Tg∞Å?OœIçR2AŒº!éüà/7‹H`ÊDºÔŸøÈ(Åµƒ "≈â1œÃ`ß8-ˆ'3∫“⁄_Üöfu–êí€Ù¿ˇÍpÄ¥&ù}•®8KêISë.¢Œ‘ïX°©E,˛)ß`£]¨)àTΩøı∂ﬁœ˙
Õ@H3"ÔWﬁ∞–ì°}√§‚nópûƒ¯∂HM`RÛ®õ’Ò¥R	ìu…bÊ\:eN˛êÇ¸Ω16¥jDwHÊ≤ú%`*èu˘^≈uœ\∂P¬ï
¸]2Ö•µM/Í˜ ¨_º£ ¸ÊÃ-Ê∏ˇi”D!oÈ»◊˘ÅﬂúLœÇ°Ô“›ØÍ‚÷‘◊_¶ëüñ@ÿRé~qÎÉıÙ˜fWˇ·S\Óã»4të˝¯ø$‘•ﬂÙ“ﬂîèÖ·A0fÚ"¬≈öX›Ωnüá¡ÿ;öâà"lØC◊ÒkG≈üÚe}É`,™ÍåÆΩòçœád|ˆË3‘Vó5°≠9o=ÃñL¿'<Ó’˚`÷U¢/+◊v{um':öƒèëÙv6	“’é*ô◊@ÖÏÓûÍf==ö]Nì}ˇ∑ﬁ®ÁÙú*,mGÅÈ¨≥KJç_
Xâf“≤´}H;9\p¿&ù˜˚Ωã…Ù\MÑÍeïÚ⁄¨PüMú™¨∂∞⁄Üÿ	øWCT©ü±†òw%…◊ıÄñëàkP∂•l4åj˝÷$öï©Ï£,ı FJYg’¶»≥3Ct•<◊*ûΩbkèÙ∫Àπ¬◊å“w¥~|ﬂskQñÇıü∂1å›ôÕÅ∆4äﬂw–ÖîÍ®î9∏Tq“5*–¶ï¡ÖDË‚C0+k[Î!æ›+O∫ÛÙŸÎÍˆåê7Q8¶1:å@eù∞Ç®nûÁÄì…#Ú∆t≈Ãµß—äH∫ÿ™P¶öPGüPV5òÙ»ØNƒ+·‚ınmøÚ˜Ωno ˜LHõñÎ"í+ÓYk{÷[›?∏»üC†ﬂ4ëÀœo_iÅπÒàw5sË˙c°r·“^”@‘Y◊h%≠?ç&ÄU7+"√ VÌ€ä?én¸´óL⁄≠Ót8ﬂk1ûÈ¶Ãâ◊Í˛;É÷Ü©©ÚÇ∏£‹ªÊ9◊ÙÀ˚e∞'à–‚Ú¨– ¯Ökı√ﬂ|º—S–ı=_˙ÇÿxFê‘X¥Ñ`v◊â\ÃX Ç÷fÃô¨gì5{‚åÈKC[DöÎ´Î÷“ŒÆq÷æ=‡«Á¸m”˘œn∑+fcJ4.î≤/á∂ı7ﬁË∂∑YPú®¢’gπYeûf+‡⁄R8º1O!VÕCmùÉÃæ(aJØÕ8dÉÑqÈ?l…Wè/nóCì˝
2ˆ™ß˜¨AîÉπñxSÔàuA‚´)«,HyÈ¡æÃ¢jAFì9•ùRP3ô¿fúOÄ"¯Sf∆“¿Mè2ﬂ&˜≈o»I@}ÂÅRµ)f–ıj_±ñ'g~2J∑7ÉnˆF÷»÷†ÍÀt¬Wc/¬¯πœlRM‰åÙe$YyŒ¯Jw$√ÿ⁄µ7e´täTpã¸⁄ê”¥˛ g’êhº∆⁄∑√⁄√.Oı»ó;≥déGıW∏[ˆxªÏH»^¶Ó1F7º>è(ì6ËO‹KYhµÌÂµZYEçÿ˛gÏí3
?yÄ56…[bí.†ì	Ö{H4
HÅs”8
ß•H@WRÑ¿r1YÑsë¥É∞`!R@π*Ñc™+3≈îÎ<-	#jPä _˜„ nëÛø«¥π7ΩË•∂TZ&—ì¸Ê‹Ÿ]¯∂Î”‡<ôêoIOëΩüÕW•S1ˆ¶œ¶µÊár8QiyöU+~éÁQˆÜ35Õ§f[≤<b!n»Ÿ’€06Å9Cæ„.sGˆÅÎ3 <ƒÍÉL¯˙ÁrÈlpK^çÁÆ‡ø/D≤I<˜Í@î‚1d¥îﬁâ•Ø¿Ω•¸'ûa∆géÙç2Å¶,h° ¸vu.ÿåº©NNÁûMÅ`>eÖñlÒ±L6‰k|oÚO“‹j´ÛôE¸DtLÅö£7°ÔçG≠ Ï§_Ÿ`à˝‚«¢¬â:ék=à·’°ãÏvUç∆=C#˜à.ãñò$ñçõÎ%lâë\S’‰f⁄'€ÒN‹Ú:„ŸæùsPI;u0üÅ≤ä3?‡Lx>‘JÖØ±6¡¬¥7ˆç=‘K—ZÇFM`Sgí‡Íâªa5 ÊG§PÀykO›Î/9>çív´†¯EÈ&î¬íIø*Å F?Ç¿H ‡@–êO ‰öSé©¯ì°Sπ…Ó±k?«ÆåÔJUâXK∏∂1ƒœ¬óÈ£Í©v6°I˛—≥Ó[\lÚ˛?]^"¥f*)uÀ≥±ˆ!–"sñ"†I-äQeL‡RáAºk«∑∑éW©pá◊,«bÎqp’!Œ‘ïh
Z.C^j
x™^WzÚ—§L©nî∑Uñ¯p´ñAS˙m!oRd…LúÂM£<£œó|≥_MæπíÁÂ›>˘f…¨õ%ÛmlmXÚ∑∫]∆3ñbR»±Ÿ.Áÿ‘Sk∂Ûºj…LVìFÛ¶L6÷gΩ≥öO¢È‰Y4™Ãd°XÙc+îV“JË.•]√CÚ\xI2ÕÌ≤gX»›fœh4√1ì,ˇ¥ZG„ï$î∞Cèï<]S⁄RF&§BæƒJ9´Ji¢f+ñ˝–‚§vÒv∏©ÉÓÑNüò”/‘NÍ÷AÉ45∫¥ﬂ
{ß‰î…µ¶çÛÁ€ˇ√)Ÿ"'»§˝˜+7äÈ(1~8Óïù◊Çu‘2ÔA‰µÜ=„u"zR—f]∆‰…“3˘	≈ÅÒ#Ç65Å¡ò©L“¶Ó¨–/Øùd“Ö%±´v€≥´–ÀıªA	Å›∞≠<s¢òæíÍômgYbWñ◊|ë6‘ƒ.0∑JYáªˆ'…1¥Äñô.OÜWç-CWŒy);©›ÜÍSœZèìŸMdÊ{Œıln˙ôÿ∞º√ﬂí›2˚R¨æ£6W±çŸù°w(ÿ˙‹tF®Ç
Tß€=ïU¥^N∫
ıñ≥ÉA°…I‡ÊÔÀìºÈÁ?Ø⁄?MèDëﬂæ¨÷«√ZVäﬂ‚:Ö$»é˝ˆ ¥˛2M! ÆÙ›† ÎÅ◊(`çJK`' V¡˛˜Ÿ~	ñá˘:ÆqAÂÒ\ÓØÉﬁ=$\nçnw—H?ÿ∞ˇΩ«Ô÷∏`%∏‡›]‚cöM£‘ôÍ;Ñ¡âsAçÑñ:ñdŒ©î`®ZYèÚN3 ;”q}∆å*.©ªKõe#©€ëjRrﬂÕ‚ã•sÜ5Y^)vS»‘—H¯ã◊IÅ ˝ÎR:“G
1E‡Ã©2˙# `öˆúOÌ4?&≈÷r.	œQi‘4õµíÊ™G‡Àœ“”Ê¨Vâv˘∂RÚ˙c9ÈTL\L"__∑%ÉÛ#? Cû·›hﬁ⁄¿Sú-<îY-ä÷2Â∆∆…¬«‰∆≈™d‰”4*5xÑ4Ê⁄ÚëqG˚kÖ˚1ËÕF.q$WM¬M¢˘T√∆GìlªÙ‹d[ œ˝ª±/ÁÑ¢2≥Ω:[˝ü@zXS§Ã$•~ÎÏÎr‘¬W|ÛoÙ´;Å{^ô(•∂¸>õ≠gÍ d1ˇ÷qäØ-æaµ;ÉÑÃ≥!îc ÀÓ“XGwB¥˘Qimã<ZüÛáüW(›“Ñ/ÆÍ4ÛªEë
Ÿ∑ÕiÀÅÙ0|}∞u∂Y˛YgõÂ®.£õu∫Ÿ}I7SñB.dùUJ`´ÜZQ⁄Y9-V)’uâjR*UdriïY=W7ıπïPÆV“§∂	•ëK5ÊËÀw—‡â>ôx‘wè'Ü*Ì‰vràGû‚â«êó	—Ëù˚X_}“äF?∑ï`≤ä÷AN3ZÛ@y-≥jh^˝x3åó@¯“DWÅ·≠{ª◊'í%ÔÄzﬂ–°¯¸ñjòØàÂ%W	ßü—[£y{$øä◊ xÜ_ πúå"J’}äÚG#Í”(úRx‚7$˝@ÖﬁÏ,t"∑ss|Ch0ä3`n&pùo»˘"
„Q8Éﬂfﬁè‹tº†#˛‘ê§Ö¡†≤&"[µ•`c%®∂B©s’∫πU†îKbÌ4¢‚¯ÑNœ0†¿V∂KﬁÇ*¡–Çè—Ñ«ÊUê	‘<çxcº
†üK…à9øµd÷≈rVB’L`%~ﬂ §—)sj/k'ö€	;;a3z˚ΩÌﬁ∂U[ÇZı◊´ÍØ¶:ØÿLDîyÓƒ πFÄ/;S<›tw∆”*≈5∑0 EaÀÏ\+˙:+üí´úá´∫}KAø{d-Lœ4≠†÷%-÷k™ú˜kjî¿≥_∞Ba¶Ú¨⁄JÏ¢∆/ …Ëc	[¬Vﬁ7Ã›‡4
+t ñ]å∏ﬁêéæ›∞‰æ1 7çoÌŸ_1_ëØéé¨‹nO»«ˆs~#@6√†XËa„£f¥Mq,•Ãdsòy_Ùê®≤V·ç®c«±–˜œúËWÅ4ìâ¥TZIZ≈ µ·µ·gli’@àÅ&Íû·ƒG◊Ô[¨—IÎÉö¬‡ÑIf6á£k@
ÆO_≠
1›…IZÌèÖ_”˙-?¬∆u≤:7eç”•‰g’ GV“æ6R]ˇ=/º©\ı’ª
h –r‡g	‡#us†Àn	∂¯Áµ¬8eƒíVi=G8ıïÕxF˛!5a˛£6√≈Ñt»6Hˇ	≥K®ªV6nWY4}πJoÍ¬‚2Â≠lS+9®ü‡´klóÔ¢–qGÿ†Ì8¢ <ÖXPµ‘´ÚZ·’⁄¥«·tbÅq«ÿà´u"&õ<êóûP⁄F*!ß´À∞*ˇî(g`§äí∆Ï≈ˆ4@ùÍºïÇñ9≠Îjòô'YsQõ≤√uØí4«â⁄„ƒÕÀú.S^Q]?NtpÙ∫i(rL9rπh)£I?MıJ§÷UI^ÖŒk±´ıQrúiì¢Àö§π&æ^˚ƒÉ¨	qΩ‹2j≤¬ Õ≠G]˛–a»öÖâ≠nÙÚw·-jI’Ø6 #Ωd‡nM Å?—zJ”¬£ø«a,1£◊x39ÅõI˚dÊD`M„Á„1PΩz∑O1¢S/¿*†Õ'¯V‹∫∫…ƒãê¬S9a7.=ë√-.Mö{MÔ≥p}ã≈ˇ–v mFK[ßø®«$ly”SÁ,5•â›àé_∫FπÀ6l<¡¬¢ Âà◊ù‘âV6Û2‚]
uRíMÓ €
`y∑∂F’]‡
ê"éÃˇ¬W»<ö¯àÆ b•a=ÆeÍ‚÷∂¨/®%òµ)FD»»…V&Ó¶Käoœ:ﬁ¡p∫,T∞/€l†C˛o3mÿP≤‚ñ/›ò≠1/çW¯˛à˝Îk6uÆ¯Y{ø‰[˚µNaôâå-Z7˘Ö¨—•1≠N nxJ˘F¨ûÑóƒπp<πÂ+Ú=≈NŒéª`ú’GâPñPV*V˘˙lñ«®±_2P$vg‚çº+Ûhzó)éŸ˝‡ÿÆÒEDág>rNÂ¸ﬂ©πŒY˜6	–7Ñ˙ »PçDr"0=OÕú´Ûˇ®|tMu¬g”ßH£ä∑‘àÌI~ÜÁ£í]R nÓ`ç√õ»ù2Gà[Æ‡Åö{æKÍä≠ô7‚]61…oS”:~yÕ•¸Éœs@Í7`â‘âsØô"”{˜ò-Ü7_W`]ÔS˘≥Ux Ó’…|s@‚JÄw◊√˙Ω¸˘∫^U2ödË¿ö"MÕ]Óà&Ñ—vtiLÜ¢ãÀ1ﬂƒól~~˚ä¥bf
º©=l]`—⁄—™;Œ±‘$IfÒ¡÷÷Rƒ†¯∫âÉæV”∑⁄ÔEÌ∞œÍÀùîwÓ+æÇ∑¿n›R˚ôÂZø®˝ÕÀzñè∞¥˝FndÀEs∞m—ü¡d%íû˘!Îè“N¢9U"‰$Zh†8∑—8‘0]YL†qØπÿGÌˆ-eO€=€ƒåÃKƒ≠çDË˘î\'q¿ö]ïÿ–í,ê)X#˝&xbÍÀìüÑ„@„4∏QøÑsÈx	Ó”3X\…:`«ççMˆ¶˚∆(B±˚úµ€≥à^X:∆û|6Â¡ª∫¸ﬂÌv¿ÓpCø2{"öÃ£Äº«Ÿn‚“ß√~Pﬂ•3€§RA}y:⁄≠<^áiï•¯∞ú-ÒouE˚´8öê6Ï∑,t^Òƒ`€cÆ{àOk¥E˛	xH(zx$ç¢0“=pÏ¨ë˙InÊ•ŒïJø7'’Å<›KÂi·tIÌƒHı@{! *ƒnQó—T~|X¸ÖÉÓ˜zÂÃ¢™ÑÆ5∂ó¡Ï<Ò£<Ü€HKu¨:Õ£vyAÉï~É!/O\√Èﬂ˚·ô„/ﬁD·tñ‘ §_s…}“ıb,{_Nˆ0&zÏ4?èVÀ”àß%}/iØÚ˛oΩ1˛gπ‹Ã©+MÕ‘&>THuN•‘GÏ6∆ı»{ä‚€ûG¿\X"	;ÎÍÖØÀœÃ√W≥y4Û˘i˘tˆ	ªø,ñe$ ¡À3¶gò^⁄i·J¨–Z5›@í(I÷ë{nt>åOø@3©ˆã0JSeﬂ’çÖô
z\â;˚äco¶ﬁ˙≤©)ÉÚ≤	¸ã.ûÖóA:©¨E◊6Ì˛A‹ù˙úÂ¥´@ÈΩEmã˙Z(Ñ¥≈€rˆ> L÷+Ùd˝EıâGç-Ë¥}.hÖ!Iœπï‰¡Äf‹“ÿØT≤è0¸Ø2ç´\VóŒ“#ÇºÅI—dëû]VÔ≤•≤·V∑“Ç`eÕJ fé¥]Iv £‚Ëêt1—Z5ıïZ3*›i∑òR∆∫[≠Ñ©Ù§ﬁãLUdKù≥É¢∏
◊5DƒÓê®Ò.a;ú®˜ñoSçÅ*_î˛)∞Lˆ¨‹Õ˝?   ˇˇ ©ËzC