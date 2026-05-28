from __future__ import annotations

import csv
import json
import os
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

try:
    import pandas as pd
except Exception:  # pragma: no cover
    pd = None

try:
    from openai import OpenAI
except Exception:  # pragma: no cover
    OpenAI = None


@dataclass
class NormalizedProductCandidate:
    originalName: str
    normalizedName: str
    canonicalName: str
    category: str | None = None
    unit: str | None = None
    packageSize: str | None = None
    supplier: str | None = None
    confidence: float = 0.0
    sourceDocumentId: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if text.lower() in {"undefined", "null", "nan"}:
        return ""
    return text


def heuristic_normalize_name(value: str) -> tuple[str, str]:
    compact = re.sub(r"\s+", " ", value).strip()
    normalized = re.sub(r"[^a-z0-9]+", " ", compact.lower()).strip()
    canonical = " ".join(word.capitalize() for word in normalized.split())
    return normalized, canonical or compact


def parse_rows_from_text(payload: str, source_document_id: str | None) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line in payload.splitlines():
        cleaned = clean_text(line)
        if not cleaned:
            continue
        rows.append(
            {
                "original_name": cleaned,
                "supplier": None,
                "source_document_id": source_document_id,
            }
        )
    return rows


def parse_rows_from_file(file_path: Path) -> list[dict[str, Any]]:
    suffix = file_path.suffix.lower()
    source_document_id = file_path.name

    if suffix in {".txt", ".log"}:
        return parse_rows_from_text(file_path.read_text(encoding="utf-8"), source_document_id)

    if suffix == ".csv":
        with file_path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            rows = []
            for row in reader:
                original_name = clean_text(
                    row.get("original_name")
                    or row.get("description")
                    or row.get("product_name")
                    or row.get("name")
                )
                if not original_name:
                    continue
                rows.append(
                    {
                        "original_name": original_name,
                        "supplier": clean_text(row.get("supplier") or row.get("supplier_name")) or None,
                        "unit": clean_text(row.get("unit")) or None,
                        "package_size": clean_text(row.get("package_size") or row.get("unit_size")) or None,
                        "source_document_id": source_document_id,
                    }
                )
            return rows

    if suffix in {".xlsx", ".xls"} and pd is not None:
        frame = pd.read_excel(file_path)
        rows = []
        for row in frame.to_dict(orient="records"):
            original_name = clean_text(
                row.get("original_name")
                or row.get("description")
                or row.get("product_name")
                or row.get("name")
            )
            if not original_name:
                continue
            rows.append(
                {
                    "original_name": original_name,
                    "supplier": clean_text(row.get("supplier") or row.get("supplier_name")) or None,
                    "unit": clean_text(row.get("unit")) or None,
                    "package_size": clean_text(row.get("package_size") or row.get("unit_size")) or None,
                    "source_document_id": source_document_id,
                }
            )
        return rows

    # PDF-extracted text or unknown input can be passed in as text content.
    return parse_rows_from_text(file_path.read_text(encoding="utf-8"), source_document_id)


def llm_normalize_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]] | None:
    if OpenAI is None or not os.getenv("OPENAI_API_KEY") or not rows:
        return None

    client = OpenAI()
    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    prompt = {
        "instructions": [
            "Normalize supplier product names into safe structured candidates.",
            "Never overwrite or omit original names.",
            "Return JSON only.",
            "Keep unknown values as null.",
            "Do not invent enum values or statuses.",
        ],
        "rows": rows[:200],
    }

    response = client.responses.create(
        model=model,
        input=[
            {
                "role": "system",
                "content": "You extract restaurant purchasing product candidates safely.",
            },
            {
                "role": "user",
                "content": json.dumps(prompt),
            },
        ],
    )

    text = getattr(response, "output_text", "") or ""
    if not text:
        return None
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, list):
        return None
    return payload


def normalize_rows(rows: list[dict[str, Any]]) -> list[NormalizedProductCandidate]:
    llm_payload = llm_normalize_rows(rows)
    candidates: list[NormalizedProductCandidate] = []

    for index, row in enumerate(rows):
        original_name = clean_text(row.get("original_name"))
        if not original_name:
            continue

        normalized_name, canonical_name = heuristic_normalize_name(original_name)
        confidence = 0.58
        category = clean_text(row.get("category")) or None
        unit = clean_text(row.get("unit")) or None
        package_size = clean_text(row.get("package_size")) or None
        supplier = clean_text(row.get("supplier")) or None

        if llm_payload and index < len(llm_payload) and isinstance(llm_payload[index], dict):
            llm_row = llm_payload[index]
            normalized_name = clean_text(llm_row.get("normalizedName")) or normalized_name
            canonical_name = clean_text(llm_row.get("canonicalName")) or canonical_name
            category = clean_text(llm_row.get("category")) or category
            unit = clean_text(llm_row.get("unit")) or unit
            package_size = clean_text(llm_row.get("packageSize")) or package_size
            supplier = clean_text(llm_row.get("supplier")) or supplier
            try:
                confidence = float(llm_row.get("confidence") or confidence)
            except (TypeError, ValueError):
                confidence = confidence

        candidates.append(
            NormalizedProductCandidate(
                originalName=original_name,
                normalizedName=normalized_name or original_name.lower(),
                canonicalName=canonical_name or original_name,
                category=category,
                unit=unit,
                packageSize=package_size,
                supplier=supplier,
                confidence=max(0.0, min(confidence, 1.0)),
                sourceDocumentId=clean_text(row.get("source_document_id")) or None,
                metadata={
                    "parseMode": "llm" if llm_payload else "heuristic",
                    # TODO: attach source row ids and human review state when backend document storage lands.
                },
            )
        )
    return candidates


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python3 app/scripts/normalize_product_candidates.py <file-or-text-path>", file=sys.stderr)
        return 1

    file_path = Path(sys.argv[1])
    if not file_path.exists():
        print(f"File not found: {file_path}", file=sys.stderr)
        return 1

    rows = parse_rows_from_file(file_path)
    candidates = normalize_rows(rows)
    print(json.dumps([asdict(candidate) for candidate in candidates], indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
