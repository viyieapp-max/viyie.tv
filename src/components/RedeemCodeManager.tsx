import { useState, useEffect } from "react";
import { collection, query, getDocs, setDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Copy, Plus, Trash2, Check, RefreshCw } from "lucide-react";
import { useUserData } from "../hooks/useUserData";
import { motion, AnimatePresence } from "framer-motion";

export function RedeemCodeManager() {
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isCopied, setIsCopied] = useState<string | null>(null);
  const { toast } = useUserData();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [newCodeData, setNewCodeData] = useState({
    code: "",
    maxUses: 1,
    durationDays: 30,
    codeExpirationDays: 7,
    type: "redeem" as "redeem" | "link",
  });

  const fetchCodes = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "redeem_codes")));
      const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      // Sort newest first based on createdAt
      data.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      setCodes(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  const generateRandomCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let autoCode = "VIYIE-";
    for (let i = 0; i < 8; i++) {
      autoCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewCodeData((prev) => ({ ...prev, code: autoCode }));
  };

  const handleCreate = async () => {
    if (!newCodeData.code.trim()) {
      toast("Code cannot be empty", "error");
      return;
    }
    try {
      const id = doc(collection(db, "redeem_codes")).id;
      
      const expiresAtDate = new Date();
      if (newCodeData.codeExpirationDays > 0) {
         expiresAtDate.setDate(expiresAtDate.getDate() + Number(newCodeData.codeExpirationDays));
      }
      
      const dataToSave = {
        id,
        code: newCodeData.type === "link" ? newCodeData.code.trim() : newCodeData.code.trim().toUpperCase(),
        maxUses: Number(newCodeData.maxUses),
        uses: 0,
        durationDays: Number(newCodeData.durationDays),
        expiresAt: newCodeData.codeExpirationDays > 0 ? expiresAtDate : null,
        createdAt: new Date(),
        type: newCodeData.type,
      };
      await setDoc(doc(db, "redeem_codes", id), dataToSave);
      setShowModal(false);
      setNewCodeData({ code: "", maxUses: 1, durationDays: 30, codeExpirationDays: 7, type: "redeem" });
      fetchCodes();
      toast("Code created successfully", "success");
    } catch (e) {
      console.error(e);
      toast("Failed to create code", "error");
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(id);
  };

  const performDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "redeem_codes", id));
      fetchCodes();
      toast("Code deleted", "success");
    } catch (e) {
      console.error(e);
      toast("Failed to delete code", "error");
    }
    setConfirmDeleteId(null);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(text);
    setTimeout(() => setIsCopied(null), 2000);
  };

  const getShareLink = (code: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/?redeem=${code}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
          Redeem Codes & Links
        </h3>
        <button
          onClick={() => {
            setNewCodeData({ code: "", maxUses: 1, durationDays: 30, codeExpirationDays: 7, type: "redeem" });
            generateRandomCode();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium text-sm transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]"
        >
          <Plus className="w-4 h-4" /> Create New
        </button>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden p-1">
        {loading ? (
          <div className="py-12 flex justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-white/50" />
          </div>
        ) : codes.length > 0 ? (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/40 text-[10px] uppercase font-black tracking-widest text-white/40">
                  <th className="p-4 rounded-tl-xl">Code / Link</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Uses</th>
                  <th className="p-4">Duration (Days)</th>
                  <th className="p-4 text-right rounded-tr-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {codes.map((c) => (
                  <tr key={c.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-mono text-sm text-white/90">
                      {c.type === "link" ? (
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[200px]">{getShareLink(c.code)}</span>
                          <button onClick={() => handleCopy(getShareLink(c.code))} className="text-white/40 hover:text-white transition">
                            {isCopied === getShareLink(c.code) ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-red-400 font-medium tracking-wider">{c.code}</span>
                          <button onClick={() => handleCopy(c.code)} className="text-white/40 hover:text-white transition">
                            {isCopied === c.code ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`text-[10px] font-medium uppercase tracking-widest px-2 py-1 rounded-md border ${c.type === "link" ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                        {c.type === "link" ? "Share Link" : "Redeem"}
                      </span>
                    </td>
                    <td className="p-4 text-xs font-medium text-white/70">
                      {c.uses} / {c.maxUses === 0 ? "Unlimited" : c.maxUses}
                    </td>
                    <td className="p-4 text-xs font-medium text-white/70">
                      {c.durationDays === 0 ? "Unlimited" : `${c.durationDays} Days`}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-2 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 opacity-50">
            <span className="text-[10px] font-black uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full border border-white/10">No Codes Yet</span>
            <p className="text-xs text-white/40">Create a code or link auto-viyie+ to start sharing.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 w-full max-w-md rounded-2xl shadow-2xl p-6">
            <h4 className="text-lg font-black uppercase mb-4 tracking-tight">Create New Access</h4>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block mb-1.5">Type</label>
                <div className="flex items-center gap-2">
                  <button
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${newCodeData.type === "redeem" ? "bg-red-600 text-white" : "bg-white/5 text-white/40 hover:bg-white/10"}`}
                    onClick={() => {
                        setNewCodeData((p) => ({ ...p, type: "redeem" }));
                        generateRandomCode();
                    }}
                  >
                    Redeem Code
                  </button>
                  <button
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${newCodeData.type === "link" ? "bg-blue-600 text-white" : "bg-white/5 text-white/40 hover:bg-white/10"}`}
                    onClick={() => {
                        setNewCodeData((p) => ({ ...p, type: "link" }));
                        generateRandomCode();
                    }}
                  >
                    Share Link
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block mb-1.5 pt-2">
                  {newCodeData.type === "redeem" ? "Code" : "Link Token (Auto)"}
                </label>
                <div className="flex gap-2">
                  <input
                    value={newCodeData.code}
                    onChange={(e) => setNewCodeData((p) => ({ ...p, code: e.target.value }))}
                    disabled={newCodeData.type === "link"}
                    className="flex-1 h-10 bg-black/40 border border-white/10 rounded-lg px-3 text-sm text-white font-mono uppercase focus:border-red-500/50 outline-none disabled:opacity-50"
                  />
                  {newCodeData.type === "redeem" && (
                    <button onClick={generateRandomCode} className="px-3 bg-white/10 hover:bg-white/20 rounded-lg text-white/60 hover:text-white transition-all text-[10px] font-black uppercase">
                      Random
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block mb-1.5">
                    Max Uses <span className="text-red-400 normal-case">(0=Unli)</span>
                  </label>
                  <input
                    type="number"
                    value={newCodeData.maxUses}
                    onChange={(e) => setNewCodeData((p) => ({ ...p, maxUses: Number(e.target.value) }))}
                    className="w-full h-10 bg-black/40 border border-white/10 rounded-lg px-3 text-sm text-white outline-none focus:border-red-500/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block mb-1.5">
                    Duration Days <span className="text-red-400 normal-case">(0=Unli)</span>
                  </label>
                  <input
                    type="number"
                    value={newCodeData.durationDays}
                    onChange={(e) => setNewCodeData((p) => ({ ...p, durationDays: Number(e.target.value) }))}
                    className="w-full h-10 bg-black/40 border border-white/10 rounded-lg px-3 text-sm text-white outline-none focus:border-red-500/50"
                  />
                </div>
              </div>
              <div className="pt-2">
                 <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block mb-1.5">
                    Code Expiration Days <span className="text-red-400 normal-case">(0=Never Expire)</span>
                  </label>
                  <input
                    type="number"
                    value={newCodeData.codeExpirationDays}
                    onChange={(e) => setNewCodeData((p) => ({ ...p, codeExpirationDays: Number(e.target.value) }))}
                    className="w-full h-10 bg-black/40 border border-white/10 rounded-lg px-3 text-sm text-white outline-none focus:border-red-500/50"
                  />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-8">
              <button onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-lg text-xs font-medium text-white/50 hover:text-white hover:bg-white/5 transition-all">
                Cancel
              </button>
              <button onClick={handleCreate} className="px-5 py-2.5 rounded-lg text-xs font-medium bg-green-600 hover:bg-green-500 text-white transition-all shadow-[0_0_15px_rgba(22,163,74,0.3)]">
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmDeleteId && (
          <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#111] border border-red-500/20 w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <h4 className="text-lg font-medium text-white mb-2">Delete Code?</h4>
              <p className="text-sm text-white/50 mb-6">Are you sure you want to delete this code? This action cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => performDelete(confirmDeleteId)}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium text-sm rounded-xl transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
