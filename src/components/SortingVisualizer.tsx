import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Select } from "./ui/Select";
import { Slider } from "./ui/Slider";

type Step = {
  array: number[];
  comparing?: [number, number] | null;
  swapping?: [number, number] | null;
  writing?: number | null;
  pivot?: number | null;
  sorted?: number[];
  auxiliary?: number[];
};

type Stats = {
  comparisons: number;
  swaps: number;
  writes: number;
  arrayAccesses: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const swapInPlace = (a: number[], i: number, j: number) => ([a[i], a[j]] = [a[j], a[i]]);
const makeRandomArray = (n: number, min = 5, max = 100) =>
  Array.from({ length: n }, () => Math.floor(Math.random() * (max - min + 1)) + min);

// ==================== CORE ALGORITHMS ====================

function* bubbleSortSteps(input: number[]): Generator<Step, void, unknown> {
  const a = input.slice();
  const n = a.length;

  for (let end = n - 1; end >= 1; end--) {
    let swapped = false;
    for (let i = 0; i < end; i++) {
      yield { array: a.slice(), comparing: [i, i + 1] };
      if (a[i] > a[i + 1]) {
        yield { array: a.slice(), swapping: [i, i + 1] };
        swapInPlace(a, i, i + 1);
        swapped = true;
        yield { array: a.slice(), swapping: [i, i + 1] };
      }
    }
    yield { array: a.slice(), sorted: [end] };
    if (!swapped) {
      yield { array: a.slice(), sorted: Array.from({ length: end }, (_, k) => k) };
      return;
    }
  }
  yield { array: a.slice(), sorted: [0] };
}

function* selectionSortSteps(input: number[]): Generator<Step, void, unknown> {
  const a = input.slice();
  const n = a.length;

  for (let i = 0; i < n - 1; i++) {
    let minIdx = i;
    for (let j = i + 1; j < n; j++) {
      yield { array: a.slice(), comparing: [minIdx, j] };
      if (a[j] < a[minIdx]) {
        minIdx = j;
      }
    }
    if (minIdx !== i) {
      yield { array: a.slice(), swapping: [i, minIdx] };
      swapInPlace(a, i, minIdx);
      yield { array: a.slice(), swapping: [i, minIdx] };
    }
    yield { array: a.slice(), sorted: [i] };
  }
  yield { array: a.slice(), sorted: [n - 1] };
}

function* insertionSortSteps(input: number[]): Generator<Step, void, unknown> {
  const a = input.slice();
  const n = a.length;

  yield { array: a.slice(), sorted: [0] };

  for (let i = 1; i < n; i++) {
    let j = i;
    while (j > 0) {
      yield { array: a.slice(), comparing: [j - 1, j] };
      if (a[j - 1] > a[j]) {
        yield { array: a.slice(), swapping: [j - 1, j] };
        swapInPlace(a, j - 1, j);
        yield { array: a.slice(), swapping: [j - 1, j] };
        j--;
      } else break;
    }
    yield { array: a.slice(), sorted: Array.from({ length: i + 1 }, (_, k) => k) };
  }
}

function* mergeSortSteps(input: number[]): Generator<Step, void, unknown> {
  const a = input.slice();
  const aux = new Array(a.length);

  function* merge(lo: number, mid: number, hi: number): Generator<Step, void, unknown> {
    for (let k = lo; k <= hi; k++) {
      aux[k] = a[k];
    }

    let i = lo;
    let j = mid + 1;

    for (let k = lo; k <= hi; k++) {
      if (i > mid) {
        yield { array: a.slice(), writing: k, auxiliary: aux.slice() };
        a[k] = aux[j++];
      } else if (j > hi) {
        yield { array: a.slice(), writing: k, auxiliary: aux.slice() };
        a[k] = aux[i++];
      } else {
        yield { array: a.slice(), comparing: [i, j], auxiliary: aux.slice() };
        if (aux[j] < aux[i]) {
          yield { array: a.slice(), writing: k, auxiliary: aux.slice() };
          a[k] = aux[j++];
        } else {
          yield { array: a.slice(), writing: k, auxiliary: aux.slice() };
          a[k] = aux[i++];
        }
      }
    }
  }

  function* sort(lo: number, hi: number): Generator<Step, void, unknown> {
    if (lo >= hi) return;
    const mid = Math.floor((lo + hi) / 2);
    yield* sort(lo, mid);
    yield* sort(mid + 1, hi);
    yield* merge(lo, mid, hi);
  }

  yield* sort(0, a.length - 1);
  yield { array: a.slice(), sorted: a.map((_, idx) => idx) };
}

function* quickSortSteps(input: number[]): Generator<Step, void, unknown> {
  const a = input.slice();

  function* partition(lo: number, hi: number): Generator<Step, number, unknown> {
    const pivotVal = a[hi];
    let i = lo;
    yield { array: a.slice(), pivot: hi };

    for (let j = lo; j < hi; j++) {
      yield { array: a.slice(), comparing: [j, hi], pivot: hi };
      if (a[j] < pivotVal) {
        if (i !== j) {
          yield { array: a.slice(), swapping: [i, j], pivot: hi };
          swapInPlace(a, i, j);
          yield { array: a.slice(), swapping: [i, j], pivot: hi };
        }
        i++;
      }
    }

    yield { array: a.slice(), swapping: [i, hi], pivot: hi };
    swapInPlace(a, i, hi);
    yield { array: a.slice(), swapping: [i, hi], pivot: i };
    return i;
  }

  const stack: Array<[number, number]> = [[0, a.length - 1]];

  while (stack.length) {
    const [lo, hi] = stack.pop()!;
    if (lo > hi) continue;

    if (lo === hi) {
      yield { array: a.slice(), sorted: [lo] };
      continue;
    }

    const p: number = (yield* partition(lo, hi)) as number;
    yield { array: a.slice(), sorted: [p] };

    stack.push([lo, p - 1], [p + 1, hi]);
  }

  yield { array: a.slice(), sorted: a.map((_, idx) => idx) };
}

function* heapSortSteps(input: number[]): Generator<Step, void, unknown> {
  const a = input.slice();
  const n = a.length;

  function* siftDown(start: number, end: number): Generator<Step, void, unknown> {
    let root = start;
    while (true) {
      const left = root * 2 + 1;
      if (left > end) return;
      let child = left;
      const right = left + 1;

      if (right <= end) {
        yield { array: a.slice(), comparing: [left, right] };
        if (a[right] > a[left]) child = right;
      }

      yield { array: a.slice(), comparing: [root, child] };
      if (a[child] > a[root]) {
        yield { array: a.slice(), swapping: [root, child] };
        swapInPlace(a, root, child);
        yield { array: a.slice(), swapping: [root, child] };
        root = child;
      } else return;
    }
  }

  for (let start = Math.floor((n - 2) / 2); start >= 0; start--) yield* siftDown(start, n - 1);

  for (let end = n - 1; end >= 1; end--) {
    yield { array: a.slice(), swapping: [0, end] };
    swapInPlace(a, 0, end);
    yield { array: a.slice(), swapping: [0, end] };
    yield { array: a.slice(), sorted: [end] };
    yield* siftDown(0, end - 1);
  }
  yield { array: a.slice(), sorted: [0] };
}

// ==================== ADVANCED ALGORITHMS ====================

function* shellSortSteps(input: number[]): Generator<Step, void, unknown> {
  const a = input.slice();
  const n = a.length;

  for (let gap = Math.floor(n / 2); gap > 0; gap = Math.floor(gap / 2)) {
    for (let i = gap; i < n; i++) {
      const temp = a[i];
      let j = i;

      while (j >= gap) {
        yield { array: a.slice(), comparing: [j - gap, j] };
        if (a[j - gap] > temp) {
          yield { array: a.slice(), swapping: [j - gap, j] };
          a[j] = a[j - gap];
          yield { array: a.slice(), writing: j };
          j -= gap;
        } else break;
      }
      a[j] = temp;
      yield { array: a.slice(), writing: j };
    }
  }
  yield { array: a.slice(), sorted: a.map((_, idx) => idx) };
}

function* cocktailSortSteps(input: number[]): Generator<Step, void, unknown> {
  const a = input.slice();
  let start = 0;
  let end = a.length - 1;
  let swapped = true;

  while (swapped) {
    swapped = false;

    for (let i = start; i < end; i++) {
      yield { array: a.slice(), comparing: [i, i + 1] };
      if (a[i] > a[i + 1]) {
        yield { array: a.slice(), swapping: [i, i + 1] };
        swapInPlace(a, i, i + 1);
        swapped = true;
        yield { array: a.slice(), swapping: [i, i + 1] };
      }
    }

    if (!swapped) break;
    yield { array: a.slice(), sorted: [end] };
    end--;
    swapped = false;

    for (let i = end; i > start; i--) {
      yield { array: a.slice(), comparing: [i - 1, i] };
      if (a[i - 1] > a[i]) {
        yield { array: a.slice(), swapping: [i - 1, i] };
        swapInPlace(a, i - 1, i);
        swapped = true;
        yield { array: a.slice(), swapping: [i - 1, i] };
      }
    }
    yield { array: a.slice(), sorted: [start] };
    start++;
  }

  yield { array: a.slice(), sorted: a.map((_, idx) => idx) };
}

function* combSortSteps(input: number[]): Generator<Step, void, unknown> {
  const a = input.slice();
  const n = a.length;
  let gap = n;
  const shrink = 1.3;
  let sorted = false;

  while (!sorted) {
    gap = Math.floor(gap / shrink);
    if (gap <= 1) {
      gap = 1;
      sorted = true;
    }

    for (let i = 0; i + gap < n; i++) {
      yield { array: a.slice(), comparing: [i, i + gap] };
      if (a[i] > a[i + gap]) {
        yield { array: a.slice(), swapping: [i, i + gap] };
        swapInPlace(a, i, i + gap);
        yield { array: a.slice(), swapping: [i, i + gap] };
        sorted = false;
      }
    }
  }

  yield { array: a.slice(), sorted: a.map((_, idx) => idx) };
}

function* gnomeSortSteps(input: number[]): Generator<Step, void, unknown> {
  const a = input.slice();
  const n = a.length;
  let pos = 0;

  while (pos < n) {
    if (pos === 0) {
      pos++;
    } else {
      yield { array: a.slice(), comparing: [pos - 1, pos] };
      if (a[pos] >= a[pos - 1]) {
        pos++;
      } else {
        yield { array: a.slice(), swapping: [pos - 1, pos] };
        swapInPlace(a, pos, pos - 1);
        yield { array: a.slice(), swapping: [pos - 1, pos] };
        pos--;
      }
    }
  }

  yield { array: a.slice(), sorted: a.map((_, idx) => idx) };
}

function* oddEvenSortSteps(input: number[]): Generator<Step, void, unknown> {
  const a = input.slice();
  const n = a.length;
  let sorted = false;

  while (!sorted) {
    sorted = true;

    for (let i = 1; i < n - 1; i += 2) {
      yield { array: a.slice(), comparing: [i, i + 1] };
      if (a[i] > a[i + 1]) {
        yield { array: a.slice(), swapping: [i, i + 1] };
        swapInPlace(a, i, i + 1);
        yield { array: a.slice(), swapping: [i, i + 1] };
        sorted = false;
      }
    }

    for (let i = 0; i < n - 1; i += 2) {
      yield { array: a.slice(), comparing: [i, i + 1] };
      if (a[i] > a[i + 1]) {
        yield { array: a.slice(), swapping: [i, i + 1] };
        swapInPlace(a, i, i + 1);
        yield { array: a.slice(), swapping: [i, i + 1] };
        sorted = false;
      }
    }
  }

  yield { array: a.slice(), sorted: a.map((_, idx) => idx) };
}

function* cycleSortSteps(input: number[]): Generator<Step, void, unknown> {
  const a = input.slice();
  const n = a.length;

  for (let cycleStart = 0; cycleStart < n - 1; cycleStart++) {
    let item = a[cycleStart];
    let pos = cycleStart;

    for (let i = cycleStart + 1; i < n; i++) {
      yield { array: a.slice(), comparing: [cycleStart, i] };
      if (a[i] < item) pos++;
    }

    if (pos === cycleStart) continue;

    while (item === a[pos]) pos++;

    yield { array: a.slice(), swapping: [cycleStart, pos] };
    [item, a[pos]] = [a[pos], item];
    yield { array: a.slice(), writing: pos };

    while (pos !== cycleStart) {
      pos = cycleStart;

      for (let i = cycleStart + 1; i < n; i++) {
        yield { array: a.slice(), comparing: [cycleStart, i] };
        if (a[i] < item) pos++;
      }

      while (item === a[pos]) pos++;

      yield { array: a.slice(), swapping: [cycleStart, pos] };
      [item, a[pos]] = [a[pos], item];
      yield { array: a.slice(), writing: pos };
    }
  }

  yield { array: a.slice(), sorted: a.map((_, idx) => idx) };
}

// ==================== NON-COMPARISON ALGORITHMS ====================

function* countingSortSteps(input: number[]): Generator<Step, void, unknown> {
  const a = input.slice();
  const n = a.length;
  const max = Math.max(...a);
  const min = Math.min(...a);
  const range = max - min + 1;
  const count = new Array(range).fill(0);
  const output = new Array(n);

  for (let i = 0; i < n; i++) {
    count[a[i] - min]++;
    yield { array: a.slice(), comparing: [i, i] };
  }

  for (let i = 1; i < range; i++) {
    count[i] += count[i - 1];
  }

  for (let i = n - 1; i >= 0; i--) {
    const val = a[i];
    const pos = count[val - min] - 1;
    output[pos] = val;
    count[val - min]--;

    for (let j = 0; j <= i; j++) {
      if (output[j] !== undefined) a[j] = output[j];
    }
    yield { array: a.slice(), writing: pos };
  }

  yield { array: output, sorted: output.map((_, idx) => idx) };
}

function* radixSortSteps(input: number[]): Generator<Step, void, unknown> {
  const a = input.slice();
  const max = Math.max(...a);
  const maxDigits = Math.floor(Math.log10(max)) + 1;

  for (let digit = 0; digit < maxDigits; digit++) {
    const buckets: number[][] = Array.from({ length: 10 }, () => []);
    const divisor = Math.pow(10, digit);

    for (let i = 0; i < a.length; i++) {
      const bucketIndex = Math.floor(a[i] / divisor) % 10;
      buckets[bucketIndex].push(a[i]);
      yield { array: a.slice(), comparing: [i, i] };
    }

    let idx = 0;
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < buckets[i].length; j++) {
        a[idx] = buckets[i][j];
        yield { array: a.slice(), writing: idx };
        idx++;
      }
    }
  }

  yield { array: a.slice(), sorted: a.map((_, idx) => idx) };
}

