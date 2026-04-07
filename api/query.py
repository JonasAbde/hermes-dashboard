#!/usr/bin/env python3
"""
Hermes DB query helper — called from Node API with: python3 query.py <query_name>
Uses Python's sqlite3 which handles WAL mode correctly.
"""
import sqlite3
import json
import sys
import os
import time

DB = os.path.expanduser('~/.hermes/state.db')

def connect(retries=3):
    import time as _time
    for i in range(retries):
        try:
            con = sqlite3.connect(DB, timeout=10)
            con.row_factory = sqlite3.Row
            con.execute("SELECT 1 FROM sessions LIMIT 1")
            return con
        except Exception:
            if i < retries - 1:
                _time.sleep(0.3 * (i + 1))
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
            break
    con.close()
    return sessions

def stats():
    import datetime
    sessions = _load_sessions_iteratively(500)
    # ASC loading maximizes readable rows; reverse for DESC (most-recent-first) display
    sessions_desc = list(reversed(sessions))
    
    now = time.time()
    day_start = now - 86400
    week_start = now - 7 * 86400
    import datetime
    ms = datetime.date.today().replace(day=1)
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

    # Recent sessions — most recent first (from reversed list)
    recent = sessions_desc[:8]
    if not recent:
        recent = sessions_from_jsonl(1, '', 8).get('sessions', [])
    
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
            day = datetime.datetime.fromtimestamp(si(s.get('started_at', 0))).strftime('%m-%d')
            cost = sf(s.get('actual_cost_usd', 0)) or sf(s.get('estimated_cost_usd', 0))
            daily[day] = daily.get(day, 0) + cost

    return {
        'sessions_today':  sessions_today,
        'sessions_week':   sessions_week,
        'tokens_today':    tokens_today,
        'cache_pct':       cache_pct,
        'cost_month':      round(cost_month, 6),
        'budget':          '25.00',
        'avg_latency_s':   avg_latency_s,
        'recent_sessions': [dict(r) for r in recent],
        'daily_costs':     [{'day': d, 'cost': round(c, 6)} for d, c in sorted(daily.items())],
    }

def ekg():
    """EKG: token usage per hour, last 24h. Iterative load to bypass FTS corruption."""
    sessions = _load_sessions_iteratively(500)
    now = time.time()
    hour_buckets = {}
    for s in sessions:
        if s.get('started_at', 0) >= now - 86400:
            import datetime
            ts = int(s.get('started_at', 0))
            if ts > 0:
                hour = datetime.datetime.fromtimestamp(ts).strftime('%H:%M')
                in_t  = int(s.get('input_tokens', 0) or 0)
                out_t = int(s.get('output_tokens', 0) or 0)
                hour_buckets[hour] = hour_buckets.get(hour, 0) + in_t + out_t
    points = [{'t': h, 'tokens': c} for h, c in sorted(hour_buckets.items())]
    return {'points': points}

def heatmap():
    """Heatmap: session count by day-of-week (Mon=0) and hour. Iterative load."""
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
    import glob, os as _os
    sessions_dir = _os.path.expanduser('~/.hermes/sessions')
    results = []
    for f in sorted(glob.glob(_os.path.join(sessions_dir, 'session_*.json')), reverse=True):
        try:
            with open(f) as fh:
                d = json.load(fh)
            sid   = d.get('session_id') or _os.path.basename(f).replace('session_','').replace('.json','')
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
                parts = _os.path.basename(f).replace('session_','').split('_')
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
    """List sessions with iterative loading to bypass FTS corruption.
    Loads ASC (45 rows) then reverses for DESC display order."""
    limit = 25
    sessions = _load_sessions_iteratively(500)
    # Reverse to get DESC order (most recent first)
    sessions = list(reversed(sessions))
    
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

def trace(session_id):
    """Get trace timeline for a session. Iterative load to bypass FTS."""
    con = connect()
    msgs = safe_all(con, """
        SELECT role, tool_name, created_at FROM messages
        WHERE session_id = ? ORDER BY created_at
    """, (session_id,))
    con.close()
    if not msgs:
        return {'steps': []}
    t0 = msgs[0]['created_at']
    span = max((msgs[-1]['created_at'] - t0), 1)
    colors = {'tool': '#4a80c8', 'assistant': '#00b478', 'user': '#e05f40', 'reasoning': '#e09040'}
    steps = []
    for i, m in enumerate(msgs[:12]):
        nxt = msgs[i+1] if i+1 < len(msgs) else None
        start = m['created_at'] - t0
        end = (nxt['created_at'] - t0) if nxt else span
        steps.append({
            'label': m['tool_name'] or m['role'],
            'offset_pct': round(start/span*100),
            'width_pct': max(round((end-start)/span*100), 2),
            'ms': round((end-start)*1000),
            'color': colors.get(m['role'], '#6b6b80'),
        })
    return {'steps': steps}

def approvals():
    con = connect()
    rows = safe_all(con, "SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at DESC")
    con.close()
    return {'pending': [dict(r) for r in rows]}

def fts(query):
    """Full-text search — fallback to LIKE search (FTS table is corrupted)."""
    con = connect()
    q = query.strip().strip("'")
    if not q:
        con.close()
        return {'results': []}
    try:
        sessions = _load_sessions_iteratively(200)
        results = [
            {
                'id': s.get('id', ''),
                'title': s.get('title', ''),
                'source': s.get('source', ''),
                'started_at': s.get('started_at', 0),
            }
            for s in sessions
            if q.lower() in (s.get('title') or '').lower()
            or q.lower() in (s.get('id') or '').lower()
        ]
        con.close()
        return {'results': results[:20]}
    except Exception:
        con.close()
        return {'results': []}

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
