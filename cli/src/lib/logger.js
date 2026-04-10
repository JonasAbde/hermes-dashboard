import chalk from 'chalk';
import ora from 'ora';

export const log = {
  info: (msg) => console.log(chalk.blue('ℹ'), msg),
  success: (msg) => console.log(chalk.green('✔'), msg),
  warn: (msg) => console.log(chalk.yellow('⚠'), msg),
  error: (msg) => console.error(chalk.red('✖'), msg),
  dim: (msg) => console.log(chalk.dim(msg)),
};

export function spinner(text) {
  return ora({ text, color: 'cyan' });
}

export function json(data) {
  console.log(JSON.stringify(data, null, 2));
}

export function header(title) {
  const line = '─'.repeat(50);
  console.log(chalk.cyan(`\n  ${title}`));
  console.log(chalk.dim(line));
}
