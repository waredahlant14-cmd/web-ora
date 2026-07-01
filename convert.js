#!/usr/bin/env node
/* =========================================================
   convert.js — يحوّل ملفات PHP إلى HTML
   ويضيف سكريبتات المزامنة الجديدة تلقائياً
   الاستخدام: node convert.js
   ========================================================= */

const fs   = require("fs");
const path = require("path");

const SRC  = path.join(__dirname, "../ora-pos");
const DEST = __dirname;

/* ─── الملفات التي تحتاج تحويل PHP→HTML ─── */
const PHP_FILES = [
  "login", "index", "new-invoice", "invoices", "products",
  "customers", "stock", "expenses", "employees", "reports",
  "activity", "settings", "scanner", "offers", "suppliers",
  "customer-statement", "supplier-invoices", "supplier-statement",
  "shifts", "shift-close", "permissions", "customize"
];

/* ─── سكريبتات المزامنة الجديدة تُضاف بعد db.js ─── */
const SYNC_SCRIPTS = [
  '<script src="js/sync_queue.js"></script>',
  '<script src="js/initial_sync.js"></script>',
  '<script src="js/background_sync.js"></script>',
];

/* ─── تحويل محتوى الملف ─── */
function transformContent(html, fileName) {
  /* 1) استبدال .php بـ .html في جميع الروابط والمصادر */
  html = html.replace(/\.php(['"\s?#])/g, ".html$1");

  /* 2) أضف سكريبتات المزامنة بعد db.js إن لم تكن موجودة */
  if (fileName !== "login" && !html.includes("js/sync_queue.js")) {
    const dbScript = '<script src="js/db.js"></script>';
    if (html.includes(dbScript)) {
      html = html.replace(
        dbScript,
        dbScript + "\n  " + SYNC_SCRIPTS.join("\n  ")
      );
    }
  }

  /* 3) أضف preload.js لـ Electron قبل config.js */
  if (!html.includes("preload")) {
    const configScript = '<script src="config.js"></script>';
    if (html.includes(configScript)) {
      /* preload.js يُحقن تلقائياً من Electron — لا حاجة هنا */
    }
  }

  return html;
}

/* ─── نسخ المجلدات والأصول ─── */
function copyDir(src, dest, transforms) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath  = path.join(src,  entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, transforms);
    } else {
      let data = fs.readFileSync(srcPath);
      const ext = path.extname(entry.name).toLowerCase();
      if (transforms && [".html", ".js", ".css"].includes(ext)) {
        let txt = data.toString("utf8");
        txt = transforms(txt, entry.name);
        fs.writeFileSync(destPath, txt, "utf8");
      } else {
        fs.writeFileSync(destPath, data);
      }
      console.log("  copied:", entry.name);
    }
  }
}

/* ─── تحويل ملفات PHP ─── */
console.log("\n=== تحويل ملفات PHP → HTML ===\n");

for (const name of PHP_FILES) {
  const srcFile  = path.join(SRC,  name + ".php");
  const destFile = path.join(DEST, name + ".html");

  if (!fs.existsSync(srcFile)) {
    console.warn("  [!] غير موجود:", name + ".php");
    continue;
  }

  let content = fs.readFileSync(srcFile, "utf8");
  content = transformContent(content, name);
  fs.writeFileSync(destFile, content, "utf8");
  console.log("  ✓", name + ".php → " + name + ".html");
}

/* ─── نسخ الأصول (css, img, fonts) ─── */
console.log("\n=== نسخ الأصول ===\n");

const ASSET_DIRS = ["css", "img", "fonts", "sounds"];
for (const dir of ASSET_DIRS) {
  const srcDir  = path.join(SRC,  dir);
  const destDir = path.join(DEST, dir);
  if (fs.existsSync(srcDir)) {
    copyDir(srcDir, destDir, (txt, fname) => {
      /* استبدل .php بـ .html في ملفات CSS أيضاً */
      return txt.replace(/\.php(['"\s?#])/g, ".html$1");
    });
    console.log("  ✓ مجلد", dir);
  } else {
    console.warn("  [!] غير موجود:", dir);
  }
}

/* ─── نسخ ملفات JS (باستثناء المحدّثة) ─── */
console.log("\n=== نسخ ملفات JS ===\n");

const srcJsDir  = path.join(SRC,  "js");
const destJsDir = path.join(DEST, "js");
if (!fs.existsSync(destJsDir)) fs.mkdirSync(destJsDir, { recursive: true });

const SKIP_JS = new Set(["auth.js", "layout.js", "nav-extend.js",
                          "sync_queue.js", "initial_sync.js", "background_sync.js"]);
const jsFiles = fs.readdirSync(srcJsDir);
for (const f of jsFiles) {
  if (SKIP_JS.has(f)) {
    console.log("  [skip]", f, "(نسخة محدّثة موجودة)");
    continue;
  }
  const srcPath  = path.join(srcJsDir,  f);
  const destPath = path.join(destJsDir, f);
  if (fs.statSync(srcPath).isFile()) {
    let txt = fs.readFileSync(srcPath, "utf8");
    txt = txt.replace(/\.php(['"\s?#])/g, ".html$1");
    fs.writeFileSync(destPath, txt, "utf8");
    console.log("  ✓", f);
  }
}

console.log("\n=== اكتمل التحويل ===");
console.log("→ الملفات جاهزة في:", DEST);
console.log("\nالخطوات التالية:");
console.log("  1) cd ora-pos-desktop");
console.log("  2) npm install");
console.log("  3) npm start           (اختبار)");
console.log("  4) npm run build:win   (بناء EXE)");
