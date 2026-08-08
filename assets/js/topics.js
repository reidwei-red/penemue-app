// topics.md 的逐行解析与序列化；不符合固定格式的行绝不改写。
const topicPattern = /^- \[([ x])\] (.+)$/;
const statuses = new Set(['待写', '写中', '已发']);

function splitLinesKeepingEndings(text) {
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

export function parseTopics(text) {
  return splitLinesKeepingEndings(text).map(({ line, ending }) => {
    const match = line.match(topicPattern);
    if (!match) return { kind: 'raw', raw: line, ending };
    let title = match[2];
    let status = '';
    let platform = '';
    const statusMatch = title.match(/ #([^\s]+)$/);
    if (statusMatch && statuses.has(statusMatch[1])) { status = statusMatch[1]; title = title.slice(0, -statusMatch[0].length); }
    const platformMatch = title.match(/ @([^\s#]+)$/);
    if (platformMatch) { platform = platformMatch[1]; title = title.slice(0, -platformMatch[0].length); }
    if (!title) return { kind: 'raw', raw: line, ending };
    return { kind: 'topic', raw: line, ending, completed: match[1] === 'x', title, platform, status };
  });
}

export function serializeTopics(records) {
  return records.map((record) => {
    if (record.kind !== 'topic') return `${record.raw}${record.ending || ''}`;
    const parts = [`- [${record.completed ? 'x' : ' '}]`, record.title];
    if (record.platform.trim()) parts.push(`@${record.platform.trim().replace(/^@/, '')}`);
    if (record.status) parts.push(`#${record.status.replace(/^#/, '')}`);
    const line = parts.join(' ');
    return `${line === record.raw ? record.raw : line}${record.ending || ''}`;
  }).join('');
}

export function createTopic(fields = {}) {
  return { kind: 'topic', raw: '', ending: '\n', completed: false, title: '', platform: '', status: '待写', ...fields };
}