function* bucketSortSteps(input: number[]): Generator<Step, void, unknown> {
  const a = input.slice();
  const n = a.length;
  const bucketCount = Math.max(1, Math.floor(Math.sqrt(n)));
  const max = Math.max(...a);
  const min = Math.min(...a);
  const bucketSize = Math.ceil((max - min + 1) / bucketCount);

  const buckets: number[][] = Array.from({ length: bucketCount }, () => []);

  for (let i = 0; i < n; i++) {
    const bucketIndex = Math.min(bucketCount - 1, Math.floor((a[i] - min) / bucketSize));
    buckets[bucketIndex].push(a[i]);
    yield { array: a.slice(), comparing: [i, i] };
  }

  let idx = 0;
  for (let i = 0; i < bucketCount; i++) {
    buckets[i].sort((x, y) => x - y);
    for (const val of buckets[i]) {
      a[idx] = val;
      yield { array: a.slice(), writing: idx };
      idx++;
    }
  }

  yield { array: a.slice(), sorted: a.map((_, idx) => idx) };
}

function* pigeonholeSortSteps(input: number[]): Generator<Step, void, unknown> {
  const a = input.slice();
  const n = a.length;
  const min = Math.min(...a);
  const max = Math.max(...a);
  const range = max - min + 1;
  const holes: number[][] = Array.from({ length: range }, () => []);

  for (let i = 0; i < n; i++) {
    holes[a[i] - min].push(a[i]);
    yield { array: a.slice(), comparing: [i, i] };
  }

  let idx = 0;
  for (let i = 0; i < range; i++) {
    for (const val of holes[i]) {
      a[idx] = val;
      yield { array: a.slice(), writing: idx };
      idx++;
    }
  }

  yield { array: a.slice(), sorted: a.map((_, idx) => idx) };
}

