<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'cors.php';
require 'auth_utils.php';
require 'rate_limit.php';

// Rate Limit: 50 attempts per 60 seconds (Relaxed for dev)
check_rate_limit('login_attempt', 50, 60);

$data = json_decode(file_get_contents("php://input"), true);
$identifier = trim($data['identifier'] ?? $data['email'] ?? $data['cnpj'] ?? ''); 
$password = trim($data['password'] ?? '');

$adminsFile = "data/admins.json";
$usersFile = "data/users.json";

// Load Candidates from both sources
$candidates = [];

// 1. Load Admins
if (file_exists($adminsFile)) {
    $admins = json_decode(file_get_contents($adminsFile), true);
    if (is_array($admins)) {
        $candidates = array_merge($candidates, $admins);
    }
}

// 2. Load Users (and their sub-users)
if (file_exists($usersFile)) {
    $users = json_decode(file_get_contents($usersFile), true);
    if (is_array($users)) {
        foreach ($users as $mainUser) {
            $candidates[] = $mainUser;
            if (isset($mainUser['users']) && is_array($mainUser['users'])) {
                $candidates = array_merge($candidates, $mainUser['users']);
            }
        }
    }
}

// 3. Authenticate
foreach ($candidates as $user) {
    // Match by Email, Name, or CNPJ (identifier)
    // Normalize for CNPJ comparison (Numbers Only)
    $cleanIdentifier = preg_replace('/[^0-9]/', '', $identifier);
    $cleanCnpj = preg_replace('/[^0-9]/', '', $user['cnpj'] ?? '');
    $cleanTenant = preg_replace('/[^0-9]/', '', $user['tenant_id'] ?? '');

    $isMatch = false;
    
    // Standard matching
    if (
        (isset($user['email']) && $user['email'] !== '' && $user['email'] === $identifier) || 
        (isset($user['name']) && $user['name'] === $identifier) ||
        (isset($user['cnpj']) && $user['cnpj'] === $identifier) ||
        (isset($user['tenant_id']) && $user['tenant_id'] === $identifier)
    ) {
        $isMatch = true;
    }
    // Flexible numeric matching
    elseif ($cleanIdentifier !== '' && (
        $cleanIdentifier === $cleanCnpj || 
        $cleanIdentifier === $cleanTenant
    )) {
        $isMatch = true;
    }

    if ($isMatch) {
         // Verify Password
         $passMatch = false;
         if (isset($user['password'])) {
             // Check Hash
             if (password_verify($password, $user['password'])) {
                 $passMatch = true;
             } 
             // Check Plain (Legacy/Dev) - Only if NOT a Super Admin for extra security? 
             // Keeping it for now as per user request to not break things, but prioritizing hash.
             elseif ($user['password'] === $password) {
                 $passMatch = true;
             }
         }
         
         if ($passMatch) {
            // Determine Role and Scope
            $role = $user['role'] ?? 'client';
            $scope = ($role === 'super_admin') ? "admin:read admin:write user:read" : "user:read";
            $expiration = ($role === 'super_admin') ? 3600 : 7200; // 1h for admin, 2h for user

            $payload = [
                "sub" => $user['email'] ?? $user['name'] ?? 'unknown',
                "tenant_id" => $user['tenant_id'] ?? 'Unknown',
                "name" => $user['name'],
                "scope" => $scope,
                "role" => $role,
                "company_name" => $user['company_name'] ?? ''
            ];
            
            $token = generate_jwt($payload, $expiration);
            
            echo json_encode([
                "success" => true,
                "user" => [
                    "name" => $user['name'],
                    "email" => $user['email'] ?? '',
                    "tenant_id" => $user['tenant_id'] ?? '',
                    "role" => $role,
                    "company_name" => $user['company_name'] ?? ''
                ],
                "token" => $token
            ]);
            exit;
         }
    }
}

http_response_code(401);
echo json_encode(["success" => false, "message" => "Credenciais inválidas"]);
?>
