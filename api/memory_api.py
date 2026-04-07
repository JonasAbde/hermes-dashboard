#!/usr/bin/env python3
"""
Memory API Module - Provides read/write operations for Hermes Agent memory.

This module bridges the Dashboard API with Hermes Agent's memory system.
It reads from and writes to ~/.hermes/memories/ (where Hermes Agent stores memory).

Two files:
  - MEMORY.md: agent's personal notes (§-delimited entries)
  - USER.md: what the agent knows about the user (also §-delimited)

Dashboard graph parser (memory_graph.py) also reads ~/.hermes/MEMORY.md
(curated full Markdown format) separately.
"""

import os
import re
import json
import tempfile
import hashlib
from datetime import datetime
from pathlib import Path

try:
    import fcntl
except ImportError:
    fcntl = None

try:
    import yaml
except ImportError:
    yaml = None

try:
    import msvcrt
except ImportError:
    msvcrt = None

ENTRY_DELIMITER = "\n§\n"


def get_memory_dir():
    """Return the memories directory (~/.hermes/memories)."""
    home = os.path.expanduser("~")
    return os.path.join(home, ".hermes", "memories")


def get_limits():
    """Read memory_char_limit and user_char_limit from config.yaml."""
    memory_limit = 8000   # safe default
    user_limit   = 4000   # safe default
    try:
        config_path = os.path.join(os.path.expanduser("~"), ".hermes", "config.yaml")
        if yaml and os.path.exists(config_path):
            with open(config_path) as f:
                cfg = yaml.safe_load(f)
            if cfg and 'memory' in cfg:
                memory_limit = cfg['memory'].get('memory_char_limit', 8000)
                user_limit   = cfg['memory'].get('user_char_limit', 4000)
    except Exception:
        pass
    return memory_limit, user_limit


def get_root_memory_path():
    """Return the curated root MEMORY.md (~/.hermes/MEMORY.md)."""
    home = os.path.expanduser("~")
    return os.path.join(home, ".hermes", "MEMORY.md")


def _read_entries(file_path: str) -> list:
    """Read memory entries from a §-delimited file."""
    if not os.path.exists(file_path):
        return []
    try:
        raw = Path(file_path).read_text(encoding="utf-8")
    except (OSError, IOError):
        return []
    if not raw.strip():
        return []
    entries = [e.strip() for e in raw.split(ENTRY_DELIMITER)]
    return [e for e in entries if e]


def _write_entries(file_path: str, entries: list):
    """Write entries to a §-delimited file atomically."""
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    content = ENTRY_DELIMITER.join(entries) if entries else ""
    fd, tmp_path = tempfile.mkstemp(
        dir=os.path.dirname(file_path), suffix=".tmp", prefix=".mem_"
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(content)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, file_path)
    except BaseException:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


# ── Threat scan (same as memory_tool.py) ─────────────────────────────────────

_MEMORY_THREAT_PATTERNS = [
    (r'ignore\s+(previous|all|above|prior)\s+instructions', "prompt_injection"),
    (r'you\s+are\s+now\s+', "role_hijack"),
    (r'do\s+not\s+tell\s+the\s+user', "deception_hide"),
    (r'system\s+prompt\s+override', "sys_prompt_override"),
    (r'disregard\s+(your|all|any)\s+(instructions|rules|guidelines)', "disregard_rules"),
    (r'authorized_keys', "ssh_backdoor"),
    (r'\$HOME/\.ssh|\$HOME/\.hermes/\.env', "hermes_env"),
]

_INVISIBLE_CHARS = {
    '\u200b', '\u200c', '\u200d', '\u2060', '\ufeff',
    '\u202a', '\u202b', '\u202c', '\u202d', '\u202e',
}


def _scan_content(content: str) -> str | None:
    """Scan for injection patterns. Returns error string or None."""
    for char in _INVISIBLE_CHARS:
        if char in content:
            return f"Blocked: invisible unicode U+{ord(char):04X}"
    for pattern, pid in _MEMORY_THREAT_PATTERNS:
        if re.search(pattern, content, re.IGNORECASE):
            return f"Blocked: threat pattern '{pid}'"
    return None


