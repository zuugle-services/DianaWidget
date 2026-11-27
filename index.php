<?php

// Deployed to /demo/ on the widget host, where the shared PHP helpers and the credentials live one level up.
// Locally (repo root) they sit next to this file.
$shared = is_file(__DIR__ . "/oauth2_functions.php") ? __DIR__ : dirname(__DIR__);

include($shared . "/oauth2_functions.php");
include($shared . "/client_id_secret.php");

$html = file_get_contents(__DIR__ . "/index-demo.html");

$access_token = getDianaAccessToken(CLIENT_ID, CLIENT_SECRET, "https://api.zuugle-services.net/o/token/", dev_mode)["access_token"];

$html = str_replace('// apiToken: "test_token", //', 'apiToken: "' . $access_token . '",', $html);

echo $html;

?>
