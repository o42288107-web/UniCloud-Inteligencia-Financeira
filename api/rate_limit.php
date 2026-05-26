<?php
// rate_limit.php - Simple File-Based Rate Limiting

function check_rate_limit($action, $limit = 5, $window = 900) {
    // $action: Identifier (e.g., 'login', 'license_check')
    // $limit: Max attempts
    // $window: Time window in seconds (900s = 15m)

    $ip = $_SERVER['REMOTE_ADDR'];
    $file = "temp/rate_limit_" . md5($ip . $action) . ".json";
    
    // Create temp dir if not exists
    if (!file_exists("temp")) {
        mkdir("temp", 0777, true);
        // Protect temp dir
        file_put_contents("temp/.htaccess", "Deny from all");
    }

    $data = ['attempts' => 0, 'first_attempt' => time()];
    
    if (file_exists($file)) {
        $data = json_decode(file_get_contents($file), true);
    }

    // Reset if window passed
    if (time() - $data['first_attempt'] > $window) {
        $data = ['attempts' => 0, 'first_attempt' => time()];
    }

    // Increment
    $data['attempts']++;
    
    // Save
    file_put_contents($file, json_encode($data));

    // Check Limit
    if ($data['attempts'] > $limit) {
        header("HTTP/1.1 429 Too Many Requests");
        header("Retry-After: " . ($window - (time() - $data['first_attempt'])));
        echo json_encode(["error" => "Rate limit exceeded. Try again later."]);
        exit;
    }
}
?>
