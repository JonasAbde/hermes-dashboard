import { createInterface } from 'readline';

export async function confirm(message, opts = {}) {
  if (opts.force || opts.yes) return true;
  if (opts.json) return true; // Skip confirmation in JSON mode

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}
