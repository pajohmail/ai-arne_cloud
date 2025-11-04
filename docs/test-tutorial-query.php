<?php
/**
 * Test-script för att felsöka tutorial-hämtning från Firestore
 * 
 * Användning:
 * 1. Sätt FIRESTORE_PROJECT_ID och FIRESTORE_API_KEY
 * 2. Kör: php test-tutorial-query.php
 */

define('FIRESTORE_PROJECT_ID', 'ai-arne-agents');
define('FIRESTORE_API_KEY', 'YOUR_FIREBASE_WEB_API_KEY'); // Sätt din API-nyckel här

// Test med ett känd postId (från verkliga data)
$postId = 'QPppKYrcKMBGtkwhAAQ6'; // Ersätt med ett riktigt postId från din databas

echo "=== Test tutorial-hämtning från Firestore ===\n";
echo "Project ID: " . FIRESTORE_PROJECT_ID . "\n";
echo "Post ID: $postId\n\n";

// Hämta tutorial kopplad till post
$urlTut = "https://firestore.googleapis.com/v1/projects/" . FIRESTORE_PROJECT_ID .
          "/databases/(default)/documents:runQuery?key=" . FIRESTORE_API_KEY;

$bodyTut = json_encode([
  'structuredQuery' => [
    'from' => [['collectionId' => 'tutorials']],
    'where' => [
      'fieldFilter' => [
        'field' => ['fieldPath' => 'postId'],
        'op' => 'EQUAL',
        'value' => ['stringValue' => $postId]
      ]
    ],
    'limit' => 1
  ]
]);

echo "Query URL: $urlTut\n";
echo "Query body: " . json_encode(json_decode($bodyTut), JSON_PRETTY_PRINT) . "\n\n";

$ch = curl_init($urlTut);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $bodyTut);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_VERBOSE, true);

$respTut = curl_exec($ch);
$httpTut = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
$curlErrno = curl_errno($ch);
curl_close($ch);

echo "=== Resultat ===\n";
echo "HTTP Status: $httpTut\n";
if ($curlError) {
  echo "cURL Error: $curlError (Code: $curlErrno)\n";
}
echo "\nResponse:\n";
echo substr($respTut, 0, 1000) . "\n\n";

if ($httpTut === 200 && $respTut) {
  $dt = json_decode($respTut, true);
  if ($dt === null) {
    echo "ERROR: JSON decode failed\n";
    echo "JSON Error: " . json_last_error_msg() . "\n";
  } elseif (isset($dt[0]['document'])) {
    echo "✅ Tutorial hittad!\n";
    $doc = $dt[0]['document'];
    $fields = $doc['fields'];
    echo "Tutorial ID: " . basename($doc['name']) . "\n";
    echo "Title: " . ($fields['title']['stringValue'] ?? 'N/A') . "\n";
    echo "PostId: " . ($fields['postId']['stringValue'] ?? 'N/A') . "\n";
  } elseif (is_array($dt) && count($dt) === 0) {
    echo "⚠️ Inga tutorials hittades för postId: $postId\n";
    echo "Kontrollera att:\n";
    echo "  1. PostId är korrekt (matchar posts-dokument-ID)\n";
    echo "  2. Tutorial faktiskt finns i Firestore\n";
  } else {
    echo "⚠️ Oväntat svar från API\n";
    echo "Response structure: " . print_r($dt, true) . "\n";
  }
} else {
  echo "❌ Request failed\n";
  if ($httpTut !== 200) {
    echo "HTTP Error: $httpTut\n";
    $errorData = json_decode($respTut, true);
    if ($errorData && isset($errorData['error'])) {
      echo "Error message: " . ($errorData['error']['message'] ?? 'N/A') . "\n";
      echo "Error code: " . ($errorData['error']['code'] ?? 'N/A') . "\n";
    }
  }
}
?>

