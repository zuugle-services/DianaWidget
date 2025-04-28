# DianaWidget - Activity Transit Planner Widget

![Widget Preview](preview.png)

![GitHub Workflow Status](https://img.shields.io/github/workflow/status/zuugle-services/DianaWidget/CI)
![Github Release](https://img.shields.io/github/v/release/zuugle-services/DianaWidget)

## Table of Contents
- [Project Overview](#project-overview)
- [Features](#features)
- [Installation](#installation)
- [Development](#development)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Styling System](#styling-system)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Project Overview
A modular JavaScript widget that helps users plan transit connections for activities between specified locations. Key capabilities:
- Location autocomplete with suggestions
- Date/time selection with adaptive calendar
- Connection results with visual timelines
- Flexible activity duration warnings
- Mobile-responsive design
- Error handling and fallback UI

Designed for integration in web applications requiring activity transit planning functionality.

---

## Features
**Core Functionality**
- 🗺️ Interactive map-based location input
- 📅 Adaptive calendar (native on mobile/custom on desktop)
- ⏱ Real-time connection filtering
- 🚦 Activity duration validation
- 🚄 Multi-modal transport visualization

**Technical Highlights**
- CSS Modules with PostCSS processing
- Webpack-based build pipeline
- Accessibility-first implementation
- Configuration validation system
- Comprehensive error handling
- Swipe-friendly mobile UI

---

## Installation
```bash
git clone https://github.com/zuugle-services/DianaWidget.git
cd DianaWidget
npm ci
```

---

## Development

### Scripts
```bash
npm run dev     # Start dev server with hot-reload
npm run build   # Create production bundle
npm run analyze # Analyze bundle size
```

### Key Development Patterns
1. **Widget Initialization**  
   Configure through `window.dianaActivityConfig` in host page:
   ```html
   <script>
   window.dianaActivityConfig = {
     activityName: "Skiing in Alps",
     activityStartLocation: "47.715575,15.804045",
     // ... other config
   };
   </script>
   <script src="dist/DianaWidget.bundle.js"></script>
   ```

2. **Component Structure**  
   - `src/core/widget.js`: Main widget class
   - `src/core/styles/widget.css`: Component styles
   - `src/index.js`: DOM initialization

3. **State Management**  
   Internal state machine tracks:
   - Connection results
   - Selected date/time
   - Loading states
   - Validation warnings

---

## Configuration
**Required Fields**
```js
{
  activityStartLocation: "coordinates|address",
  activityEndLocation: "coordinates|address",
  activityEarliestStartTime: "HH:mm:ss",
  activityLatestEndTime: "HH:mm:ss",
  activityDurationMinutes: Number
}
```

**Optional Parameters**
```js
{
  apiBaseUrl: "https://api.zuugle-services.net",
  activityStartTimeLabel: "Checkin Time", 
  activityEndTimeLabel: "Checkout Time",
  activityStartLocationDisplayName: "Mountain Base Camp"
}
```

---

## Architecture
```bash
├── dist/                   # Built assets
├── src/
│   ├── core/               
│   │   ├── widget.js       # Main widget logic
│   │   └── styles/         # Component styles
│   └── index.js            # Initialization entry
├── webpack.config.js       # Build configuration
└── postcss.config.js       # CSS processing
```

**Key Modules**
1. **Widget Core** (`widget.js`)
   - Configuration validation
   - DOM injection
   - API communication
   - State management

2. **Styling System**
   - CSS Modules with hashed class names
   - PostCSS pipeline with:
     - Nesting rules
     - Auto-prefixing
     - Minification

3. **Build System**
   - Webpack 5 with UMD output
   - CSS extraction/minification
   - Manifest generation

---

## Styling System
**CSS Features**
- Custom properties for theming
- Mobile-first responsive design
- Accessible focus states
- Adaptive calendar UI
- CSS Grid/Flex layouts

**Theming Variables**
```css
.diana-container {
  --primary-color: #4285f4;  /* Main brand color */
  --error-color: #dc3545;    /* Validation errors */
}
```

---

## Deployment
**CI/CD Pipeline** (`.github/workflows/deploy.yml`)
1. Triggered on releases
2. Builds production bundle
3. Deploys via SFTP to:
   ```yaml
   ./dist/DianaWidget.bundle.js → $FTP_SERVER
   ```

**Hosting Requirements**
- Serve `DianaWidget.bundle.js` from CDN
- Add configuration object in host page
- Ensure CORS headers for API access

---

## Contributing
We welcome contributions! Here's how to help:

**Good First Issues**
- Improve keyboard navigation
- Add additional transport icons
- Enhance test coverage
- Optimize calendar performance

**Development Process**
1. Fork repository
2. Create feature branch
3. Submit PR with:
   - Description of changes
   - Updated documentation
   - Passing tests (coming soon!)

**Why Contribute?**
- Solve real-world transit planning challenges
- Work with modern web technologies
- Impact thousands of outdoor enthusiasts
- Learn from production-grade codebase

---

## License
Proprietary software © Zuugle Services GmbH. Contact team@zuugle-services.net for licensing inquiries.

---

> Let's build better outdoor experiences together! 🏔️🚌✨