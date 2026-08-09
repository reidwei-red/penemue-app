// tasks.md 的解析与序列化。未知行保留原文，避免覆盖 Obsidian 手写内容。
const taskPattern = /^- \[([ x])\](?: (\d{4}-\d{2}-\d{2}))? (.+)$/;

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

// 返回的每一项都保留所在行及其换行符；未修改时可逐字符写回。
export function parseTasks(text) {
  return splitLinesKeepingEndings(text).map(({ line, ending }) => {
    const match = line.match(taskPattern);
    if (!match) return { kind: 'raw', raw: line, ending };
    let title = match[3];
    let priority = '';
    let category = '';
    let plannedDate = '';
    const plannedMatch = title.match(/ ~(\d{4}-\d{2}-\d{2})$/);
    if (plannedMatch) { plannedDate = plannedMatch[1]; title = title.slice(0, -plannedMatch[0].length); }
    const priorityMatch = title.match(/ !([高中低])$/);
    if (priorityMatch) { priority = priorityMatch[1]; title = title.slice(0, -priorityMatch[0].length); }
    const categoryMatch = title.match(/ @([^\s!]+)$/);
    if (categoryMatch) { category = categoryMatch[1]; title = title.slice(0, -categoryMatch[0].length); }
    // 正文在移除可选尾字段后仍必须存在，避免把只有分类的异常行误作待办。
    if (!title) return { kind: 'raw', raw: line, ending };
    return {
      kind: 'task',
      raw: line,
      ending,
      completed: match[1] === 'x',
      dueDate: match[2] || '',
      title,
      category,
      priority,
      plannedDate
    };
  });
}

function taskLine(task) {
  const parts = [`- [${task.completed ? 'x' : ' '}]`];
  if (task.dueDate) parts.push(task.dueDate);
  // 正文不裁剪空格；用户只改日期/状态时，正文的每个字符都应留住。
  parts.push(task.title);
  if (task.category.trim()) parts.push(`@${task.category.trim().replace(/^@/, '')}`);
  if (task.priority) parts.push(`!${task.priority.replace(/^!/, '')}`);
  if (task.plannedDate) parts.push(`~${task.plannedDate}`);
  return parts.join(' ');
}

// 若字段没有变化，直接沿用原始行；只有被界面改动的待办才重建其单行。
export function serializeTasks(records) {
  return records.map((record) => {
    if (record.kind !== 'task') return `${record.raw}${record.ending || ''}`;
    const next = taskLine(record);
    return `${next === record.raw ? record.raw : next}${record.ending || ''}`;
  }).join('');
}

export function createTask(fields = {}) {
  return {
    kind: 'task', raw: '', ending: '\n', completed: false, dueDate: '', title: '', category: '', priority: '', plannedDate: '', ...fields
  };
}
