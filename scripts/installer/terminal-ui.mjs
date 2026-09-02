const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const COLORS = { success: '\x1b[32m', warning: '\x1b[33m', error: '\x1b[31m', info: CYAN };

export function useColor({ isTTY = false, NO_COLOR } = {}) {
  return Boolean(isTTY) && NO_COLOR === undefined;
}

export function renderMenu(title, labels, { color = false } = {}) {
  const heading = color ? `${CYAN}${title}${RESET}` : title;
  return [heading, ...labels.map((label, index) => `  ${index + 1}) ${label}`)].join('\n');
}

export function colorize(text, tone, enabled) {
  return enabled && COLORS[tone] ? `${COLORS[tone]}${text}${RESET}` : text;
}

export function safeText(value) {
  return String(value).replaceAll('\x1b', '').replace(/[\x00-\x1f\x7f]/g, ' ');
}

export function parseMenuChoice(answer, values, fallback) {
  const value = answer.trim();
  if (!value && fallback !== undefined) return fallback;
  const index = Number(value) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= values.length) {
    throw new Error(`Enter a number from 1 to ${values.length}.`);
  }
  return values[index];
}

export async function promptUntil(ask, validate, report) {
  while (true) {
    try { return validate(await ask()); }
    catch (error) { report(error.message); }
  }
}
