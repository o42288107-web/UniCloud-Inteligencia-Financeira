<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require 'auth_utils.php';

// Verify JWT Token (Standard protection)
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? '';
if (empty($authHeader) || !preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
    http_response_code(401);
    echo json_encode(["error" => "Missing or invalid token"]);
    exit;
}
$token = $matches[1];
$decoded = validate_jwt($token);
if (!$decoded) {
    http_response_code(401);
    echo json_encode(["error" => "Invalid or expired token"]);
    exit;
}

// Queue File Path (Simple JSON file for tasks)
// Structure: { "tenant_id": [ { "id": "uuid", "type": "reconciliation", "params": {...}, "status": "pending", "created_at": "..." } ] }
$queueFile = __DIR__ . "/data/tasks.json";

// Initialize if not exists
if (!file_exists($queueFile)) {
    file_put_contents($queueFile, json_encode([]));
}

$tasks = json_decode(file_get_contents($queueFile), true) ?? [];

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// --- ACTION: ADD TASK (POST) ---
if ($method === 'POST' && $action === 'add') {
    $input = json_decode(file_get_contents("php://input"), true);
    
    // Only allow specific task types
    if (($input['type'] ?? '') !== 'reconciliation') {
        http_response_code(400);
        echo json_encode(["error" => "Invalid task type"]);
        exit;
    }

    $tenantId = $decoded['tenant_id'] ?? 'default'; // Or from token
    
    // In our simplified JWT, we might not have tenant_id directly if it's not custom claim,
    // but let's assume we pass it or rely on the user association. 
    // For now, using 'default' or a query param if super admin, but let's use a flat list for simplicity per tenant folder later?
    // Actually, let's keep it simple: global list but keyed by tenant if needed, or just a list.
    // Let's use a simple list for the specific tenant context.
    
    // Better: Just append to the list. The collector will pick up ALL tasks or filtered by tenant.
    // Since we have one collector per tenant usually (or one collector handling one DB connection),
    // we need to make sure the collector knows WHICH tasks are for it.
    // The collector knows its Company ID / CNPJ.
    
    // Let's require 'tenant_id' in input or derive from token.
    $targetTenantId = $input['tenant_id'] ?? $decoded['tenant_id'] ?? 'unknown';

    $newTask = [
        'id' => uniqid('task_', true),
        'tenant_id' => $targetTenantId,
        'type' => $input['type'],
        'params' => $input['params'] ?? [],
        'status' => 'pending', // pending, processing, completed, failed
        'created_at' => date('c')
    ];

    $tasks[] = $newTask;
    
    if (file_put_contents($queueFile, json_encode($tasks, JSON_PRETTY_PRINT))) {
        echo json_encode(["success" => true, "task_id" => $newTask['id']]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Failed to save task"]);
    }
    exit;
}

// --- ACTION: GET PENDING TASKS (GET) ---
// Called by Collector
if ($method === 'GET' && $action === 'pop') {
    // Collector should ideally send its Tenant ID to only get its tasks
    $requestTenantId = $_GET['tenant_id'] ?? null;
    $requestCnpj = $_GET['cnpj'] ?? null; // Alternative ident
    
    if (!$requestTenantId && !$requestCnpj) {
        // Allow super admin or just return nothing?
        // For security, if no tenant specified, return nothing.
         echo json_encode(["tasks" => []]);
         exit;
    }

    // Find pending tasks for this tenant
    $pendingTasks = [];
    $updatedTasks = []; // To rewrite file
    
    // Simplify matching: Normalize CNPJ/TenantID comparison if needed.
    // Here assuming precise match string.
    
    foreach ($tasks as $key => $task) {
        // Check if task belongs to this tenant AND is pending
        // Matches if tenant_id matches OR (task has no tenant_id and we assume global - dangerous, avoid)
        // We will assume 'tenant_id' in task MUST match $requestTenantId (or normalized CNPJ)
        
        $isMatch = false;
        if (isset($task['tenant_id']) && $task['tenant_id'] == $requestTenantId) $isMatch = true;
        
        if ($isMatch && $task['status'] === 'pending') {
            // "Pop" it -> Mark as processing or return it and let collector delete it?
            // Safer: Mark as processing immediately so another request doesn't get it.
            $tasks[$key]['status'] = 'processing';
            $tasks[$key]['started_at'] = date('c');
            $pendingTasks[] = $tasks[$key];
        }
    }
    
    if (count($pendingTasks) > 0) {
        file_put_contents($queueFile, json_encode($tasks, JSON_PRETTY_PRINT));
    }
    
    echo json_encode(["tasks" => $pendingTasks]);
    exit;
}

// --- ACTION: UPDATE TASK STATUS (POST) ---
if ($method === 'POST' && $action === 'update') {
    $input = json_decode(file_get_contents("php://input"), true);
    $taskId = $input['task_id'] ?? '';
    $status = $input['status'] ?? '';
    
    if (!$taskId || !$status) {
        http_response_code(400);
        echo json_encode(["error" => "Missing task_id or status"]);
        exit;
    }

    $found = false;
    foreach ($tasks as $key => $task) {
        if ($task['id'] === $taskId) {
            $tasks[$key]['status'] = $status;
            if ($status === 'completed' || $status === 'failed') {
                $tasks[$key]['completed_at'] = date('c');
                if (isset($input['result'])) $tasks[$key]['result'] = $input['result'];
            }
            $found = true;
            break;
        }
    }
    
    if ($found) {
        file_put_contents($queueFile, json_encode($tasks, JSON_PRETTY_PRINT));
        echo json_encode(["success" => true]);
    } else {
        http_response_code(404);
        echo json_encode(["error" => "Task not found"]);
    }
    exit;
}

// --- ACTION: CHECK TASK STATUS (GET) ---
// Called by Frontend
if ($method === 'GET' && $action === 'check_status') {
    $taskId = $_GET['task_id'] ?? '';
    
    if (!$taskId) {
        http_response_code(400);
        echo json_encode(["error" => "Missing task_id"]);
        exit;
    }

    $foundTask = null;
    foreach ($tasks as $task) {
        if ($task['id'] === $taskId) {
            $foundTask = $task;
            break;
        }
    }
    
    if ($foundTask) {
        echo json_encode([
            "success" => true,
            "status" => $foundTask['status'],
            "created_at" => $foundTask['created_at'],
            "completed_at" => $foundTask['completed_at'] ?? null,
            "result" => $foundTask['result'] ?? null
        ]);
    } else {
        http_response_code(404);
        echo json_encode(["error" => "Task not found"]);
    }
    exit;
}

http_response_code(400);
echo json_encode(["error" => "Invalid action"]);
