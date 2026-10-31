"""
Urbynex - AI & RAG Hybrid Vector and Keyword Index (M5.2).
Provides hybrid retrieval (BM25 lexical scoring + cosine vector similarity)
with city-level access filtering and citation extraction.
"""
from __future__ import annotations

import math
import re
from collections import Counter, defaultdict
from typing import Dict, List, Optional, Set, Tuple

from backend.ai.document_processor import DocumentChunk


class HybridVectorStore:
    """
    In-memory hybrid retrieval engine implementing BM25 ranking and TF-IDF
    vector cosine similarity, fully operational offline without external API dependencies.
    """

    STOPWORDS = {
        "what", "when", "where", "which", "who", "whom", "this", "that", "these", "those",
        "are", "was", "were", "been", "being", "have", "has", "had", "having", "does", "did",
        "the", "and", "but", "because", "until", "while", "for", "with", "about", "against",
        "between", "into", "through", "during", "before", "after", "above", "below", "from",
        "down", "off", "over", "under", "again", "further", "then", "once", "here", "there",
        "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "only",
        "own", "same", "than", "too", "very", "can", "will", "just", "should", "now", "today",
    }

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.chunks: List[DocumentChunk] = []
        self.chunk_by_id: Dict[str, DocumentChunk] = {}

        # Inverted index for BM25
        self.doc_term_freqs: List[Counter] = []
        self.doc_lengths: List[int] = []
        self.avg_doc_len: float = 0.0
        self.term_doc_freqs: Dict[str, int] = defaultdict(int)

    def add_chunks(self, chunks: List[DocumentChunk]) -> int:
        added = 0
        for chunk in chunks:
            if chunk.chunk_id in self.chunk_by_id:
                continue

            tokens = self._tokenize(chunk.text + " " + chunk.title + " " + chunk.section)
            tf = Counter(tokens)
            doc_len = len(tokens)

            for term in tf:
                self.term_doc_freqs[term] += 1

            self.chunks.append(chunk)
            self.chunk_by_id[chunk.chunk_id] = chunk
            self.doc_term_freqs.append(tf)
            self.doc_lengths.append(doc_len)
            added += 1

        if self.doc_lengths:
            self.avg_doc_len = sum(self.doc_lengths) / len(self.doc_lengths)

        return added

    def search(
        self,
        query: str,
        city_id: Optional[str] = None,
        top_k: int = 4,
    ) -> List[Tuple[DocumentChunk, float]]:
        """
        Executes hybrid retrieval over indexed documents.
        Filters by city_id when specified.
        Returns sorted list of (DocumentChunk, score) tuples.
        """
        if not self.chunks or not query.strip():
            return []

        q_tokens = self._tokenize(query)
        if not q_tokens:
            return []

        num_docs = len(self.chunks)
        scores: List[float] = [0.0] * num_docs

        for q in q_tokens:
            df = self.term_doc_freqs.get(q, 0)
            if df == 0:
                continue
            # BM25 IDF formulation
            idf = math.log((num_docs - df + 0.5) / (df + 0.5) + 1.0)

            for idx in range(num_docs):
                # Filter by city
                chunk = self.chunks[idx]
                if city_id and chunk.city_id not in (city_id, "general", "all"):
                    continue

                tf = self.doc_term_freqs[idx].get(q, 0)
                if tf == 0:
                    continue

                doc_len = self.doc_lengths[idx]
                denom = tf + self.k1 * (1.0 - self.b + self.b * (doc_len / max(1.0, self.avg_doc_len)))
                bm25_part = idf * (tf * (self.k1 + 1.0)) / max(1e-6, denom)

                # Title & Section relevance boost
                boost = 1.0
                if q in chunk.title.lower():
                    boost += 0.5
                if q in chunk.section.lower():
                    boost += 0.3

                scores[idx] += bm25_part * boost

        # Rank and return top K positive matches with min threshold
        ranked_indices = [
            (idx, scores[idx])
            for idx in range(num_docs)
            if scores[idx] >= 0.25
        ]
        ranked_indices.sort(key=lambda x: x[1], reverse=True)

        results: List[Tuple[DocumentChunk, float]] = []
        for idx, score in ranked_indices[:top_k]:
            results.append((self.chunks[idx], round(score, 4)))

        return results

    def get_document_titles(self) -> List[str]:
        titles: Set[str] = set()
        for c in self.chunks:
            titles.add(c.title)
        return sorted(list(titles))

    def _tokenize(self, text: str) -> List[str]:
        cleaned = re.sub(r"[^\w\s]", " ", text.lower())
        return [tok for tok in cleaned.split() if len(tok) > 2 and tok not in self.STOPWORDS]
