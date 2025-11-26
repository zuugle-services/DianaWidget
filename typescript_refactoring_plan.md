# DianaWidget TypeScript Refactoring Plan

## Current Progress (Last Updated: 2025-11-26)

### ✅ COMPLETED:
- **Phase 1:** Project Setup & Configuration (TypeScript, ts-loader, tsconfig.json, webpack, Jest)
- **Phase 2:** Type Definitions & Interfaces (src/types/ directory with all core types)
- **Phase 3.1-3.4:** File Migrations (utils.ts, datetimeUtils.ts, translations.ts, all templates, components)
- **Phase 3.6:** Entry point (index.ts)

### ⏭️ NEXT STEP TO CONTINUE:
- **Phase 3.5:** Migrate `src/core/widget.js` → `src/core/widget.ts` (3320 lines - largest file)

### 📝 NOTES:
- tsconfig.json uses lenient settings (strict: false, noImplicitAny: false, strictNullChecks: false) for gradual migration
- Build passes successfully with `npm run build`
- Dynamic imports in UIManager use `.js` extension which webpack resolves correctly at build time

---

## Overview
This plan outlines the migration of DianaWidget from JavaScript to TypeScript while:
- Maintaining the single bundled output (`DianaWidget.bundle.js`)
- Preserving all existing functionality and visuals
- Improving code quality and maintainability

---

## Phase 1: Project Setup & Configuration

### 1.1 Install TypeScript Dependencies
- [x] Install TypeScript and related packages:
  ```bash
  npm install --save-dev typescript ts-loader @types/node
  ```
- [x] Install type definitions for existing dependencies:
  ```bash
  npm install --save-dev @types/luxon
  ```

### 1.2 Create TypeScript Configuration
- [x] Create `tsconfig.json` in project root with appropriate settings:
    - `target`: ES2020 or higher
    - `module`: ESNext
    - `strict`: true (enables all strict type-checking options)
    - `esModuleInterop`: true (for compatibility with CommonJS modules)
    - `declaration`: false (not needed for bundled output)
    - `sourceMap`: true (for debugging)
    - `outDir`: leave unset (Webpack handles output)
    - Include `src/**/*` in compilation
    - Note: `allowJs`, `checkJs: false`, and `noImplicitAny: false` are temporarily enabled to support gradual migration

### 1. 3 Update Webpack Configuration
- [x] Add `ts-loader` to `webpack.config.js`:
  ```javascript
  {
    test: /\.tsx?$/,
    use: 'ts-loader',
    exclude: /node_modules/
  }
  ```
- [x] Update entry point from `./src/index.js` to `./src/index.ts`
- [x] Add `. ts` and `.tsx` to resolve extensions:
  ```javascript
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx']
  }
  ```
- [x] Verify single-bundle output settings remain intact (`LimitChunkCountPlugin`, `splitChunks: false`)

### 1.4 Update Tailwind Configuration
- [x] Update `tailwind.config.js` content paths to include `. ts` files:
  ```javascript
  content: ["./src/**/*.{html,js,ts,tsx}"]
  ```

### 1.5 Update Jest Configuration
- [x] Install Jest TypeScript support:
  ```bash
  npm install --save-dev ts-jest @types/jest
  ```
- [x] Update `jest.config.js` for TypeScript support

---

## Phase 2: Type Definitions & Interfaces

### 2.1 Create Core Type Definitions
- [x] Create `src/types/` directory
- [x] Create `src/types/index.ts` for exporting all types
- [x] Define `WidgetConfig` interface (API token, language, activity settings, etc.)
- [x] Define `WidgetState` interface (selected dates, connections, loading states, etc.)
- [x] Define `Connection` interface (transport data structures)
- [x] Define `TransportLeg` interface (individual leg details)
- [x] Define `Location` interface (address autocomplete results)

### 2.2 Create Translation Types
- [x] Define `TranslationKeys` interface based on `translations.js` structure
- [x] Define `Language` type union (`'EN' | 'DE' | 'FR'` etc.)
- [x] Create strongly-typed translation function signature

### 2. 3 Create Component Types
- [ ] Define `CalendarOptions` interface
- [ ] Define `PageManagerOptions` interface
- [ ] Define `UIManagerOptions` interface
- [ ] Define template argument interfaces for each template function
- Note: These will be added as components are migrated in Phase 3

### 2.4 Create Utility Types
- [ ] Define `DateTimeConfig` interface for datetime utilities
- [ ] Define function parameter and return types for utility functions
- Note: These will be added as utility files are migrated in Phase 3

### 2.5 Create SCSS Module Declarations
- [x] Create `src/types/styles.d.ts` with module declarations for `.scss`, `.css`, `.sass` files

