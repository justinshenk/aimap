"""FastAPI backend for aimap."""

import json

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import db

app = FastAPI(title="aimap", description="ML Research Literature Map API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/points")
def get_points(
    year_min: int | None = Query(None),
    year_max: int | None = Query(None),
):
    """Get all paper points for rendering (minimal data)."""
    rows = db.get_points(year_min=year_min, year_max=year_max)
    return [
        {
            "id": r[0],
            "title": r[1],
            "year": r[2],
            "x": r[3],
            "y": r[4],
            "cluster_id": r[5],
            "citation_count": r[6],
        }
        for r in rows
    ]


@app.get("/api/paper/{paper_id}")
def get_paper(paper_id: str):
    """Get full paper details."""
    paper = db.get_paper(paper_id)
    if paper is None:
        raise HTTPException(status_code=404, detail="Paper not found")
    # Parse JSON fields
    paper["authors"] = json.loads(paper.get("authors", "[]"))
    paper["fields_of_study"] = json.loads(paper.get("fields_of_study", "[]"))
    return paper


@app.get("/api/clusters")
def get_clusters():
    """Get cluster labels and centroids."""
    return db.get_clusters()


@app.get("/api/search")
def search(q: str = Query(..., min_length=2), limit: int = Query(50, le=200)):
    """Search papers by title/abstract."""
    rows = db.search_papers(q, limit=limit)
    return [
        {
            "id": r[0],
            "title": r[1],
            "year": r[2],
            "x": r[3],
            "y": r[4],
            "cluster_id": r[5],
            "citation_count": r[6],
        }
        for r in rows
    ]


@app.get("/api/stats")
def get_stats():
    """Get dataset statistics."""
    return db.get_stats()
