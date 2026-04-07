#!/usr/bin/env python3
"""
Unified Memory Entries API
-------------------------
Provides structured JSON access to Hermes memory entries from MEMORY.md and USER.md.
This is the single source of truth for both the Hermes agent (writes) and Dashboard (reads).

Schema:
  {
    "entries": [
      {
        "id": "sha256_hash_of_content",
        "content": "...",
        "target": "memory|user",
        "source": "hermes|dashboard|agent",
        "created_at": "ISO8601",
        "updated_at": "ISO8601",
        "conversation_id": "session_20260407_..." | null,
        "tags": [],
        "references": [],
      }
    ],
    "index": { ... cross-reference data ... },
    "timeline": [ sorted entries by date ],
    "search": [ ranked results ],
  }

The entry ID is a stable hash of the content (first 32 chars of SHA256).
Cross-reference index links entries that share tags or reference each other.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
from datetime import datetime, date
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Resolve memory dir the same way memory_tool.py does
def _get_mem_dir() -> Path:
    """Resolve HERMES_HOME at call time (not import time)."""
    home = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))
    return Path(home) / "memories"

ENTRY_DELIMITER = "\n§\n"
ENTRY_INDEX_FILE = "memories/entries_index.json"


def _entry_id(content: str) -> str:
    """Stable 8-char hash of entry content."""
    h = hashlib.sha256(content.encode("utf-8")).hexdigest()
    return h[:8]


def _load_entries_from_file(path: Path) -> List[str]:
    """Read a memory file and split into entries by § delimiter."""
    if not path.exists():
        return []
    try:
        raw = path.read_text(encoding="utf-8")
    except (OSError, IOError):
        return []
    if not raw.strip():
        return []
    entries = [e.strip() for e in raw.split(ENTRY_DELIMITER)]
    return [e for e in entries if e]


def _parse_cross_refs(content: str) -> List[str]:
    """Extract cross-references from entry content.
    
    Recognizes:
      - [[entry-id]] references
      - @mentions of other entry ids
      - Tag-like patterns #tagname
    Returns list of referenced entry IDs.
    """
    refs = []
    # [[id]] or [[content snippet]]
    refs.extend(re.findall(r'\[\[([a-z0-9]{8,32})\]\]', content, re.IGNORECASE))
    # @id references
    refs.extend(re.findall(r'@([a-z0-9]{8,32})', content))
    # Extract tag names for grouping
    refs.extend(re.findall(r'#([a-z][a-z0-9_-]{1,20})', content, re.IGNORECASE))
    # Remove duplicates while preserving order
    seen = set()
    unique = []
    for r in refs:
        r_lower = r.lower()
        if r_lower not in seen:
            seen.add(r_lower)
            unique.append(r_lower)
    return unique


def _extract_tags(content: str) -> List[str]:
    """Extract hashtags from content."""
    tags = re.findall(r'#([a-z][a-z0-9_-]{1,20})', content, re.IGNORECASE)
    seen = set()
    return [t for t in tags if not (t.lower() in seen or seen.add(t.lower()))]


def _is_injected_entry(content: str) -> bool:
    """Check if entry was auto-injected by a previous run (not user-authored)."""
    auto_patterns = [
        r"^#\s",           # Markdown headers (structure, not entries)
        r"^-\s",           # Bullet lists
        r"^\d+\.\s",       # Numbered lists
        r"^>\s",           # Block quotes
        r"^```",           # Code blocks
    ]
    stripped = content.strip()
    for pat in auto_patterns:
        if re.match(pat, stripped):
            return True
    return False


def load_all_entries(mem_dir: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Load all entries from MEMORY.md and USER.md."""
    if mem_dir is None:
        mem_dir = _get_mem_dir()
    mem_dir.mkdir(parents=True, exist_ok=True)

    entries = []
    seen_ids: set[str] = set()

    for target in ("memory", "user"):
        path = mem_dir / f"{target.upper()}.md"
        raw_entries = _load_entries_from_file(path)

        for i, content in enumerate(raw_entries):
            eid = _entry_id(content)
            # Deduplicate across both files
            if eid in seen_ids:
                continue
            seen_ids.add(eid)

            # Try to find existing index entry for timestamp
            idx_entry = None
            idx_path = mem_dir.parent / ENTRY_INDEX_FILE
            if idx_path.exists():
                try:
                    idx_data = json.loads(idx_path.read_text(encoding="utf-8"))
                    idx_entry = next(
                        (e for e in idx_data.get("entries", []) if e.get("id") == eid),
                        None,
                    )
                except Exception:
                    pass

            entries.append({
                "id": eid,
                "content": content,
                "target": target,
                "source": idx_entry.get("source") if idx_entry else "hermes",
                "created_at": idx_entry.get("created_at") if idx_entry else datetime.now().isoformat(),
                "updated_at": idx_entry.get("updated_at") if idx_entry else datetime.now().isoformat(),
                "conversation_id": idx_entry.get("conversation_id") if idx_entry else None,
                "tags": _extract_tags(content),
                "references": _parse_cross_refs(content),
                "is_injected": _is_injected_entry(content),
                "order": i,
            })

    return entries


