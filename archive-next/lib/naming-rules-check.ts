// ponytail: pure deviation check against a DB-backed NamingRule (V1-858).
// Never renames storage — only flags a mismatch and suggests a corrected name.
import type { NamingRule } from "@/lib/archive-api";

export interface NamingCheckResult {
  matches: boolean;
  suggestion: string | null;
}

export function checkFilename(filename: string, rule: NamingRule | null): NamingCheckResult {
  if (!rule || !rule.prefix) return { matches: true, suggestion: null };
  if (filename.startsWith(rule.prefix)) return { matches: true, suggestion: null };
  return { matches: false, suggestion: `${rule.prefix}${filename}` };
}
