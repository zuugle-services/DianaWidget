# Diana GreenConnect – Full Documentation

This is the detailed reference for the Diana GreenConnect widget. For a quick start, see the [README](../README.md).

## Table of Contents

* [Project Overview](#project-overview)
* [Features](#features)
* [Installation](#installation)
* [Apply for Access & Security Process](#apply-for-access--security-process)
* [Development](#development)
* [Interacting with the Widget](#interacting-with-the-widget)
* [Demo](#demo)
* [Configuration](#configuration)
* [Token Expiration and Refresh](#token-expiration-and-refresh)
* [Styling & Theming](#styling--theming)
* [Architecture](#architecture)
* [TypeScript Types](#typescript-types)
* [Deployment](#deployment)
* [Contributing](#contributing)

## Project Overview

A modular TypeScript widget that helps users plan transit connections for activities between specified locations. Key capabilities:

* Location autocomplete with suggestions
* Date/time selection with adaptive calendar
* Connection results with visual timelines
* Flexible activity duration warnings
* Mobile-responsive design
* Error handling and fallback UI

Designed for integration in web applications requiring activity transit planning functionality.

## Features

**Core Functionality**

* 🗺️ Interactive suggestion-based location input
* 📅 Adaptive calendar (native on mobile/custom on desktop)
* ⏱ Real-time connection filtering
* 🚦 Activity duration validation
* 🚄 Multi-modal transport visualization

**Technical Highlights**

* Written in TypeScript with full type definitions
* CSS Modules with PostCSS processing
* Webpack-based build pipeline
* Accessibility-first implementation
* Configuration validation system
* Comprehensive error handling
* Swipe-friendly mobile UI

## Installation

```
git clone [https://github.com/zuugle-services/DianaWidget.git](https://github.com/zuugle-services/DianaWidget.git)
cd DianaWidget
npm ci
```

## Apply for Access & Security Process

To use the Diana GreenConnect, you need to obtain API credentials which are used to authorize requests to the backend Zuugle Services API. This process ensures secure communication.

### 1. Obtain Credentials

* **Request them from us**: Contact the Zuugle Services team via the [Diana GreenConnect Info Page](https://zuugle-services.com/en/diana-widget/) and we will set up an "Application" for you and send you your credentials. You may also have received them from us already, in which case you can skip this step.
* **Dashboard (may return)**: Credentials used to be available in a self-service dashboard on `zuugle-services.com`. That dashboard is currently not available, but we may bring it back.
* **What you receive**:
   * `Client ID`: A public identifier for your application.
   * `Client Secret`: A confidential key. **This** secret must be **kept secure and should never be exposed in client-side code.**

### 2. Server-Side Access Token Generation

* **Protect Your Secret**: The `Client Secret` is sensitive. To protect it, you must **not** embed it directly into the widget's JavaScript or any client-side code.
* **Backend Logic**: Your website's backend (server-side code, e.g., PHP, Node.js, Python) is responsible for using the `Client ID` and `Client Secret` to request an **Access Token** from the Zuugle Services OAuth 2.0 endpoint.
   * This is typically done using the "Client Credentials" grant type.

Here's an example of how you might fetch the access token using PHP. This assumes you have a file named `oauth2_functions.php` (containing the `getDianaAccessToken` function) and a `client_id_secret.php` file (defining `CLIENT_ID` and `CLIENT_SECRET`).

```php
<?php
// Ensure you have error reporting for debugging, remove for production
error_reporting(E_ALL);
ini_set("display_errors", 1);

// Include the necessary files
// oauth2_functions.php should contain the getDianaAccessToken function
require_once 'oauth2_functions.php';
// client_id_secret.php should define CLIENT_ID and CLIENT_SECRET constants
require_once 'client_id_secret.php';

// Define the token URL (can be overridden if necessary)
$tokenUrl = "https://api.zuugle-services.net/o/token/";

// Call the function to get the token data
$tokenData = getDianaAccessToken(CLIENT_ID, CLIENT_SECRET, $tokenUrl);

if ($tokenData && isset($tokenData['access_token'])) {
    $accessToken = $tokenData['access_token'];
    // Now you have the access token.
    // You would typically pass this token to your frontend/JavaScript.
    // For example, if you're rendering an HTML page with PHP:
    // echo "<script>window.dianaActivityConfig.apiToken = '" . htmlspecialchars($accessToken) . "';</script>";
    // Or, if serving an HTML file, you might replace a placeholder.

    // For demonstration, let's just print it (DO NOT do this in production directly on a page)
    // echo "Access Token: " . htmlspecialchars($accessToken);

} else {
    // Handle the error: token was not obtained
    error_log("Failed to obtain Diana Access Token.");
    // Inform the user or take appropriate action
    // echo "Error: Could not retrieve access token.";
}

?>
```

**Important Security Note:** The `client_id_secret.php` file should define your `CLIENT_ID` and `CLIENT_SECRET` like this and be kept secure on your server:

```php
<?php
// client_id_secret.php
define("CLIENT_ID", "YOUR_ACTUAL_CLIENT_ID");
define("CLIENT_SECRET", "YOUR_ACTUAL_CLIENT_SECRET");
?>
```

Ensure this file is not publicly accessible via the web.

### 3. Configure the Widget with the Access Token

* **Pass Token to Widget**: Once your server obtains an Access Token, it should then pass this token to the DianaWidget when it's initialized on your webpage.
* **Widget Configuration**: The Access Token is provided to the widget via the `apiToken` property in the `window.dianaActivityConfig` object.

```html
<script>
// This accessToken is securely fetched by your server and then passed to the client.
// For example, if using PHP to embed it:
const accessTokenFromServer = "<?php echo htmlspecialchars($php_generated_access_token); ?>";

window.dianaActivityConfig = {
  activityName: "Skiing in Alps",
  // ... other required config (see Configuration section)
  apiToken: accessTokenFromServer, // The token obtained by your server
  // ... optional config (see Configuration section)
};
</script>
<script src="dist/DianaWidget.bundle.js"></script>
```

**In summary:** The `Client Secret` is used by your server to get an `Access Token`. This `Access Token` is then safely passed to the client-side widget. This ensures your `Client Secret` remains secure.

## Development

### Scripts

```sh
npm run dev       # Development build in watch mode
npm run build     # Create production bundle
npm run analyze   # Analyze bundle size
npm test          # Run unit tests
npm run lint      # Run ESLint
npm run typecheck # TypeScript type check
npm run check     # Everything CI runs: lint, types, tests, production build
```

### Key Development Patterns

1.  **Diana GreenConnect Widget Initialization**

Configure through `window.dianaActivityConfig` in host page:

```html
<script>
window.dianaActivityConfig = {
 activityName: "Skiing in Alps",
 activityStartLocation: "47.422, 10.984", // Example coordinates
 activityStartLocationType: "coordinates",
 activityEndLocation: "Alpine Peak",
 activityEndLocationType: "address",
 activityEarliestStartTime: "09:00",
 activityLatestStartTime: "12:00",
 activityEarliestEndTime: "15:00",
 activityLatestEndTime: "17:00",
 activityDurationMinutes: "180",
 // This token is securely fetched by your server and then passed to the client.
 apiToken: "YOUR_SERVER_GENERATED_ACCESS_TOKEN",
 // ... other optional config
};
</script>
<script src="dist/DianaWidget.bundle.js"></script>
```

Place a `div` with the ID `dianaWidgetContainer` (or a custom ID passed to the constructor) where you want the widget to render:

```html
<div id="dianaWidgetContainer"></div>
```

The widget is instantiated like so (typically after the config and bundle script):

```javascript
new window.DianaWidget(window.dianaActivityConfig, "dianaWidgetContainer");
```

If you use a custom container ID, ensure you pass it as the second argument to the `DianaWidget` constructor.

2.  **Component Structure**
   * `src/core/widget.ts`: Main widget class
   * `src/core/styles/widget.scss`: Component styles
   * `src/index.ts`: DOM initialization

3.  **State Management**
    Internal state machine tracks:
   * Connection results
   * Selected date/time
   * Loading states
   * Validation warnings

## Interacting with the Widget

Once initialized, you can interact with the widget instance programmatically.

### `setSelectedDate(dateString)`

You can externally set the activity date of the widget. This is useful for synchronizing the widget's state with other UI elements on your page, like a custom date picker or a list of event dates.

* **`dateString`** (String): The date to set, in `'YYYY-MM-DD'` format.

**Example:**

```javascript
// Assume 'dianaWidgetInstance' is the variable holding your widget instance.
// For example, from: const dianaWidgetInstance = new window.DianaWidget(...);

const myDateButton = document.getElementById('set-date-to-christmas');

myDateButton.addEventListener('click', () => {
  dianaWidgetInstance.setSelectedDate('2024-12-25');
});

```

### `onDateChange` Hook

The `onDateChange` configuration option allows you to register a callback function that will be executed whenever the user changes the date *inside* the widget. This is useful for keeping your page's UI in sync with the widget.

* **`callback`** (Function): A function that receives the new date as a string in `'YYYY-MM-DD'` format.

**Example:**

In your widget configuration, add the `onDateChange` property:

```javascript
window.dianaActivityConfig = {
  // ... other required configurations
  onDateChange: function(newDate) {
    console.log("The date was changed inside the widget to:", newDate);
    
    // Example: Update an external element on your page
    const externalDisplay = document.getElementById('current-widget-date');
    if (externalDisplay) {
      externalDisplay.textContent = `Widget is set to ${newDate}`;
    }
  }
};

// Initialize the widget
const dianaWidgetInstance = new window.DianaWidget(window.dianaActivityConfig, "dianaWidgetContainer");

```

## Demo

A comprehensive demo is available in `index-demo.html`. This page showcases multiple widget configurations for different activities (e.g., a single-day hike, a multi-day trek) and allows you to switch between them to see the widget's versatility.

There are two primary ways to run the demo:

### 1. Using the PHP Development Server (Recommended)

This method simulates a real-world integration where an access token is securely generated on the server and passed to the frontend.

**Prerequisites:**

* PHP installed on your system.
* Your `CLIENT_ID` and `CLIENT_SECRET` added to `client_id_secret.php`.

**Steps:**

1. Start a PHP server in the root directory of the project:
```sh
php -S localhost:8000
```
2. Open your browser and navigate to `http://localhost:8000`.
The `index.php` script will automatically fetch a valid `apiToken` and inject it into the demo page.

### 2. Using the Webpack Dev Server (for UI development)

This method is ideal for making changes to the widget's UI or styles, as it provides hot-reloading.

**Steps:**

1. Run the development command:
```sh
npm run dev
```
2. Webpack will start a server, typically at `http://localhost:8080`. Open `index-demo.html` from the server's context.
3. **Note:** For the widget to make successful API calls in this mode, you must manually edit `index-demo.html`. Replace the placeholder `apiToken` values in the `dianaConfigs` object with a valid, pre-generated access token.

## Configuration

The widget is configured via a JavaScript object, typically `window.dianaActivityConfig`.

**Required Fields**

These fields must be provided in the configuration object for the widget to initialize correctly.

| Option                      | Type          | Description                                                                                                                   | Example                                   |
|:----------------------------|:--------------|:------------------------------------------------------------------------------------------------------------------------------|:------------------------------------------|
| `activityName`              | String        | Name of the activity displayed in the widget header.                                                                          | `"Hiking Trip"`                           |
| `activityStartLocation`     | String        | Coordinates (`lat,lon`) or address string for the activity start location.                                                    | `"47.72620173410345, 13.042174020936743"` |
| `activityStartLocationType` | String        | Type of the start location. Valid types: `"coordinates"`, `"coord"`, `"coords"`, `"address"`, `"station"`.                    | `"coordinates"`                           |
| `activityEndLocation`       | String        | Coordinates (`lat,lon`) or address string for the activity end location.                                                      | `"47.70487271915757, 13.038710343883247"` |
| `activityEndLocationType`   | String        | Type of the end location. Valid types: `"coordinates"`, `"coord"`, `"coords"`, `"address"`, `"station"`.                      | `"address"`                               |
| `activityEarliestStartTime` | String        | Earliest possible start time for the activity (HH:MM or HH:MM:SS in activity's local timezone, defined by `timezone` config). | `"09:00"` / `"09:00:00"`                  |
| `activityLatestStartTime`   | String        | Latest possible start time for the activity (HH:MM or HH:MM:SS in activity's local timezone, defined by `timezone` config).   | `"14:30"` / `"14:30:00"`                  |
| `activityEarliestEndTime`   | String        | Earliest possible end time for the activity (HH:MM or HH:MM:SS in activity's local timezone, defined by `timezone` config).   | `"12:00"` / `"12:00:00"`                  |
| `activityLatestEndTime`     | String        | Latest possible end time for the activity (HH:MM or HH:MM:SS in activity's local timezone, defined by `timezone` config).     | `"20:00"` / `"20:00:00"`                  |
| `activityDurationMinutes`   | String/Number | Required duration of the activity in minutes. Must be a positive integer.                                                     | `240` or `"240"`                          |

**Important Note on Timezones for Activity Times**: The `activityEarliestStartTime`, `activityLatestStartTime`, `activityEarliestEndTime`, and `activityLatestEndTime` should be provided in the local time of the activity. The widget will use the `timezone` configuration (see Optional Parameters) to correctly interpret these times and convert them to UTC for API requests.

**Optional Parameters**

| Option                             | Type             | Default                             | Description                                                                                                                                                                                                                                              | Example                                           |
|:-----------------------------------|:-----------------|:------------------------------------|:---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:--------------------------------------------------|
| `activityStartLocationDisplayName` | String           | `null`                              | Custom display name for the activity start location, shown in the results view.                                                                                                                                                                          | `"Untersbergbahn Talstation"`                     |
| `activityEndLocationDisplayName`   | String           | `null`                              | Custom display name for the activity end location, shown in the results view.                                                                                                                                                                            | `"Eishöhle, Marktschellenberg"`                   |
| `timezone`                         | String           | `"Europe/Vienna"`                   | IANA timezone identifier (e.g., "America/New_York", "Europe/Berlin"). Used for displaying times and interpreting activity times. Validated using Luxon. Invalid values default to `"Europe/Vienna"`.                                                     | `"America/New_York"`                              |
| `activityStartTimeLabel`           | String           | `null`                              | Custom label for the activity start time displayed in the results view (defaults to localized "Activity Start" or similar).                                                                                                                              | `"Tour Begins"`                                   |
| `activityEndTimeLabel`             | String           | `null`                              | Custom label for the activity end time displayed in the results view (defaults to localized "Activity End" or similar).                                                                                                                                  | `"Tour Ends"`                                     |
| `apiBaseUrl`                       | String           | `"https://api.zuugle-services.net"` | Base URL for the Zuugle Services API.                                                                                                                                                                                                                    | `"http://localhost:8000/"`                        |
| `apiToken`                         | String           | `null`                              | **Required.** API token for authenticating with Zuugle Services. **This MUST be a server-obtained Access Token.** See [Apply for Access & Security Process](#apply-for-access--security-process).                                                        | `"your-server-obtained-access-token"`             |
| `language`                         | String           | `"EN"`                              | Language for the widget UI. Supported values: `"EN"`, `"DE"`, `"FR"`, `"IT"`, `"TH"`, or `"ES"`. Case-insensitive (both `"en"` and `"EN"` work). Falls back to `EN` if an unsupported language is provided.                                              | `"DE"` or `"de"`                                  |
| `cacheUserStartLocation`           | Boolean/Function | `true`                              | If `true`, the user's last entered start location (address and coordinates) will be cached in the browser's localStorage. Can also be a callback function that returns a boolean value to dynamically determine if caching should be enabled.            | `false` or `() => shouldCache()`                  |
| `userStartLocationCacheTTLMinutes` | Number           | `15`                                | Time in minutes for how long the cached user start location remains valid. After this period, the cached value is ignored.                                                                                                                               | `120` (for 2 hours)                               |
| `overrideUserStartLocation`        | String           | `null`                              | A specific start location (address string or "latitude,longitude" string) to pre-fill the origin input. This value bypasses any cached location.                                                                                                         | `"Vienna Central Station"` or `"48.2082,16.3738"` |
| `overrideUserStartLocationType`    | String           | `null`                              | Specifies the type of `overrideUserStartLocation`. Must be `"address"` or `"coordinates"` (or `"coord"`, `"coords"`). Required if `overrideUserStartLocation` is set.                                                                                    | `"address"` or `"coordinates"`                    |
| `disableUserStartLocationField`    | Boolean          | `false`                             | If `true`, disables (locks) the user start location input field when `overrideUserStartLocation` is set. If `false`, the field shows the default value but remains editable. Only effective when `overrideUserStartLocation` is provided.                | `true`                                            |
| `displayStartDate`                 | String           | `null`                              | Optional start date (YYYY-MM-DD) for widget visibility. If set, the widget will only display on or after this date.                                                                                                                                      | `"2024-06-01"`                                    |
| `displayEndDate`                   | String           | `null`                              | Optional end date (YYYY-MM-DD) for widget visibility. If set, the widget will only display on or before this date.                                                                                                                                       | `"2024-06-30"`                                    |
| `destinationInputName`             | String           | `null`                              | Custom value for the destination input field. If set, this is used instead of the general activity name.                                                                                                                                                 | `"activity-destination"`                          |
| `fontFamily`                       | String           | `null`                              | Font for the widget (CSS `font-family` value). By default the widget uses the font of the page it is embedded in; hosts can also set the `--font-family` CSS variable on the container.                                                                  | `"'Inter', sans-serif"`                           |
| `maxWidth`                         | String \| Number | `null`                              | Maximum width of the widget (default `470px`). CSS length such as `"100%"`, `"640px"` or `"none"`; a number means pixels. Use `"100%"` to fill the container. Same as the `--diana-max-width` CSS variable. See [Styling & Theming](#styling--theming).   | `"100%"`                                          |
| `maxHeight`                        | String \| Number | `null`                              | Maximum height of the container (default `790px`). CSS length such as `"620px"` or `"none"`; a number means pixels. Same as the `--diana-max-height` CSS variable.                                                                                       | `620`                                             |
| `multiday`                         | Boolean          | `false`                             | If set to `true`, enables multi-day activity mode. When enabled, the widget allows selection of different dates for start and end locations, supporting activities that span multiple days. This affects the calendar UI and connection search behavior. | `true`                                            |
| `overrideActivityStartDate`        | String           | `null`                              | Optional date (YYYY-MM-DD) to pre-select as the activity start date in the calendar. If provided, this date will be automatically selected when the widget loads.                                                                                        | `"2024-06-15"`                                    |
| `overrideActivityEndDate`          | String           | `null`                              | Optional date (YYYY-MM-DD) to pre-select as the activity end date in the calendar. Only used when `multiday` is `true`. If provided, this date will be automatically selected when the widget loads.                                                     | `"2024-06-16"`                                    |
| `activityDurationDaysFixed`        | Number           | `null`                              | When set in multiday mode, fixes the duration of the activity to the specified number of days. This overrides the end date selection, automatically calculating it based on the start date and fixed duration.                                           | `3`                                               |
| `share`                            | Boolean          | `true`                              | If `true`, displays a share button in the widget menu, allowing users to generate a shareable link for their selected journey.                                                                                                                           | `false`                                           |
| `allowShareView`                   | Boolean          | `true`                              | If `true`, the widget can be loaded in a read-only "share view" when a `diana-share` URL parameter is present. Set to `false` to disable this behavior.                                                                                                  | `false`                                           |
| `shareURLPrefix`                   | String           | `null`                              | The base URL to use when generating share links. If `null`, it defaults to the current page's URL (`window.location.href`).                                                                                                                              | `"https://my-domain.com/planner/"`                |
| `hideOverriddenActivityStartDate`  | Boolean          | `true`                              | If `true`, the start date input for single day activities is hidden if fully defined by config (`overrideActivityStartDate`).                                                                                                                            | `false`                                           |
| `showPastConnections`              | Boolean          | `true`                              | When searching for today, also list connections that have already departed, so the whole day can be browsed with "load earlier". Departed connections are marked with a dashed border and stay selectable; the pre-selected connection is the best one that has not left yet. Set to `false` to only show upcoming connections. | `false`                                           |
| `showTicketShopButtons`            | Boolean          | `true`                              | If `false`, no ticket shop ("Buy Ticket") buttons are rendered anywhere in the widget.                                                                                                                                                                  | `false`                                           |
| `dateList`                         | Array            | `null`                              | An array of specific dates (YYYY-MM-DD) for which the activity is available. If provided, the date picker is replaced by a dropdown menu containing only these dates.                                                                                    | `['2024-08-10', '2024-08-17']`                    |
| `onDateChange`                     | Function         | `null`                              | A callback function that is triggered when the date is changed from within the widget. It receives the new date as a string in 'YYYY-MM-DD' format.                                                                                                      | `function(newDate) { console.log(newDate); }`     |
| `onApiTokenExpired`                | Function         | `null`                              | A callback function that is triggered when the API returns a 401 Unauthorized error. It should return a `Promise` that resolves with a new, valid API token. See [Token Expiration and Refresh](#token-expiration-and-refresh) for details.              | `async () => { return await fetchNewToken(); }`   |
| `dev`                              | Boolean          | `false`                             | If `true`, enables development mode with verbose logging to the console and detailled Configuration Error Descriptions. This is useful for debugging during development but should be set to `false` in production environments.                         | `true`                                            |

### Dynamic Cache Control with `cacheUserStartLocation`

The `cacheUserStartLocation` configuration option accepts either a boolean value or a callback function, giving you flexible control over when the user's start location should be cached.

**Using a Boolean Value:**

```javascript
window.dianaActivityConfig = {
  // ... other required configurations
  cacheUserStartLocation: true,  // Always cache
  // or
  cacheUserStartLocation: false, // Never cache
};
```

**Using a Callback Function:**

When you need dynamic control over caching behavior, provide a function that returns a boolean:

```javascript
window.dianaActivityConfig = {
  // ... other required configurations
  
  // Example 1: Only cache for logged-in users
  cacheUserStartLocation: () => {
    return window.currentUser && window.currentUser.isLoggedIn;
  },
  
  // Example 2: Cache based on user preferences
  cacheUserStartLocation: () => {
    const userPreferences = JSON.parse(localStorage.getItem('userPreferences') || '{}');
    return userPreferences.rememberLocation !== false;
  },
  
  // Example 3: Conditional caching based on time of day
  cacheUserStartLocation: () => {
    const hour = new Date().getHours();
    return hour >= 6 && hour < 22; // Only cache during daytime
  },
};
```

The callback function is evaluated each time the widget needs to determine whether to read from or write to the cache. If the callback throws an error, caching is disabled for that operation.

## Token Expiration and Refresh

Access Tokens have a limited lifetime (e.g., 1 hour). When a token expires, API calls will fail with a `401 Unauthorized` status. The widget provides a robust mechanism to handle this seamlessly without requiring a full page reload.

This is managed through the optional `onApiTokenExpired` configuration callback.

### How It Works

1.  **401 Error Detected**: When any API call made by the widget receives a 401 error, it automatically triggers the token refresh process.

2.  **`onApiTokenExpired` Callback**:
    * The widget checks if you have provided an `onApiTokenExpired` function in your configuration.
    * If the function exists, the widget calls it.
    * Your implementation of this function is responsible for contacting your backend to get a new, valid access token.
    * This function **must return a Promise** that resolves with the new token string.

3.  **Automatic Retry**:
    * Once the promise resolves and the widget receives the new token, it automatically updates its internal configuration.
    * It then retries the original API request that failed, using the new token. To the user, this process is completely seamless.

4.  **Graceful Fallback**:
    * If you **do not** provide an `onApiTokenExpired` function, or if the promise returned by your function is rejected (i.e., your backend fails to provide a new token), the widget will enter a "graceful failure" state.
    * In this state:
        * The widget's UI (inputs, buttons) is disabled to prevent further action.
        * A clear message is displayed: "Your session has expired. Please reload the page to continue."
        * A "Reload Page" button is provided, allowing the user to refresh the page, which should trigger your server to provide a fresh token on page load.

### Implementation Example

This is a robust solution that creates a formal contract between the widget and the host page, allowing for a seamless, no-reload token refresh.

```javascript
// In your main page's JavaScript
window.dianaActivityConfig = {
  // ...other required configurations...
  
  /**
   * This function is called by the widget when the API token expires.
   * It must return a Promise that resolves with a new, valid token.string
   */
  onApiTokenExpired: async () => {
    try {
      // Make a call to YOUR backend endpoint that is responsible for
      // generating or refreshing the API token.
      const response = await fetch('/api/get-new-diana-token'); 
      if (!response.ok) {
        throw new Error('Failed to fetch a new token from the server.');
      }
      const data = await response.json();
      return data.accessToken; // JSON like { "accessToken": "new_token_here" }, return the api token string
    } catch (error) {
      console.error('Error refreshing API token:', error);
      // By throwing an error here, you cause the Promise to be rejected,
      // which will trigger the widget's graceful fallback UI.
      throw error; 
    }
  }
};

// Initialize the widget
const dianaWidgetInstance = new window.DianaWidget(window.dianaActivityConfig, "dianaWidgetContainer");
```

By implementing the `onApiTokenExpired` callback, you provide the best possible user experience, while the widget's built-in fallback ensures a safe and user-friendly alternative for all scenarios.

## Styling & Theming

The widget uses CSS custom properties (variables) for easy theming. Since the widget renders its content into a **Shadow DOM** for style encapsulation, you must apply your theme overrides to the **host element**. By default, this is the `div` with the ID `#dianaWidgetContainer`.

**CSS Features**

* Custom properties for theming
* Mobile-first responsive design
* Accessible focus states
* Adaptive calendar UI
* CSS Grid/Flex layouts

**Theming Variables**

To override the default theme, define your custom property values in a CSS rule targeting the widget's container element. These variables will be passed through the Shadow DOM boundary.

Example Override:

```
#dianaWidgetContainer {
  --primary-color: #ff6f61; /* A nice coral color */
  --bg-secondary: #f8f8f8;
  --text-primary: #222;
  --border-primary: #dbdbdb;
  border-radius: 12px; /* You can also style the container itself */
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
}
```

Here is a list of the available variables you can override:

```css
#dianaWidgetContainer {
    /* Base Colors */
    --primary-color: #4285f4;   /* Main interactive elements, highlights */
    --secondary-color: #ccc;    /* Borders, disabled states */
    --warning-color: #ffd38c;   /* Warning backgrounds (e.g., duration warning) */
    --error-color: #dc3545;     /* Error messages */
    --success-color: #28a745;   /* Success indicators (if needed) */

    /* Icon Colors */
    --icon-input-color: #656C6E; /* Icons inside input fields */

    /* Backgrounds */
    --bg-primary: #fff;         /* Main background (form page, sliders) */
    --bg-secondary: #fafafa;    /* Secondary background (results page) */
    --bg-tertiary: #f5f5f5;     /* Disabled input background */
    --bg-hover: #f0f0f0;        /* Hover states for suggestions, buttons */
    --bg-info: #dee4f3;         /* Background for the activity time box */
    --bg-transparent: rgba(128,128,128,0.05); /* Transparent background utility */

    /* Text Colors */
    --text-primary: #000;       /* Primary text, headings */
    --text-secondary: #333;     /* Secondary text, input values */
    --text-tertiary: #666;      /* Tertiary text, labels, back button */
    --text-muted: #838383;      /* Muted text (e.g., time spans in details) */
    --text-disabled: #999;      /* Disabled text, placeholders, footer */

    /* Borders */
    --border-primary: #e0e0e0;   /* Main borders (inputs, headers, footer) */
    --border-secondary: #d3d3d3; /* Secondary borders */
    --border-tertiary: #eaeaea;  /* Tertiary borders (calendar body, hr) */

    /* Shadows */
    --shadow-light: rgba(0,0,0,0.1);   /* Light box shadows */
    --shadow-medium: rgba(0,0,0,0.15); /* Medium box shadows (calendar) */
    --shadow-dark: rgba(0,0,0,0.2);    /* Dark box shadows (modal container) */
}
```

**Sizing options**

By default the widget is at most **470px wide** (centered in its container) and the container is at most
**790px high**. Both limits can be changed with a config option or a CSS variable on the container:

| Limit     | Config option | CSS variable         | Default |
|-----------|---------------|----------------------|---------|
| Width     | `maxWidth`    | `--diana-max-width`  | `470px` |
| Height    | `maxHeight`   | `--diana-max-height` | `790px` |

Values are CSS lengths (`"100%"`, `"640px"`, `"40rem"`, `"none"`, `calc()`/`min()`/`max()`/`clamp()`); a
number means pixels. If both are set, the config option wins. Invalid config values are ignored with a console
warning and the default applies.

To let the widget fill the full width of its column:

```js
new DianaWidget({ /* ... */ maxWidth: '100%' }, 'dianaWidgetContainer');
```

or, without touching the config:

```css
#dianaWidgetContainer {
  --diana-max-width: 100%;
}
```

This replaces any workaround that injects a stylesheet into the widget's shadow root (e.g. overriding
`.modal-content`): internal class names are not part of the public API and may change.

The layout adapts to the available width: wide widgets stretch inputs, the day strip and connection cards;
narrow ones (down to about 300px) show fewer days in the strip. The recommended minimum height is 620px to
ensure proper functionality and display of all widget elements. A `max-height` set directly on the container
(e.g. `style="max-height: 620px"`) keeps working as before.

```html
<div id="dianaWidgetContainer" style="--diana-max-height: 620px;">
</div>
```

You can even set more complex styles to the outermost container, e.g.:

```css
#dianaWidgetContainer {
   background-color: #ffffff;
   border-radius: 0.75rem; /* Border for container */
   box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1); /* Soft shadow */
   overflow: hidden; /* To keep the shadow from leaking onto the main page */
   transition: box-shadow 0.3s ease-in-out; /* Transition animation for shadow */
}
#dianaWidgetContainer:hover {
    box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1); /* Hard shadow on hover */
}
```

## Architecture

```
├── dist/                   # Built assets
├── src/
│   ├── core/
│   │   ├── widget.ts           # Main widget class (~2900 lines)
│   │   ├── StateManager.ts     # State management
│   │   ├── EventManager.ts     # Event handling
│   │   ├── Validator.ts        # Configuration validation
│   │   ├── ConnectionRenderer.ts # Connection rendering
│   │   └── styles/             # Component styles (SCSS)
│   ├── components/
│   │   ├── Calendar.ts         # Calendar components
│   │   ├── PageManager.ts      # Page navigation
│   │   └── UIManager.ts        # UI template management
│   ├── services/
│   │   └── ApiService.ts       # API communication
│   ├── constants/
│   │   └── defaults.ts         # Default values and constants
│   ├── types/
│   │   ├── index.ts            # Type exports
│   │   ├── config.ts           # Configuration types
│   │   ├── state.ts            # State types
│   │   ├── api.ts              # API response types
│   │   └── translations.ts     # Translation types
│   ├── templates/              # UI templates
│   ├── translations.ts         # Language file
│   ├── utils.ts                # Utility functions
│   ├── datetimeUtils.ts        # Datetime utility functions
│   └── index.ts                # Initialization entry point
├── tsconfig.json           # TypeScript configuration
├── eslint.config.mjs       # ESLint configuration
├── webpack.config.js       # Build configuration
└── postcss.config.js       # CSS processing configuration
```

**Key Modules**

1.  **Widget Core** (`widget.ts`)
   * Configuration validation (via `Validator.ts`)
   * DOM injection & manipulation
   * API communication (via `ApiService.ts`)
   * State management (via `StateManager.ts`)
   * Event handling (via `EventManager.ts`)
   * Connection rendering (via `ConnectionRenderer.ts`)
   * Time conversions and calculations (using Luxon)

2.  **Styling System**
   * CSS Modules with hashed class names (via `css-loader`)
   * PostCSS pipeline with:
      * Nesting rules (`postcss-nesting`)
      * Minification (`cssnano`)

3.  **Build System**
   * Webpack 5 bundling TypeScript and injecting CSS
   * TypeScript compilation via `ts-loader`
   * UMD output for compatibility
   * Development server with hot module replacement

## TypeScript Types

The widget is written in TypeScript and exports type definitions for consumers who want type-safe integration.

### Available Types

All types are exported from `src/types/index.ts`:

**Configuration Types**
* `WidgetConfig` - Complete widget configuration interface
* `PartialWidgetConfig` - Partial configuration (for optional fields)
* `LocationType` - Valid location types (`'coordinates' | 'coord' | 'coords' | 'address' | 'station'`)
* `Language` - Supported languages (`'EN' | 'DE' | 'FR' | 'IT' | 'TH' | 'ES'`)

**State Types**
* `WidgetState` - Internal widget state interface
* `ActivityTimes` - Activity time window configuration
* `PreselectTimes` - Preselected time values

**API Response Types**
* `Connection` - A transit connection with legs/elements
* `ConnectionElement` - Individual segment of a journey (walk, transfer, or vehicle)
* `ConnectionElementType` - Type of connection element (`'WALK' | 'TRSF' | 'JNY'`)
* `TransportLeg` - Legacy transport leg interface (deprecated, use `ConnectionElement`)
* `TransportAlert` - Alert/warning for a connection segment (with `severity`, `scope`, optional `url` and validity periods)
* `FlexInfo` - On-demand (GTFS-Flex) service details of a leg (service name, pickup/drop-off windows)
* `LegBooking` / `BookingRule` - Booking requirements of a leg (GTFS-Flex booking rules with booking window)
* `Suggestion` - Address autocomplete suggestion (GeoJSON Feature)
* `SuggestionProperties` - Properties of a suggestion
* `SuggestionGeometry` - Geometry of a suggestion
* `ConnectionSearchResponse` - API response for connection search
* `AutocompleteResponse` - API response for address autocomplete
* `ShareDataResponse` - API response for share data
* `CreateShareResponse` - API response for creating a share link
* `ApiErrorResponse` - API error response structure

**Translation Types**
* `Translations` - Complete translation object
* `LanguageTranslations` - Translations for a single language
* `TranslationFunction` - Function signature for translation lookup

### Type Guards

The following type guard functions are exported for type-safe checking of connection elements:

```typescript
import { isJourneyElement, isWalkElement, isTransferElement } from './types';

// Check if element is a journey (train, bus, etc.)
if (isJourneyElement(element)) {
  console.log(element.vehicle_name);
  console.log(element.direction);
}

// Check if element is a walking segment
if (isWalkElement(element)) {
  console.log('Walking segment');
}

// Check if element is a transfer
if (isTransferElement(element)) {
  console.log('Transfer between platforms');
}
```

## Deployment

### Hosted bundles

| URL | Contents |
|:--|:--|
| `https://diana.zuugle-services.net/dist/DianaWidget.bundle.js` | Latest release, updated on every release |
| `https://diana.zuugle-services.net/dist/DianaWidget.bundle-X.Y.Z.js` | One specific release, never changes |
| `https://diana.zuugle-services.net/dist/DianaWidget.bundle-dev.js` | Development preview, not for production |

Pin a version if you want to roll out updates on your own schedule; the [changelog](../CHANGELOG.md) lists what
changed. Every bundle starts with a banner comment naming its version and commit, and
`window.DianaWidget.version` returns the version at runtime.

### Versioning

Releases follow [semantic versioning](https://semver.org/): a **major** version can require changes to your
embed code or configuration, a **minor** version adds features or options, a **patch** version fixes bugs.
Releases are automated with [release-please](https://github.com/googleapis/release-please):

1. Pull requests are squash-merged and their **title** is a [conventional commit](https://www.conventionalcommits.org/)
   (`feat: …`, `fix(calendar): …`, `docs: …`). `feat` → minor, `fix`/`perf`/others → patch, `feat!:` or a
   `BREAKING CHANGE:` footer → major. A check fails pull requests with a different title.
2. On every push to `main`, `.github/workflows/release-please.yml` keeps one **release pull request**
   (`chore(main): release X.Y.Z`) up to date: it bumps `version` in `package.json` / `package-lock.json` and
   adds the changes to `CHANGELOG.md`. Never edit the version or the changelog by hand (a check fails the PR).
3. **Merging the release pull request deploys.** It creates the tag `vX.Y.Z` and the GitHub Release, and calls
   `.github/workflows/release.yml`.

### What a deploy does

`release.yml` checks out the ref, runs lint and tests, builds, and uploads via SFTP:
`DianaWidget.bundle-X.Y.Z.js` first, then `DianaWidget.bundle.js`, `index-demo.html` and `index.php`. A smoke
check then downloads the public URLs and fails the run unless they serve exactly the file that was built. The
bundle is attached to the GitHub Release. Two deploys to the same target never run at once.

Manual deploy, re-deploy or **rollback** to any tag, branch or commit:

```sh
gh workflow run release.yml -f ref=v1.16.0 -f channel=production
gh workflow run release.yml -f ref=my-branch -f channel=dev   # preview as DianaWidget.bundle-dev.js
```

Every push to the `dev` branch deploys the dev bundle (`.github/workflows/deploy-dev.yml`).

Configuration: repository secrets `FTP_SERVER`, `FTP_PORT`, `FTP_USERNAME`, `FTP_PASSWORD`; optional
repository variable `WIDGET_BASE_URL` (default `https://diana.zuugle-services.net`) for the smoke check.

### Continuous integration

* `ci.yml` (every pull request and push to `main`): lint, type check, tests, production build, bundle size.
* `pr-guards.yml`: conventional pull request title; `scripts/repo-guards.mjs` rejects credential files
  (`.env`, `client_id_secret.php`), hand-edited versions/changelog, and changes to CI/release configuration
  without the `allow-protected` label.
* `npm ci` installs a git pre-commit hook (`.githooks/pre-commit`) running the same guards and ESLint on the
  staged files.
* Runner: all workflows run on the company's self-hosted runner (label `self-hosted`). Pull requests from
  forks always run on GitHub's runners instead, so outside code never reaches the self-hosted machine. Fallback
  when the self-hosted runner is down: set the repository variable `ACTIONS_RUNNER` to `"ubuntu-latest"` (every
  workflow), or for one deploy `gh workflow run release.yml -f ref=v1.16.0 -f channel=production -f runner=github-hosted`.

### Hosting the bundle yourself

* Serve `DianaWidget.bundle.js` from your own web server or CDN, or use the hosted URLs above.
* Include the widget script in your HTML page *after* defining the `window.dianaActivityConfig` object and ensuring `apiToken` is populated correctly for your environment.
* Ensure the host page has a `<div id="dianaWidgetContainer"></div>` (or your custom ID) element.

## Contributing

We welcome contributions! Here's how to help:

**Development Process**

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feat/your-feature-name`).
3.  Make your changes.
4.  Ensure `npm run check` passes (lint, types, tests, build).
5.  Submit a Pull Request (PR) with a [conventional commit](https://www.conventionalcommits.org/) title
    (e.g. `feat: add a dark theme option`, `fix: keep the selected date on month change`) and:
   * A clear description of the changes.
   * Any necessary updates to this README.
   * Information about how to test your changes.

**Why Contribute?**

* Solve real-world transit planning challenges for activities.
* Work with modern web technologies (ES modules, CSS variables, Webpack).
* Impact users needing efficient travel planning.
* Learn from a production-grade widget codebase.

> Let's build better activity planning experiences together! 🏔️🚌✨

**Contributors**

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/sheikh-tabarak">
        <img src="https://github.com/sheikh-tabarak.png" width="100px;" alt="Sheikh Tabarak"/><br />
        <sub>
          <b>Sheikh Tabarak</b>
        </sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/spheppner">
        <img src="https://github.com/spheppner.png" width="100px;" alt="Simon Heppner"/><br />
        <sub>
          <b>Simon Heppner</b>
        </sub>
      </a>
    </td>
  </tr>
</table>