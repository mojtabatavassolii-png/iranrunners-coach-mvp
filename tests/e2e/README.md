# تست دوره‌ای دستگاه‌ها

مسیرهای اصلی گام (ثبت‌نام، ورود، چک‌لیست شروع، انتخاب هدف، تمرین امروز، چک‌این، پروفایل، مسابقه و هدف، آپلود بیومکانیک)
روی ۱۱ پروفایل شبیه‌سازی‌شده: اندروید (Pixel 7، ۳۶۰ پیکسلی)، آیفون (SE، ۱۵، ۱۵ Pro Max)، آیپد و آیپد مینی، و دسکتاپ،
با موتورهای Chromium، WebKit (شبیه Safari) و Firefox.

- هر تست با یک مرورگر خالی اجرا می‌شه (اکانت آزمایشی تازه)؛ اپ داده رو فقط در مرورگر نگه می‌داره، پس به داده‌ی هیچ کاربری دست نمی‌زنه.
- `synthetic-clip.mp4` یک کلیپ ساختگی ۳ ثانیه‌ای بدون آدمه (ffmpeg، الگوی testsrc2).
- در شکست: اسکرین‌شات، trace و لاگ کنسول.

## اجرا در گیت‌هاب

`.github/workflows/e2e.yml` هر روز ۶:۴۷ صبح تهران بیدار می‌شه و اگه ۴۷ ساعت از اجرای قبلی گذشته باشه، تست‌ها رو روی نسخه‌ی منتشرشده اجرا می‌کنه
(عملاً هر ۴۸ ساعت). اجرای دستی: تب Actions ← Periodic device tests ← Run workflow.

برای گزارش ایمیلی، سه secret در Settings ← Secrets and variables ← Actions:

| نام | مقدار |
|---|---|
| `MAIL_USERNAME` | آدرس جیمیل فرستنده |
| `MAIL_PASSWORD` | App Password همون جیمیل (myaccount.google.com/apppasswords؛ تأیید دومرحله‌ای باید روشن باشه) |
| `MAIL_TO` | آدرس گیرنده‌ی گزارش |

## اجرای محلی

```
cd tests/e2e && npm ci && npx playwright install chromium webkit firefox
BASE_URL=http://localhost:8000/ npx playwright test     # فقط چند دستگاه: ONLY=android-pixel7,desktop-chrome
node report.js                                           # out/email.html و out/summary.md
```
