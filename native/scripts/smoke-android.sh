#!/usr/bin/env bash
# اجرای اپ اندروید روی شبیه‌ساز (در GitHub Actions، داخل android-emulator-runner) و بررسی مسیرهای اصلی
# داخل WebView واقعی اپ از طریق DevTools (نسخه‌ی دیباگ). خروجی: native/smoke/
set -uo pipefail
cd "$(dirname "$0")/.."
PKG=app.gaam.run
mkdir -p smoke
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
# اجازه‌ی اعلان از قبل، تا پنجره‌ی اجازه جلوی صفحه رو نگیره
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS || true
adb logcat -c
adb shell am start -W -n $PKG/.MainActivity
sleep 10
npm i --no-save --no-audit --no-fund playwright-core@1.63.0 >/dev/null
node scripts/smoke-android.js
status=$?
adb exec-out screencap -p > smoke/final-device.png
adb logcat -d > smoke/logcat-full.txt
grep -E "Capacitor|chromium|AndroidRuntime|app.gaam.run" smoke/logcat-full.txt > smoke/logcat.txt || true
exit $status
