# Hermes Gateway — Architecture

> Platform-agnostisk message gateway for Hermes Agent.
> Håndterer 16+ platforme: Telegram, Discord, Slack, WhatsApp, Signal, Email, SMS, og mere.

---

## Core Loop

```
┌─────────────────────────────────────────────────────┐
│  GatewayRunner.run()                                │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐                │
│  │ poll_events  │→ │ msg_handler  │                │
│  │  (per platform)  │  (run.py)    │                │
│  └──────────────┘  └──────┬───────┘                │
│                           ↓                         │
│                  ┌────────────────┐                 │
│                  │ check_running  │→ _AGENT_PENDING  │
│                  │ _is_authorized │   SENTINEL       │
│                  └───────┬────────┘                 │
│                          ↓                          │
│                  ┌────────────────┐                 │
│                  │ run_agent()    │  ← ThreadPool   │
│                  │ (thread)       │    executor      │
│                  └───────┬────────┘                 │
│                          ↓                          │
│                  ┌────────────────┐                 │
│                  │ agent.run_    │                 │
│                  │ conversation() │                 │
│                  └───────┬────────┘                 │
│                          ↓                          │
│                  ┌────────────────┐                 │
│                  │ send_response  │→ platform       │
│                  └────────────────┘                 │
└─────────────────────────────────────────────────────┘
```

---

## Platform Adapters (16 stk)

| Platform | Størrelse | Mode |
|---|---|---|
| Telegram | 2,670 linjer | Poll + Webhook |
| Discord | 2,807 linjer | Webhook |
| Feishu | 3,437 linjer | Webhook |
| Slack | 2,050 linjer | Webhook |
| WhatsApp | 1,900 linjer | Webhook |
| Mattermost | 1,900 linjer | Webhook |
| DingTalk | 1,500 linjer | Webhook |
| WeChat Work | 1,400 linjer | Webhook |
| Email | 1,200 linjer | IMAP/SMTP |
| SMS | 1,100 linjer | HTTP API |
| Signal | 900 linjer | Webhook |
| Matrix | 900 linjer | Client API |
| HomeAssistant | 800 linjer | Webhook |
| API Server | 700 linjer | REST |
| Webhook (generic) | 600 linjer | Incoming webhook |
| Signal | 900 linjer | Webhook |

Alle arver fra `PlatformAdapter` (base.py: 1,682 linjer) med fælles interface:
- `start()`, `stop()`, `disconnect()`
- `send_message()`, `send_image()`, `send_audio()`, `send_video()`
- `send_inline_buttons()`, `send_form()`, `send_album()`

---

## Security Model

### PII Redaction
```python
# Phone numbers
"+45 XX XX XX XX" → "[REDACTED_PHONE]"

# User/Chat IDs
-1001234567890 → hashed(platform, -1001234567890)
```

### Authorization
```
1. Check pairing whitelist (user_ids)
2. If new user → prompt pairing request
3. Pairing requires approval via CLI /hermes pairing
```

### Rate Limiting
- Pairing requests: max 3 per user per 5 min
- Agent sessions: max 1 concurrent per user

---

## Session Management (session.py)

```
SessionStore
├── _sessions: Dict[session_id, SessionState]
├── _session_index: Dict[user_id, session_id]
└── session.json (atomic writes via mkstemp + rename)

SessionState
├── session_id: str
├── platform: str
├── platform_user_id: str
├── messages: List[Message]
├── created_at: timestamp
└── last_active: timestamp
```

**Session lifecycle:**
```
create → add_message → get_messages → flush (when expired)
```

**Expiry watcher** (5 min interval):
- Evicts sessions inactive > 30 min
- Proaktiv memory management

---

## Agent Staleness Detection

To prevent "zombie" agents after client disconnects:

```python
# Two-layer detection:
1. Wall clock: agent.running_for > max_session_seconds
2. Activity: last_message_age > idle_seconds

# Eviction via _STALE_AGENT_SENTINEL
```

---

## Message Flow (Telegram eksempel)

```
1. Long-polling: getUpdates() med offset
   ↓
2. Parse Message → TelegramEvent
   ↓
3. _handle_message(event)
   ├── check_authorization()         ← reject if not paired
   ├── pii_redact()                  ← strip phone, hash IDs
   └── _route_to_agent()             ← session + agent dispatch
   ↓
4. _run_agent(event, session)
   ├── get_or_create_session()
   ├── inject_context()              ← platform info, user info
   ├── RedactionSink                 ← scrub PII from agent output
   └── agent.run_conversation()
   ↓
5. response → send() → Telegram.send_message()
```

---

## Error Handling

**Pattern:** Alle fejl fanges, logges, og gateway fortsætter.

```
_event_loop:
    while running:
        try:
            await poll()
        except Exception:
            log_exc()
            await asyncio.sleep(30)
            continue
```

**Recovery mechanisms:**
- Platform reconnect med exponential backoff (30s → 60s → 120s → 240s → 300s max)
- Checkpoint restart (genindlæser state fra gateway_state.json)
- PID validation (forhindrer stale PID-fils bugs)

---

## Status & Monitoring

### gateway_state.json (skrives hver 30s via heartbeat)
```json
{
  "pid": 12345,
  "start_time": "2026-04-08T...",
  "platforms": {
    "telegram": { "status": "connected", "errors": [] },
    "discord": { "status": "disconnected", "errors": ["auth failed"] }
  },
  "updated_at": "..."
}
```

### Runtime Locks (status.py)
```
telegram-lock-{hash(token)} → acquire_scoped_lock()
Forhindrer: samme bot token brugt fra to forskellige profiler/instanser
```

---

## Statlines

| Metrik | Værdi |
|---|---|
| Total linjer | 33,733 |
| Core engine (run.py) | 7,608 |
| Platform adapters | ~24,000 |
| Base adapter | 1,682 |
| Session store | 1,081 |
| Status tracker | 395 |

---

## Known Characteristics

| Ting | Note |
|---|---|
| 176x `except: pass` | Alle i loops der skal fortsætte — korrekt men urydeligt |
| Session index vokser | `_session_index` ryddes ikke aktivt — sessions.json vokser over tid |
| 30s heartbeat | Kan ikke slås fra — skriver altid til disk |
| Thread pool | Default størrelse — max concurrent agents begrænses af sentinel |
| Token cache | Memory-only, ikke persisted — tabes ved restart |

---

## Tilføj en ny Platform

1. Opret `gateway/platforms/myplatform.py`
2. Arv fra `PlatformAdapter`
3. Implementér: `start()`, `stop()`, `send_message()`, `disconnect()`
4. Tilføj til `ALL_PLATFORMS` dict i `run.py`
5. Tilføj config keys i `gateway_config.py`

Se `ADDING_A_PLATFORM.md` for detaljeret guide.

---

_Last updated: 2026-04-08_
