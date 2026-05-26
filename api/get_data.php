<?php
// get_data.php - Secure Data Provider

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require 'auth_utils.php';

// Require 'user:read' scope
require_auth('user:read');

$tenantId = $_GET['tenant_id'] ?? '';
$type = $_GET['type'] ?? '';

if (!$tenantId || !$type) {
    http_response_code(400);
    echo json_encode(["error" => "Missing tenant_id or type"]);
    exit;
}

// Security: Prevent Directory Traversal
// Security: Sanitize Tenant ID (Allow alphanumeric, dashes, underscores)
// Security: Sanitize Tenant ID (Allow alphanumeric, dashes, underscores)
$inputTenantId = preg_replace('/[^a-zA-Z0-9_\-]/', '', $tenantId);

// Resolve effective Tenant Directory
$basePath = "data/";
$resolvedTenantId = null;

// Strategy 1: Use input exact (e.g. SUPER_ADMIN, UUID)
if (is_dir($basePath . $inputTenantId)) {
    $resolvedTenantId = $inputTenantId;
} 
// Strategy 2: If fail, try strict numeric (CNPJ fix: 21.992... -> 21992...)
else {
    $numericId = preg_replace('/[^0-9]/', '', $inputTenantId);
    if (!empty($numericId) && is_dir($basePath . $numericId)) {
        $resolvedTenantId = $numericId;
    }
}

// Fallback or Fail
if (!$resolvedTenantId) {
    // Just default to input to let file_exists return false gracefully below
    $resolvedTenantId = $inputTenantId;
}

$file = $basePath . $resolvedTenantId . "/" . $type . ".json";

if (file_exists($file)) {
    $content = file_get_contents($file);
    echo $content;
} else {
    echo json_encode([]);
}
?>
