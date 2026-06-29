// One-shot JSX->TSX migration codemod. Mechanical & format-preserving:
//   1) rename .jsx->.tsx (.js->.ts), add ": any" to untyped params/catch (AST, JSX-safe)
//   2) leave original as a re-export shim
//   3) self-heal the dominant strict residual TS7053 (implicit-any index) by
//      casting the indexed object: OBJ[KEY] -> (OBJ as any)[KEY]
// Usage: node migrate-jsx.mjs <file1.jsx> ...   (skips files whose .tsx already exists)
import ts from "typescript";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, basename, dirname } from "path";

const args = process.argv.slice(2);
const migrated = [], skipped = [], targets = [];

// ---- phase 1: migrate ----
for (const rel of args) {
  const srcPath = resolve(rel);
  const tsPath = srcPath.replace(/\.jsx$/, ".tsx").replace(/\.js$/, ".ts");
  if (existsSync(tsPath)) { targets.push(tsPath); if (!existsSync(srcPath)) {} skipped.push(`${rel}: target exists`); continue; }
  if (!existsSync(srcPath)) { skipped.push(`${rel}: missing`); continue; }
  if (srcPath === tsPath) { skipped.push(`${rel}: not .js/.jsx`); continue; }

  const src = readFileSync(srcPath, "utf8");
  const sf = ts.createSourceFile(srcPath, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const inserts = [];
  const add = (pos, text) => inserts.push({ pos, text });
  const nextNonWs = (pos) => { let i = pos; while (i < src.length && /\s/.test(src[i])) i++; return src[i]; };
  const visit = (node) => {
    if (ts.isParameter(node) && !node.type) {
      const isThis = ts.isIdentifier(node.name) && node.name.text === "this";
      if (!isThis) {
        const arrow = node.parent;
        // A single bare-identifier arrow param is the ONLY unparenthesized form.
        // Detect parens by the char AFTER the name (')' => already parenthesized),
        // not before (the char before may be an enclosing call's '(').
        const noParens = ts.isArrowFunction(arrow) && arrow.parameters.length === 1 &&
          ts.isIdentifier(node.name) && !node.initializer && !node.questionToken &&
          !node.dotDotDotToken && nextNonWs(node.name.end) !== ")";
        if (noParens) { add(node.getStart(sf), "("); add(node.name.end, ": any)"); }
        else add(node.name.end, ": any");
      }
    }
    if (ts.isCatchClause(node) && node.variableDeclaration && !node.variableDeclaration.type)
      add(node.variableDeclaration.name.end, ": any");
    ts.forEachChild(node, visit);
  };
  visit(sf);
  inserts.sort((a, b) => b.pos - a.pos);
  let out = src;
  for (const ins of inserts) out = out.slice(0, ins.pos) + ins.text + out.slice(ins.pos);
  writeFileSync(tsPath, out, "utf8");

  const target = "./" + basename(tsPath);
  const hasDefault = /export\s+default\b/.test(src) || /export\s*\{[^}]*\bdefault\b[^}]*\}/.test(src);
  let shim = `export * from "${target}";\n`;
  if (hasDefault) shim += `export { default } from "${target}";\n`;
  writeFileSync(srcPath, shim, "utf8");
  targets.push(tsPath);
  migrated.push(`${rel} -> ${basename(tsPath)} (${inserts.length} ann${hasDefault ? ", default" : ""})`);
}

// ---- phase 2: heal TS7053 (implicit-any index) in migrated targets ----
const norm = (p) => resolve(p).replace(/\\/g, "/");
const targetSet = new Set(targets.map(norm));
const configPath = resolve("tsconfig.json");
const cfg = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, dirname(configPath));

let healed = 0;
for (let iter = 0; iter < 6; iter++) {
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const diags = ts.getPreEmitDiagnostics(program)
    .filter((d) => (d.code === 7053 || d.code === 2339) && d.file && targetSet.has(norm(d.file.fileName)) && typeof d.start === "number");
  if (!diags.length) break;

  const byFile = new Map();
  for (const d of diags) {
    const k = d.file.fileName;
    if (!byFile.has(k)) byFile.set(k, []);
    byFile.get(k).push(d);
  }
  for (const [fileName, ds] of byFile) {
    const sf = program.getSourceFile(fileName);
    const text = sf.text;
    const findInnermost = (node, pos) => {
      let found = node;
      const walk = (n) => { if (pos >= n.getStart(sf) && pos < n.end) { found = n; ts.forEachChild(n, walk); } };
      ts.forEachChild(node, walk);
      return found;
    };
    const edits = [];
    for (const d of ds) {
      let ea = findInnermost(sf, d.start);
      while (ea && !ts.isElementAccessExpression(ea) && !ts.isPropertyAccessExpression(ea)) ea = ea.parent;
      if (!ea) continue;
      const expr = ea.expression;
      if (ts.isParenthesizedExpression(expr) && ts.isAsExpression(expr.expression)) continue; // already cast
      edits.push({ start: expr.getStart(sf), end: expr.end, text: `(${expr.getText(sf)} as any)` });
    }
    if (!edits.length) continue;
    edits.sort((a, b) => b.start - a.start);
    let out = text, last = Infinity;
    for (const e of edits) {
      if (e.end > last) continue; // skip overlapping
      out = out.slice(0, e.start) + e.text + out.slice(e.end);
      last = e.start;
    }
    writeFileSync(fileName, out, "utf8");
    healed += edits.length;
  }
}

console.log(`MIGRATED ${migrated.length}, HEALED ${healed} index-casts:`);
migrated.forEach((m) => console.log("  " + m));
if (skipped.length) console.log(`SKIPPED ${skipped.length}` + (skipped.length <= 8 ? ":\n  " + skipped.join("\n  ") : ""));
