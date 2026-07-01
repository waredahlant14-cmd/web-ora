/* =========================================================
   main.js — Electron Main Process
   WeB Ora POS v5.1.4 + Setup Wizard
   ========================================================= */
const { app, BrowserWindow, ipcMain, shell, dialog, Menu, Tray, nativeImage } = require("electron");
const path  = require("path");
const fs    = require("fs");
const { spawn } = require("child_process");

let mainWindow = null;
let tray       = null;

const DATA_DIR  = path.join(app.getPath("userData"), "webora-data");
const LOG_PATH  = path.join(DATA_DIR, "app.log");
const MODE_FILE = path.join(DATA_DIR, "app_mode.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(LOG_PATH, line); } catch (_) {}
  console.log(msg);
}

function readModeFile() {
  try {
    if (!fs.existsSync(MODE_FILE)) return {};
    return JSON.parse(fs.readFileSync(MODE_FILE, "utf8")) || {};
  } catch (_) { return {}; }
}

function getStoredMode()  { return readModeFile().mode || null; }
function isSetupDone()    { return readModeFile().setup_done === true; }

function storeMode(mode) {
  const d = readModeFile();
  if (d.mode && d.mode !== mode) d.setup_done = false;
  d.mode = mode;
  d.set_at = new Date().toISOString();
  try { fs.writeFileSync(MODE_FILE, JSON.stringify(d), "utf8"); } catch (_) {}
}

function markSetupDone() {
  const d = readModeFile();
  d.setup_done = true;
  d.setup_at = new Date().toISOString();
  try { fs.writeFileSync(MODE_FILE, JSON.stringify(d), "utf8"); } catch (_) {}
}

function clearMode() {
  try { if (fs.existsSync(MODE_FILE)) fs.unlinkSync(MODE_FILE); } catch (_) {}
}

function getStartPage() {
  /* v5.2.5: دعم --page= للاختصارات السريعة */
  const ALLOWED_PAGES = ["index.html","quick-pos.html","new-invoice.html","invoices.html",
    "products.html","customers.html","reports.html","settings.html","branches.html",
    "payments-ledger.html","expenses.html","employees.html","activity.html"];
  const pageArg = process.argv.find(function (a) { return a.startsWith("--page="); });
  if (pageArg) {
    const requestedPage = pageArg.slice(7);
    if (ALLOWED_PAGES.indexOf(requestedPage) >= 0) {
      const mode = getStoredMode();
      if (mode && isSetupDone()) return requestedPage;
    }
  }
  const mode = getStoredMode();
  if (!mode)          return "mode-select.html";
  if (!isSetupDone()) return "setup-wizard.html";
  return "login.html";
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    title: "WeB Ora POS",
    icon: path.join(__dirname, "img", "mark.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: false, webSecurity: true,
    },
    show: false, backgroundColor: "#0f172a", autoHideMenuBar: true,
  });
  const startPage = getStartPage();
  mainWindow.loadFile(startPage);
  log("Start: " + startPage);
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) { shell.openExternal(url); return { action: "deny" }; }
    return { action: "allow" };
  });
  mainWindow.on("closed", () => { mainWindow = null; });
  if (process.argv.includes("--dev")) mainWindow.webContents.openDevTools({ mode: "detach" });
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, "img", "mark.png");
    if (!fs.existsSync(iconPath)) return;
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip("WeB Ora POS");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "WeB Ora POS", enabled: false }, { type: "separator" },
      { label: "فتح التطبيق", click: () => { if (mainWindow) mainWindow.show(); else createWindow(); } },
      { label: "إخفاء",      click: () => { if (mainWindow) mainWindow.hide(); } },
      { type: "separator" },
      { label: "إغلاق",     click: () => app.quit() },
    ]));
    tray.on("double-click", () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
  } catch (e) { log("Tray error: " + e.message); }
}

/* ─── IPC: وضع التشغيل ─── */
ipcMain.handle("set-app-mode",    (_, mode) => { if (!["offline","online","parallel"].includes(mode)) return { ok: false }; storeMode(mode); return { ok: true, mode }; });
ipcMain.handle("get-app-mode",    () => ({ mode: getStoredMode() }));
ipcMain.handle("reset-app-mode",  () => { clearMode(); return { ok: true }; });
ipcMain.handle("mark-setup-done", () => { markSetupDone(); return { ok: true }; });
ipcMain.handle("is-setup-done",   () => ({ done: isSetupDone() }));

/* ─── IPC: Python Sync ─── */
function findPython() {
  for (const cmd of ["python3","python","py"]) {
    try { require("child_process").execSync(`${cmd} --version`, { stdio:"ignore" }); return cmd; } catch (_) {}
  }
  return null;
}

