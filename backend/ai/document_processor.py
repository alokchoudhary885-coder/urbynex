"""
Urbynex - AI & RAG Document Processor (M5.1).
Parses, sections, and chunks official city planning documents (Markdown, TXT, PDF).
Attaches precise provenance metadata for grounded citation generation.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Union


@dataclass
class DocumentChunk:
    """A granular chunk of an ingested planning document with full citation metadata."""
    chunk_id: str
    document_id: str
    title: str
    city_id: str
    section: str
    text: str
    chunk_index: int
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_citation(self) -> str:
        """Standard Urbynex citation string as specified in docs/AI_AND_RAG.md."""
        sec = f", Section: {self.section}" if self.section else ""
        return f"[Source: {self.title}{sec}]"


class DocumentProcessor:
    """Ingests and chunks planning documents for vector indexing."""

    def __init__(self, target_chunk_words: int = 250, overlap_words: int = 40):
        self.target_chunk_words = target_chunk_words
        self.overlap_words = overlap_words

    def process_file(
        self,
        file_path: Union[str, Path],
        city_id: Optional[str] = None,
        document_id: Optional[str] = None,
    ) -> List[DocumentChunk]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Document file not found: {path}")

        # Extract text based on file suffix
        suffix = path.suffix.lower()
        if suffix in (".md", ".txt"):
            content = path.read_text(encoding="utf-8")
        elif suffix == ".pdf":
            content = self._extract_pdf_text(path)
        else:
            raise ValueError(f"Unsupported document format: {suffix}")

        doc_id = document_id or path.stem
        # Deduce city_id if not provided
        if not city_id:
            fname = path.name.lower()
            if "jaipur" in fname:
                city_id = "jaipur"
            elif "delhi" in fname:
                city_id = "delhi"
            else:
                city_id = "general"

        return self.process_text(content, doc_id=doc_id, city_id=city_id)

    def process_text(
        self,
        text: str,
        doc_id: str,
        city_id: str,
        default_title: Optional[str] = None,
    ) -> List[DocumentChunk]:
        """Parses text, extracts document title and sections, and yields chunks."""
        lines = text.splitlines()

        # Extract title from first H1 or first non-empty line
        title = default_title or doc_id
        for line in lines:
            if line.startswith("# "):
                title = line[2:].strip()
                break

        # Split into sections based on markdown headers
        sections = self._split_into_sections(lines)
        chunks: List[DocumentChunk] = []
        global_chunk_idx = 0

        for section_title, section_text in sections:
            words = section_text.split()
            if not words:
                continue

            # Sliding window chunking
            start = 0
            while start < len(words):
                end = min(start + self.target_chunk_words, len(words))
                chunk_words = words[start:end]
                chunk_text = " ".join(chunk_words)

                chunk = DocumentChunk(
                    chunk_id=f"{doc_id}_c{global_chunk_idx}",
                    document_id=doc_id,
                    title=title,
                    city_id=city_id,
                    section=section_title,
                    text=chunk_text,
                    chunk_index=global_chunk_idx,
                    metadata={
                        "word_count": len(chunk_words),
                        "char_count": len(chunk_text),
                    },
                )
                chunks.append(chunk)
                global_chunk_idx += 1

                if end >= len(words):
                    break
                start += self.target_chunk_words - self.overlap_words

        return chunks

    def _split_into_sections(self, lines: List[str]) -> List[tuple[str, str]]:
        """Groups text lines under section headers."""
        sections: List[tuple[str, str]] = []
        current_section = "General"
        current_lines: List[str] = []

        header_pattern = re.compile(r"^(#{1,3})\s+(.+)$")

        for line in lines:
            m = header_pattern.match(line)
            if m:
                if current_lines:
                    sections.append((current_section, "\n".join(current_lines)))
                    current_lines = []
                current_section = m.group(2).strip()
            else:
                current_lines.append(line)

        if current_lines:
            sections.append((current_section, "\n".join(current_lines)))

        return sections

    def _extract_pdf_text(self, path: Path) -> str:
        """PDF extractor with fallback."""
        try:
            import pdfplumber
            with pdfplumber.open(path) as pdf:
                pages = [p.extract_text() or "" for p in pdf.pages]
                return "\n\n".join(pages)
        except ImportError:
            try:
                import pypdf
                reader = pypdf.PdfReader(str(path))
                pages = [page.extract_text() or "" for page in reader.pages]
                return "\n\n".join(pages)
            except ImportError:
                raise RuntimeError("PDF extraction requires pdfplumber or pypdf.")