def save_entries_index(entries: List[Dict[str, Any]], mem_dir: Optional[Path] = None) -> None:
    """Save the full entries index to JSON (for Dashboard consumption)."""
    if mem_dir is None:
        mem_dir = _get_mem_dir()

    idx_path = mem_dir.parent / ENTRY_INDEX_FILE
    idx_path.parent.mkdir(parents=True, exist_ok=True)

    # Build cross-reference index
    id_to_entry: Dict[str, Dict] = {e["id"]: e for e in entries}
    links: List[Dict] = []

    for entry in entries:
        for ref in entry.get("references", []):
            # Check if ref is an entry ID
            if ref in id_to_entry and ref != entry["id"]:
                links.append({
                    "source": entry["id"],
                    "target": ref,
                    "type": "reference",
                })
            # Check if ref is a tag — link to entries with same tag
            elif ref.startswith("#"):
                for other in entries:
                    if other["id"] != entry["id"] and ref in other.get("tags", []):
                        links.append({
                            "source": entry["id"],
                            "target": other["id"],
                            "type": "tag",
                            "tag": ref,
                        })

    # Remove duplicate links
    seen_links = set()
    unique_links = []
    for lk in links:
        key = (lk["source"], lk["target"])
        if key not in seen_links:
            seen_links.add(key)
            unique_links.append(lk)

    index = {
        "generated_at": datetime.now().isoformat(),
        "total_entries": len(entries),
        "memory_entries": len([e for e in entries if e["target"] == "memory"]),
        "user_entries": len([e for e in entries if e["target"] == "user"]),
        "entries": entries,
        "links": unique_links,
    }

    try:
        idx_path.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
        logger.debug("Saved entries index with %d entries", len(entries))
    except OSError as e:
        logger.warning("Failed to write entries index: %s", e)


