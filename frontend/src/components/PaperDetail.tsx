import type { PaperDetail as PaperDetailType } from "../types";

interface Props {
  paper: PaperDetailType | null;
  loading: boolean;
  onClose: () => void;
}

export default function PaperDetail({ paper, loading, onClose }: Props) {
  if (!paper && !loading) return null;

  return (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: "380px",
        background: "#1a1a2e",
        borderLeft: "1px solid #333",
        padding: "20px",
        overflowY: "auto",
        color: "#e0e0e0",
        zIndex: 10,
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          background: "none",
          border: "none",
          color: "#888",
          fontSize: "20px",
          cursor: "pointer",
        }}
      >
        x
      </button>

      {loading && <p style={{ color: "#888" }}>Loading...</p>}

      {paper && (
        <>
          <h3 style={{ fontSize: "16px", lineHeight: 1.3, marginTop: 0 }}>
            {paper.title}
          </h3>

          <div style={{ fontSize: "12px", color: "#888", marginBottom: "12px" }}>
            {paper.year} {paper.venue && `| ${paper.venue}`} |{" "}
            {paper.citation_count} citations
          </div>

          <div style={{ fontSize: "13px", color: "#aaa", marginBottom: "12px" }}>
            {paper.authors.map((a) => a.name).join(", ")}
          </div>

          {paper.fields_of_study.length > 0 && (
            <div style={{ marginBottom: "12px" }}>
              {paper.fields_of_study.map((f) => (
                <span
                  key={f}
                  style={{
                    display: "inline-block",
                    background: "#2a2a4a",
                    padding: "2px 8px",
                    borderRadius: "10px",
                    fontSize: "11px",
                    marginRight: "4px",
                    marginBottom: "4px",
                  }}
                >
                  {f}
                </span>
              ))}
            </div>
          )}

          <p style={{ fontSize: "13px", lineHeight: 1.6 }}>{paper.abstract}</p>

          {paper.arxiv_id && (
            <a
              href={`https://arxiv.org/abs/${paper.arxiv_id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#6ea8fe", fontSize: "13px" }}
            >
              View on arXiv
            </a>
          )}
        </>
      )}
    </div>
  );
}
