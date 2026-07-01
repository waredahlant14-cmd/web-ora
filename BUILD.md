# WeB Ora POS v5.2.5 — دليل البناء

## المتطلبات المسبقة
- Node.js 18 أو أحدث
- npm أو pnpm

---

## 🖥️ نسخة Windows (EXE مثبّت + محمولة)

```bash
# تثبيت الاعتماديات
npm install

# بناء كلا النسختين (مثبّت + محمول) لـ Windows
npm run build:win
```

**النتائج في مجلد `dist-electron/`:**
- `WeB-Ora-POS-Setup-5.2.5.exe` — نسخة مع مثبّت (installer)
- `WeB-Ora-POS-Portable-5.2.5.exe` — نسخة محمولة (لا تحتاج تثبيت)

---

## 📱 نسخة Android (APK)

### 1. تثبيت Capacitor
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "WeB Ora POS" "com.webora.pos" --web-dir "."
```

### 2. إضافة منصة Android
```bash
npx cap add android
```

### 3. فتح في Android Studio
```bash
npx cap open android
```

### 4. بناء APK
في Android Studio:
- **Build** ← **Build Bundle(s) / APK(s)** ← **Build APK(s)**
- الملف في: `android/app/build/outputs/apk/debug/app-debug.apk`

### للنسخة الموقّعة (للنشر على Google Play):
- **Build** ← **Generate Signed Bundle / APK**

---

## ⚙️ التشغيل للتطوير
```bash
npm install
npm run dev
```

---

## 📋 ملاحظات مهمة
- أول تشغيل: يظهر معالج الإعداد تلقائياً لاختيار الوضع وإنشاء الحساب
- البيانات محفوظة في: `%APPDATA%/webora-data/` (Windows)
- لتغيير الوضع: الإعدادات ← وضع التشغيل
