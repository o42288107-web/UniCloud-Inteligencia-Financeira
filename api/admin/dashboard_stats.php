<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Disable HTML error output to prevent JSON breakage
ini_set('display_errors', 0);
error_reporting(E_ALL);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Verify Super Admin
$user = require_auth();
// $user = ['role' => 'super_admin']; // DEBUG BYPASS
if (!isset($user['role']) || $user['role'] !== 'super_admin') {
    http_response_code(403);
    echo json_encode(["error" => "Forbidden"]);
    exit;
}

$usersFile = "../data/users.json";
if (!file_exists($usersFile)) {
    echo json_encode([
        "totalTenants" => 0,
        "activeTenants" => 0,
        "totalUsers" => 0,
        "moduleDistribution" => [],
        "tenantGrowth" => []
    ]);
    exit;
}

$tenants = json_decode(file_get_contents($usersFile), true) ?? [];

$totalTenants = count($tenants);
$totalUsers = 0;
$moduleCounts = [
    'inventory' => 0,
    'pos' => 0,
    'cfo' => 0,
    'dre' => 0,
    'card_reconciliation' => 0,
    'explorer' => 0
];
$growthByMonth = [];

foreach ($tenants as $t) {
    // Count Users (Tenant Admin + Sub-users)
    $subUsers = isset($t['users']) && is_array($t['users']) ? count($t['users']) : 0;
    $totalUsers += (1 + $subUsers);

    // Count Modules
    if (isset($t['modules']) && is_array($t['modules'])) {
        foreach ($t['modules'] as $mod) {
            if (isset($moduleCounts[$mod])) {
                $moduleCounts[$mod]++;
            } else {
                // Handle dynamic/unknown modules if necessary
                $moduleCounts[$mod] = ($moduleCounts[$mod] ?? 0) + 1;
            }
        }
    }

    // Track Growth
    $date = isset($t['created_at']) ? $t['created_at'] : '2024-01-01'; // Default for old data
    $month = date('Y-m', strtotime($date));
    if (!isset($growthByMonth[$month])) {
        $growthByMonth[$month] = 0;
    }
    $growthByMonth[$month]++;
}

// Format Module Data for Recharts
$moduleDistribution = [];
foreach ($moduleCounts as $key => $val) {
    $label = ucfirst($key);
    // Beautify labels
    $map = [
        'inventory' => 'Estoque',
        'pos' => 'PDV',
        'cfo' => 'CFO',
        'dre' => 'DRE',
        'card_reconciliation' => 'Conciliação',
        'explorer' => 'Explorador'
    ];
    $moduleDistribution[] = [
        "name" => $map[$key] ?? $label,
        "value" => $val
    ];
}

// Format Growth Data (Running Total)
ksort($growthByMonth);
$formattedGrowth = [];
$runningTotal = 0;
// If we want a cumulative chart
foreach ($growthByMonth as $month => $count) {
    $runningTotal += $count;
    $formattedGrowth[] = [
        "month" => date('M/y', strtotime($month . "-01")),
        "active" => $runningTotal
    ];
}

// Response
echo json_encode([
    "totalTenants" => $totalTenants,
    "activeTenants" => $totalTenants, // Assuming all in JSON are active for now
    "totalUsers" => $totalUsers,
    "moduleDistribution" => $moduleDistribution,
    "tenantGrowth" => $formattedGrowth,
    "uptime" => "99.9%" // Still hardcoded as we don't monitor server uptime
]);
?>
