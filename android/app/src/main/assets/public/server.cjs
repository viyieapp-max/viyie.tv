"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_googleapis = require("googleapis");
var import_youtube_transcript = require("youtube-transcript");
var import_google_translate_api = require("@vitalets/google-translate-api");
import_dotenv.default.config();
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "10mb" }));
  app.get("/api/youtube-srt", async (req, res) => {
    const { videoId } = req.query;
    if (!videoId || typeof videoId !== "string") {
      return res.status(400).json({ error: "Missing videoId" });
    }
    try {
      const transcript = await import_youtube_transcript.YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
      let srtOutput = "";
      const texts = transcript.map((t) => t.text);
      const translatedTexts = [];
      const chunkSize = 30;
      for (let i = 0; i < texts.length; i += chunkSize) {
        const chunk = texts.slice(i, i + chunkSize);
        const chunkString = chunk.join(" \n\n ");
        try {
          const res2 = await (0, import_google_translate_api.translate)(chunkString, { to: "id" });
          const translatedChunk = res2.text.split(" \n\n ");
          if (translatedChunk.length === chunk.length) {
            translatedTexts.push(...translatedChunk);
          } else {
            translatedTexts.push(...chunk);
          }
        } catch (e) {
          console.error("Bulk translate error:", e);
          translatedTexts.push(...chunk);
        }
      }
      for (let i = 0; i < transcript.length; i++) {
        const t = transcript[i];
        const formatTime = (msSinceStart) => {
          const totalSeconds = msSinceStart / 1e3;
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor(totalSeconds % 3600 / 60);
          const seconds = Math.floor(totalSeconds % 60);
          const ms = Math.floor(msSinceStart % 1e3);
          return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
        };
        const startTime = formatTime(t.offset);
        const endTime = formatTime(t.offset + t.duration);
        let translatedText = translatedTexts[i] || t.text;
        srtOutput += `${i + 1}
`;
        srtOutput += `${startTime} --> ${endTime}
`;
        srtOutput += `${translatedText}

`;
      }
      res.setHeader("Content-Type", "text/srt; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${videoId}_indo.srt"`);
      res.send(srtOutput);
    } catch (error) {
      console.error("SRT Fetch failed", error);
      res.status(500).json({ error: error.message });
    }
  });
  const oauth2Client = new import_googleapis.google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_URL || "http://localhost:3000"}/auth/callback`
  );
  const getRedirectUri = (req) => {
    const host = req.headers.host;
    if (host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
      const protocol = req.headers["x-forwarded-proto"] || "https";
      return `${protocol}://${host}/auth/callback`;
    }
    if (process.env.APP_URL) {
      return `${process.env.APP_URL.replace(/\/$/, "")}/auth/callback`;
    }
    return `http://localhost:3000/auth/callback`;
  };
  app.get("/api/auth/google/url", (req, res) => {
    const redirectUri = getRedirectUri(req);
    const client = new import_googleapis.google.auth.OAuth2(
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
      prompt: "consent select_account"
    });
    res.json({ url, redirectUri });
  });
  app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;
    try {
      const redirectUri = getRedirectUri(req);
      const client = new import_googleapis.google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
      );
      const { tokens } = await client.getToken(code);
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
  app.post("/api/drive/sync", async (req, res) => {
    const { tokens, data } = req.body;
    if (!tokens) return res.status(401).json({ error: "Missing tokens" });
    const auth = new import_googleapis.google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials(tokens);
    const drive = import_googleapis.google.drive({ version: "v3", auth });
    try {
      console.log("Checking for existing backup file in appDataFolder...");
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
        const fileId = listRes.data.files[0].id;
        console.log(`Updating existing backup file: ${fileId}`);
        await drive.files.update({
          fileId,
          media
        });
      } else {
        console.log("Creating new backup file in appDataFolder");
        await drive.files.create({
          requestBody: fileMetadata,
          media,
          fields: "id"
        });
      }
      res.json({ success: true });
    } catch (error) {
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
    const auth = new import_googleapis.google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials(tokens);
    const drive = import_googleapis.google.drive({ version: "v3", auth });
    try {
      console.log("Loading backup file from appDataFolder...");
      const listRes = await drive.files.list({
        spaces: "appDataFolder",
        q: "name = 'viyie_data.json'",
        fields: "files(id, name)"
      });
      if (listRes.data.files && listRes.data.files.length > 0) {
        const fileId = listRes.data.files[0].id;
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
    } catch (error) {
      const errorDetail = error.response?.data || error.message;
      console.error("Drive load backend error detail:", JSON.stringify(errorDetail, null, 2));
      res.status(500).json({
        error: error.message,
        details: errorDetail
      });
    }
  });
  app.post("/api/admin/verify", (req, res) => {
    const { username, password } = req.body;
    const validUser = process.env.ADMIN_USER || "firefury";
    const validPass = process.env.ADMIN_PASS || "FireFury01pr00";
    if (username === validUser && password === validPass) {
      res.json({ success: true, token: "secure_admin_session_placeholder" });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  });
  app.get("/api/imdb/:imdbId", async (req, res) => {
    const { imdbId } = req.params;
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "TMDB_API_KEY is not configured in server environment. Please set it in Settings." });
    }
    try {
      const findRes = await fetch(`https://api.themoviedb.org/3/find/${imdbId}?api_key=${apiKey}&external_source=imdb_id`);
      if (!findRes.ok) {
        const err = await findRes.json().catch(() => ({}));
        return res.status(findRes.status).json({ error: err.status_message || "TMDB Find API failed" });
      }
      const findData = await findRes.json();
      let result = null;
      let type = "movie";
      if (findData.movie_results && findData.movie_results.length > 0) {
        result = findData.movie_results[0];
        type = "movie";
      } else if (findData.tv_results && findData.tv_results.length > 0) {
        result = findData.tv_results[0];
        type = "tv";
      } else if (findData.tv_episode_results && findData.tv_episode_results.length > 0) {
        result = findData.tv_episode_results[0];
        type = "tv";
      }
      if (!result) {
        return res.status(404).json({ error: "Content not found on TMDB with this IMDb ID. Double check the ID." });
      }
      let detailsUrl = `https://api.themoviedb.org/3/${type}/${result.id}?api_key=${apiKey}&append_to_response=credits`;
      const detailsRes = await fetch(detailsUrl);
      if (!detailsRes.ok) {
        return res.status(detailsRes.status).json({ error: "Failed to fetch details from TMDB" });
      }
      const details = await detailsRes.json();
      const formattedData = {
        title: details.title || details.name,
        synopsis: details.overview,
        releaseDate: details.release_date || details.first_air_date,
        rating: details.vote_average ? details.vote_average.toFixed(1) : "0",
        poster: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : "",
        backdrop: details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : "",
        genres: details.genres ? details.genres.map((g) => g.name) : [],
        type,
        duration: type === "movie" && details.runtime ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` : "",
        cast: details.credits?.cast?.slice(0, 10).map((c) => c.name) || []
        // Up to 10 cast members
      };
      res.json(formattedData);
    } catch (error) {
      console.error("TMDB error:", error);
      res.status(500).json({ error: "Internal Server Error fetching from TMDB" });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
