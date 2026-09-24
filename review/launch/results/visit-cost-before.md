# Visit cost — before (2026-09-24T22:10:21.785Z)

Local build, stub API (no provider touched), brotli like Vercel, Chromium phone 414x715.

| scenario | API calls | calls by route | bytes over the network | requests |
|---|---:|---|---:|---:|
| first-gps | 2 | /api/version ×1, /api/weather ×1 | 445 KB (html 13, script 112, style 166, image 152, api 3) | 14 |
| return | 2 | /api/version ×1, /api/weather ×1 | 0 KB (html 0, style 0, script 0, image 0, api 0) | 1 |
| first-denied | 3 | /api/version ×1, /api/locate ×1, /api/weather ×1 | 445 KB (html 13, script 112, style 166, image 152, api 3) | 15 |
| search | 5 | /api/version ×1, /api/weather ×3, /api/geocode?search ×1 | 445 KB (html 13, script 112, style 166, image 152, api 3) | 15 |
| browse | 2 | /api/version ×1, /api/weather ×1 | 445 KB (html 13, script 112, style 166, image 152, api 3) | 14 |

Every API call, in order:

- **first-gps**: /api/version? → /api/weather?lat=-34.1163&lon=18.8362&name=My+Location
- **return**: /api/version? → /api/weather?lat=-34.1163&lon=18.8362&name=Strand
- **first-denied**: /api/version? → /api/locate? → /api/weather?lat=-34.1&lon=18.8&name=Strand%2C+ZA
- **search**: /api/version? → /api/weather?lat=-34.1163&lon=18.8362&name=My+Location → /api/geocode?type=search&q=Durban → /api/weather?lat=-29.8587&lon=31.0218&name= → /api/weather?lat=-29.8587&lon=31.0218&name=Durban%2C+South+Africa
- **browse**: /api/version? → /api/weather?lat=-34.1163&lon=18.8362&name=My+Location
