import { createInterface } from "node:readline";

export function createCli(argv) {
  const args = argv.slice(2);
  const hasFlag = (name) => args.some((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
  const flagValue = (name) => {
    const exact = `--${name}`;
    const prefix = `${exact}=`;
    const inline = args.find((arg) => arg.startsWith(prefix));
    if (inline) return inline.slice(prefix.length);
    const index = args.indexOf(exact);
    return index >= 0 && args[index + 1] && !args[index + 1].startsWith("-") ? args[index + 1] : null;
  };
  return { args, hasFlag, flagValue, command: args.find((arg) => !arg.startsWith("-")) };
}

export function createConsoleUi({ input = process.stdin, stdout = process.stdout, sink = console } = {}) {
  const C = { g: "\x1b[32m", y: "\x1b[33m", r: "\x1b[31m", c: "\x1b[36m", b: "\x1b[1m", d: "\x1b[2m", x: "\x1b[0m" };
  const log = (message = "") => sink.log(`  ${message}`);
  const ok = (message) => sink.log(`  ${C.g}OK${C.x}  ${message}`);
  const warn = (message) => sink.log(`  ${C.y}!!${C.x}  ${message}`);
  const err = (message) => sink.error(`  ${C.r}xx${C.x}  ${message}`);
  const titleLine = (message) => sink.log(`\n${C.b}${C.c}${message}${C.x}\n`);
  const hr = () => sink.log(`${C.d}${"-".repeat(60)}${C.x}`);
  let reader = null;
  const readline = () => {
    if (!reader) reader = createInterface({ input, output: stdout });
    return reader;
  };
  const ask = (question, defaultValue = "") => new Promise((resolve) =>
    readline().question(`  ${C.c}?${C.x} ${question}${defaultValue ? ` ${C.y}(${defaultValue})${C.x}` : ""}: `, (answer) => resolve(answer.trim() || defaultValue))
  );
  const confirm = async (question, defaultValue = "n") => (await ask(`${question} ${C.d}(y/n)${C.x}`, defaultValue)).toLowerCase().startsWith("y");
  const printBanner = () => {
    const width = 48;
    const edge = (left, right) => `  ${C.c}${left}${"─".repeat(width)}${right}${C.x}`;
    const row = (text, style) => `  ${C.c}│${C.x} ${style}${text}${C.x}${" ".repeat(Math.max(0, width - 1 - text.length))}${C.c}│${C.x}`;
    sink.log("");
    sink.log(edge("╭", "╮"));
    sink.log(row("Masar — Control Center", C.b));
    sink.log(row("Install · Operate · Configure · Maintain", C.d));
    sink.log(row("Laravel API + Next.js", C.d));
    sink.log(edge("╰", "╯"));
    sink.log("");
  };
  const printMenu = (menu) => {
    for (const row of menu) {
      if (row[0] === "sec") {
        if (row[1]) sink.log(`\n  ${C.b}${C.c}${row[1]}${C.x}`);
        continue;
      }
      log(`${C.c}${C.b}${row[0].padStart(2)}${C.x}) ${row[1]}`);
    }
    sink.log("");
    hr();
  };
  return { C, log, ok, warn, err, titleLine, hr, ask, confirm, close: () => reader?.close(), printBanner, printMenu };
}
