// 每个文件一条 Promise 链：同一文件严格串行，不同文件仍可并行。
const queues = new Map();

export function enqueueWrite(path, buildContent, getSha, setSha, write) {
  const previous = queues.get(path) || Promise.resolve();
  const next = previous.then(async () => {
    const { content, sha = getSha() } = buildContent();
    const data = await write(path, content, sha);
    setSha(data?.content?.sha || sha);
    return data;
  });
  // 失败会让随后链条短路；catch 只用于让下一轮操作能重新建立一条链。
  queues.set(path, next.catch(() => {}));
  return next;
}
