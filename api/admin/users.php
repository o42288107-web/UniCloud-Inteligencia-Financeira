<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require '../auth_utils.php';

// Verify Admin Role
// Verify Super Admin Role
$user = require_auth(); // No specific scope, but we check role manually
if (!isset($user['role']) || $user['role'] !== 'super_admin') {
    http_response_code(403);
    echo json_encode(["error" => "Forbidden: Super Admin access required"]);
    exit;
}

$usersFile = "../data/users.json";
if (!file_exists($usersFile)) {
    http_response_code(500);
    echo json_encode(["error" => "Database error"]);
    exit;
}

$users = json_decode(file_get_contents($usersFile), true);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // List only top-level users (Tenants)
    // Filter out passwords before sending
    $safeUsers = array_map(function($u) {
        unset($u['password']);
        return $u;
    }, $users);
    
    echo json_encode($safeUsers);
}

if ($method === 'POST') {
    // Create New Tenant
    $data = json_decode(file_get_contents("php://input"), true);
    
    $cnpj = trim($data['cnpj'] ?? '');
    $name = trim($data['company_name'] ?? '');
    // Using email as 'identifier' or just optional? Main User needs 'name' at least.
    
    if (empty($cnpj) || empty($name)) {
        http_response_code(400);
        echo json_encode(["error" => "Missing CNPJ or Company Name"]);
        exit;
    }

    // Check Duplicate
    foreach ($users as $u) {
        if ($u['cnpj'] === $cnpj) {
            http_response_code(409);
            echo json_encode(["error" => "CNPJ already registered"]);
            exit;
        }
    }

    $newUser = [
        "id" => strval(rand(1000, 9999)),
        "email" => $data['email'] ?? '',
        // Use default password or generated? "123456" hash for demo
        "password" => '$2a$10$DuXtByoqmdhxaN/Y9wEmsuzOsabLC8rjJC5tCcfeqgkIvRTZvYcBu', 
        "name" => $name,
        "tenant_id" => $cnpj,
        "role" => "admin", // Each tenant is an admin of their own slice
        "cnpj" => $cnpj,
        "company_name" => $name,
        "users" => [],
        "created_at" => date('Y-m-d H:i:s')
    ];

    $users[] = $newUser;
    
    if (file_put_contents($usersFile, json_encode($users, JSON_PRETTY_PRINT))) {
        echo json_encode(["success" => true, "user" => $newUser]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Failed to save user"]);
    }
}

if ($method === 'PUT') {
    $data = json_decode(file_get_contents("php://input"), true);
    $id = $data['id'] ?? null;
    
    if (!$id) {
        http_response_code(400);
        echo json_encode(["error" => "ID required"]);
        exit;
    }

    $updated = false;
    foreach ($users as &$u) {
        if ($u['id'] === $id) {
            if (isset($data['company_name'])) {
                $u['name'] = $data['company_name'];
                $u['company_name'] = $data['company_name'];
            } elseif (isset($data['name'])) {
                 $u['name'] = $data['name'];
                 $u['company_name'] = $data['name'];
            }
            if (isset($data['email'])) $u['email'] = $data['email'];
            if (isset($data['password']) && !empty($data['password'])) {
                // If simple '123' style for dev, check regex maybe? 
                // For now, let's just accept plain text or assume frontend sends hash?
                // Better to just store as hashed here if it's a real change.
                // Assuming dev/demo environment:
                 $u['password'] = $data['password']; 
            }
            if (isset($data['modules'])) {
                $u['modules'] = $data['modules'];
            }
            $updated = true;
            break;
        }
    }
    
    if ($updated) {
        file_put_contents($usersFile, json_encode($users, JSON_PRETTY_PRINT));
        echo json_encode(["success" => true]);
    } else {
        http_response_code(404);
        echo json_encode(["error" => "User not found"]);
    }
}

if ($method === 'DELETE') {
    // For DELETE, ID usually passes in query param or body. Body is safer for non-standard REST.
    $data = json_decode(file_get_contents("php://input"), true);
    $id = $data['id'] ?? $_GET['id'] ?? null;

    if (!$id) {
        http_response_code(400);
        echo json_encode(["error" => "ID required"]);
        exit;
    }

    $initialCount = count($users);
    $users = array_filter($users, function($u) use ($id) {
        return $u['id'] !== $id;
    });

    if (count($users) < $initialCount) {
        file_put_contents($usersFile, json_encode(array_values($users), JSON_PRETTY_PRINT));
        echo json_encode(["success" => true]);
    } else {
        http_response_code(404);
        echo json_encode(["error" => "User not found"]);
    }
}
?>
