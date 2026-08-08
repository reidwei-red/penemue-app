// 副业单的固定 schema。正文与不认识的 frontmatter 行必须原样留下。
const knownKeys = ['type', 'title', 'created', 'updated', 'status', 'tags', 'client', 'platform', 'count', 'price', 'due', 'paid'];
const numericKeys = new Set(['count', 'price']);
const booleanKeys = new Set(['paid']);

function unquote(value) {
  return (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")) ? value.slice(1, -1) : value;
}

function parseValue(key, value) {
  if (key === 'tags') {
    if (value === '[]') return [];
    if (value.startsWith('[') && value.endsWith(']')) return value.slice(1, -1).split(',').map((tag) => unquote(tag.trim())).filter(Boolean);
    return [];
  }
  if (numericKeys.has(key)) return Number(value) || 0;
  if (booleanKeys.has(key)) return value === 'true';
  return unquote(value);
}

export function parseSidework(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)^---(?:\r?\n|$)/m);
  if (!match) return { data: {}, unknownLines: [], body: text };
  const data = {};
  const unknownLines = [];
  for (const line of match[1].split(/\r?\n/)) {
    const colon = line.indexOf(':');
    const key = colon === -1 ? '' : line.slice(0, colon).trim();
    if (!knownKeys.includes(key)) { unknownLines.push(line); continue; }
    data[key] = parseValue(key, line.slice(colon + 1).trim());
  }
  return { data, unknownLines, body: text.slice(match[0].length) };
}

function formatValue(key, value) {
  if (key === 'tags') return `[${(Array.isArray(value) ? value : []).join(', ')}]`;
  if (booleanKeys.has(key)) return value ? 'true' : 'false';
  return String(value ?? '');
}

export function serializeSidework({ data, unknownLines = [], body = '' }) {
  const lines = knownKeys.map((key) => `${key}: ${formatValue(key, data[key])}`);
  const extras = unknownLines.filter((line) => line.trim());
  return `---\n${[...lines, ...extras].join('\n')}\n---\n${body.startsWith('\n') ? body : `\n${body}`}`;
}

export function safeSideworkTitle(title) {
  return String(title).replace(/[\\/:*?"<>|\r\n]+/g, '-').replace(/\s*-\s*/g, '-').replace(/-+/g, '-').trim().replace(/^-|-$/g, '') || '未命名副业';
}

export function sideworkFilename(created, title, existingPaths = []) {
  const stem = `sidework/${created}-${safeSideworkTitle(title)}`;
  const taken = new Set(existingPaths);
  let candidate = `${stem}.md`;
  let index = 2;
  while (taken.has(candidate)) candidate = `${stem}-${index++}.md`;
  return candidate;
}

export const sideworkDefaults = (today) => ({ type: 'sidework', title: '', created: today, updated: today, status: 'active', tags: [], client: '', platform: '', count: 1, price: 0, due: '', paid: false });
