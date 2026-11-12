#!/usr/bin/env bash
# اجرای اپ اندروید روی شبیه‌ساز (در GitHub Actions، داخل android-emulator-runner) و بررسی مسیرهای اصلی
# داخل WebView واقعی اپ از طریق DevTools (نسخه‌ی دیباگ). خروجی: native/smoke/
set -uo pipefail
cd "$(dirname "$0")/.."
PKG=app.gaam.run
mkdir -p smoke
# نصب تازه، اجازه‌ها و اجرای اپ (برای اجرای دوم هم، با داده‌ی خالی)
# هر فرمان adb سقف زمانی داره: اگه شبیه‌ساز گم بشه (v132: «device not found» بعد از ری‌استارت)، adb install بی‌نهایت منتظر
# می‌موند و کل کار تا لغو ۴۵ دقیقه‌ای گیر می‌کرد. حالا prepare با کد خطا برمی‌گرده و نتیجه‌ی واقعی گزارش می‌شه.
prepare() {
timeout 240 adb install -r android/app/build/outputs/apk/debug/app-debug.apk || { echo "::error::adb install failed or timed out"; return 1; }
# اجازه‌ی اعلان از قبل، تا پنجره‌ی اجازه جلوی صفحه رو نگیره
timeout 20 adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS || true
# اجازه‌ی موقعیت برای ثبت دویدن (پنجره‌ی سیستمی این‌جا زده نمی‌شه)
timeout 20 adb shell pm grant $PKG android.permission.ACCESS_FINE_LOCATION || true
timeout 20 adb shell pm grant $PKG android.permission.ACCESS_COARSE_LOCATION || true
# بلوتوث (اندروید ۱۲+): بدون این، initialize پنجره‌ی اجازه رو باز می‌کنه و منتظر کاربر می‌مونه
timeout 20 adb shell pm grant $PKG android.permission.BLUETOOTH_SCAN || true
timeout 20 adb shell pm grant $PKG android.permission.BLUETOOTH_CONNECT || true
timeout 20 adb logcat -c || true
timeout 90 adb shell am start -W -n $PKG/.MainActivity || { echo "::error::app start failed or timed out"; return 1; }
sleep 10
}
# اجرای تست با سقف زمانی کل (هر مرحله‌ی داخلش هم سقف خودش رو داره)
run_smoke() { timeout 1200 node scripts/smoke-android.js; }
prepare || { timeout 60 adb logcat -d > smoke/logcat-full.txt 2>/dev/null; exit 1; }
# کلیپ آزمایشی به VP8: کدک H.264 شبیه‌ساز روی میزبان رمزگشایی می‌شه و وسط تحلیل خود شبیه‌ساز رو از کار انداخت
# (پیام‌های h264 و cuvid و بعد device offline)؛ VP8 داخل خود Chrome اندروید رمزگشایی می‌شه
# نسخه‌ی VP8 آماده در مخزنه (tests/e2e/synthetic-clip.webm، با همین دستور ساخته شده)؛ ffmpeg فقط اگه اون فایل نبود
if [ -f ../tests/e2e/synthetic-clip.webm ]; then cp ../tests/e2e/synthetic-clip.webm smoke/clip.webm
else ffmpeg -loglevel error -y -i ../tests/e2e/synthetic-clip.mp4 -c:v libvpx -b:v 1M -an smoke/clip.webm || echo "ffmpeg failed; using mp4"; fi
npm i --no-save --no-audit --no-fund playwright-core@1.63.0 >/dev/null
run_smoke
status=$?
# شبیه‌ساز زیر فشار حافظه گاهی سرویس‌های گوگل (com.google.android.gms) رو وسط تست می‌بنده: یا اندروید اپ رو هم می‌کشه
# (چون WebView به فونت‌های اون وابسته‌ست؛ v108)، یا موقعیت GPS تا راه افتادن دوباره‌ش نمی‌رسه (v110). فقط وقتی تست رد شده
# و همین از کار افتادن در لاگ هست، یک بار دیگه از اول با داده‌ی خالی؛ اگه اجرای دوم هم رد بشه، بیلد قرمز می‌مونه.
if [ $status -ne 0 ] && timeout 60 adb logcat -d | grep -qE "Process com\.google\.android\.gms(\.persistent)? \(pid [0-9]+\) has died|Killing [0-9]+:$PKG/.*dying proc com\.google\.android\.gms"; then
  echo "::warning::Google Play services died on the emulator during the smoke test; running it once more"
  mkdir -p smoke/attempt1
  cp smoke/result.md smoke/attempt1/ 2>/dev/null || true
  timeout 60 adb logcat -d > smoke/attempt1/logcat-full.txt || true
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then printf '\n> اجرای اول رد شد و سرویس‌های گوگل وسط تست روی شبیه‌ساز از کار افتادن؛ اجرای دوم:\n\n' >> "$GITHUB_STEP_SUMMARY"; fi
  # بعد از از کار افتادن سرویس‌های گوگل خود اندروید ناپایداره (v115: حذف برنامه سرویس package رو از کار انداخت و نصب دوباره نشد)؛
  # پس شبیه‌ساز از اول راه‌اندازی می‌شه و بعد نصب تازه
  timeout 30 adb reboot || true
  timeout 180 adb wait-for-device || true
  for i in $(seq 1 90); do [ "$(timeout 10 adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break; sleep 2; done
  for i in $(seq 1 30); do timeout 10 adb shell service check package 2>/dev/null | grep -q ': found' && break; sleep 2; done
  sleep 5
  if [ "$(timeout 10 adb get-state 2>/dev/null)" != "device" ]; then
    echo "::error::emulator did not come back after reboot; second attempt skipped"
  else
    timeout 60 adb uninstall $PKG || true
    if prepare; then run_smoke; status=$?; else status=1; fi
  fi
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
