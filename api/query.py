import sqlite3
import json
import sys
import os
import time
import glob
import datetime
from datetime import date, datetime as dt

DB = os.path.expanduser('~/.hermes/state.db')

def connect(retries=3):
    for i in range(retries):
        try:
            con = sqlite3.connect(DB, timeout=10, isolation_level=None)
            con.row_factory = sqlite3.Row
            con.execute("PRAGMA journal_mode=WAL")
            con.execute("PRAGMA foreign_keys=ON")
            con.execute("SELECT 1 FROM sessions LIMIT 1")
            return con
        except Exception:
            if i < retries - 1:
                time.sleep(0.3 * (i + 1))
            else:
                raise

def safe(con, sql, params=()):
    try:
        return con.execute(sql, params).fetchone()
    except Exception:
        return None

def safe_all(con, sql, params=()):
    try:
        return con.execute(sql, params).fetchall()
    except Exception:
        return []

def _get_session_field(row, name, safe_type=int):
    """Safely extract a field from a session row (dict or Row)."""
    try:
        val = row[name]
        if val is None:
            return safe_type(0)
        return safe_type(val)
    except (TypeError, ValueError):
        return safe_type(0)

def _load_sessions_iteratively(limit=1000):
    """
    Load sessions row-by-row, skipping any corrupted rows.
    Iterates in ASC order to read the most data (corruption typically hits
    when fetching recent rows which are stored at the end of the table).
    """
    con = connect()
    cols = None
    try:
        cols = [c[1] for c in con.execute("PRAGMA table_info(sessions)").fetchall()]
    except Exception:
        con.close()
        return []
    
    sessions = []
    for offset in range(limit):
        try:
            # ASC order reads all 45 readable sessions vs ~16 in DESC
            row = con.execute(
                "SELECT * FROM sessions ORDER BY started_at ASC LIMIT 1 OFFSET ?",
                (offset,)
            ).fetchone()
            if not row:
                break
            sessions.append(dict(zip(cols, row)))
        except Exception:
            # Corrupted row — skip and continue
            continue
    con.close()
    return sessions

