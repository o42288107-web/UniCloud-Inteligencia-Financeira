<?php
// receive.php - Secure Data Receiver

// Set headers
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require 'auth_utils.php';

// Check Auth (Requires 'agent:push' scope)
try {
    $payload = require_auth('agent:push');
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(["error" => "Auth Failed: " . $e->getMessage()]);
    exit;
}

// Get raw POST data
$data = file_get_contents("php://input");

// Handle GZIP Compression
$contentEncoding = $_SERVER['HTTP_CONTENT_ENCODING'] ?? $_SERVER['CONTENT_ENCODING'] ?? '';
if ($contentEncoding === 'gzip') {
    $decoded = @gzdecode($data);
    if ($decoded !== false) {
        $data = $decoded;
    } else {
        // Fallback or Error? If decompression fails, existing JSON decode will also fail, handled below.
    }
}

$json = json_decode($data, true);

$response = array();

// Check Request Method
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo "<h1>UniCloud API is Running (Secure) 🔒</h1>";
    exit;
}

if ($json) {
    $tenantId = $json['tenant_id'] ?? 'unknown';
    
    // Verify Tenant Match (Token Tenant must match Payload Tenant)
    // Normalize both to numbers-only to avoid mismatch between Formatted vs Stripped
    $payloadId = preg_replace('/[^0-9]/', '', $tenantId);
    $tokenId = preg_replace('/[^0-9]/', '', $payload['tenant_id']);

    if ($payloadId !== $tokenId) {
        http_response_code(403);
        echo json_encode(['error' => 'Tenant ID mismatch', 'received' => $payloadId, 'token' => $tokenId]);
        exit;
    }

    $type = $json['type'] ?? 'unknown';
    $newData = $json['data'] ?? [];

    // Validate Data Type
    // We allow explicit known types AND any valid alphanumeric type to support dynamic models (Bee Full Sync)
    $allowed_types = ['sales', 'products', 'customers', 'credentials', 'users', 'dre', 'payments', 
        'summary', 'branches', 'PDVsales', 'reconciliation', 'init'];
    
    // Check if type is in whitelist OR if it's a valid dynamic model name (alphanumeric/underscore)
    if (!in_array($type, $allowed_types) && !preg_match('/^[a-zA-Z0-9_]+$/', $type)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid data type']);
        exit;
    }

    // Log with Absolute Path
    $logFile = __DIR__ . "/api_log.txt";
    // $logEntry = "[" . date("Y-m-d H:i:s") . "] Received $type from Tenant: $tenantId\n";
    
    // Create directory (Sanitized to numbers only)
    $safeTenantId = preg_replace('/[^0-9]/', '', $tenantId);
    $dir = __DIR__ . "/data/" . $safeTenantId;
    if (!file_exists($dir)) {
        if (!mkdir($dir, 0777, true)) {
            // $logEntry .= "ERROR: Failed to mkdir $dir. Error: " . print_r(error_get_last(), true) . "\n";
            http_response_code(500);
            echo json_encode(['error' => 'Failed to create directory']);
            exit;
        }
    }

    // Special INIT Handler
    if ($type === 'init') {
        echo json_encode(['status' => 'success', 'message' => 'Directory verified', 'path' => $dir]);
        exit;
    }

    $logEntry = "[" . date("Y-m-d H:i:s") . "] Received $type from Tenant: $tenantId\n";

    // Determine path
    $file_path = ($type === 'credentials' || $type === 'users') ? __DIR__ . "/data/users.json" : "$dir/$type.json";
    $logEntry .= "Saving to: $file_path\n";
    file_put_contents($logFile, $logEntry, FILE_APPEND);

    // Read existing
    $existing_data = [];
    if (file_exists($file_path)) {
        $existing_data = json_decode(file_get_contents($file_path), true) ?? [];
    }

    // Process Data (Merge/Update)
    if ($type === 'dashboard') {
        // Direct Overwrite/Save for Dashboard Snapshot
        $final_data = $newData;
    } elseif ($type === 'credentials' || $type === 'users') {
        foreach ($newData as $main_input) {
            // Function to normalize a user object
            $normalize = function($u, $tenantId, $role='sales', $company='') {
                 return [
                    'id' => $u['id'] ?? uniqid(),
                    'email' => $u['email'] ?? '',
                    'password' => $u['password'] ?? $u['senha'] ?? '',
                    'name' => $u['name'] ?? $u['nome'] ?? 'Unknown',
                    'tenant_id' => $u['tenant_id'] ?? $tenantId,
                    'role' => (isset($u['administrador']) && $u['administrador'] == 1) ? 'admin' : $role,
                    'cnpj' => $u['cnpjcpf'] ?? $u['cnpj'] ?? '',
                    'company_name' => $u['company_name'] ?? $u['nome'] ?? $company
                ];
            };

            // Normalize Main User
            $normalized_main = $normalize($main_input, $tenantId, 'admin', $main_input['company_name'] ?? '');
            
            // Normalize Sub Users
            $normalized_subs = [];
            if (isset($main_input['users']) && is_array($main_input['users'])) {
                foreach ($main_input['users'] as $sub) {
                    $normalized_subs[] = $normalize($sub, $tenantId, 'sales', $normalized_main['company_name']);
                }
            }
            $normalized_main['users'] = $normalized_subs;

            // Upsert Main User into global list
            $found = false;
            foreach ($existing_data as &$existing_main) {
                // Heuristic: Match by Tenant ID (Strongest for "Main User") OR ID
                if ((isset($existing_main['tenant_id']) && $existing_main['tenant_id'] === $normalized_main['tenant_id']) ||
                    (isset($existing_main['id']) && $existing_main['id'] == $normalized_main['id'])) {
                    
                    // Update Main Fields
                    $existing_main['email'] = $normalized_main['email'];
                    $existing_main['password'] = $normalized_main['password'];
                    $existing_main['name'] = $normalized_main['name'];
                    $existing_main['role'] = $normalized_main['role'];
                    $existing_main['cnpj'] = $normalized_main['cnpj'];
                    $existing_main['company_name'] = $normalized_main['company_name'];
                    
                    // Replace/Update Sub Users
                    // Strategy: Full Replace is safer for Sync, but if we want to keep local edits?
                    // User Request " [ { ... users: [...] } ] " implies full structure.
                    // We will replace the 'users' list with the new synced list.
                    $existing_main['users'] = $normalized_main['users'];
                    
                    $found = true;
                    break;
                }
            }
            if (!$found) {
                $existing_data[] = $normalized_main;
            }
        }
        $final_data = $existing_data;
    } else {
        // Split Strategy based on Data Type
        
        // Group B: Transactional & Master Data -> MERGE / UPSERT
        // We now use this strategy for ALMOST EVERYTHING to support Chunked Uploads.
        // It's safer to Upsert (add/update) than to Overwrite partial data.
        // Exceptions could be 'summary' or 'credentials' if they are small and monolithic.
        if (true) { // Defaulting to Upsert Logic for robustness
            
            // 1. Helper to generate unique key
            $getKey = function($item) use ($type) {
                // Specific Keys
                if ($type === 'dre') return $item['mes'] ?? null;
                
                // Entity Keys (products, customers, etc)
                if (isset($item['id'])) return $item['id'];
                if (isset($item['sku'])) return $item['sku'];
                if (isset($item['cnpj'])) return $item['cnpj'];
                if (isset($item['codigo'])) return $item['codigo'];

                // Composition Keys
                if ($type === 'payments' || $type === 'Financeiro' || $type === 'financeiro') {
                    // Try to find a unique combo
                     $id = $item['id'] ?? $item['idfinanceiro'] ?? null;
                     if ($id) return $id;
                     
                     // Fallback composition
                    $p1 = $item['idfinalizador'] ?? $item['documento'] ?? '';
                    $p2 = $item['idvenda'] ?? $item['nossonumero'] ?? '';
                     if ($p1 !== '' && $p2 !== '') return "COMP-{$p2}-{$p1}";
                }
                
                return null;
            };

            // 2. Build Map from Existing Data
            $data_map = [];
            foreach ($existing_data as $item) {
                $key = $getKey($item);
                if ($key !== null) {
                    $data_map[$key] = $item;
                } else {
                    $data_map[] = $item;
                }
            }

            // 3. Upsert New Data
            foreach ($newData as $item) {
                $key = $getKey($item);
                if ($key !== null) {
                    $data_map[$key] = $item; // Overwrite/Update
                } else {
                    $data_map[] = $item; // Append (No ID)
                }
            }

            // 4. Flatten
            $final_data = array_values($data_map);
            
        }
    }

    // Save
    if (file_put_contents($file_path, json_encode($final_data, JSON_PRETTY_PRINT))) {
        http_response_code(200);
        echo json_encode(['status' => 'success', 'message' => 'Data received (secure)']);
    } else {
        http_response_code(500);
         echo json_encode(['status' => 'error', 'message' => 'Failed to save']);
    }

} else {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid JSON']);
}
?>
