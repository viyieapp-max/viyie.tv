import { useState, useEffect } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../lib/firebase";

export interface StudioInfo {
  name: string;
  logoUrl: string;
  logoZoom?: number;
  logoRotate?: number;
  logoShiftX?: number;
  logoShiftY?: number;
  logoBgColor?: string;
  logoShape?: "none" | "circle" | "square" | "rounded" | "pill";
  logoBorder?: boolean;
  logoColorMode?: "original" | "white" | "black" | "grayscale" | "custom";
  logoHueRotate?: number;
  logoBrightness?: number;
  logoContrast?: number;
  logoGrayscale?: number;
  logoInvert?: number;
}

// Global cache for studios
let cachedStudios: StudioInfo[] | null = null;
let settingsSubscribers: ((data: StudioInfo[]) => void)[] = [];
let unsubscribeGlobal: (() => void) | null = null;

export function useStudios() {
  const [studios, setStudios] = useState<StudioInfo[]>(cachedStudios || []);
  const [loading, setLoading] = useState(!cachedStudios);

  useEffect(() => {
    const handleStudiosUpdate = (list: StudioInfo[]) => {
      setStudios(list);
      setLoading(false);
    };

    settingsSubscribers.push(handleStudiosUpdate);

    if (!unsubscribeGlobal) {
      const q = query(collection(db, "studios"));
      unsubscribeGlobal = onSnapshot(
        q,
        (snap) => {
          const list = snap.docs.map((d) => {
            const data = (d.data() || {}) as StudioInfo;
            // Ensure fields are never undefined/null to prevent UI crash
            data.name = data.name || d.id || "";
            data.logoUrl = data.logoUrl || "";

            // Hotfix for broken wikimedia SVG thumbnails
            if (
              data.logoUrl &&
              data.logoUrl.endsWith(".svg") &&
              data.logoUrl.includes("/thumb/")
            ) {
              data.logoUrl = data.logoUrl.replace("/thumb/", "/");
            }
            return data;
          });

          // Deduplicate list by name
          const uniqueList: StudioInfo[] = [];
          const seenNames = new Set<string>();
          for (const s of list) {
            const trimmedName = s.name.trim();
            const lowerName = trimmedName.toLowerCase();
            if (trimmedName && !seenNames.has(lowerName)) {
              seenNames.add(lowerName);
              uniqueList.push({
                ...s,
                name: trimmedName,
              });
            }
          }

          cachedStudios = uniqueList;
          settingsSubscribers.forEach((sub) => sub(uniqueList));
        },
        (err) => {
          console.error("Error fetching studios", err);
        },
      );
    } else {
      if (cachedStudios) {
        setStudios(cachedStudios);
        setLoading(false);
      }
    }

    return () => {
      settingsSubscribers = settingsSubscribers.filter(
        (s) => s !== handleStudiosUpdate,
      );
      if (settingsSubscribers.length === 0 && unsubscribeGlobal) {
        unsubscribeGlobal();
        unsubscribeGlobal = null;
        cachedStudios = null;
      }
    };
  }, []);

  return { studios, loading };
}
