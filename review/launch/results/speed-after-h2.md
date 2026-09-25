# First weather on slow 4G — after-h2 (2026-09-24T23:12:36.915Z)

Local build over HTTP/2 (like Vercel's edge) through a server-imposed slow-4G link (150 ms per response + one shared 1.6 Mbit/s pipe), brotli like Vercel; /api/weather stubbed with a real payload after 1,600 ms (cold cell) or 80 ms (edge hit). Median of 2 cold visits (fresh browser profile each).

| phone | forecast | first weather | real photo on screen | LCP | downloaded |
|---|---|---:|---:|---:|---:|
| Android mid-range | cold cell | 4.5 s | 5.2 s | 3.9 s | 445 KB |
| Android mid-range | edge hit | 1.9 s | 3.0 s | 1.8 s | 445 KB |
| Al's iPhone 11 (Chrome) | cold cell | 2.9 s | 3.6 s | 2.3 s | 445 KB |
| Al's iPhone 11 (Chrome) | edge hit | 1.7 s | 2.8 s | 2.3 s | 445 KB |

Request timeline of the first Android cold-cell run (ms from navigation):

- 18-350 / 13KB
- 357-975 /assets/app.css 15KB
- 1095-1323 /assets/images/grain.png 3KB
- 506-1521 /assets/app.js 51KB
- 1611-3022 /api/version 0KB
- 1587-3022 /sw.js 2KB
- 1136-3192 /assets/type-prototype.css 48KB
- 1616-3440 /assets/chunks/en-B6BR5OID.js 16KB
- 2747-3440 /assets/install.js 10KB
- 1697-3703 /assets/chunks/hero-lines-BWNLMMJF.js 34KB
- 1540-3842 /assets/images/bg/default.jpg 50KB
- 2464-4150 /assets/type-prototype-caption.css 102KB
- 2463-4244 /api/weather 2KB
- 4396-5143 /assets/images/bg-canonical/fd0a18b25b4e35699d54747d494468b1cba98548bfd9557ada359f04686f9b41.webp 98KB
