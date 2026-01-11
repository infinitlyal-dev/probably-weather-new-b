# Copilot Custom Instructions - Probably Weather

## Project Overview

**Probably Weather** is a Progressive Web App (PWA) that aggregates weather forecasts from multiple sources to provide a "probable" weather prediction. The app combines data from Open-Meteo, WeatherAPI.com, and MET Norway using median aggregation to increase forecast reliability.

### Tech Stack
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Backend**: Serverless API function (Vercel/similar platform)
- **Build System**: None - uses native ES modules
- **Data Sources**: Open-Meteo, WeatherAPI.com, MET Norway
- **PWA**: Service Worker for offline support and caching

## Repository Structure

```
/
├── index.html          # Main application entry point
├── assets/
│   ├── app.js         # Main application JavaScript
│   ├── app.css        # Application styles
│   └── images/        # Background images organized by weather condition
├── api/
│   └── weather.js     # Serverless function for weather data aggregation
├── sw.js              # Service Worker for PWA functionality
├── manifest.json      # PWA manifest
└── package.json       # Minimal package.json (type: module)
```

## Coding Standards

### JavaScript
- **Use ES6+ features**: Arrow functions, async/await, template literals, destructuring
- **No TypeScript**: This is a vanilla JavaScript project
- **Module type**: ESM (ES Modules) - use `import`/`export` syntax where applicable
- **No bundler**: Code runs directly in the browser without transpilation
- **Error handling**: Always use try-catch blocks for async operations
- **Null safety**: Use optional chaining (`?.`) and nullish coalescing (`??`) operators

### API Development (`api/weather.js`)
- **Timeout handling**: All external API calls must have timeouts (currently 9000ms)
- **Graceful degradation**: API should work even if some data sources fail
- **Median aggregation**: Use median values to combine multiple sources
- **Environment variables**: 
  - `WEATHERAPI_KEY` - Required for WeatherAPI.com access
  - `MET_USER_AGENT` - User-Agent string for MET Norway API (required by their terms)
- **Response format**: Always return JSON with `ok` boolean and appropriate status codes

### Service Worker (`sw.js`)
- **Versioning**: Increment `SW_VERSION` when making changes to cache strategy
- **Cache strategy**:
  - Network-first for HTML/JS/CSS
  - Stale-while-revalidate for images
- **Core assets**: Update `CORE_ASSETS` array when adding new critical files

### CSS
- **No preprocessor**: Vanilla CSS only
- **Naming**: Use kebab-case for class names
- **Responsive design**: Mobile-first approach
- **Theme**: Dark theme with dynamic backgrounds based on weather conditions

### HTML
- **Semantic markup**: Use appropriate HTML5 semantic elements
- **Accessibility**: Include ARIA labels and alt text for images
- **Progressive enhancement**: Core functionality should work without JavaScript

## Development Guidelines

### Working with Weather Data
- **Three data sources**: Open-Meteo (no key), WeatherAPI (requires key), MET Norway (requires User-Agent)
- **Aggregation logic**: Use median values to combine forecasts
- **Weather codes**: Different sources use different code systems - see mapping objects in `api/weather.js`
- **Units**: 
  - Temperature: Celsius by default, convertible to Fahrenheit
  - Wind speed: km/h by default, convertible to m/s or mph
  - Precipitation: Probability percentage (0-100)

### Testing
- **No automated test framework**: Manual testing required
- **Test multiple data sources**: Verify behavior when sources fail
- **Test offline functionality**: Check PWA offline support
- **Test responsiveness**: Verify on mobile and desktop viewports

### Common Tasks

**Adding a new weather data source:**
1. Add fetch logic in `api/weather.js` with timeout and error handling
2. Map the source's weather codes to descriptive strings
3. Add normalized data to `norms`, `hourlies`, and `dailies` arrays
4. Add source name to `failures` array on error

**Updating the service worker:**
1. Increment `SW_VERSION` in `sw.js`
2. Update `CORE_ASSETS` if adding new critical files
3. Test cache invalidation by checking browser DevTools → Application → Cache Storage

**Adding new background images:**
1. Add images to `assets/images/bg/{condition}/{time-of-day}.jpg`
2. Update image loading logic in `assets/app.js` if needed
3. Optimize images before adding (target < 500KB per image)

## Environment Setup

### Required Environment Variables
```
WEATHERAPI_KEY=your_api_key_here
MET_USER_AGENT=ProbablyWeather/1.0 (contact: your@email.com)
```

### Running Locally
This is a static site with a serverless API function. For local development:
1. Serve the root directory with any static server (e.g., `npx serve`)
2. Configure serverless function locally (Vercel CLI: `vercel dev`)
3. Ensure environment variables are set

## Best Practices

### Security
- **Never commit API keys**: Use environment variables
- **Validate input**: Always validate lat/lon parameters in API
- **Rate limiting**: Be mindful of API rate limits from data sources
- **User-Agent**: Always include proper User-Agent for MET Norway API

### Performance
- **Minimize DOM manipulation**: Batch updates when possible
- **Use caching**: Leverage service worker for offline support
- **Optimize images**: Compress background images before adding
- **Async loading**: Use lazy loading for non-critical resources

### Accessibility
- **Keyboard navigation**: Ensure all interactive elements are keyboard-accessible
- **Screen readers**: Use semantic HTML and ARIA labels
- **Color contrast**: Maintain WCAG AA standards (especially with dark theme)
- **Loading states**: Provide clear feedback during data fetching

## Data Sources & Attribution

- **Open-Meteo**: Free, no API key required, CC BY 4.0 license
- **WeatherAPI.com**: Requires API key, free tier available
- **MET Norway**: Free, requires User-Agent header, CC BY 4.0 license

Always maintain proper attribution in the footer and respect each API's terms of service.

## Notes

- **No dependencies**: This project intentionally avoids build tools and frameworks for simplicity
- **ES Modules**: Use `type: "module"` for modern JavaScript features
- **PWA-first**: Offline functionality is a core feature, not an afterthought
- **Median aggregation**: This is the key differentiator - combining multiple sources for better accuracy
