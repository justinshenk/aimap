import { useState, useRef, useEffect, useCallback } from "react";

interface Props {
  min: number;
  max: number;
  value: [number, number];
  onChange: (range: [number, number]) => void;
}

export default function TimeSlider({ min, max, value, onChange }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playYear, setPlayYear] = useState(min);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      clearInterval(intervalRef.current);
      setIsPlaying(false);
      // Reset to full range
      onChange([min, max]);
    } else {
      setIsPlaying(true);
      setPlayYear(min);
      onChange([min, min]);
    }
  }, [isPlaying, min, max, onChange]);

  useEffect(() => {
    if (!isPlaying) return;

    intervalRef.current = setInterval(() => {
      setPlayYear((prev) => {
        const next = prev + 1;
        if (next > max) {
          clearInterval(intervalRef.current);
          setIsPlaying(false);
          onChange([min, max]);
          return min;
        }
        onChange([min, next]);
        return next;
      });
    }, 1500);

    return () => clearInterval(intervalRef.current);
  }, [isPlaying, min, max, onChange]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 20px",
        background: "#1a1a2e",
        borderTop: "1px solid #333",
      }}
    >
      <button
        onClick={togglePlay}
        style={{
          background: isPlaying ? "#c0392b" : "#2ecc71",
          border: "none",
          color: "#fff",
          padding: "6px 14px",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: 600,
          minWidth: "60px",
        }}
      >
        {isPlaying ? "Stop" : "Play"}
      </button>

      <span style={{ color: "#888", fontSize: "12px", minWidth: "35px" }}>
        {value[0]}
      </span>

      <input
        type="range"
        min={min}
        max={max}
        value={value[0]}
        onChange={(e) => onChange([parseInt(e.target.value), value[1]])}
        style={{ flex: "1" }}
        disabled={isPlaying}
      />

      <input
        type="range"
        min={min}
        max={max}
        value={value[1]}
        onChange={(e) => onChange([value[0], parseInt(e.target.value)])}
        style={{ flex: "1" }}
        disabled={isPlaying}
      />

      <span style={{ color: "#888", fontSize: "12px", minWidth: "35px" }}>
        {value[1]}
      </span>

      {isPlaying && (
        <span style={{ color: "#2ecc71", fontSize: "13px", fontWeight: 600 }}>
          Showing: {min}–{playYear}
        </span>
      )}
    </div>
  );
}
