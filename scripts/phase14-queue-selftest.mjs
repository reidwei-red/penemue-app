import assert from 'node:assert/strict';
import { enqueueWrite } from '../assets/js/write-queue.js';

let sha = 'sha-0';
const writes = []; const setShaValues = []; const getShaValues = [];
let state = [false, false, false, false, false];
const getSha = () => { getShaValues.push(sha); return sha; };
const setSha = (nextSha) => { setShaValues.push(nextSha); sha = nextSha; };
const write = async (path, content, baseSha) => {
  writes.push({ path, content, baseSha });
  return { content: { sha: `sha-${Number(baseSha.slice(4)) + 1}` } };
};

const pending = [];
for (let index = 0; index < 5; index += 1) {
  state[index] = true;
  pending.push(enqueueWrite('phase14-test-tasks.md', () => ({ content: JSON.stringify(state) }), getSha, setSha, write));
}
await Promise.all(pending);

assert.deepEqual(state, [true, true, true, true, true]);
assert.deepEqual(writes.map((entry) => entry.baseSha), ['sha-0', 'sha-1', 'sha-2', 'sha-3', 'sha-4']);
assert.deepEqual(getShaValues, ['sha-0', 'sha-1', 'sha-2', 'sha-3', 'sha-4']);
assert.deepEqual(setShaValues, ['sha-1', 'sha-2', 'sha-3', 'sha-4', 'sha-5']);
assert.ok(writes.every((entry) => entry.content === '[true,true,true,true,true]'));
console.log('production queue: PASS');
console.log(`getSha: ${getShaValues.join(' -> ')}`);
console.log(`write baseSha: ${writes.map((entry) => entry.baseSha).join(' -> ')}`);
console.log(`setSha: ${setShaValues.join(' -> ')}`);
console.log('final state: [true,true,true,true,true]');