def _lock_file(fd):
    if fcntl is not None:
        fcntl.flock(fd, fcntl.LOCK_EX)
    elif msvcrt is not None:
        msvcrt.locking(fd.fileno(), msvcrt.LK_LOCK, 1)


def _unlock_file(fd):
    if fcntl is not None:
        fcntl.flock(fd, fcntl.LOCK_UN)
    elif msvcrt is not None:
        try:
            fd.seek(0)
        except OSError:
            pass
        msvcrt.locking(fd.fileno(), msvcrt.LK_UNLCK, 1)


# ── Public API ────────────────────────────────────────────────────────────────

def read_entries(target: str = "memory") -> dict:
    """Read all entries from memory or user store."""
    mem_dir = get_memory_dir()
    os.makedirs(mem_dir, exist_ok=True)
    file_path = os.path.join(mem_dir, "MEMORY.md" if target == "memory" else "USER.md")
    entries = _read_entries(file_path)
    
    # Calculate char count
    char_count = len(ENTRY_DELIMITER.join(entries)) if entries else 0
    limit = 8000 if target == "memory" else 4000
    pct = min(100, int((char_count / limit) * 100)) if limit > 0 else 0
    
    return {
        "target": target,
        "entries": entries,
        "entry_count": len(entries),
        "char_count": char_count,
        "char_limit": limit,
        "usage_pct": pct,
        "file_path": file_path,
    }


def add_entry(target: str, content: str) -> dict:
    """Add a new entry to memory or user store."""
    content = content.strip()
    if not content:
        return {"success": False, "error": "Content cannot be empty."}
    
    scan_error = _scan_content(content)
    if scan_error:
        return {"success": False, "error": scan_error}
    
    mem_dir = get_memory_dir()
    os.makedirs(mem_dir, exist_ok=True)
    file_path = os.path.join(mem_dir, "MEMORY.md" if target == "memory" else "USER.md")
    
    # File-level lock
    lock_path = file_path + ".lock"
    os.makedirs(os.path.dirname(lock_path), exist_ok=True)
    fd = open(lock_path, "w")
    try:
        _lock_file(fd)
        
        entries = _read_entries(file_path)
        limit = 8000 if target == "memory" else 4000
        
        # Check duplicate
        if content in entries:
            return {
                "success": True,
                "message": "Entry already exists.",
                "target": target,
                "entries": entries,
                "entry_count": len(entries),
                "usage": f"{min(100, int((len(ENTRY_DELIMITER.join(entries)) / limit) * 100))}% — {len(ENTRY_DELIMITER.join(entries)):,}/{limit:,} chars",
            }
        
        # Check limit
        new_entries = entries + [content]
        new_total = len(ENTRY_DELIMITER.join(new_entries))
        if new_total > limit:
            current = len(ENTRY_DELIMITER.join(entries))
            return {
                "success": False,
                "error": (
                    f"Memory at {current:,}/{limit:,} chars. "
                    f"Adding this entry ({len(content)} chars) would exceed the limit."
                ),
                "current_entries": entries,
                "usage": f"{min(100, int((current / limit) * 100))}% — {current:,}/{limit:,}",
            }
        
        entries.append(content)
        _write_entries(file_path, entries)
        
    finally:
        _unlock_file(fd)
        fd.close()
    
    return {
        "success": True,
        "message": "Entry added.",
        "target": target,
        "entries": entries,
        "entry_count": len(entries),
        "usage": f"{min(100, int((new_total / limit) * 100))}% — {new_total:,}/{limit:,} chars",
    }


