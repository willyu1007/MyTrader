import { BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";

export function createMainWindow() {
  const preloadPath = path.join(__dirname, "preload.js");
  const preloadExists = fs.existsSync(preloadPath);
  if (!preloadExists) {
    console.error(`[mytrader] preload 脚本不存在：${preloadPath}`);
  }

  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath
    }
  });

  mainWindow.webContents.on("preload-error", (_event, failingPreloadPath, err) => {
    console.error(`[mytrader] preload 执行异常：${failingPreloadPath}`);
    console.error(err);
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) return;
      console.error(
        `[mytrader] 页面加载失败：${validatedURL} (${errorCode}) ${errorDescription}`
      );
    }
  );

  mainWindow.webContents.on(
    "console-message",
    (_event, _level, message) => {
      if (!message.startsWith("[mytrader]")) return;
      console.log(message);
    }
  );

  mainWindow.webContents.on("did-finish-load", async () => {
    try {
      const hasApi = await mainWindow.webContents.executeJavaScript(
        "Boolean(window.mytrader)",
        true
      );
      if (hasApi) return;

      const userAgent = await mainWindow.webContents.executeJavaScript(
        "navigator.userAgent",
        true
      );

      console.error(
        "[mytrader] renderer 未发现 window.mytrader（preload API 未注入）。"
      );
      console.error(`[mytrader] userAgent=${String(userAgent)}`);
      console.error(
        `[mytrader] preloadPath=${preloadPath} exists=${fs.existsSync(preloadPath)}`
      );
    } catch (err) {
      console.error("[mytrader] renderer 环境检查失败：");
      console.error(err);
    }
  });

  const devUrl = process.env.MYTRADER_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return mainWindow;
  }

  const indexHtmlPath = path.join(
    __dirname,
    "../../frontend/dist/index.html"
  );
  mainWindow.loadFile(indexHtmlPath);
  return mainWindow;
}
