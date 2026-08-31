const fs = require('fs');
let code = fs.readFileSync('src/pages/LoginRoute.tsx', 'utf8');

code = code.replace(/import { db, collection, getDocs, query } from "\.\.\/lib\/firebase";/, 'import { useContent } from "../hooks/useContent";');

const oldUseEffect = `  // Fetch actual movie covers from Firestore and sort by date descending
  useEffect(() => {
    const fetchContent = async () => {
      try {
        const q = query(collection(db, "content"));
        const snapshot = await getDocs(q);
        const list: any[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.poster || data.posterUrl) {
            list.push({
              poster: data.poster || data.posterUrl,
              releaseDate: data.releaseDate || "",
            });
          }
        });

        // "terbaru menurut data tanggal bukan upload terbaru"
        list.sort((a, b) => {
          const da = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
          const db = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
          const validDa = isNaN(da) ? 0 : da;
          const validDb = isNaN(db) ? 0 : db;
          return validDb - validDa;
        });

        const posters = list.map((item) => item.poster);
        if (posters.length > 0) {
          // Fill columns with actual content
          setLatestPosters(posters);
        }
      } catch (err) {
        console.error("Error loading posters for login page: ", err);
      }
    };

    fetchContent();
  }, []);`;

const newCode = `  const { contents } = useContent();

  useEffect(() => {
    if (contents && contents.length > 0) {
      const list = contents.filter(c => c.poster || c.posterUrl).map(c => ({
        poster: (c.poster || c.posterUrl) as string,
        releaseDate: c.releaseDate || ""
      }));
      list.sort((a, b) => {
        const da = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
        const db = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
        const validDa = isNaN(da) ? 0 : da;
        const validDb = isNaN(db) ? 0 : db;
        return validDb - validDa;
      });
      if (list.length > 0) {
        setLatestPosters(list.map(c => c.poster));
      }
    }
  }, [contents]);`;

code = code.replace(oldUseEffect, newCode);
fs.writeFileSync('src/pages/LoginRoute.tsx', code);
