# DianaWidget TypeScript Refactoring Plan

## Current Progress (Last Updated: 2025-11-27)

### ✅ COMPLETED:
- **Phase 1:** Project Setup & Configuration (TypeScript, ts-loader, tsconfig.json, webpack, Jest, ESLint)
- **Phase 2:** Type Definitions & Interfaces (src/types/ directory with all core types)
- **Phase 3.1-3.4:** File Migrations (utils.ts, datetimeUtils.ts, translations.ts, all templates, components)
- **Phase 3.5:** Migrate `src/core/widget.js` → `src/core/widget.ts` (3320+ lines → 2924 lines after extractions)
- **Phase 3.6:** Entry point (index.ts)
- **Phase 4.1:** Extract large methods - COMPLETED:
  - Extracted validation logic into `src/core/Validator.ts` (~200 lines)
  - Created and integrated `src/services/ApiService.ts` (~260 lines)
  - Created `src/core/StateManager.ts` (~280 lines) - state management class with getter/setter properties
  - Created `src/core/EventManager.ts` (~250 lines) - event binding and cleanup management
  - **NEW:** Created `src/core/ConnectionRenderer.ts` (~520 lines) - connection rendering, summaries, and alerts
    - Extracted `renderConnectionDetails()` method (~220 lines)
    - Extracted `_renderConnectionSummary()` method (~50 lines)
    - Extracted `renderAlert()` method (~65 lines)
    - Extracted `getDurationString()` method (~30 lines)
    - Added supporting private methods for waiting blocks and element rendering
- **Phase 4.3:** Add strict null checks - COMPLETED:
  - Enabled `strictNullChecks: true` in tsconfig.json
  - Fixed ~201 TypeScript errors across Calendar.ts, widget.ts, and other files
  - Added null guards for DOM elements with optional chaining (`?.`) and nullish coalescing (`??`)
  - Updated WidgetInstance interface to allow null for container and dianaWidgetRootContainer
  - Fixed all Date handling to handle null/undefined cases
- **Phase 4.4:** Improve type safety (replace `any` types) - COMPLETED:
  - Added `ConnectionElement` interface with all required properties and `readonly` modifiers
  - Added `ConnectionElementType` type alias ('WALK' | 'TRSF' | 'JNY')
  - Added type guard functions: `isJourneyElement()`, `isWalkElement()`, `isTransferElement()`
  - Updated `Connection` interface with `connection_id`, `connection_anytime`, `connection_elements`, `connection_transfers`, `connection_ticketshop_provider`
  - Updated `Suggestion` interface to match GeoJSON-like API response with `diana_properties` and `geometry`
  - Updated `WidgetState.availableDates` to use Luxon `DateTime[]` instead of `Date[]`
  - Removed all `as any` type assertions (except one necessary for URLSearchParams)
  - Removed all `: any` type annotations
  - Added `readonly` to all API response interfaces for immutability
  - Added typed return values to all ApiService methods (AddressSuggestionsResponse, ReverseGeocodeResponse, ConnectionSearchResponse, TicketshopLinkResponse, CreateShareResponse, ShareDataResponse)
- **Phase 4.5:** Clean Up Code Patterns - COMPLETED:
  - Replaced callback-based patterns with async/await in `showError()` method
  - Extracted `renderDebugContent()` helper method to reduce code duplication
  - Updated internal state properties to use camelCase:
    - `warning_duration` → `warningDuration` in `ActivityTimes` interface
    - `to_start`, `to_end`, `from_start`, `from_end` → `toStart`, `toEnd`, `fromStart`, `fromEnd` in `PreselectTimes` interface
  - Fixed naming convention: `fetch_lang` → `fetchLang` in `fetchSuggestions()`
  - Removed unused `Suggestion` type import from widget.ts
  - Marked intentionally unused parameter with underscore prefix: `_index` in `getDurationString()`
  - Build passes with `--noUnusedLocals` and `--noUnusedParameters`