// ==================== SLOW/EDUCATIONAL ALGORITHMS ====================

function* bogoSortSteps(input: number[]): Generator<Step, void, unknown> {
  const a = input.slice();
  const n = a.length;

  const isSorted = () => {
    for (let i = 0; i < n - 1; i++) {
      if (a[i] > a[i + 1]) return false;
    }
    return true;
  };

  let attempts = 0;
  const maxAttempts = 5000;

  while (!isSorted() && attempts < maxAttempts) {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      yield { array: a.slice(), swapping: [i, j] };
      swapInPlace(a, i, j);
      yield { array: a.slice(), swapping: [i, j] };
    }

    for (let i = 0; i < n - 1; i++) {
      yield { array: a.slice(), comparing: [i, i + 1] };
    }
    attempts++;
  }

  yield { array: a.slice(), sorted: a.map((_, idx) => idx) };
}

function* stoogeSortSteps(input: number[]): Generator<Step, void, unknown> {
  const a = input.slice();

  function* stooge(lo: number, hi: number): Generator<Step, void, unknown> {
    yield { array: a.slice(), comparing: [lo, hi] };

    if (a[lo] > a[hi]) {
      yield { array: a.slice(), swapping: [lo, hi] };
      swapInPlace(a, lo, hi);
      yield { array: a.slice(), swapping: [lo, hi] };
    }

    if (hi - lo + 1 >= 3) {
      const t = Math.floor((hi - lo + 1) / 3);
      yield* stooge(lo, hi - t);
      yield* stooge(lo + t, hi);
      yield* stooge(lo, hi - t);
    }
  }

  yield* stooge(0, a.length - 1);
  yield { array: a.slice(), sorted: a.map((_, idx) => idx) };
}

