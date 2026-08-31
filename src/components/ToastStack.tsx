import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, RotateCcw, LogIn } from "lucide-react";
import { useUserData } from "../hooks/useUserData";

export default function ToastStack() {
  const { toasts } = useUserData();

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[300] flex flex-col gap-2 w-full max-w-[90%] md:max-w-md pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`pointer-events-auto relative overflow-hidden flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-xl border ${
              t.kind === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : t.kind === "error"
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : "bg-white/10 border-white/20 text-white/90"
            } backdrop-blur-md`}
          >
            {/* Visual timer bar representing time down to 0 */}
            <motion.div
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: (t.duration || 3000) / 1000, ease: "linear" }}
              className={`absolute bottom-0 left-0 h-0.5 ${
                t.kind === "success" ? "bg-emerald-500" : t.kind === "error" ? "bg-red-500" : "bg-white/50"
              }`}
            />
            
            <div className="flex items-center gap-2 flex-1">
              {t.kind === "success" && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              {t.kind === "error" && <AlertCircle className="w-4 h-4 shrink-0" />}
              {t.kind === "info" && <Info className="w-4 h-4 shrink-0" />}
              <p className="text-sm font-medium leading-tight">{t.msg}</p>
            </div>
            
            {t.action && (
              <button
                onClick={() => {
                  t.action?.onClick();
                }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] sm:text-[11px] font-medium uppercase tracking-wider transition-colors active:scale-95 border border-white/10"
              >
                {t.action.label === "Undo" ? (
                  <RotateCcw className="w-3 h-3" />
                ) : (
                  <LogIn className="w-3 h-3" />
                )}
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
