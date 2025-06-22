<?php

/**
 * Functions to interact with the Diana API OAuth 2.0 Endpoint
 * for obtaining access tokens using the Client Credentials Grant.
 */

/**
 * Fetches an access token from the Diana API OAuth 2.0 token endpoint.
 *
 * This function sends a POST request to the specified token endpoint
 * with the client ID and client secret to obtain an access token.
 * It's crucial to keep your client_secret confidential and only use this
 * function on the server-side.
 *
 * @param string $clientId The Client ID provided by Zuugle Services.
 * @param string $clientSecret The Client Secret provided by Zuugle Services.
 * @param string $tokenUrl The full URL to the OAuth token endpoint.
 * (e.g., 'https://api.zuugle-services.net/o/token/')
 * @return array|null An associative array containing the access token response (e.g., ['access_token' => '...', 'token_type' => 'Bearer', 'expires_in' => 3600])
 * or null if an error occurred.
 */
function getDianaAccessToken(string $clientId, string $clientSecret, string $tokenUrl = "https://api.zuugle-services.net/o/token/"): ?array
{
    // Check if cURL extension is loaded
    if (!extension_loaded('curl')) {
        error_log('cURL extension is not loaded. Please enable it in your php.ini file.');
        return null;
    }

    // Data for the POST request
    $postData = http_build_query([
        'grant_type' => 'client_credentials',
        'client_id' => $clientId,
        'client_secret' => $clientSecret
    ]);

    // Initialize cURL session
    $ch = curl_init();

    if ($ch === false) {
        error_log('Failed to initialize cURL session.');
        return null;
    }

    // Set cURL options
    curl_setopt($ch, CURLOPT_URL, $tokenUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true); // Return response as a string
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/x-www-form-urlencoded'
    ]);
    // It's good practice to set a timeout.
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10); // 10 seconds connection timeout
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);        // 30 seconds total timeout

    // Execute cURL request
    $response = curl_exec($ch);

    // Check for cURL errors
    if (curl_errno($ch)) {
        error_log('cURL error when fetching access token: ' . curl_error($ch));
        curl_close($ch);
        return null;
    }

    // Get HTTP status code
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    // Close cURL session
    curl_close($ch);

    // Check for successful HTTP status code (usually 200)
    if ($httpCode !== 200) {
        error_log("Failed to get access token. HTTP status code: {$httpCode}. Response: {$response}");
        return null;
    }

    // Decode JSON response
    $tokenData = json_decode($response, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log('Failed to decode JSON response from token endpoint: ' . json_last_error_msg());
        return null;
    }

    // Check if access_token is present in the response
    if (!isset($tokenData['access_token'])) {
        error_log('Access token not found in the response. Response: ' . $response);
        return null;
    }

    return $tokenData;
}

?>