function* pancakeSortSteps(input: number[]): Generator<Step, void, unknown> {
  const a = input.slice();
  const n = a.length;

  function* flip(k: number): Generator<Step, void, unknown> {
    let left = 0;
    let right = k;
    while (left < right) {
      yield { array: a.slice(), swapping: [left, right] };
      swapInPlace(a, left, right);
      yield { array: a.slice(), swapping: [left, right] };
      left++;
      right--;
    }
  }

  for (let currSize = n; currSize > 1; currSize--) {
    let maxIdx = 0;
    for (let i = 0; i < currSize; i++) {
      yield { array: a.slice(), comparing: [maxIdx, i] };
      if (a[i] > a[maxIdx]) maxIdx = i;
    }

    if (maxIdx !== currSize - 1) {
      if (maxIdx !== 0) {
        yield* flip(maxIdx);
      }
      yield* flip(currSize - 1);
    }
    yield { array: a.slice(), sorted: [currSize - 1] };
  }

  yield { array: a.slice(), sorted: a.map((_, idx) => idx) };
}

function* slowSortSteps(input: number[]): Generator<Step, void, unknown> {
  const a = input.slice();

  function* slowSort(lo: number, hi: number): Generator<Step, void, unknown> {
    if (lo >= hi) return;

    const mid = Math.floor((lo + hi) / 2);
    yield* slowSort(lo, mid);
    yield* slowSort(mid + 1, hi);

    yield { array: a.slice(), comparing: [mid, hi] };
    if (a[mid] > a[hi]) {
      yield { array: a.slice(), swapping: [mid, hi] };
      swapInPlace(a, mid, hi);
      yield { array: a.slice(), swapping: [mid, hi] };
    }

    yield* slowSort(lo, hi - 1);
  }

  yield* slowSort(0, a.length - 1);
  yield { array: a.slice(), sorted: a.map((_, idx) => idx) };
}

// ==================== PARALLEL/NETWORK SORTS ====================

