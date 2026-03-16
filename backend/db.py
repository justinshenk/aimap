"""DuckDB query layer for aimap."""

from pathlib import Path

import duckdb

DB_PATH = Path(__file__).parent.parent / "data" / "aimap.duckdb"

_con: duckdb.DuckDBPyConnection | None = None


def get_connection() -> duckdb.DuckDBPyConnection:
    global _con
    if _con is None:
        _con = duckdb.connect(str(DB_PATH), read_only=True)
    return _con


def get_points(year_min: int | None = None, year_max: int | None = None):
    """Fetch all points with minimal metadata for rendering."""
    con = get_connection()
    query = "SELECT paper_id, title, year, x, y, cluster_id, citation_count FROM papers"
    conditions = []
    params = []
    if year_min is not None:
        conditions.append("year >= ?")
        params.append(year_min)
    if year_max is not None:
        conditions.append("year <= ?")
        params.append(year_max)
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    return con.execute(query, params).fetchall()


def get_paper(paper_id: str):
    """Fetch full paper details."""
    con = get_connection()
    result = con.execute(
        "SELECT * FROM papers WHERE paper_id = ?", [paper_id]
    ).fetchone()
    if result is None:
        return None
    columns = [desc[0] for desc in con.description]
    return dict(zip(columns, result))


def get_clusters():
    """Fetch all cluster info."""
    con = get_connection()
    results = con.execute(
        "SELECT cluster_id, label, centroid_x, centroid_y, paper_count FROM clusters ORDER BY paper_count DESC"
    ).fetchall()
    return [
        {
            "cluster_id": r[0],
            "label": r[1],
            "centroid_x": r[2],
            "centroid_y": r[3],
            "paper_count": r[4],
        }
        for r in results
    ]


def search_papers(query: str, limit: int = 50):
    """Simple text search on title and abstract."""
    con = get_connection()
    pattern = f"%{query}%"
    results = con.execute(
        """SELECT paper_id, title, year, x, y, cluster_id, citation_count
           FROM papers
           WHERE title ILIKE ? OR abstract ILIKE ?
           ORDER BY citation_count DESC
           LIMIT ?""",
        [pattern, pattern, limit],
    ).fetchall()
    return results


def get_stats():
    """Get dataset statistics."""
    con = get_connection()
    total = con.execute("SELECT COUNT(*) FROM papers").fetchone()[0]
    by_year = con.execute(
        "SELECT year, COUNT(*) as cnt FROM papers GROUP BY year ORDER BY year"
    ).fetchall()
    return {"total_papers": total, "by_year": {r[0]: r[1] for r in by_year}}
