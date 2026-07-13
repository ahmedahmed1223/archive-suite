function tokenize(expression) {
  const tokens = String(expression ?? "UNKNOWN").match(/\(|\)|AND\b|OR\b|[^\s()]+/gi) ?? [];
  return tokens.map((token) => (/^(?:AND|OR)$/i.test(token) ? token.toUpperCase() : token));
}

function parse(expression) {
  const tokens = tokenize(expression);
  let position = 0;

  function primary() {
    const token = tokens[position++];
    if (!token || token === "AND" || token === "OR" || token === ")") throw new Error("expected a license identifier");
    if (token !== "(") return { type: "license", value: token };
    const node = orExpression();
    if (tokens[position++] !== ")") throw new Error("expected closing parenthesis");
    return node;
  }

  function andExpression() {
    let node = primary();
    while (tokens[position] === "AND") {
      position += 1;
      node = { type: "and", left: node, right: primary() };
    }
    return node;
  }

  function orExpression() {
    let node = andExpression();
    while (tokens[position] === "OR") {
      position += 1;
      node = { type: "or", left: node, right: andExpression() };
    }
    return node;
  }

  try {
    const tree = orExpression();
    if (position !== tokens.length) throw new Error(`unexpected token ${tokens[position]}`);
    return tree;
  } catch (error) {
    throw new Error(`Invalid SPDX expression "${expression}": ${error.message}`);
  }
}

function evaluate(node, packageName, policy) {
  if (node.type === "license") {
    const exception = policy.exceptions.has(`${packageName}:${node.value}`);
    if (policy.allowed.has(node.value) || exception) return { accepted: true, rejected: [] };
    const kind = policy.forbidden.has(node.value) ? "forbidden" : "unknown";
    return { accepted: false, rejected: [{ kind, license: node.value }] };
  }

  const left = evaluate(node.left, packageName, policy);
  const right = evaluate(node.right, packageName, policy);
  if (node.type === "or") {
    return left.accepted || right.accepted
      ? { accepted: true, rejected: [] }
      : { accepted: false, rejected: [...left.rejected, ...right.rejected] };
  }
  return left.accepted && right.accepted
    ? { accepted: true, rejected: [] }
    : { accepted: false, rejected: [...left.rejected, ...right.rejected] };
}

export function evaluateLicenseExpression(packageName, expression, policy) {
  return evaluate(parse(expression), packageName, policy);
}
