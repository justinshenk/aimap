import { useState, useEffect, useRef } from "react";
import type { PaperPoint, PaperDetail, Cluster } from "../types";

// Caches
let pointsData: { points: PaperPoint[]; clusters: Cluster[] } | null = null;
let papersCache: Record<string, PaperDetail> | null = null;
let pointsFetchPromise: Promise<{ points: PaperPoint[]; clusters: Cluster[] }> | null = null;

async function loadPointsData() {
  if (pointsData) return pointsData;
  if (pointsFetchPromise) return pointsFetchPromise;
  pointsFetchPromise = fetch("/points.json")
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      pointsData = data;
      return data;
    });
  return pointsFetchPromise;
}

export function usePoints() {
  const [points, setPoints] = useState<PaperPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPointsData()
      .then((data) => setPoints(data.points))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { points, loading, error };
}

export function useClusters() {
  const [clusters, setClusters] = useState<Cluster[]>([]);

  useEffect(() => {
    loadPointsData()
      .then((data) => setClusters(data.clusters))
      .catch(console.error);
  }, []);

  return clusters;
}

async function loadPapersCache(): Promise<Record<string, PaperDetail>> {
  if (papersCache) return papersCache;
  const r = await fetch("/papers.json");
  papersCache = await r.json();
  return papersCache!;
}

export async function fetchPaperDetail(
  paperId: string
): Promise<PaperDetail | null> {
  try {
    const papers = await loadPapersCache();
    return papers[paperId] || null;
  } catch {
    return null;
  }
}

export function useSearch(points: PaperPoint[]) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PaperPoint[]>([]);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const search = (q: string) => {
    setQuery(q);
    clearTimeout(debounceRef.current);

    if (q.length < 2) {
      setResults([]);
      setHighlightIds(new Set());
      return;
    }

    debounceRef.current = setTimeout(() => {
      const lower = q.toLowerCase();
      const matched = points
        .filter((p) => p.title.toLowerCase().includes(lower))
        .slice(0, 50);
      setResults(matched);
      setHighlightIds(new Set(matched.map((p) => p.id)));
    }, 200);
  };

  return { query, search, results, highlightIds };
}
