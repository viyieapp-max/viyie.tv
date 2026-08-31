import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, X, ChevronRight, Loader2, User, Lock } from "lucide-react";
import { BRAND_LOGO_URL, BRAND_NAME } from "../constants/brand";
import { useSettings } from "../hooks/useSettings";

interface Props {
  onSuccess: (token: string) => void;
  onBack: () => void;
}

export default function AdminLogin({ onSuccess, onBack }: Props) {
  const { settings } = useSettings();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (data.success) {
        onSuccess(data.token);
      } else {
        setError(data.message || "Login failed");
      }
    } catch (err) {
      setError("Server connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#070404] flex flex-col items-center justify-center p-6 sm:p-12 overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-600/10 blur-[120px] rounded-full pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <button
          onClick={onBack}
          className="absolute -top-12 left-0 flex items-center gap-2 text-white/40 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
          <span className="font-medium text-sm">Cancel</span>
        </button>

        <div className="text-center mb-10">
          <img src={settings?.brandLogo || BRAND_LOGO_URL} alt={BRAND_NAME} className="h-10 mx-auto mb-6" />
          <h1 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Restricted Access</h1>
          <p className="text-white/40 text-sm font-medium">Verify your identity to access the systems control panel.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="px-4 py-3 bg-red-600/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm"
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}

          <div className="relative group">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-red-400 transition-colors" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              required
              className="w-full h-14 pl-12 pr-4 bg-white/[0.03] border border-white/5 rounded-2xl text-white placeholder:text-white/20 focus:outline-none focus:border-red-500/50 focus:bg-white/[0.05] transition-all"
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-red-400 transition-colors" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full h-14 pl-12 pr-4 bg-white/[0.03] border border-white/5 rounded-2xl text-white placeholder:text-white/20 focus:outline-none focus:border-red-500/50 focus:bg-white/[0.05] transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-red-600 hover:bg-red-700 disabled:bg-red-900/50 disabled:cursor-not-allowed text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-red-900/20 flex items-center justify-center gap-2 transition-all active:scale-95 group mt-4"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Continue Session
                <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[10px] text-white/20 font-medium uppercase tracking-widest">
            System Security Protocol Active 
          </p>
        </div>
      </motion.div>
    </div>
  );
}
