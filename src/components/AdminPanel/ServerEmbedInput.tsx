import { useState } from "react";
import { FileVideo, Plus, X, Loader2, RefreshCw } from "lucide-react";

export function ServerEmbedInput({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [mentahan, setMentahan] = useState("");
  const [loading, setLoading] = useState(false);

  const isRemoteVideoJson = value && typeof value === "string" && (
    value.includes('"type": "remotevideo"') ||
    value.includes('"type":"remotevideo"')
  );

  const handleFetchQuality = () => {
    if (!mentahan.trim()) return;
    setLoading(true);

    setTimeout(() => {
      try {
        let text = mentahan.trim();
        text = text.replace(/ (http[s]?:\/\/)/g, "\n$1");
        text = text.replace(/ (#EXT)/g, "\n$1");

        const lines = text.split("\n");
        const streams: { resolution: string; url: string }[] = [];
        let currentResolution = null;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith("#EXT-X-STREAM-INF")) {
            const resMatch = line.match(/RESOLUTION=(\d+x\d+)/);
            if (resMatch) {
              const [width, height] = resMatch[1].split("x").map(Number);
              if (width >= 1280 || height >= 536) currentResolution = "1080p";
              else if (width >= 854 || height >= 358) currentResolution = "720p";
              else if (width >= 640 || height >= 268) currentResolution = "480p";
              else currentResolution = "360p";
            } else {
              currentResolution = "Auto";
            }
          } else if (line && !line.startsWith("#")) {
            if (currentResolution) {
              streams.push({ resolution: currentResolution, url: line });
              currentResolution = null;
            }
          }
        }

        // Sort descending by resolution quality (rough sort)
        const order = ["1080p", "720p", "480p", "360p", "Auto"];
        streams.sort((a, b) => order.indexOf(a.resolution) - order.indexOf(b.resolution));

        if (streams.length > 0) {
          const existingParsed = isRemoteVideoJson ? JSON.parse(value as string) : {};
          const newObj = {
            ...existingParsed,
            type: "remotevideo",
            displayName: existingParsed.displayName || "Video Remote",
            streams: streams,
            subtitleTracks: existingParsed.subtitleTracks || [],
          };
          onChange(JSON.stringify(newObj, null, 2));
        } else {
          alert("No streams found in the M3U8 text.");
        }
      } catch (err) {
        alert("Failed to parse M3U8");
      } finally {
        setLoading(false);
        setMentahan(""); // Clear input on success
      }
    }, 1200); // simulated loading animation
  };

  if (isRemoteVideoJson) {
    try {
      const parsed = JSON.parse(value);
      return (
        <div className="w-full flex-1 bg-black/40 border border-blue-500/10 rounded-lg p-3.5 space-y-3.5 mt-1">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-[10px] font-black text-blue-500 flex items-center gap-2 tracking-wider">
              <FileVideo className="w-4 h-4 text-blue-500" />
              VIDEO REMOTE CONFIG
            </span>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Are you sure you want to clear this config?")) {
                  onChange("");
                }
              }}
              className="text-[9px] font-bold text-white/40 hover:text-red-500 transition-colors uppercase cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Reset
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-bold text-white/40 uppercase tracking-wide">Server Name</label>
            <input
              type="text"
              value={parsed.displayName || ""}
              onChange={(e) => {
                onChange(JSON.stringify({ ...parsed, displayName: e.target.value }, null, 2));
              }}
              className="w-full h-8 bg-black/50 border border-white/10 px-3 rounded-md text-xs outline-none focus:border-blue-500/50 transition-all text-white/90"
              placeholder="Server Title"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-bold text-white/40 uppercase tracking-wide block">Stream Qualities</label>
            {(parsed.streams || []).map((stream: any, idx: number) => (
              <div key={idx} className="flex gap-2 items-center">
                <div className="w-16 h-8 bg-black/50 border border-white/10 px-2 rounded-md text-[10px] flex items-center justify-center text-blue-400 font-black">
                  {stream.resolution}
                </div>
                <input
                  type="text"
                  value={stream.url || ""}
                  onChange={(e) => {
                    const newStreams = [...parsed.streams];
                    newStreams[idx] = { ...newStreams[idx], url: e.target.value };
                    onChange(JSON.stringify({ ...parsed, streams: newStreams }, null, 2));
                  }}
                  className="flex-1 h-8 bg-black/50 border border-white/10 px-3 rounded-md text-[10px] outline-none focus:border-blue-500/50 transition-all font-mono text-white/80"
                  placeholder="Stream URL"
                />
              </div>
            ))}
          </div>

          <div className="space-y-1 pt-2 border-t border-white/5">
            <label className="text-[9px] font-bold text-white/40 uppercase tracking-wide flex justify-between items-center">
              <span>Subtitle Tracks (VTT/SRT)</span>
              <button
                type="button"
                onClick={() => {
                  const newTracks = [...(parsed.subtitleTracks || []), { title: "", url: "" }];
                  onChange(JSON.stringify({ ...parsed, subtitleTracks: newTracks }, null, 2));
                }}
                className="text-blue-500 hover:text-blue-400 bg-blue-500/10 p-1 rounded-md"
              >
                <Plus className="w-3 h-3" />
              </button>
            </label>
            <div className="space-y-2 mt-2">
              {(parsed.subtitleTracks || []).map((track: any, idx: number) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={track.title || ""}
                    onChange={(e) => {
                      const newTracks = [...parsed.subtitleTracks];
                      newTracks[idx] = { ...newTracks[idx], title: e.target.value };
                      onChange(JSON.stringify({ ...parsed, subtitleTracks: newTracks }, null, 2));
                    }}
                    className="w-20 h-8 bg-black/50 border border-white/10 px-2 rounded-md text-[10px] outline-none focus:border-blue-500/50 transition-all text-white/80"
                    placeholder="Lang (e.g. ID)"
                  />
                  <input
                    type="text"
                    value={track.url || ""}
                    onChange={(e) => {
                      const newTracks = [...parsed.subtitleTracks];
                      newTracks[idx] = { ...newTracks[idx], url: e.target.value };
                      onChange(JSON.stringify({ ...parsed, subtitleTracks: newTracks }, null, 2));
                    }}
                    className="flex-1 h-8 bg-black/50 border border-white/10 px-3 rounded-md text-[10px] outline-none focus:border-blue-500/50 transition-all font-mono text-white/80"
                    placeholder="URL (.vtt / .srt)"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newTracks = parsed.subtitleTracks.filter((_: any, i: number) => i !== idx);
                      onChange(JSON.stringify({ ...parsed, subtitleTracks: newTracks }, null, 2));
                    }}
                    className="text-white/20 hover:text-red-500 p-1 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {(!parsed.subtitleTracks || parsed.subtitleTracks.length === 0) && (
                <div className="text-[10px] text-white/30 italic">No subtitles added.</div>
              )}
            </div>
          </div>
          <div className="space-y-1 pt-2 border-t border-white/5">
            <label className="text-[9px] font-bold text-white/40 uppercase tracking-wide flex justify-between items-center">
              <span>Import M3U8</span>
            </label>
            <textarea
              value={mentahan}
              onChange={(e) => setMentahan(e.target.value)}
              className="w-full h-24 bg-black/40 border border-white/10 p-2 rounded-lg text-xs outline-none focus:border-blue-500/50 transition-all font-mono text-white/80 resize-none"
              placeholder="Paste #EXTM3U mentahan here..."
              disabled={loading}
            />
            <button
              type="button"
              onClick={handleFetchQuality}
              disabled={loading || !mentahan.trim()}
              className="w-full h-8 mt-1 bg-blue-500 hover:bg-blue-600 disabled:bg-white/5 disabled:text-white/30 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Converting...
                </>
              ) : (
                "Fetch Quality"
              )}
            </button>
          </div>
        </div>
      );
    } catch (e) {
      // Fallback below
    }
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full h-8 bg-black/50 border border-white/10 px-3 rounded-md text-xs outline-none focus:border-red-500/50 transition-all text-white/90 ${className || ''}`}
      placeholder={placeholder || "Server Stream URL / Embed Link"}
    />
  );
}