- **Phase 7.3:** Final Cleanup - COMPLETED:
  - Removed unused `js-base64` dependency from package.json
  - All lint issues fixed (0 errors, 3 warnings for intentionally unused catch variables)
  - `.gitignore` reviewed - no changes needed

### ⏭️ NEXT STEP TO CONTINUE:
- **Phase 6.2:** Functional Testing (Widget-level)
  - Test widget initialization with various configurations (requires API credentials)
  - Test address autocomplete functionality
  - Test calendar interactions (both single and range)
  - Test connection search and results display
- **Phase 6.3:** Visual Regression Testing
  - Compare widget appearance before and after migration
  - Test on multiple browsers

### ✅ RECENTLY COMPLETED (Phase 7):
- **Phase 7.1:** Document Type Exports - Added "TypeScript Types" section to README.md with all type exports and type guards
- **Phase 7.2:** JSDoc/TSDoc Comments - All public interfaces and exported functions documented
- **Phase 7.3:** Final Cleanup - Removed unused `js-base64`, lint issues fixed, .gitignore reviewed

### 💡 FUTURE CONSIDERATIONS:
- **CI/CD Automated Testing:** Token generation via `/o/token/` endpoint is possible for automated testing, but client ID/secret would need to be secured via GitHub Secrets since this is a public repository. The widget currently works without a token for rough testing (shows configuration validation errors gracefully).

### 📝 NOTES:
- tsconfig.json now uses `strictNullChecks: true` while keeping `strict: false` and `noImplicitAny: false` for continued gradual migration
- Build passes successfully with `npm run build` (bundle size: ~675 KiB)
- ESLint passes with 0 errors and 3 warnings (intentionally unused catch variables). Run `npm run lint` to check code quality.
- Dynamic imports in UIManager use `.js` extension which webpack resolves correctly at build time
- widget.ts migration includes:
  - Class property declarations with types
  - Constructor parameter types
  - Method return type annotations where critical
  - Proper type definitions for API responses (no more `any` types)
  - Custom interfaces: WidgetElements (ApiError, FetchOptions moved to services)
  - Event handler type casting for DOM events
- Validator.ts: Extracted config validation logic (~130 lines) into separate module
- ApiService.ts: Created API service class with fetch delegation, error handling, and type exports
- StateManager.ts: Created state management class (~280 lines) with getter/setter properties and helper methods
- EventManager.ts: Created event manager class (~250 lines) for DOM event binding and cleanup
- ConnectionRenderer.ts: Created connection rendering class (~520 lines) for connection details and summaries:
  - `renderConnectionDetails()` - renders detailed connection information with waiting blocks
  - `renderConnectionSummary()` - renders compact summary for collapsible headers
  - `renderAlert()` - renders connection element alerts with expandable sections
  - `getDurationString()` - generates duration strings for connection elements
  - Private helper methods for waiting blocks and element rendering
- Type safety improvements:
  - `Connection` now has proper types for all properties used in widget.ts
  - `ConnectionElement` interface added for connection leg/segment data with `readonly` properties
  - `ConnectionElementType` type alias for 'WALK' | 'TRSF' | 'JNY'
  - Type guard functions exported: `isJourneyElement()`, `isWalkElement()`, `isTransferElement()`
  - `Suggestion` interface matches actual GeoJSON-like API response structure
  - All `as any` type assertions removed from widget.ts (only `Record<string, string>` for URLSearchParams remains)
  - API response interfaces use `readonly` for immutability safety
- Code pattern cleanup (Phase 4.5):
  - Internal state interfaces now use camelCase (`warningDuration`, `toStart`, `toEnd`, `fromStart`, `fromEnd`)
  - Helper method `renderDebugContent()` extracted to reduce code duplication
  - All unused imports and parameters addressed (build passes with `--noUnusedLocals` and `--noUnusedParameters`)

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

### 1.6 Setup ESLint for TypeScript
- [x] Install ESLint with TypeScript support:
  ```bash
  npm install --save-dev eslint @eslint/js typescript-eslint
  ```
