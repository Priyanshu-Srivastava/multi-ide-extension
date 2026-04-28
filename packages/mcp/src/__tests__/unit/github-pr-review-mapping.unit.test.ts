import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseChangedFilesPayload,
  parsePatchToHunks,
  projectFlowNodes,
} from '../../pr-review';

test('parsePatchToHunks handles null patch for binary files', () => {
  const hunks = parsePatchToHunks('assets/logo.png', null);
  assert.deepEqual(hunks, []);
});

test('parseChangedFilesPayload maps files and classifies tests', () => {
  const changed = parseChangedFilesPayload([
    { filename: 'src/main.ts', patch: '@@ -1,1 +1,2 @@\n-console.log(1)\n+console.log(2)' },
    { filename: 'src/main.test.ts', patch: null },
  ]);

  assert.equal(changed.length, 2);
  assert.equal(changed[0].classification, 'code');
  assert.equal(changed[1].classification, 'test');
  assert.equal(changed[1].hunks.length, 0);
});

test('projectFlowNodes preserves input order and linked traversal edges', () => {
  const nodes = projectFlowNodes(['src/a.ts', 'src/b.ts', 'src/c.ts']);
  assert.equal(nodes.length, 3);
  assert.deepEqual(nodes[0].childNodeIds, ['flow:src/b.ts']);
  assert.deepEqual(nodes[1].childNodeIds, ['flow:src/c.ts']);
  assert.deepEqual(nodes[2].childNodeIds, []);
});
