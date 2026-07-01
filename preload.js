/* =========================================================
   preload.js — Electron Preload Script v5.2.5
   ========================================================= */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isDesktop: true,

  /* تطبيق */
  getDataPath:      () => ipcRenderer.invoke("get-data-path"),
  getVersion:       () => ipcRenderer.invoke("get-version"),
  relaunch:         () => ipcRenderer.invoke("relaunch"),

  /* ملفات */
  openFileDialog:   (opts) => ipcRenderer.invoke("open-file-dialog", opts),
  saveFileDialog:   (opts) => ipcRenderer.invoke("save-file-dialog", opts),
  writeFile:        (p, d) => ipcRenderer.invoke("write-file", p, d),
  readFile:         (p)    => ipcRenderer.invoke("read-file", p),

  /* طباعة */
  silentPrint:      (html, opts) => ipcRenderer.invoke("silent-print", html, opts),
  listPrinters:     ()           => ipcRenderer.invoke("list-printers"),

  /* وضع التشغيل */
  setAppMode:       (mode) => ipcRenderer.invoke("set-app-mode", mode),
  getAppMode:       ()     => ipcRenderer.invoke("get-app-mode"),
  resetAppMode:     ()     => ipcRenderer.invoke("reset-app-mode"),

  /* الإعداد الأول */
  markSetupDone:    ()     => ipcRenderer.invoke("mark-setup-done"),
  isSetupDone:      ()     => ipcRenderer.invoke("is-setup-done"),

  /* مزامنة Python */
  pythonSync:       (opts)   => ipcRenderer.invoke("python-sync", opts),
  pythonPing:       (config) => ipcRenderer.invoke("python-ping", config),

    /* اختصارات سطح المكتب */
  createDesktopShortcut: (opts) => ipcRenderer.invoke('create-desktop-shortcut', opts),
  getShortcuts:          ()     => ipcRenderer.invoke('get-shortcuts'),

  /* التحديث التلقائي */
  startUpdate:      ()  => ipcRenderer.invoke("start-update"),
  installUpdate:    ()  => ipcRenderer.invoke("install-update"),
  checkUpdateNow:   ()  => ipcRenderer.invoke("check-update-now"),
  onUpdateEvent:    (cb) => ipcRenderer.on("updater-event", (_event, payload) => cb(payload)),
});
