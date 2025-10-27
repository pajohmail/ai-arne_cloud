<?php
/**
 * AI-Arne Cloud API - Posts
 * Hämtar posts från Firestore och returnerar JSON
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
$latest = isset($_GET['latest']) ? (int)$_GET['latest'] : 10;
$slug = isset($_GET['slug']) ? $_GET['slug'] : null;

try {
    if ($slug) {
        // Hämta specifik post via slug
        $url = "https://firestore.googleapis.com/v1/projects/" . FIRESTORE_PROJECT_ID . 
               "/databases/(default)/documents/posts?where=slug%3D%3D%22" . urlencode($slug) . "%22";
    } else {
        // Hämta senaste posts
        $url = "https://firestore.googleapis.com/v1/projects/" . FIRESTORE_PROJECT_ID . 
               "/databases/(default)/documents/posts?orderBy=createdAt%20desc&pageSize=" . $latest;
    }
    
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
    $posts = [];
    foreach ($data['documents'] as $doc) {
        $fields = $doc['fields'] ?? [];
        
        $post = [
            'id' => basename($doc['name']),
            'slug' => $fields['slug']['stringValue'] ?? '',
            'title' => $fields['title']['stringValue'] ?? '',
            'excerpt' => $fields['excerpt']['stringValue'] ?? '',
            'content' => $fields['content']['stringValue'] ?? '',
            'provider' => $fields['provider']['stringValue'] ?? '',
            'sourceUrl' => $fields['sourceUrl']['stringValue'] ?? '',
            'linkedinUrn' => $fields['linkedinUrn']['stringValue'] ?? '',
            'createdAt' => $fields['createdAt']['timestampValue'] ?? '',
            'updatedAt' => $fields['updatedAt']['timestampValue'] ?? ''
        ];
        
        $posts[] = $post;
    }
    
    // Returnera JSON
    echo json_encode([
        'success' => true,
        'count' => count($posts),
        'posts' => $posts
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>
