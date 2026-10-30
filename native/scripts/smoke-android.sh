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
# اجازه‌ی موقعیت برای ثبت دویدن (پنجره‌ی سیستمی این‌جا زده نمی‌شه)
adb shell pm grant $PKG android.permission.ACCESS_FINE_LOCATION || true
adb shell pm grant $PKG android.permission.ACCESS_COARSE_LOCATION || true
adb logcat -c
adb shell am start -W -n $PKG/.MainActivity
sleep 10
# کلیپ آزمایشی به VP8: کدک H.264 شبیه‌ساز روی میزبان رمزگشایی می‌شه و وسط تحلیل خود شبیه‌ساز رو از کار انداخت
# (پیام‌های h264 و cuvid و بعد device offline)؛ VP8 داخل خود Chrome اندروید رمزگشایی می‌شه
ffmpeg -loglevel error -y -i ../tests/e2e/synthetic-clip.mp4 -c:v libvpx -b:v 1M -an smoke/clip.webm || echo "ffmpeg failed; using mp4"
npm i --no-save --no-audit --no-fund playwright-core@1.63.0 >/dev/null
node scripts/smoke-android.js
status=$?
# اگه شبیه‌ساز از کار افتاده باشه، adb منتظر می‌مونه؛ هر فرمان سقف زمانی داره
timeout 30 adb exec-out screencap -p > smoke/final-device.png
timeout 60 adb logcat -d > smoke/logcat-full.txt
timeout 10 adb get-state || echo "device offline after tests" 
grep -E "Capacitor|chromium|AndroidRuntime|app.gaam.run" smoke/logcat-full.txt > smoke/logcat.txt || true
# کرش یا خطای نیتیو مستقیم در لاگ اجرا
echo "--- native errors (logcat) ---"
# (خط‌های فراخوانی افزونه‌ها کنار گذاشته می‌شن؛ مقدار ذخیره‌ها رو دارن)
grep -E "FATAL|AndroidRuntime|Capacitor.*(Error|rejected)|E Capacitor|BackgroundGeolocation|Failed to foreground" smoke/logcat-full.txt | grep -v "methodData" | tail -40 || true
echo "--- current activity ---"
timeout 20 adb shell dumpsys activity activities | grep -E "topResumedActivity|mResumedActivity" || true
exit $status
