#!/usr/bin/env python3
"""
استخراج رنگ‌های غالب از اسکرین‌شات یک اپ یا سایت دیگه (برای تحلیل سبک بصری).
خروجی: رنگ‌ها با سهم هر کدوم، روشنایی، و کنتراست با سفید/مشکی؛ به‌علاوه‌ی نزدیک‌ترین توکن فعلی اپ.

اجرا:  python3 -I tools/ux-audit/palette.py screenshot1.png [screenshot2.png ...] [--k 10]
نیاز: Pillow (pip install pillow)
"""
import sys
from collections import Counter

try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow نصب نیست: pip install pillow')

# توکن‌های فعلی «مربی خودت باش» (از css/style.css)
TOKENS = {
    '--brand': '#00866b', '--brand-deep': '#006b56', '--brand-soft': '#e4f4f0', '--brand-light': '#c9efe6',
    '--accent': '#ff6b57', '--accent-strong': '#e8513d', '--accent-deep': '#c8412e', '--accent-soft': '#ffe9e5',
    '--ink': '#0f2a2a', '--bg': '#f2faf8', '--card': '#ffffff', '--muted': '#4f6b68', '--faint': '#7f9794',
    '--field-line': '#c3d9d3',
}


def hex_of(c):
    return '#%02x%02x%02x' % c


def rgb_of(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def lum(c):
    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = c
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contrast(a, b):
    x, y = lum(a), lum(b)
    return (max(x, y) + 0.05) / (min(x, y) + 0.05)


def dist(a, b):
    return sum((p - q) ** 2 for p, q in zip(a, b)) ** 0.5


def main():
    args = sys.argv[1:]
    k = 10
    if '--k' in args:
        i = args.index('--k')
        k = int(args[i + 1])
        del args[i:i + 2]
    if not args:
        sys.exit(__doc__)
    total = Counter()
    for path in args:
        im = Image.open(path).convert('RGB')
        im.thumbnail((400, 400))
        # کوانتیزه کردن برای گروه‌بندی رنگ‌های نزدیک
        q = im.quantize(colors=k, method=Image.Quantize.MEDIANCUT)
        pal = q.getpalette()
        for count, idx in q.getcolors():
            total[tuple(pal[idx * 3: idx * 3 + 3])] += count
    n = sum(total.values())
    print(f'{"رنگ":8} {"سهم":>6} {"روشنایی":>8} {"با سفید":>7} {"با مشکی":>7}  نزدیک‌ترین توکن فعلی')
    for c, cnt in total.most_common(k):
        near = min(TOKENS.items(), key=lambda t: dist(c, rgb_of(t[1])))
        print(f'{hex_of(c):8} {cnt / n * 100:5.1f}% {lum(c):8.3f} {contrast(c, (255, 255, 255)):7.2f} {contrast(c, (0, 0, 0)):7.2f}  '
              f'{near[0]} {near[1]} (فاصله {dist(c, rgb_of(near[1])):.0f})')


if __name__ == '__main__':
    main()
