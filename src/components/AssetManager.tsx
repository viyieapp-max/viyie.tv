import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Folder, 
  File, 
  Plus, 
  Search, 
  Trash2, 
  HardDrive, 
  Database, 
  Upload, 
  FolderPlus, 
  ChevronRight, 
  Copy, 
  Check, 
  RefreshCw 
} from "lucide-react";
import { 
  collection,
  setDoc,
  doc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  db,
  getDocs,
  handleFirestoreError,
  OperationType
} from "../lib/firebase";
import { get, set, del, keys } from 'idb-keyval';


// Helper for human-readable file sizes
function formatBytes(bytes: number, decimals = 2) {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export interface AssetFile {
  id: string;
  name: string;
  type: string; // 'folder' | 'image' | 'video' | 'subtitle' | 'other'
  size: number;
  createdAt: number;
  url: string; // Base64 or external url
  path: string; // e.g. '/' or '/posters'
  isLocalHost?: boolean;
}

const PUBLIC_ASSETS: AssetFile[] = [
  { id: "pub_1", name: "v_logo.png", type: "image", size: 145000, createdAt: Date.now(), url: "/viyie.png", path: "/", isLocalHost: true },
  { id: "pub_2", name: "v_chine.png", type: "image", size: 95000, createdAt: Date.now(), url: "/viyiechine.png", path: "/", isLocalHost: true },
  { id: "pub_3", name: "poster_fallback.jpg", type: "image", size: 210000, createdAt: Date.now(), url: "/placeholder-episode.jpg", path: "/", isLocalHost: true },
  { id: "pub_4", name: "sponsor_k1.mp3", type: "other", size: 3400000, createdAt: Date.now(), url: "/k1.mp3", path: "/", isLocalHost: true },
  { id: "pub_5", name: "sponsor_k2.mp3", type: "other", size: 4100000, createdAt: Date.now(), url: "/k2.mp3", path: "/", isLocalHost: true },
  { id: "pub_6", name: "banner_ad.html", type: "other", size: 5000, createdAt: Date.now(), url: "/banner-ad.html", path: "/", isLocalHost: true }
];

interface AssetManagerProps {

  onSelectAsset?: (url: string) => void; 
  mode?: "manager" | "picker";
  allowedTypes?: string[]; // e.g. ['image']
}

let cachedFirestoreSize: number | null = null;

export default function AssetManager({ onSelectAsset, mode = "manager", allowedTypes }: AssetManagerProps) {
  const isPickerMode = mode === "picker" || !!onSelectAsset;
  const [assets, setAssets] = useState<AssetFile[]>([]);
  const [localStoreAssets, setLocalStoreAssets] = useState<AssetFile[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("/");

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortField, setSortField] = useState<"name" | "createdAt" | "size">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterType, setFilterType] = useState<string>("all");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDest, setUploadDest] = useState<"firebase" | "localhost">("localhost");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<AssetFile | null>(null);
  const [publicAssetIds, setPublicAssetIds] = useState<string[]>(PUBLIC_ASSETS.map(a => a.id));

  // Storage Stats State
  const [localUsage, setLocalUsage] = useState<{ used: number; total: number }>({ used: 0, total: 5 * 1024 * 1024 });
  const [firebaseUsage, setFirebaseUsage] = useState<{ used: number; total: number }>({ used: 0, total: 20 * 1024 * 1024 });
  const [firestoreCollectionsSize, setFirestoreCollectionsSize] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const allAssets = useMemo(() => {
    const combined = [...assets, ...PUBLIC_ASSETS.filter(a => publicAssetIds.includes(a.id)), ...localStoreAssets];
    
    // Deduplicate by URL or Name so public assets don't show twice if they are discovered via API and PUBLIC_ASSETS
    const seenUrls = new Set<string>();
    return combined.filter(a => {
      if (seenUrls.has(a.url)) return false;
      seenUrls.add(a.url);
      return true;
    });
  }, [assets, localStoreAssets, publicAssetIds]);

