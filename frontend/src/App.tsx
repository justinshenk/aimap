import { useState, useCallback, useMemo, useEffect } from "react";
import ScatterMap from "./components/ScatterMap";
import PaperDetail from "./components/PaperDetail";
import TimeSlider from "./components/TimeSlider";
import SearchBar from "./components/SearchBar";
import { usePoints, useClusters, fetchPaperDetail } from "./hooks/useData";
import type { PaperDetail as PaperDetailType } from "./types";

export default function App() {
  const { points, loading, error } = usePoints();
  const clusters = useClusters();

  const [selectedPaper, setSelectedPaper] = useState<PaperDetailType | null>(
    null
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());

  // Compute year range from data
  const yearBounds = useMemo(() => {
    if (points.length === 0) return { min: 2023, max: 2023 };
    const years = points.map((p) => p.year).filter(Boolean);
    return { min: Math.min(...years), max: Math.max(...years) };
  }, [points]);

  const [yearRange, setYearRange] = useState<[number, number]>([2023, 2023]);

  useEffect(() => {
    setYearRange([yearBounds.min, yearBounds.max]);
  }, [yearBounds]);

  const handleSelect = useCallback(
    async (index: number) => {
      const point = points[index];
      if (!point) return;
      setDetailLoading(true);
      const detail = await fetchPaperDetail(point.id);
      setSelectedPaper(detail);
      setDetailLoading(false);
    },
    [points]
  );

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#0f0f1a",
          color: "#888",
          fontSize: "18px",
        }}
      >
        Loading papers...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#0f0f1a",
          color: "#c0392b",
          fontSize: "16px",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div>Failed to load data: {error}</div>
        <div style={{ color: "#888", fontSize: "13px" }}>
          Make sure the backend is running: uvicorn backend.main:app --reload
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#0f0f1a",
        color: "#e0e0e0",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "8px 20px",
          borderBottom: "1px solid #333",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>
          aimap
          <span
            style={{
              fontSize: "12px",
              color: "#888",
              marginLeft: "8px",
              fontWeight: 400,
            }}
          >
            ML Research Literature Map
          </span>
        </h1>
        <span style={{ fontSize: "12px", color: "#666" }}>
          {points.length.toLocaleString()} papers | {clusters.length} clusters
        </span>
      </div>

      {/* Main map area */}
      <div style={{ flex: 1, position: "relative" }}>
        <SearchBar onResults={setHighlightIds} />
        <ScatterMap
          points={points}
          clusters={clusters}
          highlightIds={highlightIds}
          onSelect={handleSelect}
          yearRange={yearRange}
        />
        <PaperDetail
          paper={selectedPaper}
          loading={detailLoading}
          onClose={() => setSelectedPaper(null)}
        />
      </div>

      {/* Time slider */}
      <TimeSlider
        min={yearBounds.min}
        max={yearBounds.max}
        value={yearRange}
        onChange={setYearRange}
      />
    </div>
  );
}