- [x] Create `eslint.config.mjs` with TypeScript-specific rules
- [x] Add `npm run lint` script to package.json
- Note: ESLint is configured with recommended rules plus TypeScript-specific rules. Run `npm run lint` to check for issues.

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
- [x] Define `CalendarOptions` interface (via WidgetInstance in Calendar.ts)
- [x] Define `PageManagerOptions` interface (constructor parameters typed inline)
- [x] Define `UIManagerOptions` interface (TemplateArgs and TemplateModule in UIManager.ts)
- [x] Define template argument interfaces for each template function (SingleCalendarArgs defined in singleCalendarTemplate.ts)
- Note: These were added as components were migrated in Phase 3

### 2.4 Create Utility Types
- [x] Define `DateTimeConfig` interface for datetime utilities (DurationResult and LocaleMap in datetimeUtils.ts)
- [x] Define function parameter and return types for utility functions (all functions typed in utils.ts and datetimeUtils.ts)
- Note: These were added as utility files were migrated in Phase 3

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
**STATUS: COMPLETED**
- [x] Rename `src/core/widget.js` → `src/core/widget.ts`
    - [x] Define class properties with types (WidgetElements interface, config, state, etc.)
    - [x] Type constructor parameters (`config: PartialWidgetConfig`, `containerId: string`)
    - [x] Type critical class methods with return types
    - [x] Type event handlers and callbacks with proper DOM event casting
    - [x] Type API response handling with ApiError and FetchOptions interfaces
    - [x] Add proper DOM typing for Shadow DOM operations
    - [x] Type the translation function `t()` with proper return type

### 3.6 Migrate Entry Point
- [x] Renamed `src/index.js` → `src/index.ts` (completed)
- [x] Updated export statement

---

## Phase 4: Code Cleanup & Refactoring

### 4.1 Extract Large Methods
- [x] Identify methods in `widget.ts` exceeding 50 lines (identified: renderConnectionDetails 226 lines, constructor 187 lines, _initCustomCalendar 178 lines, setupEventListeners 144 lines, validateConfig 131 lines, etc.)
- [x] Create `src/services/ApiService.ts` with types and base implementation
- [x] Integrate ApiService into widget.ts (widget now delegates to ApiService.fetch())
- [x] Extract state management into `src/core/StateManager.ts`
- [x] Extract event binding logic into `src/core/EventManager.ts`
- [x] Extract validation logic into `src/core/Validator.ts`

### 4.2 Improve Module Organization
- [x] Create `src/services/` directory for API-related code
- [x] Create `src/services/ApiService.ts` with ApiError, FetchOptions types and helper functions
- [x] Create `src/services/index.ts` barrel export
- [x] Create `src/constants/` directory for magic values and config defaults
- [x] Create `src/constants/defaults.ts` with DEFAULT_CONFIG, DEFAULT_STATE, and other constants
- [x] Add type guards `isValidLocationType()` and `isCoordinateLocationType()` in defaults.ts
- [x] Create `src/constants/index.ts` barrel export
- [x] Update `widget.ts` to use imported constants and type guards
- [x] Move CSS/SCSS type declarations to `src/types/styles.d.ts` (already exists)
- [x] Create barrel exports (`index.ts`) in each directory

### 4.3 Add Strict Null Checks
- [x] Enable `strictNullChecks` in `tsconfig.json`
- [x] Add null guards where DOM elements are accessed
- [x] Handle potential undefined values from API responses
- [x] Add optional chaining (`?.`) and nullish coalescing (`??`) where appropriate
- **Note:** All 201 TypeScript errors were fixed when strictNullChecks was enabled

### 4.4 Improve Type Safety
- [x] Replace `any` types with specific types (aim for zero `any` usage)
  - Added `ConnectionElement` interface with all required properties
  - Updated `Connection` interface with all used properties
  - Updated `Suggestion` interface to match GeoJSON-like API response
  - Updated `WidgetState.availableDates` to use Luxon `DateTime[]`
  - Removed all `as any` type assertions (only `Record<string, string>` for URLSearchParams remains)
