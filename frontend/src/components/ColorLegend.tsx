import type { ColorMode } from "./ScatterMap";
import type { Cluster } from "../types";

interface Props {
  mode: ColorMode;
  onModeChange: (mode: ColorMode) => void;
  clusters: Cluster[];
}

// Same color generation as ScatterMap
function clusterHue(index: number): string {
  const hue = (index * 137.508) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

export default function ColorLegend({ mode, onModeChange, clusters }: Props) {
  return (
    <div
      style={{
        position: "absolute",
        top: "12px",
        right: "12px",
        zIndex: 10,
        background: "rgba(20, 20, 40, 0.9)",
        border: "1px solid #333",
        borderRadius: "8px",
        padding: "10px 14px",
        maxWidth: "220px",
        maxHeight: "60vh",
        overflowY: "auto",
      }}
    >
      {/* Mode selector */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          marginBottom: "10px",
        }}
      >
        {(["cluster", "year", "citations"] as ColorMode[]).map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            style={{
              flex: 1,
              padding: "4px 6px",
              fontSize: "10px",
              fontWeight: mode === m ? 700 : 400,
              background: mode === m ? "#2a2a5a" : "transparent",
              border: `1px solid ${mode === m ? "#6ea8fe" : "#444"}`,
              borderRadius: "4px",
              color: mode === m ? "#6ea8fe" : "#888",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Legend content based on mode */}
      {mode === "cluster" && (
        <div style={{ fontSize: "10px", color: "#aaa" }}>
          {clusters.slice(0, 15).map((c, i) => (
            <div
              key={c.cluster_id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "3px",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: clusterHue(i),
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {c.label}{" "}
                <span style={{ color: "#666" }}>({c.paper_count})</span>
              </span>
            </div>
          ))}
          {clusters.length > 15 && (
            <div style={{ color: "#666", marginTop: "4px" }}>
              +{clusters.length - 15} more
            </div>
          )}
        </div>
      )}

      {mode === "year" && (
        <div>
          <div
            style={{
              height: "12px",
              borderRadius: "3px",
              background:
                "linear-gradient(to right, #0066ff, #00cccc, #00cc00, #cccc00, #cc0000)",
              marginBottom: "4px",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "10px",
              color: "#888",
            }}
          >
            <span>2020</span>
            <span>2022</span>
            <span>2024</span>
          </div>
        </div>
      )}

      {mode === "citations" && (
        <div>
          <div
            style={{
              height: "12px",
              borderRadius: "3px",
              background:
                "linear-gradient(to right, #331a80, #5533aa, #8844cc, #cc6644)",
              marginBottom: "4px",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "10px",
              color: "#888",
            }}
          >
            <span>0</span>
            <span>Few</span>
            <span>Many</span>
          </div>
        </div>
      )}
    </div>
  );
}
