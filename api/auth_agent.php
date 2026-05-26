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

// Get Input
$data = json_decode(file_get_contents("php://input"), true);
$cnpj = $data['cnpj'] ?? '';
$company_name = $data['company_name'] ?? '';

if (empty($cnpj) || empty($company_name)) {
    http_response_code(400);
    echo json_encode(["error" => "Missing cnpj or company_name"]);
    exit;
}

// Load Admins (Tenants) to validate
$adminsFile = "data/users.json";
if (!file_exists($adminsFile)) {
    http_response_code(500);
    echo json_encode(["error" => "Admin/Tenant database not found"]);
    exit;
}

$admins = json_decode(file_get_contents($adminsFile), true);
$foundUser = null;

// Search for matching Tenant
foreach ($admins as $admin) {
    if (isset($admin['cnpj']) && $admin['cnpj'] === $cnpj) {
        if (strcasecmp(trim($admin['company_name']), trim($company_name)) === 0) {
            $foundUser = $admin;
            break;
        }
    }
}

if ($foundUser) {
    // Generate Token
    // Scope: agent:push handles data upload
    $payload = [
        "sub" => "agent-" . preg_replace('/[^0-9]/', '', $foundUser['cnpj']),
        "tenant_id" => preg_replace('/[^0-9]/', '', $foundUser['tenant_id']), // Standarized to numbers
        "name" => "Agent - " . $foundUser['company_name'],
        "scope" => "agent:push user:read", // Added user:read to allow fetching data
        "role" => "agent",
        "company_name" => $foundUser['company_name']
    ];
    
    // Update Users/Admins File with Filial ID if provided and different
    $filialId = $data['filial_id'] ?? null;
    if ($filialId && (!isset($foundUser['filial_id']) || $foundUser['filial_id'] !== $filialId)) {
        foreach ($admins as &$u) {
            // Match by tenant_id
            if (isset($u['tenant_id']) && $u['tenant_id'] === $foundUser['tenant_id']) {
                $u['filial_id'] = $filialId;
                break;
            }
        }
        file_put_contents($adminsFile, json_encode($admins, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    }

    // Agents tokens can live longer, e.g., 24 hours (86400)
    $token = generate_jwt($payload, 86400);

    echo json_encode([
        "success" => true,
        "token" => $token,
        "tenant_id" => $foundUser['tenant_id']
    ]);
} else {
    http_response_code(401);
    echo json_encode(["error" => "Unauthorized: Invalid Company/CNPJ combination"]);
}
?>
