import fs from "node:fs";
import path from "node:path";

import { close, exec, openSqliteDatabase, run } from "./sqlite";

export interface AccountDataLayout {
  businessDbPath: string;
  analysisDbPath: string;
}

export async function ensureAccountDataLayout(
  accountDir: string
): Promise<AccountDataLayout> {
  await fs.promises.mkdir(accountDir, { recursive: true });

  const businessDbPath = path.join(accountDir, "business.sqlite");
  const analysisDbPath = path.join(accountDir, "analysis.duckdb");

  const businessDb = await openSqliteDatabase(businessDbPath);
  await exec(businessDb, `pragma journal_mode = wal;`);
  await exec(
    businessDb,
    `
      create table if not exists app_meta (
        key text primary key not null,
        value text not null
      );
    `
  );
  await run(
    businessDb,
    `insert or ignore into app_meta (key, value) values (?, ?)`,
    ["schema_version", "1"]
  );
  await close(businessDb);

  await fs.promises.open(analysisDbPath, "a").then((f) => f.close());

  return { businessDbPath, analysisDbPath };
}
