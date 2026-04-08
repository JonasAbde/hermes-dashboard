#!/usr/bin/env python3
"""
Hermes Chat — sends a message to Hermes via the running gateway.
Reads KILOCODE_API_KEY from the Hermes credential pool (auth.json)
so no env var is needed.
"""
import sys
import os
import json
import time
import io

HERMES_ROOT = os.path.realpath(os.getenv('HERMES_HOME', os.path.expanduser('~/.hermes')))
HERMES_AGENT_ROOT = os.path.join(HERMES_ROOT, 'hermes-agent')
AUTH_FILE = os.path.join(HERMES_ROOT, 'auth.json')
DEFAULT_TOOLSET = os.getenv('HERMES_DASHBOARD_TOOLSET', 'full_stack')

def get_kilocode_key():
    """Read the Kilo Code JWT from Hermes auth.json credential pool."""
    try:
        with open(AUTH_FILE) as f:
            auth = json.load(f)
        pool = auth.get('credential_pool', {})
        entries = pool.get('kilocode', [])
        for e in entries:
            token = e.get('access_token', '')
            if token and not token.startswith('***') and len(token) > 20:
                return token
    except Exception:
        pass
    return None

def send_message(message, model='kilo-auto/balanced', timeout=60, session_id=None, toolset=None):
    api_key = get_kilocode_key()
    if not api_key:
        return {'ok': False, 'error': 'No KILOCODE_API_KEY found in auth.json credential pool'}

    if not os.path.isdir(HERMES_AGENT_ROOT):
        return {'ok': False, 'error': f'Hermes agent repo not found: {HERMES_AGENT_ROOT}'}

    sys.path.insert(0, HERMES_AGENT_ROOT)
    os.environ['HOME'] = os.path.expanduser('~')
    os.environ['TERM'] = 'dumb'
    os.environ['NO_COLOR'] = '1'
    os.environ['HERMES_SKIP_MCP'] = '1'
    os.environ['HERMES_HOME'] = HERMES_ROOT
    os.environ['KILOCODE_API_KEY'] = api_key

    # Redirect stdout to capture only the agent's thinking output
    old_stdout = sys.stdout
    sys.stdout = io.StringIO()

    try:
        from run_agent import AIAgent
        from hermes_state import SessionDB

        selected_toolset = (toolset or DEFAULT_TOOLSET).strip() or 'full_stack'

        agent = AIAgent(
            model=model,
            provider='kilocode',
            max_iterations=12,
            enabled_toolsets=[selected_toolset],
            platform='dashboard',
            session_id=session_id,
            session_db=SessionDB(),
            skip_context_files=True,
            save_trajectories=False,
            quiet_mode=True,
        )

        result = agent.run_conversation(message)
        captured = sys.stdout.getvalue()
        sys.stdout = old_stdout

        resp = str(result.get('final_response', ''))
        if not resp:
            resp = captured.strip() if captured.strip() else 'No response'

        # Filter out MCP noise from captured stdout
        if captured:
            lines = [
                l for l in captured.split('\n')
                if l.strip() and not any(x in l for x in [
                    'MCP Server', 'Warning:', 'Failed to parse', 'Traceback',
                    'Knowledge Graph', 'pdf-server', 'Sequential Thinking',
                    'Puppeteer', 'hermes_gateway', 'Starting MCP server',
                ])
            ]
            if lines:
                resp += '\n\n[Agent log]\n' + '\n'.join(lines[:8])

        return {'ok': True, 'response': resp[:3000]}
    except Exception as e:
        import traceback
        sys.stdout = old_stdout
        return {'ok': False, 'error': str(e)[:200], 'trace': traceback.format_exc()[:400]}


if __name__ == '__main__':
    payload = ' '.join(sys.argv[1:]) if len(sys.argv) > 1 else ''
    msg = payload or 'Hello'
    model = 'kilo-auto/balanced'
    session_id = None
    toolset = None
    if payload:
        try:
            parsed = json.loads(payload)
            if isinstance(parsed, dict):
                msg = str(parsed.get('message', '')).strip() or 'Hello'
                model = str(parsed.get('model', model)).strip() or model
                session_id = parsed.get('session_id') or None
                toolset = parsed.get('toolset') or None
        except Exception:
            pass
    result = send_message(msg, model=model, session_id=session_id, toolset=toolset)
    print(json.dumps(result, indent=2))