ipcMain.handle("python-sync", async (_, opts) => {
  const { mode="full", queue=[], stock=[], config={} } = opts||{};
  const pythonCmd = findPython();
  if (!pythonCmd) return { ok:false, error:"python_not_found", fallback:true };
  const cfgPath = path.join(DATA_DIR,"sync_config_temp.json");
  try { fs.writeFileSync(cfgPath, JSON.stringify(config), "utf8"); } catch (e) { return { ok:false, error:"config_write_failed" }; }
  const scriptPath = path.join(__dirname,"sync_helper.py");
  if (!fs.existsSync(scriptPath)) return { ok:false, error:"sync_helper.py not found" };
  return new Promise((resolve) => {
    const proc = spawn(pythonCmd,[scriptPath,"--config",cfgPath,"--mode",mode,"--payload",JSON.stringify({queue,stock})]);
    let out="",err="";
    const t = setTimeout(() => { proc.kill(); resolve({ok:false,error:"timeout"}); }, 60000);
    proc.stdout.on("data",d=>{ out+=d; });
    proc.stderr.on("data",d=>{ err+=d; });
    proc.on("close",code=>{ clearTimeout(t); try{fs.unlinkSync(cfgPath);}catch(_){} code===0 ? (()=>{ try{resolve(JSON.parse(out.trim()));}catch(_){resolve({ok:false,error:"json_parse"});} })() : resolve({ok:false,error:`exit_${code}`}); });
    proc.on("error",e=>{ clearTimeout(t); resolve({ok:false,error:e.message}); });
  });
});

ipcMain.handle("python-ping", async (_, config) => {
  const pythonCmd = findPython();
  if (!pythonCmd) return {ok:false,error:"python_not_found"};
  const cfgPath = path.join(DATA_DIR,"ping_temp.json");
  try { fs.writeFileSync(cfgPath,JSON.stringify(config),"utf8"); } catch (_) { return {ok:false}; }
  const scriptPath = path.join(__dirname,"sync_helper.py");
  return new Promise((resolve) => {
    const proc = spawn(pythonCmd,[scriptPath,"--config",cfgPath,"--mode","ping"]);
    let out="";
    proc.stdout.on("data",d=>{ out+=d; });
    proc.on("close",()=>{ try{fs.unlinkSync(cfgPath);}catch(_){} try{resolve(JSON.parse(out.trim()));}catch(_){resolve({ok:false});} });
    proc.on("error",()=>resolve({ok:false}));
    setTimeout(()=>{ proc.kill(); resolve({ok:false,error:"timeout"}); },10000);
  });
});

/* ─── IPC: ملفات / طباعة ─── */
ipcMain.handle("get-data-path",    () => DATA_DIR);
ipcMain.handle("get-version",      () => app.getVersion());
ipcMain.handle("relaunch",         () => { app.relaunch(); app.exit(0); });
ipcMain.handle("open-file-dialog", async (_,opts) => dialog.showOpenDialog(mainWindow, opts||{}));
ipcMain.handle("save-file-dialog", async (_,opts) => dialog.showSaveDialog(mainWindow, opts||{}));
ipcMain.handle("write-file",       (_,p,d)=>{ try{fs.writeFileSync(p,d,"utf8");return{ok:true};}catch(e){return{ok:false,error:e.message};} });
ipcMain.handle("read-file",        (_,p)=>{ try{ if(!fs.existsSync(p)) return{ok:false,error:"not found"}; return{ok:true,data:fs.readFileSync(p,"utf8")};}catch(e){return{ok:false,error:e.message};} });

ipcMain.handle("silent-print", async (_,html,opts)=>new Promise(resolve=>{
  try {
    const w = new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false}});
    w.loadURL("data:text/html;charset=utf-8,"+encodeURIComponent(html));
    w.webContents.once("did-finish-load",()=>setTimeout(()=>{
      w.webContents.print({silent:true,printBackground:true,color:!!opts?.color,margins:{marginType:"minimum"},landscape:opts?.landscape===true,copies:Number(opts?.copies||1),...(opts?.deviceName?{deviceName:String(opts.deviceName)}:{})},
        (ok,reason)=>{ try{w.destroy();}catch(_){} resolve(ok?{ok:true}:{ok:false,error:reason}); });
    },500));
  } catch(e){resolve({ok:false,error:e.message});}
}));

ipcMain.handle("list-printers", async()=>{ try{ if(!mainWindow) return[]; const p=await mainWindow.webContents.getPrintersAsync(); return p.map(x=>({name:x.name,displayName:x.displayName||x.name,isDefault:!!x.isDefault,status:x.status})); }catch(_){return[];} });

