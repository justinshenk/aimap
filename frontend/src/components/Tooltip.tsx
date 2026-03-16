import type { PaperPoint } from "../types";

interface Props {
  point: PaperPoint | null;
  x: number;
  y: number;
}

export default function Tooltip({ point, x, y }: Props) {
  if (!point) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: x + 12,
        top: y - 10,
        maxWidth: "350px",
        padding: "8px 12px",
        background: "rgba(20, 20, 40, 0.95)",
        border: "1px solid #444",
        borderRadius: "6px",
        color: "#e0e0e0",
        fontSize: "12px",
        lineHeight: 1.4,
        pointerEvents: "none",
        zIndex: 100,
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: "4px" }}>{point.title}</div>
      <div style={{ color: "#888" }}>
        {point.year} | {point.citation_count.toLocaleString()} citations
      </div>
    </div>
  );
}
