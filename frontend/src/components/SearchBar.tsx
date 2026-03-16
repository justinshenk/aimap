import { useState, useCallback, useRef } from "react";
import type { PaperPoint } from "../types";

interface Props {
  points: PaperPoint[];
  onResults: (ids: Set<string>) => void;
}

export default function SearchBar({ points, onResults }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PaperPoint[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleChange = useCallback(
    (value: string) => {
      setQuery(value);
      clearTimeout(debounceRef.current);

      if (value.length < 2) {
        setResults([]);
        onResults(new Set());
        return;
      }

      debounceRef.current = setTimeout(() => {
        const lower = value.toLowerCase();
        const matched = points
          .filter((p) => p.title.toLowerCase().includes(lower))
          .slice(0, 50);
        setResults(matched);
        onResults(new Set(matched.map((p) => p.id)));
      }, 200);
    },
    [points, onResults]
  );

  return (
    <div
      style={{
        position: "absolute",
        top: "12px",
        left: "12px",
        zIndex: 10,
        width: "320px",
      }}
    >
      <input
        type="text"
        placeholder="Search papers..."
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 14px",
          background: "rgba(20, 20, 40, 0.9)",
          border: "1px solid #333",
          borderRadius: "8px",
          color: "#e0e0e0",
          fontSize: "14px",
          outline: "none",
        }}
      />
      {results.length > 0 && (
        <div
          style={{
            marginTop: "4px",
            background: "rgba(20, 20, 40, 0.95)",
            border: "1px solid #333",
            borderRadius: "8px",
            maxHeight: "300px",
            overflowY: "auto",
            fontSize: "12px",
          }}
        >
          <div style={{ padding: "6px 12px", color: "#888" }}>
            {results.length} results
          </div>
          {results.slice(0, 10).map((p) => (
            <div
              key={p.id}
              style={{
                padding: "8px 12px",
                borderTop: "1px solid #222",
                color: "#ccc",
              }}
            >
              <div style={{ fontWeight: 500 }}>{p.title}</div>
              <div style={{ color: "#888", marginTop: "2px" }}>
                {p.year} | {p.citation_count.toLocaleString()} citations
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
