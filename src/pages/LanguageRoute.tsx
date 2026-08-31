import { useState, useEffect } from "react";
import { ArrowLeft, Search, Check, Globe } from "lucide-react";
import { motion } from "framer-motion";

const LANGUAGES = [
  { id: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
  { id: "en", name: "English", nativeName: "English" },
  { id: "zh-CN", name: "Chinese", nativeName: "中文" },
  { id: "ko", name: "Korean", nativeName: "한국어" },
  { id: "ja", name: "Japanese", nativeName: "日本語" },
  { id: "fr", name: "Canadian (French)", nativeName: "Français Canadien" },
  { id: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
  { id: "es", name: "Spanish", nativeName: "Español" },
  { id: "th", name: "Thai", nativeName: "ไทย" },
  { id: "ru", name: "Russian", nativeName: "Русский" },
  { id: "pt", name: "Portuguese", nativeName: "Português" },
  { id: "de", name: "German", nativeName: "Deutsch" },
  { id: "it", name: "Italian", nativeName: "Italiano" },
  { id: "ar", name: "Arabic", nativeName: "العربية" },
];

export function LanguageRoute({ onBack }: { onBack: () => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Usually we'd use a context/store for language, but for now we'll mock it or use localStorage
  const currentLang = localStorage.getItem("vinet-lang") || "en";

  const handleSelect = (langId: string) => {
    localStorage.setItem("vinet-lang", langId);
    window.dispatchEvent(new Event("vinet-lang-changed"));
    // Auto go back after changing
    onBack();
  };

  const filteredLanguages = LANGUAGES.filter((l) =>
    l.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
    l.nativeName.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#070404] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#070404]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <Globe className="w-4 h-4 text-orange-500" />
            </div>
            <h1 className="text-xl font-black tracking-tight">Select Language</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
          <input
            type="text"
            placeholder="Search language..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50 focus:bg-white/10 transition-all font-medium"
          />
        </div>

        <div className="space-y-2">
          {filteredLanguages.length > 0 ? (
            filteredLanguages.map((lang, idx) => (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={lang.id}
                onClick={() => handleSelect(lang.id)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                  currentLang === lang.id
                    ? "bg-orange-500/10 border-orange-500/30"
                    : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
                }`}
              >
                <div className="flex flex-col items-start gap-1">
                  <span className={`text-base font-medium ${currentLang === lang.id ? "text-orange-400" : "text-white"}`}>
                    {lang.nativeName}
                  </span>
                  <span className="text-xs text-white/40 font-medium">
                    {lang.name}
                  </span>
                </div>
                {currentLang === lang.id && (
                  <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <Check className="w-4 h-4 text-orange-500" />
                  </div>
                )}
              </motion.button>
            ))
          ) : (
            <div className="text-center py-12">
              <Globe className="w-12 h-12 text-white/10 mx-auto mb-4" />
              <p className="text-white/40 font-medium">No languages found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