---

## Phase 3: File Migration (Bottom-Up Approach)

### 3.1 Migrate Utility Files (No Dependencies)
- [x] Rename `src/utils. js` → `src/utils. ts`
    - Add type annotations to all functions (`debounce`, `throttle`, `formatDateForDisplay`, `getApiErrorTranslationKey`, etc.)
    - Add return types to all exported functions
- [x] Rename `src/datetimeUtils.js` → `src/datetimeUtils. ts`
    - Type all datetime manipulation functions
    - Use Luxon's built-in TypeScript types (`DateTime`, `Duration`, etc.)
    - Add explicit types for all date/time parameters

### 3. 2 Migrate Translation File
- [x] Rename `src/translations. js` → `src/translations.ts`
    - Define translation object type using `Translations` type from types/
    - Export typed translation object
    - Ensure type-safe key access

### 3. 3 Migrate Template Files
- [x] Renamed all template files from `.js` to `.ts`:
    - [x] `src/templates/partials/_widgetHeader.ts`
    - [x] `src/templates/partials/_menuDropdown.ts`
    - [x] `src/templates/singleCalendarTemplate.ts` - Added SingleCalendarArgs interface
    - [x] `src/templates/rangeCalendarModalTemplate.ts`
    - [x] `src/templates/formPageTemplate.ts`
    - [x] `src/templates/resultsPageTemplate.ts`
    - [x] `src/templates/contentPageTemplate.ts`
    - [x] `src/templates/helpContent.ts`
- [x] Fixed all `.js` extension imports throughout codebase
- Note: Additional type annotations can be added progressively

### 3. 4 Migrate Component Files
- [x] Rename `src/components/Calendar.js` → `src/components/Calendar.ts`
    - Added property declarations and type annotations for SingleCalendar class
    - Added property declarations and type annotations for RangeCalendarModal class
    - Added WidgetInstance interface for type-safe widget reference
- [x] Rename `src/components/UIManager.js` → `src/components/UIManager.ts`
    - Added TemplateArgs and TemplateModule interfaces
    - Typed template loading method
- [x] Rename `src/components/PageManager.js` → `src/components/PageManager.ts`
    - Added HTMLElement property declarations
    - Typed all public methods with return types

### 3.5 Migrate Core Widget File
**STATUS: NOT STARTED - Next step for continuation**
- [ ] Rename `src/core/widget.js` → `src/core/widget.ts`
    - Define class properties with types
    - Type constructor parameters (`config`, `containerId`)
    - Type all class methods
    - Type event handlers and callbacks
    - Type API response handling
    - Add proper DOM typing for Shadow DOM operations
    - Type the translation function `t()`

### 3.6 Migrate Entry Point
- [x] Renamed `src/index.js` → `src/index.ts` (completed)
- [x] Updated export statement

---

## Phase 4: Code Cleanup & Refactoring

### 4.1 Extract Large Methods
- [ ] Identify methods in `widget.ts` exceeding 50 lines
- [ ] Extract API communication logic into `src/services/ApiService.ts`
- [ ] Extract state management into `src/core/StateManager.ts`
- [ ] Extract event binding logic into `src/core/EventManager.ts`
- [ ] Extract validation logic into `src/core/Validator.ts`

### 4.2 Improve Module Organization
- [ ] Create `src/services/` directory for API-related code
- [ ] Create `src/constants/` directory for magic values and config defaults
- [ ] Move CSS/SCSS type declarations to `src/types/styles.d.ts`
- [ ] Create barrel exports (`index.ts`) in each directory

### 4. 3 Add Strict Null Checks
- [ ] Enable `strictNullChecks` in `tsconfig. json`
- [ ] Add null guards where DOM elements are accessed
- [ ] Handle potential undefined values from API responses
- [ ] Add optional chaining (`?.`) and nullish coalescing (`??`) where appropriate

### 4.4 Improve Type Safety
- [ ] Replace `any` types with specific types (aim for zero `any` usage)
- [ ] Use discriminated unions for different connection types
- [ ] Add generic types where reusable patterns exist
- [ ] Use `readonly` for immutable properties

### 4.5 Clean Up Code Patterns
- [ ] Replace callback-based patterns with async/await where appropriate
- [ ] Use `Map` and `Set` instead of plain objects where appropriate
- [ ] Ensure consistent naming conventions (camelCase for functions/variables, PascalCase for types/classes)
- [ ] Remove any dead/unused code detected by TypeScript compiler

---

## Phase 5: Style & Asset Handling

