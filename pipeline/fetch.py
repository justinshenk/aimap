"""Fetch ML papers from OpenAlex API, then compute embeddings locally.

OpenAlex is free, no API key required, generous rate limits.
We filter by ML-related concepts and compute embeddings with sentence-transformers.
"""

import json
import sys
import time
from pathlib import Path

import httpx
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq

DATA_DIR = Path(__file__).parent.parent / "data"

# OpenAlex concept IDs for ML-related topics
# See: https://docs.openalex.org/api-entities/concepts
CONCEPT_FILTERS = [
    "C154945302",  # Machine learning
    "C108827166",  # Deep learning
    "C50644808",   # Artificial neural network
    "C204321447",  # Natural language processing
    "C31972630",   # Computer vision
    "C119857082",  # Reinforcement learning
]

OPENALEX_WORKS = "https://api.openalex.org/works"


def fetch_papers_openalex(target_count: int = 10000, year_min: int = 2020, year_max: int = 2024):
    """Fetch papers from OpenAlex with pagination."""
    all_papers = {}
    # Use polite pool by providing email
    params = {
        "filter": f"concepts.id:{'|'.join(CONCEPT_FILTERS)},publication_year:{year_min}-{year_max},has_abstract:true,language:en",
        "sort": "cited_by_count:desc",
        "per_page": 200,
        "select": "id,title,publication_year,primary_location,authorships,cited_by_count,concepts,publication_date,ids,abstract_inverted_index",
        "mailto": "aimap@example.com",
    }

    cursor = "*"
    page = 0

    while len(all_papers) < target_count and cursor:
        page += 1
        params["cursor"] = cursor

        try:
            with httpx.Client(timeout=30) as client:
                r = client.get(OPENALEX_WORKS, params=params)
                r.raise_for_status()
                data = r.json()
        except Exception as e:
            print(f"\n  Error on page {page}: {e}", flush=True)
            time.sleep(5)
            continue

        results = data.get("results", [])
        if not results:
            break

        meta = data.get("meta", {})
        cursor = meta.get("next_cursor")

        batch_new = 0
        for work in results:
            oid = work.get("id", "").replace("https://openalex.org/", "")
            if not oid or oid in all_papers:
                continue

            # Reconstruct abstract from inverted index
            abstract = reconstruct_abstract(work.get("abstract_inverted_index"))
            if not abstract or len(abstract) < 50:
                continue

            title = work.get("title")
            if not title:
                continue

            # Get venue
            venue = ""
            loc = work.get("primary_location") or {}
            source = loc.get("source") or {}
            venue = source.get("display_name", "")

            # Get authors
            authors = []
            for authorship in (work.get("authorships") or []):
                author = authorship.get("author") or {}
                authors.append({
                    "name": author.get("display_name", ""),
                    "id": (author.get("id") or "").replace("https://openalex.org/", ""),
                })

            # Get arxiv ID
            ids = work.get("ids") or {}
            arxiv_id = ""
            openalex_url = ids.get("openalex", "")
            doi = ids.get("doi", "")

            # Get concepts as fields of study
            concepts = [c.get("display_name", "") for c in (work.get("concepts") or [])
                       if c.get("score", 0) > 0.3]

            all_papers[oid] = {
                "paper_id": oid,
                "title": title,
                "abstract": abstract[:2000],
                "year": work.get("publication_year"),
                "venue": venue,
                "authors": json.dumps(authors),
                "citation_count": work.get("cited_by_count") or 0,
                "fields_of_study": json.dumps(concepts[:10]),
                "publication_date": work.get("publication_date") or "",
                "arxiv_id": arxiv_id,
            }
            batch_new += 1

            if len(all_papers) >= target_count:
                break

        sys.stdout.write(
            f"\r  Page {page} | +{batch_new} | Total: {len(all_papers)}/{target_count}"
        )
        sys.stdout.flush()

        # Polite rate limiting (OpenAlex asks for ~10 req/s max)
        time.sleep(0.2)

    print(f"\n\nFetched {len(all_papers)} papers in {page} pages.", flush=True)
    return all_papers


def reconstruct_abstract(inverted_index: dict) -> str:
    """Reconstruct abstract text from OpenAlex inverted index format."""
    if not inverted_index:
        return ""
    # Build list of (position, word) pairs
    word_positions = []
    for word, positions in inverted_index.items():
        for pos in positions:
            word_positions.append((pos, word))
    word_positions.sort()
    return " ".join(word for _, word in word_positions)


def compute_embeddings(papers: dict, batch_size: int = 64) -> np.ndarray:
    """Compute embeddings locally using sentence-transformers on CPU."""
    import torch
    from sentence_transformers import SentenceTransformer

    print("\nLoading sentence-transformers model (all-MiniLM-L6-v2) on CPU...", flush=True)
    model = SentenceTransformer("all-MiniLM-L6-v2", device="cpu")

    paper_list = list(papers.values())
    texts = [f"{p['title']}. {p['abstract']}" for p in paper_list]

    print(f"Computing embeddings for {len(texts)} papers...", flush=True)
    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        show_progress_bar=True,
        normalize_embeddings=True,
        device="cpu",
    )

    print(f"Embeddings shape: {embeddings.shape}", flush=True)
    return embeddings.astype(np.float32)


def save_data(papers: dict, embeddings: np.ndarray, output_path: Path):
    """Save papers to Parquet, embeddings to .npy."""
    paper_list = list(papers.values())

    np.save(output_path.parent / "embeddings.npy", embeddings)

    table = pa.Table.from_pylist(paper_list)
    pq.write_table(table, output_path)

    print(f"\nSaved {len(paper_list)} papers to {output_path}")
    print(f"Saved embeddings {embeddings.shape} to {output_path.parent / 'embeddings.npy'}")
    size_mb = (output_path.stat().st_size + (output_path.parent / "embeddings.npy").stat().st_size) / 1e6
    print(f"Total disk usage: {size_mb:.1f} MB")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Fetch ML papers from OpenAlex")
    parser.add_argument("--target", type=int, default=10000, help="Target number of papers")
    parser.add_argument("--year-min", type=int, default=2020, help="Start year")
    parser.add_argument("--year-max", type=int, default=2024, help="End year")
    args = parser.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    papers = fetch_papers_openalex(
        target_count=args.target,
        year_min=args.year_min,
        year_max=args.year_max,
    )
    if not papers:
        print("No papers fetched!")
        return

    embeddings = compute_embeddings(papers)
    save_data(papers, embeddings, DATA_DIR / "papers.parquet")


if __name__ == "__main__":
    main()
