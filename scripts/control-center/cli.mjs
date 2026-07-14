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
