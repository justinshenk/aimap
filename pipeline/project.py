"""Project embeddings to 2D via UMAP and cluster with HDBSCAN."""

from pathlib import Path

import duckdb
import hdbscan
import numpy as np
import pyarrow.parquet as pq
import umap
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestCentroid

DATA_DIR = Path(__file__).parent.parent / "data"
DB_PATH = DATA_DIR / "aimap.duckdb"


def load_data():
    """Load papers metadata and embeddings."""
    papers = pq.read_table(DATA_DIR / "papers.parquet").to_pydict()
    embeddings = np.load(DATA_DIR / "embeddings.npy")
    print(f"Loaded {len(papers['paper_id'])} papers with {embeddings.shape[1]}-dim embeddings")
    return papers, embeddings


def run_umap(embeddings: np.ndarray, n_neighbors: int = 15, min_dist: float = 0.1) -> np.ndarray:
    """Reduce embeddings to 2D with UMAP."""
    print("Running UMAP...")
    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=n_neighbors,
        min_dist=min_dist,
        metric="cosine",
        random_state=42,
        verbose=True,
    )
    coords = reducer.fit_transform(embeddings)
    print(f"UMAP complete: {coords.shape}")
    return coords


def run_clustering(coords: np.ndarray, min_cluster_size: int = 50) -> np.ndarray:
    """Cluster papers using HDBSCAN on 2D coords, then assign noise to nearest cluster."""
    print("Running HDBSCAN on 2D coords...")
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=5,
        metric="euclidean",
        cluster_selection_method="eom",
    )
    labels = clusterer.fit_predict(coords)
    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
    noise = (labels == -1).sum()
    print(f"Found {n_clusters} clusters, {noise} noise points")

    # Assign noise points to nearest cluster centroid
    if noise > 0 and n_clusters > 0:
        print("Assigning noise points to nearest cluster...")
        clustered_mask = labels != -1
        clf = NearestCentroid()
        clf.fit(coords[clustered_mask], labels[clustered_mask])
        noise_mask = labels == -1
        labels[noise_mask] = clf.predict(coords[noise_mask])
        print(f"All {noise} noise points assigned. {n_clusters} clusters total.")

    return labels


def generate_cluster_labels(papers: dict, cluster_ids: np.ndarray) -> dict[int, str]:
    """Generate human-readable labels using TF-IDF on titles.

    Uses TF-IDF to find terms distinctive to each cluster vs the full corpus.
    """
    unique_clusters = sorted(set(cluster_ids))
    if -1 in unique_clusters:
        unique_clusters.remove(-1)

    # Build per-cluster documents (concatenated titles)
    all_titles = [papers["title"][i] for i in range(len(cluster_ids))]

    # Fit TF-IDF on all titles
    vectorizer = TfidfVectorizer(
        max_features=5000, stop_words="english", ngram_range=(1, 2),
        min_df=2, max_df=0.3,
    )
    try:
        tfidf_matrix = vectorizer.fit_transform(all_titles)
    except Exception:
        return {cid: f"Cluster {cid}" for cid in unique_clusters}

    feature_names = vectorizer.get_feature_names_out()
    labels = {}

    for cid in unique_clusters:
        mask = cluster_ids == cid
        if mask.sum() < 3:
            labels[cid] = f"Cluster {cid}"
            continue

        # Mean TF-IDF for this cluster
        cluster_tfidf = tfidf_matrix[mask].mean(axis=0).A1
        # Mean TF-IDF for rest of corpus
        rest_tfidf = tfidf_matrix[~mask].mean(axis=0).A1

        # Distinctiveness = cluster mean / (rest mean + epsilon)
        distinctiveness = cluster_tfidf / (rest_tfidf + 1e-6)
        # Also require minimum absolute presence
        distinctiveness[cluster_tfidf < 0.01] = 0

        top_indices = distinctiveness.argsort()[-2:][::-1]
        top_terms = [feature_names[i].title() for i in top_indices]

        # Clean up: remove duplicates and substrings
        clean_terms = []
        for t in top_terms:
            if not any(t.lower() in existing.lower() or existing.lower() in t.lower()
                       for existing in clean_terms):
                clean_terms.append(t)

        labels[cid] = " & ".join(clean_terms[:2]) if clean_terms else f"Cluster {cid}"

    return labels


def compute_cluster_centroids(coords: np.ndarray, cluster_ids: np.ndarray) -> dict:
    """Compute 2D centroid for each cluster."""
    centroids = {}
    for cid in set(cluster_ids):
        if cid == -1:
            continue
        mask = cluster_ids == cid
        centroids[int(cid)] = {
            "x": float(coords[mask, 0].mean()),
            "y": float(coords[mask, 1].mean()),
            "count": int(mask.sum()),
        }
    return centroids


