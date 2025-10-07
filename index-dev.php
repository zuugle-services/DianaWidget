<?php
// Set error reporting for development
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Include necessary files
include("oauth2_functions.php");
// IMPORTANT: Create a separate client_id_secret_dev.php for your dev credentials
// to avoid committing them to your main branch.
if (file_exists("client_id_secret_dev.php")) {
    include("client_id_secret_dev.php");
} else {
    // Fallback to production secrets if dev-specific one doesn't exist,
    // but log a warning. This is not ideal for production.
    include("client_id_secret.php");
    error_log("Warning: client_id_secret_dev.php not found. Falling back to production secrets.");
}

// Read the HTML template
$html = file_get_contents("index-demo-dev.html");

// Define constants for client credentials if not already defined
if (!defined('CLIENT_ID_DEV')) {
    define('CLIENT_ID_DEV', defined('CLIENT_ID') ? CLIENT_ID : '');
}
if (!defined('CLIENT_SECRET_DEV')) {
    define('CLIENT_SECRET_DEV', defined('CLIENT_SECRET') ? CLIENT_SECRET : '');
}

// Fetch the access token using dev credentials.
// Using a different token URL for dev environment.
$tokenUrl = "https://api-dev.zuugle-services.net/o/token/";
$accessToken = null;
$tokenData = getDianaAccessToken(CLIENT_ID_DEV, CLIENT_SECRET_DEV, $tokenUrl, true); // dev_mode = true

if ($tokenData && isset($tokenData["access_token"])) {
    $accessToken = $tokenData["access_token"];
    // Replace the placeholder in the HTML file
    $html = str_replace('// apiToken: "test_token_dev", //', 'apiToken: "' . $accessToken . '",', $html);
} else {
    $errorMessage = "Failed to obtain development access token. Please check credentials and API status.";
    error_log($errorMessage);
    // Optionally, display an error in the widget container
    $errorJs = "document.getElementById('dianaWidgetContainer').innerHTML = '<div style=\"padding: 20px; color: red;\">Error: Could not load API token.</div>';";
    $html = str_replace('<script src="./dist/DianaWidget.bundle-dev.js"></script>', '<script>' . $errorJs . '</script>', $html);
}


// Output the final HTML
echo $html;

?>
