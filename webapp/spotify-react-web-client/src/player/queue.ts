// Pure queue / shuffle / repeat logic (no React, Redux or DOM) so it can be unit-tested.

export type RepeatMode = 'off' | 'all' | 'one';

export const sequential = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

/** Fisher–Yates shuffle of 0..n-1 that keeps `first` at position 0 (pass -1 for a plain shuffle). */
export function shuffledOrder(n: number, first: number, rng: () => number = Math.random): number[] {
  const rest = sequential(n).filter((i) => i !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = rest[i];
    rest[i] = rest[j];
    rest[j] = tmp;
  }
  return first >= 0 && first < n ? [first, ...rest] : rest;
}

export type Step = { kind: 'go'; position: number } | { kind: 'end' } | { kind: 'none' };

/**
 * Where should "next" go?
 * - `auto` = the track ended by itself (manual skips never stop at the end unless repeat is off).
 * - skips entries that are not playable.
 * - 'go'   → jump to `position`; 'end' → queue finished (auto only); 'none' → nothing playable.
 */
export function nextPosition(
  order: number[],
  index: number,
  repeat: RepeatMode,
  isPlayable: (queueIndex: number) => boolean,
  auto: boolean
): Step {
  const n = order.length;
  if (n === 0) return { kind: 'none' };
  for (let step = 1; step <= n; step++) {
    let pos = index + step;
    if (pos >= n) {
      if (repeat !== 'all') return auto ? { kind: 'end' } : { kind: 'none' };
      pos %= n;
    }
    if (isPlayable(order[pos])) return { kind: 'go', position: pos };
  }
  return { kind: 'none' };
}

/** Where should "previous" go? 'none' means: there is nothing before – restart the current track. */
export function previousPosition(
  order: number[],
  index: number,
  repeat: RepeatMode,
  isPlayable: (queueIndex: number) => boolean
): Step {
  const n = order.length;
  if (n === 0) return { kind: 'none' };
  for (let step = 1; step <= n; step++) {
    let pos = index - step;
    if (pos < 0) {
      if (repeat !== 'all') return { kind: 'none' };
      pos += n;
    }
    if (isPlayable(order[pos])) return { kind: 'go', position: pos };
  }
  return { kind: 'none' };
}

/**
 * Removes the play-order entry at `position` and re-indexes. `queueLength` is the length of the
 * queue *before* the removal. Returns the new order and index (the current entry cannot be removed).
 */
export function removeFromOrder(
  order: number[],
  index: number,
  position: number
): { order: number[]; index: number; removedQueueIndex: number } | null {
  if (position < 0 || position >= order.length || position === index) return null;
  const removedQueueIndex = order[position];
  const next = order
    .filter((_, i) => i !== position)
    .map((qi) => (qi > removedQueueIndex ? qi - 1 : qi));
  return { order: next, index: position < index ? index - 1 : index, removedQueueIndex };
}
