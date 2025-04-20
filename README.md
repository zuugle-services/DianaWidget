# Diana Widget - Travel Planning Integration

![Diana Widget Preview](./preview.png)
*An interactive widget for seamless travel planning around activities*

## Overview

The **Diana Widget** is a JavaScript component that enables users to plan transportation connections to/from activities while respecting temporal constraints (earliest start time, latest end time, duration). Designed for tourism platforms, event sites, and outdoor activity providers.

**Key Value Proposition**:  
_"Let users focus on their activity - we handle the transit logistics."_

## Core Features

- 🗺️ **Smart Address Autocomplete**  
  Powered by Diana API with OSM integration and station detection
- 📅 **Date/Time Management**  
  Interactive calendar with smart date validation
- ⏱️ **Connection Analysis**  
  Dual-slider interface for inbound/outbound journeys
- ⚠️ **Constraint Warnings**  
  Visual alerts for:
  - Early arrivals
  - Late departures
  - Insufficient activity duration
- 🚆 **Multimodal Support**  
  Icons for 15+ transport types (trains, buses, ferries, etc.)
- ♿ **Accessibility First**  
  ARIA labels, keyboard nav, screen reader support

---

## Technology Stack

| Layer              | Technology                          | Purpose                                  |
|--------------------|-------------------------------------|------------------------------------------|
| **Core**           | Vanilla JavaScript (ES6+)           | No framework dependencies                |
| **Styling**        | CSS Modules + PostCSS               | Scoped styles + modern CSS features      |
| **Bundling**       | Webpack 5                           | Tree-shaking, chunk optimization         |
| **API**            | Diana API (internal)                | Connections + geocoding data             |
| **Testing**        | Manual via `index.html`             | Quick visual validation                  |

---

## Getting Started

### Prerequisites
- Node.js v16+
- NPM v8+
- Access to Diana API credentials

### Installation
```bash
git clone https://github.com/zuugle-services/DianaWidget.git
cd DianaWidget
npm install
```

### Development Workflow

1. **Start dev server**  
   Watches files and auto-rebuilds:
   ```bash
   npm run dev
   ```

2. **Test implementation**  
   Open `index.html` in browser (no live reload - manual refresh required)

3. **Production build**  
   ```bash
   npm run build
   ```
   Outputs to `/dist`:
   - `DianaWidget.bundle.js` (minified)
   - `manifest.json` (build fingerprints)

---

## Development Guide

### Project Structure

```
├── src/
│   ├── widget.js       # Core widget logic
│   └── styles/         # CSS modules
├── dist/               # Built assets
├── webpack.config.js   # Build configuration
└── index.html          # Demo/Test implementation
```

### Key Implementation Files

1. **widget.js**  
   - `DianaWidget` class: Main controller
   - Connection state management
   - DOM manipulation handlers
   - API communication layer

2. **styles/widget.css**  
   - BEM-style CSS modules
   - Theming via CSS custom properties
   - Responsive breakpoints

---
<!--
## Deployment (Pseudo-CDN)

To deploy to company webserver:

1. Build production bundle:
   ```bash
   npm run build
   ```

2. Upload these files to `/public/widget` on webserver:
   - `DianaWidget.bundle.js`
   - Any updated CSS assets

3. Integration snippet for users:
   ```html
   <div id="dianaWidgetContainer"></div>
   <script>
     window.dianaActivityConfig = {
       activityName: "Your Activity",
       activityType: "Museum Visit",
       activityStartLocation: "47.715575,15.804045",
       /* ... other required configs ... */
     };
   </script>
   <script src="https://cdn.yourcompany.com/widget/DianaWidget.bundle.js"></script>
   ```
---
-->

## API Integration

### Required Configuration

All these fields **must** be provided:

```javascript
window.dianaActivityConfig = {
  activityName: "Hiking in Alps",          // Display name
  activityType: "Hiking",                  // Activity category
  activityStartLocation: "47.71,15.80",    // Coordinates/address
  activityStartLocationType: "coordinates",// [coordinates|address|station]
  activityEndLocation: "47.68,15.64", 
  activityEndLocationType: "coordinates",
  activityEarliestStartTime: "09:00:00",   // HH:MM:SS
  activityLatestEndTime: "17:00:00",
  activityDurationMinutes: 180             // Minimum required
};
```

### Response Handling

The widget automatically processes Diana API responses with:

```json
{
  "connections": {
    "to_activity": [...],          // Inbound journeys
    "from_activity": [...],        // Return journeys
    "recommended_to_activity_connection": 1,  // Index of best option
    "recommended_from_activity_connection": 0
  }
}
```

---

## Contributing

### Branch Strategy

1. `main` - Production-ready code
2. `dev` - Active development
3. `feature/*` - New functionality

---