function* bitonicSortSteps(input: number[]): Generator<Step, void, unknown> {
  const a = input.slice();
  let n = a.length;

  if (n === 0) return;

  const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(n)));
  while (a.length < nextPowerOf2) {
    a.push(Infinity);
  }
  n = a.length;

  function* compAndSwap(i: number, j: number, dir: boolean): Generator<Step, void, unknown> {
    yield { array: a.slice(), comparing: [i, j] };
    if ((a[i] > a[j] && dir) || (a[i] < a[j] && !dir)) {
      yield { array: a.slice(), swapping: [i, j] };
      swapInPlace(a, i, j);
      yield { array: a.slice(), swapping: [i, j] };
    }
  }

  function* bitonicMerge(lo: number, cnt: number, dir: boolean): Generator<Step, void, unknown> {
    if (cnt > 1) {
      const k = Math.floor(cnt / 2);
      for (let i = lo; i < lo + k; i++) {
        yield* compAndSwap(i, i + k, dir);
      }
      yield* bitonicMerge(lo, k, dir);
      yield* bitonicMerge(lo + k, k, dir);
    }
  }

  function* bitonicSort(lo: number, cnt: number, dir: boolean): Generator<Step, void, unknown> {
    if (cnt > 1) {
      const k = Math.floor(cnt / 2);
      yield* bitonicSort(lo, k, true);
      yield* bitonicSort(lo + k, k, false);
      yield* bitonicMerge(lo, cnt, dir);
    }
  }

  yield* bitonicSort(0, n, true);

  const result = a.filter((x) => x !== Infinity);
  yield { array: result, sorted: result.map((_, idx) => idx) };
}

// ==================== ALGORITHM METADATA ====================

const ALGORITHMS = [
  {
    key: "bubble",
    name: "Bubble Sort",
    gen: bubbleSortSteps,
    category: "Cơ bản",
    complexity: {
      time: { best: "O(n)", average: "O(n²)", worst: "O(n²)" },
      space: "O(1)",
      stable: true,
    },
  },
  {
    key: "selection",
    name: "Selection Sort",
    gen: selectionSortSteps,
    category: "Cơ bản",
    complexity: {
      time: { best: "O(n²)", average: "O(n²)", worst: "O(n²)" },
      space: "O(1)",
      stable: false,
    },
  },
  {
    key: "insertion",
    name: "Insertion Sort",
    gen: insertionSortSteps,
    category: "Cơ bản",
    complexity: {
      time: { best: "O(n)", average: "O(n²)", worst: "O(n²)" },
      space: "O(1)",
      stable: true,
    },
  },
  {
    key: "merge",
    name: "Merge Sort",
    gen: mergeSortSteps,
    category: "Cơ bản",
    complexity: {
      time: { best: "O(n log n)", average: "O(n log n)", worst: "O(n log n)" },
      space: "O(n)",
      stable: true,
    },
  },
  {
    key: "quick",
    name: "Quick Sort",
    gen: quickSortSteps,
    category: "Cơ bản",
    complexity: {
      time: { best: "O(n log n)", average: "O(n log n)", worst: "O(n²)" },
      space: "O(log n)",
      stable: false,
    },
  },
  {
    key: "heap",
    name: "Heap Sort",
    gen: heapSortSteps,
    category: "Cơ bản",
    complexity: {
      time: { best: "O(n log n)", average: "O(n log n)", worst: "O(n log n)" },
      space: "O(1)",
      stable: false,
    },
  },
  {
    key: "shell",
    name: "Shell Sort",
    gen: shellSortSteps,
    category: "Nâng cao",
    complexity: {
      time: { best: "O(n log n)", average: "O(n^1.5)", worst: "O(n²)" },
      space: "O(1)",
      stable: false,
    },
  },
  {
    key: "cocktail",
    name: "Cocktail Shaker Sort",
    gen: cocktailSortSteps,
    category: "Nâng cao",
    complexity: {
      time: { best: "O(n)", average: "O(n²)", worst: "O(n²)" },
      space: "O(1)",
      stable: true,
    },
  },
  {
    key: "comb",
    name: "Comb Sort",
    gen: combSortSteps,
    category: "Nâng cao",
    complexity: {
      time: { best: "O(n log n)", average: "O(n²/2^p)", worst: "O(n²)" },
      space: "O(1)",
      stable: false,
    },
  },
  {
    key: "gnome",
    name: "Gnome Sort",
    gen: gnomeSortSteps,
    category: "Nâng cao",
    complexity: {
      time: { best: "O(n)", average: "O(n²)", worst: "O(n²)" },
      space: "O(1)",
      stable: true,
    },
  },
  {
    key: "oddeven",
    name: "Odd-Even Sort",
    gen: oddEvenSortSteps,
    category: "Nâng cao",
    complexity: {
      time: { best: "O(n)", average: "O(n²)", worst: "O(n²)" },
      space: "O(1)",
      stable: true,
    },
  },
  {
    key: "cycle",
    name: "Cycle Sort",
    gen: cycleSortSteps,
    category: "Nâng cao",
    complexity: {
      time: { best: "O(n²)", average: "O(n²)", worst: "O(n²)" },
      space: "O(1)",
      stable: false,
    },
  },
  {
    key: "counting",
    name: "Counting Sort",
    gen: countingSortSteps,
    category: "Không so sánh",
    complexity: {
      time: { best: "O(n+k)", average: "O(n+k)", worst: "O(n+k)" },
      space: "O(k)",
      stable: true,
    },
  },
  {
    key: "radix",
    name: "Radix Sort (LSD)",
    gen: radixSortSteps,
    category: "Không so sánh",
    complexity: {
      time: { best: "O(nk)", average: "O(nk)", worst: "O(nk)" },
      space: "O(n+k)",
      stable: true,
    },
  },
  {
    key: "bucket",
    name: "Bucket Sort",
    gen: bucketSortSteps,
    category: "Không so sánh",
    complexity: {
      time: { best: "O(n+k)", average: "O(n+k)", worst: "O(n²)" },
      space: "O(n+k)",
      stable: true,
    },
  },
  {
    key: "pigeonhole",
    name: "Pigeonhole Sort",
    gen: pigeonholeSortSteps,
    category: "Không so sánh",
    complexity: {
      time: { best: "O(n+k)", average: "O(n+k)", worst: "O(n+k)" },
      space: "O(k)",
      stable: true,
    },
  },
  {
    key: "bogo",
    name: "Bogo Sort",
    gen: bogoSortSteps,
    category: "Chậm / Học thuật",
    complexity: {
      time: { best: "O(n)", average: "O((n+1)!)", worst: "O(∞)" },
      space: "O(1)",
      stable: false,
    },
  },
  {
    key: "stooge",
    name: "Stooge Sort",
    gen: stoogeSortSteps,
    category: "Chậm / Học thuật",
    complexity: {
      time: { best: "O(n^2.7)", average: "O(n^2.7)", worst: "O(n^2.7)" },
      space: "O(n)",
      stable: false,
    },
  },
  {
    key: "pancake",
    name: "Pancake Sort",
    gen: pancakeSortSteps,
    category: "Chậm / Học thuật",
    complexity: {
      time: { best: "O(n)", average: "O(n²)", worst: "O(n²)" },
      space: "O(1)",
      stable: false,
    },
  },
  {
    key: "slow",
    name: "Slow Sort",
    gen: slowSortSteps,
    category: "Chậm / Học thuật",
    complexity: {
      time: { best: "O(n^(log n))", average: "O(n^(log n))", worst: "O(n^(log n))" },
      space: "O(n)",
      stable: false,
    },
  },
  {
    key: "bitonic",
    name: "Bitonic Sort",
    gen: bitonicSortSteps,
    category: "Song song / Mạng",
    complexity: {
      time: { best: "O(log²n)", average: "O(log²n)", worst: "O(log²n)" },
      space: "O(n log²n)",
      stable: false,
    },
  },
] as const;

