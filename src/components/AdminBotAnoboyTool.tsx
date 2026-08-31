import React, { useState, useRef, useEffect } from "react";
import { 
  Play, 
  Search, 
  Save, 
  Globe, 
  Sparkles, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  CheckCircle2, 
  Copy 
} from "lucide-react";
import { useUserData } from "../hooks/useUserData";

interface EpisodeLog {
  title: string;
  url: string;
  status: "pending" | "fetching" | "success" | "error";
  servers: { name: string; url: string }[];
  number: number;
}

export default function AdminBotAnoboyTool() {
  const { toast } = useUserData();
  const botType = "anoboy";
  const [seriesUrl, setSeriesUrl] = useState("");
  const [metaData, setMetaData] = useState<{ title: string; synopsis: string; rating: string } | null>(null);
  const [scraperState, setScraperState] = useState<"idle" | "fetching_series" | "episodes_found" | "fetching_episodes" | "server_selection" | "done">("idle");
  const [episodeLogs, setEpisodeLogs] = useState<EpisodeLog[]>([]);
  const [availableServers, setAvailableServers] = useState<string[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>("all");
  const [finalResult, setFinalResult] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const listRef = useRef<HTMLDivElement>(null);

  // Monitor online status to handle failures gracefully
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast("Connection restored. Scraper is back online.", "success");
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast("Connection lost. Scraper paused.", "error");
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [toast]);

  // Handle interactive hover-scroll for premium feel
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!listRef.current) return;
    const rect = listRef.current.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const height = rect.height;
    
    const threshold = 60; 
    const speed = 20;
    
    if (mouseY < threshold) {
       listRef.current.scrollTop -= speed * (1 - mouseY / threshold);
    } else if (mouseY > height - threshold) {
       listRef.current.scrollTop += speed * ((mouseY - (height - threshold)) / threshold);
    }
  };

  const resetScraper = () => {
    setSeriesUrl("");
    setScraperState("idle");
    setEpisodeLogs([]);
    setAvailableServers([]);
    setSelectedServer("all");
    setFinalResult([]);
  };

  // Helper to extract a precise episode float/integer number from string
  const getEpisodeNum = (title: string, url: string): number => {
    // 1. Try matching explicit episode patterns from the URL first, as it is highly structured (e.g. -episode-1/)
    if (url) {
      const urlEpMatch = url.match(/(?:episode|eps|ep)[_-]+(\d+(\.\d+)?)/i);
      if (urlEpMatch) {
        return parseFloat(urlEpMatch[1]);
      }
      
      // Fallback: check if there's any other numeric indicator at the end of the URL before trailing slash
      const lastSegment = url.replace(/\/$/, "").split("/").pop() || "";
      const lastNumMatch = lastSegment.match(/[-_](\d+(\.\d+)?)$/);
      if (lastNumMatch) {
        return parseFloat(lastNumMatch[1]);
      }
    }

    // 2. Try matching from the Title
    if (title) {
      const cleanTitle = title.replace(/[-_]/g, " ");
      const epMatch = cleanTitle.match(/(?:episode|eps|ep)\s*(\d+(\.\d+)?)/i);
      if (epMatch) {
         return parseFloat(epMatch[1]);
      }
      // Pick the last number in the title to avoid matching years or seasons first
      const allNums = cleanTitle.match(/\d+(\.\d+)?/g);
      if (allNums && allNums.length > 0) {
        return parseFloat(allNums[allNums.length - 1]);
      }
    }

    return 1;
  };

  // 1. Scan/Fetch the main Anime Series page
  const handleFetchSeries = async () => {
    if (!seriesUrl) {
      toast("Please enter a valid series URL", "error");
      return;
    }
    setScraperState("fetching_series");
    try {
      let episodes: EpisodeLog[] = [];
      const res = await fetch(`/api/scraper/proxy?url=${encodeURIComponent(seriesUrl)}`);
      
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Proxy error: ${res.status} ${errText}`);
      }
      
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const allLinks = Array.from(doc.querySelectorAll("a"));
      let epLinks: HTMLAnchorElement[] = [];

      // Anoboy specific selectors
      epLinks = allLinks.filter(a => {
        const h = a.href || "";
        const text = a.textContent?.trim().toLowerCase() || "";
        if (text.includes("episode") || text.includes("ep")) return true;
        if (h.match(/-episode-\d+/i)) return true;
        return false;
      });

      // Fallback
      if (epLinks.length === 0) {
        epLinks = allLinks.filter(a => {
          const h = a.getAttribute("href") || "";
          return h.includes("/episode/") || h.includes("/eps/") || h.match(/-episode-\d+/i);
        });
      }

      const uniqueMap = new Map<string, string>();
      const linksToUse = epLinks.length > 0 ? epLinks : allLinks;
      
      linksToUse.forEach(a => {
        let h = a.getAttribute("href") || "";
        if (!h) return;
        
        if (h.startsWith("/")) {
          try {
            const urlObj = new URL(seriesUrl);
            h = `${urlObj.origin}${h}`;
          } catch (e) {
            h = h; // fallback
          }
        }
        
        if (!h.startsWith("http")) return; // ignore invalid schemes
        
        // Exclude social sharing and useless page categories
        if (
          h.includes("/category/") || 
          h.includes("/author/") || 
          h.includes("facebook.com") || 
          h.includes("twitter.com") || 
          h.includes("whatsapp") ||
          h.includes("/tag/") ||
          h === seriesUrl
        ) return;
        
        let title = a.textContent?.trim() || "";
        if (!title) {
          title = h.split("/").filter(Boolean).pop()?.replace(/-/g, " ") || "Episode";
        }
        
        if (!uniqueMap.has(h)) {
          uniqueMap.set(h, title);
        }
      });

      episodes = Array.from(uniqueMap.entries()).map(([url, title]) => {
        const num = getEpisodeNum(title, url);
        return {
          url,
          title,
          status: "pending",
          servers: [],
          number: num
        };
      });

      // Sort episodes ascending by parsed numeric episode number
      episodes.sort((a, b) => a.number - b.number);

      setEpisodeLogs(episodes);
      
      if (episodes.length === 0) {
        toast("No episodes identified. Make sure the selection pattern matches.", "error");
        setScraperState("idle");
      } else {
        setScraperState("episodes_found");
        toast(`Identified ${episodes.length} episodes successfully.`, "success");
      }

    } catch (err: any) {
      console.error(err);
      toast("Error scanning series: " + err.message, "error");
      setScraperState("idle");
    }
  };

  // Helper wait for internet connection
  const waitForOnline = async (): Promise<boolean> => {
    if (navigator.onLine) return true;
    return new Promise((resolve) => {
      const handler = () => {
        window.removeEventListener("online", handler);
        resolve(true);
      };
      window.addEventListener("online", handler);
    });
  };

  // 2. Fetch and Extract Server Mirrors for each Episode
  const handleFetchEpisodes = async () => {
    setScraperState("fetching_episodes");
    const allServers = new Set<string>();

    let copyLogs = [...episodeLogs];
    const saved = localStorage.getItem(`${botType}_bot_progress`);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length === copyLogs.length) {
                copyLogs = parsed;
                setEpisodeLogs(copyLogs);
            }
        } catch(e) { 
           console.error("Progress restoration error"); 
        }
    }
    
    // Scrape pages sequentially
    for (let i = 0; i < copyLogs.length; i++) {
        if (!navigator.onLine) {
            await waitForOnline();
        }

       const ep = copyLogs[i];
       if (ep.status === "success" || ep.status === "error") continue; 

       ep.status = "fetching";
       setEpisodeLogs([...copyLogs]);

       try {
         const res = await fetch(`/api/scraper/proxy?url=${encodeURIComponent(ep.url)}`);
         if (!res.ok) throw new Error("Scraper network error");
         
         const html = await res.text();
         const parser = new DOMParser();
         const doc = parser.parseFromString(html, "text/html");

         const servers: { name: string; url: string }[] = [];

         if (false) {
           // Parse Otakudesu mirror streams
           const mirrorLinks = doc.querySelectorAll(".mirrorstream a, .mirrorstream li, .mirrorstream option, .player-embed a");
           mirrorLinks.forEach(el => {
              const embedVal = el.getAttribute("data-embed") || el.getAttribute("data-video") || el.getAttribute("value") || el.getAttribute("data-id") || el.getAttribute("href") || "";
              let name = el.textContent?.trim() || "Unknown";
              
              if (embedVal && embedVal !== "#") {
                 let finalVidUrl = embedVal;
                 if (!finalVidUrl.startsWith("http") && !finalVidUrl.startsWith("/") && finalVidUrl.length > 20) {
                   try { finalVidUrl = atob(finalVidUrl); } catch(e){}
                 }
                 
                 if (finalVidUrl.startsWith("/") && !finalVidUrl.startsWith("//")) {
                   try {
                     const urlObj = new URL(ep.url);
                     finalVidUrl = `${urlObj.origin}${finalVidUrl}`;
                   } catch(e){}
                 }

                 if (finalVidUrl.includes("<iframe") && finalVidUrl.includes("src=")) {
                    const match = finalVidUrl.match(/src=["'](.*?)["']/);
                    if (match) finalVidUrl = match[1];
                 }

                 // Map pretty server names
                 let mappedName = name;
                 const lName = name.toLowerCase();
                 if (lName.includes("zippy") || lName.includes("share")) mappedName = "Zippyshare";
                 else if (lName.includes("quick") || lName.includes("cepat")) mappedName = "Cepat";
                 else if (lName.includes("moon") || lName.includes("filemoon")) mappedName = "Filemoon";
                 else if (lName.includes("stream") || lName.includes("tape")) mappedName = "Streamtape";
                 else if (lName.includes("mega")) mappedName = "Mega.nz";
                 else if (lName.includes("gdrive") || lName.includes("gdplayer")) mappedName = "GDrive";
                 else if (lName.includes("btube") || lName.includes("b-tube")) mappedName = "Btube";

                 if (!servers.some(s => s.url === finalVidUrl)) {
                    servers.push({ name: mappedName, url: finalVidUrl });
                    allServers.add(mappedName);
                 }
              }
           });

         } else {
           // Parse Anoboy mirror streams
           const serverLinks = doc.querySelectorAll("[id='allmiror'], a.server, .vmiror a");
           serverLinks.forEach(el => {
             const vidUrl = el.getAttribute("data-video") || el.getAttribute("href") || "";
             let name = el.textContent?.trim() || "Unknown";
             
             if (vidUrl && vidUrl !== "#") {
               let finalVidUrl = vidUrl;
               if (!finalVidUrl.startsWith("http") && !finalVidUrl.startsWith("/") && finalVidUrl.length > 20) {
                 try { finalVidUrl = atob(finalVidUrl); } catch(e){}
               }
               
               if (finalVidUrl.startsWith("/") && !finalVidUrl.startsWith("//")) {
                 try {
                   const urlObj = new URL(ep.url);
                   finalVidUrl = `${urlObj.origin}${finalVidUrl}`;
                 } catch(e){}
               }

               if (finalVidUrl.includes("<iframe") && finalVidUrl.includes("src=")) {
                  const match = finalVidUrl.match(/src=["'](.*?)["']/);
                  if (match) finalVidUrl = match[1];
               }

               if (!servers.some(s => s.url === finalVidUrl)) {
                  servers.push({ name, url: finalVidUrl });
                  allServers.add(name);
               }
             }
           });

           // Options select parsing
           const selectOptions = doc.querySelectorAll("select option");
           selectOptions.forEach(opt => {
             let val = opt.getAttribute("value");
             let name = opt.textContent?.trim() || "Unknown Option";
             if (val && val !== "") {
                if (!val.startsWith("http") && !val.startsWith("/") && val.length > 20) {
                   try { val = atob(val); } catch(e){}
                }
                if (val.startsWith("/") && !val.startsWith("//")) {
                   try {
                     const urlObj = new URL(ep.url);
                     val = `${urlObj.origin}${val}`;
                   } catch(e){}
                }
                if (val.includes("<iframe") && val.includes("src=")) {
                   const match = val.match(/src=["'](.*?)["']/);
                   if (match) val = match[1];
                }
                if (!servers.some(s => s.url === val)) {
                   servers.push({ name, url: val });
                   allServers.add(name);
                }
             }
           });
         }

         // General Iframe backup fallback for both sites
         const iframes = doc.querySelectorAll("iframe, .player-embed iframe, .responsive-embed-iframe iframe");
         iframes.forEach((ifr, idx) => {
           const src = ifr.getAttribute("src") || ifr.getAttribute("data-lazy-src") || ifr.getAttribute("data-src") || "";
           if (src && !src.includes("youtube.com/channel") && !src.includes("disqus") && !src.includes("facebook") && !src.includes("googleads")) {
              let name = "Default Player";
              if (src.includes("youtube.com")) name = "YouTube";
              else if (src.includes("gdplayer") || src.includes("drive.google")) name = "GDrive";
              else if (src.includes("hydrax")) name = "Hydrax";
              else if (src.includes("turbovip")) name = "TurboVIP";
              else if (src.includes("dailymotion")) name = "Dailymotion";
              else name = `Player ${idx + 1}`;
              
              if (!servers.some(s => s.url === src)) {
                 servers.push({ name, url: src });
                 allServers.add(name);
              }
           }
         });

         ep.servers = servers;
         ep.status = "success";
       } catch (err) {
         ep.status = "error";
       }

       setEpisodeLogs([...copyLogs]);
       localStorage.setItem(`${botType}_bot_progress`, JSON.stringify(copyLogs));
       
       // Sane request spacing interval
       await new Promise(r => setTimeout(r, 650));
    }

    localStorage.removeItem(`${botType}_bot_progress`);
    setAvailableServers(Array.from(allServers));
    if (selectedServer) {
       generateFinalData(copyLogs, selectedServer);
    } else {
       setScraperState("server_selection");
    }
  };

  const getYoutubeThumbnail = (url: string): string => {
    if (!url) return "";
    const match = url.match(/(?:\/embed\/|v=|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (match) {
      return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
    }
    return "";
  };

  // Compile final JSON structure
  const generateFinalData = (logs: EpisodeLog[], targetServer: string) => {
    const finalData = logs.map((ep) => {
       const isAll = targetServer === "all";
       let finalServers: { name: string; embedUrl: string }[] = [];

       if (isAll) {
         // Gather all detected mirrors
         finalServers = ep.servers.map(s => ({
             name: s.name,
             embedUrl: s.url
         }));
       } else {
         // Filter for only designated mirror
         const srvNameMatch = targetServer.trim() !== "" ? targetServer.trim().toLowerCase() : "";
         const matchedSrv = ep.servers.find(s => s.name.toLowerCase().includes(srvNameMatch));
         if (matchedSrv) {
           finalServers = [{
               name: targetServer || matchedSrv.name,
               embedUrl: matchedSrv.url
           }];
         } else {
           // Fallback to first available
           const fallback = ep.servers[0];
           finalServers = [{
               name: fallback ? fallback.name : targetServer,
               embedUrl: fallback ? fallback.url : ""
           }];
         }
       }

       // Auto inject standard default required players (YouTube, Hydrax, TurboVIP, Dailymotion, OKRu) if missing
       const mandatory = ["YouTube", "Hydrax", "TurboVIP", "Dailymotion", "OKRu"];
       mandatory.forEach(m => {
          const exists = finalServers.some(s => s.name.toLowerCase() === m.toLowerCase());
          if (!exists) {
            finalServers.push({
               name: m,
               embedUrl: ""
            });
          }
       });

       // Clean out empty duplicate records
       finalServers = finalServers.filter((v, i, a) => {
         const isFirstUnique = a.findIndex(t => t.name.toLowerCase() === v.name.toLowerCase()) === i;
         if (!isFirstUnique) return false;
         if (!v.embedUrl || !v.embedUrl.trim()) return false;
         return true;
       });

       // Build Fallback streaming address source
       const fallbackSrc = isAll 
          ? (ep.servers[0]?.url || "") 
          : (ep.servers.find(s => s.name.toLowerCase().includes(targetServer.trim().toLowerCase()))?.url || ep.servers[0]?.url || "");
       
       // Try generating a smart thumbnail if any YouTube embed is present
       let thumbnail = "";
       for (const s of finalServers) {
         const matchThumb = getYoutubeThumbnail(s.embedUrl);
         if (matchThumb) {
           thumbnail = matchThumb;
           break;
         }
       }
       if (!thumbnail) {
         thumbnail = "/placeholder-episode.jpg";
       }

       return {
         url: fallbackSrc,
         servers: finalServers,
         number: ep.number,
         title: ep.title || `Episode ${ep.number}`,
         thumbnail: thumbnail
       };
    });

    setFinalResult(finalData);
    setScraperState("done");
  };

  const completeScraping = () => {
    if (!selectedServer) {
        toast("Please choose a server template first", "error");
        return;
    }
    generateFinalData(episodeLogs, selectedServer);
  };

  const copyResult = () => {
    navigator.clipboard.writeText(JSON.stringify(finalResult, null, 2));
    toast("JSON blocks copied to clipboard successfully!", "success");
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Upper header section */}
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-medium tracking-tight text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-red-500 animate-pulse" />
            Viyie Scraper Bot Center
          </h2>
          <p className="text-white/40 text-xs">
            Extract episodes and mirror embed streams automatically to generate compliant database structures.
          </p>
        </div>
        
        {/* Connection status badge */}
        <div className={`self-start md:self-auto px-3 py-1 rounded-full text-[10px] uppercase font-medium tracking-widest flex items-center gap-1.5 transition-colors duration-300 ${isOnline ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5" />
              Online
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 animate-bounce" />
              Disconnected
            </>
          )}
        </div>
      </div>

      {/* Main interaction canvas card container */}
      <div className="bg-[#0b0b0e] border border-white/5 rounded-3xl p-6 space-y-6 shadow-2xl overflow-hidden relative">
         
         {scraperState === "idle" && (
           <div className="space-y-4 animate-in fade-in duration-300">
               <div className="space-y-2">
                  <span className="text-[10px] uppercase tracking-widest text-red-500 font-medium block">
                    Anoboy Series Detail URL
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={seriesUrl}
                      onChange={(e) => setSeriesUrl(e.target.value)}
                      placeholder="https://anoboy7.com/anime/series-id-sub-indo"
                      className="flex-1 bg-black/60 border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all duration-200 placeholder-white/20"
                    />
                    <button
                      onClick={async () => {
                         if (!seriesUrl) {
                           toast("Enter URL", "error");
                           return;
                         }
                         try {
                           const res = await fetch(`/api/scraper/parse-anoboy?url=${encodeURIComponent(seriesUrl)}`);
                           if (!res.ok) throw new Error("Meta fetch failed");
                           const data = await res.json();
                           setMetaData(data);
                           toast("Meta data fetched!", "success");
                         } catch(e) {
                           toast("Meta fetch error", "error");
                         }
                      }}
                      className="bg-white/5 hover:bg-white/10 text-white px-4 rounded-2xl font-semibold text-xs"
                    >
                      Fetch Meta
                    </button>
                  </div>
               </div>

               {metaData && (
                 <div className="bg-black/60 border border-white/10 rounded-2xl p-4 text-xs space-y-2 text-white/70">
                    <p className="text-white font-semibold">{metaData.title}</p>
                    <p>{metaData.synopsis.slice(0, 100)}...</p>
                 </div>
               )}

               <div className="space-y-2 border-t border-white/5 pt-4">
                  <span className="text-[10px] uppercase tracking-widest text-blue-500 font-medium block">
                    New Generic Bot (Episode Scraper)
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Episode URL"
                      id="genericBotUrl"
                      className="flex-1 bg-black/60 border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all duration-200 placeholder-white/20"
                    />
                    <button
                      onClick={async () => {
                         const url = (document.getElementById("genericBotUrl") as HTMLInputElement).value;
                         if (!url) { toast("Enter URL", "error"); return; }
                         try {
                           const res = await fetch(`/api/scraper/fetch-episode-servers?url=${encodeURIComponent(url)}`);
                           if (!res.ok) throw new Error("Fetch failed");
                           const data = await res.json();
                           console.log("Scraped servers:", data.servers);
                           toast(`Found ${data.servers.length} servers!`, "success");
                         } catch(e) {
                           toast("Fetch error", "error");
                         }
                      }}
                      className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-4 rounded-2xl font-semibold text-xs"
                    >
                      Fetch Servers
                    </button>
                  </div>
               </div>

               <div className="space-y-2">
                  <span className="text-[10px] uppercase tracking-widest text-red-500 font-medium block">
                    Base Server Extraction Profile
                  </span>
                  <select
                    value={selectedServer}
                    onChange={(e) => setSelectedServer(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white focus:border-red-500 outline-none transition-all"
                  >
                    <option value="all">Automatically Embed All Detected Servers</option>
                    <option value="Btube">Filter only Btube Player</option>
                    <option value="Cepat">Filter only Cepat Player</option>
                    <option value="GDrive">Filter only GDrive Player</option>
                    <option value="Filemoon">Filter only Filemoon Player</option>
                    <option value="Dood">Filter only Doodstream Player</option>
                    <option value="Vidhide">Filter only Vidhide Player</option>
                    <option value="youtube">Filter only YouTube Player</option>
                    <option value="hydrax">Filter only Hydrax Player</option>
                    <option value="turbovip">Filter only TurboVIP Player</option>
                    <option value="dailymotion">Filter only Dailymotion Player</option>
                  </select>
               </div>

               <button
                  onClick={handleFetchSeries}
                  className="bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white px-6 py-3 rounded-2xl font-semibold tracking-wide transition-all flex items-center justify-center gap-2 w-full sm:w-auto text-xs"
               >
                  <Search className="w-4 h-4" />
                  Initiate Scan Series
               </button>
           </div>
         )}

         {scraperState === "fetching_series" && (
            <div className="flex flex-col items-center justify-center py-12 text-white/50 animate-pulse space-y-3">
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-12 h-12 rounded-full border-2 border-red-500/20 animate-ping" />
                  <Globe className="w-8 h-8 text-red-500 animate-spin" />
                </div>
                <span className="text-xs">Crawling main server endpoints for list sequences...</span>
            </div>
         )}

         {scraperState === "episodes_found" && (
            <div className="space-y-4 animate-in fade-in duration-300">
                <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-2xl text-red-400 text-xs flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-red-500 shrink-0" />
                    <span>Identified {episodeLogs.length} matching episodes. Launch player extractor?</span>
                </div>

                <div 
                  ref={listRef} 
                  onMouseMove={handleMouseMove} 
                  className="max-h-[250px] overflow-y-auto bg-black/40 rounded-2xl border border-white/5 p-2 space-y-1 custom-scroll"
                >
                    {episodeLogs.map((ep, i) => (
                        <div key={i} className="text-xs text-white/60 p-2.5 rounded-lg border-b border-white/5 last:border-0 flex gap-2 items-center hover:bg-white/5 transition-all">
                           <span className="text-red-500 font-mono text-[10px] w-4">#{ep.number}</span>
                           <span className="flex-1 truncate">{ep.title}</span>
                           <span className="text-white/20 select-all font-mono hover:text-white/40 text-[9px] truncate max-w-[250px]">{ep.url}</span>
                        </div>
                    ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleFetchEpisodes}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white px-5 py-3 rounded-2xl font-semibold text-xs active:scale-95 transition-all"
                  >
                    <Play className="w-4 h-4" />
                    Begin Mirror Extraction (Batch)
                  </button>
                  <button
                    onClick={resetScraper}
                    className="px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white text-xs transition-all font-semibold"
                  >
                    Cancel
                  </button>
                </div>
            </div>
         )}

         {scraperState === "fetching_episodes" && (
            <div className="space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center gap-2 py-1 text-red-500 font-semibold text-xs">
                   <RefreshCw className="animate-spin w-4 h-4 shrink-0" />
                   Parsing Episodes Mirror Iframes...
                </div>
                
                <div 
                  ref={listRef} 
                  onMouseMove={handleMouseMove} 
                  className="max-h-[260px] overflow-y-auto bg-black/40 rounded-2xl border border-white/5 p-2 space-y-1 custom-scroll"
                >
                    {episodeLogs.map((ep, i) => (
                        <div key={i} className={`text-xs p-2.5 rounded-lg border-b border-white/5 last:border-0 flex gap-2 items-center transition-colors duration-200
                            ${ep.status === "fetching" ? "bg-red-500/10 text-red-400" :
                              ep.status === "success" ? "text-emerald-400 hover:bg-emerald-500/5" :
                              ep.status === "error" ? "text-red-400/60 hover:bg-red-500/5" : "text-white/40"
                            }
                        `}>
                           <span className="text-[10px] font-mono w-4">#{ep.number}</span>
                           <span className="flex-1 truncate">{ep.title}</span>
                           <span className="font-medium text-[9px] uppercase tracking-widest">{ep.status}</span>
                        </div>
                    ))}
                </div>
            </div>
         )}

         {scraperState === "server_selection" && (
            <div className="space-y-6 animate-in fade-in duration-300">
                 <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-xl text-red-400 text-xs">
                    <p className="font-medium mb-1">Extraction Complete!</p>
                    <p className="opacity-70">Identified {availableServers.length} individual streaming players on sources.</p>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] uppercase font-medium text-white/50 tracking-widest block pl-1">Choose template mapping profile</label>
                    <div className="flex flex-wrap gap-2">
                        <button
                           onClick={() => setSelectedServer("all")}
                           className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${selectedServer === "all" ? 'border-red-500 bg-red-500/20 text-red-400' : 'border-white/10 bg-white/5 text-white/60 hover:text-white'}`}
                        >
                           All Mirrors
                        </button>
                        {availableServers.map(srv => (
                            <button
                               key={srv}
                               onClick={() => setSelectedServer(srv)}
                               className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${selectedServer === srv ? 'border-red-500 bg-red-500/20 text-red-400' : 'border-white/10 bg-white/5 text-white/60 hover:text-white'}`}
                            >
                               {srv}
                            </button>
                        ))}
                    </div>
                 </div>

                 <button
                  onClick={completeScraping}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-300 hover:text-black text-white px-5 py-3 rounded-2xl font-semibold text-xs active:scale-95 transition-all"
                 >
                  <Save className="w-4 h-4" />
                  Format Content JSON Dataset
                 </button>
            </div>
         )}

         {scraperState === "done" && (
              <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                          <p className="text-xs font-semibold text-emerald-400">
                              Array Elements Formatted Successfully
                          </p>
                          <p className="text-[9px] text-white/40 uppercase tracking-wider">
                              Copy and paste this array inside the JSON editor of your video database.
                          </p>
                      </div>
                      
                      <div className="flex gap-2 shrink-0">
                          <button 
                            onClick={copyResult} 
                            className="bg-red-600 hover:bg-red-500 text-white text-xs px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Copy JSON
                          </button>
                          <button 
                            onClick={resetScraper} 
                            className="text-xs bg-white/5 hover:bg-white/10 text-white/80 px-3.5 py-2 rounded-xl transition-all cursor-pointer font-semibold"
                          >
                            Scrape Another
                          </button>
                      </div>
                  </div>

                  <div className="relative">
                    <textarea
                        value={JSON.stringify(finalResult, null, 2)}
                        readOnly
                        className="w-full h-[350px] bg-black/80 border border-white/10 rounded-2xl p-4 font-mono text-[10.5px] text-red-400 focus:outline-none custom-scrollbar shadow-inner"
                    />
                  </div>
              </div>
          )}

      </div>
    </div>
  );
}
