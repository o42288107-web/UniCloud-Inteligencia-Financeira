<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$file = "../data/global_modules.json";
if (!file_exists($file)) {
    file_put_contents($file, json_encode([
        "inventory" => true,
        "pos" => true,
        "cfo" => true,
        "dre" => true,
        "card_reconciliation" => true,
        "explorer" => true
    ]));
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    echo file_get_contents($file);
}

if ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    if ($data) {
        if (file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT))) {
            echo json_encode(["success" => true]);
        } else {
            http_response_code(500);
            echo json_encode(["error" => "Failed to save settings"]);
        }
    } else {
        http_response_code(400);
        echo json_encode(["error" => "Invalid JSON"]);
    }
}
?>