/* ─── IPC: اختصارات سطح المكتب v5.2.5 ─── */
ipcMain.handle("create-desktop-shortcut", async (_, opts) => {
  const name = (opts && opts.name) ? String(opts.name) : "WeB Ora POS";
  const args = (opts && opts.args) ? String(opts.args) : "";
  try {
    const desktopPath = app.getPath("desktop");
    const exePath = process.execPath;
    const safeName = name.replace(/[<>:"/\\|?*]/g, "_");
    if (process.platform === "win32") {
      const linkPath = path.join(desktopPath, safeName + ".lnk");
      const psCmd = [
        "$ws=New-Object -ComObject WScript.Shell",
        "$sc=$ws.CreateShortcut(" + JSON.stringify(linkPath) + ")",
        "$sc.TargetPath=" + JSON.stringify(exePath),
        "$sc.Arguments=" + JSON.stringify(args),
        "$sc.WorkingDirectory=" + JSON.stringify(path.dirname(exePath)),
        "$sc.Save()"
      ].join(";");
      require("child_process").execSync("powershell -NoProfile -NonInteractive -Command \"" + psCmd + "\"", { timeout: 10000 });
      log("Shortcut created: " + linkPath);
      return { ok: true, path: linkPath };
    } else if (process.platform === "linux") {
      const linkPath = path.join(desktopPath, safeName.replace(/\s/g, "-") + ".desktop");
      const entry = "[Desktop Entry]\nName=" + name + "\nExec=" + exePath + " " + args + "\nType=Application\nTerminal=false\nIcon=" + path.join(__dirname, "img", "mark.png") + "\n";
      fs.writeFileSync(linkPath, entry, "utf8");
      try { require("child_process").execSync("chmod +x \"" + linkPath + "\""); } catch (_) {}
      return { ok: true, path: linkPath };
    }
    return { ok: false, error: "platform_not_supported" };
  } catch (e) { log("Shortcut error: " + e.message); return { ok: false, error: e.message }; }
});

ipcMain.handle("get-shortcuts", () => {
  try {
    const desktopPath = app.getPath("desktop");
    const files = fs.readdirSync(desktopPath).filter(function (f) { return f.indexOf("WeB Ora") >= 0 || f.indexOf("POS") >= 0; });
    return { ok: true, shortcuts: files };
  } catch (e) { return { ok: false, shortcuts: [] }; }
});

/* ─── Auto Updater ─── */
let _autoUpdater = null;
function loadUpdater() {
  try {
    const {autoUpdater} = require("electron-updater");
    try { const log4js=require("electron-log"); autoUpdater.logger=log4js; autoUpdater.logger.transports.file.level="info"; } catch(_){}
    const cfgPath = path.join(__dirname,"update-server.json");
    if (fs.existsSync(cfgPath)) { try{ const c=JSON.parse(fs.readFileSync(cfgPath,"utf8")); if(c.url) autoUpdater.setFeedURL({provider:"generic",url:c.url}); }catch(_){} }
    autoUpdater.autoInstallOnAppQuit=true; autoUpdater.autoDownload=false;
    const send = p => { try{ if(mainWindow&&!mainWindow.isDestroyed()) mainWindow.webContents.send("updater-event",p); }catch(_){} };
    autoUpdater.on("update-available",   info=>send({type:"update-available",version:info.version}));
    autoUpdater.on("update-not-available",()  =>send({type:"update-not-available"}));
    autoUpdater.on("download-progress",  p   =>send({type:"download-progress",percent:Math.round(p.percent||0)}));
    autoUpdater.on("update-downloaded",  info=>send({type:"update-downloaded",version:info.version}));
    autoUpdater.on("error",e=>{ if(!e.message.includes("net::")&&!e.message.includes("ENOTFOUND")) send({type:"update-error",message:e.message.slice(0,120)}); });
    _autoUpdater=autoUpdater;
    setTimeout(async()=>{ if(app.isPackaged) try{await autoUpdater.checkForUpdates();}catch(_){} },8000);
  } catch(e){ log("updater N/A: "+e.message); }
}
ipcMain.handle("start-update",     async()=>{ if(!_autoUpdater) return{ok:false}; try{await _autoUpdater.downloadUpdate();return{ok:true};}catch(e){return{ok:false,error:e.message};} });
ipcMain.handle("install-update",   ()=>{ _autoUpdater?_autoUpdater.quitAndInstall(false,true):(app.relaunch(),app.exit(0)); });
ipcMain.handle("check-update-now", async()=>{ if(!_autoUpdater||!app.isPackaged) return{ok:false,reason:"not_ready"}; try{await _autoUpdater.checkForUpdates();return{ok:true};}catch(e){return{ok:false,error:e.message};} });

/* ─── دورة حياة التطبيق ─── */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
else {
  app.on("second-instance",()=>{ if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.focus();} });
  app.whenReady().then(()=>{
    createWindow(); createTray(); loadUpdater();
    app.on("activate",()=>{ if(BrowserWindow.getAllWindows().length===0) createWindow(); });
    log("WeB Ora POS v"+app.getVersion()+" ready");
  });
  app.on("window-all-closed",()=>{ if(process.platform!=="darwin") app.quit(); });
}
process.on("uncaughtException",err=>log("Uncaught: "+err.message));
