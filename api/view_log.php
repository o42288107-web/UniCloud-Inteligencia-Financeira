<?php
header("Content-Type: text/plain");
$logFile = "api_log.txt";

if (file_exists($logFile)) {
    echo "--- Log Content ---\n";
    echo file_get_contents($logFile);
} else {
    echo "Log file not found at $logFile";
}
?>
