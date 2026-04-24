import Database from 'better-sqlite3';
import { load as sqliteVecLoad } from 'sqlite-vec';
import path from 'node:path';
import fs from 'node:fs';
import type { VectorStore, VectorSearchResult } from '../ports/vectorStore';

const EMBEDDING_DIM = 1536;

export class SqliteVecVectorStore implements VectorStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolved =
      dbPath ?? path.join(process.env.DATA_DIR ?? process.cwd(), 'data', 'vectors.sqlite');
    fs.mkdirSync(path.dirname(resolved), { recursive: true });

    const db = new Database(resolved);
    sqliteVecLoad(db);
    db.exec('PRAGMA journal_mode=WAL');

    db.exec(`CREATE TABLE IF NOT EXISTS chunk_meta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_id TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT NOT NULL
    )`);
    db.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(embedding float[${EMBEDDING_DIM}])`,
    );
    db.exec('CREATE INDEX IF NOT EXISTS idx_chunk_meta_doc ON chunk_meta(doc_id)');

    this.db = db;
  }

  async upsert(
    docId: string,
    chunks: { content: string; embedding: number[]; metadata: Record<string, unknown> }[],
  ): Promise<void> {
    const findIds = this.db.prepare('SELECT id FROM chunk_meta WHERE doc_id = ?');
    const delVecs = this.db.prepare('DELETE FROM vec_chunks WHERE rowid = ?');
    const delMeta = this.db.prepare('DELETE FROM chunk_meta WHERE doc_id = ?');
    const insMeta = this.db.prepare(
      'INSERT INTO chunk_meta (doc_id, content, metadata) VALUES (?, ?, ?)',
    );
    const insVec = this.db.prepare('INSERT INTO vec_chunks (rowid, embedding) VALUES (?, ?)');

    const run = this.db.transaction(() => {
      const existing = findIds.all(docId) as { id: number }[];
      for (const row of existing) delVecs.run(BigInt(row.id));
      delMeta.run(docId);

      for (const chunk of chunks) {
        const { lastInsertRowid } = insMeta.run(
          docId,
          chunk.content,
          JSON.stringify(chunk.metadata),
        );
        insVec.run(BigInt(lastInsertRowid as number), new Float32Array(chunk.embedding));
      }
    });

    run();
  }

  async query(embedding: number[], topK: number): Promise<VectorSearchResult[]> {
    const safeTopK = Math.max(1, Math.floor(topK));
    const rows = this.db
      .prepare(
        `SELECT s.distance, m.content, m.metadata
         FROM (SELECT rowid, distance FROM vec_chunks WHERE embedding MATCH ? ORDER BY distance LIMIT ${safeTopK}) s
         JOIN chunk_meta m ON s.rowid = m.id`,
      )
      .all(new Float32Array(embedding)) as { distance: number; content: string; metadata: string }[];

    return rows.map((r) => ({
      content: r.content,
      metadata: { ...JSON.parse(r.metadata), similarity: 1 - r.distance },
    }));
  }

  async delete(docId: string): Promise<void> {
    const findIds = this.db.prepare('SELECT id FROM chunk_meta WHERE doc_id = ?');
    const delVecs = this.db.prepare('DELETE FROM vec_chunks WHERE rowid = ?');
    const delMeta = this.db.prepare('DELETE FROM chunk_meta WHERE doc_id = ?');

    const run = this.db.transaction(() => {
      const existing = findIds.all(docId) as { id: number }[];
      for (const row of existing) delVecs.run(BigInt(row.id));
      delMeta.run(docId);
    });

    run();
  }
}