def replace_entry(target: str, old_text: str, new_content: str) -> dict:
    """Replace entry containing old_text with new_content."""
    old_text = old_text.strip()
    new_content = new_content.strip()
    if not old_text:
        return {"success": False, "error": "old_text cannot be empty."}
    if not new_content:
        return {"success": False, "error": "new_content cannot be empty."}
    
    scan_error = _scan_content(new_content)
    if scan_error:
        return {"success": False, "error": scan_error}
    
    mem_dir = get_memory_dir()
    os.makedirs(mem_dir, exist_ok=True)
    file_path = os.path.join(mem_dir, "MEMORY.md" if target == "memory" else "USER.md")
    
    lock_path = file_path + ".lock"
    os.makedirs(os.path.dirname(lock_path), exist_ok=True)
    fd = open(lock_path, "w")
    try:
        _lock_file(fd)
        entries = _read_entries(file_path)
        matches = [(i, e) for i, e in enumerate(entries) if old_text in e]
        
        if not matches:
            return {"success": False, "error": f"No entry matched '{old_text}'."}
        
        if len(matches) > 1:
            unique_texts = set(e for _, e in matches)
            if len(unique_texts) > 1:
                return {
                    "success": False,
                    "error": f"Multiple entries matched '{old_text}'. Be more specific.",
                    "matches": [e[:80] + ("..." if len(e) > 80 else "") for _, e in matches],
                }
        
        idx = matches[0][0]
        limit = 8000 if target == "memory" else 4000
        test_entries = entries.copy()
        test_entries[idx] = new_content
        new_total = len(ENTRY_DELIMITER.join(test_entries))
        
        if new_total > limit:
            return {
                "success": False,
                "error": f"Replacement would put memory at {new_total:,}/{limit:,} chars.",
            }
        
        entries[idx] = new_content
        _write_entries(file_path, entries)
        
    finally:
        _unlock_file(fd)
        fd.close()
    
    return {
        "success": True,
        "message": "Entry replaced.",
        "target": target,
        "entries": entries,
        "entry_count": len(entries),
        "usage": f"{min(100, int((new_total / limit) * 100))}% — {new_total:,}/{limit:,} chars",
    }


def remove_entry(target: str, old_text: str) -> dict:
    """Remove entry containing old_text."""
    old_text = old_text.strip()
    if not old_text:
        return {"success": False, "error": "old_text cannot be empty."}
    
    mem_dir = get_memory_dir()
    os.makedirs(mem_dir, exist_ok=True)
    file_path = os.path.join(mem_dir, "MEMORY.md" if target == "memory" else "USER.md")
    
    lock_path = file_path + ".lock"
    os.makedirs(os.path.dirname(lock_path), exist_ok=True)
    fd = open(lock_path, "w")
    try:
        _lock_file(fd)
        entries = _read_entries(file_path)
        matches = [(i, e) for i, e in enumerate(entries) if old_text in e]
        
        if not matches:
            return {"success": False, "error": f"No entry matched '{old_text}'."}
        
        if len(matches) > 1:
            unique_texts = set(e for _, e in matches)
            if len(unique_texts) > 1:
                return {
                    "success": False,
                    "error": f"Multiple entries matched '{old_text}'. Be more specific.",
                    "matches": [e[:80] + ("..." if len(e) > 80 else "") for _, e in matches],
                }
        
        idx = matches[0][0]
        entries.pop(idx)
        _write_entries(file_path, entries)
        
    finally:
        _unlock_file(fd)
        fd.close()
    
    limit = 8000 if target == "memory" else 4000
    new_total = len(ENTRY_DELIMITER.join(entries))
    return {
        "success": True,
        "message": "Entry removed.",
        "target": target,
        "entries": entries,
        "entry_count": len(entries),
        "usage": f"{min(100, int((new_total / limit) * 100))}% — {new_total:,}/{limit:,} chars",
    }


# =============================================================================
# UNIFIED MEMORY API — extended commands for Dashboard entries/timeline/search/graph
# These complement the basic read/add/replace/remove actions above.
# =============================================================================

def unified_get_entries(target=None, source=None, tag=None, q=None, limit=50, offset=0):
    """Get all entries with optional filtering. Returns dict with entries list."""
    entries = _read_all_entries()
    if target:
        entries = [e for e in entries if e.get('target') == target]
    if source:
        entries = [e for e in entries if e.get('source') == source]
    if tag:
        entries = [e for e in entries if tag in e.get('tags', [])]
    if q:
        q_lower = q.lower()
        entries = [e for e in entries if q_lower in e.get('content', '').lower()]
    total = len(entries)
    return {
        'entries': entries[offset:offset + limit],
        'total': total,
        'limit': limit,
        'offset': offset,
    }