- [x] Use discriminated unions for different connection types
  - Added `ConnectionElementType` type alias for 'WALK' | 'TRSF' | 'JNY'
  - Added type guard functions: `isJourneyElement()`, `isWalkElement()`, `isTransferElement()`
  - These allow type-safe access to element-specific properties when checking element types
- [x] Add generic types where reusable patterns exist
  - ApiService now uses proper typed return values for all API methods:
    - `fetchAddressSuggestions()` returns `AddressSuggestionsResponse`
    - `fetchReverseGeocode()` returns `ReverseGeocodeResponse`
    - `fetchConnections()` returns `ConnectionSearchResponse`
    - `generateTicketshopLink()` returns `TicketshopLinkResponse`
    - `createShare()` returns `CreateShareResponse`
    - `fetchShare()` returns `ShareDataResponse`
  - Note: Generic fetch method not added as specific types provide better type safety
- [x] Use `readonly` for immutable properties
  - Added `readonly` to all API response interface properties that shouldn't be modified:
    - `ConnectionElement` properties (departure_time, arrival_time, vehicle_type, etc.)
    - `Connection` properties (id, connection_id, timestamps, etc.)
    - `TransportLeg` properties
    - `TransportAlert` properties
    - `Suggestion`, `SuggestionProperties`, `SuggestionGeometry` properties
    - `ConnectionSearchResponse`, `AutocompleteResponse`, `ShareDataResponse`, `ApiErrorResponse` properties

### 4.5 Clean Up Code Patterns
- [x] Replace callback-based patterns with async/await where appropriate
  - Refactored `showError()` method to use async IIFE instead of `.then().catch()` chains
  - Extracted `renderDebugContent()` helper method to reduce code duplication
- [x] Ensure consistent naming conventions (camelCase for functions/variables, PascalCase for types/classes)
  - Fixed `fetch_lang` → `fetchLang` in `fetchSuggestions()`
  - Updated `ActivityTimes.warning_duration` → `ActivityTimes.warningDuration`
  - Updated `PreselectTimes` properties: `to_start`/`to_end`/`from_start`/`from_end` → `toStart`/`toEnd`/`fromStart`/`fromEnd`
- [x] Remove any dead/unused code detected by TypeScript compiler
  - Removed unused `Suggestion` import from widget.ts
  - Prefixed intentionally unused `index` parameter with underscore in `getDurationString()`
  - Build passes with `--noUnusedLocals` and `--noUnusedParameters` flags
- Note: `Map` and `Set` usage was evaluated but plain objects are appropriate for current use cases (API params, translation lookups)

---

## Phase 5: Style & Asset Handling

### 5. 1 Add SCSS Module Declarations
- [x] Create `src/types/styles.d.ts` with module declarations for `.scss`, `.css`, `.sass` files
- [x] Verify SCSS imports work correctly in TypeScript files (confirmed: widget.ts imports styles from './styles/widget.scss')

### 5. 2 Verify Asset Bundling
- [x] Confirm fonts are still inlined as base64 (DMSans font in bundle)
- [x] Confirm CSS is still processed through the PostCSS pipeline (tailwind.config.js and postcss.config.js)
- [x] Verify Shadow DOM style injection still works (build successful)

---

## Phase 6: Testing & Validation

### 6.1 Build Verification
- [x] Run `npm run build` and verify single bundle output
- [x] Compare bundle size before and after migration (~675 KiB)
- [x] Verify `dist/DianaWidget.bundle.js` is generated correctly
- [x] Test UMD export works (`window.DianaWidget`) - Verified via browser test: `typeof window.DianaWidget === "function"`

