import React, { useState, useRef } from "react";
import {
  Upload,
  Download,
  Clock,
  Replace,
  FileText,
  RefreshCw,
  Plus,
  Trash2,
  AlertTriangle,
  Eye,
  Code,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Undo,
  Redo
} from "lucide-react";
import { useUserData } from "../hooks/useUserData";
import { useUndoRedo } from "../hooks/useUndoRedo";

interface SubtitleCue {
  id: string;
  index: number;
  startTime: string;
  endTime: string;
  text: string;
}

export default function AdminSubtitleTool() {
  const { toast } = useUserData();
  
  const { state: fileContent, setState: setFileContent, undo: undoFile, redo: redoFile, canUndo: canUndoFile, canRedo: canRedoFile, resetHistory: resetFileHistory } = useUndoRedo("");
  const { state: cues, setState: setCues, undo: undoCues, redo: redoCues, canUndo: canUndoCues, canRedo: canRedoCues, resetHistory: resetCuesHistory } = useUndoRedo<SubtitleCue[]>([]);

  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("srt"); // srt or vtt

  // Editor States
  const [editorMode, setEditorMode] = useState<"visual" | "raw">("visual");

  // Replace states
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");

  // Time shift states
  const [shiftSeconds, setShiftSeconds] = useState<number | "">(-10);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper parsers
  const parseSubtitles = (content: string, _type: string): SubtitleCue[] => {
    const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const blocks = normalized.trim().split(/\n\s*\n/);
    const parsed: SubtitleCue[] = [];
    let idx = 1;

    for (const block of blocks) {
      if (block.startsWith("WEBVTT")) continue;

      const lines = block
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length === 0) continue;

      let timeLine = "";
      let textLines = [];

      if (lines[0].includes("-->")) {
        timeLine = lines[0];
        textLines = lines.slice(1);
      } else if (lines.length > 1 && lines[1].includes("-->")) {
        timeLine = lines[1];
        textLines = lines.slice(2);
      } else {
        continue;
      }

      const [start, end] = timeLine.split("-->").map((s) => s.trim());
      parsed.push({
        id: Math.random().toString(36).substring(2, 9),
        index: idx++,
        startTime: start,
        endTime: end,
        text: textLines.join("\n"),
      });
    }
    return parsed;
  };

  const stringifySubtitles = (cueList: SubtitleCue[], type: string): string => {
    let out = type === "vtt" ? "WEBVTT\r\n\r\n" : "";
    cueList.forEach((cue, i) => {
      let start = cue.startTime.trim();
      let end = cue.endTime.trim();

      const formatTime = (t: string, isVtt: boolean) => {
        let p = t.replace(isVtt ? /,/g : /\./g, isVtt ? "." : ",");
        if (p.split(":").length === 2) p = "00:" + p;
        return p;
      };

      start = formatTime(start, type === "vtt");
      end = formatTime(end, type === "vtt");

      const text = cue.text.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
      out += `${i + 1}\r\n${start} --> ${end}\r\n${text}\r\n\r\n`;
    });
    return out.trim() + "\r\n\r\n";
  };

  const syncToRaw = () => {
    setFileContent(stringifySubtitles(cues, fileType));
  };

  const syncToVisual = (content: string) => {
    setCues(parseSubtitles(content, fileType));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const isVtt = file.name.toLowerCase().endsWith(".vtt");
    setFileType(isVtt ? "vtt" : "srt");

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === "string") {
        const text = event.target.result;
        resetFileHistory(text);

        const parsed = parseSubtitles(text, isVtt ? "vtt" : "srt");
        if (parsed.length > 0) {
          resetCuesHistory(parsed);
          setEditorMode("visual");
        } else {
          resetCuesHistory([]);
          setEditorMode("raw");
        }

        toast("Subtitle loaded successfully", "success");
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDownload = () => {
    if (!fileName) return;

    // Use latest state
    const contentToDownload =
      editorMode === "visual"
        ? stringifySubtitles(cues, fileType)
        : fileContent;

    // UTF-8 with BOM for Dailymotion compatibility
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + contentToDownload], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Edited_${fileName}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast("File downloaded", "success");
  };

  const handleReplace = () => {
    if (!findText) return;
    const regex = new RegExp(findText, "gi");

    if (editorMode === "visual") {
      const newCues = cues.map((c) => ({
        ...c,
        text: c.text.replace(regex, replaceText),
      }));
      setCues(newCues);
      toast(
        `Replaced "${findText}" with "${replaceText}" in ${newCues.length} subtitles`,
        "success",
      );
    } else {
      const newContent = fileContent.replace(regex, replaceText);
      setFileContent(newContent);
      toast(
        `Replaced "${findText}" with "${replaceText}" in raw text`,
        "success",
      );
    }
  };

  const shiftTimeStr = (
    timeStr: string,
    deltaSeconds: number,
    isVtt: boolean,
  ) => {
    try {
      const separator = isVtt ? "." : ",";
      const parts = timeStr.trim().split(separator);
      if (parts.length !== 2) return timeStr;

      const timeParts = parts[0].split(":");
      let sec = 0,
        min = 0,
        hr = 0;

      if (timeParts.length === 3) {
        hr = parseInt(timeParts[0]);
        min = parseInt(timeParts[1]);
        sec = parseInt(timeParts[2]);
      } else if (timeParts.length === 2) {
        min = parseInt(timeParts[0]);
        sec = parseInt(timeParts[1]);
      } else {
        return timeStr;
      }

      const ms = parseInt(parts[1].padEnd(3, "0").substring(0, 3));

      let totalMs = hr * 3600000 + min * 60000 + sec * 1000 + ms;
      totalMs += deltaSeconds * 1000;

      if (totalMs < 0) totalMs = 0;

      const newHr = Math.floor(totalMs / 3600000);
      totalMs %= 3600000;
      const newMin = Math.floor(totalMs / 60000);
      totalMs %= 60000;
      const newSec = Math.floor(totalMs / 1000);
      const newMs = Math.floor(totalMs % 1000);

      const pad = (n: number) => n.toString().padStart(2, "0");
      const padMs = (n: number) => n.toString().padStart(3, "0");

      if (isVtt) {
        if (timeParts.length === 2 && newHr === 0) {
          return `${pad(newMin)}:${pad(newSec)}.${padMs(newMs)}`;
        }
        return `${pad(newHr)}:${pad(newMin)}:${pad(newSec)}.${padMs(newMs)}`;
      } else {
        return `${pad(newHr)}:${pad(newMin)}:${pad(newSec)},${padMs(newMs)}`;
      }
    } catch (e) {
      console.warn("Could not shift time:", timeStr);
      return timeStr;
    }
  };

  const handleShiftTime = () => {
    if (typeof shiftSeconds !== "number" || isNaN(shiftSeconds)) return;

    if (editorMode === "visual") {
      let matchCount = 0;
      const newCues = cues.map((cue) => {
        matchCount++;
        return {
          ...cue,
          startTime: shiftTimeStr(
            cue.startTime,
            shiftSeconds,
            fileType === "vtt",
          ),
          endTime: shiftTimeStr(cue.endTime, shiftSeconds, fileType === "vtt"),
        };
      });
      setCues(newCues);
      toast(
        `Shifted ${matchCount} timestamps by ${shiftSeconds} seconds.`,
        "success",
      );
    } else {
      const pattern =
        /(\d{2}:\d{2}:\d{2}[,.]\d{3}|\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3}|\d{2}:\d{2}[,.]\d{3})/g;
      let matchCount = 0;
      const newContent = fileContent.replace(pattern, (_match, start, end) => {
        matchCount++;
        const isStartVtt = start.includes(".");
        const isEndVtt = end.includes(".");
        const newStart = shiftTimeStr(start, shiftSeconds, isStartVtt);
        const newEnd = shiftTimeStr(end, shiftSeconds, isEndVtt);
        return `${newStart} --> ${newEnd}`;
      });
      setFileContent(newContent);
      toast(
        `Shifted ${matchCount} timestamps by ${shiftSeconds} seconds.`,
        "success",
      );
    }
  };

  // Cue visual editor helpers
  const timeToMs = (timeStr: string) => {
    const parts = timeStr.trim().split(/[:,.]/);
    if (parts.length >= 3) {
      let ms = parseInt(parts.pop() || "0");
      let s = parseInt(parts.pop() || "0");
      let m = parseInt(parts.pop() || "0");
      let h = parseInt(parts.pop() || "0");
      return h * 3600000 + m * 60000 + s * 1000 + ms;
    }
    return -1;
  };

  const updateCue = (id: string, updates: Partial<SubtitleCue>) => {
    setCues(cues.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const insertCue = (index: number) => {
    const newCues = [...cues];
    let prevCue = undefined;
    let fallbackStartTime = "00:00:00,000";

    if (newCues.length > 0) {
      prevCue = newCues[Math.max(0, index)];
    }

    if (prevCue) {
      fallbackStartTime = prevCue.endTime;
    } else {
      fallbackStartTime = fileType === "vtt" ? "00:00:00.000" : "00:00:00,000";
    }

    const newCue: SubtitleCue = {
      id: Math.random().toString(36).substring(2, 9),
      index: 0,
      startTime: fallbackStartTime,
      endTime: shiftTimeStr(fallbackStartTime, 2, fileType === "vtt"), // 2s duration default
      text: "New subtitle text",
    };

    if (newCues.length === 0) {
      newCues.push(newCue);
    } else {
      newCues.splice(index + 1, 0, newCue);
    }

    // Re-index
    newCues.forEach((c, i) => (c.index = i + 1));
    setCues(newCues);
    toast("Row inserted", "info");
  };

  const removeCue = (id: string) => {
    let newCues = cues.filter((c) => c.id !== id);
    newCues.forEach((c, i) => (c.index = i + 1));
    setCues(newCues);
  };

  const moveCue = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === cues.length - 1)
    )
      return;
    const newIdx = direction === "up" ? index - 1 : index + 1;
    const _cues = [...cues];
    const temp = _cues[index];
    _cues[index] = _cues[newIdx];
    _cues[newIdx] = temp;
    _cues.forEach((c, i) => (c.index = i + 1));
    setCues(_cues);
  };

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleDragStart = (_e: React.DragEvent, index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (_e: React.DragEvent, index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (
      dragItem.current !== null &&
      dragOverItem.current !== null &&
      dragItem.current !== dragOverItem.current
    ) {
      const _cues = [...cues];
      const draggedItemContent = _cues.splice(dragItem.current, 1)[0];
      _cues.splice(dragOverItem.current, 0, draggedItemContent);
      _cues.forEach((c, i) => (c.index = i + 1));
      setCues(_cues);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-medium text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-red-500" />
          Auto Edit Subtitle Tool
        </h2>
        <p className="text-white/40 text-sm">
          Upload SRT or VTT, add rows manually, shift timestamps, replace texts
          easily!
        </p>
      </div>

      <div className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl space-y-6 shadow-2xl">
        {/* Upload Section */}
        <div className="flex items-center gap-4">
          <input
            type="file"
            accept=".srt,.vtt,.txt"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-2xl font-medium transition-all shadow-[0_4px_20px_rgba(239,68,68,0.3)] hover:shadow-[0_4px_25px_rgba(239,68,68,0.5)]"
          >
            <Upload className="w-5 h-5" />
            {fileName || "Upload Subtitle File..."}
          </button>

          {(fileContent || cues.length > 0) && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-2xl font-medium transition-all border border-white/10"
            >
              <Download className="w-5 h-5" />
              Download Edited File
            </button>
          )}
        </div>

        {(fileContent || cues.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t border-white/5">
            {/* Editor Area */}
            <div className="space-y-3 lg:col-span-8">
              <div className="flex items-center justify-between pl-2">
                <label className="text-xs font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                  {editorMode === "visual" ? (
                    <Eye className="w-4 h-4 text-blue-400" />
                  ) : (
                    <Code className="w-4 h-4 text-purple-400" />
                  )}
                  {editorMode === "visual"
                    ? "Visual Editor (Line by Line)"
                    : "Raw Text Source"}
                </label>
                <div className="flex items-center gap-2">
                  {editorMode === "visual" ? (
                    <>
                      <button 
                        onClick={undoCues} disabled={!canUndoCues}
                        className="text-[10px] bg-white/5 disabled:opacity-30 hover:bg-white/10 px-2 py-1 rounded-md text-white font-medium transition-all flex items-center gap-1 uppercase"
                      >
                         <Undo className="w-3 h-3" /> Undo
                      </button>
                      <button 
                         onClick={redoCues} disabled={!canRedoCues}
                         className="text-[10px] bg-white/5 disabled:opacity-30 hover:bg-white/10 px-2 py-1 rounded-md text-white font-medium transition-all flex items-center gap-1 uppercase"
                      >
                         <Redo className="w-3 h-3" /> Redo
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={undoFile} disabled={!canUndoFile}
                        className="text-[10px] bg-white/5 disabled:opacity-30 hover:bg-white/10 px-2 py-1 rounded-md text-white font-medium transition-all flex items-center gap-1 uppercase"
                      >
                         <Undo className="w-3 h-3" /> Undo
                      </button>
                      <button 
                         onClick={redoFile} disabled={!canRedoFile}
                         className="text-[10px] bg-white/5 disabled:opacity-30 hover:bg-white/10 px-2 py-1 rounded-md text-white font-medium transition-all flex items-center gap-1 uppercase"
                      >
                         <Redo className="w-3 h-3" /> Redo
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      if (editorMode === "visual") {
                        syncToRaw();
                        setEditorMode("raw");
                      } else {
                        syncToVisual(fileContent);
                        setEditorMode("visual");
                      }
                    }}
                    className="text-[10px] bg-white/10 hover:bg-white/20 px-3 py-1 rounded-md text-white font-medium transition-all flex items-center gap-2 uppercase tracking-wide"
                  >
                    Switch to{" "}
                    {editorMode === "visual" ? "Raw Mode" : "Visual Mode"}
                  </button>
                </div>
              </div>

              {editorMode === "raw" ? (
                <textarea
                  value={fileContent || ""}
                  onChange={(e) => setFileContent(e.target.value)}
                  className="w-full h-[600px] bg-black/40 border border-white/10 rounded-2xl p-4 text-sm font-mono text-white/80 focus:border-red-500 transition-all outline-none resize-none hide-scrollbar shadow-inner"
                  placeholder="Subtitle file content..."
                />
              ) : (
                <div className="flex flex-col gap-3 h-[600px] overflow-y-auto pr-2 custom-scrollbar bg-black/20 rounded-2xl p-2 border border-white/5">
                  {cues.length === 0 && (
                    <div className="w-full py-10 flex flex-col items-center justify-center text-white/20">
                      <AlertTriangle className="w-10 h-10 mb-2 opacity-50" />
                      <p className="font-medium">
                        No valid subtitle records found.
                      </p>
                      <button
                        onClick={() => insertCue(0)}
                        className="mt-4 text-red-500 font-medium border border-red-500/20 bg-red-500/10 px-4 py-2 rounded-xl"
                      >
                        Add New Subtitle
                      </button>
                    </div>
                  )}
                  {cues.map((cue, index) => {
                    const startMs = timeToMs(cue.startTime);
                    const endMs = timeToMs(cue.endTime);
                    const prevEndMs =
                      index > 0 ? timeToMs(cues[index - 1].endTime) : -1;
                    const nextStartMs =
                      index < cues.length - 1
                        ? timeToMs(cues[index + 1].startTime)
                        : Infinity;

                    // Check if overlap exists (if parsing succeeded)
                    const hasConflict =
                      (startMs > -1 && prevEndMs > -1 && startMs < prevEndMs) ||
                      (endMs > -1 && nextStartMs > -1 && endMs > nextStartMs) ||
                      startMs > endMs;

                    return (
                      <div
                        key={cue.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragEnter={(e) => handleDragEnter(e, index)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                        className="relative bg-[#111] border border-white/10 rounded-xl p-3 flex gap-3 group hover:border-white/20 transition-all cursor-move"
                      >
                        <div className="flex flex-col items-center justify-between py-1 text-white/20 group-hover:text-red-500/50 transition-colors">
                          <button
                            onClick={() => moveCue(index, "up")}
                            className="hover:text-red-400 disabled:opacity-30 p-1"
                            disabled={index === 0}
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <GripVertical className="w-4 h-4" />
                          <button
                            onClick={() => moveCue(index, "down")}
                            className="hover:text-red-400 disabled:opacity-30 p-1"
                            disabled={index === cues.length - 1}
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex-1 flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
                            <span className="text-[10px] font-black min-w-[24px] text-center text-red-500 bg-red-500/10 border border-red-500/20 rounded-md p-1 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                              #{cue.index}
                            </span>
                            <div className="flex items-center gap-1 sm:gap-2 flex-wrap flex-1 min-w-[200px]">
                              <Clock className="w-3 h-3 text-red-400 mr-1 hidden sm:block" />
                              <input
                                type="text"
                                value={cue.startTime || ""}
                                onChange={(e) =>
                                  updateCue(cue.id, {
                                    startTime: e.target.value,
                                  })
                                }
                                className={`w-28 bg-black border ${hasConflict ? "border-red-500/50 text-red-400" : "border-white/10 text-red-400"} rounded-md px-2 py-1 text-[11px] font-mono outline-none focus:border-red-500/50`}
                              />
                              <span className="text-white/30 text-[10px]">
                                --&gt;
                              </span>
                              <input
                                type="text"
                                value={cue.endTime || ""}
                                onChange={(e) =>
                                  updateCue(cue.id, { endTime: e.target.value })
                                }
                                className={`w-28 bg-black border ${hasConflict ? "border-red-500/50 text-red-400" : "border-white/10 text-red-400"} rounded-md px-2 py-1 text-[11px] font-mono outline-none focus:border-red-500/50`}
                              />
                            </div>
                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <button
                                title="Add Subtitle Below"
                                onClick={() => insertCue(index)}
                                className="p-1.5 hover:bg-emerald-500/20 text-emerald-500 bg-white/5 rounded-lg transition-all border border-emerald-500/20"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <button
                                title="Delete Subtitle"
                                onClick={() => removeCue(cue.id)}
                                className="p-1.5 hover:bg-red-500/20 text-red-400 bg-white/5 rounded-lg transition-all border border-red-500/20"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="flex w-full">
                            <textarea
                              value={cue.text || ""}
                              onChange={(e) =>
                                updateCue(cue.id, { text: e.target.value })
                              }
                              className="w-full bg-black/40 border border-white/5 rounded-md p-2 text-sm text-white/90 focus:border-red-500/30 outline-none resize-y min-h-[50px] font-sans"
                            />
                          </div>
                          {hasConflict && (
                            <div className="text-[9px] text-red-400 font-medium uppercase tracking-wider flex items-center gap-1 bg-red-500/10 p-1.5 rounded-md mt-1 border border-red-500/20">
                              <AlertTriangle className="w-3 h-3" /> Time
                              boundary conflict detected
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tools Area */}
            <div className="space-y-6 lg:col-span-4">
              {/* Time Shifting */}
              <div className="bg-black/40 border border-white/10 p-5 rounded-2xl space-y-4 shadow-xl">
                <div className="flex items-center justify-between text-white font-medium pb-2 border-b border-white/5">
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-red-500" /> Time Shift
                  </span>
                </div>
                <div className="flex flex-col gap-2 relative">
                  <label className="text-[10px] uppercase font-medium tracking-widest text-white/50">
                    Shift Amount (Seconds)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={shiftSeconds ?? ""}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setShiftSeconds(isNaN(val) ? "" : val);
                      }}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-white focus:border-red-500 transition-all outline-none"
                      placeholder="-10 or 5.5"
                    />
                    <button
                      onClick={handleShiftTime}
                      className="bg-red-600/20 hover:bg-red-600 border border-red-500/30 text-white px-4 py-3 rounded-xl font-medium transition-all"
                    >
                      Apply
                    </button>
                  </div>
                  <p className="text-[10px] text-white/40 italic leading-relaxed mt-1">
                    Example: <b className="text-white"> -10 </b> makes subtitles
                    display 10 seconds earlier (sync fix).
                  </p>
                </div>
              </div>

              {/* Text Finding & Replacing */}
              <div className="bg-black/40 border border-white/10 p-5 rounded-2xl space-y-4 shadow-xl">
                <div className="flex items-center gap-2 text-white font-medium pb-2 border-b border-white/5">
                  <Replace className="w-4 h-4 text-red-500" />
                  Find & Replace
                </div>

                <div className="space-y-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-medium tracking-widest text-white/50">
                      Find Word/Phrase
                    </label>
                    <input
                      type="text"
                      value={findText || ""}
                      onChange={(e) => setFindText(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-white focus:border-red-500 transition-all outline-none"
                      placeholder="e.g. hai"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-medium tracking-widest text-white/50">
                      Replace With
                    </label>
                    <input
                      type="text"
                      value={replaceText || ""}
                      onChange={(e) => setReplaceText(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-white focus:border-red-500 transition-all outline-none"
                      placeholder="e.g. halo"
                    />
                  </div>

                  <button
                    onClick={handleReplace}
                    className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/20 text-white px-4 py-3 rounded-xl font-medium transition-all mt-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Replace All
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
