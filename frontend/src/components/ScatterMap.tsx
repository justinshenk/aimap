import { useRef, useEffect, useCallback, useMemo } from "react";
import createScatterplot from "regl-scatterplot";
import type { PaperPoint, Cluster } from "../types";

// Generate distinct colors for clusters using golden angle
function generateClusterColors(maxClusters: number): [number, number, number, number][] {
  const colors: [number, number, number, number][] = [];
  for (let id = 0; id < maxClusters; id++) {
    const hue = (id * 137.508) % 360;
    const s = 0.7, l = 0.55;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
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

interface Props {
  points: PaperPoint[];
  clusters: Cluster[];
  highlightIds?: Set<string>;
  onSelect: (index: number) => void;
  yearRange: [number, number];
}

export default function ScatterMap({
  points,
  clusters,
  highlightIds,
  onSelect,
  yearRange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scatterRef = useRef<ReturnType<typeof createScatterplot> | null>(null);
  const indexMapRef = useRef<number[]>([]);

  // Compute unique cluster IDs and color map
  const clusterColorMap = useMemo(() => {
    const ids = [...new Set(points.map((p) => p.cluster_id))].sort((a, b) => a - b);
    const colors = generateClusterColors(Math.max(ids.length, 1));
    const map = new Map<number, number>();
    ids.forEach((id, i) => map.set(id, i));
    return { map, colors };
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
      opacity: 0.8,
      lassoOnLongPress: true,
      colorBy: "category" as Parameters<typeof createScatterplot>[0] extends undefined ? never : any,
      pointColor: clusterColorMap.colors,
    } as any);

    scatterRef.current = scatterplot;

    return () => {
      scatterplot.destroy();
      scatterRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update points when data or filters change
  useEffect(() => {
    const scatterplot = scatterRef.current;
    if (!scatterplot || points.length === 0) return;

    const n = filteredIndices.length;
    const x = new Float32Array(n);
    const y = new Float32Array(n);
    const category = new Uint8Array(n);

    // Store the mapping from filtered index → original index
    indexMapRef.current = filteredIndices;

    filteredIndices.forEach((origIdx, i) => {
      const p = points[origIdx];
      x[i] = p.x;
      y[i] = p.y;
      category[i] = clusterColorMap.map.get(p.cluster_id) ?? 0;
    });

    // Update colors if needed
    try {
      (scatterplot as any).set({ pointColor: clusterColorMap.colors });
    } catch {
      // ignore if not supported
    }

    scatterplot.draw({ x, y, category });
  }, [points, filteredIndices, clusterColorMap, highlightIds]);

  // Handle selection events
  const handleSelect = useCallback(
    (filteredIdx: number) => {
      const origIdx = indexMapRef.current[filteredIdx];
      if (origIdx !== undefined) onSelect(origIdx);
    },
    [onSelect]
  );

  useEffect(() => {
    const scatterplot = scatterRef.current;
    if (!scatterplot) return;

    const handler = ({ points: selectedPoints }: { points: number[] }) => {
      if (selectedPoints.length > 0) handleSelect(selectedPoints[0]);
    };

    scatterplot.subscribe("select", handler);
    return () => {
      scatterplot.unsubscribe("select", handler);
    };
  }, [handleSelect]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      {/* Cluster labels — hidden in MVP, needs camera-to-screen coordinate mapping */}
      {clusters.map((c) => (
        <div
          key={c.cluster_id}
          style={{
            position: "absolute",
            pointerEvents: "none",
            fontSize: "11px",
            fontWeight: 600,
            color: "#fff",
            textShadow: "0 1px 3px rgba(0,0,0,0.8)",
            whiteSpace: "nowrap",
            transform: "translate(-50%, -50%)",
            display: "none",
          }}
        >
          {c.label}
        </div>
      ))}
    </div>
  );
}
