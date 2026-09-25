# First weather on slow 4G — before-h2 (2026-09-24T23:09:59.231Z)

Local build over HTTP/2 (like Vercel's edge) through a server-imposed slow-4G link (150 ms per response + one shared 1.6 Mbit/s pipe), brotli like Vercel; /api/weather stubbed with a real payload after 1,600 ms (cold cell) or 80 ms (edge hit). Median of 2 cold visits (fresh browser profile each).

| phone | forecast | first weather | real photo on screen | LCP | downloaded |
|---|---|---:|---:|---:|---:|
| Android mid-range | cold cell | 5.0 s | 5.5 s | 2.0 s | 444 KB |
| Android mid-range | edge hit | 2.1 s | 2.8 s | 1.5 s | 444 KB |
| Al's iPhone 11 (Chrome) | cold cell | 3.1 s | 3.9 s | 1.7 s | 445 KB |
| Al's iPhone 11 (Chrome) | edge hit | 1.9 s | 2.9 s | 1.6 s | 435 KB |

Request timeline of the first Android cold-cell run (ms from navigation):

- 96-428 / 13KB
- 455-1213 /assets/app.css 15KB
- 1348-1613 /assets/images/grain.png 3KB
- 573-1985 /assets/images/bg/default.jpg 50KB
- 574-2078 /assets/app.js 51KB
- 1225-3001 /assets/type-prototype.css 48KB
- 2126-3059 /sw.js 2KB
- 2153-3063 /api/version 0KB
- 2174-3340 /assets/chunks/en-B6BR5OID.js 16KB
- 2935-3393 /assets/install.js 10KB
- 2259-3564 /assets/chunks/hero-lines-BWNLMMJF.js 34KB
- 1662-3813 /assets/type-prototype-caption.css 102KB
- 2935-4706 /api/weather 2KB
- 4793-5526 /assets/images/bg-canonical/fd0a18b25b4e35699d54747d494468b1cba98548bfd9557ada359f04686f9b41.webp 98KB
