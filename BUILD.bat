@echo off
chcp 65001 >nul
title WeB Ora POS — بناء الإصدار الجديد

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║     WeB Ora POS v5.2.5 — Build Tool     ║
echo  ╚══════════════════════════════════════════╝
echo.

:: التحقق من وجود Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [خطأ] Node.js غير مثبّت!
    echo  قم بتثبيته من: https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  Node.js: %NODE_VER%  ✓

:: تثبيت الحزم
echo.
echo  [1/3] تثبيت الحزم ...
call npm install --prefer-offline
if %errorlevel% neq 0 (
    echo.
    echo  [خطأ] فشل تثبيت الحزم. تحقق من الإنترنت.
    pause
    exit /b 1
)
echo  تثبيت الحزم ✓

:: بناء الـ exe
echo.
echo  [2/3] بناء ملف exe (قد يستغرق 3-5 دقائق) ...
call npm run build:win
if %errorlevel% neq 0 (
    echo.
    echo  [خطأ] فشل البناء. راجع الرسائل أعلاه.
    pause
    exit /b 1
)
echo  البناء ✓

:: فتح مجلد dist
echo.
echo  [3/3] فتح مجلد الإخراج ...
if exist "dist\" (
    explorer dist
)

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║   اكتمل البناء ✓  راجع مجلد dist\      ║
echo  ║   - WeB-Ora-POS-Setup-5.2.5.exe         ║
echo  ║   - WeB-Ora-POS-Portable-5.2.5.exe      ║
echo  ╚══════════════════════════════════════════╝
echo.
pause
