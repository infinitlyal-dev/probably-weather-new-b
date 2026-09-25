# First weather on slow 4G — before (2026-09-24T23:07:44.951Z)

Local build through a server-imposed slow-4G link (150 ms per response + one shared 1.6 Mbit/s pipe), brotli like Vercel; /api/weather stubbed with a real payload after 1,600 ms (cold cell) or 80 ms (edge hit). Median of 2 cold visits (fresh browser profile each).

| phone | forecast | first weather | real photo on screen | LCP | downloaded |
|---|---|---:|---:|---:|---:|
| Android mid-range | cold cell | 5.5 s | 6.2 s | 2.2 s | 555 KB |
| Android mid-range | edge hit | 2.3 s | 2.9 s | 1.2 s | 530 KB |
| Al's iPhone 11 (Chrome) | cold cell | 4.0 s | 4.7 s | 2.3 s | 640 KB |
| Al's iPhone 11 (Chrome) | edge hit | 2.7 s | 3.8 s | 2.3 s | 640 KB |

Request timeline of the first Android cold-cell run (ms from navigation):

- 13-371 / 13KB
- 397-1210 /assets/app.css 15KB
- 1364-2012 /assets/images/grain.png 3KB
- 557-2186 /assets/images/bg/default.jpg 50KB
- 559-2355 /assets/app.js 51KB
- 1225-2492 /assets/type-prototype.css 48KB
- 2491-3449 /api/version 0KB
- 2463-3450 /sw.js 2KB
- 2504-3624 /assets/chunks/en-B6BR5OID.js 16KB
- 3452-3872 /assets/install.js 10KB
- 2626-4012 /assets/chunks/hero-lines-BWNLMMJF.js 34KB
- 1575-4105 /assets/type-prototype-caption.css 102KB
- 3451-5297 /api/weather 2KB
- 5400-6166 /assets/images/bg-canonical/fd0a18b25b4e35699d54747d494468b1cba98548bfd9557ada359f04686f9b41.webp 98KB
- 7482-7764 /install 2KB
- 7478-7794 / 13KB
- 7480-7794 /index.html 13KB
