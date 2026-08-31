
import puppeteer from 'puppeteer';
import { setGlobalDispatcher, Agent } from 'undici';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { PDFParse } from 'pdf-parse';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

try {
  setGlobalDispatcher(new Agent({
    connect: {
      rejectUnauthorized: false
    },
    keepAliveTimeout: 30000,
    keepAliveMaxTimeout: 60000,
    pipelining: 10
  }));
} catch (e) {
  console.warn('Failed to set undici global dispatcher:', e);
}

const execAsync = promisify(exec);
import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { google } from "googleapis";
import { YoutubeTranscript } from "youtube-transcript";
import { translate } from "@vitalets/google-translate-api";
import { encryptPayload, decryptPayload } from "./src/utils/security";

dotenv.config();

// --- Segment Cache & Prefetch Systems for High Performance Streaming ---
interface CacheEntry {
  promise: Promise<{
    status: number;
    headers: Record<string, string>;
    data: Buffer;
  }>;
  timestamp: number;
}

const segmentCache = new Map<string, CacheEntry>();
const MAX_CACHE_ENTRIES = 120; // Cache up to 120 segments (~200-400MB max)

function getNextSegmentUrl(urlStr: string): string | null {
  try {
    const url = new URL(urlStr);
    const pathname = url.pathname;
    // Cocokkan pola angka sekuel di akhir nama file, contoh: seg-12.ts, segment12.ts, 12.ts
    const regex = /(\d+)(\.[a-zA-Z0-9]+)?$/;
    const match = pathname.match(regex);
    if (match) {
      const numStr = match[1];
      const ext = match[2] || '';
      const num = parseInt(numStr, 10);
      const nextNum = num + 1;
      // Pertahankan leading zero jika ada (contoh: 0012 -> 0013)
      const nextNumStr = nextNum.toString().padStart(numStr.length, '0');
      
      const newPathname = pathname.substring(0, match.index) + nextNumStr + ext;
      url.pathname = newPathname;
      return url.toString();
    }
  } catch (e) {}
  return null;
}

