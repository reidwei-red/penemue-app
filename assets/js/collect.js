// collect.md 的逐行解析与序列化；标题、引用和杂记等未知行必须原样保留。
const collectPattern = /^- \[([ x])\] (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) (.+)$/;

export function splitLinesKeepingEndings(text) {
  const pieces = [];
  const matcher = /([^\r\n]*)(\r\n|\n|\r|$)/g;
  let match;
  while ((match = matcher.exec(text)) !== null) {
    if (match[0] === '' && matcher.lastIndex === text.length) break;
    pieces.push({ line: match[1], ending: match[2] });
    if (match[2] === '') break;
  }
  return pieces;
}

export function parseCollect(text) {
  return splitLinesKeepingEndings(text).map(({ line, ending }) => {
    const match = line.match(collectPattern);
    if (!match) return { kind: 'raw', raw: line, ending };
    return { kind: 'collect', raw: line, ending, completed: match[1] === 'x', createdAt: match[2], content: match[3] };
  });
}

export function serializeCollect(records) {
  return records.map((record) => {
    if (record.kind !== 'collect') return `${record.raw}${record.ending || ''}`;
    const line = `- [${record.completed ? 'x' : ' '}] ${record.createdAt} ${record.content}`;
    return `${line === record.raw ? record.raw : line}${record.ending || ''}`;
  }).join('');
}

export function localEventTime(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}`;
}

export function createCollect(content, now = new Date()) {
  return { kind: 'collect', raw: '', ending: '\n', completed: false, createdAt: localEventTime(now), content: String(content) };
}