const CATEGORIES = [
  { name: "Cơ bản", color: "from-blue-500 to-cyan-500" },
  { name: "Nâng cao", color: "from-purple-500 to-pink-500" },
  { name: "Không so sánh", color: "from-green-500 to-emerald-500" },
  { name: "Chậm / Học thuật", color: "from-orange-500 to-red-500" },
  { name: "Song song / Mạng", color: "from-indigo-500 to-violet-500" },
];

export default function SortingVisualizer() {
  const [algoKey, setAlgoKey] = useState<(typeof ALGORITHMS)[number]["key"]>("bubble");
  const algo = useMemo(() => ALGORITHMS.find((x) => x.key === algoKey)!, [algoKey]);

  const [count, setCount] = useState(40);
  const [speed, setSpeed] = useState(50);

  const [initialArray, setInitialArray] = useState<number[]>(() => makeRandomArray(40));
  const [array, setArray] = useState<number[]>(initialArray);

  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const [comparing, setComparing] = useState<[number, number] | null>(null);
  const [swapping, setSwapping] = useState<[number, number] | null>(null);
  const [writing, setWriting] = useState<number | null>(null);
  const [pivot, setPivot] = useState<number | null>(null);
  const [sortedSet, setSortedSet] = useState<Set<number>>(new Set());

  const [stats, setStats] = useState<Stats>({
    comparisons: 0,
    swaps: 0,
    writes: 0,
    arrayAccesses: 0,
  });

  const genRef = useRef<Generator<Step, void, unknown> | null>(null);
  const runIdRef = useRef(0);
  const pausedRef = useRef(false);

  const maxVal = useMemo(() => Math.max(...array, 1), [array]);
  const delayMs = useMemo(() => {
    const s = clamp(speed, 1, 100);
    const maxDelay = 1000;
    const minDelay = 5;
    const t = (s - 1) / 99;
    return Math.round(maxDelay + (minDelay - maxDelay) * t);
  }, [speed]);

  const regenerate = useCallback((n: number) => {
    const next = makeRandomArray(n);
    setInitialArray(next);
    setArray(next);
    setSortedSet(new Set());
    setComparing(null);
    setSwapping(null);
    setWriting(null);
    setPivot(null);
    setStats({ comparisons: 0, swaps: 0, writes: 0, arrayAccesses: 0 });
  }, []);

  useEffect(() => {
    regenerate(count);
  }, [count, regenerate]);

  const applyStep = useCallback((step: Step) => {
    setArray(step.array);
    setComparing(step.comparing ?? null);
    setSwapping(step.swapping ?? null);
    setWriting(step.writing ?? null);
    setPivot(step.pivot ?? null);

    if (step.comparing) {
      setStats((s) => ({ ...s, comparisons: s.comparisons + 1, arrayAccesses: s.arrayAccesses + 2 }));
    }
    if (step.swapping) {
      setStats((s) => ({ ...s, swaps: s.swaps + 1, arrayAccesses: s.arrayAccesses + 4 }));
    }
    if (step.writing !== null && step.writing !== undefined) {
      setStats((s) => ({ ...s, writes: s.writes + 1, arrayAccesses: s.arrayAccesses + 1 }));
    }

    if (step.sorted?.length) {
      setSortedSet((prev) => {
        const next = new Set(prev);
        for (const idx of step.sorted!) next.add(idx);
        return next;
      });
    }
  }, []);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    genRef.current = null;
    setIsRunning(false);
    setIsPaused(false);
    pausedRef.current = false;

    setArray(initialArray);
    setSortedSet(new Set());
    setComparing(null);
    setSwapping(null);
    setWriting(null);
    setPivot(null);
    setStats({ comparisons: 0, swaps: 0, writes: 0, arrayAccesses: 0 });
  }, [initialArray]);

  const start = useCallback(() => {
    runIdRef.current += 1;
    const myRun = runIdRef.current;

    setIsRunning(true);
    setIsPaused(false);
    pausedRef.current = false;

    setSortedSet(new Set());
    setComparing(null);
    setSwapping(null);
    setWriting(null);
    setPivot(null);
    setStats({ comparisons: 0, swaps: 0, writes: 0, arrayAccesses: 0 });

    genRef.current = algo.gen(array.slice());

    const tick = async () => {
      while (true) {
        if (runIdRef.current !== myRun) return;

        if (pausedRef.current) {
          await new Promise((r) => setTimeout(r, 30));
          continue;
        }

        const gen = genRef.current;
        if (!gen) return;

        const { value, done } = gen.next();
        if (done) {
          setIsRunning(false);
          setIsPaused(false);
          pausedRef.current = false;
          setComparing(null);
          setSwapping(null);
          setWriting(null);
          setPivot(null);
          return;
        }

        if (value) applyStep(value);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    };

    void tick();
  }, [algo, array, delayMs, applyStep]);

  const togglePause = useCallback(() => {
    if (!isRunning) return;
    setIsPaused((p) => {
      const next = !p;
      pausedRef.current = next;
      return next;
    });
  }, [isRunning]);

  const barClass = (idx: number) => {
    const base = "transition-all duration-150 ease-out rounded-t";
    const inPair = (pair: [number, number] | null, i: number) => !!pair && (pair[0] === i || pair[1] === i);

    if (sortedSet.has(idx)) return `${base} bg-gradient-to-t from-emerald-500 to-emerald-400 shadow-lg shadow-emerald-500/50`;
    if (inPair(swapping, idx)) return `${base} bg-gradient-to-t from-orange-500 to-orange-400 shadow-lg shadow-orange-500/50`;
    if (inPair(comparing, idx)) return `${base} bg-gradient-to-t from-sky-500 to-sky-400 shadow-lg shadow-sky-500/50`;
    if (writing === idx) return `${base} bg-gradient-to-t from-violet-500 to-violet-400 shadow-lg shadow-violet-500/50`;
    if (pivot === idx) return `${base} bg-gradient-to-t from-fuchsia-500 to-fuchsia-400 shadow-lg shadow-fuchsia-500/50`;
    return `${base} bg-gradient-to-t from-zinc-600 to-zinc-500`;
  };

  const categoryColor = CATEGORIES.find((c) => c.name === algo.category)?.color || "from-zinc-500 to-zinc-600";

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className={`text-5xl font-bold bg-gradient-to-r ${categoryColor} bg-clip-text text-transparent mb-3`}>
            Sorting Algorithm Visualizer
          </h1>
          <p className="text-zinc-400 text-lg">Trực quan hóa 21+ thuật toán sắp xếp với hiệu ứng chuyên nghiệp</p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
          {/* Control Panel */}
          <div className="space-y-4">
            <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <div className={`w-1 h-6 rounded-full bg-gradient-to-b ${categoryColor}`} />
                  Điều khiển
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Algorithm Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-zinc-300">Thuật toán</div>
                    <div className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-400">{algo.category}</div>
                  </div>
                  <Select value={algoKey} onChange={setAlgoKey} disabled={isRunning} className="w-full">
                    {CATEGORIES.map((cat) => (
                      <optgroup key={cat.name} label={cat.name}>
                        {ALGORITHMS.filter((a) => a.category === cat.name).map((a) => (
                          <option key={a.key} value={a.key}>
                            {a.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                </div>

                {/* Array Size */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-zinc-300">Số phần tử</div>
                    <div className="text-sm tabular-nums font-semibold text-zinc-100">{count}</div>
                  </div>
                  <Slider value={count} min={5} max={150} step={5} disabled={isRunning} onChange={(v: number) => setCount(clamp(v, 5, 150))} />
                  <div className="text-xs text-zinc-500">Khuyến nghị: 30-60 phần tử</div>
                </div>

                {/* Speed Control */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-zinc-300">Tốc độ</div>
                    <div className="text-sm tabular-nums font-semibold text-zinc-100">{speed}%</div>
                  </div>
                  <Slider value={speed} min={1} max={100} step={1} onChange={(v: number) => setSpeed(clamp(v, 1, 100))} />
                  <div className="text-xs text-zinc-500">Delay: {delayMs}ms / bước</div>
                </div>

                {/* Control Buttons */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 font-semibold shadow-lg shadow-emerald-500/30"
                    onClick={start}
                    disabled={isRunning}
                  >
                    ▶ Start
                  </Button>
                  <Button className="flex-1 bg-zinc-800 hover:bg-zinc-700 font-semibold" onClick={togglePause} disabled={!isRunning}>
                    {isPaused ? "▶ Resume" : "⏸ Pause"}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button className="flex-1 bg-zinc-800 hover:bg-zinc-700 font-semibold" onClick={reset} disabled={!isRunning && array === initialArray}>
                    ↺ Reset
                  </Button>
                  <Button className="flex-1 bg-zinc-800 hover:bg-zinc-700 font-semibold" onClick={() => regenerate(count)} disabled={isRunning}>
                    🎲 Random
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Complexity Info */}
            <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-lg">Độ phức tạp</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Time Complexity</div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="bg-zinc-800/50 rounded p-2 text-center">
                      <div className="text-xs text-zinc-500 mb-1">Best</div>
                      <div className="font-mono text-emerald-400">{algo.complexity.time.best}</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded p-2 text-center">
                      <div className="text-xs text-zinc-500 mb-1">Average</div>
                      <div className="font-mono text-yellow-400">{algo.complexity.time.average}</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded p-2 text-center">
                      <div className="text-xs text-zinc-500 mb-1">Worst</div>
                      <div className="font-mono text-red-400">{algo.complexity.time.worst}</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-zinc-800/50 rounded p-3">
                  <span className="text-sm text-zinc-400">Space Complexity</span>
                  <span className="font-mono text-sm text-cyan-400">{algo.complexity.space}</span>
                </div>
                <div className="flex items-center justify-between bg-zinc-800/50 rounded p-3">
                  <span className="text-sm text-zinc-400">Stable Sort</span>
                  <span className={`text-sm font-semibold ${algo.complexity.stable ? "text-emerald-400" : "text-orange-400"}`}>
                    {algo.complexity.stable ? "✓ Yes" : "✗ No"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Legend */}
            <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-lg">Chú thích màu</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Legend gradient="from-zinc-600 to-zinc-500" label="Mặc định" />
                  <Legend gradient="from-sky-500 to-sky-400" label="So sánh" />
                  <Legend gradient="from-orange-500 to-orange-400" label="Hoán đổi" />
                  <Legend gradient="from-emerald-500 to-emerald-400" label="Đã xếp" />
                  <Legend gradient="from-violet-500 to-violet-400" label="Ghi/Đặt" />
                  <Legend gradient="from-fuchsia-500 to-fuchsia-400" label="Pivot" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Visualization Area */}
          <div className="space-y-4">
            <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur">
              <CardHeader>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <CardTitle className="text-xl">Visualization</CardTitle>
                  <div className="flex items-center gap-3">
                    <div
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        isRunning ? (isPaused ? "bg-yellow-500/20 text-yellow-400" : "bg-emerald-500/20 text-emerald-400 animate-pulse") : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      {isRunning ? (isPaused ? "⏸ Paused" : "▶ Running") : "⏹ Idle"}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[520px] w-full rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-950 to-zinc-900 p-4 shadow-2xl">
                  <div className="flex h-full w-full items-end gap-[1px]">
                    {array.map((v, idx) => {
                      const hPct = (v / maxVal) * 100;
                      return (
                        <div key={idx} className="flex h-full flex-1 items-end">
                          <div className={barClass(idx)} style={{ height: `${hPct}%`, width: "100%", minHeight: "2px" }} title={`Index: ${idx}, Value: ${v}`} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Current Operations */}
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-zinc-800/50 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-zinc-400">So sánh:</span>
                    <span className="font-mono text-sky-400 font-semibold">{comparing ? `[${comparing[0]}] ↔ [${comparing[1]}]` : "—"}</span>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-zinc-400">Hoán đổi:</span>
                    <span className="font-mono text-orange-400 font-semibold">{swapping ? `[${swapping[0]}] ↔ [${swapping[1]}]` : "—"}</span>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-zinc-400">Ghi/Đặt:</span>
                    <span className="font-mono text-violet-400 font-semibold">{writing !== null ? `[${writing}]` : "—"}</span>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-zinc-400">Pivot:</span>
                    <span className="font-mono text-fuchsia-400 font-semibold">{pivot !== null ? `[${pivot}]` : "—"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Statistics */}
            <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-lg">Thống kê thực thi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatCard label="So sánh" value={stats.comparisons} color="text-sky-400" icon="⚖️" />
                  <StatCard label="Hoán đổi" value={stats.swaps} color="text-orange-400" icon="🔄" />
                  <StatCard label="Ghi" value={stats.writes} color="text-violet-400" icon="✍️" />
                  <StatCard label="Truy cập" value={stats.arrayAccesses} color="text-emerald-400" icon="📊" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ gradient, label }: { gradient: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-4 w-4 rounded bg-gradient-to-br ${gradient} shadow-lg`} />
      <div className="text-zinc-300">{label}</div>
    </div>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${color}`}>{value.toLocaleString()}</div>
    </div>
  );
}
