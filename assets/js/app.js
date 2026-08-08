import { listFiles, parseFrontmatter, readFile, writeFile } from './github-store.js';
import { createTask, parseTasks, serializeTasks } from './tasks.js';

const navItems = [['projects', '项目看板', '看板'], ['inbox', '收集箱', '收集'], ['tasks', '待办', '待办'], ['side', '副业', '副业'], ['topics', '选题', '选题'], ['calendar', '日历', '日历'], ['settings', '设置', '设置']];
const tokenInput = document.querySelector('#token');
const result = document.querySelector('#result');
const tasksStatus = document.querySelector('#tasks-status');
const taskList = document.querySelector('#task-list');
let tasks = [];
let taskBaseline = [];

function showStatus(node, message, kind = '') { node.textContent = message; node.dataset.kind = kind; }
function hasToken() { return Boolean(tokenInput.value.trim()); }
function requireToken(statusNode) { if (hasToken()) return true; showStatus(statusNode, '请先在设置中填写 GitHub 细粒度 PAT。', 'error'); return false; }
function createNav() { for (const nav of document.querySelectorAll('[data-nav]')) for (const [view, label, compactLabel] of navItems) { const button = document.createElement('button'); button.type = 'button'; button.className = 'nav-button'; button.dataset.target = view; button.textContent = nav.classList.contains('bottom-tabs') ? compactLabel : label; nav.append(button); } }
function switchView(view) { for (const element of document.querySelectorAll('.view')) element.classList.toggle('active', element.dataset.view === view); for (const button of document.querySelectorAll('.nav-button')) button.classList.toggle('active', button.dataset.target === view); }
function renderProjects(cards) { const holder = document.querySelector('#project-cards'); holder.replaceChildren(); const fields = ['type', 'created', 'updated', 'status', 'tags', 'repo', 'last_commit_date', 'last_commit_msg', 'next_step']; for (const { file, data } of cards) { const card = document.createElement('article'); card.className = 'project-card'; const title = document.createElement('h2'); title.textContent = data.title || file.name; const list = document.createElement('dl'); for (const field of fields) { const key = document.createElement('dt'); key.textContent = field; const value = document.createElement('dd'); value.textContent = Array.isArray(data[field]) ? data[field].join('、') : (data[field] ?? ''); list.append(key, value); } card.append(title, list); holder.append(card); } }
async function loadProjects() { const status = document.querySelector('#projects-status'); if (!requireToken(status)) return; showStatus(status, '正在读取 projects/ 中的项目卡……'); try { const files = (await listFiles('projects')).filter((file) => file.name.endsWith('.md')); const cards = []; for (const file of files) { const content = await readFile(file.path); cards.push({ file, data: parseFrontmatter(content?.text || '').data }); } renderProjects(cards); showStatus(status, `已读取 ${cards.length} 张项目卡。`, 'success'); } catch (error) { showStatus(status, error.message || String(error), 'error'); } }
function renderTasks() { taskList.replaceChildren(); const taskRecords = tasks.filter((item) => item.kind === 'task'); if (!taskRecords.length) { taskList.textContent = '还没有待办。'; return; } for (const task of taskRecords) { const row = document.createElement('div'); row.className = `task-row${task.completed ? ' completed' : ''}`; const check = document.createElement('input'); check.type = 'checkbox'; check.checked = task.completed; check.setAttribute('aria-label', `完成：${task.title}`); check.addEventListener('change', () => updateTask(task, { completed: check.checked })); const title = document.createElement('div'); title.className = 'task-title'; title.textContent = task.title; const dueLabel = document.createElement('span'); dueLabel.className = 'due-label'; dueLabel.textContent = task.dueDate || '无 DDL'; const expand = document.createElement('button'); expand.type = 'button'; expand.className = 'task-expand-button'; expand.textContent = '编辑'; expand.setAttribute('aria-expanded', 'false'); expand.addEventListener('click', () => { const expanded = row.classList.toggle('expanded'); expand.setAttribute('aria-expanded', String(expanded)); }); row.append(check, title, dueLabel, expand, selectField('due', 'date', task.dueDate, (value) => updateTask(task, { dueDate: value })), selectField('category', 'text', task.category, (value) => updateTask(task, { category: value }), '分类'), priorityField(task), deleteButton(task)); taskList.append(row); } }
function selectField(className, type, value, change, placeholder = '') { const input = document.createElement('input'); input.className = className; input.type = type; input.value = value; input.placeholder = placeholder; input.addEventListener('change', () => change(input.value)); return input; }
function priorityField(task) { const select = document.createElement('select'); select.className = 'priority'; for (const value of ['', '高', '中', '低']) { const option = document.createElement('option'); option.value = value; option.textContent = value || '优先级'; option.selected = value === task.priority; select.append(option); } select.addEventListener('change', () => updateTask(task, { priority: select.value })); return select; }
function deleteButton(task) { const button = document.createElement('button'); button.type = 'button'; button.className = 'icon-button'; button.textContent = '×'; button.setAttribute('aria-label', `删除：${task.title}`); button.addEventListener('click', () => { tasks = tasks.filter((item) => item !== task); saveTasks(); }); return button; }
async function loadTasks() { if (!requireToken(tasksStatus)) return; showStatus(tasksStatus, '正在读取 tasks.md……'); try { const file = await readFile('tasks.md'); tasks = parseTasks(file?.text || ''); taskBaseline = tasks.filter((item) => item.kind === 'task').map((item) => item.raw); renderTasks(); showStatus(tasksStatus, file ? '已读取 tasks.md。' : 'tasks.md 尚不存在；新增待办时会创建。', 'success'); } catch (error) { showStatus(tasksStatus, error.message || String(error), 'error'); } }
function mergeLatestTasks(latestRecords) {
  const localTasks = tasks.filter((item) => item.kind === 'task');
  const unusedLocal = [...localTasks];
  const remainingBaseline = [...taskBaseline];
  const merged = [];
  for (const record of latestRecords) {
    if (record.kind !== 'task') { merged.push(record); continue; }
    const localIndex = unusedLocal.findIndex((item) => item.raw === record.raw);
    if (localIndex !== -1) { merged.push(unusedLocal.splice(localIndex, 1)[0]); remainingBaseline.splice(remainingBaseline.indexOf(record.raw), 1); continue; }
    // 这个任务原本在页面加载时存在、现在却不在本地列表，说明用户从界面删除了它。
    const baselineIndex = remainingBaseline.indexOf(record.raw);
    if (baselineIndex !== -1) { remainingBaseline.splice(baselineIndex, 1); continue; }
    // 读取最新版本后才出现的任务属于外部修改，整行原样保留。
    merged.push(record);
  }
  if (unusedLocal.length && merged.length && !merged.at(-1).ending) merged.at(-1).ending = '\n';
  return [...merged, ...unusedLocal];
}
async function saveTasks() { if (!requireToken(tasksStatus)) return; showStatus(tasksStatus, '正在获取 tasks.md 的最新版本并保存……'); try { const latest = await readFile('tasks.md');
    // 写之前必读最新 sha 和内容；未知行在此次读取中按原位置保留。
    tasks = mergeLatestTasks(parseTasks(latest?.text || ''));
    const nextText = serializeTasks(tasks);
    await writeFile('tasks.md', nextText, latest?.sha);
    // 保存后的规范文本成为下一次编辑的基线，避免连续修改时误判成删除。
    tasks = parseTasks(nextText); taskBaseline = tasks.filter((item) => item.kind === 'task').map((item) => item.raw); renderTasks(); showStatus(tasksStatus, latest ? '已保存 tasks.md。' : '已创建并保存 tasks.md。', 'success');
  } catch (error) { showStatus(tasksStatus, error.message || String(error), 'error'); } }
