import { BrowserWindow, app } from "electron";

import { createMainWindow } from "./createMainWindow";
import { registerIpcHandlers } from "./ipc/registerIpcHandlers";

app.whenReady().then(() => {
  return (async () => {
    await registerIpcHandlers();
    createMainWindow();

    app.on("activate", () => {
      if (process.platform !== "darwin") return;
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  })();
});

app.on("window-all-closed", () => {
  if (process.platform === "darwin") return;
  app.quit();
});
