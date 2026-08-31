// Google Translate dynamic single translator for items like Movie Synopsis
export async function translateTextWithGoogle(text: string, targetLang: string = "id", sourceLang: string = "en"): Promise<string> {
  if (!text || targetLang === sourceLang) return text;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data[0]) {
      return data[0].map((item: any) => item[0]).join("");
    }
    return text;
  } catch (err) {
    console.warn("Translation failed, using original text:", err);
    return text;
  }
}

// Map of standard UI translations
const translationDict: Record<string, Record<string, string>> = {
  en: {
    // Header Menus
    platform: "Platform",
    pricing: "Pricing",
    login: "Login",
    logout: "Logout",
    
    // Unified Gateway Modal
    unifiedGateway: "Unified Gateway",
    gatewayDesc: "Select your preferred route. Sign in securely to synchronize personal watch lists, or browse instantly.",
    continueAccount: "Continue with Account",
    browseInstantly: "Browse Instantly & Freely",
    
    // Top Popular
    topPopular: "Top Popular",
    topPopularDesc: "Discover the absolute highest trending movies and series on our platform",
    
    // Features Section
    unifiedStreamSystem: "Unified Stream System",
    seamlessInteractiveCinema: "Seamless Interactive Cinema",
    seamlessInteractiveCinemaDesc: "Synchronized dual-voice playbacks, multiple high-speed CDN routes, and seamless user experiences on any dynamic hardware configurations.",
    
    secureStreamHub: "Secure Stream Hub",
    secureSync: "Secure synchronization",
    secureSyncDesc: "Synchronize account data, custom bookmarked titles, active progress tracks, and personalized recommendation metrics under absolute secure standards.",
    
    nextGenFeatures: "Next-Generation Streaming Features",
    premiumFeatures: "Premium Features",
    nextGenFeaturesDesc: "Take absolute control over your digital theater stream with our next-generation visual and system enhancements.",
    
    activeGrid: "Active Grid",
    endlessMovieShowcase: "Endless Movie Showcase",
    
    // Device support
    cinemaCorePlatform: "Cinema Core Platform",
    unifiedCinemaStreamingEngine: "Unified Cinema Streaming Engine",
    unifiedCinemaStreamingEngineDesc: "Our state-of-the-art content presentation system is optimized for fast decoding, seamless quality transition, and synchronized multi-language playback layers.",
    versatileHardware: "Versatile Hardware Support",
    streamFavoriteDevices: "Stream on your favorite devices",
    streamFavoriteDevicesDesc: "Enjoy pristine video rendering across mobile platforms, desktops, tablets, and smart televisions with our responsive high-frame decoder matrix.",
    
    supportCenter: "Support Center",
    faq: "Frequently Asked Questions",
    
    // VPN notification
    vpnDetectedTitle: "Origin Detected",
    vpnDetectedText: "We detected that you are visiting from Indonesia. Would you like to switch the language to Indonesian?",
    switchToId: "Switch to Indonesian",
    stayInEn: "Stay in English",

    // General Words
    home: "Home",
    profile: "Profile",
    settings: "Settings",
    help: "Help",
    reportBug: "Report Bug",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    cancel: "Cancel",
    confirm: "Confirm",
    back: "Back",
    watchNow: "Watch Now",
    loading: "Loading assets..."
  },
  id: {
    // Header Menus
    platform: "Platform",
    pricing: "Harga",
    login: "Masuk",
    logout: "Keluar",
    
    // Unified Gateway Modal
    unifiedGateway: "Gerbang Terpadu",
    gatewayDesc: "Pilih rute pilihan Anda. Masuk dengan aman untuk menyinkronkan daftar tontonan pribadi, atau langsung jelajahi.",
    continueAccount: "Lanjutkan dengan Akun",
    browseInstantly: "Jelajahi Langsung & Gratis",
    
    // Top Popular
    topPopular: "Terpopuler",
    topPopularDesc: "Temukan film dan serial paling tren di platform kami",
    
    // Features Section
    unifiedStreamSystem: "Sistem Aliran Terpadu",
    seamlessInteractiveCinema: "Bioskop Interaktif Mulus",
    seamlessInteractiveCinemaDesc: "Sikronisasi pemutaran suara ganda, beberapa rute CDN berkecepatan tinggi, dan pengalaman pengguna yang lancar pada konfigurasi perangkat keras dinamis apa pun.",
    
    secureStreamHub: "Pusat Aliran Aman",
    secureSync: "Sinkronisasi aman",
    secureSyncDesc: "Sinkronkan data akun, judul bookmark khusus, pelacakan kemajuan aktif, dan metrik rekomendasi yang disesuaikan berdasarkan standar keamanan mutlak.",
    
    nextGenFeatures: "Fitur Streaming Generasi Berikutnya",
    premiumFeatures: "Fitur Premium",
    nextGenFeaturesDesc: "Pegang kendali penuh atas aliran teater digital Anda dengan penyempurnaan visual dan sistem generasi berikutnya dari kami.",
    
    activeGrid: "Kisi Aktif",
    endlessMovieShowcase: "Pameran Film Tiada Akhir",
    
    // Device support
    cinemaCorePlatform: "Platform Inti Bioskop",
    unifiedCinemaStreamingEngine: "Mesin Streaming Bioskop Terpadu",
    unifiedCinemaStreamingEngineDesc: "Sistem presentasi konten canggih kami dioptimalkan untuk decoding cepat, transisi kualitas yang mulus, dan lapisan pemutaran multi-bahasa yang tersinkronisasi.",
    versatileHardware: "Dukungan Perangkat Keras Serbaguna",
    streamFavoriteDevices: "Streaming di perangkat favorit Anda",
    streamFavoriteDevicesDesc: "Nikmati rendering video yang jernih di platform seluler, desktop, tablet, dan televisi pintar dengan matriks dekoder frame-tinggi responsif kami.",
    
    supportCenter: "Pusat Bantuan",
    faq: "Pertanyaan yang Sering Diajukan",
    
    // VPN notification
    vpnDetectedTitle: "Asal Terdeteksi",
    vpnDetectedText: "Kami mendeteksi Anda berasal dari Indonesia. Apakah Anda ingin mengubah bahasa ke Bahasa Indonesia?",
    switchToId: "Ubah ke Bahasa Indonesia",
    stayInEn: "Tetap Bahasa Inggris",

    // General Words
    home: "Beranda",
    profile: "Profil",
    settings: "Pengaturan",
    help: "Bantuan",
    reportBug: "Laporkan Masalah",
    privacy: "Kebijakan Privasi",
    terms: "Syarat & Ketentuan",
    cancel: "Batal",
    confirm: "Konfirmasi",
    back: "Kembali",
    watchNow: "Tonton Sekarang",
    loading: "Memuat aset..."
  }
};

export function useLanguage() {
  const changeLanguage = (_newLang: string) => {
    localStorage.setItem("vinet-lang", "en");
    window.dispatchEvent(new Event("vinet-lang-changed"));
  };

  const t = (key: string): string => {
    return translationDict["en"]?.[key] || key;
  };

  return {
    language: "en",
    changeLanguage,
    t
  };
}
