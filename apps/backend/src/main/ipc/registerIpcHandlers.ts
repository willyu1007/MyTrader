import { BrowserWindow, app, dialog, ipcMain } from "electron";
import type { OpenDialogOptions } from "electron";
import fs from "node:fs";
import path from "node:path";

import { IPC_CHANNELS } from "@mytrader/shared";

import type {
  AccountSummary,
  CreateAccountInput,
  UnlockAccountInput
} from "@mytrader/shared";
import { AccountIndexDb } from "../storage/accountIndexDb";
import { ensureAccountDataLayout } from "../storage/paths";
import { close, exec, openSqliteDatabase } from "../storage/sqlite";
import type { SqliteDatabase } from "../storage/sqlite";

let accountIndexDb: AccountIndexDb | null = null;
let activeAccount: AccountSummary | null = null;
let activeBusinessDb: SqliteDatabase | null = null;

export async function registerIpcHandlers() {
  const userDataDir = app.getPath("userData");
  fs.mkdirSync(userDataDir, { recursive: true });

  const accountIndexPath = path.join(userDataDir, "account-index.sqlite");
  accountIndexDb = await AccountIndexDb.open(accountIndexPath);

  ipcMain.handle(IPC_CHANNELS.ACCOUNT_GET_ACTIVE, async () => activeAccount);

  ipcMain.handle(IPC_CHANNELS.ACCOUNT_LIST, async () => {
    if (!accountIndexDb) throw new Error("账号索引库尚未初始化。");
    return await accountIndexDb.listAccounts();
  });

  ipcMain.handle(
    IPC_CHANNELS.ACCOUNT_CHOOSE_DATA_ROOT_DIR,
    async (event) => {
      const isDev = Boolean(process.env.MYTRADER_DEV_SERVER_URL);
      if (isDev) console.log("[mytrader] 打开系统目录选择器");

      const ownerWindow =
        BrowserWindow.fromWebContents(event.sender) ??
        BrowserWindow.getFocusedWindow() ??
        BrowserWindow.getAllWindows()[0] ??
        null;

      if (ownerWindow) {
        if (ownerWindow.isMinimized()) ownerWindow.restore();
        ownerWindow.show();
        ownerWindow.focus();
        ownerWindow.moveTop();
      }

      if (process.platform === "darwin") {
        app.focus({ steal: true });
      }

      const options: OpenDialogOptions = {
        title: "选择数据目录",
        buttonLabel: "选择",
        properties: ["openDirectory", "createDirectory"]
      };
      const result =
        process.platform === "darwin"
          ? await dialog.showOpenDialog(options)
          : ownerWindow
            ? await dialog.showOpenDialog(ownerWindow, options)
            : await dialog.showOpenDialog(options);
      if (result.canceled) return null;
      const selected = result.filePaths[0] ?? null;
      if (isDev) console.log("[mytrader] 目录选择结果：", selected ?? "(取消)");
      return selected;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ACCOUNT_CREATE,
    async (_event, input: CreateAccountInput) => {
      if (!accountIndexDb) throw new Error("账号索引库尚未初始化。");

      const label = input.label.trim();
      if (!label) throw new Error("账号名称不能为空。");
      if (!input.password) throw new Error("密码不能为空。");

      const userData = app.getPath("userData");
      const defaultRoot = path.join(userData, "accounts");

      const dataRootDir = input.dataRootDir?.trim()
        ? input.dataRootDir.trim()
        : defaultRoot;

      if (!path.isAbsolute(dataRootDir)) {
        throw new Error("数据根目录必须是绝对路径。");
      }

      const created = await accountIndexDb.createAccount({
        label,
        password: input.password,
        dataRootDir
      });

      await ensureAccountDataLayout(created.dataDir);
      return created;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ACCOUNT_UNLOCK,
    async (_event, input: UnlockAccountInput) => {
      if (!accountIndexDb) throw new Error("账号索引库尚未初始化。");
      if (!input.accountId) throw new Error("账号 ID 不能为空。");
      if (!input.password) throw new Error("密码不能为空。");

      const unlocked = await accountIndexDb.unlockAccount({
        accountId: input.accountId,
        password: input.password
      });

      const layout = await ensureAccountDataLayout(unlocked.dataDir);

      if (activeBusinessDb) {
        await close(activeBusinessDb);
        activeBusinessDb = null;
      }

      activeBusinessDb = await openSqliteDatabase(layout.businessDbPath);
      await exec(activeBusinessDb, `pragma journal_mode = wal;`);

      activeAccount = unlocked;
      return unlocked;
    }
  );

  ipcMain.handle(IPC_CHANNELS.ACCOUNT_LOCK, async () => {
    if (activeBusinessDb) {
      await close(activeBusinessDb);
      activeBusinessDb = null;
    }
    activeAccount = null;
  });
}
