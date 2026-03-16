import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import createScatterplot from "regl-scatterplot";
import type { PaperPoint, Cluster } from "../types";

// Generate distinct colors for clusters using golden angle
function generateClusterColors(
  maxClusters: number
): [number, number, number, number][] {
  const colors: [number, number, number, number][] = [];
  for (let id = 0; id < maxClusters; id++) {
    const hue = (id * 137.508) % 360;
    const s = 0.7,
      l = 0.55;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0,
      g = 0,
      b = 0;
    if (hue < 60) [r, g, b] = [c, x, 0];
    else if (hue < 120) [r, g, b] = [x, c, 0];
    else if (hue < 180) [r, g, b] = [0, c, x];
    else if (hue < 240) [r, g, b] = [0, x, c];
    else if (hue < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    colors.push([r + m, g + m, b + m, 1]);
  }
  return colors;
}

// Year-based color: blue (2020) → cyan → green → yellow → red (2024)
function yearColor(year: number): [number, number, number, number] {
  const t = Math.max(0, Math.min(1, (year - 2020) / 4));
  // Blue → Cyan → Green → Yellow → Red
  const r = t < 0.5 ? 0 : (t - 0.5) * 2;
  const g = t < 0.25 ? t * 4 : t < 0.75 ? 1 : (1 - t) * 4;
  const b = t < 0.5 ? 1 - t * 2 : 0;
  return [r, g, b, 0.85];
}

// Citation-based color: dark → bright (log scale)
function citationColor(
  count: number,
  maxLog: number
): [number, number, number, number] {
  const t = Math.max(0, Math.min(1, Math.log1p(count) / maxLog));
  return [0.2 + t * 0.8, 0.1 + t * 0.3, 0.8 - t * 0.5, 0.85];
}

export type ColorMode = "cluster" | "year" | "citations";

interface Props {
  points: PaperPoint[];
  clusters: Cluster[];
  highlightIds?: Set<string>;
  onSelect: (index: number) => void;
  onHover: (index: number | null, screenX: number, screenY: number) => void;
  yearRange: [number, number];
  colorMode: ColorMode;
}

export default function ScatterMap({
  points,
  clusters,
  highlightIds,
  onSelect,
  onHover,
  yearRange,
  colorMode,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scatterRef = useRef<ReturnType<typeof createScatterplot> | null>(null);
  const indexMapRef = useRef<number[]>([]);
  const [clusterLabelPositions, setClusterLabelPositions] = useState<
    Map<number, { x: number; y: number }>
  >(new Map());

  // Compute unique cluster IDs and color map
  const clusterColorMap = useMemo(() => {
    const ids = [...new Set(points.map((p) => p.cluster_id))].sort(
      (a, b) => a - b
    );
    const colors = generateClusterColors(Math.max(ids.length, 1));
    const map = new Map<number, number>();
    ids.forEach((id, i) => map.set(id, i));
    return { map, colors, ids };
  }, [points]);

  // Max log citations for normalization
  const maxLogCitations = useMemo(() => {
    if (points.length === 0) return 1;
    return Math.log1p(Math.max(...points.map((p) => p.citation_count)));
  }, [points]);

  // Filter points by year range
  const filteredIndices = useMemo(() => {
    return points.reduce<number[]>((acc, p, i) => {
      if (p.year >= yearRange[0] && p.year <= yearRange[1]) acc.push(i);
      return acc;
    }, []);
  }, [points, yearRange]);

  // Initialize scatterplot
  useEffect(() => {
    if (!canvasRef.current) return;

    const scatterplot = createScatterplot({
      canvas: canvasRef.current,
      pointSize: 4,
      opacity: 0.85,
      lassoOnLongPress: true,
      colorBy: "category",
      pointColor: clusterColorMap.colors,
    } as any);

    scatterRef.current = scatterplot;

    return () => {
      scatterplot.destroy();
      scatterRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build color array based on mode
  const buildColors = useCallback(() => {
    const n = filteredIndices.length;
    if (colorMode === "cluster") {
      // Use category channel
      return null; // handled by pointColor
    }

    const colors: [number, number, number, number][] = [];
    for (let i = 0; i < n; i++) {
      const p = points[filteredIndices[i]];
      if (colorMode === "year") {
        colors.push(yearColor(p.year));
      } else {
        colors.push(citationColor(p.citation_count, maxLogCitations));
      }
    }
    return colors;
  }, [filteredIndices, points, colorMode, maxLogCitations]);

  // Update points when data or filters change
  useEffect(() => {
    const scatterplot = scatterRef.current;
    if (!scatterplot || points.length === 0) return;

    const n = filteredIndices.length;
    const x = new Float32Array(n);
    const y = new Float32Array(n);
    const category = new Uint8Array(n);

    indexMapRef.current = filteredIndices;

    filteredIndices.forEach((origIdx, i) => {
      const p = points[origIdx];
      x[i] = p.x;
      y[i] = p.y;
      category[i] = clusterColorMap.map.get(p.cluster_id) ?? 0;
    });

    const customColors = buildColors();
    if (customColors) {
      try {
        (scatterplot as any).set({ pointColor: customColors });
      } catch {
        // fallback
      }
    } else {
      try {
        (scatterplot as any).set({ pointColor: clusterColorMap.colors });
      } catch {
        // fallback
      }
    }

    scatterplot.draw({ x, y, category });
  }, [points, filteredIndices, clusterColorMap, highlightIds, colorMode, buildColors]);

  // Handle selection events
  const handleSelect = useCallback(
    (filteredIdx: number) => {
      const origIdx = indexMapRef.current[filteredIdx];
      if (origIdx !== undefined) onSelect(origIdx);
    },
    [onSelect]
  );

  // Handle hover events
  const handleHover = useCallback(
    (pointIdx: number | null) => {
      if (pointIdx === null || pointIdx === undefined || pointIdx < 0) {
        onHover(null, 0, 0);
        return;
      }
      const scatterplot = scatterRef.current;
      if (!scatterplot) return;

      const origIdx = indexMapRef.current[pointIdx];
      try {
        const pos = (scatterplot as any).getScreenPosition(pointIdx);
        if (pos) {
          onHover(origIdx, pos[0], pos[1]);
        }
      } catch {
        onHover(origIdx, 0, 0);
      }
    },
    [onHover]
  );

  // Update cluster label screen positions on view change
  const updateLabelPositions = useCallback(() => {
    const scatterplot = scatterRef.current;
    if (!scatterplot || clusters.length === 0) return;

    // Find the index closest to each cluster centroid and use getScreenPosition
    const positions = new Map<number, { x: number; y: number }>();
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Use xScale/yScale to map data coords to screen
    try {
      const xScale = (scatterplot as any).get("xScale");
      const yScale = (scatterplot as any).get("yScale");
      if (xScale && yScale) {
        for (const c of clusters) {
          const sx = xScale(c.centroid_x);
          const sy = yScale(c.centroid_y);
          if (
            sx >= 0 &&
            sx <= canvas.width &&
            sy >= 0 &&
            sy <= canvas.height
          ) {
            positions.set(c.cluster_id, {
              x: sx * (canvas.clientWidth / canvas.width),
              y: sy * (canvas.clientHeight / canvas.height),
            });
          }
        }
      }
    } catch {
      // scales not available yet
    }

    setClusterLabelPositions(positions);
  }, [clusters]);

  useEffect(() => {
    const scatterplot = scatterRef.current;
    if (!scatterplot) return;

    const selectHandler = ({
      points: selectedPoints,
    }: {
      points: number[];
    }) => {
      if (selectedPoints.length > 0) handleSelect(selectedPoints[0]);
    };

    const overHandler = (pointIdx: number) => handleHover(pointIdx);
    const outHandler = () => handleHover(null);
    const viewHandler = () => updateLabelPositions();

    scatterplot.subscribe("select", selectHandler);
    scatterplot.subscribe("pointOver", overHandler);
    scatterplot.subscribe("pointOut", outHandler);
    scatterplot.subscribe("view", viewHandler);
    scatterplot.subscribe("draw", viewHandler);

    return () => {
      scatterplot.unsubscribe("select", selectHandler);
      scatterplot.unsubscribe("pointOver", overHandler);
      scatterplot.unsubscribe("pointOut", outHandler);
      scatterplot.unsubscribe("view", viewHandler);
      scatterplot.unsubscribe("draw", viewHandler);
    };
  }, [handleSelect, handleHover, updateLabelPositions]);

  // Only show labels for larger clusters
  const visibleClusters = useMemo(() => {
    return clusters.filter((c) => c.paper_count >= 40);
  }, [clusters]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      {/* Cluster labels overlay */}
      {visibleClusters.map((c) => {
        const pos = clusterLabelPositions.get(c.cluster_id);
        if (!pos) return null;
        return (
          <div
            key={c.cluster_id}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              pointerEvents: "none",
              fontSize: "11px",
              fontWeight: 600,
              color: "#fff",
              textShadow:
                "0 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.5)",
              whiteSpace: "nowrap",
              transform: "translate(-50%, -50%)",
              opacity: 0.85,
            }}
          >
            {c.label}
          </div>
        );
      })}
    </div>
  );
}
