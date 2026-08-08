// GitHub Contents API 的通用数据访问层。这里不保存 token，只在请求时读取浏览器已保存的值。
const OWNER = 'reidwei-red';
const REPO = 'penemue';
const API_BASE = `https://api.github.com/repos/${OWNER}/${REPO}/contents`;

// 所有请求共用同一套认证和 API 版本请求头。
function createHeaders() {
  const token = globalThis.localStorage?.getItem('penemue-github-token')?.trim();
  if (!token) {
    throw new Error('请先填写 GitHub 细粒度 PAT。');
  }

  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

// 把常见 HTTP 状态翻成便于排查的中文提示。
function explainStatus(status) {
  const explanations = {
    401: 'token 无效或已过期。',
    403: '权限不足或触发限流。',
    404: '文件或目录不存在，或者 token 未被授权访问这个仓库。',
    409: 'sha 冲突：文件已被别处改动，请重试。'
  };
  return explanations[status] || 'GitHub 未完成这次请求，请查看原始 message。';
}

// 从失败响应中尽量读取 GitHub 的原始 message，读取失败时也保留说明。
async function readError(response) {
  let payload = {};
  try {
    payload = await response.json();
  } catch (_) {
    payload = { message: 'GitHub 返回的内容不是 JSON，无法读取详细信息。' };
  }
  return `HTTP ${response.status}：${payload.message || 'GitHub 未提供 message。'}\n${explainStatus(response.status)}`;
}

// 统一处理请求、认证和非成功响应，避免三个公开函数各写一遍。
async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(path).replaceAll('%2F', '/')}`, {
    ...options,
    headers: createHeaders()
  });
  return response;
}

// 将任意 Unicode 文本转为 UTF-8 字节后再 Base64，中文不会乱码或抛异常。
export function encodeUtf8Base64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

// GitHub 的 Base64 可能含换行；atob 后必须从字节串用 UTF-8 解码，不能直接当文本使用。
export function decodeBase64Utf8(base64) {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

// 列出一个目录中的普通文件；目录不存在时按空目录处理。
export async function listFiles(dir) {
  const response = await request(dir);
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(await readError(response));

  const entries = await response.json();
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry) => entry.type === 'file')
    .map(({ name, path, sha, type }) => ({ name, path, sha, type }));
}

// 读取一个文件并解码为 UTF-8 文本；文件不存在时返回 null。
export async function readFile(path) {
  const response = await request(path);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await readError(response));

  const file = await response.json();
  return { text: decodeBase64Utf8(file.content || ''), sha: file.sha };
}

// 写入一个文件：没有 sha 时新建，提供 sha 时更新已有文件。
export async function writeFile(path, content, sha) {
  const body = {
    message: `Penemue：更新 ${path}`,
    content: encodeUtf8Base64(content),
    branch: 'main'
  };
  if (sha) body.sha = sha;

  const response = await request(path, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

// 只解析 Penemue 固定格式的 frontmatter，不把它当作通用 YAML。
export function parseFrontmatter(text) {
  const knownKeys = new Set([
    'type', 'title', 'created', 'updated', 'status', 'tags', 'repo',
    'last_commit_date', 'last_commit_msg', 'next_step'
  ]);
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') return { data: {}, body: text };

  const closingIndex = lines.slice(1).findIndex((line) => line === '---');
  if (closingIndex === -1) return { data: {}, body: text };

  const data = {};
  const frontmatterLines = lines.slice(1, closingIndex + 1);
  for (let index = 0; index < frontmatterLines.length; index += 1) {
    const line = frontmatterLines[index];
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    if (!knownKeys.has(key)) continue;

    let value = line.slice(colonIndex + 1).trim();
    if (key === 'tags') {
      // 标签只接受固定的三种形态：空数组、行内数组、或 Obsidian 属性面板写出的缩进列表。
      if (value === '[]') {
        value = [];
      } else if (value.startsWith('[') && value.endsWith(']')) {
        const items = value.slice(1, -1).trim();
        value = items
          ? items.split(',').map((item) => {
            const tag = item.trim();
            // 手写行内数组时允许每个标签各自使用单引号或双引号。
            if ((tag.startsWith('"') && tag.endsWith('"')) || (tag.startsWith("'") && tag.endsWith("'"))) {
              return tag.slice(1, -1);
            }
            return tag;
          })
          : [];
      } else if (value === '') {
        value = [];
        while (/^\s+-\s+/.test(frontmatterLines[index + 1] || '')) {
          const tag = frontmatterLines[index + 1].replace(/^\s+-\s+/, '').trim();
          // Obsidian 多行列表里的标签也可以带引号，和行内数组保持同一结果。
          value.push(
            (tag.startsWith('"') && tag.endsWith('"')) || (tag.startsWith("'") && tag.endsWith("'"))
              ? tag.slice(1, -1)
              : tag
          );
          index += 1;
        }
      }
    } else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }

  return { data, body: lines.slice(closingIndex + 2).join('\n') };
}
