import { useState, useCallback, useMemo, useEffect } from "react";
import ScatterMap, { type ColorMode } from "./components/ScatterMap";
import PaperDetail from "./components/PaperDetail";
import TimeSlider from "./components/TimeSlider";
import SearchBar from "./components/SearchBar";
import Tooltip from "./components/Tooltip";
import ColorLegend from "./components/ColorLegend";
import { usePoints, useClusters, fetchPaperDetail } from "./hooks/useData";
import type { PaperDetail as PaperDetailType, PaperPoint } from "./types";

function parseUrlState() {
  const params = new URLSearchParams(window.location.search);
  return {
    colorMode: (params.get("color") as ColorMode) || "cluster",
    yearMin: params.has("ymin") ? parseInt(params.get("ymin")!) : null,
    yearMax: params.has("ymax") ? parseInt(params.get("ymax")!) : null,
    search: params.get("q") || "",
    paperId: params.get("paper") || null,
  };
}

function updateUrl(state: Record<string, string | null>) {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(state)) {
    if (value === null || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }
  const newUrl = params.toString()
    ? `${window.location.pathname}?${params}`
    : window.location.pathname;
  window.history.replaceState(null, "", newUrl);
}

export default function App() {
  const { points, loading, error } = usePoints();
  const clusters = useClusters();

  const urlState = useMemo(() => parseUrlState(), []);

  const [selectedPaper, setSelectedPaper] = useState<PaperDetailType | null>(
    null
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const [colorMode, setColorMode] = useState<ColorMode>(urlState.colorMode);

  // Tooltip state
  const [hoveredPoint, setHoveredPoint] = useState<PaperPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Compute year range from data
  const yearBounds = useMemo(() => {
    if (points.length === 0) return { min: 2020, max: 2024 };
    const years = points.map((p) => p.year).filter(Boolean);
    return { min: Math.min(...years), max: Math.max(...years) };
  }, [points]);

  const [yearRange, setYearRange] = useState<[number, number]>([
    urlState.yearMin ?? 2020,
    urlState.yearMax ?? 2024,
  ]);

  useEffect(() => {
    if (!urlState.yearMin && !urlState.yearMax) {
      setYearRange([yearBounds.min, yearBounds.max]);
    }
  }, [yearBounds, urlState.yearMin, urlState.yearMax]);

  // Load paper from URL if specified
  useEffect(() => {
    if (urlState.paperId && points.length > 0) {
      fetchPaperDetail(urlState.paperId).then((detail) => {
        if (detail) setSelectedPaper(detail);
      });
    }
  }, [urlState.paperId, points.length]);

  // Update URL on state changes
  useEffect(() => {
    updateUrl({
      color: colorMode === "cluster" ? null : colorMode,
    });
  }, [colorMode]);

  const handleSelect = useCallback(
    async (index: number) => {
      const point = points[index];
      if (!point) return;
      setDetailLoading(true);
      updateUrl({ paper: point.id });
      const detail = await fetchPaperDetail(point.id);
      setSelectedPaper(detail);
      setDetailLoading(false);
    },
    [points]
  );

  const handleHover = useCallback(
    (index: number | null, screenX: number, screenY: number) => {
      if (index === null) {
        setHoveredPoint(null);
      } else {
        setHoveredPoint(points[index] || null);
        setTooltipPos({ x: screenX, y: screenY });
      }
    },
    [points]
  );

  const handleCloseDetail = useCallback(() => {
    setSelectedPaper(null);
    updateUrl({ paper: null });
  }, []);

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
          Make sure data files exist in public/
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
            ML Research Map
          </span>
        </h1>
        <span style={{ fontSize: "12px", color: "#666" }}>
          {points.length.toLocaleString()} papers | {clusters.length} topics |{" "}
          {yearBounds.min}–{yearBounds.max}
        </span>
      </div>

      {/* Main map area */}
      <div style={{ flex: 1, position: "relative" }}>
        <SearchBar points={points} onResults={setHighlightIds} />
        <ColorLegend
          mode={colorMode}
          onModeChange={setColorMode}
          clusters={clusters}
        />
        <ScatterMap
          points={points}
          clusters={clusters}
          highlightIds={highlightIds}
          onSelect={handleSelect}
          onHover={handleHover}
          yearRange={yearRange}
          colorMode={colorMode}
        />
        <Tooltip
          point={hoveredPoint}
          x={tooltipPos.x}
          y={tooltipPos.y}
        />
        <PaperDetail
          paper={selectedPaper}
          loading={detailLoading}
          onClose={handleCloseDetail}
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
