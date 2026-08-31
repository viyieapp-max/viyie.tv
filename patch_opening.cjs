const fs = require('fs');
let code = fs.readFileSync('src/pages/ViyieOpening.tsx', 'utf8');

const oldUseEffect = `  // Mount stagger trigger
  useEffect(() => {
    setIsMounted(true);
    // Fetch dynamically loaded movie posters
    const fetchCovers = async () => {
      try {
        const q = query(collection(db, "content"));
        const snapshot = await getDocs(q);
        const list: string[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.poster || data.posterUrl) {
            list.push(data.poster || data.posterUrl);
          }
        });
        if (list.length > 0) {
          setPosters(list);
        }
      } catch (err) {
        console.error("Error fetching covers for landing page: ", err);
      }
    };
    fetchCovers();
    localStorage.setItem("has_seen_opening", "true");
  }, []);`;

const newCode = `  // Mount stagger trigger
  useEffect(() => {
    setIsMounted(true);
    localStorage.setItem("has_seen_opening", "true");
  }, []);

  useEffect(() => {
    if (contents && contents.length > 0) {
      const list = contents.filter(c => c.poster || c.posterUrl).map(c => c.poster || c.posterUrl) as string[];
      if (list.length > 0) {
        setPosters(list);
      }
    }
  }, [contents]);`;

code = code.replace(oldUseEffect, newCode);
fs.writeFileSync('src/pages/ViyieOpening.tsx', code);
