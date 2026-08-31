import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  Check, 
  X, 
  Sparkles, 
  Crown, 
  BadgeCheck 
} from "lucide-react";
import { useUserData } from "../hooks/useUserData";

interface PlanOption {
  id: string;
  duration: string;
  price: string;
  originalPrice?: string;
  desc: string;
  badge?: string;
}

export function ViyieSubscription({ onBack }: { onBack: () => void }) {
  const { user, updateProfile, toast } = useUserData();

  const isViyiePlus = (user?.tiers || [user?.tier || "regular"]).includes("viyie_plus");

  // Plan list
  const plans: PlanOption[] = [
    {
      id: "1month",
      duration: "1 Month",
      price: "Rp 26.000",
      desc: "Perfect to try Viyie+ features",
    },
    {
      id: "3months",
      duration: "3 Months",
      price: "Rp 72.000",
      desc: "Warm up with premium content",
      badge: "Popular"
    },
    {
      id: "6months",
      duration: "6 Months",
      price: "Rp 126.000",
      desc: "Stream with high quality audio",
    },
    {
      id: "1year",
      duration: "1 Year",
      price: "Rp 199.000",
      originalPrice: "Rp 220.000",
      desc: "Best Value Plan - 10% Discount",
      badge: "Save 10%"
    }
  ];

  const [selectedPlanId, setSelectedPlanId] = useState<string>("1year");
  const [showDemoModal, setShowDemoModal] = useState(false);

  const activePlan = plans.find(p => p.id === selectedPlanId) || plans[3];

  const handleSubscribe = async () => {
    if (!user) {
      toast("Please sign in first to subscribe!", "error");
      return;
    }
    
    setShowDemoModal(true);
  };

  const handleCancelSubscription = async () => {
    if (!user) return;
    try {
      // Revert to normal
      const nextTiers = (user.tiers || ["regular"]).filter(t => t !== "viyie_plus");
      await updateProfile({
        tier: "regular",
        tiers: nextTiers.length > 0 ? nextTiers : ["regular"],
        badgeTitle: undefined
      });
      toast("Viyie+ subscription deactivated successfully.", "info");
    } catch (err) {
      toast("Failed to deactivate", "error");
    }
  };

  return (
    <div className="min-h-screen bg-[#070404] text-white">
      {/* Dynamic Background Design elements */}
      <div className="absolute top-0 inset-x-0 h-[400px] bg-gradient-to-b from-red-600/10 via-amber-500/5 to-transparent pointer-events-none" />

      {/* Main Content Area */}
      <div className="max-w-5xl mx-auto px-4 py-8 relative z-10">
        
        {/* Header bar */}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={onBack} 
            className="group flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-xs font-medium uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Go Back</span>
          </button>
          
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] text-white/50 tracking-wider">
            <span>PLATFORM:</span>
            <span className="font-extrabold text-[#f59e0b] animate-pulse">VIYIE / 维耶</span>
          </div>
        </div>

        {/* Title and Badge */}
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-gradient-to-r from-red-600/15 via-red-500/10 to-amber-500/15 border border-red-500/30 backdrop-blur-md shadow-[0_0_20px_rgba(239,68,68,0.15)]"
          >
            <Crown className="w-4 h-4 text-[#ffe100]" />
            <span className="text-[10px] uppercase font-black tracking-widest text-[#ffe100] animate-gold-shine">Exclusive Streaming Tier</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-black tracking-tight"
          >
            Choose Your <span className="bg-gradient-to-r from-red-500 via-amber-500 to-yellow-500 bg-clip-text text-transparent">Power Plan</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-white/60 text-sm leading-relaxed"
          >
            Elevate your cinematic journey on Viyie streaming with ad-free runs, premium server feeds, customizable GIF backgrounds, and increased boundaries.
          </motion.p>
        </div>

        {/* Active plan ribbon if premium */}
        {isViyiePlus && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-extrabold shadow-inner shrink-0">
                <Crown className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                  Your Account Status: <span className="text-yellow-400 font-black tracking-widest animate-gold-shine uppercase">Viyie+ Active ({activePlan.duration})</span>
                </h4>
                <p className="text-[11px] text-white/50">You have fully unlocked the 40 limit, custom moving GIF backdrops, commentaries glow, and ad-free access.</p>
              </div>
            </div>
            <button 
              onClick={handleCancelSubscription}
              className="px-3 py-1.5 rounded-lg bg-black/40 hover:bg-red-950/40 border border-white/15 text-white/40 hover:text-red-400 hover:border-red-500/30 text-[10px] font-medium uppercase tracking-wider transition-all shadow-md shrink-0"
            >
              Downgrade (Demo Reset)
            </button>
          </motion.div>
        )}

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch mb-16">
          
          {/* Card 1: Regular Free */}
          <motion.div 
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="relative rounded-3xl bg-[#100808]/90 border border-white/5 p-8 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white/90">Regular Plan</h3>
                <span className="text-[9px] font-black tracking-widest uppercase text-white/30 bg-white/5 px-2.5 py-1 rounded-full">Standard</span>
              </div>
              
              <div className="mb-6">
                <div className="text-3xl font-black text-white">Free</div>
                <div className="text-[10px] text-white/35 mt-1">Default access for all members</div>
              </div>

              <div className="h-px bg-white/5 w-full mb-6" />

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50">
                    <Check className="w-3 h-3" />
                  </div>
                  <div>
                    <span className="text-xs text-white/70 block font-medium">Watches on All Devices</span>
                    <span className="text-[10px] text-white/40">Enjoy standard streaming across your screens</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50">
                    <Check className="w-3 h-3" />
                  </div>
                  <div>
                    <span className="text-xs text-white/70 block font-medium">10 Watch List Limit</span>
                    <span className="text-[10px] text-white/40">Maintain up to 10 streaming contents in queue.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50">
                    <Check className="w-3 h-3" />
                  </div>
                  <div>
                    <span className="text-xs text-white/70 block font-medium">10 Favorites Limit</span>
                    <span className="text-[10px] text-white/40">Save up to 10 favorite contents.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50">
                    <Check className="w-3 h-3" />
                  </div>
                  <div>
                    <span className="text-xs text-white/70 block font-medium">10 History Limit (Sync to Continue Watching)</span>
                    <span className="text-[10px] text-white/40">Stores up to 10 history records and displays top 10 on Continue Watching.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50">
                    <Check className="w-3 h-3" />
                  </div>
                  <div>
                    <span className="text-xs text-white/70 block font-medium">Change Backdrop Image</span>
                    <span className="text-[10px] text-white/40">Customize your profile background using direct static image URLs</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-red-500">
                    <X className="w-3 h-3" />
                  </div>
                  <div>
                    <span className="text-xs text-white/40 block line-through">JPEG / GIF Moving Backdrops</span>
                    <span className="text-[10px] text-white/30">Requires Viyie+ Diamond Sub</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-red-500">
                    <X className="w-3 h-3" />
                  </div>
                  <div>
                    <span className="text-xs text-white/40 block line-through">Ad-Free Pop-ups & Banners</span>
                    <span className="text-[10px] text-white/30">Exposed to promotional advertisements</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12">
              <button 
                disabled 
                className="w-full text-center py-3 bg-white/5 border border-white/10 rounded-xl text-white/45 text-xs font-medium uppercase tracking-wider"
              >
                {isViyiePlus ? "Regular Inactive" : "Active Standard Plan"}
              </button>
            </div>
          </motion.div>

          {/* Card 2: Viyie+ Premium - warna kuning viyie+nya, grid 4x1 di dalam */}
          <motion.div 
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }}
            className="relative rounded-3xl bg-gradient-to-b from-[#181102] to-[#0f0a02] border-2 border-[#f59e0b]/50 p-8 flex flex-col justify-between shadow-[0_0_35px_rgba(245,158,11,0.12)] origin-center hover:scale-[1.01] transition-transform duration-300"
          >
            {/* Spotlight shimmer */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-yellow-500/20 to-transparent blur-xl pointer-events-none rounded-full" />
            
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#f59e0b]" />
                  <h3 className="text-xl font-black text-[#f59e0b] tracking-wider uppercase animate-gold-shine">Viyie+ Premium</h3>
                </div>
                <span className="text-[9px] font-black tracking-widest uppercase text-[#0a0505] bg-[#f59e0b] px-3 py-1 rounded-full animate-pulse shadow-md shadow-yellow-600/20">VIP Sub</span>
              </div>

              {/* Grid 4x1 list of duration plans inside card */}
              <div className="mb-6 mt-6 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-[#f59e0b]/60 mb-2">Select Duration Plan</div>
                <div className="grid grid-cols-1 gap-2">
                  {plans.map((p) => {
                    const isSelected = selectedPlanId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPlanId(p.id)}
                        className={`text-left p-3.5 rounded-xl border transition-all relative flex items-center justify-between gap-3 ${
                          isSelected 
                            ? "bg-[#2c1f06] border-[#f59e0b] shadow-[0_4px_15px_rgba(245,158,11,0.15)]" 
                            : "bg-black/55 border-white/5 hover:border-white/25 hover:bg-[#1a1204]/40"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Circle check selector */}
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected 
                              ? "bg-[#f59e0b] border-[#f59e0b]" 
                              : "border-white/30"
                          }`}>
                            {isSelected && <Check className="w-2.5 h-2.5 text-[#0f0a02] stroke-[3]" />}
                          </div>
                          <div>
                            <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                              {p.duration}
                              {p.badge && (
                                <span className="text-[8px] font-black uppercase tracking-widest text-black bg-gradient-to-r from-yellow-400 to-amber-500 px-1.5 py-0.5 rounded-md leading-none scale-85">
                                  {p.badge}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-white/50">{p.desc}</div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          {p.originalPrice && (
                            <div className="text-[10px] text-white/30 line-through leading-tight">
                              {p.originalPrice}
                            </div>
                          )}
                          <div className={`text-sm font-black ${isSelected ? "text-[#f59e0b]" : "text-white/80"}`}>
                            {p.price}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="h-px bg-white/5 w-full mb-6" />

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-[#f59e0b]/20 flex items-center justify-center text-[#f59e0b]">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-xs text-white block font-medium">Ad-Free Pop-ups & Banners</span>
                    <span className="text-[10px] text-[#f59e0b]/70">Browse without any obstructive pop-up links or content banners</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-[#f59e0b]/20 flex items-center justify-center text-[#f59e0b]">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-xs text-white block font-medium flex items-center gap-1.5">
                      Ad-Free Web Experience & Reduced Stream Ads
                      <span className="text-[8px] bg-yellow-600/20 border border-yellow-500/30 text-yellow-500 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-widest leading-none">Clean Space</span>
                    </span>
                    <span className="text-[10px] text-[#f59e0b]/70 block">
                      All of our own platform ads are completely removed. We minimize third-party player ads on select streaming servers.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-[#f59e0b]/20 flex items-center justify-center text-[#f59e0b]">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-xs text-white block font-medium">40 Watch List Limit</span>
                    <span className="text-[10px] text-[#f59e0b]/70">Maintain up to 40 streaming contents on queue.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-[#f59e0b]/20 flex items-center justify-center text-[#f59e0b]">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-xs text-white block font-medium">40 Favorites Limit (400% Capacity)</span>
                    <span className="text-[10px] text-[#f59e0b]/70">Save up to 40 favorite contents.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-[#f59e0b]/20 flex items-center justify-center text-[#f59e0b]">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-xs text-white block font-medium">40 History Limit (Sync to Continue Watching)</span>
                    <span className="text-[10px] text-[#f59e0b]/70">Stores up to 40 history records and displays top 10 on Continue Watching.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-[#f59e0b]/20 flex items-center justify-center text-[#f59e0b]">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-xs text-white block font-medium">Change Backdrop with Images & GIFs</span>
                    <span className="text-[10px] text-[#f59e0b]/70">Unlock live glowing profile backgrounds, including moving GIFs</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-[#f59e0b]/20 flex items-center justify-center text-[#f59e0b]">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-xs text-white block font-medium flex items-center gap-1.5">
                      Viyie+ Badge in Profile & Comments
                      <span className="text-[8px] bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-extrabold px-1 rounded uppercase tracking-wider">Unlocks Glow</span>
                    </span>
                    <span className="text-[10px] text-[#f59e0b]/70">Shine brilliantly under reviews with custom VIP tags</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-[#f59e0b]/20 flex items-center justify-center text-[#f59e0b]">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-xs text-white block font-medium">Support the Viyie / 维耶 Platform</span>
                    <span className="text-[10px] text-[#f59e0b]/70">Directly contribute to keeping servers running fast and functional</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12">
              <button 
                onClick={handleSubscribe}
                className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-[#ffe100] to-[#f59e0b] hover:from-[#fff15a] hover:to-[#ffb618] text-[#0a0505] rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/20 active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4 fill-current animate-pulse text-black" />
                <span>Subscribe Now</span>
              </button>
            </div>
          </motion.div>

        </div>

        {/* Feature Comparison Section */}
        <div className="border-t border-white/5 pt-16">
          <div className="text-center mb-10 space-y-1">
            <h2 className="text-2xl font-extrabold tracking-tight">Full Features Comparison</h2>
            <p className="text-xs text-white/40">Review granular parameters across subscription slots</p>
          </div>
          
          <div className="overflow-x-auto rounded-2xl bg-black border border-white/5">
            <table className="w-full text-left text-xs min-w-[500px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="p-4 font-medium text-white/50 uppercase tracking-widest text-[10px]">Capabilities / Benefits</th>
                  <th className="p-4 font-medium text-white/50 uppercase tracking-widest text-[10px]">Regular (Free)</th>
                  <th className="p-4 font-medium text-yellow-500 uppercase tracking-widest text-[10px]">Viyie+ (Premium)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="p-4 font-medium text-white/80">Support Platform growth</td>
                  <td className="p-4 text-white/40">Basic Use</td>
                  <td className="p-4 text-yellow-500 font-extrabold flex items-center gap-2">
                    <Check className="w-4 h-4" /> Full Backing
                  </td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-white/80">Play audio files and playlist queue</td>
                  <td className="p-4 text-white/50">Yes, Standard</td>
                  <td className="p-4 text-yellow-400 font-medium">Yes, Priority Streams</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-white/80">Pop-up & Content Banner Advertisements</td>
                  <td className="p-4 text-white/40">Standard (With Ads)</td>
                  <td className="p-4 text-yellow-400 font-medium">Ad-free Popups & Banners</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-white/80">Streaming Player Advertisements</td>
                  <td className="p-4 text-white/40">Standard Player Ads</td>
                  <td className="p-4 text-yellow-400 font-medium">
                    <span>No Viyie platform ads. Reduced third-party ads on select servers.</span>
                  </td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-white/80">Favorite Slots capacity limits</td>
                  <td className="p-4 text-white/50">Up to 10 Titles</td>
                  <td className="p-4 text-yellow-400 font-medium">Up to 40 Titles</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-white/80">Watch List Slots capacity limits</td>
                  <td className="p-4 text-white/50">Up to 10 Titles</td>
                  <td className="p-4 text-yellow-400 font-medium">Up to 40 Titles</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-white/80">History Limit (Sync to Continue Watching)</td>
                  <td className="p-4 text-white/50">10 Local/Cloud Saves</td>
                  <td className="p-4 text-yellow-400 font-medium">40 Local/Cloud Saves</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-white/80">Change profile backdrop link type</td>
                  <td className="p-4 text-white/40">Image URLs (.jpeg, .png)</td>
                  <td className="p-4 text-yellow-400 font-medium">Image & Live moving GIFs (.gif)</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-white/80">Profile Badge & Review Comments Accent</td>
                  <td className="p-4 text-white/40">—</td>
                  <td className="p-4 text-yellow-400 font-black animate-gold-shine flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5" /> High-Glow VIP Badge
                  </td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-white/80">Access across standard platforms</td>
                  <td className="p-4 text-white/50">Mobile, Tablet, Desktop</td>
                  <td className="p-4 text-yellow-400 font-medium">Mobile, Tablet, Desktop</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Support Platform description footer */}
        <div className="mt-16 text-center max-w-xl mx-auto space-y-2 border-t border-white/5 pt-10 text-white/30 text-[11px] leading-relaxed">
          <p>
            Support Viyie / 维耶 platform. By choosing a Viyie+ subscription, you directly secure server bandwidth, assist file streams caching, and make sure we can bring high quality media tracking indexes daily. Thank you for supporting Viyie!
          </p>
          <p>© 2026 Viyie Stream Platform. All Rights Reserved.</p>
        </div>
      </div>

      {/* Instant Demo Confirmation popup */}
      <AnimatePresence>
        {showDemoModal && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-[#140e0e]/95 border border-[#f59e0b]/30 shadow-[0_0_50px_rgba(245,158,11,0.25)] p-6 space-y-6 overflow-hidden relative"
            >
              {/* Gold decorative border top accent */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-red-600 via-[#ffe100] to-orange-500" />
              
              <div className="text-center space-y-3 pt-3">
                <div className="w-14 h-14 rounded-full bg-yellow-500/10 border-2 border-[#ffe100] flex items-center justify-center text-yellow-400 mx-auto animate-pulse">
                  <BadgeCheck className="w-8 h-8 fill-current text-yellow-500 stroke-[1.5]" />
                </div>
                   <h3 className="text-lg font-black tracking-tight text-white uppercase">
                  Activation Required
                </h3>
                
                <p className="text-xs text-white/60 leading-relaxed">
                  To access and unlock VIYIE+, please contact the <b className="text-yellow-400 font-black tracking-wide">Platform Administrator</b>. All VIYIE+ Subscriptions are managed manually and activated strictly via the Administrator User Panel.
                </p>

                <div className="p-3.5 rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-left space-y-1.5 mt-4">
                  <div className="text-[10px] uppercase font-medium text-yellow-400/70 tracking-widest flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#ffe100]" /> Premium Features
                  </div>
                  <ul className="text-[10px] text-white/50 space-y-1 text-left list-disc list-inside">
                    <li>Capacity set to <b className="text-white">40 items</b> in Favorites and Watch List.</li>
                    <li>Moving <b className="text-white">GIF upload supported</b> in backdrop customizations.</li>
                    <li>Yellow gloss <b className="text-white">Viyie+ badge</b> enabled in profile and reviews.</li>
                    <li>Ad-free web banners & popups, and minimal third-party stream ads.</li>
                  </ul>
                </div>
              </div>

              <button 
                onClick={() => setShowDemoModal(false)}
                className="w-full py-2.5 bg-gradient-to-r from-[#ffe100] to-[#f59e0b] hover:from-white hover:to-white text-black text-xs font-extrabold uppercase rounded-xl transition-all"
              >
                Go Back
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