def save_to_duckdb(papers: dict, coords: np.ndarray, cluster_ids: np.ndarray,
                   cluster_labels: dict, cluster_centroids: dict):
    """Write everything to DuckDB."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(DB_PATH))

    con.execute("DROP TABLE IF EXISTS papers")
    con.execute("""
        CREATE TABLE papers (
            paper_id VARCHAR PRIMARY KEY,
            title VARCHAR,
            abstract VARCHAR,
            year INTEGER,
            venue VARCHAR,
            authors VARCHAR,
            citation_count INTEGER,
            fields_of_study VARCHAR,
            publication_date VARCHAR,
            arxiv_id VARCHAR,
            x DOUBLE,
            y DOUBLE,
            cluster_id INTEGER
        )
    """)

    n = len(papers["paper_id"])
    for i in range(n):
        con.execute(
            "INSERT INTO papers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                papers["paper_id"][i],
                papers["title"][i],
                papers["abstract"][i],
                papers["year"][i],
                papers["venue"][i],
                papers["authors"][i],
                papers["citation_count"][i],
                papers["fields_of_study"][i],
                papers["publication_date"][i],
                papers["arxiv_id"][i],
                float(coords[i, 0]),
                float(coords[i, 1]),
                int(cluster_ids[i]),
            ],
        )

    con.execute("DROP TABLE IF EXISTS clusters")
    con.execute("""
        CREATE TABLE clusters (
            cluster_id INTEGER PRIMARY KEY,
            label VARCHAR,
            centroid_x DOUBLE,
            centroid_y DOUBLE,
            paper_count INTEGER
        )
    """)

    for cid, label in cluster_labels.items():
        if cid == -1:
            continue
        centroid = cluster_centroids.get(cid, {"x": 0, "y": 0, "count": 0})
        con.execute(
            "INSERT INTO clusters VALUES (?, ?, ?, ?, ?)",
            [int(cid), label, centroid["x"], centroid["y"], centroid["count"]],
        )

    con.close()
    print(f"Saved to {DB_PATH}")


def export_static_json(con_path: str, output_dir: Path):
    """Export DuckDB to static JSON files for Vercel deployment."""
    import json

    con = duckdb.connect(con_path, read_only=True)

    # Points
    rows = con.execute(
        "SELECT paper_id, title, year, x, y, cluster_id, citation_count FROM papers"
    ).fetchall()
    points = [
        {"id": r[0], "title": r[1], "year": r[2], "x": round(r[3], 4),
         "y": round(r[4], 4), "cluster_id": r[5], "citation_count": r[6]}
        for r in rows
    ]

    # Clusters
    clusters = con.execute(
        "SELECT cluster_id, label, centroid_x, centroid_y, paper_count FROM clusters ORDER BY paper_count DESC"
    ).fetchall()
    cluster_list = [
        {"cluster_id": r[0], "label": r[1], "centroid_x": round(r[2], 4),
         "centroid_y": round(r[3], 4), "paper_count": r[4]}
        for r in clusters
    ]

    with open(output_dir / "points.json", "w") as f:
        json.dump({"points": points, "clusters": cluster_list}, f, separators=(",", ":"))

    # Paper details
    details = con.execute(
        "SELECT paper_id, title, abstract, year, venue, authors, citation_count, "
        "fields_of_study, publication_date, arxiv_id FROM papers"
    ).fetchall()
    detail_map = {}
    for r in details:
        detail_map[r[0]] = {
            "paper_id": r[0], "title": r[1], "abstract": r[2][:500], "year": r[3],
            "venue": r[4], "authors": json.loads(r[5])[:5], "citation_count": r[6],
            "fields_of_study": json.loads(r[7])[:5], "publication_date": r[8],
            "arxiv_id": r[9],
        }

    with open(output_dir / "papers.json", "w") as f:
        json.dump(detail_map, f, separators=(",", ":"))

    import os
    for fn in ["points.json", "papers.json"]:
        size = os.path.getsize(output_dir / fn) / 1e6
        print(f"{fn}: {size:.1f} MB")

    con.close()


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Project embeddings and cluster papers")
    parser.add_argument("--n-neighbors", type=int, default=15, help="UMAP n_neighbors")
    parser.add_argument("--min-dist", type=float, default=0.1, help="UMAP min_dist")
    parser.add_argument("--min-cluster-size", type=int, default=30, help="HDBSCAN min_cluster_size")
    parser.add_argument("--export-json", action="store_true", help="Also export static JSON")
    args = parser.parse_args()

    papers, embeddings = load_data()
    coords = run_umap(embeddings, n_neighbors=args.n_neighbors, min_dist=args.min_dist)
    cluster_ids = run_clustering(coords, min_cluster_size=args.min_cluster_size)
    cluster_labels = generate_cluster_labels(papers, cluster_ids)
    cluster_centroids = compute_cluster_centroids(coords, cluster_ids)

    print("\nCluster labels:")
    for cid, label in sorted(cluster_labels.items()):
        count = cluster_centroids.get(cid, {}).get("count", 0)
        print(f"  [{cid}] {label} ({count} papers)")

    save_to_duckdb(papers, coords, cluster_ids, cluster_labels, cluster_centroids)

    if args.export_json:
        print("\nExporting static JSON...")
        export_static_json(str(DB_PATH), DATA_DIR.parent / "frontend" / "public")


if __name__ == "__main__":
    main()
