<?php

error_reporting(E_ALL);
ini_set("display_errors", 1);

include("oauth2_functions.php");
include("client_id_secret.php");

$html = file_get_contents("index-demo.html");

$access_token = getDianaAccessToken(CLIENT_ID, CLIENT_SECRET, dev_mode: dev_mode)["access_token"];

$html = str_replace('// apiToken: "test_token", //', 'apiToken: "' . $access_token . '",', $html);

echo $html;

?>