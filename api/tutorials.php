<?php
/**
 * AI-Arne Cloud API - Tutorials
 * Hämtar tutorials från Firestore och returnerar JSON
 */

// Konfiguration (sätt dessa värden i din one.com miljö)
define('FIRESTORE_PROJECT_ID', 'your-project-id');
define('FIRESTORE_API_KEY', 'your-firestore-api-key');
define('API_KEY', 'your-secret-api-key'); // För att skydda API:et

// Headers för JSON response
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Validera API-nyckel (valfritt men rekommenderat)
if (isset($_GET['api_key']) && $_GET['api_key'] !== API_KEY) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid API key']);
    exit;
}

// Hämta parametrar
$postId = isset($_GET['post_id']) ? $_GET['post_id'] : null;

if (!$postId) {
    http_response_code(400);
    echo json_encode(['error' => 'post_id parameter required']);
    exit;
}

try {
    // Hämta tutorial för specifik post
    $url = "https://firestore.googleapis.com/v1/projects/" . FIRESTORE_PROJECT_ID . 
           "/databases/(default)/documents/tutorials?where=postId%3D%3D%22" . urlencode($postId) . "%22";
    $url .= "&key=" . FIRESTORE_API_KEY;
    
    // cURL request till Firestore
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        throw new Exception("Firestore API error: HTTP $httpCode");
    }
    
    $data = json_decode($response, true);
    
    if (!$data || !isset($data['documents'])) {
        throw new Exception("Invalid response from Firestore");
    }
    
    // Konvertera Firestore format till vårt format
    $tutorials = [];
    foreach ($data['documents'] as $doc) {
        $fields = $doc['fields'] ?? [];
        
        $tutorial = [
            'id' => basename($doc['name']),
            'postId' => $fields['postId']['stringValue'] ?? '',
            'title' => $fields['title']['stringValue'] ?? '',
            'content' => $fields['content']['stringValue'] ?? '',
            'sourceUrl' => $fields['sourceUrl']['stringValue'] ?? '',
            'createdAt' => $fields['createdAt']['timestampValue'] ?? '',
            'updatedAt' => $fields['updatedAt']['timestampValue'] ?? ''
        ];
        
        $tutorials[] = $tutorial;
    }
    
    // Returnera JSON
    echo json_encode([
        'success' => true,
        'count' => count($tutorials),
        'tutorials' => $tutorials
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>
