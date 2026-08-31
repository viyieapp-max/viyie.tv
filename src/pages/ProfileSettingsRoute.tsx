import { useState, useEffect } from "react";
import { 
  ChevronLeft, ChevronRight, User, Mail, Shield, 
  Settings, Key, Smartphone, Bell, 
  Trash2, LogOut, Check, Gift, X, Sparkles
} from "lucide-react";
import { collection, query, getDocs, doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useUserData } from "../hooks/useUserData";
import { useSettings } from "../hooks/useSettings";
import { BRAND_LOGO_URL } from "../constants/brand";

interface Props {
  onBack: () => void;
}

export function ProfileSettingsRoute({ onBack }: Props) {
  const { settings } = useSettings();
  const { user, signOut } = useUserData();
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemMessage, setRedeemMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("redeem");
    if (code) {
      // Keep only standard alphanumeric characters, dashes, and underscores to prevent injection attacks
      const sanitized = code.replace(/[^a-zA-Z0-9_-]/g, "");
      setRedeemCode(sanitized);
      setShowRedeemModal(true);
      // Clean up URL without refreshing the page
      window.history.replaceState({}, "", "/profile/settings");
    }
  }, []);

  const handleRedeem = async () => {
    if (!redeemCode.trim() || !user?.uid) return;
    setRedeemLoading(true);
    setRedeemMessage("");
    
    try {
      const snap = await getDocs(query(collection(db, "redeem_codes")));
      const codes = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const codeData = codes.find(c => c.code === redeemCode.trim().toUpperCase());
      
      if (!codeData) {
        setRedeemMessage("Invalid code.");
        setRedeemLoading(false);
        return;
      }
      
      if (codeData.maxUses > 0 && codeData.uses >= codeData.maxUses) {
        setRedeemMessage("Code has reached its usage limit.");
        setRedeemLoading(false);
        return;
      }
      
      if (codeData.expiresAt) {
         const isExpired = Date.now() > codeData.expiresAt.toMillis();
         if (isExpired) {
            setRedeemMessage("This code has expired.");
            setRedeemLoading(false);
            return;
         }
      }

      // Record use
      await updateDoc(doc(db, "redeem_codes", codeData.id), {
        uses: increment(1)
      });
      
      // Update User to Viyie+
      let newTiers = user?.tiers || [user?.tier || "regular"];
      if (!newTiers.includes("viyie_plus")) {
         newTiers.push("viyie_plus");
      }
      
      await updateDoc(doc(db, "users", user.uid), {
         tiers: newTiers,
         tier: newTiers[0]
      });

      setRedeemMessage("Successfully redeemed Viyie+! Please refresh to see changes.");
    } catch (e) {
      console.error(e);
      setRedeemMessage("An error occurred during redemption.");
    }
    setRedeemLoading(false);
  };

  if (!user) return null;

  const name = user?.name || "";
  const username = user?.username || "";

  return (
    <div className="min-h-screen bg-[#070404] text-white selection:bg-red-500/30">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-red-900/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-12 lg:py-20">
        <div className="flex items-center justify-between mb-12">
          <button
            onClick={onBack}
            className="group flex items-center gap-3 text-white/50 hover:text-white transition-all shadow-none"
          >
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-white/10 group-active:scale-90 transition-all">
              <ChevronLeft className="w-5 h-5" />
            </div>
            <span className="font-black uppercase tracking-widest text-[10px]">Back</span>
          </button>
          
          <img src={settings?.brandLogo || BRAND_LOGO_URL} alt="Logo" className="h-6 opacity-40 shrink-0" />
        </div>

        <div className="grid lg:grid-cols-[1fr_300px] gap-12">
          <div className="space-y-10">
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-red-600/20 flex items-center justify-center border border-red-500/20">
                  <User className="w-4 h-4 text-red-400" />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tighter">Profile Information</h2>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-widest px-1">Display Name</label>
                  <div className="relative opacity-60">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <input 
                      type="text" 
                      value={name} 
                      disabled
                      placeholder="Display Name"
                      className="w-full h-14 pl-12 pr-4 bg-white/[0.02] border border-white/5 rounded-2xl text-white cursor-not-allowed transition-all text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-widest px-1">Username (@)</label>
                  <div className="relative opacity-60">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-medium text-white/20">@</span>
                    <input 
                      type="text" 
                      value={username.startsWith("@") ? username.slice(1) : username} 
                      disabled
                      placeholder="username"
                      className="w-full h-14 pl-10 pr-4 bg-white/[0.02] border border-white/5 rounded-2xl text-white cursor-not-allowed transition-all text-sm"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-widest px-1">Email Address</label>
                  <div className="relative opacity-60">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <input 
                      type="email" 
                      defaultValue={user.email} 
                      disabled
                      className="w-full h-14 pl-12 pr-4 bg-white/[0.02] border border-white/5 rounded-2xl text-white cursor-not-allowed text-sm"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-orange-600/20 flex items-center justify-center border border-orange-500/20">
                  <Shield className="w-4 h-4 text-orange-400" />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tighter">Account Security</h2>
              </div>
              
              <div className="space-y-4">
                <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 flex items-center justify-between group hover:bg-white/[0.05] transition-all cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                      <Key className="w-5 h-5 text-white/60" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Change Password</h4>
                      <p className="text-xs text-white/40">Last updated 3 months ago</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/20" />
                </div>

                <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 flex items-center justify-between group hover:bg-white/[0.05] transition-all cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                      <Smartphone className="w-5 h-5 text-white/60" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Two-Factor Authentication</h4>
                      <p className="text-xs text-green-500/70 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Enabled
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/20" />
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center border border-blue-500/20">
                  <Key className="w-4 h-4 text-blue-400" />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tighter">Workspace Integrations</h2>
              </div>
              
              <div className="space-y-4">
                <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 flex items-center justify-between group transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                      <div className="text-xl">💬</div>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Google Chat</h4>
                      <p className="text-xs text-green-500/70 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Connected
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 flex items-center justify-between group transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                      <div className="text-xl">📅</div>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Google Calendar</h4>
                      <p className="text-xs text-green-500/70 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Connected
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 flex items-center justify-between group transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                      <div className="text-xl">📧</div>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Gmail</h4>
                      <p className="text-xs text-green-500/70 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Connected
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

          </div>

          <div className="space-y-6 lg:border-l lg:border-white/5 lg:pl-12">
            <div className="p-8 rounded-[40px] bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              </div>
              <div className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-red-500/20 p-1">
                <img src={user.picture || undefined} alt={user.name} className="w-full h-full rounded-full object-cover" />
              </div>
              <h3 className="text-lg font-black tracking-tight">{user.name}</h3>
              <p className="text-xs text-white/40 mb-6 font-medium">{user.email}</p>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full text-[10px] font-black uppercase tracking-widest text-white/60">
                Premium Account
              </div>
            </div>

            <div className="space-y-2">
              <button className="w-full h-12 rounded-xl flex items-center gap-3 px-4 text-white/60 hover:text-white hover:bg-white/5 font-medium transition-all text-sm group">
                <Bell className="w-4 h-4 text-blue-400" />
                Notifications
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500" />
              </button>
              <button className="w-full h-12 rounded-xl flex items-center gap-3 px-4 text-white/60 hover:text-white hover:bg-white/5 font-medium transition-all text-sm group">
                <Settings className="w-4 h-4 text-purple-400" />
                App Preferences
              </button>
              <button 
                onClick={() => setShowRedeemModal(true)}
                className="w-full h-12 rounded-xl flex items-center gap-3 px-4 text-white/60 hover:text-white hover:bg-white/5 font-medium transition-all text-sm group"
              >
                <Gift className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                Redeem Code
              </button>
              <button 
                onClick={signOut}
                className="w-full h-12 rounded-xl flex items-center gap-3 px-4 text-red-400/60 hover:text-red-400 hover:bg-red-950/20 font-medium transition-all text-sm group"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>

            <div className="pt-6">
              <button className="w-full flex items-center justify-center gap-2 group">
                <Trash2 className="w-4 h-4 text-red-900 group-hover:text-red-600 transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest text-red-900 group-hover:text-red-600 transition-colors">Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* REDEEM MODAL */}
      {showRedeemModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 w-full max-w-sm rounded-3xl shadow-2xl p-8 relative">
            <button 
              onClick={() => setShowRedeemModal(false)}
              className="absolute top-4 right-4 p-2 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-all"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Gift className="w-8 h-8 text-emerald-400" />
              </div>
            </div>
            <h4 className="text-xl font-black uppercase text-center tracking-tight mb-2">Redeem Code</h4>
            <p className="text-xs text-white/50 text-center mb-8">Enter your Viyie+ token or share link code below to activate premium features.</p>
            
            <div className="space-y-4">
              <input
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value)}
                placeholder="ENTER CODE..."
                className="w-full h-12 bg-black/50 border border-white/10 rounded-xl px-4 text-center text-sm font-mono uppercase focus:border-red-500 text-white outline-none"
              />
              {redeemMessage && (
                <div className={`text-[10px] uppercase font-black tracking-widest text-center px-4 py-2 flex items-center justify-center gap-2 rounded-lg border ${redeemMessage.toLowerCase().includes("success") ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}`}>
                   {redeemMessage.toLowerCase().includes("success") && <Sparkles className="w-3.5 h-3.5" />}
                   {redeemMessage}
                </div>
              )}
              <button 
                onClick={handleRedeem}
                disabled={redeemLoading || !redeemCode.trim()}
                className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest text-xs transition-all disabled:opacity-50 flex items-center justify-center shadow-lg shadow-red-900/20"
              >
                {redeemLoading ? "Redeeming..." : "Redeem Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
