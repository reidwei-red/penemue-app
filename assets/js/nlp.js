import { daysBetween } from './dates.js';

// 快速录入只处理民用日期字符串，绝不把 YYYY-MM-DD 交给 Date 解析。
function formatCivilDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function splitCivilDate(dateString) {
  const match = String(dateString).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('today 必须是 YYYY-MM-DD。');
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function addCivilDays(dateString, days) {
  const { year, month, day } = splitCivilDate(dateString);
  // 分量构造会按本地日历进位；随后立刻格式化回无时区的纯日期字符串。
  const date = new Date(year, month - 1, day + days);
  return formatCivilDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function weekdayMondayFirst(dateString) {
  const { year, month, day } = splitCivilDate(dateString);
  return (new Date(year, month - 1, day).getDay() + 6) % 7;
}

function monthDayDate(today, month, day) {
  const { year } = splitCivilDate(today);
  const candidate = formatCivilDate(year, month, day);
  return daysBetween(candidate, today) > 0 ? formatCivilDate(year + 1, month, day) : candidate;
}

function removeMatch(text, match) {
  return `${text.slice(0, match.index)}${text.slice(match.index + match[0].length)}`;
}

// 把一句自然语言拆成 tasks.md 现有字段；matched 保留被界面移除的原文片段。
export function parseQuickInput(text, today) {
  const source = String(text || '');
  let remainder = source;
  let dueDate = '';
  let dateMatch = null;
  const weekdayNames = { 一: 0, 二: 1, 三: 2, 四: 3, 五: 4, 六: 5, 日: 6, 天: 6 };
  const datePatterns = [
    { pattern: /大后天/, resolve: () => addCivilDays(today, 3) },
    { pattern: /后天/, resolve: () => addCivilDays(today, 2) },
    { pattern: /明天/, resolve: () => addCivilDays(today, 1) },
    { pattern: /今天/, resolve: () => today },
    { pattern: /([一二三四五六七八九十\d]+)天后/, resolve: (match) => {
      const values = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 三十: 30 };
      const value = /^\d+$/.test(match[1]) ? Number(match[1]) : values[match[1]];
      return Number.isInteger(value) ? addCivilDays(today, value) : '';
    } },
    { pattern: /下周([一二三四五六日天])/, resolve: (match) => addCivilDays(today, 7 - weekdayMondayFirst(today) + weekdayNames[match[1]]) },
    { pattern: /下周/, resolve: () => addCivilDays(today, 7 - weekdayMondayFirst(today)) },
    { pattern: /周末/, resolve: () => addCivilDays(today, (5 - weekdayMondayFirst(today) + 7) % 7) },
    { pattern: /(?:星期|礼拜|周)([一二三四五六日天])/, resolve: (match) => addCivilDays(today, (weekdayNames[match[1]] - weekdayMondayFirst(today) + 7) % 7) },
    { pattern: /(\d{1,2})月(\d{1,2})(?:日|号)/, resolve: (match) => monthDayDate(today, Number(match[1]), Number(match[2])) },
    { pattern: /(\d{1,2})[\/-](\d{1,2})/, resolve: (match) => monthDayDate(today, Number(match[1]), Number(match[2])) }
  ];
  let firstDate = null;
  for (const entry of datePatterns) {
    const match = remainder.match(entry.pattern);
    if (!match) continue;
    const resolved = entry.resolve(match);
    if (!resolved) continue;
    // 规则表的排列只处理同位置的长短词优先；不同位置必须选原文中第一个日期词。
    if (!firstDate || match.index < firstDate.match.index) firstDate = { match, resolved };
  }
  if (firstDate) {
    dueDate = firstDate.resolved;
    dateMatch = { text: firstDate.match[0] };
    remainder = removeMatch(remainder, firstDate.match);
  }

  // 分类和优先级仅识别句尾标记，避免把「联系 @张三」这类正文误当成字段。
  let category = '';
  let priority = '';
  const priorityMatch = remainder.match(/(?:^|\s)!([高中低])\s*$/);
  if (priorityMatch) {
    priority = priorityMatch[1];
    remainder = removeMatch(remainder, priorityMatch);
  }
  const categoryMatch = remainder.match(/(?:^|\s)@([^\s!@]+)\s*$/);
  if (categoryMatch) {
    category = categoryMatch[1];
    remainder = removeMatch(remainder, categoryMatch);
  }
  const title = remainder.trim().replace(/\s{2,}/g, ' ');
  const matched = { date: dateMatch?.text || '', category: category ? `@${category}` : '', priority: priority ? `!${priority}` : '' };
  return { dueDate, title, category, priority, matched };
}
