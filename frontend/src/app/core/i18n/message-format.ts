import { Locale } from './locale';

/**
 * Values a message placeholder can carry. Dates/numbers are formatted by the
 * caller before interpolation — this layer only does text.
 */
export type MessageParams = Record<string, string | number>;

/**
 * Minimal ICU MessageFormat subset — the two constructs the product actually
 * needs, and nothing else:
 *
 *   simple argument   "Hello {name}"
 *   plural            "{count, plural, one {# application} other {# applications}}"
 *   select            "{mode, select, REMOTE {Remote} other {On site}}"
 *
 * A full ICU implementation is a dependency and a parser we would own forever;
 * this is ~100 lines and covers every message in the catalogue. Plural category
 * selection delegates to `Intl.PluralRules`, so adding a locale with a richer
 * plural system (pl, ru, ar) needs new translations, not new code.
 *
 * Unbalanced braces or an unknown argument are left verbatim rather than
 * throwing: a malformed translation must degrade to visible-but-wrong text, it
 * must never break the page that renders it.
 */
export function formatMessage(
  message: string,
  params: MessageParams | undefined,
  locale: Locale,
): string {
  // Fast path for the majority of messages, which are plain text. It must also
  // stand down for the `''` escape, which still needs unescaping.
  if (!message.includes('{') && !message.includes("''")) return message;
  return renderParts(parse(message), params ?? {}, locale, undefined);
}

// ---- AST ----------------------------------------------------------------

type Node =
  | { kind: 'text'; value: string }
  | { kind: 'arg'; name: string }
  | { kind: 'plural'; name: string; branches: Map<string, Node[]> }
  | { kind: 'select'; name: string; branches: Map<string, Node[]> };

/**
 * Recursive-descent parse over the message. `stopAtBrace` is set while parsing
 * a branch body so the scan stops at the branch's own closing brace instead of
 * swallowing the rest of the message.
 */
function parse(input: string): Node[] {
  const [nodes] = parseNodes(input, 0, false);
  return nodes;
}

function parseNodes(
  input: string,
  start: number,
  stopAtBrace: boolean,
): [Node[], number] {
  const nodes: Node[] = [];
  let text = '';
  let i = start;

  const flush = () => {
    if (text) {
      nodes.push({ kind: 'text', value: text });
      text = '';
    }
  };

  while (i < input.length) {
    const char = input[i];

    if (char === "'" && input[i + 1] === "'") {
      // ICU escape for a literal apostrophe.
      text += "'";
      i += 2;
      continue;
    }
    if (char === '}' && stopAtBrace) {
      flush();
      return [nodes, i];
    }
    if (char !== '{') {
      text += char;
      i += 1;
      continue;
    }

    const close = matchingBrace(input, i);
    if (close === -1) {
      // Unbalanced: treat the remainder as literal text.
      text += input.slice(i);
      i = input.length;
      break;
    }

    flush();
    const [node, next] = parsePlaceholder(input, i, close);
    nodes.push(node);
    i = next;
  }

  flush();
  return [nodes, i];
}

/** Parses `{...}` starting at `open`, whose matching brace is at `close`. */
function parsePlaceholder(
  input: string,
  open: number,
  close: number,
): [Node, number] {
  const body = input.slice(open + 1, close);
  const firstComma = body.indexOf(',');

  if (firstComma === -1) {
    return [{ kind: 'arg', name: body.trim() }, close + 1];
  }

  const name = body.slice(0, firstComma).trim();
  const rest = body.slice(firstComma + 1);
  const secondComma = rest.indexOf(',');
  const type = (secondComma === -1 ? rest : rest.slice(0, secondComma)).trim();

  if ((type !== 'plural' && type !== 'select') || secondComma === -1) {
    // Unknown argument type — keep the raw placeholder so it is visibly wrong.
    return [{ kind: 'text', value: input.slice(open, close + 1) }, close + 1];
  }

  const branches = parseBranches(rest.slice(secondComma + 1));
  return [{ kind: type, name, branches }, close + 1];
}

/** Parses `one {…} other {…}` into a keyword → body map. */
function parseBranches(input: string): Map<string, Node[]> {
  const branches = new Map<string, Node[]>();
  let i = 0;

  while (i < input.length) {
    while (i < input.length && /\s/.test(input[i])) i += 1;
    const keyStart = i;
    while (i < input.length && !/[\s{]/.test(input[i])) i += 1;
    const key = input.slice(keyStart, i).trim();
    while (i < input.length && /\s/.test(input[i])) i += 1;

    if (!key || input[i] !== '{') break;

    const [body, end] = parseNodes(input, i + 1, true);
    branches.set(key, body);
    i = end + 1;
  }

  return branches;
}

function matchingBrace(input: string, open: number): number {
  let depth = 0;
  for (let i = open; i < input.length; i += 1) {
    if (input[i] === '{') depth += 1;
    else if (input[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// ---- Rendering ----------------------------------------------------------

const pluralRulesCache = new Map<string, Intl.PluralRules>();

function pluralRules(locale: Locale): Intl.PluralRules {
  let rules = pluralRulesCache.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRulesCache.set(locale, rules);
  }
  return rules;
}

function renderParts(
  nodes: Node[],
  params: MessageParams,
  locale: Locale,
  pluralValue: number | undefined,
): string {
  let out = '';

  for (const node of nodes) {
    switch (node.kind) {
      case 'text':
        // `#` inside a plural branch stands for the locale-formatted count.
        out +=
          pluralValue === undefined
            ? node.value
            : node.value.replaceAll(
                '#',
                new Intl.NumberFormat(locale).format(pluralValue),
              );
        break;

      case 'arg': {
        const value = params[node.name];
        out += value === undefined ? `{${node.name}}` : String(value);
        break;
      }

      case 'plural': {
        const raw = params[node.name];
        const count = typeof raw === 'number' ? raw : Number(raw);
        if (!Number.isFinite(count)) {
          out += `{${node.name}}`;
          break;
        }
        // Exact-value branches (`=0`) win over the language's plural category.
        const branch =
          node.branches.get(`=${count}`) ??
          node.branches.get(pluralRules(locale).select(count)) ??
          node.branches.get('other');
        if (branch) out += renderParts(branch, params, locale, count);
        break;
      }

      case 'select': {
        const value = params[node.name];
        const branch =
          (value !== undefined ? node.branches.get(String(value)) : undefined) ??
          node.branches.get('other');
        if (branch) out += renderParts(branch, params, locale, pluralValue);
        break;
      }
    }
  }

  return out;
}
