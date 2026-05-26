<?php
// Secret Key for HMAC SHA256 (Change this in production!)
define('JWT_SECRET', 'd45f3a02798834c7b809854728399589d31320473827419842');

require_once 'blacklist.php';
// Enforce Blacklist on everything using auth_utils
check_blacklist();

// Security Headers
header("X-Frame-Options: DENY");
header("X-Content-Type-Options: nosniff");
// header("Strict-Transport-Security: max-age=31536000; includeSubDomains"); // Uncomment on HTTPS


/**
 * Generate a JWT Token
 * @param array $payload Data to encode (e.g., user_id, role, scope)
 * @param int $expirationSeconds Duration in seconds (default 3600 = 1 hour)
 * @return string The signed JWT
 */
function generate_jwt($payload, $expirationSeconds = 3600) {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    
    // Add expiration to payload
    $payload['exp'] = time() + $expirationSeconds;
    // Add issued at
    $payload['iat'] = time();
    
    $payload = json_encode($payload);
    
    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
    
    $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, JWT_SECRET, true);
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
    
    return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
}

/**
 * Validate a JWT Token
 * @param string $token The JWT string
 * @return array|false The decoded payload if valid, false otherwise
 */
function validate_jwt($token) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return false;
    
    $header = $parts[0];
    $payload = $parts[1];
    $signature_provided = $parts[2];
    
    // Verify Signature
    $signature_generated = hash_hmac('sha256', $header . "." . $payload, JWT_SECRET, true);
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature_generated));
    
    if (!hash_equals($base64UrlSignature, $signature_provided)) {
        return false;
    }
    
    // Decode Payload
    $decoded_payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $payload)), true);
    
    // Check Expiration
    if (isset($decoded_payload['exp']) && $decoded_payload['exp'] < time()) {
        return false;
    }
    
    return $decoded_payload;
}

/**
 * Helper to get Token from Authorization Header
 */
function get_bearer_token() {
    $headers = apache_request_headers();
    if (isset($headers['Authorization'])) {
        if (preg_match('/Bearer\s(\S+)/', $headers['Authorization'], $matches)) {
            return $matches[1];
        }
    }
    // Fallback for some server configs
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
         if (preg_match('/Bearer\s(\S+)/', $_SERVER['HTTP_AUTHORIZATION'], $matches)) {
            return $matches[1];
        }
    }
    return null;
}

/**
 * Middleware to Enforce Auth
 * @param string $requiredScope Optional scope to check (e.g., 'agent:push', 'user:read')
 */
function require_auth($requiredScope = null) {
    $token = get_bearer_token();
    if (!$token) {
        http_response_code(401);
        echo json_encode(["error" => "Unauthorized: No token provided"]);
        exit;
    }
    
    $payload = validate_jwt($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(["error" => "Unauthorized: Invalid or expired token"]);
        exit;
    }
    
    // Check Scope if required
    if ($requiredScope) {
        $scopes = $payload['scope'] ?? ''; // Expected space-separated or array. Let's use string.
        if (strpos($scopes, $requiredScope) === false) {
             http_response_code(403);
             echo json_encode(["error" => "Forbidden: Insufficient scope"]);
             exit;
        }
    }
    
    return $payload;
}
?>
