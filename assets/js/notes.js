// 笔记的 frontmatter 必须按原文保存；这里绝不使用通用字段解析后的数据重建它。
import { splitLinesKeepingEndings } from './collect.js';

export function locateFrontmatter(text) {
  // 结构定位与原始行尾保存共用同一来源，避免混合换行时行号错位。
  const lines = splitLinesKeepingEndings(text);
  if (lines[0]?.line !== '---') return null;
  const closing = lines.slice(1).findIndex(({ line }) => line === '---');
  if (closing === -1) return null;
  const fmLines = lines.slice(0, closing + 2);
  // 保存正文时统一采用 frontmatter 内第一处实际换行；未换行的非法边界不进入这里。
  const newline = fmLines.find(({ ending }) => ending)?.ending || '\n';
  return { newline, fmLines, bodyStartIndex: closing + 2 };
}

export function replaceNoteBody(text, body, today) {
  const located = locateFrontmatter(text);
  if (!located) return body;
  const { newline, fmLines } = located;
  const updatedIndex = fmLines.findIndex(({ line }, index) => index > 0 && /^updated:\s*/.test(line));
  if (updatedIndex === -1) fmLines.splice(fmLines.length - 1, 0, { line: `updated: ${today}`, ending: newline });
  else fmLines[updatedIndex] = { ...fmLines[updatedIndex], line: `updated: ${today}` };
  // parseFrontmatter 会把正文规范为 LF；按任意换行拆开，再恢复原文件的换行风格。
  return `${fmLines.map(({ line, ending }) => `${line}${ending}`).join('')}${body.split(/\r?\n/).join(newline)}`;
}

export function noteFilename(title, existingPaths) {
  const clean = title.trim().replace(/[\\/:*?"<>|]/g, '-') || '未命名笔记';
  const paths = new Set(existingPaths);
  let count = 1;
  let name = `${clean}.md`;
  while (paths.has(`notes/${name}`)) name = `${clean} ${++count}.md`;
  return `notes/${name}`;
}

export function noteSummary(body) {
  return body.split(/\r?\n/).find((line) => line.trim() && !line.trimStart().startsWith('#'))?.trim() || '';
}
