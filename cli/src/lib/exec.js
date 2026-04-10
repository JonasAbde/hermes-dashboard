import { log, spinner, json } from './logger.js';

// Run a function with a spinner (human mode) or silently (JSON mode)
// Returns the result of fn()
export async function withSpinner(text, opts, fn) {
  let s;
  if (!opts?.json) {
    s = spinner(text);
    s.start();
  }
  try {
    const result = await fn(s);
    if (s) s.succeed(text + ' done');
    return result;
  } catch (e) {
    if (s) s.fail(text + ' failed');
    throw e;
  }
}

// Helper: collect JSON output, print and optionally exit
export function jsonOrHuman(opts, data, humanFn) {
  if (opts?.json) {
    json(data);
  } else if (humanFn) {
    humanFn(data);
  }
  return data;
}
