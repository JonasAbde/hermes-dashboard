export const SCHEMA_VERSION = '1.0';

export function buildCommandResult({
  command,
  status = 'ok',
  ok = true,
  error = null,
  payload = {},
}) {
  return {
    schema_version: SCHEMA_VERSION,
    command,
    status,
    ok,
    timestamp: new Date().toISOString(),
    error: error ? normalizeError(error) : null,
    ...payload,
  };
}

export function buildErrorResult(command, error, details = {}, status = 'error') {
  return buildCommandResult({
    command,
    status,
    ok: false,
    error,
    payload: { details },
  });
}

function normalizeError(error) {
  if (!error) return null;

  if (typeof error === 'string') {
    return { message: error };
  }

  return {
    message: error.message || String(error),
    code: error.code || null,
    type: error.name || 'Error',
  };
}
