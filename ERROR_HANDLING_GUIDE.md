# Error Handling Pattern - Hermes CLI

## Standard Error Handler

Every command file should use this pattern:

```javascript
import { log, json } from '../lib/logger.js';

export default async function commandName(opts) {
  // 1. Validate options
  // 2. Execute command

  try {
    // Command logic here
    // ...

    // Success case
    if (opts.json) {
      json({ ok: true, data: result });
      return;
    }

    // Success message
    log.success('Command completed successfully');

  } catch (error) {
    // Error case
    if (opts.json) {
      json({
        ok: false,
        error: error.message,
        code: error.code || 'COMMAND_FAILED',
        details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      });
      process.exit(2);
    }

    log.error(`Command failed: ${error.message}`);
    if (process.env.DEBUG) {
      log.dim(error.stack || '');
    }
    process.exit(2);
  }
}
```

## Error Messages

Use meaningful error messages:

- **Not actionable:** "Command failed" (too vague)
- **Good:** "Failed to start API: Connection refused on port 5174"
- **Better:** "Failed to start API: No connection - check if service is already running on port 5174"

## Common Error Codes

- `COMMAND_FAILED` - General command failure
- `INVALID_OPTIONS` - User provided invalid combination of flags
- `ENVIRONMENT_ERROR` - Missing or invalid environment variables
- `SERVICE_ERROR` - Service control operation failed
- `NETWORK_ERROR` - Network-related operation failed
- `VALIDATION_ERROR` - Input validation failed

## Logging Levels

- `log.success()` - Informational success messages
- `log.error()` - Error messages with red color
- `log.warn()` - Warning messages (recoverable issues)
- `log.info()` - General informational messages
- `log.dim()` - Dim/secondary information

## JSON Output

All commands should output valid JSON when `--json` flag is used:

```json
{
  "ok": true,
  "data": { ... }
}
```

or for errors:

```json
{
  "ok": false,
  "error": "Error message",
  "code": "COMMAND_FAILED"
}
```

## Examples

See existing implementations:
- `cli/src/commands/health.js` - Clean error handling pattern
- `cli/src/commands/stop.js` - Command with option validation

## Testing

All error paths should be tested:
```javascript
it('handles errors correctly', async () => {
  // Mock error scenario
  const r = runJson('command --invalid-option');
  assert.equal(r.exitCode, 2);
  assert.equal(r.data.ok, false);
  assert.match(r.data.error, /expected pattern/);
});
```