function updateTask(task, changes) { Object.assign(task, changes); saveTasks(); }

createNav(); tokenInput.value = localStorage.getItem('penemue-github-token') || '';
tokenInput.addEventListener('input', () => localStorage.setItem('penemue-github-token', tokenInput.value.trim()));
document.addEventListener('click', (event) => { const button = event.target.closest('.nav-button'); if (!button) return; switchView(button.dataset.target); if (button.dataset.target === 'tasks') loadTasks(); });
document.querySelector('#load-projects-button').addEventListener('click', loadProjects);
document.querySelector('#new-task-form').addEventListener('submit', (event) => { event.preventDefault(); if (!requireToken(tasksStatus)) return; const data = new FormData(event.currentTarget); tasks.push(createTask({ title: data.get('title'), dueDate: data.get('dueDate'), category: data.get('category'), priority: data.get('priority') })); event.currentTarget.reset(); saveTasks(); });
document.querySelector('#clear-token-button').addEventListener('click', () => { localStorage.removeItem('penemue-github-token'); tokenInput.value = ''; showStatus(result, '已清除这台设备浏览器保存的 token。'); });
document.querySelector('#write-button').addEventListener('click', async () => { if (!requireToken(result)) return; try { const existing = await readFile('test.md'); const content = `Penemue 阶段 0 写入测试。\n写入时间：${new Date().toISOString()}（UTC）。\n这段中文用于验证 UTF-8 Base64 编码没有乱码。\n`; const data = await writeFile('test.md', content, existing?.sha); showStatus(result, `写入成功。\n提交：${data?.commit?.sha || 'GitHub 未返回提交 sha。'}`, 'success'); } catch (error) { showStatus(result, error.message || String(error), 'error'); } });
