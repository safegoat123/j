import assert from 'node:assert/strict';
import { test } from 'node:test';

import { nextPosition, previousPosition, removeFromOrder, sequential, shuffledOrder } from './queue';

const allPlayable = () => true;

test('shuffledOrder is a permutation and keeps the first track in front', () => {
  for (let first = 0; first < 6; first++) {
    const order = shuffledOrder(6, first);
    assert.equal(order[0], first);
    assert.deepEqual([...order].sort(), sequential(6));
  }
  assert.deepEqual([...shuffledOrder(5, -1)].sort(), sequential(5));
  assert.deepEqual(shuffledOrder(0, -1), []);
});

test('shuffledOrder is deterministic with a fixed rng and really reorders', () => {
  let seed = 7;
  const rng = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const a = shuffledOrder(20, 3, rng);
  assert.notDeepEqual(a, [3, ...sequential(20).filter((i) => i !== 3)]);
});

test('next: plain advance, end of queue, wrap with repeat all', () => {
  const order = [0, 1, 2];
  assert.deepEqual(nextPosition(order, 0, 'off', allPlayable, false), { kind: 'go', position: 1 });
  assert.deepEqual(nextPosition(order, 2, 'off', allPlayable, true), { kind: 'end' });
  assert.deepEqual(nextPosition(order, 2, 'off', allPlayable, false), { kind: 'none' });
  assert.deepEqual(nextPosition(order, 2, 'all', allPlayable, true), { kind: 'go', position: 0 });
  assert.deepEqual(nextPosition([], -1, 'all', allPlayable, true), { kind: 'none' });
});

test('next skips unplayable entries and gives up when nothing is playable', () => {
  const order = [0, 1, 2, 3];
  const playable = (qi: number) => qi === 3; // only the last one can be decoded
  assert.deepEqual(nextPosition(order, 0, 'off', playable, true), { kind: 'go', position: 3 });
  assert.deepEqual(nextPosition(order, 3, 'all', () => false, true), { kind: 'none' });
});

test('next honours shuffled order (positions, not queue indices)', () => {
  const order = [2, 0, 1];
  const playable = (qi: number) => qi !== 0; // queue item 0 is unplayable
  assert.deepEqual(nextPosition(order, 0, 'off', playable, false), { kind: 'go', position: 2 });
});

test('previous: goes back, wraps only with repeat all, otherwise asks to restart', () => {
  const order = [0, 1, 2];
  assert.deepEqual(previousPosition(order, 2, 'off', allPlayable), { kind: 'go', position: 1 });
  assert.deepEqual(previousPosition(order, 0, 'off', allPlayable), { kind: 'none' });
  assert.deepEqual(previousPosition(order, 0, 'all', allPlayable), { kind: 'go', position: 2 });
});

test('removeFromOrder re-indexes the queue and never removes the current entry', () => {
  // order positions: 0->q2, 1->q0, 2->q1 ; current position = 1 (q0)
  const r = removeFromOrder([2, 0, 1], 1, 0);
  assert.ok(r);
  assert.deepEqual(r.order, [0, 1]); // q2 removed: q0 stays 0, q1 stays 1
  assert.equal(r.index, 0); // current entry moved up one position
  assert.equal(r.removedQueueIndex, 2);

  const r2 = removeFromOrder([0, 1, 2], 0, 1); // remove q1, current is q0 at position 0
  assert.ok(r2);
  assert.deepEqual(r2.order, [0, 1]); // q2 became q1
  assert.equal(r2.index, 0);

  assert.equal(removeFromOrder([0, 1, 2], 1, 1), null); // current entry
  assert.equal(removeFromOrder([0, 1, 2], 1, 9), null); // out of range
});
