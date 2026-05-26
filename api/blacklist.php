<?php
// blacklist.php - Manage Blocked IPs

function is_ip_blacklisted($ip) {
    // Check local blacklist file
    $file = __DIR__ . "/data/blacklist.json";
    if (file_exists($file)) {
        $list = json_decode(file_get_contents($file), true);
        return isset($list[$ip]);
    }
    return false;
}

function blacklist_ip($ip, $reason = "Manual Block") {
    $dir = __DIR__ . "/data";
    if (!file_exists($dir)) mkdir($dir, 0777, true);
    
    $file = $dir . "/blacklist.json";
    $list = [];
    if (file_exists($file)) {
        $list = json_decode(file_get_contents($file), true) ?? [];
    }
    
    if (!isset($list[$ip])) {
        $list[$ip] = [
            "timestamp" => date("Y-m-d H:i:s"),
            "reason" => $reason
        ];
        file_put_contents($file, json_encode($list, JSON_PRETTY_PRINT));
        
        // Also log to security log
        $log = __DIR__ . "/logs";
        if (!file_exists($log)) mkdir($log, 0777, true);
        file_put_contents($log . "/security.log", "[" . date("Y-m-d H:i:s") . "] BANNED IP: $ip - Reason: $reason\n", FILE_APPEND);
    }
}

function check_blacklist() {
    $ip = $_SERVER['REMOTE_ADDR'];
    if (is_ip_blacklisted($ip)) {
        http_response_code(403);
        die("<h1>403 Forbidden</h1><p>Access Denied.</p>");
    }
}
?>
