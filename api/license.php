<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require 'auth_utils.php';
require 'rate_limit.php';

// Rate Limit: 10 attempts per hour for licenses
check_rate_limit('license_check', 10, 3600);

$raw_input = file_get_contents("php://input");
file_put_contents("license_debug.txt", "Raw Input: " . $raw_input . "\nJSON Error: " . json_last_error_msg() . "\n", FILE_APPEND);
$data = json_decode($raw_input, true);
$key = trim($data['key'] ?? '');

if (!$key) {
    http_response_code(400);
    echo json_encode(["error" => "Missing License Key"]);
    exit;
}

$licensesFile = "data/licenses.json";
if (!file_exists($licensesFile)) {
    http_response_code(500);
    echo json_encode(["error" => "License system not initialized"]);
    exit;
}

$licenses = json_decode(file_get_contents($licensesFile), true);
$valid = false;
$tenantId = '';

foreach ($licenses as $license) {
    if ($license['key'] === $key && $license['active']) {
        $valid = true;
        $tenantId = $license['tenant_id'];
        break;
    }
}

if ($valid) {
    // Generate Token
    // Scope: agent:push
    $payload = [
        "sub" => "agent_" . $tenantId,
        "tenant_id" => $tenantId,
        "scope" => "agent:push",
        "role" => "agent"
    ];
    
    // Expires in 24 hours for Agents (longer than users to avoid frequent re-auth, but still limited)
    $token = generate_jwt($payload, 86400);
    
    echo json_encode([
        "success" => true,
        "token" => $token,
        "expires_in" => 86400
    ]);
} else {
    http_response_code(401);
    echo json_encode(["error" => "Invalid or Inactive License Key"]);
}
?>
