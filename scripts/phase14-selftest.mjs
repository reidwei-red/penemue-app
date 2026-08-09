import assert from 'node:assert/strict';
import { parseFrontmatter } from '../assets/js/github-store.js';
import { replaceNoteBody } from '../assets/js/notes.js';
import { splitLinesKeepingEndings } from '../assets/js/collect.js';

const fields = (newline) => `---${newline}type: note${newline}title: 保留测试${newline}aliases: [别名]${newline}cssclass: wide${newline}updated: 2026-08-08${newline}custom:${newline}  - 原样${newline}---${newline}`;
const cases = [
  { name: 'a. frontmatter LF + 正文 CRLF', text: `${fields('\n')}\r\n正文\r\n第二行\r\n`, expected: `${fields('\n').replace('updated: 2026-08-08', 'updated: 2026-08-09')}\n正文\n第二行\n` },
  { name: 'b. frontmatter CRLF + 正文 LF', text: `${fields('\r\n')}\n正文\n第二行\n`, expected: `${fields('\r\n').replace('updated: 2026-08-08', 'updated: 2026-08-09')}\r\n正文\r\n第二行\r\n` },
  { name: 'c. 全文 CRLF', text: `${fields('\r\n')}\r\n正文\r\n第二行\r\n`, expected: `${fields('\r\n').replace('updated: 2026-08-08', 'updated: 2026-08-09')}\r\n正文\r\n第二行\r\n` },
  { name: 'd. frontmatter 内部含单独 CR', text: '---\ntype: note\ntitle: 保留测试\naliases: [别名]\rcssclass: wide\nupdated: 2026-08-08\ncustom:\n  - 原样\n---\n\n正文\n第二行\n', expected: '---\ntype: note\ntitle: 保留测试\naliases: [别名]\rcssclass: wide\nupdated: 2026-08-09\ncustom:\n  - 原样\n---\n\n正文\n第二行\n' }
];

function legacyReplaceNoteBody(text, body, today) {
  // 上一版残留：结构用 /\r?\n/、输出却用 collect 的逐行拆分，单独 CR 会错位。
  const structural = text.split(/\r?\n/);
  if (structural[0] !== '---') return body;
  const closing = structural.slice(1).findIndex((line) => line === '---');
  if (closing === -1) return body;
  const fmLines = splitLinesKeepingEndings(text).slice(0, closing + 2);
  const newline = fmLines.find(({ ending }) => ending)?.ending || '\n';
  const updatedIndex = fmLines.findIndex(({ line }, index) => index > 0 && /^updated:\s*/.test(line));
  if (updatedIndex === -1) fmLines.splice(fmLines.length - 1, 0, { line: `updated: ${today}`, ending: newline });
  else fmLines[updatedIndex] = { ...fmLines[updatedIndex], line: `updated: ${today}` };
  return `${fmLines.map(({ line, ending }) => `${line}${ending}`).join('')}${body.split(/\r?\n/).join(newline)}`;
}

const beforeFix = process.argv.includes('--before-fix');
let legacyFailures = 0;
for (const entry of cases) {
  // 与应用一致：正文只能从 parseFrontmatter 的真实输出进入保存函数。
  const body = parseFrontmatter(entry.text).body;
  const saved = beforeFix
    ? legacyReplaceNoteBody(entry.text, body, '2026-08-09')
    : replaceNoteBody(entry.text, body, '2026-08-09');
  const passed = saved === entry.expected;
  const frontmatterPreserved = saved.includes(entry.expected.slice(0, entry.expected.lastIndexOf('---') + 3));
  console.log(`${entry.name}: ${passed ? 'PASS' : 'FAIL'}; body=${JSON.stringify(body)}; frontmatter=${frontmatterPreserved ? 'preserved' : 'LOST'}`);
  if (beforeFix) {
    if (!passed) legacyFailures += 1;
  } else {
    assert.equal(saved, entry.expected, `${entry.name} 保存结果不符合预期`);
    assert.equal(frontmatterPreserved, true, `${entry.name} frontmatter 被改动或丢失`);
  }
}
if (beforeFix) {
  assert.ok(legacyFailures >= 1, '旧实现应至少暴露一个混合或 CRLF 换行错误');
  console.log('before-fix: FAIL (expected)');
  process.exitCode = 1;
} else {
  console.log('after-fix: PASS (4/4)');
}
