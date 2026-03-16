export interface PaperPoint {
  id: string;
  title: string;
  year: number;
  x: number;
  y: number;
  cluster_id: number;
  citation_count: number;
}

export interface PaperDetail {
  paper_id: string;
  title: string;
  abstract: string;
  year: number;
  venue: string;
  authors: { name: string; id: string }[];
  citation_count: number;
  fields_of_study: string[];
  publication_date: string;
  arxiv_id: string;
  x: number;
  y: number;
  cluster_id: number;
}

export interface Cluster {
  cluster_id: number;
  label: string;
  centroid_x: number;
  centroid_y: number;
  paper_count: number;
}
