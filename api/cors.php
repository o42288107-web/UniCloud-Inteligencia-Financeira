<?php
// cors.php
$allowed_origins = [
    "http://localhost:5173",
    "https://your-domain.com"
];

if (isset($_SERVER['HTTP_ORIGIN']) && in_array($_SERVER['HTTP_ORIGIN'], $allowed_origins)) {
    header("Access-Control-Allow-Origin: " . $_SERVER['HTTP_ORIGIN']);
} else {
    // Default to strict or allow * if you prefer public access (comment out below)
    // header("Access-Control-Allow-Origin: *"); 
    // Ideally for production with credentials:
    if (isset($_SERVER['HTTP_ORIGIN'])) {
        header("Access-Control-Allow-Origin: " . $_SERVER['HTTP_ORIGIN']); // Reflection (Use with caution or specific list)
    }
}
// Fallback (commented out for production security)
// header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}
?>
