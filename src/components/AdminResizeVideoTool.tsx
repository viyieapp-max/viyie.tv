import React, { useState, useRef, useEffect } from "react";
import { 
  Upload, 
  Settings, 
  Lock, 
  Maximize, 
  Monitor, 
  PlaySquare, 
  RefreshCw,
  FileVideo
} from "lucide-react";
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

const ASPECT_RATIOS = [
  { label: "Original", value: "original" },
  { label: "1:1", value: "1/1" },
  { label: "4:3", value: "4/3" },
  { label: "3:2", value: "3/2" },
  { label: "16:9", value: "16/9" },
  { label: "21:9", value: "21/9" },
  { label: "9:21", value: "9/21" },
  { label: "9:16", value: "9/16" }
];

const SIZE_PRESETS = [
  { label: "Original", value: "original" },
  { label: "720p", value: "720" },
  { label: "1080p", value: "1080" }
];

export default function AdminResizeVideoTool() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState("original");
  const [outputSize, setOutputSize] = useState("original");
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  
  const ffmpegRef = useRef(new FFmpeg());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        const ffmpeg = ffmpegRef.current;
        ffmpeg.on('log', ({ message }) => {
          console.log(message);
        });
        ffmpeg.on('progress', ({ progress }) => {
          setProgress(Math.max(0, Math.min(100, Math.round(progress * 100))));
        });
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        setIsReady(true);
      } catch (err) {
        console.error("FFmpeg load error:", err);
      }
    };
    load();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
    }
  };

  const handleResize = async () => {
    if (!videoFile || !isReady) return;
    
    setIsProcessing(true);
    setProgress(0);
    setStatusText("Initializing local processor...");
    
    try {
      const ffmpeg = ffmpegRef.current;
      
      setStatusText("Mounting file system (zero copy)...");
      try {
        await ffmpeg.createDir('/workerfs');
      } catch (e) {
        // Directory might already exist
      }
      
      // @ts-ignore - FFFSType is not exported in a way that TS likes here
      await ffmpeg.mount('WORKERFS', { files: [videoFile] }, '/workerfs');
      const inputName = `/workerfs/${videoFile.name}`;
      const outputName = 'output.mp4';
      
      let vfFilters = [];
      
      // Calculate aspect ratio padding
      if (aspectRatio !== "original") {
        const [num, den] = aspectRatio.split("/").map(Number);
        const targetRatio = num / den;
        // Pad with black to target aspect ratio, ensuring even dimensions for libx264
        const wExpr = `max(iw\\,ih*(${targetRatio}))`;
        const hExpr = `max(ih\\,iw/(${targetRatio}))`;
        const wEven = `ceil(${wExpr}/2)*2`;
        const hEven = `ceil(${hExpr}/2)*2`;
        
        vfFilters.push(`pad=${wEven}:${hEven}:(ow-iw)/2:(oh-ih)/2:black`);
      }
      
      // Calculate output size
      if (outputSize !== "original") {
        const height = parseInt(outputSize);
        vfFilters.push(`scale=-2:${height}`); // -2 ensures width is even
      } else {
        if (aspectRatio === "original") {
          vfFilters.push(`scale=ceil(iw/2)*2:ceil(ih/2)*2`);
        }
      }
      
      let args = ['-i', inputName];
      
      if (vfFilters.length > 0) {
        args.push('-vf', vfFilters.join(','));
      }
      
      // Use ultrafast preset and AAC audio
      args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-c:a', 'aac', '-b:a', '128k', outputName);
      
      setStatusText("Processing (this may take a while)...");
      const exitCode = await ffmpeg.exec(args);
      
      if (exitCode !== 0) {
        throw new Error(`FFmpeg exited with code ${exitCode}`);
      }
      
      setStatusText("Finalizing output...");
      const data = await ffmpeg.readFile(outputName);
      const uint8Data = data as Uint8Array;
      // @ts-ignore - TS types for BlobPart complain about SharedArrayBuffer compatibility
      const url = URL.createObjectURL(new Blob([uint8Data], { type: 'video/mp4' }));
      
      // Trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `resized_${videoFile.name}`;
      a.click();
      
      setStatusText("Done!");
      
      try {
        await ffmpeg.unmount('/workerfs');
        await ffmpeg.deleteFile(outputName);
      } catch (e) {
        // ignore delete errors
      }
      
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 3000);
      
    } catch (err: any) {
      console.error(err);
      setStatusText(`Error: ${err.message}`);
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full bg-[#0b0c10] text-gray-200 p-4 md:p-8 rounded-2xl font-sans min-h-screen">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="space-y-4">
          <div className="text-xs font-bold tracking-widest text-gray-500 uppercase">
            Browser Video Tool
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            Resize Video
          </h1>
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="px-3 py-1 rounded-full border border-gray-700 bg-gray-800/50 text-xs font-medium text-gray-300">
              Local processing
            </span>
            <span className="px-3 py-1 rounded-full border border-gray-700 bg-gray-800/50 text-xs font-medium text-gray-300">
              MP4 output
            </span>
            <span className="px-3 py-1 rounded-full border border-gray-700 bg-gray-800/50 text-xs font-medium text-gray-300">
              No upload
            </span>
          </div>
          <p className="text-gray-400 max-w-2xl text-sm md:text-base">
            Change video dimensions in the browser. Pick an aspect ratio, choose a size preset, and export a resized MP4.
          </p>
        </div>

        {/* Main Content */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          {/* Left Column - Controls */}
          <div className="w-full lg:w-2/3 space-y-6">
            
            {/* Source Video */}
            <div className="bg-[#15161a] border border-gray-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-[#121316]">
                <FileVideo className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-gray-200">Source video</span>
                {videoFile && (
                  <button 
                    onClick={() => {
                      setVideoFile(null);
                      setVideoUrl(null);
                    }}
                    className="ml-auto text-xs px-3 py-1 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              
              <div className="p-4 md:p-8">
                {!videoFile ? (
                  <div className="border-2 border-dashed border-gray-700 hover:border-blue-500/50 transition-colors rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer relative bg-gray-900/20 group">
                    <input 
                      type="file" 
                      accept="video/*" 
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="w-16 h-16 rounded-full bg-gray-800 group-hover:bg-blue-500/10 flex items-center justify-center mb-4 transition-colors">
                      <Upload className="w-8 h-8 text-gray-400 group-hover:text-blue-400 transition-colors" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">Choose a file</h3>
                    <p className="text-sm text-gray-500 mb-2">Drop a file here, or click to choose one.</p>
                    <p className="text-xs text-yellow-500/80 mb-6 font-medium">For best performance, keep files under 100MB.</p>
                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 text-sm font-medium text-gray-300 transition-colors">
                      <PlaySquare className="w-4 h-4" />
                      Try sample
                    </button>
                  </div>
                ) : (
                  <div className="relative rounded-xl overflow-hidden bg-black flex items-center justify-center h-[300px] border border-gray-800">
                    <video 
                      src={videoUrl!} 
                      controls 
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Aspect Ratio */}
            <div className="bg-[#15161a] border border-gray-800 rounded-xl p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Aspect ratio</h3>
                <p className="text-xs text-gray-500">Keep original or choose a canvas.</p>
              </div>
              <select 
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="bg-[#1e1f24] border border-gray-700 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-200 focus:border-blue-500 outline-none w-full md:w-48 appearance-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
              >
                {ASPECT_RATIOS.map(ratio => (
                  <option key={ratio.value} value={ratio.value}>{ratio.label}</option>
                ))}
              </select>
            </div>

            {/* Output Size */}
            <div className="bg-[#15161a] border border-gray-800 rounded-xl p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Output size</h3>
                <p className="text-xs text-gray-500">Keep the original aspect ratio and resize height.</p>
              </div>
              <div className="flex bg-[#1e1f24] border border-gray-700 rounded-lg overflow-hidden w-full md:w-auto">
                {SIZE_PRESETS.map(preset => (
                  <button
                    key={preset.value}
                    onClick={() => setOutputSize(preset.value)}
                    className={`flex-1 md:flex-none px-4 py-2.5 text-sm font-medium transition-colors ${
                      outputSize === preset.value 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button 
              onClick={handleResize}
              disabled={!videoFile || isProcessing || !isReady}
              className={`w-full py-4 rounded-xl text-sm font-bold tracking-wide transition-all ${
                !videoFile || !isReady
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : isProcessing
                    ? 'bg-blue-600/50 text-white cursor-wait relative overflow-hidden'
                    : 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98]'
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="absolute inset-0 bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {statusText} {progress > 0 && `(${progress}%)`}
                  </span>
                </>
              ) : !isReady ? (
                "Loading Processor Core..."
              ) : (
                "Resize video"
              )}
            </button>

          </div>

          {/* Right Column - Info */}
          <div className="w-full lg:w-1/3 space-y-4">
            <div className="bg-[#15161a] border border-gray-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-[#121316]">
                <Settings className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-200">How it works</span>
              </div>
              
              <div className="p-4 md:p-6 space-y-6">
                <p className="text-sm text-gray-400 leading-relaxed">
                  Choose a video, pick the target shape and size, then the system uses a browser-native media pipeline and exports a resized MP4.
                </p>
                
                <div className="space-y-4">
                  <div className="bg-[#1a1b20] border border-gray-800 rounded-lg p-4">
                    <Lock className="w-5 h-5 text-indigo-400 mb-2" />
                    <h4 className="text-sm font-bold text-gray-200 mb-1">Local processing</h4>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      The selected video is processed locally in this browser with the MediaBunny/WebCodecs pipeline. Fast and secure.
                    </p>
                  </div>
                  
                  <div className="bg-[#1a1b20] border border-gray-800 rounded-lg p-4">
                    <Maximize className="w-5 h-5 text-blue-400 mb-2" />
                    <h4 className="text-sm font-bold text-gray-200 mb-1">Common aspect ratios</h4>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Resize for original ratio, landscape, portrait, or square outputs without quality loss on the padded edges.
                    </p>
                  </div>
                  
                  <div className="bg-[#1a1b20] border border-gray-800 rounded-lg p-4">
                    <Monitor className="w-5 h-5 text-emerald-400 mb-2" />
                    <h4 className="text-sm font-bold text-gray-200 mb-1">Simple size presets</h4>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Pick HD or Full HD targets without writing scale and pad filters by hand.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
