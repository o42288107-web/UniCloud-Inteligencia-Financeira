<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require 'auth_utils.php';

// Verify JWT Token
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? '';

if (empty($authHeader) || !preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
    http_response_code(401);
    echo json_encode(["error" => "Missing or invalid token"]);
    exit;
}

$token = $matches[1];
$decoded = validate_jwt($token);

if (!$decoded) {
    http_response_code(401);
    echo json_encode(["error" => "Invalid or expired token"]);
    exit;
}

// Only allow client or super_admin roles
// validate_jwt returns an array
$role = $decoded['role'] ?? '';
if (!in_array($role, ['client', 'super_admin', 'admin'])) {
    http_response_code(403);
    echo json_encode(["error" => "Insufficient permissions"]);
    exit;
}

// Get Input
$data = json_decode(file_get_contents("php://input"), true);
$start_date = $data['start_date'] ?? '';
$end_date = $data['end_date'] ?? '';

if (empty($start_date) || empty($end_date)) {
    http_response_code(400);
    echo json_encode(["error" => "Missing start_date or end_date"]);
    exit;
}

// Validate date format (YYYY-MM-DD)
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $start_date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $end_date)) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid date format. Use YYYY-MM-DD"]);
    exit;
}

// Queue File Path
$queueFile = __DIR__ . "/data/tasks.json";
if (!file_exists($queueFile)) {
    file_put_contents($queueFile, json_encode([]));
}
$tasks = json_decode(file_get_contents($queueFile), true) ?? [];

// Tenant ID identification (Same normalization as rest of app)
// We need to know WHICH tenant is triggering this so the collector knows to pick it up.
$tenantId = $decoded['tenant_id'] ?? ''; 

// Fallback or Normalize
if (empty($tenantId) && isset($decoded['cnpj'])) {
    $tenantId = $decoded['cnpj'];
}

// FORCE NORMALIZATION (Digits only) to match Collector's behavior
$tenantId = preg_replace('/[^0-9]/', '', $tenantId);

if (empty($tenantId)) {
    // Fallback: If we can't identify, use 'default' or '1'
    $tenantId = '1'; 
}

// CLEAN SLATE: Delete old reconciliation file to ensure freshness
$safeTenantId = preg_replace('/[^0-9]/', '', $tenantId);
$oldReconFile = __DIR__ . "/data/" . $safeTenantId . "/reconciliation.json";
if (file_exists($oldReconFile)) {
    unlink($oldReconFile);
}

$newTask = [
    'id' => uniqid('recon_', true),
    'tenant_id' => $tenantId, // Collector must poll with this same ID
    'type' => 'reconciliation',
    'params' => [
        'start_date' => $start_date,
        'end_date' => $end_date
    ],
    'status' => 'pending',
    'created_at' => date('c')
];

$tasks[] = $newTask;

if (file_put_contents($queueFile, json_encode($tasks, JSON_PRETTY_PRINT))) {
    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Reconciliation task queued successfully",
        "task_id" => $newTask['id'],
        "note" => "The collector will pick this up in the next cycle (within 30s)."
    ]);
} else {
    http_response_code(500);
    echo json_encode(["error" => "Failed to queue task"]);
}
