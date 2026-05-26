<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

$usersFile = "../data/users.json";
$users = [];

if (file_exists($usersFile)) {
    $users = json_decode(file_get_contents($usersFile), true) ?? [];
}

// Check if admin exists
foreach ($users as $user) {
    if ($user['email'] === 'super@unicloud.com') {
        echo json_encode(["message" => "Super Admin already exists."]);
        exit;
    }
}

$adminUser = [
    "id" => "super_admin_01",
    "name" => "Super Admin",
    "email" => "super@unicloud.com",
    "password" => "super123",
    "tenant_id" => "MASTER",
    "role" => "super_admin",
    "created_at" => date('Y-m-d H:i:s')
];

$users[] = $adminUser;

if (file_put_contents($usersFile, json_encode($users, JSON_PRETTY_PRINT))) {
    echo json_encode(["success" => true, "message" => "Super Admin created: super@unicloud.com / super123"]);
} else {
    echo json_encode(["success" => false, "message" => "Error creating admin"]);
}
?>
