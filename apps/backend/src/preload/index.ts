import { contextBridge, ipcRenderer } from "electron";

import { IPC_CHANNELS } from "@mytrader/shared";

import type { MyTraderApi } from "@mytrader/shared";

const api: MyTraderApi = {
  account: {
    getActive: () => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNT_GET_ACTIVE),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNT_LIST),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNT_CREATE, input),
    unlock: (input) => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNT_UNLOCK, input),
    lock: () => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNT_LOCK),
    chooseDataRootDir: () =>
      ipcRenderer.invoke(IPC_CHANNELS.ACCOUNT_CHOOSE_DATA_ROOT_DIR)
  }
};

try {
  contextBridge.exposeInMainWorld("mytrader", api);
  console.log("[mytrader] preload 已注入 window.mytrader");
} catch (err) {
  console.error("[mytrader] preload 注入失败：", err);
  throw err;
}
