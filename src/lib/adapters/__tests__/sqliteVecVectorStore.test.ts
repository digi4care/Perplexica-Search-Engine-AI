import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteVecVectorStore } from '../sqliteVecVectorStore';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EMBEDDING_DIM = 1536;

/** Generate a mostly-zero embedding with a few seeded values for controllable distances. */
const makeEmbedding = (seed: number): number[] => {
  const vec = new Array(EMBEDDING_DIM).fill(0);
  vec[0] = seed;
  vec[1] = seed * 0.5;
  return vec;
};

const makeChunks = (
  n: number,
  opts?: { docId?: string; baseSeed?: number },
) =>
  Array.from({ length: n }, (_, i) => ({
    content: `chunk ${i}`,
    embedding: makeEmbedding((opts?.baseSeed ?? 1) + i),
    metadata: {
      title: `${opts?.docId ?? 'doc'}-${i}`,
      url: `http://example.com/${i}`,
    },
  }));

let tmpDir: string;
let dbPath: string;
let store: SqliteVecVectorStore;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vec-test-'));
  dbPath = path.join(tmpDir, 'test.sqlite');
  store = new SqliteVecVectorStore(dbPath);
});

afterEach(() => {
  // Database is opened by store; close it by best-effort cleanup.
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // Windows may hold a lock — ignore.
  }
});

describe('SqliteVecVectorStore', () => {
  it('upsert and query returns matching chunks', async () => {
    const chunks = makeChunks(3, { baseSeed: 10 });
    await store.upsert('doc1', chunks);

    // Query with the same embedding as chunk 0 — should be closest match.
    const results = await store.query(makeEmbedding(10), 10);

    expect(results.length).toBe(3);
    expect(results[0].content).toBe('chunk 0');
    expect(results[0].metadata.title).toBe('doc-0');
    expect(results[0].metadata.similarity).toBeTypeOf('number');
  });

  it('upsert replaces existing chunks for the same docId', async () => {
    const first = makeChunks(2, { baseSeed: 1 });
    const second = makeChunks(3, { baseSeed: 100 });

    await store.upsert('doc1', first);
    await store.upsert('doc1', second);

    const results = await store.query(makeEmbedding(100), 10);
    expect(results.length).toBe(3);

    // All results should belong to the second batch (seed 100+).
    const contents = results.map((r) => r.content);
    expect(contents).toEqual(['chunk 0', 'chunk 1', 'chunk 2']);
  });

  it('delete removes all chunks for a docId', async () => {
    await store.upsert('doc1', makeChunks(2, { baseSeed: 5 }));
    await store.delete('doc1');

    const results = await store.query(makeEmbedding(5), 10);
    expect(results).toEqual([]);
  });

  it('query with no data returns empty array', async () => {
    const results = await store.query(makeEmbedding(1), 5);
    expect(results).toEqual([]);
  });

  it('topK limits the number of results', async () => {
    await store.upsert('doc1', makeChunks(6, { baseSeed: 20 }));

    const results = await store.query(makeEmbedding(20), 2);
    expect(results.length).toBe(2);
  });

  it('results are ordered by similarity (closest first)', async () => {
    // Use seeds 1, 5, 10 — distances from a query at seed 1 will increase.
    const chunks = [
      { content: 'far', embedding: makeEmbedding(10), metadata: { idx: 0 } },
      { content: 'near', embedding: makeEmbedding(1), metadata: { idx: 1 } },
      { content: 'mid', embedding: makeEmbedding(5), metadata: { idx: 2 } },
    ];
    await store.upsert('doc1', chunks);

    const results = await store.query(makeEmbedding(1), 10);
    expect(results.length).toBe(3);

    // Similarity decreases (distance increases) — ascending distance order.
    const sims = results.map((r) => r.metadata.similarity as number);
    for (let i = 1; i < sims.length; i++) {
      expect(sims[i - 1]).toBeGreaterThanOrEqual(sims[i]);
    }

    // The closest match should be the one with the same embedding.
    expect(results[0].content).toBe('near');
  });

  it('isolates documents — deleting one does not affect another', async () => {
    await store.upsert('doc1', makeChunks(2, { baseSeed: 1 }));
    await store.upsert('doc2', makeChunks(2, { baseSeed: 50 }));

    await store.delete('doc1');

    const results = await store.query(makeEmbedding(50), 10);
    expect(results.length).toBe(2);
    expect(results.every((r) => r.content.startsWith('chunk'))).toBe(true);
  });
});
