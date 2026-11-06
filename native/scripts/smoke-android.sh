#!/usr/bin/env bash
# اجرای اپ اندروید روی شبیه‌ساز (در GitHub Actions، داخل android-emulator-runner) و بررسی مسیرهای اصلی
# داخل WebView واقعی اپ از طریق DevTools (نسخه‌ی دیباگ). خروجی: native/smoke/
set -uo pipefail
cd "$(dirname "$0")/.."
PKG=app.gaam.run
mkdir -p smoke
# نصب تازه، اجازه‌ها و اجرای اپ (برای اجرای دوم هم، با داده‌ی خالی)
prepare() {
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
# اجازه‌ی اعلان از قبل، تا پنجره‌ی اجازه جلوی صفحه رو نگیره
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS || true
# اجازه‌ی موقعیت برای ثبت دویدن (پنجره‌ی سیستمی این‌جا زده نمی‌شه)
adb shell pm grant $PKG android.permission.ACCESS_FINE_LOCATION || true
adb shell pm grant $PKG android.permission.ACCESS_COARSE_LOCATION || true
# بلوتوث (اندروید ۱۲+): بدون این، initialize پنجره‌ی اجازه رو باز می‌کنه و منتظر کاربر می‌مونه
adb shell pm grant $PKG android.permission.BLUETOOTH_SCAN || true
adb shell pm grant $PKG android.permission.BLUETOOTH_CONNECT || true
adb logcat -c
adb shell am start -W -n $PKG/.MainActivity
sleep 10
}
prepare
# کلیپ آزمایشی به VP8: کدک H.264 شبیه‌ساز روی میزبان رمزگشایی می‌شه و وسط تحلیل خود شبیه‌ساز رو از کار انداخت
# (پیام‌های h264 و cuvid و بعد device offline)؛ VP8 داخل خود Chrome اندروید رمزگشایی می‌شه
ffmpeg -loglevel error -y -i ../tests/e2e/synthetic-clip.mp4 -c:v libvpx -b:v 1M -an smoke/clip.webm || echo "ffmpeg failed; using mp4"
npm i --no-save --no-audit --no-fund playwright-core@1.63.0 >/dev/null
node scripts/smoke-android.js
status=$?
# شبیه‌ساز زیر فشار حافظه گاهی سرویس‌های گوگل (com.google.android.gms) رو می‌بنده و اندروید اپ رو هم چون به فونت‌های
# اون وابسته‌ست می‌کشه («depends on provider … in dying proc com.google.android.gms»؛ v108). فقط در همین حالت،
# یک بار دیگه از اول با داده‌ی خالی؛ هر شکست دیگه (کرش اپ، خطای تست) همون‌طور رد می‌شه.
if [ $status -ne 0 ] && timeout 60 adb logcat -d | grep -qE "Killing [0-9]+:$PKG/.*dying proc com\.google\.android\.gms"; then
  echo "::warning::App was killed because Google Play services died on the emulator; running the smoke test once more"
  mkdir -p smoke/attempt1
  cp smoke/result.md smoke/attempt1/ 2>/dev/null || true
  timeout 60 adb logcat -d > smoke/attempt1/logcat-full.txt || true
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then printf '\n> اجرای اول: اپ به خاطر از کار افتادن سرویس‌های گوگل روی شبیه‌ساز بسته شد؛ اجرای دوم:\n\n' >> "$GITHUB_STEP_SUMMARY"; fi
  adb uninstall $PKG || true
  prepare
  node scripts/smoke-android.js
  status=$?
fi
# اگه شبیه‌ساز از کار افتاده باشه، adb منتظر می‌مونه؛ هر فرمان سقف زمانی داره
timeout 30 adb exec-out screencap -p > smoke/final-device.png
timeout 60 adb logcat -d > smoke/logcat-full.txt
timeout 10 adb get-state || echo "device offline after tests" 
grep -E "Capacitor|chromium|AndroidRuntime|app.gaam.run" smoke/logcat-full.txt > smoke/logcat.txt || true
# کرش یا خطای نیتیو مستقیم در لاگ اجرا
echo "--- native errors (logcat) ---"
# (خط‌های فراخوانی افزونه‌ها کنار گذاشته می‌شن؛ مقدار ذخیره‌ها رو دارن)
grep -E "FATAL|AndroidRuntime|Capacitor.*(Error|rejected)|E Capacitor|BackgroundGeolocation|Failed to foreground" smoke/logcat-full.txt | grep -v "methodData" | tail -40 || true
# مرگ پردازش اپ یا WebView (کمبود حافظه، کرش رندرر، کشته شدن توسط سیستم): در لاگ خود اجرا، چون اسکرین‌شات‌ها همیشه در دسترس نیستن
echo "--- process / WebView deaths ---"
grep -E "lowmemorykiller|lmkd|am_kill|has died|Killing [0-9]+:app.gaam.run|signal 9|OutOfMemory|Renderer process|render process|chromium.*(FATAL|crash|Crash)|ANR in app.gaam.run|am_anr|am_crash|Fatal signal" smoke/logcat-full.txt | tail -40 || true
echo "--- WebView console errors ---"
grep -E "chromium.*(Uncaught|Error|error)|Console.*(Error|error)" smoke/logcat-full.txt | tail -20 || true
echo "--- memory ---"
timeout 20 adb shell cat /proc/meminfo | head -4 || true
echo "--- current activity ---"
timeout 20 adb shell dumpsys activity activities | grep -E "topResumedActivity|mResumedActivity" || true
exit $status
