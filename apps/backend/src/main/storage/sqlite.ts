import initSqlJs from "sql.js";
import type { Database as SqlJsDatabase } from "sql.js";
import fs from "node:fs";
import path from "node:path";

export type SqliteDatabase = SqlJsDatabase;

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

const WASM_FILENAME = "sql-wasm.wasm";

// Map to track database file paths for persistence
const dbFilePaths = new Map<SqlJsDatabase, string>();
const transactionDepths = new Map<SqlJsDatabase, number>();

function resolveSqlJsWasmPath(): string {
  const distPath = path.join(__dirname, WASM_FILENAME);
  if (fs.existsSync(distPath)) return distPath;

  const nodeModulesPath = path.join(
    process.cwd(),
    "node_modules",
    "sql.js",
    "dist",
    WASM_FILENAME
  );
  if (fs.existsSync(nodeModulesPath)) return nodeModulesPath;

  throw new Error(
    `[mytrader] 未找到 sql.js wasm 文件。期望路径：${distPath} 或 ${nodeModulesPath}`
  );
}

async function getSqlJs() {
  if (!SQL) {
    const wasmPath = resolveSqlJsWasmPath();
    SQL = await initSqlJs({
      locateFile: () => wasmPath
    });
  }
  return SQL;
}

export async function openSqliteDatabase(filePath: string): Promise<SqlJsDatabase> {
  const sqlJs = await getSqlJs();
  
  let db: SqlJsDatabase;
  if (fs.existsSync(filePath)) {
    const buffer = fs.readFileSync(filePath);
    db = new sqlJs.Database(buffer);
  } else {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new sqlJs.Database();
  }
  
  dbFilePaths.set(db, filePath);
  return db;
}

function saveDatabase(db: SqlJsDatabase): void {
  const filePath = dbFilePaths.get(db);
  if (filePath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(filePath, buffer);
  }
}

function isTransactionActive(db: SqlJsDatabase): boolean {
  return (transactionDepths.get(db) ?? 0) > 0;
}

function markTransactionStart(db: SqlJsDatabase): void {
  const next = (transactionDepths.get(db) ?? 0) + 1;
  transactionDepths.set(db, next);
}

function markTransactionEnd(db: SqlJsDatabase): void {
  const current = transactionDepths.get(db) ?? 0;
  if (current <= 1) {
    transactionDepths.delete(db);
    return;
  }
  transactionDepths.set(db, current - 1);
}

function flushDatabase(db: SqlJsDatabase): void {
  if (!isTransactionActive(db)) saveDatabase(db);
}

export function exec(db: SqlJsDatabase, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      db.exec(sql);
      flushDatabase(db);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

export function run(
  db: SqlJsDatabase,
  sql: string,
  params: unknown[] = []
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      db.run(sql, params as (string | number | null | Uint8Array)[]);
      flushDatabase(db);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

export function get<T>(
  db: SqlJsDatabase,
  sql: string,
  params: unknown[] = []
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      stmt.bind(params as (string | number | null | Uint8Array)[]);
      
      if (stmt.step()) {
        const columns = stmt.getColumnNames();
        const values = stmt.get();
        const row: Record<string, unknown> = {};
        columns.forEach((col: string, i: number) => {
          row[col] = values[i];
        });
        stmt.free();
        resolve(row as T);
      } else {
        stmt.free();
        resolve(undefined);
      }
    } catch (err) {
      reject(err);
    }
  });
}

export function all<T>(
  db: SqlJsDatabase,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      stmt.bind(params as (string | number | null | Uint8Array)[]);
      
      const rows: T[] = [];
      while (stmt.step()) {
        const columns = stmt.getColumnNames();
        const values = stmt.get();
        const row: Record<string, unknown> = {};
        columns.forEach((col: string, i: number) => {
          row[col] = values[i];
        });
        rows.push(row as T);
      }
      stmt.free();
      resolve(rows);
    } catch (err) {
      reject(err);
    }
  });
}

export function close(db: SqlJsDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      saveDatabase(db);
      dbFilePaths.delete(db);
      transactionDepths.delete(db);
      db.close();
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

export async function transaction<T>(
  db: SqlJsDatabase,
  fn: () => Promise<T>
): Promise<T> {
  markTransactionStart(db);
  try {
    await exec(db, "begin");
  } catch (err) {
    markTransactionEnd(db);
    throw err;
  }
  try {
    const result = await fn();
    await exec(db, "commit");
    markTransactionEnd(db);
    saveDatabase(db);
    return result;
  } catch (err) {
    try {
      await exec(db, "rollback");
    } catch (rollbackError) {
      console.error("[mytrader] failed to rollback transaction", rollbackError);
    }
    markTransactionEnd(db);
    saveDatabase(db);
    throw err;
  }
}
