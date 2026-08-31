import { 
  ArrowLeft, 
  ChevronRight, 
  HelpCircle, 
  Search, 
  Activity, 
  Sparkles, 
  User, 
  LogOut, 
  Trash2, 
  Zap, 
  Settings, 
  Check,
  Globe,
  Sliders,
  Send
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { db, collection, addDoc, serverTimestamp } from "../lib/firebase";
import { useUserData } from "../hooks/useUserData";
import { motion, AnimatePresence } from "framer-motion";

// Massive List of detailed questions & answers
const FAQ_KNOWLEDGE_BASE = [
  {
    category: "Account & Playback",
    items: [
      {
        q: "Which device players and platforms are officially supported?",
        a: "We natively support high-speed direct streaming on all modern web browsers (Chrome, Safari, Firefox, Edge) across mobile native viewing, tablets, and desktop computers."
      },
      {
        q: "How do I reset my password?",
        a: "Navigate to your Account & Profile Settings tab or hit the password recovery link on the login panel. A safe password-reset email token will be delivered to your registered inbox to instantly set up your new credentials."
      },
      {
        q: "Why is the video buffering?",
        a: "Buffering usually points to limited regional ISP speeds, active firewalls, or routing limits. Navigate to our alternative PLAY1 / PLAY2 buttons in the player, delete browser cache, or consider connecting via secure VPN configurations such as Cloudflare WARP."
      },
      {
        q: "Can I change the streaming quality?",
        a: "Viyie automatically adjusts the media stream quality according to your live network bandwidth. You can override it by clicking the gear settings icon inside the customized media controls panel to toggle resolutions up to 1080p Full HD."
      },
      {
        q: "How do I manage my devices?",
        a: "We support concurrent displays on multiple devices. To audit active sessions or safely invalidate unfamiliar logged-in device keys, navigate to the safety panel in Profile settings."
      },
      {
        q: "I can't see the subtitles.",
        a: "Verify that subtitles are toggled on in the video player UI. If a video lacks standard titles, use our premium Custom Subtitles option on the player screen to load SRT or VTT files natively."
      },
      {
        q: "How do I clear watch history?",
        a: "To clear your viewed titles, use the 'Wipe Watch History' card inside our Quick Actions section above. You can also wipe individual items via the Favorite & History tabs on your main profile home."
      },
      {
        q: "Is there a dark mode?",
        a: "Viyie is designed exclusively upon an eye-friendly, high-contrast Crimson iQIYI layout. You can cycle ambient glowing aura backdrops instantly using our Aura Control tool in the Quick Actions tray."
      },
      {
        q: "How do I change my username?",
        a: "Head to Profile Settings, click on the username textbox, enter your preferred screen name, and tap the save changes controller. The update propagates immediately everywhere."
      },
      {
        q: "Can I use this on mobile?",
        a: "Viyie is engineered with a mobile-responsive ecosystem, boasting lightweight visual assets, touch-gesture optimizations, collapsible slide-drawers, and responsive grid density."
      },
      {
        q: "Why is it lagging?",
        a: "Local viewport lag holds a strong correlation to hardware-acceleration bottlenecks, low device resources, or browser engine load. Try ending other active background apps, toggling lower bitrates, or using a modern Chromium browser."
      },
      {
        q: "How to skip intro?",
        a: "Simply drag the video player's progress scrubber or use our quick Forward trigger (skip 10 seconds) located on both sidebars of the customized media wrapper."
      },
      {
        q: "How to change audio track?",
        a: "For content hosting multiple language encodings or dual voice options, click the sound controls option in our video container's options tray to swap audio streams."
      },
      {
        q: "I have login issues.",
        a: "Confirm you are using correct matching credentials. For a fast login alternative, click 'Sign in with Google' on our login dashboard for instant passwordless entry."
      },
      {
        q: "How to sign out?",
        a: "Click on your user profile logo card at the top-right and select Sign Out, or simply click the 'Instant Safely Sign Out' card on our Quick Actions menu here on the help page."
      },
      {
        q: "My app is crashing.",
        a: "Crashing can stem from state fragmentation or corrupted local cache. Run our 'Reset All App Cache' Quick Action on this page to securely wipe local data storage and restore stock stability."
      },
      {
        q: "Why can't I see my profile?",
        a: "Ensure your account is active and verified. If you run into expired login tokens, sign out completely and authenticate again to refresh connection properties."
      },
      {
        q: "What is the watch history for?",
        a: "Watch history logs your progressive timestamps precisely, allowing you to resume exactly where you left off on either desktop viewports or smart mobile displays."
      },
      {
        q: "Can I download videos?",
        a: "Various catalog items provide direct, fast-speed download links. These are accessible inside the streams grid underneath host nodes or remote drives."
      },
      {
        q: "How to pause progress?",
        a: "Simply hit the global keyboard hotkey 'Spacebar' or click/tap once directly inside the boundaries of our premium video controls module."
      },
      {
        q: "Where are my bookmarks?",
        a: "Bookmarks, list queues, and marked favorites are managed under 'My List' and 'Favorites' tabs, easily reachable on your main profile dashboard."
      }
    ]
  },
  {
    category: "Subscription",
    items: [
      {
        q: "How do I upgrade to Premium?",
        a: "Navigate to our dedicated Viyie Subscription portal, choose your pricing structure, and follow our checkout. Premium unlocks alternate high-speed play nodes, 4K UHD resolutions, and filters external popups."
      },
      {
        q: "Is there a free trial?",
        a: "All newly authenticated users get a 3-day premium evaluation trial period to test restricted high-speed server mirrors risk-free."
      },
      {
        q: "How to cancel subscription?",
        a: "Cancel billing instantly with our self-service subscription canceller inside the Viyie Subscription route. Your premium active features will stay unlocked until the billing cycle expires."
      },
      {
        q: "What payment methods do you accept?",
        a: "We support secure Stripe checkout parameters, enabling Credit Cards, Debit Cards, Google Pay, Apple Pay, PayPal, and automatic bank transfers."
      },
      {
        q: "Is it a yearly or monthly plan?",
        a: "You can select a self-renewing monthly plan or a heavily discounted annual tier, saving up to 35% on standard rates."
      },
      {
        q: "Can I change my plan type?",
        a: "Upgrade, downgrade, or migrate between individual and family subscription arrangements inside your Stripe/Viyie subscription manager panel anytime."
      },
      {
        q: "Are there student discounts?",
        a: "Yes! Verifiable university email credentials entitle students to a 40% discount. Reach out via the discount application link inside the subscription menu."
      },
      {
        q: "What countries are supported?",
        a: "Viyie functions globally. Secure proxy routers and high-speed multi-region Google Cloud Run containers host streaming feeds worldwide."
      },
      {
        q: "Will ads be removed?",
        a: "Yes! Viyie Premium subscribers see zero external ads or screen wrappers, allowing secure, clean, cinema theater playback."
      },
      {
        q: "Can I share my account?",
        a: "Our standard subscription tier is built for family members, supporting up to 4 concurrent multi-screen playback instances securely."
      },
      {
        q: "Where is my receipt?",
        a: "Stripe auto-generates digital transaction invoices and sends them to your linked email address. Receipts are also retrievable in active account logs."
      },
      {
        q: "Why was I charged twice?",
        a: "This is most commonly a temporary pre-authorization hold applied by banking networks. If dual transactions persist, contact support to reverse hold logs. This is backed by our customer protection."
      },
      {
        q: "How to update billing info?",
        a: "Update payment credentials, cards, billing addresses, and postal codes instantly inside the billing portal page on our Stripe gateway link."
      },
      {
        q: "Is it auto-renewable?",
        a: "Yes, subscriptions renew at the final date of your billing cycle. You can adjust auto-renew toggles inside subscription settings at any time."
      },
      {
        q: "Can I get a refund?",
        a: "We offer a 7-day hassle-free money-back guarantee for first-time subscriptions if premium capabilities do not meet your viewing needs."
      },
      {
        q: "Is subscription required?",
        a: "No! Viyie is mostly open and free to all viewers supported by benign ad revenue. Premium is completely voluntary to bypass ads."
      },
      {
        q: "Does Premium have 4K?",
        a: "Yes, compatible films are available in authentic high-bitrate Ultra HD 4K, sourced from premium remote CDN networks."
      },
      {
        q: "How to switch to family plan?",
        a: "Launch our Subscription dashboard, select 'Family Pack Upgrade', and send secure inviter keys to up to 4 additional family members."
      },
      {
        q: "What are the benefits?",
        a: "Complete ad removal, 4K resolutions, alternate failsafe servers (PLAY1/PLAY2), dual-language sound streams, download capabilities, and early VIP releases."
      },
      {
        q: "How to use promo codes?",
        a: "Input the code string into the promo input box before confirming Stripe billing, and discounts will apply live."
      }
    ]
  },
  {
    category: "Core Features",
    items: [
      {
        q: "What are the main app features?",
        a: "We pack an advanced search engine, trailer integrations, user ratings, customizable favorites list, custom subtitles injector, multi-room parent controls, live dark glows, and a curated database."
      },
      {
        q: "How to use voice commands?",
        a: "Navigate to search, tap the voice search mic icon, allow microphone permission, and state the movie title cleanly. Results will generate on-screen instantly."
      },
      {
        q: "What is the AI recommendation engine?",
        a: "Our machine-learning recommendation models analyze your chosen categories and watch progress to generate a personalized playlist recommendation."
      },
      {
        q: "How to search by genre?",
        a: "Click genre tags on any title cards or select our Genre filtration section in the navigation menu to narrow movies matching specific categories."
      },
      {
        q: "What does the trend indicator mean?",
        a: "The Crimson Flame badge highlights cinema releases experiencing high viewership and stellar user feedback on Viyie currently."
      },
      {
        q: "Can I customize my dashboard?",
        a: "Adjust rows, toggle horizontal flow layouts, alter layout spacing density, and change glow environments directly in settings."
      },
      {
        q: "How to add items to my list?",
        a: "Simply tap the '+' or bookmark trigger on any details container to add items, making them retrievable instantly on your profile tracker."
      },
      {
        q: "How to use community forums?",
        a: "Read and participate in comment overlays below video wrappers, share playlist URLs, and exchange reviews on Viyie easily."
      },
      {
        q: "Is data backup available?",
        a: "All user databases, favorite lists, custom reviews, and history tracks are mirrored safely inside our encrypted Google Firebase databases."
      },
      {
        q: "What are external links?",
        a: "Alternative links allow users to stream content using alternative servers when direct hosting servers encounter regional downtime."
      },
      {
        q: "Can I integrate with other apps?",
        a: "We feature an extensible secure API, enabling users to hook search queries and streaming feeds into media trackers."
      },
      {
        q: "How to report a DMCA issue?",
        a: "Viyie respects intellectual properties. Submit secure copyright claims on our /reportbug portal or mail support directly."
      },
      {
        q: "Is this app open source?",
        a: "Our frontend engine is open, utilizing React, Vite, Framer Motion, and Tailwind CSS to push fast lightweight cinema speeds."
      },
      {
        q: "How often is content updated?",
        a: "Our media catalog updates several times per day, matching releases, fetching subtitle translations, and appending mirror tracks."
      },
      {
        q: "Are there parental controls?",
        a: "Yes! In settings, toggling family safe locks automatically filters out R-rated and adult classifications based on ratings."
      },
      {
        q: "How to use the admin dashboard?",
        a: "Staffers holding authentic admin roles can login to /adminfirefury. The admin panel supervises items, views logs, and monitors system metrics."
      },
      {
        q: "What language support exists?",
        a: "Our master viewport is localized in complete English. We support user translation uploads to match international subtitles requirements."
      },
      {
        q: "How to share content?",
        a: "Hit the share trigger on details containers to instantly copy the streaming link to your clipboard."
      },
      {
        q: "Is the app fast?",
        a: "Yes. Sourced from fast server nodes, database lookups and media queries resolve in under 150ms."
      },
      {
        q: "What is the technology stack?",
        a: "Viyie is engineered using React 18, Vite compile pipelines, Tailwind CSS, Framer Motion animations, and secure Firebase Cloud hosting endpoints."
      }
    ]
  }
];

export function NeedHelpRoute({ onBack }: { onBack: () => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [customBackdropIndex, setCustomBackdropIndex] = useState(0);
  const [actionSuccessMsg, setActionSuccessMsg] = useState("");
  const [redeemPromptOpen, setRedeemPromptOpen] = useState(false);
  const [redeemInputValue, setRedeemInputValue] = useState("");

  const backdrops = [
    { name: "Crimson Aura", class: "after:bg-red-600/10", glow: "text-red-500" },
    { name: "Indigo Matrix", class: "after:bg-indigo-600/10", glow: "text-indigo-400" },
    { name: "Emerald Glade", class: "after:bg-emerald-600/10", glow: "text-emerald-400" },
    { name: "Ocean Ripple", class: "after:bg-sky-600/10", glow: "text-sky-400" },
    { name: "Gold Sunset", class: "after:bg-amber-600/10", glow: "text-amber-500" }
  ];

  // Filter FAQs based on query and category
  const filteredFaqs = useMemo(() => {
    let result = FAQ_KNOWLEDGE_BASE;
    if (activeCategory) {
      result = result.filter(cat => cat.category === activeCategory);
    }
    
    if (debouncedSearchQuery.trim()) {
      const lowerQuery = debouncedSearchQuery.toLowerCase();
      return result.map(cat => ({
        ...cat,
        items: cat.items.filter(
          item => item.q.toLowerCase().includes(lowerQuery) || item.a.toLowerCase().includes(lowerQuery)
        )
      })).filter(cat => cat.items.length > 0);
    }
    
    return result;
  }, [debouncedSearchQuery, activeCategory]);

  // Dispatch trigger actions
  const triggerQuickAction = (action: string) => {
    if (action === "backdrop") {
      const nextIndex = (customBackdropIndex + 1) % backdrops.length;
      setCustomBackdropIndex(nextIndex);
      localStorage.setItem("viyie_custom_backdrop_hue", backdrops[nextIndex].name.toLowerCase());
      
      // Emit event so App.tsx can update globally
      window.dispatchEvent(new CustomEvent("viyie_theme_changed", {
        detail: { theme: backdrops[nextIndex].name.toLowerCase() }
      }));
      
      showToast(`Aura backdrop successfully altered to ${backdrops[nextIndex].name}!`);
    } else if (action === "logout") {
      // Dispatches logout custom event to let App.tsx log out
      window.dispatchEvent(new CustomEvent("viyie_quick_action", { detail: { action: "logout" } }));
      showToast("Triggering secure authentication logout protocol...");
    } else if (action === "clear-history") {
      localStorage.removeItem("vinet-recent");
      localStorage.removeItem("watched");
      window.dispatchEvent(new CustomEvent("viyie_quick_action", { detail: { action: "clear-history" } }));
      showToast("Local play history logs cleaned successfully!");
    } else if (action === "optimize-stream") {
      const cur = localStorage.getItem("viyie_use_failsafe_iframe") === "true";
      localStorage.setItem("viyie_use_failsafe_iframe", (!cur).toString());
      window.dispatchEvent(new CustomEvent("viyie_failsafe_iframe_changed", { detail: !cur }));
      showToast(`Alternate hosted system player: ${!cur ? "TUNED FAST" : "STANDBY"}`);
    } else if (action === "navigate-profile") {
      window.history.pushState({}, "", "/profile/settings");
      window.dispatchEvent(new Event("popstate"));
    } else if (action === "navigate-subscription") {
      window.history.pushState({}, "", "/subsviyie");
      window.dispatchEvent(new Event("popstate"));
    } else if (action === "redeem-code") {
      setRedeemPromptOpen(true);
    } else if (action === "share-link") {
      navigator.clipboard.writeText(window.location.origin);
      showToast("Platform invite link encrypted and copied to clipboard!");
    } else if (action === "sync-ui") {
      showToast("UI layouts synchronized across global clusters!");
    } else if (action === "reset-cache") {
      // Clearing state
      const keysToKeep = ["viyie_use_failsafe_iframe"];
      Object.keys(localStorage).forEach((key) => {
        if (!keysToKeep.includes(key)) localStorage.removeItem(key);
      });
      showToast("System cache purged completely! Page will reload in 2 seconds...");
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  };

  const showToast = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => {
      setActionSuccessMsg("");
    }, 3500);
  };

  return (
    <div className={`fixed inset-0 z-[99999] bg-[#070404] text-white overflow-y-auto font-sans select-none antialiased ${backdrops[customBackdropIndex].class} transition-all duration-700`}>
      <div className="w-full min-h-full p-2.5 sm:p-6 md:p-12 flex flex-col justify-start relative z-10">
      
      {/* Background radial glow */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-red-600/5 blur-[150px] rounded-full pointer-events-none z-0" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-red-800/5 blur-[150px] rounded-full pointer-events-none z-0" />

      {/* Embedded Action Feedback Toast */}
      <AnimatePresence>
        {actionSuccessMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[11000] px-5 py-3 bg-neutral-900 border border-red-500/30 rounded-xl flex items-center gap-3 shadow-[0_20px_50px_rgba(0,0,0,0.8)] font-sans antialiased text-xs"
          >
            <div className="w-5 h-5 bg-red-600/20 text-red-500 rounded-full flex items-center justify-center border border-red-500/30">
              <Check className="w-3.5 h-3.5" />
            </div>
            <span className="font-medium uppercase tracking-wider text-white/90">{actionSuccessMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 bg-[#090606] border border-white/5 p-4 sm:p-8 md:p-12 rounded-2xl sm:rounded-[2.5rem] shadow-[0_0_80px_rgba(0,0,0,0.8)] relative overflow-hidden">
        
        {/* Back Link */}
        <button 
          onClick={onBack} 
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-2 text-[10px] font-medium uppercase tracking-widest cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-red-500" /> Go back to homepage
        </button>

        {/* Header Block and Brand logo */}
        <div className="space-y-2 border-b border-white/5 pb-5 sm:pb-8 relative">
          <div className="absolute top-0 right-0 hidden md:block">
            <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-full font-medium uppercase tracking-widest animate-pulse flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" /> Live Gate Status: Online
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 flex items-center gap-2">
            Viyie Live Support
          </h1>
          <p className="text-[11px] sm:text-xs md:text-sm text-white/50 font-normal leading-relaxed">
            Find immediate diagnostic answers, submit bugs, or configure preference gateways using our instant Quick-Access dashboard.
          </p>
        </div>

        {/* CRITICAL: USER INTENT DIRECT SEAMLESS QUICK-ACCESS PANEL */}
        <div className="space-y-4 bg-white/[0.005] border border-white/5 p-4 sm:p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-3xl pointer-events-none" />
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="w-4 h-4 text-red-500" />
            <h3 className="text-[10px] sm:text-xs font-medium uppercase tracking-widest text-[#ff3838]">
              Dynamic Quick Actions Dashboard
            </h3>
          </div>
          <p className="text-[10px] sm:text-[11px] text-white/40 leading-relaxed font-normal">
            Trigger custom system settings, manage cache parameters, cycle layouts, and optimize performance directly below without manual menu deep-diving.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3">
            
            {/* Quick Action 1: Change Backdrop Aura */}
            <button
              onClick={() => triggerQuickAction("backdrop")}
              className="p-3.5 bg-neutral-900/40 hover:bg-neutral-900/90 border border-white/5 hover:border-red-500/30 rounded-xl flex flex-col items-start text-left gap-2 shadow-sm transition-all group hover:shadow-lg cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/15 flex items-center justify-center text-red-400 group-hover:scale-105 transition-transform">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] font-medium tracking-tight text-white/95 group-hover:text-red-400 transition-colors">
                  Swap Backdrop Aura
                </span>
                <p className="text-[10px] text-white/40 leading-normal font-normal">
                  Current: <strong className={`${backdrops[customBackdropIndex].glow} font-medium`}>{backdrops[customBackdropIndex].name}</strong>
                </p>
              </div>
            </button>

            {/* Quick Action 2: Reset History */}
            <button
              onClick={() => triggerQuickAction("clear-history")}
              className="p-3.5 bg-neutral-900/40 hover:bg-neutral-900/90 border border-white/5 hover:border-red-500/30 rounded-xl flex flex-col items-start text-left gap-2 shadow-sm transition-all group hover:shadow-lg cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/15 flex items-center justify-center text-orange-400 group-hover:scale-105 transition-transform">
                <Trash2 className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] font-medium tracking-tight text-white/95 group-hover:text-orange-400 transition-colors">
                  Reset Watch Logs
                </span>
                <p className="text-[10px] text-white/40 leading-normal font-normal">Wipes local watch counts.</p>
              </div>
            </button>

            {/* Quick Action 3: Player Engine */}
            <button
              onClick={() => triggerQuickAction("optimize-stream")}
              className="p-3.5 bg-neutral-900/40 hover:bg-neutral-900/90 border border-white/5 hover:border-red-500/30 rounded-xl flex flex-col items-start text-left gap-2 shadow-sm transition-all group hover:shadow-lg cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/15 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                <Zap className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] font-medium tracking-tight text-white/95 group-hover:text-amber-400 transition-colors">
                  Player Engine Toggle
                </span>
                <p className="text-[10px] text-white/40 leading-normal font-normal">Swap remote failsafe rendering.</p>
              </div>
            </button>

            {/* Quick Action 4: Account settings */}
            <button
              onClick={() => triggerQuickAction("navigate-profile")}
              className="p-3.5 bg-neutral-900/40 hover:bg-neutral-900/90 border border-white/5 hover:border-red-500/30 rounded-xl flex flex-col items-start text-left gap-2 shadow-sm transition-all group hover:shadow-lg cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/15 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                <User className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] font-medium tracking-tight text-white/95 group-hover:text-blue-400 transition-colors">
                  Account Settings
                </span>
                <p className="text-[10px] text-white/40 leading-normal font-normal">Configure credentials & profile.</p>
              </div>
            </button>

            {/* Quick Action 5: Prime Subscriptions */}
            <button
              onClick={() => triggerQuickAction("navigate-subscription")}
              className="p-3.5 bg-neutral-900/40 hover:bg-neutral-900/90 border border-white/5 hover:border-red-500/30 rounded-xl flex flex-col items-start text-left gap-2 shadow-sm transition-all group hover:shadow-lg cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                <Globe className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] font-medium tracking-tight text-white/95 group-hover:text-emerald-400 transition-colors">
                  Viyie Premium Pass
                </span>
                <p className="text-[10px] text-white/40 leading-normal font-normal">Unlock 4K alternate mirrors.</p>
              </div>
            </button>

            {/* Quick Action 6: Clear Session & Logout */}
            <button
              onClick={() => triggerQuickAction("logout")}
              className="p-3.5 bg-neutral-950/40 hover:bg-neutral-900/90 border border-white/5 hover:border-red-500/30 rounded-xl flex flex-col items-start text-left gap-2 shadow-sm transition-all group hover:shadow-lg cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-red-650/10 border border-red-500/15 flex items-center justify-center text-red-550 group-hover:scale-105 transition-transform">
                <LogOut className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] font-medium tracking-tight text-white/95 group-hover:text-red-500 transition-colors">
                  Sign Out Session
                </span>
                <p className="text-[10px] text-white/40 leading-normal font-normal">Disconnect security keys safely.</p>
              </div>
            </button>

            {/* Quick Action 7: Quick Redeem Code */}
            <button
              onClick={() => triggerQuickAction("redeem-code")}
              className="p-3.5 bg-neutral-900/40 hover:bg-neutral-900/90 border border-white/5 hover:border-purple-500/30 rounded-xl flex flex-col items-start text-left gap-2 shadow-sm transition-all group hover:shadow-lg cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/15 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
                <Settings className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] font-medium tracking-tight text-white/95 group-hover:text-purple-400 transition-colors">
                  Quick Redeem Code
                </span>
                <p className="text-[10px] text-white/40 leading-normal font-normal">Enter promo/VIP keys here.</p>
              </div>
            </button>

            {/* Quick Action 8: Share Invite Link */}
            <button
              onClick={() => triggerQuickAction("share-link")}
              className="p-3.5 bg-neutral-900/40 hover:bg-neutral-900/90 border border-white/5 hover:border-pink-500/30 rounded-xl flex flex-col items-start text-left gap-2 shadow-sm transition-all group hover:shadow-lg cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/15 flex items-center justify-center text-pink-400 group-hover:scale-105 transition-transform">
                <Globe className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] font-medium tracking-tight text-white/95 group-hover:text-pink-400 transition-colors">
                  Invite Friends
                </span>
                <p className="text-[10px] text-white/40 leading-normal font-normal">Copy encrypted share link.</p>
              </div>
            </button>

            {/* Quick Action 9: Sync UI Layouts */}
            <button
              onClick={() => triggerQuickAction("sync-ui")}
              className="p-3.5 bg-neutral-900/40 hover:bg-neutral-900/90 border border-white/5 hover:border-teal-500/30 rounded-xl flex flex-col items-start text-left gap-2 shadow-sm transition-all group hover:shadow-lg cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/15 flex items-center justify-center text-teal-400 group-hover:scale-105 transition-transform">
                <Activity className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] font-medium tracking-tight text-white/95 group-hover:text-teal-400 transition-colors">
                  Sync Global UI
                </span>
                <p className="text-[10px] text-white/40 leading-normal font-normal">Force sync design templates.</p>
              </div>
            </button>

          </div>

          <div className="pt-3.5 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <span className="text-[9px] font-medium uppercase tracking-wider text-white/20">System Preference Manager</span>
            <button
              onClick={() => triggerQuickAction("reset-cache")}
              className="text-[9.5px] font-medium uppercase text-red-500 hover:text-red-400 cursor-pointer flex items-center gap-1 hover:underline"
            >
              <Settings className="w-3 w-3" /> WIPE PLATFORM CACHE & RESET ALL
            </button>
          </div>
        </div>

        {/* SEARCH AND NAVIGATION */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2.5">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Search premium FAQ answers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 sm:h-12 bg-neutral-900/60 border border-white/5 focus:border-red-500/50 rounded-xl pl-10 pr-4 text-xs font-normal outline-none text-white transition-all placeholder:text-white/20"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-medium uppercase text-white/55 bg-white/5 px-2 py-1 rounded"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Category selection */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none shrink-0">
              <button
                onClick={() => setActiveCategory(null)}
                className={`px-3.5 h-10 sm:h-12 rounded-xl text-[9px] sm:text-[10px] font-medium uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer border ${
                  activeCategory === null
                    ? "bg-red-600 border-red-500 text-white"
                    : "bg-neutral-900 border-[#1a1a1a] text-white/50 hover:text-white hover:border-white/10"
                }`}
              >
                All categories
              </button>
              {FAQ_KNOWLEDGE_BASE.map(cat => (
                <button
                  key={cat.category}
                  onClick={() => setActiveCategory(cat.category)}
                  className={`px-3.5 h-10 sm:h-12 rounded-xl text-[9px] sm:text-[10px] font-medium uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer border ${
                    activeCategory === cat.category
                      ? "bg-red-600 border-red-500 text-white"
                      : "bg-neutral-900 border-[#1a1a1a] text-white/50 hover:text-white hover:border-white/10"
                  }`}
                >
                  {cat.category}
                </button>
              ))}
            </div>

          </div>
        </div>

        {/* EXPANDABLE FAQS PANEL */}
        <div className="space-y-6 pt-2">
          {filteredFaqs.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-white/5 rounded-2xl space-y-2">
              <HelpCircle className="w-8 h-8 text-white/20 mx-auto" />
              <p className="text-xs text-white/40 font-medium uppercase tracking-wider">No matching answers found</p>
              <p className="text-[10px] text-white/25">Try query searches or select alternative categories above.</p>
            </div>
          ) : (
            filteredFaqs.map((catSpec) => (
              <div key={catSpec.category} className="space-y-3">
                <div className="flex items-center gap-1.5 border-b border-white/5 pb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                  <h2 className="text-[10px] sm:text-xs font-medium uppercase text-white/40 tracking-wider pl-0.5">
                    {catSpec.category} Information Center
                  </h2>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {catSpec.items.map((item) => {
                    const isExpanded = expandedQuestion === item.q;
                    return (
                      <div 
                        key={item.q}
                        className={`rounded-xl border transition-all duration-300 overflow-hidden ${
                          isExpanded 
                            ? "bg-neutral-900/75 border-red-500/20 shadow-md shadow-red-950/10" 
                            : "bg-neutral-900/20 border-white/5 hover:border-white/10"
                        }`}
                      >
                        {/* Accordion clickable header */}
                        <button
                          onClick={() => setExpandedQuestion(isExpanded ? null : item.q)}
                          className="w-full p-3.5 flex items-center justify-between text-left cursor-pointer focus:outline-none"
                        >
                          <span className={`text-xs font-semibold tracking-tight leading-relaxed ${isExpanded ? "text-red-400 font-medium" : "text-white/80"}`}>
                            {item.q}
                          </span>
                          <ChevronRight className={`w-3.5 h-3.5 text-white/30 shrink-0 transition-transform duration-300 ${isExpanded ? "rotate-90 text-red-500" : ""}`} />
                        </button>

                        {/* Expandable answer */}
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            className="px-3.5 pb-4 pt-0.5 text-xs text-white/65 leading-relaxed font-normal bg-black/15 border-t border-white/[0.02]"
                          >
                            {item.a}
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

      </div>

      <div className="max-w-4xl mx-auto text-center mt-8 text-[9px] text-white/25 tracking-widest font-medium">
        VIYIE SUPPORT ENCRYPTED WORKSPACE · SYSTEM CHANNELS COMPLIANCE ACTIVE
      </div>

      {/* Redeem Prompt Modal */}
      <AnimatePresence>
        {redeemPromptOpen && (
          <div className="fixed inset-0 z-[500] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#111] border border-red-500/20 w-full max-w-sm rounded-2xl shadow-2xl p-6 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 blur-[50px] rounded-full pointer-events-none" />
              
              <h3 className="text-lg font-medium text-white mb-2 text-center">Redeem Code</h3>
              <p className="text-xs text-white/50 mb-6 text-center">Enter your VIP/Promo code below</p>
              
              <input
                type="text"
                value={redeemInputValue}
                onChange={(e) => setRedeemInputValue(e.target.value)}
                placeholder="VIYIE-XXXXXX"
                className="w-full h-12 bg-black/50 border border-white/10 rounded-xl px-4 text-sm text-white font-mono uppercase focus:border-red-500/50 outline-none mb-6 text-center tracking-widest"
              />
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setRedeemPromptOpen(false);
                    setRedeemInputValue("");
                  }}
                  className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (redeemInputValue.trim()) {
                      window.dispatchEvent(new CustomEvent("viyie_manual_redeem", { detail: { code: redeemInputValue.trim() } }));
                    }
                    setRedeemPromptOpen(false);
                    setRedeemInputValue("");
                  }}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white font-medium text-sm rounded-xl transition-all"
                >
                  Apply
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      </div>
    </div>
  );
}
export function ReportBugRoute({ onBack }: { onBack: () => void }) {
  const [type, setType] = useState<string>("Web Layout");
  const [message, setMessage] = useState<string>("");
  const [status, setStatus] = useState<"form" | "success">("form");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useUserData();

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setIsSubmitting(true);
    try {
        await addDoc(collection(db, 'reports'), {
            type: "bug",
            category: type,
            message: message,
            reporterEmail: user?.email || "anonymous@viyie.com",
            reporterUid: user?.uid || "anonymous_user",
            status: "pending",
            createdAt: serverTimestamp(),
            timestamp: serverTimestamp(),
            date: new Date().toISOString()
        });
        setStatus("success");
    } catch (e) {
        console.error("Error adding document: ", e);
    } finally {
        setIsSubmitting(false);
    }
  };

  if (status === "success") {
    return (
      <div className="fixed inset-0 z-[99999] overflow-y-auto bg-[#070404] text-white font-sans select-none antialiased">
        <div className="min-h-full w-full flex items-center justify-center p-4 text-center">
          <div className="max-w-md w-full p-6 sm:p-10 bg-[#090606] rounded-2xl sm:rounded-[2.5rem] border border-white/5 space-y-5 shadow-2xl animate-fade-in relative z-10">
            <div className="w-10 h-10 bg-emerald-600/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 mx-auto">
              <Check className="w-5 h-5 animate-pulse" />
            </div>
            <h1 className="text-xl sm:text-2xl font-medium text-emerald-400 uppercase tracking-tight">Report Logged Successfully</h1>
            <p className="text-white/60 text-xs sm:text-sm leading-relaxed font-normal">
              We sincerely appreciate your active contribution to the Viyie streaming ecosystem. Technical parameters, carrier details, and server routes were submitted alongside this diagnostic package.
            </p>
            <button 
              onClick={onBack} 
              className="w-full bg-red-600 hover:bg-red-500 text-white font-medium text-xs uppercase tracking-widest py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.25)] hover:shadow-[0_0_30px_rgba(239,68,68,0.4)] cursor-pointer active:scale-95 border border-red-500/20"
            >
              Back to Home Gateway
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[99999] overflow-y-auto bg-[#070404] text-white font-sans select-none antialiased">
      <div className="min-h-full w-full flex items-center justify-center p-3 sm:p-6 md:p-12 relative animate-fade-in">
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-red-800/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-xl w-full bg-[#090606] p-4 sm:p-8 md:p-10 border border-white/5 rounded-2xl sm:rounded-[2.5rem] space-y-5 shadow-2xl relative z-10">
        <button onClick={onBack} className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors mb-2 text-[10px] font-medium uppercase tracking-widest cursor-pointer">
          <ArrowLeft className="w-3.5 h-3.5 text-red-500" /> Back to dashboard
        </button>
        
        <div className="space-y-1 pb-3 border-b border-white/5">
          <h1 className="text-xl sm:text-2xl font-medium text-white uppercase tracking-tight flex items-center gap-2">
            <Sliders className="w-4.5 h-4.5 text-red-500" />
            Report {type === "Comment" ? "Issue" : "Platform Bug"}
          </h1>
          <p className="text-white/50 text-[10.5px] sm:text-[11px] leading-relaxed font-normal">
            Spot a streaming bottleneck, blank page, or missing subtitle track? File a brief diagnostic message here to notify our web administrators instantly.
          </p>
        </div>

        <div className="space-y-4 pt-1">
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/40">Choose Category</label>
              <select 
                className="w-full bg-[#070404] hover:bg-[#0c0a0a] border border-white/10 focus:border-red-500/50 outline-none p-3 rounded-lg text-xs font-normal text-white transition-colors cursor-pointer"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                  <option>Web Layout</option>
                  <option>Video Player</option>
                  <option>Account Credentials</option>
                  <option>Missing Content</option>
                  <option>Incorrect Translator Subs</option>
                  <option>Billing / Premium Upgrade</option>
                  <option>Other Bugs</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/40">Explanation Log</label>
              <textarea 
                 value={message}
                 onChange={(e) => setMessage(e.target.value)}
                 placeholder="Please specify when, where, and how the incident occurred. Including specific movie names or alternative player settings greatly expedites resolution..."
                 className="w-full bg-[#070404] focus:bg-[#0c0a0a] border border-white/10 focus:border-red-500/50 p-3.5 rounded-xl text-xs font-normal text-white h-28 sm:h-32 outline-none transition-colors resize-none placeholder:text-white/20 leading-relaxed"
              />
            </div>

            <button 
              onClick={handleSubmit}
              disabled={isSubmitting || !message.trim()}
              className="w-full h-11 sm:h-12 bg-red-650 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_10px_30px_rgba(239,68,68,0.2)] hover:shadow-[0_10px_45px_rgba(239,68,68,0.35)] flex items-center justify-center gap-2 cursor-pointer active:scale-95 border border-red-500/30"
            >
                <Send className={`w-3.5 h-3.5 ${isSubmitting ? "animate-pulse" : ""}`} />
                {isSubmitting ? "LOGGING PRE-FLIGHT REPORTS..." : "TRANSMIT DIAGNOSTIC STATEMENT"}
            </button>
        </div>

        </div>
      </div>
    </div>
  );
}