// Sync with Firestore

  useEffect(() => {
    async function measureFirestore() {
      if (cachedFirestoreSize !== null) {
        setFirestoreCollectionsSize(cachedFirestoreSize);
        return;
      }
      
      const sessionCache = sessionStorage.getItem("firestoreSize");
      if (sessionCache) {
        cachedFirestoreSize = parseInt(sessionCache, 10);
        setFirestoreCollectionsSize(cachedFirestoreSize);
        return;
      }

      try {
        let size = 0;
        const cols = ["content", "users", "comments", "hero_slots", "bottom_hero_slots", "settings", "reports", "notifications", "studios", "quick_links"];
        for (const c of cols) {
          const snap = await getDocs(collection(db, c));
          snap.forEach(doc => {
            size += JSON.stringify(doc.data()).length;
            size += doc.id.length; // Approximate ID overhead
            size += 256; // Overhead per document in Firestore
          });
        }
        cachedFirestoreSize = size;
        sessionStorage.setItem("firestoreSize", size.toString());
        setFirestoreCollectionsSize(size);
      } catch(e) {
        console.warn("Could not calculate exact firestore size", e);
      }
    }
    measureFirestore();
  }, []);

  useEffect(() => {
    const qAssets = query(collection(db, "assets"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(qAssets, (snapshot) => {
      const items: AssetFile[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as AssetFile);
      });
      setAssets(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "assets");
    });

    return () => unsubscribe();
  }, []);

  const [isSyncing, setIsSyncing] = useState(false);

  // Load IndexedDB Local Storage and Public files
  const loadLocal = async () => {
    setIsSyncing(true);
    try {
      const allKeys = await keys();
      const items: AssetFile[] = [];
      for (const k of allKeys) {
        if (typeof k === "string" && k.startsWith("asset_")) {
          const val = await get(k);
          if (val) items.push(val as AssetFile);
        }
      }
      
      // Also fetch assets from public API
      try {
        const res = await fetch("/api/public-assets");
        if (res.ok) {
          const pubAssets = await res.json();
          items.push(...pubAssets);
        }
      } catch (apiErr) {
        console.warn("Could not fetch public assets", apiErr);
      }

      setLocalStoreAssets(items);
    } catch (e) {
      console.warn("Could not load local storage", e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadLocal();
  }, []);

  // Update Dynamic Storage Usage
  useEffect(() => {
    // 1. Calculate Local (Navigator storage or mock estimation)
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((est) => {
        // Also add the actual size of stored IndexedDB items
        const idbSize = localStoreAssets.reduce((acc, curr) => acc + (curr.size || 0), 0);
        setLocalUsage({
          used: (est.usage || 0) + idbSize,
          total: est.quota || 500 * 1024 * 1024 // standard fallback quota
        });
      });
    } else {
      // Estimate active dynamic local data size
      const idbSize = localStoreAssets.reduce((acc, curr) => acc + (curr.size || 0), 0);
      let totalSizeStr = JSON.stringify(localStorage);
      setLocalUsage({
        used: (totalSizeStr.length * 2) + idbSize, // approximation in bytes
        total: 250 * 1024 * 1024 
      });
    }

    // 2. Firebase Size - Sum of all asset payload sizes + other collections
    const dbSizeSum = assets.reduce((acc, curr) => acc + (curr.size || 0), 0);
    setFirebaseUsage({
      used: dbSizeSum + firestoreCollectionsSize,
      total: 5 * 1024 * 1024 * 1024 // 5 GB
    });
  }, [assets, localStoreAssets, firestoreCollectionsSize]);

  // Handle Directory Creation
  const handleCreateFolder = () => {
    const folderName = prompt("Enter folder name:");
    if (!folderName) return;

    const trimmed = folderName.trim();
    if (!trimmed) return;

    const exists = allAssets.some(
      (a) => a.type === "folder" && a.path === currentPath && a.name.toLowerCase() === trimmed.toLowerCase()
    );

    if (exists) {
      alert("A folder with this name already exists in this folder.");
      return;
    }

    const folderId = "folder_" + Date.now();
    const folderAsset: AssetFile = {
      id: folderId,
      name: trimmed,
      type: "folder",
      size: 0,
      createdAt: Date.now(),
      url: "",
      path: currentPath,
    };

    setDoc(doc(db, "assets", folderId), folderAsset)
      .then(() => {
        // success
      })
      .catch((e) => {
        handleFirestoreError(e, OperationType.WRITE, `assets/${folderId}`);
      });
  };

  // Resize and compress files to ultra low resolution as requested
  const processAndCompressImage = (file: File): Promise<{ url: string; size: number }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const maxDim = 400; // compress to low-resolution max 400px
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Failed to get 2D context"));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          // Compress to WebP / JPEG for super light payload
          const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
          
          // Approximate base64 size in bytes
          const approxLength = Math.round((dataUrl.length - 22) * 3 / 4);
          resolve({
            url: dataUrl,
            size: approxLength
          });
        };
        img.onerror = () => reject(new Error("Failed to load image element"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  // Upload actions
  const uploadFiles = async (files: FileList) => {
    setIsUploading(true);
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const isImg = f.type.startsWith("image/");
      
      const assetId = "asset_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
      try {
        let finalUrl = "";
        let finalSize = f.size;

        if (isImg && uploadDest !== "localhost") {
          const compressed = await processAndCompressImage(f);
          finalUrl = compressed.url;
          finalSize = compressed.size;
        } else {
          // Fallback to standard reader for other assets or localhost high-res uploads
          const base64Data = await new Promise<string>((resolve, reject) => {
            const rd = new FileReader();
            rd.onload = (ev) => resolve(ev.target?.result as string);
            rd.onerror = reject;
            rd.readAsDataURL(f);
          });
          finalUrl = base64Data;
        }

        const newAsset: AssetFile = {
          id: assetId,
          name: f.name,
          type: isImg ? "image" : f.type.includes("video") ? "video" : f.type.includes("subtitle") || f.name.endsWith(".srt") || f.name.endsWith(".vtt") ? "subtitle" : "other",
          size: finalSize,
          createdAt: Date.now(),
          url: finalUrl,
          path: currentPath,
          isLocalHost: uploadDest === "localhost" || finalSize > 800000 // force local if requested or object is big
        };

        if (newAsset.isLocalHost) {
          try {
            const upRes = await fetch("/api/public-assets/upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: f.name, data: finalUrl })
            });
            const upData = await upRes.json();
            if (upData.success) {
               newAsset.id = "pub_" + newAsset.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
               newAsset.url = upData.url;
               // No need to set to indexedDB if it's on server public
            } else {
               await set(assetId, newAsset);
            }
          } catch (e) {
            await set(assetId, newAsset);
          }
          setLocalStoreAssets(prev => {
             const exist = prev.findIndex(a => a.id === newAsset.id);
             if (exist !== -1) {
                const copy = [...prev];
                copy[exist] = newAsset;
                return copy;
             }
             return [...prev, newAsset];
          });
          successCount++;
        } else {
          await setDoc(doc(db, "assets", assetId), newAsset);
          successCount++;
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `assets/${assetId}`);
      }
    }

    setIsUploading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteAsset = async (asset: AssetFile) => {
    
    // Quick inline confirm implemented via state on the button
    try {
      if (asset.id.startsWith("pub_")) {
        try {
          await fetch(`/api/public-assets/${encodeURIComponent(asset.name)}`, { method: "DELETE" });
        } catch(e) { console.warn("Failed to delete public asset", e) }
        setPublicAssetIds(prev => prev.filter(id => id !== asset.id));
        setLocalStoreAssets(prev => prev.filter(a => a.id !== asset.id));
      } else if (asset.isLocalHost) {
        await del(asset.id);
        setLocalStoreAssets(prev => prev.filter(a => a.id !== asset.id));
      } else {
        await deleteDoc(doc(db, "assets", asset.id));
      }
      
      // If the asset deleted was a folder, recursively delete contents under its structure
      if (asset.type === "folder") {
        const folderRelPath = currentPath === "/" ? `/${asset.name}` : `${currentPath}/${asset.name}`;
        const children = allAssets.filter((a) => a.path.startsWith(folderRelPath));
        for (const item of children) {
          if (item.id.startsWith("pub_")) {
            try {
              await fetch(`/api/public-assets/${encodeURIComponent(item.name)}`, { method: "DELETE" });
            } catch(e) { console.warn(e) }
            setPublicAssetIds(prev => prev.filter(id => id !== item.id));
            setLocalStoreAssets(prev => prev.filter(a => a.id !== item.id));
          } else if (item.isLocalHost) {
            await del(item.id);
            setLocalStoreAssets(prev => prev.filter(a => a.id !== item.id));
          } else {
            await deleteDoc(doc(db, "assets", item.id));
          }
        }
      }
      if (selectedPreview?.id === asset.id) {
        setSelectedPreview(null);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `assets/${asset.id}`);
    }
  };

  // Drag and Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  // Navigation Folders
  const enterFolder = (folderName: string) => {
    const nextPath = currentPath === "/" ? `/${folderName}` : `${currentPath}/${folderName}`;
    setCurrentPath(nextPath);
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index === 0) {
      setCurrentPath("/");
      return;
    }
    const parts = currentPath.split("/").filter(Boolean);
    const targetParts = parts.slice(0, index);
    setCurrentPath("/" + targetParts.join("/"));
  };

  // Action helpers
  const handleCopyLink = (asset: AssetFile) => {
    if (asset.url) {
      navigator.clipboard.writeText(asset.url);
      setCopiedId(asset.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Computed and filtered assets
  const filteredList = useMemo(() => {
    return allAssets.filter((asset) => {
      // 1. Must be in current directory path
      if (asset.path !== currentPath) return false;

      // 2. Allowed types filtering (for Pickers)
      if (allowedTypes && allowedTypes.length > 0 && asset.type !== "folder") {
        if (!allowedTypes.includes(asset.type)) return false;
      }

      // 3. Search query
      if (searchQuery) {
        return asset.name.toLowerCase().includes(searchQuery.toLowerCase());
      }

      // 4. Filter buttons
      if (filterType !== "all" && asset.type !== "folder") {
        return asset.type === filterType;
      }

      return true;
    });
  }, [allAssets, currentPath, searchQuery, filterType, allowedTypes]);

  // Sorted items (Folders always first)
  const sortedList = useMemo(() => {
    const folders = filteredList.filter((a) => a.type === "folder");
    const files = filteredList.filter((a) => a.type !== "folder");

    const sortFn = (a: any, b: any) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    };

    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort(sortFn);

    return [...folders, ...files];
  }, [filteredList, sortField, sortOrder]);

  const breadcrumbs = useMemo(() => {
    return ["Root", ...currentPath.split("/").filter(Boolean)];
  }, [currentPath]);

  // Percents for stats bar charts
  const localPercent = Math.min(100, (localUsage.used / localUsage.total) * 100);
  const firebasePercent = Math.min(100, (firebaseUsage.used / firebaseUsage.total) * 100);

  const formatPercent = (percent: number) => {
    if (percent === 0) return "0%";
    if (percent > 0 && percent < 0.01) return "<0.01%";
    return percent.toFixed(2) + "%";
  };

  return (
    <div className="bg-[#0b0606] border border-white/5 rounded-2xl overflow-hidden shadow-2xl flex flex-col min-h-[600px] w-full text-white/90">
      
      {/* Header section with Stats Monitor */}
      <div className="p-6 border-b border-white/5 bg-gradient-to-r from-red-950/20 to-black/30 flex flex-col gap-6 md:flex-row md:items-center md:justify-between shrink-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
            <h3 className="text-base font-medium uppercase tracking-wider text-white">
              Dynamic Asset Control Engine
            </h3>
          </div>
          <p className="text-[11px] text-white/40 leading-relaxed max-w-lg">
            Monitor and sync local storage or secure media assets automatically across global clusters. Image resources are optimized into low resolution instantly.
          </p>
        </div>

        {/* Space Indicators */}
        <div className="flex flex-col sm:flex-row gap-4 shrink-0">
          {/* Localhost */}
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 w-full sm:w-52 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-white/50 uppercase font-medium">
              <span className="flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5 text-zinc-400" /> LOCALHOST</span>
              <span>{formatPercent(localPercent)}</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-zinc-400 rounded-full transition-all duration-500" 
                style={{ width: `${localPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-white/30 font-semibold font-mono">
              <span>{formatBytes(localUsage.used)}</span>
              <span>/ {formatBytes(localUsage.total)}</span>
            </div>
          </div>

          {/* Firebase */}
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 w-full sm:w-52 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-white/50 uppercase font-all tracking-wider font-black">
              <span className="flex items-center gap-1.5 text-red-400"><Database className="w-3.5 h-3.5 text-red-500" /> FIRESTORE</span>
              <span className="text-red-400">{formatPercent(firebasePercent)}</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-red-600 to-red-500 rounded-full transition-all duration-500" 
                style={{ width: `${firebasePercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-white/30 font-semibold font-mono">
              <span>{formatBytes(firebaseUsage.used)}</span>
              <span>/ {formatBytes(firebaseUsage.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Control and actions bar */}
      <div className="p-4 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950/40 shrink-0">
        
        {/* Breadcrumb Navigation */}
        <div className="flex items-center flex-wrap gap-1 text-sm bg-white/5 rounded-xl px-3.5 py-2 border border-white/5 font-semibold">
          {breadcrumbs.map((bc, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-white/20" />}
              <button
                onClick={() => navigateToBreadcrumb(idx)}
                className={`text-xs capitalize tracking-wide transition-all outline-none ${
                  idx === breadcrumbs.length - 1
                    ? "text-red-400 font-extrabold cursor-default"
                    : "text-white/50 hover:text-white"
                }`}
              >
                {bc}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Quick Search & Sort Filter Control */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Filter Types Selection */}
          <div className="flex bg-white/5 border border-white/5 rounded-xl p-0.5">
            {["all", "image", "video", "subtitle"].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest font-black transition-all ${
                  filterType === type
                    ? "bg-red-600 text-white shadow-lg shadow-red-900/40"
                    : "text-white/40 hover:text-white/80"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Sorting controls */}
          <div className="flex bg-white/5 border border-white/5 rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => {
                if (sortField === "createdAt") {
                  setSortField("name");
                } else if (sortField === "name") {
                  setSortField("size");
                } else {
                  setSortField("createdAt");
                }
              }}
              className="px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest font-black text-white/60 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
              title="Toggle sorting category"
            >
              <span>By: {sortField}</span>
            </button>
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="px-2.5 py-1.5 rounded-lg text-[10px] uppercase font-black text-white/40 hover:text-white transition-all border-l border-white/5 cursor-pointer"
              title="Toggle order"
            >
              {sortOrder === "asc" ? "▲ ASC" : "▼ DESC"}
            </button>
          </div>

          {/* Search Bar Input */}
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              type="text"
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 text-xs font-semibold outline-none focus:border-red-500/50 transition-all text-white"
            />
          </div>

          {/* Scan & Refresh Button */}
          <button
            type="button"
            onClick={() => loadLocal()}
            disabled={isSyncing}
            className="h-9 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white font-medium text-xs flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Scan public folder and load newest files"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-red-500 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Scanning..." : "Scan & Refresh"}</span>
          </button>

          {/* Trigger manual input upload */}
          <button
            onClick={() => handleCreateFolder()}
            className="h-9 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white font-medium text-xs flex items-center gap-2 transition-all group active:scale-95"
            title="Create new folder"
          >
            <FolderPlus className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Add Folder</span>
          </button>

          {/* Upload Destination */}
          <select
             className="h-9 px-3 rounded-xl bg-black/60 border border-white/10 text-white shadow focus:outline-none focus:border-red-500 transition-all font-mono text-[10px] uppercase font-medium"
             value={uploadDest}
             onChange={(e) => setUploadDest(e.target.value as any)}
          >
             <option value="localhost">Localhost</option>
          </select>

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="h-9 px-4 rounded-xl bg-red-600/90 hover:bg-red-600 text-white font-medium text-xs flex items-center gap-2 shadow-lg shadow-red-900/30 transition-all group active:scale-95 disabled:opacity-50"
            title="Upload Files"
          >
            {isUploading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 group-hover:translate-y-[-2px] transition-transform" />
            )}
            <span>{isUploading ? "Uploading..." : "Upload File"}</span>
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            accept={allowedTypes ? allowedTypes.map(t => `${t}/*`).join(",") : undefined}
            className="hidden"
          />
        </div>
      </div>

      {/* Main interactive grid section */}
      <div 
        className={`flex-1 p-6 relative overflow-y-auto max-h-[500px] font-sans transition-all duration-300 ${
          dragActive ? "bg-red-900/10 border-4 border-dashed border-red-600/50 m-4 rounded-xl" : "bg-transparent"
        }`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        style={{ scrollbarWidth: "thin" }}
      >
        {isUploading && (
          <div className="absolute inset-0 bg-[#000]/70 backdrop-blur-sm flex items-center justify-center z-50 rounded-xl">
            <div className="text-center space-y-4">
              <RefreshCw className="w-10 h-10 animate-spin text-red-500 mx-auto" />
              <p className="text-sm font-black tracking-widest text-white uppercase animate-pulse">Syncing dynamic asset components...</p>
            </div>
          </div>
        )}

        {dragActive && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-3 bg-[#0d0606]/85 z-20">
            <div className="w-16 h-16 rounded-full bg-red-600/10 flex items-center justify-center border border-red-500/30 animate-bounce">
              <Upload className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-sm font-black uppercase text-red-500 tracking-widest">
              Drop files/media items to upload instantly!
            </p>
          </div>
        )}

        {sortedList.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center gap-4 border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
            <Folder className="w-12 h-12 text-white/10" />
            <div className="space-y-1">
              <h5 className="text-sm font-medium text-white/50">This folder is empty</h5>
              <p className="text-xs text-white/20">Drag and drop file elements or create folder compartments upstream</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {sortedList.map((asset) => {
              const isFolder = asset.type === "folder";
              const isImage = asset.type === "image";

              return (
                <div
                  key={asset.id}
                  onClick={() => {
                    if (isFolder) {
                      enterFolder(asset.name);
                    } else if (onSelectAsset) {
                      onSelectAsset(asset.url);
                    } else {
                      setSelectedPreview(asset);
                    }
                  }}
                  className={`group relative rounded-2xl border bg-white/[0.02] overflow-hidden cursor-pointer transition-all duration-300 select-none flex flex-col h-44
                    ${isFolder 
                      ? "border-white/5 hover:border-amber-500/20 hover:bg-amber-500/[0.02]" 
                      : "border-white/5 hover:border-red-600/40 hover:bg-red-600/[0.02]"
                    }
                  `}
                >
                  {/* Hover visual red overlay state requested by user */}
                  {/* 'saat ada hover file masuk ui jadi merah ada icon + dan keterangan dan outline' */}
                  {!isFolder && (
                    <div className="absolute inset-0 bg-[#ea1919] opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 flex flex-col items-center justify-center gap-2 p-3 text-center border-2 border-[#ff3737]">
                      <div className="w-10 h-10 rounded-full bg-white/25 flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-300">
                        <Plus className="w-6 h-6 text-white stroke-[3px]" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] font-black uppercase text-white truncate w-full max-w-[130px]" title={asset.name}>
                          {asset.name}
                        </p>
                        <p className="text-[9px] font-medium text-white/80 font-mono tracking-wider">
                          {formatBytes(asset.size)}
                        </p>
                        <p className="text-[8px] uppercase tracking-widest font-black bg-white/10 px-1.5 py-0.5 rounded text-white/90">
                          {isPickerMode ? "Insert Component" : "Inspect Media"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Thumbnail / Media Icon representer */}
                  <div className="flex-1 flex items-center justify-center relative bg-black/40 overflow-hidden shrink-0">
                    {isFolder ? (
                      <div className="relative flex flex-col items-center">
                        <Folder className="w-14 h-14 text-amber-500/80 fill-amber-500/15 group-hover:scale-110 transition-transform" />
                        <span className="absolute bottom-2 text-[10px] font-mono text-amber-500/40 font-medium">
                          DIR
                        </span>
                      </div>
                    ) : isImage ? (
                      <img
                        src={asset.url}
                        alt={asset.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 scale-95 opacity-80 group-hover:opacity-100"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <File className="w-11 h-11 text-zinc-500" />
                        <span className="text-[9px] uppercase tracking-widest font-black leading-none bg-white/5 border border-white/10 px-1 py-0.5 rounded text-white/50">
                          {asset.type}
                        </span>
                      </div>
                    )}

                    {/* Quick remove trigger floating overlay */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (deleteConfirmId === asset.id) {
                           handleDeleteAsset(asset);
                           setDeleteConfirmId(null);
                        } else {
                           setDeleteConfirmId(asset.id);
                           setTimeout(() => setDeleteConfirmId(null), 3000); // Reset after 3 seconds
                        }
                      }}
                      className={`absolute top-2.5 right-2.5 w-7 h-7 bg-black/75 hover:bg-red-600 border border-white/10 hover:border-red-500 rounded-lg flex items-center justify-center transition-all z-20 hover:scale-110 active:scale-90 ${deleteConfirmId === asset.id ? 'opacity-100 bg-red-600 border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'opacity-0 group-hover:opacity-100'}`}
                      title={deleteConfirmId === asset.id ? "Click again to confirm delete" : "Delete permanent"}
                    >
                      {deleteConfirmId === asset.id ? (
                         <span className="text-[10px] font-black text-white px-1">?</span>
                      ) : (
                         <Trash2 className="w-3.5 h-3.5 text-white" />
                      )}
                    </button>
                  </div>

                  {/* Info bottom segment bar */}
                  <div className="p-3 bg-zinc-950/70 flex flex-col justify-between shrink-0 h-16 border-t border-white/5">
                    <p className="text-xs font-extrabold text-white/80 group-hover:text-white truncate" title={asset.name}>
                      {asset.name}
                    </p>
                    <div className="flex items-center justify-between text-[9px] font-mono text-white/40 font-medium">
                      <span>{isFolder ? "Directory" : formatBytes(asset.size)}</span>
                      <span>{new Date(asset.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Side Inspect Preview Drawer for inspect file details */}
      {selectedPreview && (
        <div className="border-t border-white/5 p-6 bg-zinc-950/80 flex flex-col md:flex-row items-center gap-6 shrink-0 animation-fade">
          <div className="w-full md:w-44 aspect-video sm:aspect-square bg-black/60 rounded-xl overflow-hidden border border-white/10 flex items-center justify-center shrink-0">
            {selectedPreview.type === "image" ? (
              <img
                src={selectedPreview.url}
                alt={selectedPreview.name}
                referrerPolicy="no-referrer"
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <File className="w-14 h-14 text-zinc-500" />
            )}
          </div>

          <div className="flex-1 space-y-3 text-left w-full">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-black text-white">{selectedPreview.name}</h4>
              <button 
                onClick={() => setSelectedPreview(null)}
                className="px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-[9px] tracking-wider uppercase font-extrabold text-white/60"
              >
                Close Preview
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px] font-mono text-white/50 bg-white/[0.01] p-3 rounded-xl border border-white/5">
              <div>
                <span className="block text-white/30 uppercase text-[8px] font-black tracking-wider leading-relaxed">Format Type:</span>
                <span className="text-zinc-300 font-medium uppercase">{selectedPreview.type}</span>
              </div>
              <div>
                <span className="block text-white/30 uppercase text-[8px] font-black tracking-wider leading-relaxed">Media Size:</span>
                <span className="text-zinc-300 font-medium">{formatBytes(selectedPreview.size)}</span>
              </div>
              <div>
                <span className="block text-white/30 uppercase text-[8px] font-black tracking-wider leading-relaxed">Created At:</span>
                <span className="text-zinc-300 font-medium">{new Date(selectedPreview.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="block text-white/30 uppercase text-[8px] font-black tracking-wider leading-relaxed">Directory Path:</span>
                <span className="text-zinc-400 font-medium capitalize">{selectedPreview.path}</span>
              </div>
            </div>

            {/* Link copier drawer items */}
            {selectedPreview.url && (
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-2">
                <input
                  type="text"
                  readOnly
                  value={selectedPreview.url}
                  className="flex-1 bg-transparent text-[10px] font-mono text-red-400 outline-none truncate"
                />
                
                <button
                  onClick={() => handleCopyLink(selectedPreview)}
                  className="px-3.5 py-1.5 rounded-lg bg-red-600/90 hover:bg-red-600 text-white font-medium text-[10px] flex items-center gap-1.5 transition-all outline-none"
                >
                  {copiedId === selectedPreview.id ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy link</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