def _estimate_tokens(text):
    """Rough token estimate: ~4 chars per token for English/Danish."""
    if not text:
        return 0
    if isinstance(text, list):
        return sum(_estimate_tokens(part.get('text', '')) if isinstance(part, dict) else _estimate_tokens(str(part)) for part in text)
    return max(1, len(str(text)) // 4)

# Approximate pricing per 1M tokens (input/output) for common models
_MODEL_PRICING = {
    'gemini-2.5-pro':       (1.25, 10.0),
    'gemini-2.5-flash':     (0.15, 0.60),
    'claude-sonnet-4-20250514': (3.0, 15.0),
    'claude-opus-4-20250514':   (15.0, 75.0),
    'gpt-4o':               (2.50, 10.0),
    'gpt-4.1':              (2.0, 8.0),
    'kilo-auto/balanced':   (1.0, 5.0),   # estimate
    'kilo-auto/fast':       (0.15, 0.60),
    'kilo-auto/quality':    (3.0, 15.0),
}

def _estimate_cost(model, input_tokens, output_tokens):
    """Estimate cost from model name and token counts."""
    model_lower = (model or '').lower()
    pricing = None
    for key, val in _MODEL_PRICING.items():
        if key in model_lower:
            pricing = val
            break
    if not pricing:
        pricing = (1.0, 5.0)  # fallback
    return (input_tokens * pricing[0] + output_tokens * pricing[1]) / 1_000_000

def _load_sessions_from_json(limit=500):
    """Read sessions from session_*.json files in ~/.hermes/sessions/.
    Gateway writes to JSON (not state.db), so this is the primary source.
    Estimates tokens and cost from message content since gateway doesn't track usage."""
    sessions_dir = os.path.expanduser('~/.hermes/sessions')
    results = []
    for f in sorted(glob.glob(os.path.join(sessions_dir, 'session_*.json')), reverse=True)[:limit]:
        try:
            with open(f) as fh:
                d = json.load(fh)
            msgs = d.get('messages', [])
            # First user message as title
            title = next(((c[:80] + '…') if len(c) > 80 else c
                          for m in msgs if m.get('role') == 'user' and m.get('content')
                          for c in [m['content'] if isinstance(m['content'], str) else ''] if c), None)
            
            # Parse started_at from filename: session_20260407_204519_edb409.json
            started_at = 0
            try:
                parts = os.path.basename(f).replace('session_', '').replace('.json', '').split('_')
                if len(parts) >= 2:
                    d_obj = dt.strptime(parts[0] + parts[1], '%Y%m%d%H%M%S')
                    started_at = d_obj.timestamp()
            except Exception:
                pass
            
            # Parse ended_at from last_updated field
            ended_at = None
            if d.get('last_updated'):
                try:
                    ended_at = dt.fromisoformat(d['last_updated']).timestamp()
                except Exception:
                    pass
            
            # Estimate tokens from message content
            input_tokens = 0
            output_tokens = 0
            for m in msgs:
                tok = _estimate_tokens(m.get('content', ''))
                # Also count tool_calls content
                for tc in (m.get('tool_calls') or []):
                    if isinstance(tc, dict):
                        fn = tc.get('function', {})
                        tok += _estimate_tokens(fn.get('arguments', ''))
                # Also count reasoning
                tok += _estimate_tokens(m.get('reasoning', ''))
                
                if m.get('role') in ('user', 'tool'):
                    input_tokens += tok
                else:
                    output_tokens += tok
            
            model = d.get('model', '')
            cost = _estimate_cost(model, input_tokens, output_tokens)
            
            results.append({
                'id': d.get('session_id', os.path.basename(f).replace('.json', '')),
                'title': title,
                'source': d.get('platform', 'telegram'),
                'model': model,
                'started_at': started_at,
                'ended_at': ended_at,
                'cost': cost,
                'estimated_cost_usd': cost,
                'actual_cost_usd': cost,
                'input_tokens': input_tokens,
                'output_tokens': output_tokens,
                'message_count': d.get('message_count', len(msgs)),
                'cache_read_tokens': 0,
                'billing_provider': 'kilocode',
            })
        except Exception:
            continue
    return results


def stats():
    import datetime
    
    # Primary: read from session_*.json files (gateway writes here)
    sessions = _load_sessions_from_json(500)
    # Fallback: try state.db iterative load if JSON returned nothing
    if not sessions:
        db_sessions = _load_sessions_iteratively(500)
        if db_sessions:
            sessions = db_sessions
    
    now = time.time()
    day_start = now - 86400
    week_start = now - 7 * 86400
    ms = date.today().replace(day=1)
    month_start = time.mktime(ms.timetuple())

    def si(v):  # safe int
        try: return int(v or 0)
        except: return 0
    def sf(v):  # safe float
        try: return float(v or 0)
        except: return 0.0

    today = [s for s in sessions if si(s.get('started_at', 0)) >= day_start]
    week  = [s for s in sessions if si(s.get('started_at', 0)) >= week_start]
    month = [s for s in sessions if si(s.get('started_at', 0)) >= month_start]

    sessions_today = len(today)
    sessions_week  = len(week)

    tokens_today = sum(si(s.get('input_tokens', 0)) + si(s.get('output_tokens', 0)) for s in today)
    cost_month   = sum(sf(s.get('actual_cost_usd', 0)) or sf(s.get('estimated_cost_usd', 0)) for s in month)

    cache_read = sum(si(s.get('cache_read_tokens', 0)) for s in today)
    io_tokens  = sum(si(s.get('input_tokens', 0)) + si(s.get('output_tokens', 0)) for s in today)
    cache_pct  = round(cache_read / (io_tokens + cache_read) * 100) if (io_tokens + cache_read) > 0 else 0

    # Recent sessions — most recent first
    recent = sessions[:8]
    
    # Duration
    durations = [
        si(s.get('ended_at', 0)) - si(s.get('started_at', 0))
        for s in today
        if si(s.get('ended_at', 0)) > 0 and si(s.get('started_at', 0)) > 0
    ]
    avg_latency_s = round(sum(durations) / len(durations), 1) if durations else None

    # Daily costs
    daily = {}
    for s in sessions:
        if si(s.get('started_at', 0)) >= now - 30*86400:
            day = dt.fromtimestamp(si(s.get('started_at', 0))).strftime('%m-%d')
            cost = sf(s.get('actual_cost_usd', 0)) or sf(s.get('estimated_cost_usd', 0))
            daily[day] = daily.get(day, 0) + cost

    # Memory usage
    memory_pct = None
    memory_kb = 0
    try:
        mem_file = os.path.expanduser('~/.hermes/MEMORY.md')
        if os.path.exists(mem_file):
            memory_kb = os.path.getsize(mem_file) / 1024
            max_kb = 2500  # soft limit increased from 500
            memory_pct = round(min(memory_kb / max_kb * 100, 100))
    except Exception:
        pass

    return {
        'sessions_today':  sessions_today,
        'sessions_week':   sessions_week,
        'tokens_today':    tokens_today,
        'cache_pct':       cache_pct,
        'cost_month':      round(cost_month, 6),
        'budget':          '25.00',
        'memory_pct':      memory_pct,
        'memory_kb':       round(memory_kb, 1),
        'avg_latency_s':   avg_latency_s,
        'recent_sessions': [dict(r) for r in recent],
        'daily_costs':     [{'day': d, 'cost': round(c, 6)} for d, c in sorted(daily.items())],
    }

def ekg():
    """EKG: token usage per hour, last 24h + latency stats. Primary: session_*.json files."""
    sessions = _load_sessions_from_json(500)
    if not sessions:
        sessions = _load_sessions_iteratively(500)
    now = time.time()
    hour_buckets = {}
    last_beat = None
    latencies = []
    for s in sessions:
        if s.get('started_at', 0) >= now - 86400:
            ts = int(s.get('started_at', 0))
            if ts > 0:
                hour = dt.fromtimestamp(ts).strftime('%H:%M')
                in_t  = int(s.get('input_tokens', 0) or 0)
                out_t = int(s.get('output_tokens', 0) or 0)
                hour_buckets[hour] = hour_buckets.get(hour, 0) + in_t + out_t
                # Track the most recent activity timestamp in ms
                ts_ms = ts * 1000
                if last_beat is None or ts_ms > last_beat:
                    last_beat = ts_ms
                # Collect latency data if available
                latency = s.get('latency_ms') or s.get('response_time_ms')
                if latency and isinstance(latency, (int, float)) and latency > 0:
                    latencies.append(latency)
    points = [{'t': h, 'tokens': c} for h, c in sorted(hour_buckets.items())]

    # Latency stats from last 20 sessions
    recent = sorted(latencies, reverse=True)[:20]
    avg_lat = round(sum(recent) / len(recent)) if recent else None
    p95_lat = recent[int(len(recent) * 0.95)] if recent else None

    return {
        'points': points,
        'last_beat': last_beat,
        'recent_latencies': recent[-10:] if len(recent) > 10 else recent,
        'avg_latency_ms': avg_lat,
        'p95_latency_ms': p95_lat,
    }

def heatmap():
    """Heatmap: session count by day-of-week (Mon=0) and hour. Primary: session_*.json files."""
    sessions = _load_sessions_from_json(500)
    if not sessions:
        sessions = _load_sessions_iteratively(500)
    import datetime
    now = time.time()
    grid = [[0]*24 for _ in range(7)]
    for s in sessions:
        if s.get('started_at', 0) >= now - 7*86400:
            ts = int(s.get('started_at', 0))
            if ts > 0:
                dt = datetime.datetime.fromtimestamp(ts)
                # Mon=0 convention
                dow = (dt.weekday() + 6) % 7
                hour = dt.hour
                grid[dow][hour] += 1
    return {'grid': grid}

def sessions_from_jsonl(page=1, q='', limit=25):
    """Fallback: read sessions from session_*.json files in ~/.hermes/sessions/"""
    # sessions_dir = os.path.expanduser('~/.hermes/sessions')
    sessions_dir = os.path.expanduser('~/.hermes/sessions')
    results = []
    for f in sorted(glob.glob(os.path.join(sessions_dir, 'session_*.json')), reverse=True):
        try:
            with open(f) as fh:
                d = json.load(fh)
            sid   = d.get('session_id') or os.path.basename(f).replace('session_','').replace('.json','')
            msgs  = d.get('messages', [])
            # First user message as title
            title = None
            for m in msgs:
                if m.get('role') == 'user' and m.get('content'):
                    c = m['content']
                    title = (c[:60] + '…') if len(c) > 60 else c
                    break
            # started_at: parse from filename e.g. session_20260407_050809_...
            started_at = 0
            try:
                parts = os.path.basename(f).replace('session_','').split('_')
                if len(parts) >= 2:
                    import datetime as _dt
                    dt = _dt.datetime.strptime(parts[0] + parts[1], '%Y%m%d%H%M%S')
                    started_at = dt.timestamp()
            except Exception:
                pass
            results.append({
                'id': sid,
                'title': title,
                'source': d.get('platform', 'telegram'),
                'model': d.get('model'),
                'started_at': started_at,
                'ended_at': None,
                'cost': d.get('total_cost', 0),
                'estimated_cost_usd': d.get('total_cost', 0),
                'input_tokens': d.get('input_tokens', 0),
                'output_tokens': d.get('output_tokens', 0),
            })
        except Exception:
            continue
    if q:
        q_lower = q.lower()
        results = [r for r in results if q_lower in (r.get('title') or '').lower()
                   or q_lower in (r.get('id') or '').lower()
                   or q_lower in (r.get('source') or '').lower()]
    total = len(results)
    offset = (page - 1) * limit
    return {'sessions': results[offset:offset+limit], 'total': total, 'page': page, 'limit': limit}

def sessions(page=1, q=''):
    """List sessions. Primary source: session_*.json files (gateway writes here).
    Fallback: state.db iterative load."""
    limit = 25
    # Primary: JSON files
    sessions = _load_sessions_from_json(500)
    # Fallback: DB
    if not sessions:
        sessions = list(reversed(_load_sessions_iteratively(500)))
    
    q_lower = q.lower() if q else ''
    
    if q_lower:
        sessions = [s for s in sessions
                    if q_lower in (s.get('title') or '').lower()
                    or q_lower in (s.get('id') or '').lower()
                    or q_lower in (s.get('source') or '').lower()]
    
    total = len(sessions)
    offset = (page - 1) * limit
    page_sessions = sessions[offset:offset+limit]
    
    return {
        'sessions': [{
            'id': s.get('id', ''),
            'title': s.get('title', ''),
            'source': s.get('source', ''),
            'model': s.get('model', ''),
            'started_at': s.get('started_at', 0),
            'ended_at': s.get('ended_at'),
            'estimated_cost_usd': s.get('actual_cost_usd') or s.get('estimated_cost_usd', 0),
        } for s in page_sessions],
        'total': total,
        'page': page,
        'limit': limit,
    }

def _build_trace_steps(msgs):
    """Build Gantt-style trace steps from a list of messages with created_at."""
    if not msgs:
        return []
    t0 = msgs[0]['created_at']
    span = max((msgs[-1]['created_at'] - t0), 1)
    colors = {'tool': '#4a80c8', 'assistant': '#00b478', 'user': '#e05f40', 'reasoning': '#e09040'}
    steps = []
    for i, m in enumerate(msgs[:12]):
        nxt = msgs[i+1] if i+1 < len(msgs) else None
        start = m['created_at'] - t0
        end = (nxt['created_at'] - t0) if nxt else span
        # Use enriched label if present, otherwise fall back to tool_name or role
        label = (m.get('label') or m.get('tool_name') or m.get('role', 'unknown'))[:60]
        steps.append({
            'label': label,
            'offset_pct': round(start/span*100),
            'width_pct': max(round((end-start)/span*100), 2),
            'ms': round((end-start)*1000),
            'color': colors.get(m.get('role'), '#6b6b80'),
        })
    return steps

def trace(session_id):
    """Get trace timeline for a session.
    Primary: state.db messages table.
    Fallback: parse session JSON file directly (gateway writes here).
    """
    # Try state.db first
    try:
        con = connect()
        msgs = safe_all(con, """
            SELECT role, tool_name, created_at FROM messages
            WHERE session_id = ? ORDER BY created_at
        """, (session_id,))
        con.close()
        if msgs:
            steps = _build_trace_steps(msgs)
            if steps:
                return {'steps': steps}
    except Exception:
        pass

    # Fallback: parse session JSON file directly
    # Session JSON files don't store created_at per message, but the filename
    # contains the session start time. We distribute message indices evenly
    # across an estimated session duration for relative Gantt visualization.
    sessions_dir = os.path.expanduser('~/.hermes/sessions')
    basename = f'session_{session_id}.json'
    # Also try prefix match (session IDs may be partial)
    for fname in glob.glob(os.path.join(sessions_dir, 'session_*.json')):
        try:
            with open(fname) as f:
                d = json.load(f)
            sid = d.get('session_id', os.path.basename(fname).replace('.json', ''))
            # Match by session_id field or filename prefix
            if sid != session_id and not sid.startswith(session_id[:8]) and not session_id.startswith(sid[:8]):
                continue
            msgs = d.get('messages', [])
            if not msgs:
                continue
            # Try to parse session start time from filename: session_YYYYMMDD_HHMMSS_...
            import datetime as _dt
            start_ts = None
            fname_base = os.path.basename(fname).replace('session_', '').replace('.json', '')
            parts = fname_base.split('_')
            if len(parts) >= 2 and len(parts[0]) == 8 and len(parts[1]) == 6:
                try:
                    dt = _dt.datetime.strptime(parts[0] + parts[1], '%Y%m%d%H%M%S')
                    start_ts = dt.timestamp()
                except ValueError:
                    pass
            if start_ts is None:
                start_ts = 0.0
            # Distribute messages evenly: each message gets a relative timestamp
            # Assume a reasonable rate: ~5 seconds per message on average
            avg_s = 5
            enriched = []
            for i, m in enumerate(msgs):
                ts = m.get('created_at') or m.get('timestamp')
                content = m.get('content', '')
                # Build a readable label
                if m.get('tool_name'):
                    label = m['tool_name']
                elif isinstance(content, str):
                    label = content[:60].replace('\n', ' ').strip() or m.get('role', '?')
                else:
                    label = m.get('role', '?')
                if ts is not None:
                    try:
                        enriched.append({'role': m.get('role', 'unknown'), 'tool_name': m.get('tool_name'), 'created_at': float(ts), 'label': label})
                    except (ValueError, TypeError):
                        enriched.append({'role': m.get('role', 'unknown'), 'tool_name': m.get('tool_name'), 'created_at': start_ts + i * avg_s, 'label': label})
                else:
                    enriched.append({'role': m.get('role', 'unknown'), 'tool_name': m.get('tool_name'), 'created_at': start_ts + i * avg_s, 'label': label})
            steps = _build_trace_steps(enriched)
            if steps:
                return {'steps': steps}
        except Exception:
            pass

    return {'steps': []}

def approvals():
    con = connect()
    rows = safe_all(con, "SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at DESC")
    con.close()
    return {'pending': [dict(r) for r in rows]}

def fts(query):
    """Full-text search across session titles and message content.
    Primary: search session_*.json files (gateway writes here).
    Fallback: state.db LIKE search."""
    # sessions_dir = os.path.expanduser('~/.hermes/sessions')
    q = query.strip().strip("'")
    if not q:
        return {'results': []}
    q_lower = q.lower()
    results = []
    
    # Search session_*.json files for message content matches
    sessions_dir = os.path.expanduser('~/.hermes/sessions')
    for f in glob.glob(os.path.join(sessions_dir, 'session_*.json'))[:100]:
        try:
            with open(f) as fh:
                d = json.load(fh)
            sid = d.get('session_id', os.path.basename(f).replace('.json', ''))
            title = next((c[:80] for m in d.get('messages', [])
                         if m.get('role') == 'user' and isinstance(m.get('content'), str)
                         for c in [m['content']] if c), None)
            started_at = 0
            try:
                parts = os.path.basename(f).replace('session_', '').replace('.json', '').split('_')
                if len(parts) >= 2:
                    import datetime as _dt
                    started_at = _dt.datetime.strptime(parts[0] + parts[1], '%Y%m%d%H%M%S').timestamp()
            except Exception:
                pass
            # Match title or message content
            matched = q_lower in (title or '').lower() or q_lower in sid.lower()
            if not matched:
                matched = any(q_lower in str(m.get('content', '')).lower()
                              for m in d.get('messages', []))
            if matched:
                # Get snippet of first match
                snippet = None
                for m in d.get('messages', []):
                    c = str(m.get('content', ''))
                    if q_lower in c.lower():
                        idx = c.lower().find(q_lower)
                        snippet = c[max(0, idx-20):idx+len(q)+20]
                        break
                results.append({
                    'id': sid,
                    'title': title,
                    'source': d.get('platform', 'telegram'),
                    'started_at': started_at,
                    'snippet': snippet,
                })
        except Exception:
            continue
    
    return {'results': results[:20]}

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'stats'
    try:
        if cmd == 'stats':   print(json.dumps(stats()))
        elif cmd == 'ekg':   print(json.dumps(ekg()))
        elif cmd == 'heatmap': print(json.dumps(heatmap()))
        elif cmd == 'sessions':
            page = int(sys.argv[2]) if len(sys.argv) > 2 else 1
            q    = sys.argv[3] if len(sys.argv) > 3 else ''
            print(json.dumps(sessions(page, q)))
        elif cmd == 'trace':
            print(json.dumps(trace(sys.argv[2])))
        elif cmd == 'approvals':
            print(json.dumps(approvals()))
        elif cmd == 'fts':
            q = sys.argv[2] if len(sys.argv) > 2 else ''
            print(json.dumps(fts(q)))
        else:
            print(json.dumps({'error': f'unknown cmd: {cmd}'}))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
