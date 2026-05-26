<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require '../auth_utils.php';

// Verify Super Admin Role
$user = require_auth();
if (!isset($user['role']) || $user['role'] !== 'super_admin') {
    http_response_code(403);
    echo json_encode(["error" => "Forbidden: access required"]);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);

$name = $data['name'] ?? '';
$email = $data['email'] ?? '';
$password = $data['password'] ?? '';
$tenant_id = $data['tenant_id'] ?? '';
$role = $data['role'] ?? 'client'; // 'client' or 'super_admin'

if (empty($email) || empty($password) || empty($tenant_id)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Dados incompletos"]);
    exit;
}

$usersFile = "../data/users.json";
$users = [];

if (file_exists($usersFile)) {
    $users = json_decode(file_get_contents($usersFile), true) ?? [];
}

// Check if email already exists
foreach ($users as $user) {
    if ($user['email'] === $email) {
        http_response_code(409);
        echo json_encode(["success" => false, "message" => "Email já cadastrado"]);
        exit;
    }
}

$newUser = [
    "id" => uniqid(),
    "name" => $name,
    "email" => $email,
    "password" => $password,
    "tenant_id" => $tenant_id,
    "role" => $role,
    "created_at" => date('Y-m-d H:i:s')
];

$users[] = $newUser;

if (file_put_contents($usersFile, json_encode($users, JSON_PRETTY_PRINT))) {
    echo json_encode(["success" => true, "message" => "Usuário criado com sucesso", "user" => $newUser]);
} else {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erro ao salvar usuário"]);
}
?>
