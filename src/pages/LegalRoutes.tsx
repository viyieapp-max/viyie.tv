import { ArrowLeft } from "lucide-react";
import { BRAND_NAME } from "../constants/brand";

export function PrivacyRoute({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-[#070404] text-white p-6 sm:p-12 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6 bg-[#0a0505] p-8 sm:p-12 rounded-[2rem] shadow-[0_0_40px_rgba(220,38,38,0.05)] border border-white/5 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-orange-500/10 rounded-full blur-[100px] pointer-events-none" />

        <button onClick={onBack} className="relative z-10 flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-6 text-sm font-medium uppercase tracking-wider">
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>

        <div className="relative z-50 border-b border-white/10 pb-8 mb-8">
          <h1 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 mb-4 tracking-tight drop-shadow-sm leading-normal py-2">Privacy Policy</h1>
          <p className="text-sm font-medium text-white/50 font-mono tracking-widest uppercase">Effective Date: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="relative z-10 space-y-8 text-white/70 text-sm leading-loose">
          <section>
            <p className="text-base text-white/90">
              Welcome to <strong>{BRAND_NAME}</strong> ("we," "our," or "us"). We respect your privacy and are committed to protecting it through our compliance with this privacy policy. 
              This policy describes the types of information we may collect from you or that you may provide when you visit the {BRAND_NAME} website, and our practices for collecting, using, maintaining, protecting, and disclosing that information.
            </p>
          </section>

          <section className="bg-white/[0.02] p-6 rounded-2xl border border-white/[0.02]">
            <h2 className="text-xl font-medium text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center text-sm">1</span> 
              Information We Collect
            </h2>
            <ul className="list-disc pl-5 space-y-2 marker:text-red-500">
              <li><strong>Account Information:</strong> When you register via Google Authentication, we collect your email address, profile picture string, and full name. We also collect the unique username you choose during the onboarding process.</li>
              <li><strong>Activity and Preference Data:</strong> We securely store your viewing habits, including watch history, timestamps of what you are currently watching, items added to your bookmarks/favorites, and search queries.</li>
              <li><strong>User-Generated Content:</strong> Any comments, reviews, or interactions you post on content pages are collected and stored.</li>
              <li><strong>Device & Usage Information:</strong> We may collect non-identifiable usage statistics, user interface preferences (such as audio/music toggle states, language preferences), and diagnostic data to improve our service.</li>
            </ul>
          </section>

          <section className="bg-white/[0.02] p-6 rounded-2xl border border-white/[0.02]">
            <h2 className="text-xl font-medium text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center text-sm">2</span> 
              How We Use Your Information
            </h2>
            <ul className="list-disc pl-5 space-y-2 marker:text-orange-500">
              <li><strong>To Provide the Service:</strong> To synchronize your watch progress, favorite lists, and preferences across devices using real-time database capabilities.</li>
              <li><strong>Smart Artificial Intelligence (AI):</strong> We process your watch history, favorites, and queries through integrated AI services (such as Google Gemini Analytics) to provide intelligent, hyper-personalized movie and series recommendations.</li>
              <li><strong>Community Interaction:</strong> To display your username and profile picture alongside your comments and reviews, fostering a community environment.</li>
              <li><strong>To Analyze and Improve:</strong> To monitor application performance, fix bugs, and analyze user interaction to design better features.</li>
            </ul>
          </section>

          <section className="bg-white/[0.02] p-6 rounded-2xl border border-white/[0.02]">
            <h2 className="text-xl font-medium text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center text-sm">3</span> 
              Data Storage and Security
            </h2>
            <p className="mb-4">
              Your data is securely stored on enterprise-grade infrastructure. We employ strict access controls and authenticated-only read/write constraints to prevent unauthorized access.
            </p>
            <p>
              While we use commercially reasonable safeguards to preserve the integrity and security of your personal information, we cannot guarantee the absolute security of any information you transmit or store on our databases.
            </p>
          </section>

          <section className="bg-white/[0.02] p-6 rounded-2xl border border-white/[0.02]">
            <h2 className="text-xl font-medium text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center text-sm">4</span> 
              Third-Party Services
            </h2>
            <p className="mb-2">
              Our website links to, aggregates, or utilizes third-party websites and services, including:
            </p>
            <ul className="list-disc pl-5 space-y-2 marker:text-red-500">
              <li><strong>Google Authentication:</strong> Used securely to authenticate your identity without handling native passwords.</li>
              <li><strong>Video Hosting Providers:</strong> We embed direct or intermediate video players. We have no control over the privacy practices of the servers that actually host the media files.</li>
              <li><strong>Link Shorteners (e.g., Linkvertise):</strong> You may encounter external link redirects. We are not responsible for the data collected by these third-party jump-links.</li>
            </ul>
          </section>

          <section className="bg-white/[0.02] p-6 rounded-2xl border border-white/[0.02]">
            <h2 className="text-xl font-medium text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center text-sm">5</span> 
              Your Rights
            </h2>
            <p>
              Depending on your jurisdiction, you have the right to access, edit, or permanently erase your personal data (including watch history and bookmarks) associated with your {BRAND_NAME} account. Currently, you can edit your profile information via the Dashboard. If you wish to request full account deletion, please contact platform administration.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export function TermsRoute({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-[#070404] text-white p-6 sm:p-12 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6 bg-[#0a0505] p-8 sm:p-12 rounded-[2rem] shadow-[0_0_40px_rgba(220,38,38,0.05)] border border-white/5 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-red-600/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-orange-500/10 rounded-full blur-[100px] pointer-events-none" />

        <button onClick={onBack} className="relative z-10 flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-6 text-sm font-medium uppercase tracking-wider">
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>

        <div className="relative z-50 border-b border-white/10 pb-8 mb-8">
          <h1 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 mb-4 tracking-tight drop-shadow-sm leading-normal py-2">Terms of Service</h1>
          <p className="text-sm font-medium text-white/50 font-mono tracking-widest uppercase">Effective Date: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="relative z-10 space-y-8 text-white/70 text-sm leading-loose">
           <section>
            <p className="text-base text-white/90">
              Welcome to <strong>{BRAND_NAME}</strong>. By accessing or using our platform, you agree to be bound by the following Terms of Service ("Terms"). Please read them carefully before using our software or services.
            </p>
          </section>

          <section className="bg-white/[0.02] p-6 rounded-2xl border border-white/[0.02]">
            <h2 className="text-xl font-medium text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-[10px] bg-red-500/10 text-red-500 flex items-center justify-center text-sm font-black italic">I</span> 
              Nature of the Service
            </h2>
            <p className="mb-4">
              {BRAND_NAME} operates purely as an aggregate and indexing utility. We provide a sophisticated user interface overlay, AI-driven contextual metadata, and a community layer wrapped around user-submitted or aggregated web links.
            </p>
            <p className="text-red-400 font-medium">
              CRITICAL DISCLAIMER: {BRAND_NAME} does NOT host, upload, or control any copyright-protected media, videos, movies, or series files on our own servers. All content is scraped, user-provided, or embedded dynamically from unaffiliated third-party file hosters (such as Google Drive, DropJiffy, StreamTape, etc).
            </p>
          </section>

          <section className="bg-white/[0.02] p-6 rounded-2xl border border-white/[0.02]">
            <h2 className="text-xl font-medium text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-[10px] bg-orange-500/10 text-orange-500 flex items-center justify-center text-sm font-black italic">II</span> 
              User Responsibilities & Conduct
            </h2>
            <ul className="list-disc pl-5 space-y-2 marker:text-orange-500">
              <li><strong>Account Standing:</strong> You are responsible for all activity conducted under your authenticated Google account and chosen username.</li>
              <li><strong>Community Guidelines:</strong> When utilizing the comments or community features, you agree not to harass, spam, or share explicitly illegal or offensive material. Violators will have their accounts terminated without warning.</li>
              <li><strong>System Integrity:</strong> Attempting to reverse-engineer, DDoS, inject malicious queries into our database, or bypass our routing restrictions is strictly forbidden.</li>
            </ul>
          </section>

          <section className="bg-white/[0.02] p-6 rounded-2xl border border-white/[0.02]">
            <h2 className="text-xl font-medium text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-[10px] bg-yellow-500/10 text-yellow-500 flex items-center justify-center text-sm font-black italic">III</span> 
              Copyright and DMCA Takedown
            </h2>
            <p className="mb-4 text-yellow-500/90 font-medium">
              We highly recommend that you support copyright owners by purchasing media legally so that copyright owners can continue to create.
            </p>
            <p className="mb-4">
              Since {BRAND_NAME} operates similarly to Google Search—merely indexing existing web resources—we cannot delete files from their respective, off-site servers. 
            </p>
            <p>
              However, we strictly respect the Digital Millennium Copyright Act (DMCA). If you are the rightful copyright owner and believe our metadata or embedded links infringe on your rights, please submit a formal DMCA takedown notice outlining the exact source URL(s). We will promptly delist the specified references from our database aggregator.
            </p>
          </section>

          <section className="bg-white/[0.02] p-6 rounded-2xl border border-white/[0.02]">
            <h2 className="text-xl font-medium text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-[10px] bg-red-500/10 text-red-500 flex items-center justify-center text-sm font-black italic">IV</span> 
              Limitations of Liability
            </h2>
            <p>
              The service is provided on an "AS IS" and "AS AVAILABLE" basis. To the maximum extent permitted by applicable law, {BRAND_NAME} and its administrators disclaim all warranties, whether express or implied. Under no circumstances shall {BRAND_NAME} be held liable for any direct, indirect, incidental, special, or consequential damages resulting from the use or inability to use the service, including damages caused by third-party advertisements or external links.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
