<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

$usersFile = "../data/users.json";

if (file_exists($usersFile)) {
    $users = json_decode(file_get_contents($usersFile), true);
    // Return users but hide passwords
    $safeUsers = array_map(function($user) {
        unset($user['password']);
        return $user;
    }, $users);
    echo json_encode($safeUsers);
} else {
    echo json_encode([]);
}
?>