def unified_get_timeline(limit=50, offset=0):
    """Get entries sorted chronologically (most recent first)."""
    entries = _read_all_entries()
    sorted_entries = sorted(entries, key=lambda e: e.get('updated_at', ''), reverse=True)
    total = len(sorted_entries)
    return {
        'entries': sorted_entries[offset:offset + limit],
        'total': total,
        'limit': limit,
        'offset': offset,
        'pages': max(1, (total + limit - 1) // limit),
    }


def unified_search(q, limit=20):
    """Ranked full-text search."""
    if not q or not q.strip():
        return {'results': [], 'total': 0, 'query': q}
    q_lower = q.lower().strip()
    q_words = q_lower.split()
    entries = _read_all_entries()
    scored = []
    for entry in entries:
        content = entry.get('content', '')
        content_lower = content.lower()
        score = 0
        matched_in = []
        if q_lower in content_lower:
            score += 10; matched_in.append('exact')
        for word in q_words:
            if re.search(r'\b' + re.escape(word) + r'\b', content_lower):
                score += 5; matched_in.append('word')
            elif word in content_lower:
                score += 2; matched_in.append('substring')
        for tag in entry.get('tags', []):
            if q_lower in tag.lower():
                score += 8; matched_in.append('tag')
        if score > 0:
            idx = content_lower.find(q_lower)
            if idx >= 0:
                start = max(0, idx - 40)
                end = min(len(content), idx + len(q) + 60)
                snippet = content[start:end]
                if start > 0: snippet = '…' + snippet
                if end < len(content): snippet = snippet + '…'
            else:
                snippet = content[:120] + ('…' if len(content) > 120 else '')
            scored.append({
                'entry': entry,
                'score': score,
                'matched_in': list(dict.fromkeys(matched_in)),
                'snippet': snippet,
            })
    scored.sort(key=lambda x: x['score'], reverse=True)
    return {'results': scored[:limit], 'total': len(scored), 'query': q, 'limit': limit}


def unified_graph():
    """Get entries as graph nodes and links."""
    entries = _read_all_entries()
    nodes = []
    links = []
    seen_ids = set()
    nodes.append({'id': 'memory_root', 'label': 'Hukommelse', 'type': 'root', 'group': 0, 'content': 'Unified Memory System'})
    nodes.append({'id': 'memory_entries', 'label': 'Memory Entries', 'type': 'category', 'group': 1, 'content': f'{len([e for e in entries if e["target"] == "memory"])} curated entries'})
    nodes.append({'id': 'user_entries', 'label': 'User Profile', 'type': 'category', 'group': 1, 'content': f'{len([e for e in entries if e["target"] == "user"])} user profile entries'})
    seen_ids = {'memory_root', 'memory_entries', 'user_entries'}
    links.append({'source': 'memory_root', 'target': 'memory_entries', 'value': 5})
    links.append({'source': 'memory_root', 'target': 'user_entries', 'value': 5})
    id_to_node = {n['id']: n for n in nodes}
    for entry in entries:
        if entry['id'] in seen_ids: continue
        seen_ids.add(entry['id'])
        parent = 'memory_entries' if entry['target'] == 'memory' else 'user_entries'
        content = entry['content']
        label = (content[:50] + '…' if len(content) > 53 else content).replace('\n', ' ')
        nodes.append({
            'id': entry['id'], 'label': label, 'type': 'item', 'group': 2,
            'content': content[:500], 'target': entry['target'],
            'source': entry.get('source', 'hermes'),
            'created_at': entry.get('created_at'),
            'tags': entry.get('tags', []),
        })
        links.append({'source': parent, 'target': entry['id'], 'value': 1})
        for ref in entry.get('references', []):
            if ref in id_to_node and ref != entry['id'] and not ref.startswith('#'):
                links.append({'source': entry['id'], 'target': ref, 'value': 2, 'type': 'cross_ref'})
    return {'nodes': nodes, 'links': links, 'total': len(entries)}


def unified_index():
    """Build and save entries index JSON."""
    entries = _read_all_entries()
    id_to_entry = {e['id']: e for e in entries}
    links = []
    seen_links = set()
    for entry in entries:
        for ref in entry.get('references', []):
            if ref in id_to_entry and ref != entry['id']:
                key = (entry['id'], ref)
                if key not in seen_links:
                    seen_links.add(key)
                    links.append({'source': entry['id'], 'target': ref, 'type': 'reference'})
            elif ref.startswith('#'):
                for other in entries:
                    if other['id'] != entry['id'] and ref in other.get('tags', []):
                        key = (entry['id'], other['id'])
                        if key not in seen_links:
                            seen_links.add(key)
                            links.append({'source': entry['id'], 'target': other['id'], 'type': 'tag', 'tag': ref})
    idx_data = {
        'generated_at': datetime.now().isoformat(),
        'total_entries': len(entries),
        'memory_entries': len([e for e in entries if e['target'] == 'memory']),
        'user_entries': len([e for e in entries if e['target'] == 'user']),
        'entries': entries,
        'links': links,
    }
    idx_path = Path(get_memory_dir()).parent / 'memories' / 'entries_index.json'
    idx_path.parent.mkdir(parents=True, exist_ok=True)
    idx_path.write_text(json.dumps(idx_data, ensure_ascii=False, indent=2), encoding='utf-8')
    return {'ok': True, 'total': len(entries)}


def _read_all_entries():
    """Read all entries from MEMORY.md and USER.md with full metadata."""
    mem_dir = get_memory_dir()
    entries = []
    seen_ids = set()
    for target in ('memory', 'user'):
        path = os.path.join(mem_dir, f'{target.upper()}.md')
        raw_entries = _read_entries(path)
        for i, content in enumerate(raw_entries):
            eid = hashlib.sha256(content.encode('utf-8')).hexdigest()[:8]
            if eid in seen_ids: continue
            seen_ids.add(eid)
            entries.append({
                'id': eid,
                'content': content,
                'target': target,
                'source': 'hermes',
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat(),
                'conversation_id': None,
                'tags': re.findall(r'#([a-z][a-z0-9_-]{1,20})', content, re.IGNORECASE),
                'references': [],
                'is_injected': False,
                'order': i,
            })
    return entries


if __name__ == '__main__':
    import sys
    import hashlib
    from datetime import datetime

    if len(sys.argv) < 2:
        print(json.dumps({'error': 'action required'}))
        sys.exit(1)

    action = sys.argv[1]

    if action == 'entries':
        kwargs = {}
        i = 2
        while i < len(sys.argv):
            if sys.argv[i] == '--target' and i+1 < len(sys.argv): kwargs['target'] = sys.argv[i+1]; i += 2
            elif sys.argv[i] == '--limit' and i+1 < len(sys.argv): kwargs['limit'] = int(sys.argv[i+1]); i += 2
            elif sys.argv[i] == '--offset' and i+1 < len(sys.argv): kwargs['offset'] = int(sys.argv[i+1]); i += 2
            else: i += 1
        print(json.dumps(unified_get_entries(**kwargs)))
    elif action == 'timeline':
        limit = int(sys.argv[2]) if len(sys.argv) > 2 else 50
        offset = int(sys.argv[3]) if len(sys.argv) > 3 else 0
        print(json.dumps(unified_get_timeline(limit=limit, offset=offset)))
    elif action == 'search':
        q = sys.argv[2] if len(sys.argv) > 2 else ''
        limit = int(sys.argv[3]) if len(sys.argv) > 3 else 20
        print(json.dumps(unified_search(q, limit=limit)))
    elif action == 'graph':
        print(json.dumps(unified_graph()))
    elif action == 'index':
        print(json.dumps(unified_index()))
    elif action == 'add':
        target = sys.argv[2] if len(sys.argv) > 2 else 'memory'
        content = ' '.join(sys.argv[3:]) if len(sys.argv) > 3 else ''
        print(json.dumps(add_entry(target, content)))
    else:
        # Delegate to legacy action handlers
        target = sys.argv[2] if len(sys.argv) > 2 else 'memory'
        arg1 = sys.argv[3] if len(sys.argv) > 3 else None
        arg2 = sys.argv[4] if len(sys.argv) > 4 else None
        if action == 'read':
            print(json.dumps(read_entries(target)))
        elif action == 'replace':
            print(json.dumps(replace_entry(target, arg1, arg2)))
        elif action == 'remove':
            print(json.dumps(remove_entry(target, arg1)))
        else:
            print(json.dumps({'error': f'unknown action: {action}'}))
