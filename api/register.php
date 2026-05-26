<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);
$email = $data['email'] ?? '';
$password = $data['password'] ?? '';
$name = $data['name'] ?? 'Usuário Teste';
$tenant_id = $data['tenant_id'] ?? '01212344000127';

if (empty($email) || empty($password)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Email e senha são obrigatórios"]);
    exit;
}

$usersFile = "data/users.json";
$users = [];

if (file_exists($usersFile)) {
    $users = json_decode(file_get_contents($usersFile), true) ?? [];
}

// Check if user already exists
foreach ($users as $user) {
    if ($user['email'] === $email) {
        http_response_code(409);
        echo json_encode(["success" => false, "message" => "Usuário já existe"]);
        exit;
    }
}

// Add new user
$newUser = [
    "id" => uniqid(),
    "name" => $name,
    "email" => $email,
    "password" => $password, // Storing plain text for MVP/Demo as per existing login.php
    "tenant_id" => $tenant_id,
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
