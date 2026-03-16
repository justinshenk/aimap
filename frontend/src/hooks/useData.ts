import { useState, useEffect } from "react";
import type { PaperPoint, PaperDetail, Cluster } from "../types";

// For Vercel: load from static JSON files instead of API
let papersCache: Record<string, PaperDetail> | null = null;

export function usePoints() {
  const [points, setPoints] = useState<PaperPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/points.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setPoints(data.points))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { points, loading, error };
}

export function useClusters() {
  const [clusters, setClusters] = useState<Cluster[]>([]);

  useEffect(() => {
    fetch("/points.json")
      .then((r) => r.json())
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

export async function searchPapers(query: string): Promise<PaperPoint[]> {
  // Client-side search — filter the already-loaded points
  // This is a simple substring match; for production, use something like Fuse.js
  const r = await fetch("/points.json");
  const data = await r.json();
  const q = query.toLowerCase();
  return data.points
    .filter((p: PaperPoint) => p.title.toLowerCase().includes(q))
    .slice(0, 50);
}