### 6. 2 Functional Testing
- [x] Unit tests for utility functions (`utils.ts`, `datetimeUtils.ts`)
  - Created `src/__tests__/utils.test.ts` with 17 tests
  - Created `src/__tests__/datetimeUtils.test.ts` with 27 tests
  - All 44 tests passing
- [ ] Test widget initialization with various configurations
- [ ] Test address autocomplete functionality
- [ ] Test calendar interactions (both single and range)
- [ ] Test connection search and results display
- [ ] Test all language translations
- [ ] Test error handling and display
- [ ] Test mobile/responsive behavior
- [ ] Test accessibility features
- **Note:** Full functional testing requires API credentials and is better suited for manual testing or CI/CD with secrets

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
- [x] Update README.md with TypeScript information
  - Updated project overview to mention TypeScript
  - Added TypeScript to technical highlights
  - Updated scripts section with `npm run test` and `npm run lint`
  - Updated component structure with `.ts` extensions
  - Updated architecture section with full TypeScript directory structure
  - Updated Key Modules to reference TypeScript modules
  - Updated Build System to mention TypeScript compilation
- [x] Document new type exports for external consumers - Added "TypeScript Types" section to README.md (2025-11-27)
  - Documented all configuration types (WidgetConfig, PartialWidgetConfig, LocationType, Language)
  - Documented all state types (WidgetState, ActivityTimes, PreselectTimes)
  - Documented all API response types (Connection, ConnectionElement, Suggestion, etc.)
  - Documented type guard functions (isJourneyElement, isWalkElement, isTransferElement)
- [x] Update development instructions - README.md already contains comprehensive development instructions

### 7.2 Add JSDoc/TSDoc Comments
- [x] Add TSDoc comments to all public interfaces
  - All interfaces in `src/types/` have TSDoc comments
  - `WidgetConfig`, `WidgetState`, `Connection`, `ConnectionElement`, `Suggestion`, etc.
- [x] Add TSDoc comments to all exported functions
  - All exported functions in `utils.ts` and `datetimeUtils.ts` have TSDoc comments
  - All functions include `@param` and `@returns` annotations
- [x] Document complex type unions and generics - Documented in README.md TypeScript Types section

### 7.3 Final Cleanup
- [x] Remove any remaining `.js` files from `src/` (confirmed: no .js files remaining)
- [x] Remove unused dependencies from `package.json` - Removed `js-base64` (2025-11-27)
- [x] Update `.gitignore` if needed - No changes needed
- [x] Run final linting pass (`npm run lint`) and fix all issues
- [x] Fix ESLint issues - Fixed all 12 errors (2025-11-27):
  - Fixed `prefer-const` errors by auto-fix
  - Fixed `@typescript-eslint/no-unused-expressions` in widget.ts by converting `&&` expressions to proper if statements
  - Fixed `@typescript-eslint/no-unused-vars` by prefixing unused catch variables with underscore
  - Fixed `@typescript-eslint/no-explicit-any` in `fetchActivityData()` by changing return type from `Promise<any>` to `Promise<void>`
  - Fixed `@typescript-eslint/no-this-alias` in utils.ts by adding eslint-disable comments (legitimate use case for context preservation)
  - Remaining 3 warnings are for intentionally unused catch variables (accepted pattern)

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
│   │   ├── widget.ts            # Main widget class (~2924 lines)
│   │   ├── StateManager.ts      # State management (~280 lines)
│   │   ├── EventManager.ts      # Event handling (~250 lines)
│   │   ├── Validator.ts         # Configuration validation (~200 lines)
│   │   ├── ConnectionRenderer.ts # Connection rendering (~520 lines)
│   │   └── styles/
│   │       └── widget.scss      # Component styles
│   ├── components/
│   │   ├── Calendar.ts          # Calendar components
│   │   ├── PageManager.ts       # Page navigation
│   │   └── UIManager.ts         # UI template management
│   ├── services/
│   │   └── ApiService.ts        # API communication (~260 lines)
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
├── eslint.config.mjs            # ESLint configuration (flat config)
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