function prefetchNextSegments(urlStr: string, originalHeaders: Record<string, string>, count = 5) {
  let currentUrl = urlStr;
  for (let i = 0; i < count; i++) {
    const nextUrl = getNextSegmentUrl(currentUrl);
    if (!nextUrl) break;
    
    currentUrl = nextUrl;
    const cacheKey = nextUrl; // Prefetch selalu full-file, tanpa Range
    if (segmentCache.has(cacheKey)) continue; // Sudah ada di cache atau sedang di-fetch

    console.log(`[Prefetch] Proactively prefetching segment +${i + 1}: ${nextUrl}`);
    
    const headers = { ...originalHeaders };
    delete headers['Range'];
    delete headers['range'];

    const promise = (async () => {
      let response = await fetch(nextUrl, { headers });
      if (response.status === 403 || response.status === 401 || !response.ok) {
        const cleanHeaders = {
          'User-Agent': headers['User-Agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': '*/*'
        };
        response = await fetch(nextUrl, { headers: cleanHeaders });
      }
      if (!response.ok) {
        throw new Error(`Prefetch status ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const data = Buffer.from(arrayBuffer);
      
      const resHeaders: Record<string, string> = {};
      const contentType = response.headers.get('content-type');
      if (contentType) resHeaders['Content-Type'] = contentType;
      const contentLength = response.headers.get('content-length');
      if (contentLength) resHeaders['Content-Length'] = contentLength;
      const acceptRanges = response.headers.get('accept-ranges');
      if (acceptRanges) resHeaders['Accept-Ranges'] = acceptRanges;

      return {
        status: response.status,
        headers: resHeaders,
        data
      };
    })();

    const entry = {
      promise,
      timestamp: Date.now()
    };

    promise.catch(() => {
      segmentCache.delete(cacheKey); // Hapus jika gagal agar bisa di-retry saat direquest asli
    });

    // LRU Eviction
    if (segmentCache.size >= MAX_CACHE_ENTRIES) {
      let oldestKey = '';
      let oldestTime = Infinity;
      for (const [key, val] of segmentCache.entries()) {
        if (val.timestamp < oldestTime) {
          oldestTime = val.timestamp;
          oldestKey = key;
        }
      }
      if (oldestKey) {
        segmentCache.delete(oldestKey);
      }
    }

    segmentCache.set(cacheKey, entry);
  }
}

// --- Subtitle Parser Helpers ---

function parseSingleTimestamp(part: string): string {
  const clean = part.trim().replace(',', '.'); // WebVTT uses period instead of comma
  
  const parts = clean.split(':');
  let hh = '00';
  let mm = '00';
  let ss = '00';
  let mmm = '000';
  
  let secondsPart = parts[parts.length - 1];
  if (secondsPart.includes('.')) {
    const sParts = secondsPart.split('.');
    secondsPart = sParts[0];
    mmm = sParts[1].padEnd(3, '0').substring(0, 3);
  }
  
  ss = secondsPart.padStart(2, '0');
  
  if (parts.length === 3) {
    hh = parts[0].padStart(2, '0');
    mm = parts[1].padStart(2, '0');
  } else if (parts.length === 2) {
    mm = parts[0].padStart(2, '0');
  } else if (parts.length === 1) {
    ss = parts[0].padStart(2, '0');
  }
  
  return `${hh}:${mm}:${ss}.${mmm}`;
}

function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function parseTextLinesToVtt(lines: string[]): string {
  const cues: { startTime: string; endTime: string; text: string }[] = [];
  let activeCue: any = null;

  // matches formats like MM:SS - MM:SS, HH:MM:SS - HH:MM:SS, with separating hyphens/dashes, "to" or "-->"
  const timestampRegex = /^(\d{1,2}:)?\d{1,2}:\d{2}([.,]\d{1,3})?\s*(?:-|–|—|to|-->)\s*(\d{1,2}:)?\d{1,2}:\d{2}([.,]\d{1,3})?$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (timestampRegex.test(line)) {
      const parts = line.split(/\s*(?:-|–|—|to|-->)\s*/i);
      if (parts.length === 2) {
        const startTime = parseSingleTimestamp(parts[0]);
        const endTime = parseSingleTimestamp(parts[1]);
        activeCue = {
          startTime,
          endTime,
          text: ''
        };
        cues.push(activeCue);
      }
    } else if (activeCue) {
      const decodedLine = decodeHTMLEntities(line);
      if (activeCue.text) {
        activeCue.text += '\n' + decodedLine;
      } else {
        activeCue.text = decodedLine;
      }
    }
  }

  let vttText = 'WEBVTT\n\n';
  cues.forEach((cue) => {
    vttText += `${cue.startTime} --> ${cue.endTime}\n${cue.text}\n\n`;
  });
  return vttText;
}

async function convertDocxToVtt(buffer: Buffer): Promise<string> {
  const tempPath = `/tmp/docx_${Date.now()}_${Math.random().toString(36).substring(7)}.docx`;
  try {
    await fs.promises.writeFile(tempPath, buffer);
    const { stdout } = await execAsync(`unzip -p "${tempPath}" word/document.xml`);
    
    const ps = stdout.split('</w:p>');
    const paragraphs = ps.map(p => {
      const tRegex = /<w:t[^>]*>(.*?)<\/w:t>/gs;
      let match;
      let text = '';
      while ((match = tRegex.exec(p)) !== null) {
        text += match[1];
      }
      return text.trim();
    });
    
    return parseTextLinesToVtt(paragraphs);
  } catch (err: any) {
    console.error('Error converting DOCX to VTT:', err);
    throw err;
  } finally {
    try {
      if (fs.existsSync(tempPath)) {
        await fs.promises.unlink(tempPath);
      }
    } catch (e) {}
  }
}

async function convertPdfToVtt(buffer: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const textResult = await parser.getText();
    const text = textResult.text || '';
    const lines = text.split('\n');
    return parseTextLinesToVtt(lines);
  } catch (err: any) {
    console.error('Error converting PDF to VTT:', err);
    throw err;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Double Protection Cryptography Middleware
  // Transparently decrypts secure client payloads (_p) and encrypts outgoing API JSON payloads (_r)
  app.use((req, res, next) => {
    // 1. Decrypt request body (POST/PUT/DELETE payloads)
    if (req.body && req.body._p) {
      try {
        const decrypted = decryptPayload(req.body._p);
        req.body = JSON.parse(decrypted);
      } catch (err: any) {
        console.error("[Security] Error decrypting request body:", err.message);
      }
    }

    // 2. Decrypt query parameters (GET parameters)
    if (req.query && typeof req.query._p === "string") {
      try {
        const decrypted = decryptPayload(req.query._p as string);
        const parsed = JSON.parse(decrypted);
        const newQuery = { ...req.query, ...parsed };
        delete newQuery._p;
        Object.defineProperty(req, "query", {
          value: newQuery,
          writable: true,
          configurable: true,
          enumerable: true
        });
      } catch (err: any) {
        console.error("[Security] Error decrypting request query:", err.message);
      }
    }

    // 3. Intercept res.json to automatically encrypt outgoing JSON payloads
    const originalJson = res.json;
    res.json = function (obj) {
      const isApi = req.url.startsWith("/api/") && 
                    !req.url.startsWith("/api/public-assets") && 
                    !req.url.startsWith("/api/health");
      if (isApi && obj && !obj._r) {
        try {
          const encrypted = encryptPayload(JSON.stringify(obj));
          return originalJson.call(this, { _r: encrypted });
        } catch (err: any) {
          console.error("[Security] Error encrypting response JSON:", err.message);
        }
      }
      return originalJson.call(this, obj);
    };

    // 4. Intercept res.send to encrypt any JSON-string responses
    const originalSend = res.send;
    res.send = function (body) {
      const isApi = req.url.startsWith("/api/") && 
                    !req.url.startsWith("/api/public-assets") && 
                    !req.url.startsWith("/api/health");
      if (isApi && typeof body === "string" && !body.startsWith('{"_r"')) {
        const isJson = body.trim().startsWith("{") || body.trim().startsWith("[");
        if (isJson) {
          try {
            const encrypted = encryptPayload(body);
            res.setHeader("Content-Type", "application/json");
            return originalSend.call(this, JSON.stringify({ _r: encrypted }));
          } catch (err: any) {
            console.error("[Security] Error encrypting response send:", err.message);
          }
        }
      }
      return originalSend.call(this, body);
    };

    next();
  });

  // Health check routes for Cloud Run / service status verification
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/health", (req, res) => {
    res.status(200).send("OK");
  });

  app.get("/healthz", (req, res) => {
    res.status(200).send("OK");
  });

  // Dynamic YouTube SRT generation & translation API
  app.get("/api/youtube-srt", async (req, res) => {
    const { videoId } = req.query;
    if (!videoId || typeof videoId !== "string") {
      return res.status(400).json({ error: "Missing videoId" });
    }

    try {
      // 1. Fetch transcript from youtube
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
      
      let srtOutput = "";
      
      // We will generate the SRT format
      const texts = transcript.map(t => t.text);
      const translatedTexts: string[] = [];

      // Bulk translate in chunks of 30 to avoid payload limits
      const chunkSize = 30;
      for (let i = 0; i < texts.length; i += chunkSize) {
          const chunk = texts.slice(i, i + chunkSize);
          const chunkString = chunk.join(' \n\n '); // use a safe separator
          try {
             const res = await translate(chunkString, { to: 'id' });
             const translatedChunk = res.text.split(' \n\n ');
             // Push them. If lengths mismatch due to translate stripping newline, we fallback to original
             if (translatedChunk.length === chunk.length) {
                 translatedTexts.push(...translatedChunk);
             } else {
                 translatedTexts.push(...chunk); // fallback
             }
          } catch(e) {
             console.error("Bulk translate error:", e);
             translatedTexts.push(...chunk); // fallback
          }
      }

      for (let i = 0; i < transcript.length; i++) {
        const t = transcript[i];
        
        // Format timestamps (srt needs HH:MM:SS,MMM)
        const formatTime = (msSinceStart: number) => {
          const totalSeconds = msSinceStart / 1000;
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = Math.floor(totalSeconds % 60);
          const ms = Math.floor(msSinceStart % 1000);
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
        };

        const startTime = formatTime(t.offset);
        const endTime = formatTime(t.offset + t.duration);

        let translatedText = translatedTexts[i] || t.text;

        srtOutput += `${i + 1}\n`;
        srtOutput += `${startTime} --> ${endTime}\n`;
        srtOutput += `${translatedText}\n\n`;
      }

      res.setHeader('Content-Type', 'text/srt; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${videoId}_indo.srt"`);
      res.send(srtOutput);
      
    } catch (error: any) {
      console.error("SRT Fetch failed", error);
      res.status(500).json({ error: error.message });
    }
  });

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_URL || "http://localhost:3000"}/auth/callback`
  );

  const getRedirectUri = (req: express.Request) => {
    // Detect from headers first for dynamic environments
    const host = req.headers.host;
    if (host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
      const protocol = req.headers["x-forwarded-proto"] || "https";
      return `${protocol}://${host}/auth/callback`;
    }
    // Fallback to APP_URL or localhost
    if (process.env.APP_URL) {
      return `${process.env.APP_URL.replace(/\/$/, "")}/auth/callback`;
    }
    return `http://localhost:3000/auth/callback`;
  };

  // Google Auth Endpoints
  app.get("/api/auth/google/url", (req, res) => {
    const redirectUri = getRedirectUri(req);
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const url = client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/drive.appdata",
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive"
      ],
      prompt: "consent select_account",
    });
    res.json({ url, redirectUri }); 
  });

  app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;
    try {
      const redirectUri = getRedirectUri(req);
      const client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
      );

      const { tokens } = await client.getToken(code as string);
      // In a real app, you'd store tokens in a database/session.
      // Here we'll pass it back to the window to store in localStorage for simplicity in this demo.
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'GOOGLE_AUTH_SUCCESS', 
                  tokens: ${JSON.stringify(tokens)} 
                }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. You can close this window.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Token exchange failed", error);
      res.status(500).send("Authentication failed");
    }
  });

  // Drive Sync Endpoints
  app.post("/api/drive/sync", async (req, res) => {
    const { tokens, data } = req.body;
    if (!tokens) return res.status(401).json({ error: "Missing tokens" });

    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials(tokens);

    const drive = google.drive({ version: "v3", auth });

    try {
      console.log("Checking for existing backup file in appDataFolder...");
      // Find existing file in appDataFolder
      const listRes = await drive.files.list({
        spaces: "appDataFolder",
        q: "name = 'viyie_data.json'",
        fields: "files(id, name)"
      });

      const fileMetadata = {
        name: "viyie_data.json",
        parents: ["appDataFolder"]
      };

      const media = {
        contentType: "application/json",
        body: JSON.stringify(data)
      };

      if (listRes.data.files && listRes.data.files.length > 0) {
        // Update existing
        const fileId = listRes.data.files[0].id!;
        console.log(`Updating existing backup file: ${fileId}`);
        await drive.files.update({
          fileId,
          media
        });
      } else {
        // Create new
        console.log("Creating new backup file in appDataFolder");
        await drive.files.create({
          requestBody: fileMetadata,
          media,
          fields: "id"
        });
      }
      res.json({ success: true });
    } catch (error: any) {
      const errorDetail = error.response?.data || error.message;
      console.error("Drive sync backend error detail:", JSON.stringify(errorDetail, null, 2));
      res.status(500).json({ 
        error: error.message, 
        details: errorDetail 
      });
    }
  });

  app.post("/api/drive/load", async (req, res) => {
    const { tokens } = req.body;
    if (!tokens) return res.status(401).json({ error: "Missing tokens" });

    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials(tokens);

    const drive = google.drive({ version: "v3", auth });

    try {
      console.log("Loading backup file from appDataFolder...");
      const listRes = await drive.files.list({
        spaces: "appDataFolder",
        q: "name = 'viyie_data.json'",
        fields: "files(id, name)"
      });

      if (listRes.data.files && listRes.data.files.length > 0) {
        const fileId = listRes.data.files[0].id!;
        console.log(`Getting file content for: ${fileId}`);
        const fileRes = await drive.files.get({
          fileId,
          alt: "media"
        });
        res.json({ data: fileRes.data });
      } else {
        console.log("No backup file found in appDataFolder");
        res.json({ data: null, message: "No backup found" });
      }
    } catch (error: any) {
      const errorDetail = error.response?.data || error.message;
      console.error("Drive load backend error detail:", JSON.stringify(errorDetail, null, 2));
      res.status(500).json({ 
        error: error.message, 
        details: errorDetail 
      });
    }
  });

  // Secure Admin Login API
  app.post("/api/admin/verify", (req, res) => {
    const { username, password } = req.body;
    
    // Credentials from environment
    const validUser = process.env.ADMIN_USER || "firefury";
    const validPass = process.env.ADMIN_PASS || "FireFury01pr00";

    if (username === validUser && password === validPass) {
      res.json({ success: true, token: "secure_admin_session_placeholder" });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  });

  // IMDb Auto-fill API using TMDB
  app.get("/api/imdb/:imdbId", async (req, res) => {
    const { imdbId } = req.params;
    const apiKey = process.env.TMDB_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "TMDB_API_KEY is not configured in server environment. Please set it in Settings." });
    }

    try {
      // 1. Find the TMDB ID from IMDb ID
      const findRes = await fetch(`https://api.themoviedb.org/3/find/${imdbId}?api_key=${apiKey}&external_source=imdb_id`);
      
      if (!findRes.ok) {
        const err = await findRes.json().catch(() => ({}));
        return res.status(findRes.status).json({ error: err.status_message || "TMDB Find API failed" });
      }

      const findData: any = await findRes.json();

      let result: any = null;
      let type: "movie" | "tv" = "movie";

      if (findData.movie_results && findData.movie_results.length > 0) {
        result = findData.movie_results[0];
        type = "movie";
      } else if (findData.tv_results && findData.tv_results.length > 0) {
        result = findData.tv_results[0];
        type = "tv";
      } else if (findData.tv_episode_results && findData.tv_episode_results.length > 0) {
        // If it's an episode ID, we treat it as a TV show reference for simplicity or notify user
        result = findData.tv_episode_results[0];
        // We need the series ID for episodes usually, but for now let's just use the episode's series name
        type = "tv";
      }

      if (!result) {
        return res.status(404).json({ error: "Content not found on TMDB with this IMDb ID. Double check the ID." });
      }

      // 2. Fetch full details (including credits)
      // Note: If result came from tv_episode_results, the ID is the episode id.
      // TMDB details endpoint for episodes is /tv/{series_id}/season/{season_number}/episode/{episode_number}
      // For simplicity in auto-fill, we usually want the SERIES or MOVIE.
      
      let detailsUrl = `https://api.themoviedb.org/3/${type}/${result.id}?api_key=${apiKey}&append_to_response=credits`;
      
      // Special case: if it was an episode, we might want the series details instead if that's what the user expects
      // But let's stick to movie/tv types for now.
      
      const detailsRes = await fetch(detailsUrl);
      if (!detailsRes.ok) {
        return res.status(detailsRes.status).json({ error: "Failed to fetch details from TMDB" });
      }

      const details: any = await detailsRes.json();

      // 3. Format the response for our dashboard
      const formattedData = {
        title: details.title || details.name,
        synopsis: details.overview,
        releaseDate: details.release_date || details.first_air_date,
        rating: details.vote_average ? details.vote_average.toFixed(1) : "0",
        poster: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : "",
        backdrop: details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : "",
        genres: details.genres ? details.genres.map((g: any) => g.name) : [],
        type: type,
        duration: type === "movie" && details.runtime ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` : "",
        cast: details.credits?.cast?.slice(0, 10).map((c: any) => c.name) || [], // Up to 10 cast members
      };

      res.json(formattedData);
    } catch (error: any) {
      console.error("TMDB error:", error);
      res.status(500).json({ error: "Internal Server Error fetching from TMDB" });
    }
  });

  // Generic proxy for scraper bots in Admin Panel
  app.get("/api/scraper/proxy", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing URL parameter", details: req.query });
    }

    try {
      let host = "";
      let origin = "";
      try {
        const u = new URL(url);
        host = u.hostname;
        origin = u.origin;
      } catch (e) {}

      const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache"
      };

      if (origin) {
        headers["Referer"] = origin + "/";
      }

      const response = await fetch(url, { headers });
      if (!response.ok) {
        console.warn(`Scraper proxy fetch of URL '${url}' resulted in status ${response.status}`);
        return res.status(response.status).send(`Fetch failed with status ${response.status}. Reason: ${response.statusText}`);
      }
      const html = await response.text();
      res.send(html);
    } catch (error: any) {
      console.error("Proxy fetch failed:", error);
      res.status(500).send(error.message);
    }
  });

  // NEW: Anoboy Scraper Parser
  app.get("/api/scraper/parse-anoboy", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing URL parameter" });
    }

    try {
      const response = await fetch(url as string, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        }
      });
      const html = await response.text();
      const cheerio = await import("cheerio");
      const $ = cheerio.load(html);

      // Example parsing logic based on Anoboy structure - needs to be robust
      const title = $("h1.entry-title").text();
      const synopsis = $(".entry-content p").first().text() || $(".entry-content").text(); 
      
      // Simplified parsing for rating, director, cast
      // This assumes some common structure.
      const contentText = $(".entry-content").text();
      
      res.json({
          title,
          synopsis: synopsis.trim(),
          rating: "0.0", // Harder to parse, maybe use TMDB for this later
      });
    } catch (error: any) {
      console.error("Anoboy parse failed:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // NEW: Generic Scraper Parser
  app.get("/api/scraper/fetch-episode-servers", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing URL parameter" });
    }

    try {
      const response = await fetch(url as string, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        }
      });
      const html = await response.text();
      const cheerio = await import("cheerio");
      const $ = cheerio.load(html);

      const servers: { name: string; embedUrl: string }[] = [];

      // Generic selector finding for typical anime sites
      // Look for iframes or specific player containers
      $("iframe").each((i, el) => {
          const src = $(el).attr("src");
          if (src && !src.toLowerCase().includes("premium")) {
              let name = "VideoPlayer";
              if (src.includes("ok.ru")) name = "OKRu";
              else if (src.includes("dailymotion")) name = "Dailymotion";
              else if (src.includes("youtube")) name = "PLAY1";
              
              servers.push({
                  name,
                  embedUrl: src
              });
          }
      });
      
      const titleRaw = $("h1").text().trim() || $("title").text().trim();
      let dateUploadRaw = $("time").attr("datetime") || $(".entry-date").text().trim() || new Date().toISOString();
      
      // Parse Indonesian date format "Month DD, YYYY" if applicable
      const monthMap: Record<string, string> = {
          "Januari": "Jan", "Februari": "Feb", "Maret": "Mar", "April": "Apr", "Mei": "Mei", "Juni": "Jun",
          "Juli": "Jul", "Agustus": "Agu", "September": "Sep", "Oktober": "Okt", "November": "Nov", "Desember": "Des"
      };

      let dateUpload = dateUploadRaw;
      
      // Try to find a date pattern in the text
      const dateMatch = dateUploadRaw.match(/([a-zA-Z]+)\s+(\d{1,2}),\s+(\d{4})/);
      if (dateMatch) {
          const [_, month, day, year] = dateMatch;
          if (monthMap[month]) {
              dateUpload = `${day} ${monthMap[month]} ${year}`;
          }
      } else {
          // If not in that format, try to keep it as simple YYYY-MM-DD
          dateUpload = new Date(dateUploadRaw).toISOString().split('T')[0];
      }

      // Remove date from title if it's found in the title
      let title = titleRaw;
      if (dateMatch) {
          const dateString = dateMatch[0];
          title = title.replace(dateString, "").trim();
      }

      res.json({
          title,
          servers,
          dateUpload
      });
    } catch (error: any) {
      console.error("Scraper failed:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Public Assets Management APIs
  app.post("/api/public-assets/upload", async (req, res) => {
    const { name, data: base64Data } = req.body;
    if (!name || !base64Data) return res.status(400).json({ error: "Missing name or data" });

    try {
      const publicDir = path.join(process.cwd(), "public");
      if (!fs.existsSync(publicDir)) {
         fs.mkdirSync(publicDir, { recursive: true });
      }
      
      const fileName = name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const destPath = path.join(publicDir, fileName);
      
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const buffer = Buffer.from(matches[2], "base64");
        fs.writeFileSync(destPath, buffer);
      } else {
        fs.writeFileSync(destPath, base64Data);
      }
      
      res.json({ success: true, url: `/${fileName}` });
    } catch(err: any) {
      console.error("Public asset upload error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/public-assets", (req, res) => {
    try {
      const publicDir = path.join(process.cwd(), "public");
      if (!fs.existsSync(publicDir)) {
        return res.json([]);
      }
      
      const files = fs.readdirSync(publicDir);
      const result: any[] = [];
      for (const f of files) {
        const filePath = path.join(publicDir, f);
        const stat = fs.statSync(filePath);
        if (!stat.isDirectory()) {
          result.push({
            id: `pub_${f}`,
            name: f,
            type: f.endsWith(".mp4") ? "video" : f.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? "image" : "other",
            size: stat.size,
            createdAt: stat.birthtimeMs,
            url: `/${f}`,
            path: "/",
            isLocalHost: true
          });
        }
      }
      res.json(result);
    } catch(err: any) {
      console.error("Public asset fetch error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/public-assets/:name", (req, res) => {
    try {
      const fileName = req.params.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const filePath = path.join(process.cwd(), "public", fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      res.json({ success: true });
    } catch(err: any) {
       console.error("Public asset delete error:", err);
       res.status(500).json({ error: err.message });
    }
  });

  // HLS M3U8 & Segment proxy to bypass CORS/Referrer blocks for Dailymotion and others
  app.get("/api/public-assets/m3u8-proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).send("Missing target m3u8 stream URL param");
    }

    try {
      const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Referer": "https://www.dailymotion.com/",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
      };

      if (req.headers.range) {
        headers["Range"] = req.headers.range as string;
      }

      const fetchRes = await fetch(targetUrl, { headers });
      if (!fetchRes.ok) {
        return res.status(fetchRes.status).send(`Failed fetching original stream source: ${fetchRes.statusText}`);
      }

      const contentType = fetchRes.headers.get("content-type") || "";
      const isPlaylist = targetUrl.toLowerCase().includes(".m3u8") || 
                         targetUrl.toLowerCase().includes(".m3u") || 
                         contentType.toLowerCase().includes("mpegurl") || 
                         contentType.toLowerCase().includes("application/x-mpegurl");

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "*");

      if (isPlaylist) {
        let manifestContent = await fetchRes.text();
        const lines = manifestContent.split("\n");
        const rewrittenLines = lines.map(line => {
          const trimmed = line.trim();
          if (trimmed.startsWith("#") && !trimmed.includes("URI=")) {
            return line;
          }

          // Case 1: Tag holding URI="..." e.g. #EXT-X-MEDIA or #EXT-X-KEY
          if (trimmed.includes("URI=\"")) {
            const uriMatch = line.match(/URI="([^"]+)"/);
            if (uriMatch && uriMatch[1]) {
              let absoluteUri = uriMatch[1];
              if (!absoluteUri.startsWith("http://") && !absoluteUri.startsWith("https://")) {
                absoluteUri = new URL(absoluteUri, targetUrl).toString();
              }
              const proxied = `/api/public-assets/m3u8-proxy?url=${encodeURIComponent(absoluteUri)}`;
              return line.replace(/URI="[^"]+"/, `URI="${proxied}"`);
            }
          }

          // Case 2: Standard individual segment line
          if (trimmed && !trimmed.startsWith("#")) {
            let absoluteUri = trimmed;
            if (!absoluteUri.startsWith("http://") && !absoluteUri.startsWith("https://")) {
              absoluteUri = new URL(absoluteUri, targetUrl).toString();
            }
            return `/api/public-assets/m3u8-proxy?url=${encodeURIComponent(absoluteUri)}`;
          }

          return line;
        });

        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        return res.send(rewrittenLines.join("\n"));
      } else {
        // Serve media chunk or key fragment back directly
        if (fetchRes.headers.get("content-type")) {
          res.setHeader("Content-Type", fetchRes.headers.get("content-type")!);
        }
        if (fetchRes.headers.get("content-length")) {
          res.setHeader("Content-Length", fetchRes.headers.get("content-length")!);
        }
        if (fetchRes.headers.get("content-range")) {
          res.setHeader("Content-Range", fetchRes.headers.get("content-range")!);
        }

        const arrayBuffer = await fetchRes.arrayBuffer();
        return res.send(Buffer.from(arrayBuffer));
      }
    } catch (err: any) {
      console.error("[m3u8-proxy] Proxy stream handler failed:", err);
      return res.status(500).send("Proxy Server Stream Exception: " + err.message);
    }
  });

app.get('/api/proxy-subtitle', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl || typeof targetUrl !== 'string') {
      res.status(400).send('Missing target subtitle URL');
      return;
    }

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      res.status(400).send('Only absolute HTTP or HTTPS URLs can be proxied');
      return;
    }

    try {
      let resolvedUrl = targetUrl;

      // If the URL goes through cors-proxy.fsh.app, bypass it on the server-side proxy
      if (resolvedUrl.startsWith('https://cors-proxy.fsh.app/')) {
        resolvedUrl = resolvedUrl.replace('https://cors-proxy.fsh.app/', '');
      }

      // Handle Dropbox URLs specifically
      if (resolvedUrl.includes('dropbox.com')) {
        // Replace dl=0 with dl=1 to get direct file link
        resolvedUrl = resolvedUrl.replace('dl=0', 'dl=1');
        
        // Also map www.dropbox.com to dl.dropboxusercontent.com if needed
        if (resolvedUrl.includes('www.dropbox.com')) {
          resolvedUrl = resolvedUrl.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
        }
      }

      // Handle Google Drive / Google Docs URLs specifically
      if (resolvedUrl.includes('drive.google.com') || resolvedUrl.includes('docs.google.com')) {
        const idMatch = resolvedUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        const fileIdMatch = resolvedUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        const fileId = (fileIdMatch && fileIdMatch[1]) || (idMatch && idMatch[1]);
        if (fileId) {
          resolvedUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
      }

      console.log(`[Proxy] Fetching subtitle from: ${resolvedUrl}`);

      const response = await fetch(resolvedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        if (response.status === 410) {
          console.warn(`[Proxy Warning] Upstream subtitle link has expired (410 Gone): ${resolvedUrl}`);
          res.status(410).send('Subtitle file link has expired (410 Gone). Please update the link in the Admin panel.');
          return;
        }
        throw new Error(`Failed to fetch subtitle: ${response.statusText} (${response.status})`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      const urlLower = resolvedUrl.split('?')[0].toLowerCase();
      const isDocx = urlLower.endsWith('.docx') || contentType.includes('wordprocessingml') || contentType.includes('docx');
      const isPdf = urlLower.endsWith('.pdf') || contentType.includes('pdf');

      let vttContent = '';
      if (isDocx) {
        console.log('[Proxy] Converting fetched DOCX subtitle to VTT...');
        vttContent = await convertDocxToVtt(buffer);
      } else if (isPdf) {
        console.log('[Proxy] Converting fetched PDF subtitle to VTT...');
        vttContent = await convertPdfToVtt(buffer);
      } else {
        // Plain text (SRT/VTT)
        vttContent = buffer.toString('utf8');
      }

      // Ensure appropriate headers are set to bypass CORS and prevent caching on server side
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      
      res.send(vttContent);
    } catch (error: any) {
      console.warn(`[Proxy Info] Unable to retrieve subtitle from upstream: ${error.message}`);
      res.status(500).send(`Error proxying subtitle: ${error.message}`);
    }
  });

  // Convert uploaded local DOCX or PDF files to standard WebVTT on-the-fly
  app.post('/api/convert-local-subtitle', async (req, res) => {
    const { filename, base64 } = req.body;
    if (!base64 || !filename) {
      res.status(400).send('Missing base64 data or filename');
      return;
    }

    try {
      const buffer = Buffer.from(base64, 'base64');
      const ext = filename.split('.').pop()?.toLowerCase();
      
      let vttContent = '';
      if (ext === 'docx') {
        console.log(`[Local Convert] Converting uploaded DOCX to VTT: ${filename}`);
        vttContent = await convertDocxToVtt(buffer);
      } else if (ext === 'pdf') {
        console.log(`[Local Convert] Converting uploaded PDF to VTT: ${filename}`);
        vttContent = await convertPdfToVtt(buffer);
      } else {
        vttContent = buffer.toString('utf8');
      }

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      res.send(vttContent);
    } catch (err: any) {
      console.error('[Local Convert Error] failed:', err);
      res.status(500).send(`Failed to convert subtitle: ${err.message}`);
    }
  });

  // Audio Only (Quota Saver) proxy using FFmpeg stream
  app.get('/api/proxy-audio-only', (req, res) => {
    const rawTargetUrl = req.query.url;
    const ss = typeof req.query.ss === 'string' ? req.query.ss : '0';
    
    if (!rawTargetUrl || typeof rawTargetUrl !== 'string') {
      res.status(400).send('Missing target URL');
      return;
    }

    // Clean and sanitize target URL
    let targetUrl = rawTargetUrl.trim().replace(/\s+/g, '');
    while (targetUrl.endsWith('.')) {
      targetUrl = targetUrl.slice(0, -1).trim();
    }

    // If it is a relative path (like /api/proxy-playlist...), resolve with the local host
    if (targetUrl.startsWith('/')) {
      targetUrl = `http://127.0.0.1:3000${targetUrl}`;
    }

    let originStr = '';
    try {
      originStr = new URL(targetUrl).origin;
    } catch (e) {}

    const headersList: string[] = [];
    if (originStr) {
      headersList.push(`Referer: ${originStr}/`);
      headersList.push(`Origin: ${originStr}`);
    }
    const headersString = headersList.length > 0 ? (headersList.join('\r\n') + '\r\n') : '';

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Accept-Ranges', 'none');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    const args = [
      '-loglevel', 'warning',
      '-protocol_whitelist', 'file,http,https,tcp,tls,crypto,hls,concat',
      '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ];

    if (headersString) {
      args.push('-headers', headersString);
    }

    args.push(
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5'
    );

    // Apply seeking before input for fast seek
    args.push('-ss', ss);

    // Specify input URL
    args.push('-i', targetUrl);

    // Output options
    args.push(
      '-vn',
      '-map', '0:a:0?',
      '-err_detect', 'ignore_err',
      '-ignore_unknown',
      '-acodec', 'libmp3lame',
      '-ar', '44100',
      '-ac', '2',
      '-b:a', '128k',
      '-f', 'mp3',
      '-'
    );

    console.log(`[FFmpeg Audio Only] Spawning: ffmpeg ${args.join(' ')}`);

    const ffmpegProcess = spawn('ffmpeg', args);

    if (ffmpegProcess.stdout) {
      ffmpegProcess.stdout.pipe(res);
    }

    let stderrBuffer = '';
    if (ffmpegProcess.stderr) {
      ffmpegProcess.stderr.on('data', (data: any) => {
        stderrBuffer += data.toString();
      });
    }

    req.on('close', () => {
      ffmpegProcess.kill('SIGKILL');
    });

    ffmpegProcess.on('error', (err: any) => {
      console.error('[FFmpeg Audio Only Error] spawn error:', err);
      if (!res.headersSent) {
        res.status(500).send('FFmpeg spawning error');
      }
    });

    ffmpegProcess.on('exit', (code, signal) => {
      if (code !== null && code !== 0 && code !== 255) { // 255 is often SIGKILL when connection closes
        console.error(`[FFmpeg Audio Only Error] process exited with code ${code}, signal: ${signal}`);
        console.error(`[FFmpeg Audio Only Error] Stderr output:\n${stderrBuffer}`);
      }
    });
  });

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // API Country Detection using Cloudflare, Vercel or other proxy IP country headers
  app.get('/api/detect-country', (req, res) => {
    const country = (req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || req.headers['x-country-code'] || '').toString().toUpperCase();
    res.json({ country });
  });

  // API Language / Locale Detection with Server GeoIP & Accept-Language detection
  app.get('/api/detect-lang', (req, res) => {
    const country = (req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || req.headers['x-country-code'] || '').toString().toUpperCase();
    const acceptLang = (req.headers['accept-language'] || '').toString().toLowerCase();

    let lang = 'GB'; // Default English

    if (country === 'ID' || acceptLang.includes('id')) {
      lang = 'ID';
    } else if (country === 'MY' || acceptLang.includes('ms') || acceptLang.includes('my')) {
      lang = 'MY';
    } else if (country === 'JP' || acceptLang.includes('ja') || acceptLang.includes('jp')) {
      lang = 'JP';
    } else if (country === 'CN' || acceptLang.includes('zh') || acceptLang.includes('cn')) {
      lang = 'CN';
    } else if (country === 'IN' || acceptLang.includes('hi') || acceptLang.includes('in')) {
      lang = 'HI'; // Hindi
    }
    
    res.json({ lang, country, acceptLang });
  });

  // Same-Origin Interactive Iframe Proxy with Media Interceptor Injection
  app.get('/api/proxy-iframe', async (req, res) => {
    const rawTargetUrl = req.query.url;
    if (!rawTargetUrl || typeof rawTargetUrl !== 'string') {
      res.status(400).send('Missing target URL');
      return;
    }

    let targetUrl = rawTargetUrl.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      res.status(400).send('Only absolute HTTP or HTTPS URLs can be proxied');
      return;
    }

    try {
      console.log(`[Iframe Proxy] Loading page: ${targetUrl}`);
      
      let originStr = '';
      try {
        originStr = new URL(targetUrl).origin;
      } catch (e) {}

      // Fetch the page content from upstream
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          ...(originStr ? {
            'Referer': `${originStr}/`,
            'Origin': originStr
          } : {})
        }
      });

      if (!response.ok) {
        // If fetch fails, try with clean headers
        const retryResponse = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        if (!retryResponse.ok) {
          throw new Error(`Upstream returned ${retryResponse.status} ${retryResponse.statusText}`);
        }
        res.status(retryResponse.status);
      } else {
        res.status(response.status);
      }

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      
      // If it is not HTML, send raw buffer
      if (!contentType.includes('text/html')) {
        res.setHeader('Content-Type', contentType || 'application/octet-stream');
        res.setHeader('Access-Control-Allow-Origin', '*');
        const arrayBuffer = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
        return;
      }

      // If it is HTML, we process it and inject our same-origin interceptor
      let html = await response.text();

      // 1. Inject <base> tag to resolve relative paths
      const baseTag = `<base href="${targetUrl}">`;
      const headIndex = html.indexOf('<head>');
      if (headIndex !== -1) {
        html = html.substring(0, headIndex + 6) + baseTag + html.substring(headIndex + 6);
      } else {
        html = baseTag + html;
      }

      // 2. Inject Same-Origin Interceptor Script
      const interceptorScript = `
<script id="viyie-interceptor">
(function() {
  console.log('[Viyie Interceptor] Active inside iframe:', window.location.href);

  const realParent = window.parent;
  const realTop = window.top;

  // Pretend to be top window to bypass frame-busting scripts
  try {
    Object.defineProperty(window, 'self', { get: function() { return window; }, configurable: true });
    Object.defineProperty(window, 'top', { get: function() { return window; }, configurable: true });
    Object.defineProperty(window, 'parent', { get: function() { return window; }, configurable: true });
  } catch (e) {
    console.warn('[Viyie Interceptor] Failed to mock window environment properties:', e);
  }
  
  function reportCaptured(url, type) {
    if (!url) return;
    try {
      const absoluteUrl = new URL(url, window.location.href).toString();
      console.log('[Viyie Interceptor] Captured:', type, absoluteUrl);
      
      // Send to the real parent window (Admin panel)
      realParent.postMessage({
        type: 'captured-media',
        url: absoluteUrl,
        mediaType: type
      }, '*');

      // Also double-post if there are nested frames
      if (realParent !== window) {
        realParent.postMessage({
          type: 'captured-media',
          url: absoluteUrl,
          mediaType: type
        }, '*');
      }
    } catch (e) {
      console.error('[Viyie Interceptor] Error posting:', e);
    }
  }

  function shouldProxy(url) {
    if (!url) return false;
    try {
      const parsed = new URL(url, window.location.href);
      if (parsed.origin === window.location.origin) {
        return false;
      }
      if (!parsed.protocol.startsWith('http')) {
        return false;
      }
      return true;
    } catch(e) {
      return false;
    }
  }

  function getProxiedUrl(url) {
    if (shouldProxy(url)) {
      return window.location.origin + '/api/proxy-iframe?url=' + encodeURIComponent(new URL(url, window.location.href).toString());
    }
    return url;
  }

  // Intercept fetch
  const originalFetch = window.fetch;
  window.fetch = async function(input, init) {
    let url = '';
    let isGet = true;
    if (init && init.method && init.method.toUpperCase() !== 'GET') {
      isGet = false;
    }
    
    if (typeof input === 'string') {
      url = input;
      if (isGet && shouldProxy(url)) {
        input = getProxiedUrl(url);
      }
    } else if (input && typeof input === 'object' && input.url) {
      url = input.url;
      if (isGet && shouldProxy(url)) {
        try {
          input = new Request(getProxiedUrl(url), input);
        } catch(e) {}
      }
    }
    
    if (url) {
      const lower = url.toLowerCase();
      if (lower.includes('.m3u8') || lower.includes('.mpd') || lower.includes('/playlist')) {
        reportCaptured(url, 'hls');
      } else if (lower.includes('.vtt') || lower.includes('.srt') || lower.includes('.ass')) {
        reportCaptured(url, 'subtitle');
      }
    }
    return originalFetch.call(this, input, init);
  };

  // Intercept XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
    if (url && typeof url === 'string') {
      const lower = url.toLowerCase();
      if (lower.includes('.m3u8') || lower.includes('.mpd') || lower.includes('/playlist')) {
        reportCaptured(url, 'hls');
      } else if (lower.includes('.vtt') || lower.includes('.srt') || lower.includes('.ass')) {
        reportCaptured(url, 'subtitle');
      }
      
      const isGet = !method || method.toUpperCase() === 'GET';
      if (isGet && shouldProxy(url)) {
        url = getProxiedUrl(url);
      }
    }
    return originalOpen.call(this, method, url, async, user, password);
  };

  // Override iframe src descriptor to proxy dynamic sub-iframes
  try {
    const originalIframeSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
    if (originalIframeSrcDescriptor && originalIframeSrcDescriptor.set) {
      Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
        set: function(val) {
          if (val && typeof val === 'string' && val.startsWith('http') && !val.includes('/api/proxy-iframe')) {
            const proxiedSrc = window.location.origin + '/api/proxy-iframe?url=' + encodeURIComponent(val);
            originalIframeSrcDescriptor.set.call(this, proxiedSrc);
          } else {
            originalIframeSrcDescriptor.set.call(this, val);
          }
        },
        get: function() {
          const val = originalIframeSrcDescriptor.get.call(this);
          if (val && val.includes('/api/proxy-iframe?url=')) {
            try {
              const urlObj = new URL(val);
              return urlObj.searchParams.get('url') || val;
            } catch(e) {}
          }
          return val;
        }
      });
    }
  } catch (e) {}

  // Override document.createElement to hook programmatically added iframes
  try {
    const originalCreateElement = document.createElement;
    document.createElement = function(tagName, options) {
      const el = originalCreateElement.call(this, tagName, options);
      if (tagName && tagName.toLowerCase() === 'iframe') {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
              const src = el.getAttribute('src');
              if (src && src.startsWith('http') && !src.includes('/api/proxy-iframe')) {
                el.setAttribute('src', window.location.origin + '/api/proxy-iframe?url=' + encodeURIComponent(src));
              }
            }
          });
        });
        observer.observe(el, { attributes: true, attributeFilter: ['src'] });
      }
      return el;
    };
  } catch (e) {}

  // Periodically inspect media elements
  setInterval(() => {
    document.querySelectorAll('video').forEach(video => {
      if (video.src) {
        const lower = video.src.toLowerCase();
        if (lower.includes('.m3u8') || lower.includes('.mpd')) {
          reportCaptured(video.src, 'hls');
        }
      }
      video.querySelectorAll('source').forEach(src => {
        if (src.src) {
          const lower = src.src.toLowerCase();
          if (lower.includes('.m3u8') || lower.includes('.mpd')) {
            reportCaptured(src.src, 'hls');
          }
        }
      });
      video.querySelectorAll('track').forEach(track => {
        if (track.src) {
          reportCaptured(track.src, 'subtitle');
        }
      });
    });
  }, 1000);

  // Listen for bubbled events from sub-frames
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'captured-media') {
      try {
        realParent.postMessage(event.data, '*');
      } catch (e) {}
    }
  });

})();
</script>
`;

      const headCloseIndex = html.indexOf('</head>');
      if (headCloseIndex !== -1) {
        html = html.substring(0, headCloseIndex) + interceptorScript + html.substring(headCloseIndex);
      } else {
        html = html + interceptorScript;
      }

      // Rewrite static sub-iframes
      const iframeRegex = /<iframe\s+([^>]*?)src=["'](https?:\/\/[^"']+)["']/gi;
      html = html.replace(iframeRegex, (match, attrs, src) => {
        if (src.includes('google.com') || src.includes('doubleclick') || src.includes('/api/proxy-iframe')) {
          return match;
        }
        const proxied = `/api/proxy-iframe?url=${encodeURIComponent(src)}`;
        return `<iframe ${attrs}src="${proxied}"`;
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Frame-Options', 'ALLOWALL');
      res.send(html);

    } catch (err: any) {
      console.error(`[Iframe Proxy Error] Failed proxying ${targetUrl}:`, err);
      res.status(500).send(`Error loading page: ${err.message}`);
    }
  });

  // Proxy for HLS playlists (.m3u8 or custom single-line playlists)
  app.get(['/api/proxy-playlist', '/api/proxy-playlist/playlist.m3u8'], async (req, res) => {
    const rawTargetUrl = req.query.url;
    if (!rawTargetUrl || typeof rawTargetUrl !== 'string') {
      res.status(400).send('Missing target playlist URL');
      return;
    }

    // Clean and sanitize target URL:
    // 1. Trim whitespace
    // 2. Remove all spaces (e.g. "https:// e2e..." -> "https://e2e...")
    // 3. Remove trailing dots/periods from sentence copy-paste
    let targetUrl = rawTargetUrl.trim().replace(/\s+/g, '');
    while (targetUrl.endsWith('.')) {
      targetUrl = targetUrl.slice(0, -1).trim();
    }

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      res.status(400).send('Only absolute HTTP or HTTPS URLs can be proxied');
      return;
    }

    try {
      console.log(`[Playlist Proxy] Fetching from: ${targetUrl}`);
      let originStr = '';
      try {
        originStr = new URL(targetUrl).origin;
      } catch (e) {}

      let response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          ...(originStr ? {
            'Referer': `${originStr}/`,
            'Origin': originStr
          } : {})
        }
      });

      if (response.status === 403 || response.status === 401 || !response.ok) {
        console.warn(`[Playlist Proxy] Initial request got status ${response.status}. Retrying with clean headers...`);
        response = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
      }

      if (response.status === 403 || response.status === 401 || !response.ok) {
        console.warn(`[Playlist Proxy] Clean header request got status ${response.status}. Retrying with no custom headers...`);
        response = await fetch(targetUrl);
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch playlist: ${response.statusText} (${response.status})`);
      }

      const rawText = await response.text();

      // Check if it's an M3U8 content
      if (!rawText.includes('#EXTM3U')) {
        // Not a playlist, just send back raw
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', response.headers.get('content-type') || 'text/plain');
        res.send(rawText);
        return;
      }

      // Format single-line HLS playlists by inserting line breaks before each tag
      let formattedText = rawText.replace(/#EXT/g, '\n#EXT');

      // Now process line-by-line to extract and split tag attributes and URLs
      const initialLines = formattedText.split('\n').map(l => l.trim()).filter(Boolean);
      const splitLines: string[] = [];

      const joinedUrlRegex = /(https?:\/\/[^\s,]+|[a-zA-Z0-9_.\/%-]+\.(?:m3u8|ts|html|mp4|aac|m4s|mpd)(?:\?[^\s,]+)?)$/i;

      for (let line of initialLines) {
        if (line.startsWith('#EXT-X-STREAM-INF:')) {
          // Only split if there is a joined URL at the very end of the line
          const match = line.match(joinedUrlRegex);
          if (match && match.index !== undefined) {
            const tagPart = line.substring(0, match.index).trim();
            const urlPart = match[1].trim();
            // Ensure we don't accidentally split normal attributes (if it's not a URL)
            if (urlPart && (urlPart.startsWith('http') || !urlPart.includes('='))) {
              splitLines.push(tagPart, urlPart);
            } else {
              splitLines.push(line);
            }
          } else {
            splitLines.push(line);
          }
        } else if (line.startsWith('#EXTINF:')) {
          // Format is #EXTINF:duration,URL or #EXTINF:duration,title\nURL
          // If the line has a comma, check if the part after the comma is actually a URL/path
          const commaIndex = line.indexOf(',');
          if (commaIndex !== -1) {
            const tagPart = line.substring(0, commaIndex + 1);
            const urlPart = line.substring(commaIndex + 1).trim();
            // Only split if urlPart is a valid URL or media path (not just a title or empty)
            if (urlPart && (urlPart.startsWith('http') || /\.(m3u8|ts|html|mp4|aac|m4s|mpd)(\?.*)?$/i.test(urlPart))) {
              splitLines.push(tagPart, urlPart);
            } else {
              splitLines.push(line);
            }
          } else {
            splitLines.push(line);
          }
        } else {
          splitLines.push(line);
        }
      }

      const proxyBase = `/api/proxy-playlist/playlist.m3u8?url=`;
      const segmentProxyBase = `/api/proxy-segment/segment.ts?url=`;

      // Helper to merge query parameters from parent URL to resolved URL
      const mergeQueryParams = (resolvedUrlStr: string, parentUrlStr: string): string => {
        try {
          const parentUrl = new URL(parentUrlStr.trim().replace(/\s+/g, ''));
          const resolvedUrl = new URL(resolvedUrlStr.trim().replace(/\s+/g, ''));
          
          parentUrl.searchParams.forEach((value, key) => {
            if (!resolvedUrl.searchParams.has(key)) {
              resolvedUrl.searchParams.set(key, value);
            }
          });
          
          return resolvedUrl.toString();
        } catch (e) {
          return resolvedUrlStr;
        }
      };

      // Normalize base URL for relative path resolution
      const getNormalizedBaseUrl = (urlStr: string): string => {
        try {
          const url = new URL(urlStr.trim().replace(/\s+/g, ''));
          let pathname = url.pathname;
          
          // Specially handle e2e.majorplay.net and similar formats with /v/{id file}/...
          // We support any subpath /v/ followed by ID file (can contain dashes, underscores, and letters)
          const majorPlayMatch = pathname.match(/\/v\/([a-zA-Z0-9_-]+)/);
          if (majorPlayMatch) {
            const fileId = majorPlayMatch[1];
            return `${url.origin}/v/${fileId}/`;
          }

          if (pathname.endsWith('/')) {
            return url.origin + pathname;
          }
          
          const lastSegment = pathname.substring(pathname.lastIndexOf('/') + 1);
          if (!lastSegment.includes('.')) {
            return url.origin + pathname + '/';
          }
          
          const parentPath = pathname.substring(0, pathname.lastIndexOf('/') + 1);
          return url.origin + parentPath;
        } catch (e) {
          return urlStr;
        }
      };

      const baseResolutionUrl = getNormalizedBaseUrl(targetUrl);

      // Resolve relative URLs to absolute, and proxy sub-playlists
      const finalLines = splitLines.map((line) => {
        if (line.startsWith('#')) {
          // Check if this tag has attributes with a URI="..." (like audio tracks in #EXT-X-MEDIA)
          const uriMatch = line.match(/URI="([^"]+)"/i);
          if (uriMatch) {
            const relativeUri = uriMatch[1].trim().replace(/\s+/g, '');
            try {
              let absoluteUri = new URL(relativeUri, baseResolutionUrl).toString();
              absoluteUri = mergeQueryParams(absoluteUri, targetUrl);
              const isPlaylist = absoluteUri.includes('.json') || absoluteUri.includes('.m3u8');
              const proxiedUri = isPlaylist 
                ? `${proxyBase}${encodeURIComponent(absoluteUri)}` 
                : `${segmentProxyBase}${encodeURIComponent(absoluteUri)}`;
              return line.replace(`URI="${uriMatch[1]}"`, `URI="${proxiedUri}"`);
            } catch (e) {
              return line;
            }
          }
          return line;
        }

        // This is a stream URL or segment URL!
        try {
          const cleanedLine = line.trim().replace(/\s+/g, '');
          let absoluteUrl = new URL(cleanedLine, baseResolutionUrl).toString();
          absoluteUrl = mergeQueryParams(absoluteUrl, targetUrl);
          // If the URL is another playlist level, wrap it in our proxy
          const isPlaylist = absoluteUrl.includes('.json') || absoluteUrl.includes('.m3u8');
          if (isPlaylist) {
            return `${proxyBase}${encodeURIComponent(absoluteUrl)}`;
          }
          return `${segmentProxyBase}${encodeURIComponent(absoluteUrl)}`;
        } catch (e) {
          return line;
        }
      });

      const processedPlaylist = finalLines.join('\n');

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Content-Type', 'application/x-mpegURL; charset=utf-8');
      res.send(processedPlaylist);

    } catch (err: any) {
      console.error(`[Playlist Proxy Error] ${err.message}. Redirecting browser directly.`);
      if (!res.headersSent) {
        res.redirect(302, targetUrl);
      }
    }
  });

  // Proxy for video/audio segments (to bypass CORS, Brave Shield, and Referer issues)
  app.get(['/api/proxy-segment', '/api/proxy-segment/segment.ts'], async (req, res) => {
    const rawTargetUrl = req.query.url;
    if (!rawTargetUrl || typeof rawTargetUrl !== 'string') {
      res.status(400).send('Missing target segment URL');
      return;
    }

    let targetUrl = rawTargetUrl.trim().replace(/\s+/g, '');
    while (targetUrl.endsWith('.')) {
      targetUrl = targetUrl.slice(0, -1).trim();
    }

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      res.status(400).send('Only absolute HTTP or HTTPS segment URLs can be proxied');
      return;
    }

    // Kunci cache unik dengan menggabungkan URL target dan header Range (jika ada)
    const cacheKey = targetUrl + (req.headers.range || '');

    try {
      let originStr = '';
      try {
        originStr = new URL(targetUrl).origin;
      } catch (e) {}

      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...(originStr ? {
          'Referer': `${originStr}/`,
          'Origin': originStr
        } : {
          'Referer': 'https://e2e.majorplay.net/'
        })
      };

      if (req.headers.range) {
        headers['Range'] = req.headers.range as string;
      }

      // 1. Cek apakah segmen ini sudah ada dalam memory cache
      let entry = segmentCache.get(cacheKey);

      if (!entry) {
        // Pemicu prefetching beberapa segmen ke depan (secara asinkron di background)
        prefetchNextSegments(targetUrl, headers, 5);

        // Buat Promise fetch baru (Request Coalescing / Collapsing Pattern)
        const promise = (async () => {
          let response = await fetch(targetUrl, { headers });

          if (response.status === 403 || response.status === 401 || !response.ok) {
            const cleanHeaders: Record<string, string> = {
              'User-Agent': headers['User-Agent']
            };
            if (headers['Range']) cleanHeaders['Range'] = headers['Range'];
            response = await fetch(targetUrl, { headers: cleanHeaders });
          }

          if (response.status === 403 || response.status === 401 || !response.ok) {
            const minimalHeaders: Record<string, string> = {};
            if (headers['Range']) minimalHeaders['Range'] = headers['Range'];
            response = await fetch(targetUrl, { headers: minimalHeaders });
          }

          if (!response.ok) {
            throw new Error(`Failed to fetch segment: ${response.statusText} (${response.status})`);
          }

          const arrayBuffer = await response.arrayBuffer();
          const data = Buffer.from(arrayBuffer);

          const resHeaders: Record<string, string> = {};
          const contentType = response.headers.get('content-type');
          if (contentType) resHeaders['Content-Type'] = contentType;
          const contentLength = response.headers.get('content-length');
          if (contentLength) resHeaders['Content-Length'] = contentLength;
          const contentRange = response.headers.get('content-range');
          if (contentRange) resHeaders['Content-Range'] = contentRange;
          const acceptRanges = response.headers.get('accept-ranges');
          if (acceptRanges) resHeaders['Accept-Ranges'] = acceptRanges;

          return {
            status: response.status,
            headers: resHeaders,
            data
          };
        })();

        entry = {
          promise,
          timestamp: Date.now()
        };

        promise.catch(() => {
          segmentCache.delete(cacheKey); // Jangan simpan promise error di cache
        });

        // LRU Eviction jika melebihi batas entri
        if (segmentCache.size >= MAX_CACHE_ENTRIES) {
          let oldestKey = '';
          let oldestTime = Infinity;
          for (const [key, val] of segmentCache.entries()) {
            if (val.timestamp < oldestTime) {
              oldestTime = val.timestamp;
              oldestKey = key;
            }
          }
          if (oldestKey) {
            segmentCache.delete(oldestKey);
          }
        }
        segmentCache.set(cacheKey, entry);
      } else {
        // Jika ada di cache (Cache Hit!), perbarui timestamp LRU-nya
        entry.timestamp = Date.now();
        
        // Tetap trigger prefetch segmen ke depan jika user sedang memutar stream ini secara berurutan
        prefetchNextSegments(targetUrl, headers, 5);
      }

      // Tunggu hasil penyelesaian data dari Promise cache
      const result = await entry.promise;

      // Atur Header respons ke Client
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

      res.status(result.status);

      Object.entries(result.headers).forEach(([key, val]) => {
        res.setHeader(key, val);
      });

      // Kirim seluruh buffer data sekaligus dengan kecepatan tinggi (instan dari RAM)
      res.send(result.data);

    } catch (err: any) {
      if (req.destroyed) {
        return;
      }
      const isRoutineErr = err.message?.includes('fetch failed') || err.message?.includes('aborted') || err.message?.includes('destroyed') || err.code === 'ECONNRESET';
      if (!isRoutineErr) {
        console.warn(`[Segment Proxy Error] ${err.message}`);
      }
      if (!res.headersSent) {
        console.warn(`[Segment Proxy Error] Redirecting directly to segment URL due to error: ${err.message}`);
        res.redirect(302, targetUrl);
      }
    }
  });

  // --- HIGH LEVEL STEALTH ENCRYPTED STREAM PROXIES (ANTI-DETECTION & ANTI-SNIFFER) ---
  
  // Symmetrical lightweight obfuscation for proxy URLs (completely hides .m3u8, .ts, etc. from Chrome extension sniffers)
  function obfuscateUrl(url: string): string {
    try {
      const utf8Bytes = encodeURIComponent(url);
      let result = '';
      for (let i = 0; i < utf8Bytes.length; i++) {
        const charCode = utf8Bytes.charCodeAt(i);
        result += String.fromCharCode(charCode ^ 0x1A);
      }
      return Buffer.from(result, 'binary').toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    } catch (e) {
      return url;
    }
  }

  function deobfuscateUrl(obfuscated: string): string {
    try {
      let base64 = obfuscated.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) base64 += '=';
      const decoded = Buffer.from(base64, 'base64').toString('binary');
      let result = '';
      for (let i = 0; i < decoded.length; i++) {
        result += String.fromCharCode(decoded.charCodeAt(i) ^ 0x1A);
      }
      return decodeURIComponent(result);
    } catch (e) {
      return '';
    }
  }

  function obfuscatePlaylist(text: string): string {
    try {
      const buffer = Buffer.from(text, 'utf-8');
      const xorBuffer = Buffer.alloc(buffer.length);
      for (let i = 0; i < buffer.length; i++) {
        xorBuffer[i] = buffer[i] ^ 0x2C;
      }
      return 'VIYIE-SEC:' + xorBuffer.toString('base64');
    } catch (e) {
      return text;
    }
  }

  // Stealth headers helper to bypass provider bot-detection (TINGKAT TINGGI)
  function getStealthHeaders(targetUrl: string, userRange?: string): Record<string, string> {
    let originStr = '';
    try {
      originStr = new URL(targetUrl).origin;
    } catch (e) {}

    // Randomize modern browser user agents to make bot detection very difficult
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15'
    ];
    const selectedUA = userAgents[Math.floor(Math.random() * userAgents.length)];

    const headers: Record<string, string> = {
      'User-Agent': selectedUA,
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
    };

    if (originStr) {
      headers['Referer'] = `${originStr}/`;
      headers['Origin'] = originStr;
    } else {
      headers['Referer'] = 'https://e2e.majorplay.net/';
    }

    if (userRange) {
      headers['Range'] = userRange;
    }

    return headers;
  }

  // Stealth fetch that strips proxy trace headers (like X-Forwarded-For, Via, etc.)
  async function stealthFetch(url: string, headers: Record<string, string>): Promise<Response> {
    const lowerUrl = url.toLowerCase();
    const isTargetBlockedDomain = lowerUrl.includes('ironwallnet') || 
                                  lowerUrl.includes('hydrax') ||
                                  lowerUrl.includes('turbovip') ||
                                  lowerUrl.includes('.site/') ||
                                  lowerUrl.includes('.online/') ||
                                  lowerUrl.includes('dailymotion') ||
                                  lowerUrl.includes('1x2.space') ||
                                  lowerUrl.includes('4pa.top') ||
                                  lowerUrl.includes('vip.1x2') ||
                                  lowerUrl.includes('mov3.');

    try {
      let response = await fetch(url, {
        method: 'GET',
        headers: headers,
        credentials: 'omit',
        redirect: 'follow'
      });

      if ((response.status === 403 || response.status === 401 || response.status === 502) && isTargetBlockedDomain) {
        console.log(`[stealthFetch] Fallback to AllOrigins for: ${url}`);
        const allOriginsUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const fallbackHeaders: Record<string, string> = {
          'User-Agent': headers['User-Agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        };
        if (headers['Range']) {
          fallbackHeaders['Range'] = headers['Range'];
        }
        const proxyResponse = await fetch(allOriginsUrl, {
          method: 'GET',
          headers: fallbackHeaders,
          credentials: 'omit',
          redirect: 'follow'
        });
        if (proxyResponse.ok) {
          return proxyResponse;
        }
      }

      return response;
    } catch (err: any) {
      if (isTargetBlockedDomain) {
        console.log(`[stealthFetch Error Fallback] ${err.message}. Retrying via AllOrigins for: ${url}`);
        const allOriginsUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        try {
          const proxyResponse = await fetch(allOriginsUrl, {
            method: 'GET',
            headers: {
              'User-Agent': headers['User-Agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            },
            credentials: 'omit',
            redirect: 'follow'
          });
          if (proxyResponse.ok) {
            return proxyResponse;
          }
        } catch (proxyErr) {
          console.error(`[stealthFetch Error Fallback Failed] ${proxyErr}`);
        }
      }
      throw err;
    }
  }

  // Extension-less Master and Sub-playlist proxy
  app.get(['/api/v-stream', '/assets/images/dynamic-icons.png'], async (req, res) => {
    const rawPayload = req.query.s;
    if (!rawPayload || typeof rawPayload !== 'string') {
      res.status(400).send('Missing payload');
      return;
    }

    const targetUrl = deobfuscateUrl(rawPayload);
    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
      res.status(400).send('Invalid source URL');
      return;
    }

    const isMasqueraded = req.path.includes('dynamic-icons.png');

    try {
      console.log(`[Stealth Playlist Proxy] Fetching obfuscated: ${targetUrl} (Masqueraded: ${isMasqueraded})`);
      
      const headers = getStealthHeaders(targetUrl);
      let response = await stealthFetch(targetUrl, headers);

      if (response.status === 403 || response.status === 401 || !response.ok) {
        // Retry 1: Direct browser fetch without Origin/Referer to bypass referer hotlinking protections!
        response = await stealthFetch(targetUrl, {
          'User-Agent': headers['User-Agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        });
      }

      if (response.status === 403 || response.status === 401 || !response.ok) {
        // Retry 2: Referer set exactly to the target's host/origin (some require matching referrer)
        let hostOrigin = '';
        try { hostOrigin = new URL(targetUrl).origin; } catch (e) {}
        if (hostOrigin) {
          response = await stealthFetch(targetUrl, {
            'User-Agent': headers['User-Agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Referer': hostOrigin + '/',
            'Origin': hostOrigin
          });
        }
      }

      if (!response.ok) {
        console.warn(`[v-stream Proxy] Failed to fetch ${targetUrl} (Status ${response.status}). NOT redirecting to avoid URL leak.`);
        res.status(response.status || 502).send(`Failed to stream source (Status ${response.status})`);
        return;
      }

      const rawText = await response.text();

      if (!rawText.includes('#EXTM3U')) {
        // If it is a DASH manifest (.mpd), process it dynamically to rewrite/inject BaseURL pointing to our path-based proxy.
        if (targetUrl.toLowerCase().includes('.mpd') || rawText.includes('<MPD')) {
          try {
            const originalMpdUrl = new URL(targetUrl);
            const pathSegments = originalMpdUrl.pathname.split('/');
            pathSegments.pop(); // Remove the manifest name like 1258068.mpd
            
            // Construct original base directory URL with any query parameters appended
            const originalBaseUrlDir = originalMpdUrl.origin + pathSegments.join('/') + '/' + originalMpdUrl.search;
            
            // Obfuscate the base directory URL
            const obfuscatedBase = obfuscateUrl(originalBaseUrlDir);
            
            // Our path-based segment proxy BaseURL
            const proxyBaseUrl = isMasqueraded 
              ? `${req.protocol}://${req.get('host')}/assets/js/vendors/vendor-polyfills.js/${obfuscatedBase}/`
              : `${req.protocol}://${req.get('host')}/api/v-dash/${obfuscatedBase}/`;
            
            let mpdContent = rawText;
            
            // Remove any existing absolute BaseURL elements to avoid conflicts
            mpdContent = mpdContent.replace(/<BaseURL>\s*https?:\/\/[^<]+\s*<\/BaseURL>/gi, '');
            
            // Inject our proxy BaseURL right after the <MPD> tag
            const mpdTagRegex = /(<MPD[^>]*>)/i;
            const match = mpdContent.match(mpdTagRegex);
            if (match) {
              const mpdTag = match[1];
              const injectedBaseUrlTag = `\n  <BaseURL>${proxyBaseUrl}</BaseURL>`;
              mpdContent = mpdContent.replace(mpdTag, mpdTag + injectedBaseUrlTag);
            }
            
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Headers', '*');
            res.setHeader('Content-Type', 'application/dash+xml; charset=utf-8');
            res.setHeader('Content-Disposition', 'inline'); // Explicitly prevent download popups
            res.send(mpdContent);
            return;
          } catch (e: any) {
            console.warn(`[v-stream DASH Proxy Error] ${e.message}`);
          }
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        if (isMasqueraded) {
          res.setHeader('Content-Type', 'image/png');
          res.send(obfuscatePlaylist(rawText));
        } else {
          res.setHeader('Content-Type', response.headers.get('content-type') || 'text/plain');
          res.send(rawText);
        }
        return;
      }

      let formattedText = rawText.replace(/#EXT/g, '\n#EXT');
      const initialLines = formattedText.split('\n').map(l => l.trim()).filter(Boolean);
      const splitLines: string[] = [];

      const joinedUrlRegex = /(https?:\/\/[^\s,]+|[a-zA-Z0-9_.\/%-]+\.(?:m3u8|ts|html|mp4|aac|m4s|mpd)(?:\?[^\s,]+)?)$/i;

      for (let line of initialLines) {
        if (line.startsWith('#EXT-X-STREAM-INF:')) {
          const match = line.match(joinedUrlRegex);
          if (match && match.index !== undefined) {
            const tagPart = line.substring(0, match.index).trim();
            const urlPart = match[1].trim();
            if (urlPart && (urlPart.startsWith('http') || !urlPart.includes('='))) {
              splitLines.push(tagPart, urlPart);
            } else {
              splitLines.push(line);
            }
          } else {
            splitLines.push(line);
          }
        } else if (line.startsWith('#EXTINF:')) {
          const commaIndex = line.indexOf(',');
          if (commaIndex !== -1) {
            const tagPart = line.substring(0, commaIndex + 1);
            const urlPart = line.substring(commaIndex + 1).trim();
            if (urlPart && (urlPart.startsWith('http') || /\.(m3u8|ts|html|mp4|aac|m4s|mpd)(\?.*)?$/i.test(urlPart))) {
              splitLines.push(tagPart, urlPart);
            } else {
              splitLines.push(line);
            }
          } else {
            splitLines.push(line);
          }
        } else {
          splitLines.push(line);
        }
      }

      const mergeQueryParams = (resolvedUrlStr: string, parentUrlStr: string): string => {
        try {
          const parentUrl = new URL(parentUrlStr.trim().replace(/\s+/g, ''));
          const resolvedUrl = new URL(resolvedUrlStr.trim().replace(/\s+/g, ''));
          parentUrl.searchParams.forEach((value, key) => {
            if (!resolvedUrl.searchParams.has(key)) {
              resolvedUrl.searchParams.set(key, value);
            }
          });
          return resolvedUrl.toString();
        } catch (e) {
          return resolvedUrlStr;
        }
      };

      const getNormalizedBaseUrl = (urlStr: string): string => {
        try {
          const url = new URL(urlStr.trim().replace(/\s+/g, ''));
          let pathname = url.pathname;
          const majorPlayMatch = pathname.match(/\/v\/([a-zA-Z0-9_-]+)/);
          if (majorPlayMatch) {
            return `${url.origin}/v/${majorPlayMatch[1]}/`;
          }
          if (pathname.endsWith('/')) {
            return url.origin + pathname;
          }
          const lastSegment = pathname.substring(pathname.lastIndexOf('/') + 1);
          if (!lastSegment.includes('.')) {
            return url.origin + pathname + '/';
          }
          const parentPath = pathname.substring(0, pathname.lastIndexOf('/') + 1);
          return url.origin + parentPath;
        } catch (e) {
          return urlStr;
        }
      };

      const baseResolutionUrl = getNormalizedBaseUrl(targetUrl);

      const finalLines = splitLines.map((line) => {
        if (line.startsWith('#')) {
          const uriMatch = line.match(/URI="([^"]+)"/i);
          if (uriMatch) {
            const relativeUri = uriMatch[1].trim().replace(/\s+/g, '');
            try {
              let absoluteUri = new URL(relativeUri, baseResolutionUrl).toString();
              absoluteUri = mergeQueryParams(absoluteUri, targetUrl);
              const isPlaylist = absoluteUri.includes('.json') || 
                                 absoluteUri.includes('.m3u8') || 
                                 absoluteUri.includes('.m3u') || 
                                 absoluteUri.includes('/playlist/') || 
                                 absoluteUri.includes('/manifest');
              const proxiedUri = isPlaylist 
                ? `/assets/images/dynamic-icons.png?s=${obfuscateUrl(absoluteUri)}` 
                : `/assets/images/sprite-sheet.png?c=${obfuscateUrl(absoluteUri)}`;
              return line.replace(`URI="${uriMatch[1]}"`, `URI="${proxiedUri}"`);
            } catch (e) {
              return line;
            }
          }
          return line;
        }

        try {
          const cleanedLine = line.trim().replace(/\s+/g, '');
          let absoluteUrl = new URL(cleanedLine, baseResolutionUrl).toString();
          absoluteUrl = mergeQueryParams(absoluteUrl, targetUrl);
          const isPlaylist = absoluteUrl.includes('.json') || 
                             absoluteUrl.includes('.m3u8') || 
                             absoluteUrl.includes('.m3u') || 
                             absoluteUrl.includes('/playlist/') || 
                             absoluteUrl.includes('/manifest');
          if (isPlaylist) {
            return `/assets/images/dynamic-icons.png?s=${obfuscateUrl(absoluteUrl)}`;
          }
          return `/assets/images/sprite-sheet.png?c=${obfuscateUrl(absoluteUrl)}`;
        } catch (e) {
          return line;
        }
      });

      const processedPlaylist = finalLines.join('\n');

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      if (isMasqueraded) {
        res.setHeader('Content-Type', 'image/png');
        res.send(obfuscatePlaylist(processedPlaylist));
      } else {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.send(processedPlaylist);
      }

    } catch (err: any) {
      console.error(`[v-stream Proxy Error] ${err.message}. Redirecting browser directly.`);
      if (!res.headersSent) {
        res.redirect(302, targetUrl);
      }
    }
  });

  // Extension-less segment proxy with prefetching and request coalescing (completely disguised)
  app.get(['/api/v-chunk', '/assets/images/sprite-sheet.png'], async (req, res) => {
    const rawPayload = req.query.c;
    if (!rawPayload || typeof rawPayload !== 'string') {
      res.status(400).send('Missing payload');
      return;
    }

    const targetUrl = deobfuscateUrl(rawPayload);
    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
      res.status(400).send('Invalid segment URL');
      return;
    }

    const cacheKey = targetUrl + (req.headers.range || '');
    const isMasqueraded = req.path.includes('sprite-sheet.png');

    try {
      const headers = getStealthHeaders(targetUrl, req.headers.range as string);

      let entry = segmentCache.get(cacheKey);

      if (!entry) {
        prefetchNextSegments(targetUrl, headers, 5);

        const promise = (async () => {
          let response = await stealthFetch(targetUrl, headers);

          if (response.status === 403 || response.status === 401 || !response.ok) {
            const cleanHeaders = {
              'User-Agent': headers['User-Agent'],
              'Accept': '*/*'
            };
            if (headers['Range']) cleanHeaders['Range'] = headers['Range'];
            response = await stealthFetch(targetUrl, cleanHeaders);
          }

          if (!response.ok) {
            throw new Error(`Failed to fetch segment: ${response.statusText} (${response.status})`);
          }

          const arrayBuffer = await response.arrayBuffer();
          const data = Buffer.from(arrayBuffer);

          const resHeaders: Record<string, string> = {};
          let contentType = response.headers.get('content-type') || 'video/mp2t';
          if (isMasqueraded) {
            contentType = 'image/jpeg';
          }
          if (contentType) resHeaders['Content-Type'] = contentType;
          const contentLength = response.headers.get('content-length');
          if (contentLength) resHeaders['Content-Length'] = contentLength;
          const contentRange = response.headers.get('content-range');
          if (contentRange) resHeaders['Content-Range'] = contentRange;
          const acceptRanges = response.headers.get('accept-ranges');
          if (acceptRanges) resHeaders['Accept-Ranges'] = acceptRanges;

          return {
            status: response.status,
            headers: resHeaders,
            data
          };
        })();

        entry = {
          promise,
          timestamp: Date.now()
        };

        promise.catch(() => {
          segmentCache.delete(cacheKey);
        });

        if (segmentCache.size >= MAX_CACHE_ENTRIES) {
          let oldestTime = Infinity;
          let oldestKey = null;
          for (const [key, val] of segmentCache.entries()) {
            if (val.timestamp < oldestTime) {
              oldestTime = val.timestamp;
              oldestKey = key;
            }
          }
          if (oldestKey) {
            segmentCache.delete(oldestKey);
          }
        }
        segmentCache.set(cacheKey, entry);
      } else {
        entry.timestamp = Date.now();
        prefetchNextSegments(targetUrl, headers, 5);
      }

      const result = await entry.promise;

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

      res.status(result.status);
      Object.entries(result.headers).forEach(([key, val]) => {
        res.setHeader(key, val);
      });

      res.send(result.data);

    } catch (err: any) {
      if (req.destroyed) return;
      const isRoutineErr = err.message?.includes('fetch failed') || err.message?.includes('aborted') || err.message?.includes('destroyed') || err.code === 'ECONNRESET';
      if (!isRoutineErr) {
        console.warn(`[Stealth Segment Proxy Error] ${err.message}`);
      }
      if (!res.headersSent) {
        console.warn(`[v-chunk Proxy Error] Segment fetch failed: ${err.message}. NOT redirecting to avoid URL leak.`);
        res.status(502).send('Segment fetch failed');
      }
    }
  });

  // Dynamic path-based proxy for DASH segments (.m4s, .mp4, init files) to support relative resolution perfectly
  const handleVDash = async (req: express.Request, res: express.Response) => {
    const obfuscatedBase = req.params[0];
    const relativePath = req.params[1]; // Gets the rest of the path matched by regex group 2

    if (!obfuscatedBase || typeof obfuscatedBase !== 'string') {
      res.status(400).send('Missing obfuscated base URL');
      return;
    }

    const originalBaseUrl = deobfuscateUrl(obfuscatedBase);
    if (!originalBaseUrl || (!originalBaseUrl.startsWith('http://') && !originalBaseUrl.startsWith('https://'))) {
      res.status(400).send('Invalid base URL');
      return;
    }

    const isMasqueraded = req.path.includes('vendor-polyfills.js');

    try {
      // Resolve the full target segment URL using standard URL resolution
      const targetUrlObj = new URL(relativePath, originalBaseUrl);
      let targetUrl = targetUrlObj.toString();

      // Ensure we merge any query parameters from the original base URL (e.g. CDNs requiring a key/token)
      try {
        const baseObj = new URL(originalBaseUrl);
        const targetObj = new URL(targetUrl);
        let hasNewParams = false;
        baseObj.searchParams.forEach((value, key) => {
          if (!targetObj.searchParams.has(key)) {
            targetObj.searchParams.set(key, value);
            hasNewParams = true;
          }
        });
        if (hasNewParams) {
          targetUrl = targetObj.toString();
        }
      } catch (e) {
        // Fallback if URL parsing fails
      }

      const cacheKey = targetUrl + (req.headers.range || '');
      const headers = getStealthHeaders(targetUrl, req.headers.range as string);

      let entry = segmentCache.get(cacheKey);

      if (!entry) {
        prefetchNextSegments(targetUrl, headers, 5);

        const promise = (async () => {
          let response = await stealthFetch(targetUrl, headers);

          if (response.status === 403 || response.status === 401 || !response.ok) {
            const cleanHeaders = {
              'User-Agent': headers['User-Agent'],
              'Accept': '*/*'
            };
            if (headers['Range']) cleanHeaders['Range'] = headers['Range'];
            response = await stealthFetch(targetUrl, cleanHeaders);
          }

          if (!response.ok) {
            throw new Error(`Failed to fetch DASH segment: ${response.statusText} (${response.status})`);
          }

          const arrayBuffer = await response.arrayBuffer();
          const data = Buffer.from(arrayBuffer);

          const resHeaders: Record<string, string> = {};
          const contentType = response.headers.get('content-type') || 'video/iso.segment';
          if (contentType) resHeaders['Content-Type'] = contentType;
          const contentLength = response.headers.get('content-length');
          if (contentLength) resHeaders['Content-Length'] = contentLength;
          const contentRange = response.headers.get('content-range');
          if (contentRange) resHeaders['Content-Range'] = contentRange;
          const acceptRanges = response.headers.get('accept-ranges');
          if (acceptRanges) resHeaders['Accept-Ranges'] = acceptRanges;

          return {
            status: response.status,
            headers: resHeaders,
            data
          };
        })();

        entry = {
          promise,
          timestamp: Date.now()
        };

        promise.catch(() => {
          segmentCache.delete(cacheKey);
        });

        if (segmentCache.size >= MAX_CACHE_ENTRIES) {
          let oldestTime = Infinity;
          let oldestKey = null;
          for (const [key, val] of segmentCache.entries()) {
            if (val.timestamp < oldestTime) {
              oldestTime = val.timestamp;
              oldestKey = key;
            }
          }
          if (oldestKey) {
            segmentCache.delete(oldestKey);
          }
        }
        segmentCache.set(cacheKey, entry);
      } else {
        entry.timestamp = Date.now();
        prefetchNextSegments(targetUrl, headers, 5);
      }

      const result = await entry.promise;

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

      res.status(result.status);
      Object.entries(result.headers).forEach(([key, val]) => {
        res.setHeader(key, val);
      });

      res.send(result.data);

    } catch (err: any) {
      if (req.destroyed) return;
      const isRoutineErr = err.message?.includes('fetch failed') || err.message?.includes('aborted') || err.message?.includes('destroyed') || err.code === 'ECONNRESET';
      if (!isRoutineErr) {
        console.warn(`[DASH Segment Proxy Error] ${err.message}`);
      }
      if (!res.headersSent) {
        console.warn(`[DASH Segment Proxy Error] Redirecting directly to segment URL due to error: ${err.message}`);
        res.redirect(302, targetUrl);
      }
    }
  };

  app.get(/^\/api\/v-dash\/([^\/]+)\/(.*)$/, handleVDash);
  app.get(/^\/assets\/js\/vendors\/vendor-polyfills\.js\/([^\/]+)\/(.*)$/, handleVDash);

  const AMERICAS_COUNTRIES = new Set([
    "GT","BZ","HN","SV","NI","CR","PA",
    "CU","JM","HT","DO","PR","TT","BB","BS","AG","DM","GD","KN","LC","VC",
    "BR","AR","CO","PE","VE","CL","EC","BO","PY","UY","GY","SR","GF",
  ]);

  function getVideoUrl(baseUrl: string, videoId: string): string {
      return `${baseUrl}/videos/${videoId}/master.m3u8`;
  }

  function getPosterUrl(baseUrl: string, videoId: string): string {
      return `${baseUrl}/thumbnails/${videoId}.jpg`;
  }

  // DTube URL Parser API
  app.get('/api/dtube-parse', async (req, res) => {
    const dtubeUrl = req.query.url;
    if (!dtubeUrl || typeof dtubeUrl !== 'string') {
      res.status(400).json({ error: 'Missing dtube URL' });
      return;
    }

    try {
      let videoId: string | null = null;
      try {
        const urlObj = new URL(dtubeUrl);
        videoId = urlObj.searchParams.get('v');
      } catch (e) {
        // Ignore URL parsing error
      }

      if (!videoId) {
        const match = dtubeUrl.match(/\/videos\/([a-zA-Z0-9_-]+)/);
        if (match) videoId = match[1];
      }
      if (!videoId) {
        const match = dtubeUrl.match(/v=([a-zA-Z0-9_-]+)/) || dtubeUrl.match(/\/v\/([a-zA-Z0-9_-]+)/);
        if (match) videoId = match[1];
      }
      if (!videoId) {
        // try hash at the end
        const match = dtubeUrl.match(/([a-zA-Z0-9_-]+)$/);
        if (match) videoId = match[1];
      }

      if (!videoId) {
        res.status(400).json({ error: 'Invalid DTube URL, missing "v" parameter' });
        return;
      }

      const country = (req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || req.headers['x-country-code'] || '').toString().toUpperCase();
      
      let primaryCdn = "https://nas2.d.tube";

      // If the URL is already an m3u8, check if it's a media playlist
      if (dtubeUrl.includes('.m3u8')) {
        try {
          const resUrl = await fetch(dtubeUrl);
          if (resUrl.ok) {
            const text = await resUrl.text();
            if (text.includes('.ts')) {
              // Media playlist, just return it directly
              res.json({
                videoId,
                cdn: dtubeUrl.startsWith('https://nas1') ? 'https://nas1.d.tube' : 'https://nas2.d.tube',
                master: dtubeUrl,
                poster: getPosterUrl(primaryCdn, videoId),
                qualities: []
              });
              return;
            }
          }
        } catch(e) {}
      }

      let fallbackCdn = "https://nas1.d.tube";

      if (country && AMERICAS_COUNTRIES.has(country)) {
        primaryCdn = "https://nas1.d.tube";
        fallbackCdn = "https://nas2.d.tube";
      }

      const tryFetchPlaylist = async (cdn: string) => {
        const masterUrl = getVideoUrl(cdn, videoId);
        const response = await fetch(masterUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch from ${cdn}: ${response.status}`);
        }
        const text = await response.text();
        return { cdn, masterUrl, text };
      };

      let result;
      try {
        result = await tryFetchPlaylist(primaryCdn);
      } catch (e) {
        console.warn(`[DTube Parser] Primary CDN failed, trying fallback...`, e);
        result = await tryFetchPlaylist(fallbackCdn);
      }

      const { cdn, masterUrl, text } = result;
      
      const lines = text.split('\n');
      const qualities: {label: string, url: string}[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !line.startsWith('#')) {
          const match = line.match(/^([a-zA-Z0-9]+)\//);
          let label = line;
          if (match) {
            label = match[1];
          } else {
            if (line.includes('.m3u8')) {
              label = line.replace('/playlist.m3u8', '').replace('.m3u8', '');
            }
          }
          
          qualities.push({
            label,
            url: `${cdn}/videos/${videoId}/${line}`
          });
        }
      }

      res.json({
        videoId,
        cdn,
        master: masterUrl,
        poster: getPosterUrl(cdn, videoId),
        qualities
      });

    } catch (err: any) {
      console.error('[DTube Parser Error]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // API: Robust HLS Stream Playlist Extractor Scraper (Automated Browser-Based with Puppeteer + Static Fallback)
  app.get('/api/extract-hls', async (req, res) => {
    const rawTargetUrl = req.query.url;
    if (!rawTargetUrl || typeof rawTargetUrl !== 'string') {
      res.status(400).json({ error: 'Missing target URL parameter' });
      return;
    }

    let targetUrl = rawTargetUrl.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      res.status(400).json({ error: 'Only absolute HTTP or HTTPS URLs are supported' });
      return;
    }

    // Bypass browser scraper entirely if the URL is already a direct stream
    const isDirectStream = targetUrl.toLowerCase().includes('.m3u8') || targetUrl.toLowerCase().includes('.mpd');
    if (isDirectStream) {
      console.log(`[HLS Extractor] Direct stream URL detected: ${targetUrl}. Skipping crawler.`);
      res.json({
        success: true,
        originalUrl: targetUrl,
        playlists: [targetUrl],
        subtitles: [],
        usedBrowser: false,
        browserError: null,
        message: 'Direct stream URL detected.'
      });
      return;
    }

    const foundPlaylists = new Set<string>();
    const foundSubtitles = new Map<string, string>(); // Map url -> lang name
    let usedBrowser = false;
    let browserError: string | null = null;

    // Helper: Detect subtitle language from its URL
    const detectSubtitleLanguage = (urlStr: string): string => {
      const lowerUrl = urlStr.toLowerCase();
      if (lowerUrl.includes('indonesian') || lowerUrl.includes('indo') || lowerUrl.includes('/id') || lowerUrl.includes('_id') || lowerUrl.includes('.id.')) {
        return 'Indonesian';
      }
      if (lowerUrl.includes('english') || lowerUrl.includes('/en') || lowerUrl.includes('_en') || lowerUrl.includes('.en.') || lowerUrl.includes('eng')) {
        return 'English';
      }
      if (lowerUrl.includes('spanish') || lowerUrl.includes('/es') || lowerUrl.includes('_es') || lowerUrl.includes('.es.') || lowerUrl.includes('spa')) {
        return 'Spanish';
      }
      if (lowerUrl.includes('french') || lowerUrl.includes('/fr') || lowerUrl.includes('_fr') || lowerUrl.includes('.fr.') || lowerUrl.includes('fre')) {
        return 'French';
      }
      if (lowerUrl.includes('arabic') || lowerUrl.includes('/ar') || lowerUrl.includes('_ar') || lowerUrl.includes('.ar.') || lowerUrl.includes('ara')) {
        return 'Arabic';
      }
      if (lowerUrl.includes('japanese') || lowerUrl.includes('/ja') || lowerUrl.includes('_ja') || lowerUrl.includes('.ja.') || lowerUrl.includes('jpn') || lowerUrl.includes('jp')) {
        return 'Japanese';
      }
      if (lowerUrl.includes('korean') || lowerUrl.includes('/ko') || lowerUrl.includes('_ko') || lowerUrl.includes('.ko.') || lowerUrl.includes('kor')) {
        return 'Korean';
      }
      if (lowerUrl.includes('vietnamese') || lowerUrl.includes('/vi') || lowerUrl.includes('_vi') || lowerUrl.includes('.vi.') || lowerUrl.includes('vie')) {
        return 'Vietnamese';
      }
      if (lowerUrl.includes('thai') || lowerUrl.includes('/th') || lowerUrl.includes('_th') || lowerUrl.includes('.th.') || lowerUrl.includes('tha')) {
        return 'Thai';
      }
      
      // Try to extract 2 or 3 letter language codes from filename, e.g. /subtitles/en.vtt or movie_eng.vtt
      const match = urlStr.match(/[\/._-]([a-z]{2,3})[\/._-](?:vtt|srt|ass)/i);
      if (match) {
        const code = match[1].toUpperCase();
        if (code === 'ENG') return 'English';
        if (code === 'IND') return 'Indonesian';
        if (code === 'ARA') return 'Arabic';
        if (code === 'SPA') return 'Spanish';
        if (code === 'FRA') return 'French';
        if (code === 'JPN') return 'Japanese';
        if (code === 'KOR') return 'Korean';
        if (code === 'VIE') return 'Vietnamese';
        if (code === 'THA') return 'Thai';
        return code;
      }
      return 'Subtitle';
    };

    // Helper: Unescape unicode, percent encoding, and slashes
    const unescapeHtmlContent = (str: string): string => {
      let unescaped = str;
      try {
        unescaped = unescaped.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => 
          String.fromCharCode(parseInt(hex, 16))
        );
      } catch (e) {}
      unescaped = unescaped.replace(/\\\//g, '/');
      unescaped = unescaped.replace(/&amp;/gi, '&');
      try {
        unescaped = decodeURIComponent(unescaped);
      } catch (e) {}
      return unescaped;
    };

    // Helper: Extract stream URLs and subtitles from a text content block
    const extractFromContent = (content: string, pageUrl: string) => {
      if (!content) return;
      const unescaped = unescapeHtmlContent(content);

      // 1. Direct Regex match for absolute/relative stream files inside quotes/backticks
      const streamLinkRegex = /["'`]([^\s"'`<>\\{}|^\~\[\]]+\.(?:m3u8|mpd)(?:[^\s"'`<>\\{}|^\~\[\]]*))["']/gi;
      let match;
      streamLinkRegex.lastIndex = 0;
      while ((match = streamLinkRegex.exec(unescaped)) !== null) {
        let pathStr = match[1].replace(/\\/g, ''); // strip any backslashes
        try {
          const resolvedUrl = new URL(pathStr, pageUrl).toString();
          foundPlaylists.add(resolvedUrl);
          console.log(`[Content Extractor] Found stream from quote match: ${resolvedUrl}`);
        } catch (e) {}
      }

      // 2. Fallback regex match for any absolute m3u8 or mpd URLs that might not be quoted
      const absoluteM3u8Regex = /(https?:\\?\/\\?\/[^\s"'`<>\\{}|^\~\[\]]+?\.m3u8[^\s"'`<>]*?)/gi;
      absoluteM3u8Regex.lastIndex = 0;
      while ((match = absoluteM3u8Regex.exec(unescaped)) !== null) {
        let url = match[1].replace(/\\/g, '');
        url = url.split(/[\\"'`<>]/)[0];
        try {
          const absoluteUrl = new URL(url, pageUrl).toString();
          foundPlaylists.add(absoluteUrl);
          console.log(`[Content Extractor] Found absolute stream from fallback: ${absoluteUrl}`);
        } catch (e) {}
      }

      const absoluteMpdRegex = /(https?:\\?\/\\?\/[^\s"'`<>\\{}|^\~\[\]]+?\.mpd[^\s"'`<>]*?)/gi;
      absoluteMpdRegex.lastIndex = 0;
      while ((match = absoluteMpdRegex.exec(unescaped)) !== null) {
        let url = match[1].replace(/\\/g, '');
        url = url.split(/[\\"'`<>]/)[0];
        try {
          const absoluteUrl = new URL(url, pageUrl).toString();
          foundPlaylists.add(absoluteUrl);
          console.log(`[Content Extractor] Found absolute DASH stream from fallback: ${absoluteUrl}`);
        } catch (e) {}
      }

      // 3. Base64 pattern matching for hidden streams
      const base64Regex = /([a-zA-Z0-9+/]{24,}=*)/g;
      base64Regex.lastIndex = 0;
      while ((match = base64Regex.exec(unescaped)) !== null) {
        try {
          const decoded = Buffer.from(match[1], 'base64').toString('utf8');
          if ((decoded.includes('.m3u8') || decoded.includes('.mpd')) && decoded.startsWith('http')) {
            foundPlaylists.add(decoded);
            console.log(`[Content Extractor] Found decoded base64 stream: ${decoded}`);
          }
        } catch (e) {}
      }

      // 4. Subtitle extraction from source content
      const subtitleLinkRegex = /["'`]([^\s"'`<>\\{}|^\~\[\]]+\.(?:vtt|srt|ass)(?:[^\s"'`<>\\{}|^\~\[\]]*))["']/gi;
      subtitleLinkRegex.lastIndex = 0;
      while ((match = subtitleLinkRegex.exec(unescaped)) !== null) {
        let pathStr = match[1].replace(/\\/g, '');
        try {
          const resolvedUrl = new URL(pathStr, pageUrl).toString();
          if (!foundSubtitles.has(resolvedUrl)) {
            foundSubtitles.set(resolvedUrl, detectSubtitleLanguage(resolvedUrl));
            console.log(`[Content Extractor] Found subtitle from quote match: ${resolvedUrl}`);
          }
        } catch (e) {}
      }

      const absoluteSubRegex = /(https?:\\?\/\\?\/[^\s"'`<>\\{}|^\~\[\]]+?\.(?:vtt|srt|ass)[^\s"'`<>]*?)/gi;
      absoluteSubRegex.lastIndex = 0;
      while ((match = absoluteSubRegex.exec(unescaped)) !== null) {
        let url = match[1].replace(/\\/g, '');
        url = url.split(/[\\"'`<>]/)[0];
        try {
          const absoluteUrl = new URL(url, pageUrl).toString();
          if (!foundSubtitles.has(absoluteUrl)) {
            foundSubtitles.set(absoluteUrl, detectSubtitleLanguage(absoluteUrl));
            console.log(`[Content Extractor] Found absolute subtitle: ${absoluteUrl}`);
          }
        } catch (e) {}
      }
    };

    try {
      console.log(`[HLS Extractor] Starting automated browser extraction for: ${targetUrl}`);
      
      // Try to launch headless puppeteer with robust flags to bypass bots and sandboxes
      const browser = await puppeteer.launch({
        headless: true,
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1280,720'
        ]
      });

      usedBrowser = true;
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });
        
        // Hide webdriver footprint
        await page.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
          });
        });
        
        // Use a realistic Chrome User-Agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        
        // Monitor requests
        page.on('request', (request) => {
          const url = request.url();
          const lowerUrl = url.toLowerCase();
          if (lowerUrl.includes('.m3u8') || lowerUrl.includes('/playlist') || lowerUrl.includes('.mpd')) {
            console.log(`[Puppeteer Interceptor] Found potential stream URL on request: ${url}`);
            foundPlaylists.add(url);
          }
          if (lowerUrl.includes('.vtt') || lowerUrl.includes('.srt') || lowerUrl.includes('.ass') || lowerUrl.includes('/subtitles') || lowerUrl.includes('/subs/')) {
            if (!foundSubtitles.has(url) && (lowerUrl.includes('.vtt') || lowerUrl.includes('.srt') || lowerUrl.includes('.ass'))) {
              foundSubtitles.set(url, detectSubtitleLanguage(url));
              console.log(`[Puppeteer Interceptor] Found potential subtitle URL: ${url}`);
            }
          }
        });

        // Monitor responses (including headers and body scanning for JSON/Scripts)
        page.on('response', async (response) => {
          try {
            const url = response.url();
            const lowerUrl = url.toLowerCase();
            const contentType = (response.headers()['content-type'] || '').toLowerCase();
            
            // Check content types first
            if (
              contentType.includes('mpegurl') || 
              contentType.includes('application/x-mpegurl') ||
              contentType.includes('application/vnd.apple.mpegurl') ||
              contentType.includes('dash+xml') ||
              lowerUrl.includes('.m3u8') ||
              lowerUrl.includes('.mpd')
            ) {
              console.log(`[Puppeteer Interceptor] Found stream URL on response headers: ${url}`);
              foundPlaylists.add(url);
              return;
            }

            if (
              contentType.includes('text/vtt') ||
              contentType.includes('application/x-subrip') ||
              lowerUrl.includes('.vtt') ||
              lowerUrl.includes('.srt') ||
              lowerUrl.includes('.ass')
            ) {
              if (!foundSubtitles.has(url)) {
                foundSubtitles.set(url, detectSubtitleLanguage(url));
                console.log(`[Puppeteer Interceptor] Found subtitle URL on response headers: ${url}`);
              }
              return;
            }

            // Buffer and scan JSON / XML / Javascript bodies for dynamically requested stream links
            const resourceType = response.request().resourceType();
            if (['document', 'script', 'xhr', 'fetch'].includes(resourceType)) {
              const contentLength = parseInt(response.headers()['content-length'] || '0', 10);
              if (contentLength < 3 * 1024 * 1024) { // Scan files under 3MB
                const text = await response.text();
                extractFromContent(text, url);
              }
            }
          } catch (e) {
            // Ignore response buffering errors
          }
        });

        // Navigate to the target page with load timeout
        console.log(`[HLS Extractor] Navigating browser to page...`);
        await page.goto(targetUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 15000
        });

        // Wait a small moment for dynamic components to mount
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Helper function to trigger video players inside a frame context
        const triggerPlayersInFrame = async (frame: any) => {
          try {
            await frame.evaluate(() => {
              // 1. Play standard video tags
              const videos = document.querySelectorAll('video');
              videos.forEach((video) => {
                try {
                  video.play().catch(() => {});
                } catch (e) {}
              });

              // 2. Click likely play buttons/icons
              const playSelectors = [
                'button[class*="play" i]',
                'div[class*="play" i]',
                'span[class*="play" i]',
                'a[class*="play" i]',
                'button[aria-label*="play" i]',
                '[id*="play" i]',
                '.vjs-big-play-button',
                '.jw-display-icon-container',
                '.plyr__control--overlaid',
                '.play-btn',
                '.play-button',
                '[class*="player" i]',
                '[id*="player" i]'
              ];
              
              playSelectors.forEach((sel) => {
                const elements = document.querySelectorAll(sel);
                elements.forEach((el: any) => {
                  try {
                    el.click();
                  } catch (e) {}
                });
              });
            });
          } catch (e) {}
        };

        // First pass player triggering
        console.log(`[HLS Extractor] First pass: Searching video players and clicking play on all frames...`);
        const frames = page.frames();
        for (const frame of frames) {
          await triggerPlayersInFrame(frame);
        }

        // Wait 3 more seconds for potential lazy-loaded frames to emerge
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Second pass player triggering
        console.log(`[HLS Extractor] Second pass: Triggering play on all active frames...`);
        const activeFrames = page.frames();
        for (const frame of activeFrames) {
          await triggerPlayersInFrame(frame);
        }

        // Extract and scan content from main page and all sub-frames
        console.log(`[HLS Extractor] Scanning page sources...`);
        const mainContent = await page.content();
        extractFromContent(mainContent, targetUrl);

        for (const frame of activeFrames) {
          try {
            const frameUrl = frame.url();
            if (frameUrl && !frameUrl.includes('google.com') && !frameUrl.includes('doubleclick')) {
              const frameContent = await frame.content();
              extractFromContent(frameContent, frameUrl);
            }
          } catch (e) {}
        }

        // Wait 3 final seconds for any network responses from triggered plays to register
        console.log(`[HLS Extractor] Waiting for final stream network responses...`);
        await new Promise((resolve) => setTimeout(resolve, 3000));

      } finally {
        await browser.close();
      }

    } catch (err: any) {
      console.warn(`[HLS Extractor] Browser extraction failed or was unsupported. Error: ${err.message}`);
      browserError = err.message;
    }

    // Fallback to static scraper if no playlists found or browser execution failed
    if (foundPlaylists.size === 0) {
      console.log(`[HLS Extractor] Fallback to static scraper. (Playlists found via browser: 0, error: ${browserError || 'none'})`);
      try {
        const crawledUrls = new Set<string>();

        // Safe fetch helper with timeout and User-Agent
        const safeFetchText = async (urlStr: string): Promise<string> => {
          try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 6000); // 6s timeout

            const response = await fetch(urlStr, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': urlStr
              },
              signal: controller.signal
            });
            clearTimeout(id);

            if (!response.ok) return '';
            return await response.text();
          } catch (e: any) {
            return '';
          }
        };

        const crawl = async (currentUrl: string, depth = 0) => {
          if (depth > 2 || crawledUrls.has(currentUrl)) return;
          crawledUrls.add(currentUrl);

          const html = await safeFetchText(currentUrl);
          if (!html) return;

          extractFromContent(html, currentUrl);

          const iframeRegex = /<iframe[^>]+?src=["'](https?:\/\/[^"']+)["']/gi;
          let iframeMatch;
          const iframeUrls: string[] = [];
          iframeRegex.lastIndex = 0;
          while ((iframeMatch = iframeRegex.exec(html)) !== null) {
            const iframeSrc = iframeMatch[1];
            if (!crawledUrls.has(iframeSrc) && !iframeSrc.includes('google.com') && !iframeSrc.includes('doubleclick')) {
              iframeUrls.push(iframeSrc);
            }
          }

          const embedRegex = /(?:src|href|embed_url|source|data-src)["']?\s*[:=]\s*["'](https?:\/\/[^"'\s>]+)/gi;
          let embedMatch;
          embedRegex.lastIndex = 0;
          while ((embedMatch = embedRegex.exec(html)) !== null) {
            const embedSrc = embedMatch[1];
            if (!crawledUrls.has(embedSrc) && (embedSrc.includes('embed') || embedSrc.includes('player') || embedSrc.includes('video') || embedSrc.includes('play'))) {
              if (!iframeUrls.includes(embedSrc) && !embedSrc.includes('google.com') && !embedSrc.includes('doubleclick')) {
                iframeUrls.push(embedSrc);
              }
            }
          }

          for (const url of iframeUrls) {
            await crawl(url, depth + 1);
          }
        };

        await crawl(targetUrl, 0);
      } catch (err) {
        console.error('[HLS Extractor] Static crawling fallback error:', err);
      }
    }

    const playlistUrls = Array.from(foundPlaylists);
    const subtitleList = Array.from(foundSubtitles.entries()).map(([url, lang]) => ({
      lang,
      url
    }));

    console.log(`[HLS Extractor] Completed extraction. Found ${playlistUrls.length} playlists, ${subtitleList.length} subtitles.`);

    res.json({
      success: true,
      originalUrl: targetUrl,
      playlists: playlistUrls,
      subtitles: subtitleList,
      usedBrowser,
      browserError,
      message: playlistUrls.length > 0 
        ? `Berhasil mengekstrak ${playlistUrls.length} playlist HLS (.m3u8) dan ${subtitleList.length} subtitle.` 
        : 'Tidak ada playlist HLS (.m3u8) yang ditemukan di halaman ini.'
    });
  });

  // Vite integration
  // Vite middleware for development
  let viteMiddlewares: any = null;
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      viteMiddlewares = vite.middlewares;
    } catch (err) {
      console.warn("Vite failed to load, falling back to production static serving:", err);
    }
  }

  if (viteMiddlewares) {
    app.use(viteMiddlewares);
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
