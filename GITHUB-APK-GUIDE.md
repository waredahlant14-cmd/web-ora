# 📱 دليل بناء APK عبر GitHub Actions
## WeB Ora POS v5.2.5

---

## 🚀 الخطوات (مرة واحدة فقط)

### 1. إنشاء Repository على GitHub

1. افتح [github.com/new](https://github.com/new)
2. اسم المستودع: `webora-pos`
3. الوصف: `WeB Ora POS v5.2.5`
4. اضغط **Create repository**

---

### 2. رفع المشروع إلى GitHub

افتح Terminal/Command Prompt في مجلد المشروع وشغّل:

```bash
git init
git add .
git commit -m "WeB Ora POS v5.2.5 - initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/webora-pos.git
git push -u origin main
```

> 🔁 بدّل `USERNAME` باسم مستخدمك على GitHub

---

### 3. إضافة Secrets في GitHub

افتح: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | القيمة | الوصف |
|--------|--------|-------|
| `TELEGRAM_TOKEN` | `توكن_البوت` | توكن بوت تيليجرام |
| `TELEGRAM_CHAT_ID` | `8395932049` | Chat ID للإرسال |

> الـ Secrets الاختيارية (لـ Release APK موقّع):

| Secret | الوصف |
|--------|-------|
| `KEYSTORE_FILE` | ملف Keystore مشفّر بـ Base64 |
| `KEYSTORE_PASSWORD` | كلمة مرور الـ Keystore |
| `KEY_ALIAS` | اسم المفتاح |
| `KEY_PASSWORD` | كلمة مرور المفتاح |

---

### 4. تشغيل الـ Workflow

**تلقائياً:**
- كل push إلى `main` يُشغّل البناء تلقائياً
- كل tag `v*` يُنشئ GitHub Release

**يدوياً:**
1. افتح: **Actions → Build Android APK → Run workflow**
2. اختر: `debug` أو `release`
3. اضغط **Run workflow**

---

### 5. تحميل APK

**بعد انتهاء الـ Workflow (~8-12 دقيقة):**

- من **Actions → اختر الـ run → Artifacts** → حمّل الـ APK
- **أو** سيصلك مباشرة على تيليجرام تلقائياً ✅

---

## 📋 متطلبات التثبيت على الجهاز

1. فعّل **Unknown Sources** (مصادر غير معروفة):
   - الإعدادات → الأمان → السماح بالتثبيت من مصادر غير معروفة

2. ثبّت الـ APK مباشرة

3. عند التشغيل الأول: أدخل بيانات Supabase من **إعداد النظام**

---

## 🔑 إنشاء Keystore (للإصدار الرسمي)

```bash
keytool -genkey -v \
  -keystore webora-pos.keystore \
  -alias webora \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

ثم شفّره لـ Base64:
```bash
# macOS/Linux
base64 -i webora-pos.keystore

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("webora-pos.keystore"))
```

انسخ الناتج وضعه في Secret: `KEYSTORE_FILE`

---

## ⚙️ مواصفات التطبيق

| الخاصية | القيمة |
|---------|--------|
| App ID | `com.webora.pos` |
| الاسم | WeB Ora POS |
| الإصدار | 5.2.5 |
| Android الحد الأدنى | API 22 (Android 5.1) |
| Android المستهدف | API 34 (Android 14) |
| الحجم التقريبي | ~8-15 MB |

---

## 🆘 مشاكل شائعة

| المشكلة | الحل |
|---------|------|
| `Gradle build failed` | راجع Secrets وتأكد من صحة التوكن |
| `cap add failed` | تأكد أن `package.json` يحتوي `@capacitor/android` |
| APK لا يعمل | فعّل `androidScheme: https` في `capacitor.config.json` |
| صفحة بيضاء | تأكد أن `webDir` في Capacitor يشير لمجلد HTML الصحيح |
