<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require '../auth_utils.php';

// Verify Admin Role
// Verify Super Admin Role
$user = require_auth();
if (!isset($user['role']) || $user['role'] !== 'super_admin') {
    http_response_code(403);
    echo json_encode(["error" => "Forbidden: Super Admin access required"]);
    exit;
}

$usersFile = "../data/users.json";
if (!file_exists($usersFile)) {
    echo json_encode(["error" => "No users found"]);
    exit;
}

$users = json_decode(file_get_contents($usersFile), true);
$totalTenants = count($users);
$activeCollectors = 0;
$totalRecords = 0;
$recentSyncs = [];

$dataDir = "../data/";

foreach ($users as $tenant) {
    // Check Tenant Data Folder
    // tenant_id usually is CNPJ, but folder might be sanitized or just CNPJ
    // Let's assume folder name matches tenant_id (CNPJ)
    // Warning: formatted CNPJ in users.json vs possibly stripped in FS?
    // Let's check both
    
    $folderName = $tenant['tenant_id'];
    $folderNameStripped = preg_replace('/[^0-9]/', '', $folderName);
    
    // Prioritize Stripped (Standardized)
    $targetDir = $dataDir . $folderNameStripped;
    
    // Fallback to strict/formatted if using legacy
    if (!is_dir($targetDir)) {
        $targetDir = $dataDir . $folderName;
    }
    
    if (is_dir($targetDir)) {
        // Check for sales.json to determine activity
        $salesFile = $targetDir . "/sales.json";
        $lastSync = null;
        
        if (file_exists($salesFile)) {
            $mtime = filemtime($salesFile);
            $lastSync = date("Y-m-d H:i:s", $mtime);
            
            // Active if synced in last 24h
            if (time() - $mtime < 86400) {
                $activeCollectors++;
            }
            
            // Count Records (approximate, reading big files is slow, let's just use file size or sample?)
            // For dashboard, maybe we just want to know it exists. 
            // Reading full json for length is expensive. 
            // Let's just sum file sizes for "Data Volume" or count items if files are small.
            // Let's try reading but safely.
            $content = file_get_contents($salesFile);
            $data = json_decode($content, true);
            if (is_array($data)) {
                $totalRecords += count($data);
            }
        }
        
        $recentSyncs[] = [
            "name" => $tenant['name'],
            "cnpj" => $tenant['cnpj'],
            "last_sync" => $lastSync ?? "Nunca",
            "status" => ($lastSync && (time() - filemtime($salesFile) < 86400)) ? "Online" : "Offline"
        ];
    } else {
        $recentSyncs[] = [
            "name" => $tenant['name'],
            "cnpj" => $tenant['cnpj'],
            "last_sync" => "Nunca",
            "status" => "Offline"
        ];
    }
}

echo json_encode([
    "total_tenants" => $totalTenants,
    "active_collectors" => $activeCollectors,
    "total_records" => $totalRecords,
    "recent_syncs" => $recentSyncs
]);
?>