def get_entries(
    target: Optional[str] = None,
    source: Optional[str] = None,
    tag: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    """Get entries with optional filtering."""
    entries = load_all_entries()

    # Filter
    if target:
        entries = [e for e in entries if e["target"] == target]
    if source:
        entries = [e for e in entries if e["source"] == source]
    if tag:
        entries = [e for e in entries if tag in e.get("tags", [])]
    if q:
        q_lower = q.lower()
        entries = [
            e for e in entries
            if q_lower in e["content"].lower()
        ]

    total = len(entries)
    entries = entries[offset:offset + limit]

    return {
        "entries": entries,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


def get_timeline(limit: int = 50, offset: int = 0) -> Dict[str, Any]:
    """Get entries sorted chronologically (most recent first)."""
    entries = load_all_entries()
    # Sort by updated_at descending
    sorted_entries = sorted(
        entries,
        key=lambda e: e.get("updated_at", ""),
        reverse=True,
    )
    total = len(sorted_entries)
    page = sorted_entries[offset:offset + limit]

    return {
        "entries": page,
        "total": total,
        "limit": limit,
        "offset": offset,
        "pages": max(1, (total + limit - 1) // limit),
    }


def search_entries(q: str, limit: int = 20) -> Dict[str, Any]:
    """Ranked full-text search across entries.
    
    Scoring:
      - Exact match (case-insensitive): score +10
      - Word boundary match: score +5
      - Contains match: score +2
      - Tag match: score +8
    Returns entries with relevance scores.
    """
    if not q or not q.strip():
        return {"results": [], "total": 0, "query": q}

    q_lower = q.lower().strip()
    q_words = q_lower.split()
    entries = load_all_entries()
    scored: List[tuple] = []

    for entry in entries:
        content = entry["content"]
        content_lower = content.lower()
        score = 0
        matched_in = []

        # Exact phrase match
        if q_lower in content_lower:
            score += 10
            matched_in.append("exact")

        # Word boundary matches
        for word in q_words:
            if re.search(r'\b' + re.escape(word) + r'\b', content_lower):
                score += 5
                matched_in.append("word")
            elif word in content_lower:
                score += 2
                matched_in.append("substring")

        # Tag match
        for tag in entry.get("tags", []):
            if q_lower in tag.lower():
                score += 8
                matched_in.append("tag")

        # Boost for target/user match in content
        if "target:" in content_lower and q_lower.split()[0] in content_lower:
            score += 1

        if score > 0:
            # Extract snippet
            idx = content_lower.find(q_lower)
            if idx >= 0:
                start = max(0, idx - 40)
                end = min(len(content), idx + len(q) + 60)
                snippet = content[start:end]
                if start > 0:
                    snippet = "…" + snippet
                if end < len(content):
                    snippet = snippet + "…"
            else:
                snippet = content[:120] + ("…" if len(content) > 120 else "")

            scored.append({
                "entry": entry,
                "score": score,
                "matched_in": list(dict.fromkeys(matched_in)),
                "snippet": snippet,
            })

    # Sort by score descending
    scored.sort(key=lambda x: x["score"], reverse=True)
    results = scored[:limit]

    return {
        "results": results,
        "total": len(scored),
        "query": q,
        "limit": limit,
    }


def get_graph_data() -> Dict[str, Any]:
    """Get memory entries as a graph (nodes + links) for D3 visualization.
    
    Groups entries by target (memory/user) and builds a category hierarchy.
    """
    entries = load_all_entries()
    nodes = []
    links = []
    seen_ids: set[str] = set()

    # Root nodes
    nodes.append({
        "id": "memory_root",
        "label": "Hukommelse",
        "type": "root",
        "group": 0,
        "content": "Unified Memory System",
    })
    nodes.append({
        "id": "memory_entries",
        "label": "Memory Entries",
        "type": "category",
        "group": 1,
        "content": f"{len([e for e in entries if e['target'] == 'memory'])} curated entries",
    })
    nodes.append({
        "id": "user_entries",
        "label": "User Profile",
        "type": "category",
        "group": 1,
        "content": f"{len([e for e in entries if e['target'] == 'user'])} user profile entries",
    })

    seen_ids = {"memory_root", "memory_entries", "user_entries"}
    links.append({"source": "memory_root", "target": "memory_entries", "value": 5})
    links.append({"source": "memory_root", "target": "user_entries", "value": 5})

    # Group entries by target
    for entry in entries:
        if entry["id"] in seen_ids:
            continue
        seen_ids.add(entry["id"])

        parent = "memory_entries" if entry["target"] == "memory" else "user_entries"

        # Create node with truncated label
        content = entry["content"]
        label = (content[:50] + "…" if len(content) > 53 else content).replace("\n", " ")

        node = {
            "id": entry["id"],
            "label": label,
            "type": "item",
            "group": 2,
            "content": content[:500],  # First 500 chars for tooltip
            "target": entry["target"],
            "source": entry.get("source", "hermes"),
            "created_at": entry.get("created_at"),
            "tags": entry.get("tags", []),
        }
        nodes.append(node)
        links.append({"source": parent, "target": entry["id"], "value": 1})

    # Cross-reference links between entries
    id_to_node = {n["id"]: n for n in nodes}
    for entry in entries:
        for ref in entry.get("references", []):
            if ref in id_to_node and ref != entry["id"] and not ref.startswith("#"):
                links.append({
                    "source": entry["id"],
                    "target": ref,
                    "value": 2,
                    "type": "cross_ref",
                })

    return {"nodes": nodes, "links": links, "total": len(entries)}


def add_entry(content: str, target: str = "memory", source: str = "dashboard",
              conversation_id: Optional[str] = None) -> Dict[str, Any]:
    """Add a new entry to memory or user store."""
    content = content.strip()
    if not content:
        return {"success": False, "error": "Content cannot be empty."}

    mem_dir = _get_mem_dir()
    mem_dir.mkdir(parents=True, exist_ok=True)

    path = mem_dir / f"{target.upper()}.md"
    current_entries = _load_entries_from_file(path)

    # Reject exact duplicates
    if content in current_entries:
        return {"success": False, "error": "Entry already exists."}

    # Check char limit
    ENTRY_CHAR_LIMITS = {"memory": 2200, "user": 1375}
    limit = ENTRY_CHAR_LIMITS.get(target, 2200)
    new_total = len(ENTRY_DELIMITER.join(current_entries + [content]))
    if new_total > limit:
        return {
            "success": False,
            "error": f"Would exceed {limit} char limit. Remove entries first.",
            "current_chars": len(ENTRY_DELIMITER.join(current_entries)),
            "limit": limit,
        }

    # Append new entry
    current_entries.append(content)
    content_str = ENTRY_DELIMITER.join(current_entries)

    try:
        path.write_text(content_str, encoding="utf-8")
    except OSError as e:
        return {"success": False, "error": f"Failed to write: {e}"}

    # Reload and update index
    all_entries = load_all_entries(mem_dir)
    save_entries_index(all_entries, mem_dir)

    eid = _entry_id(content)
    return {
        "success": True,
        "id": eid,
        "message": "Entry added.",
        "entry_count": len(current_entries),
    }


if __name__ == "__main__":
    import sys

    cmd = sys.argv[1] if len(sys.argv) > 1 else "entries"
    args = sys.argv[2:]

    if cmd == "entries":
        kwargs = {}
        i = 0
        while i < len(args):
            if args[i] == "--target" and i+1 < len(args):
                kwargs["target"] = args[i+1]; i += 2
            elif args[i] == "--source" and i+1 < len(args):
                kwargs["source"] = args[i+1]; i += 2
            elif args[i] == "--tag" and i+1 < len(args):
                kwargs["tag"] = args[i+1]; i += 2
            elif args[i] == "--q" and i+1 < len(args):
                kwargs["q"] = args[i+1]; i += 2
            elif args[i] == "--limit" and i+1 < len(args):
                kwargs["limit"] = int(args[i+1]); i += 2
            elif args[i] == "--offset" and i+1 < len(args):
                kwargs["offset"] = int(args[i+1]); i += 2
            else:
                i += 1
        result = get_entries(**kwargs)
    elif cmd == "timeline":
        limit = int(args[0]) if args else 50
        offset = int(args[1]) if len(args) > 1 else 0
        result = get_timeline(limit=limit, offset=offset)
    elif cmd == "search":
        q = args[0] if args else ""
        lim = int(args[1]) if len(args) > 1 else 20
        result = search_entries(q, limit=lim)
    elif cmd == "graph":
        result = get_graph_data()
    elif cmd == "add":
        target = args[0] if args else "memory"
        content = " ".join(args[1:]) if len(args) > 1 else ""
        result = add_entry(content, target=target)
    elif cmd == "index":
        entries = load_all_entries()
        save_entries_index(entries)
        result = {"ok": True, "total": len(entries)}
    else:
        result = {"error": f"Unknown command: {cmd}"}

    print(json.dumps(result, ensure_ascii=False, indent=2))
