// 项目卡只允许替换 next_step 与 updated；其他 frontmatter 和正文逐字符保留。
export function updateProjectNextStep(text, nextStep, updated) {
  const lines = text.match(/.*(?:\r\n|\n|\r|$)/g) || [];
  if (!lines.length || !lines[0].replace(/\r?\n$/, '').match(/^---$/)) return text;
  let closing = -1;
  for (let index = 1; index < lines.length; index += 1) if (lines[index].replace(/\r?\n$/, '') === '---') { closing = index; break; }
  if (closing === -1) return text;
  const ending = lines[0].match(/\r\n|\n|\r/)?.[0] || '\n';
  const replaceLine = (key, value) => {
    const index = lines.slice(1, closing).findIndex((line) => line.startsWith(`${key}:`));
    if (index === -1) { lines.splice(closing, 0, `${key}: ${value}${ending}`); closing += 1; }
    else lines[index + 1] = `${key}: ${value}${lines[index + 1].match(/\r\n|\n|\r/)?.[0] || ending}`;
  };
  replaceLine('next_step', String(nextStep).replace(/[\r\n]+/g, ' '));
  replaceLine('updated', updated);
  return lines.join('');
}