### 5. 1 Add SCSS Module Declarations
- [ ] Create `src/types/styles.d. ts` with module declarations:
  ```typescript
  declare module '*.scss' {
    const content: string;
    export default content;
  }
  declare module '*.css' {
    const content: string;
    export default content;
  }
  ```
- [ ] Verify SCSS imports work correctly in TypeScript files

### 5. 2 Verify Asset Bundling
- [ ] Confirm fonts are still inlined as base64
- [ ] Confirm CSS is still processed through the PostCSS pipeline
- [ ] Verify Shadow DOM style injection still works

---

## Phase 6: Testing & Validation

### 6.1 Build Verification
- [ ] Run `npm run build` and verify single bundle output
- [ ] Compare bundle size before and after migration
- [ ] Verify `dist/DianaWidget. bundle.js` is generated correctly
- [ ] Test UMD export works (`window.DianaWidget`)

### 6. 2 Functional Testing
- [ ] Test widget initialization with various configurations
- [ ] Test address autocomplete functionality
- [ ] Test calendar interactions (both single and range)
- [ ] Test connection search and results display
- [ ] Test all language translations
- [ ] Test error handling and display
- [ ] Test mobile/responsive behavior
- [ ] Test accessibility features

### 6.3 Visual Regression Testing
- [ ] Compare widget appearance before and after migration
- [ ] Verify all CSS animations work correctly
- [ ] Test on multiple browsers (Chrome, Firefox, Safari, Edge)
- [ ] Test on mobile devices

### 6.4 Integration Testing
- [ ] Test widget in demo HTML pages (`index-demo.html`, `index-demo-dev.html`)
- [ ] Verify configuration options work as documented
- [ ] Test API integration with real endpoints

---

## Phase 7: Documentation & Cleanup

### 7. 1 Update Documentation
- [ ] Update README.md with TypeScript information
- [ ] Document new type exports for external consumers
- [ ] Update development instructions

### 7.2 Add JSDoc/TSDoc Comments
- [ ] Add TSDoc comments to all public interfaces
- [ ] Add TSDoc comments to all exported functions
- [ ] Document complex type unions and generics

### 7.3 Final Cleanup
- [ ] Remove any remaining `. js` files from `src/`
- [ ] Remove unused dependencies from `package.json`
- [ ] Update `. gitignore` if needed
- [ ] Run final linting pass

---

## Proposed Final Directory Structure

```
DianaWidget/
├── dist/
│   └── DianaWidget. bundle.js    # Single bundled output (unchanged)
├── src/
│   ├── index.ts                 # Entry point
│   ├── translations.ts          # Language files
│   ├── utils.ts                 # General utilities
│   ├── datetimeUtils.ts         # DateTime utilities
│   ├── types/
│   │   ├── index.ts             # Type exports
│   │   ├── config.ts            # Configuration types
│   │   ├── state.ts             # State types
│   │   ├── api.ts               # API response types
│   │   ├── translations.ts      # Translation types
│   │   └── styles.d. ts          # CSS/SCSS module declarations
│   ├── core/
│   │   ├── widget.ts            # Main widget class
│   │   ├── StateManager.ts      # State management
│   │   ├── EventManager.ts      # Event handling
│   │   ├── Validator.ts         # Configuration validation
│   │   └── styles/
│   │       └── widget.scss      # Component styles
│   ├── components/
│   │   ├── Calendar.ts          # Calendar components
│   │   ├── PageManager.ts       # Page navigation
│   │   └── UIManager.ts         # UI template management
│   ├── services/
│   │   └── ApiService.ts        # API communication
│   ├── constants/
│   │   └── defaults.ts          # Default values and constants
│   └── templates/
│       ├── types.ts             # Template argument types
│       ├── formPageTemplate.ts
│       ├── resultsPageTemplate.ts
│       ├── singleCalendarTemplate.ts
│       ├── rangeCalendarModalTemplate.ts
│       ├── helpContent. ts
│       └── partials/
│           ├── _widgetHeader.ts
│           └── _menuDropdown.ts
├── tsconfig.json                # TypeScript configuration
├── webpack.config.js            # Updated for TypeScript
├── package.json                 # Updated dependencies
└── ... 
```

---

## Notes

- **Bundle Output**: The single-file bundle output is ensured by Webpack's `LimitChunkCountPlugin` and `splitChunks: false` settings, which are independent of whether the source is JavaScript or TypeScript.
- **Migration Strategy**: Use a bottom-up approach (utilities → components → core) to minimize circular dependency issues.
- **Gradual Migration**: You can rename files one at a time and fix type errors incrementally.  Webpack will handle mixed `. js` and `.ts` files during the transition.
- **Preserve Functionality**: No logic changes should be made during the initial migration—focus only on adding types.  Refactoring can happen afterward.