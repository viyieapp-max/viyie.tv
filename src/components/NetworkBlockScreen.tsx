import { useState } from "react";
import {
  ServerCrash,
  WifiOff,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  Sliders,
  HelpCircle,
  Copy,
  Check,
  ChevronDown,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface NetworkBlockScreenProps {
  isp: string;
  ip: string;
  city: string;
  country: string;
  errorTitle?: string;
  errorMsg?: string;
  onSimulateIspChange: (isp: string) => void;
  mockIsps: string[];
}

export default function NetworkBlockScreen({
  isp,
  ip,
  city,
  country,
  errorTitle = "Error 500: Database Connection Failed",
  errorMsg = "We could not establish a connection to our high-speed media database through your ISP network. Your network provider is actively restricting our secure servers.",
  onSimulateIspChange,
  mockIsps,
}: NetworkBlockScreenProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStep, setRefreshStep] = useState("");
  const [copied, setCopied] = useState(false);
  const [showSimMenu, setShowSimMenu] = useState(false);

  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    
    const steps = [
      "Analyzing gateway routing map...",
      "Pinging secure media cache servers...",
      "Resolving proxy handshakes...",
      "Verifying security handshake on ISP node...",
      "Handshake failed: Network Carrier actively restricts connection."
    ];

    let i = 0;
    setRefreshStep(steps[0]);

    const timer = setInterval(() => {
      i++;
      if (i < steps.length) {
        setRefreshStep(steps[i]);
      } else {
        clearInterval(timer);
        setIsRefreshing(false);
        setRefreshStep("");
      }
    }, 1100);
  };

  const copyDiagnostic = () => {
    const text = `Diagnostic Information:
- IP: ${ip || "Unknown"}
- ISP: ${isp || "Unknown"}
- Location: ${city || "Unknown"}, ${country || "Unknown"}
- Gateway Handshake: TIMEOUT (Error 500)
- Platform Status: SECURE_CONTAINER_OK`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[10000] min-h-screen bg-neutral-950 flex flex-col justify-between items-center text-white overflow-y-auto px-4 py-8 font-sans antialiased select-none">
      
      {/* Background ambience overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.06)_0%,transparent_70%)] pointer-events-none" />
      <div 
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"
        style={{ maskImage: "radial-gradient(ellipse at center, black, transparent)" }}
      />

      {/* Header */}
      <div className="w-full max-w-lg text-center mt-2 flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative inline-flex items-center justify-center p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl mb-4"
        >
          <ServerCrash className="w-8 h-8 text-red-500 animate-pulse" />
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border border-neutral-950"></span>
          </span>
        </motion.div>
        
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="px-3.5 py-1 bg-red-500/10 border border-red-500/30 rounded-full text-[9px] font-black uppercase tracking-widest text-red-400 mb-4 inline-flex items-center gap-1.5"
        >
          <ShieldAlert className="w-3 h-3 text-red-500" />
          500 · DATABASE CONNECTION ERROR
        </motion.div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-lg mb-8 relative z-10 flex flex-col gap-5">
        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="p-6 md:p-8 rounded-3xl bg-neutral-900/80 border border-white/5 backdrop-blur-xl shadow-2xl space-y-6"
        >
          <div className="space-y-2">
            <h1 className="text-xl md:text-2xl font-black text-center text-white/90 uppercase tracking-tight">
              {errorTitle}
            </h1>
            <p className="text-xs md:text-sm text-white/50 text-center leading-relaxed font-medium">
              {errorMsg}
            </p>
          </div>

          {/* Connected Network Badging */}
          <div className="p-4 bg-red-950/20 border border-red-500/15 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <WifiOff className="w-4 h-4 text-red-400" />
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-red-400">
                  Targeted Provider Found
                </div>
                <div className="text-xs font-medium text-white/80">
                  {isp || "Unknown Carrier"}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-black px-2.5 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30 uppercase tracking-widest">
              BLOCKED
            </span>
          </div>

          {/* Tech Spec Inspector Box */}
          <div className="bg-black/60 border border-white/5 rounded-2xl p-4.5 space-y-3.5 relative overflow-hidden font-mono">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Network Diagnostics
              </span>
              <button
                onClick={copyDiagnostic}
                className="p-1 px-2 rounded hover:bg-white/5 text-white/40 hover:text-white transition-all text-[9px] font-black uppercase flex items-center gap-1 cursor-pointer"
                title="Copy log to clipboard"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-y-3 text-[11px] font-medium text-white/80 pt-1">
              <div>
                <span className="text-white/30 block text-[9px] font-medium uppercase tracking-wider">Client IPv4 Address</span>
                <span className="text-red-400 font-medium">{ip || "0.0.0.0"}</span>
              </div>
              <div>
                <span className="text-white/30 block text-[9px] font-medium uppercase tracking-wider">Carrier ISP</span>
                <span className="text-white font-medium truncate block">{isp || "Indemnity Net"}</span>
              </div>
              <div>
                <span className="text-white/30 block text-[9px] font-medium uppercase tracking-wider">Origin Location</span>
                <span className="text-white font-medium">{city || "Unknown City"}, {country || "ID"}</span>
              </div>
              <div>
                <span className="text-white/30 block text-[9px] font-medium uppercase tracking-wider">Gateway Status</span>
                <span className="text-red-500 font-black animate-pulse flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> FAILED (500)
                </span>
              </div>
            </div>
          </div>

          {/* Troubleshoot Recommendations */}
          <div className="space-y-3 pt-1">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-1.5 pl-0.5">
              <HelpCircle className="w-3.5 h-3.5 text-white/30" /> How to Bypass this Restriction:
            </h3>

            <div className="space-y-2">
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex gap-3 text-left">
                <div className="bg-red-500/10 w-6 h-6 rounded-lg text-[10px] font-black text-red-400 flex items-center justify-center shrink-0 mt-0.5 border border-red-500/20">
                  1
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-white/90">Turn on a VPN Client</div>
                  <p className="text-[10.5px] text-white/40 leading-relaxed">
                    Activate any virtual network like <strong>Cloudflare WARP</strong>, ProtonVPN, or NordVPN to bypass your ISP carrier filter.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex gap-3 text-left">
                <div className="bg-red-500/10 w-6 h-6 rounded-lg text-[10px] font-black text-red-400 flex items-center justify-center shrink-0 mt-0.5 border border-red-500/20">
                  2
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-white/90">Change DNS Settings of Device</div>
                  <p className="text-[10.5px] text-white/40 leading-relaxed">
                    Set primary DNS to <code>1.1.1.1</code> (Cloudflare) or <code>8.8.8.8</code> (Google Secure) to solve routing blackouts.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex gap-3 text-left">
                <div className="bg-red-500/10 w-6 h-6 rounded-lg text-[10px] font-black text-red-400 flex items-center justify-center shrink-0 mt-0.5 border border-red-500/20">
                  3
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-white/90">Switch Carrier Connections</div>
                  <p className="text-[10.5px] text-white/40 leading-relaxed">
                    Telkom, Indihome, and Indosat are highly secure and censored. Consider switching to other providers (Biznet, XL, MyRepublic) or mobile tethering.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="space-y-2 pt-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full text-center py-3 bg-red-600 hover:bg-red-500 active:scale-[0.99] hover:shadow-[0_0_20px_rgba(239,68,68,0.35)] rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-red-500/30"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Re-Evaluating Route..." : "Check Connection Integrity"}
            </button>
            <p className="text-[10px] text-center text-white/30 font-medium">
              We periodically check handshakes. System will restore automatically when route is free.
            </p>
          </div>

          <AnimatePresence>
            {isRefreshing && refreshStep && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="p-3.5 bg-neutral-950 border border-white/5 rounded-xl font-mono text-[10.5px] text-red-400/90 text-center flex items-center justify-center gap-2.5 animate-pulse"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping shrink-0" />
                {refreshStep}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ADMIN TESTING OPTION */}
        <div className="mt-2 text-center flex flex-col items-center">
          <button
            onClick={() => setShowSimMenu(!showSimMenu)}
            className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white/70 transition-colors flex items-center gap-1 p-2 bg-neutral-900/40 border border-white/5 rounded-xl cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            🔧 Admin Simulation: Change Mock Network
            <ChevronDown className={`w-3 h-3 transition-transform ${showSimMenu ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {showSimMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-2.5 p-3.5 bg-neutral-900 border border-white/10 rounded-2xl max-w-sm w-full flex flex-col gap-2 shadow-2xl text-left"
              >
                <div className="text-[9px] font-black text-white/40 uppercase tracking-wider pb-1 flex items-center gap-1 border-b border-white/5">
                  <Info className="w-3 h-3 text-red-500" />
                  Test custom block screen logic
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {mockIsps.map((mockName) => (
                    <button
                      key={mockName}
                      onClick={() => {
                        onSimulateIspChange(mockName);
                        setShowSimMenu(false);
                      }}
                      className={`text-[10px] py-2 px-3 rounded-xl transition-all font-medium text-left cursor-pointer border ${
                        isp === mockName
                          ? "bg-red-500/10 text-red-400 border-red-500/30"
                          : "bg-white/5 text-white/60 border-transparent hover:bg-white/10"
                      }`}
                    >
                      {mockName}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      onSimulateIspChange("Biznet Networks");
                      setShowSimMenu(false);
                    }}
                    className={`text-[10px] py-2 px-3 rounded-xl transition-all font-medium text-left cursor-pointer border ${
                      isp === "Biznet Networks" || isp === "Biznet" || (!mockIsps.includes(isp) && isp !== "Unknown ISP" && isp !== "")
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-white/5 text-white/50 border-transparent hover:bg-white/10"
                    }`}
                  >
                    Biznet (Allowed)
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-lg text-center mt-auto pt-4 text-[10px] font-medium text-white/20 tracking-wider">
        IDLIX ROUTING DELEGATE GATEWAY · ALL RIGHTS RESERVED
      </div>
    </div>
  );
}
