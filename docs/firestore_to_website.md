## AI-Arne: Koppla Firestore-data till webbplatsen

Den här guiden visar hur du hämtar inlägg (posts) och tutorials från Firestore och visar dem på AI-arne.se. Två sätt:
- PHP (one.com): via Firestore REST API (kräver API-nyckel)
- Node/SSR: via Firestore SDK (GCP service account/ADC)

### Datamodell (Firestore)
- Collection `posts`
  - `slug: string`
  - `title: string`
  - `excerpt: string`
  - `content: string` (HTML-säkrat)
  - `provider: string`
  - `sourceUrl: string`
  - `linkedinUrn: string` (valfritt)
  - `createdAt: timestamp`
  - `updatedAt: timestamp`
- Collection `tutorials`
  - `postId: string` (referens till `posts/{id}`)
  - `title: string`
  - `content: string` (HTML-säkrat)
  - `sourceUrl: string`
  - `createdAt: timestamp`
  - `updatedAt: timestamp`

---

## 1) PHP (one.com) – hämta och rendera via REST

Använd Firestore REST API. Lägg nycklar i PHP-konfiguration (ej i JS):

```php
<?php
// config.php
define('FIRESTORE_PROJECT_ID', 'ai-arne-agents');
define('FIRESTORE_API_KEY', 'YOUR_FIREBASE_WEB_API_KEY'); // skapas i Firebase-konsolen
?>
```

### Senaste inlägg (lista)
```php
<?php
require 'config.php';

$limit = 10; // antal att visa
$url = "https://firestore.googleapis.com/v1/projects/" . FIRESTORE_PROJECT_ID .
       "/databases/(default)/documents:runQuery?key=" . FIRESTORE_API_KEY;

$body = json_encode([
  'structuredQuery' => [
    'from' => [['collectionId' => 'posts']],
    'orderBy' => [[
      'field' => ['fieldPath' => 'createdAt'],
      'direction' => 'DESCENDING'
    ]],
    'limit' => $limit
  ]
]);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
$response = curl_exec($ch);
$http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($http !== 200) { http_response_code(500); echo 'Fel vid hämtning.'; exit; }
$data = json_decode($response, true);

$posts = [];
foreach ($data as $row) {
  if (!isset($row['document'])) continue;
  $doc = $row['document'];
  $f = $doc['fields'];
  $posts[] = [
    'id' => basename($doc['name']),
    'slug' => $f['slug']['stringValue'] ?? '',
    'title' => $f['title']['stringValue'] ?? '',
    'excerpt' => $f['excerpt']['stringValue'] ?? '',
    'createdAt' => $f['createdAt']['timestampValue'] ?? ''
  ];
}
?>

<ul>
<?php foreach ($posts as $p): ?>
  <li><a href="/post.php?slug=<?= htmlspecialchars($p['slug']) ?>"><?= htmlspecialchars($p['title']) ?></a></li>
<?php endforeach; ?>
</ul>
```

### Visa en post (med tutorial-länk)
```php
<?php
require 'config.php';
$slug = $_GET['slug'] ?? '';
if (!$slug) { http_response_code(404); exit('Saknar slug'); }

// Hämta post via query på slug
$url = "https://firestore.googleapis.com/v1/projects/" . FIRESTORE_PROJECT_ID .
       "/databases/(default)/documents:runQuery?key=" . FIRESTORE_API_KEY;
$body = json_encode([
  'structuredQuery' => [
    'from' => [['collectionId' => 'posts']],
    'where' => [
      'fieldFilter' => [
        'field' => ['fieldPath' => 'slug'],
        'op' => 'EQUAL',
        'value' => ['stringValue' => $slug]
      ]
    ],
    'limit' => 1
  ]
]);
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
$response = curl_exec($ch);
$http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
if ($http !== 200) { http_response_code(500); exit('Fel vid hämtning'); }

$data = json_decode($response, true);
if (!isset($data[0]['document'])) { http_response_code(404); exit('Hittades inte'); }
$doc = $data[0]['document'];
$f = $doc['fields'];
$postId = basename($doc['name']);
$title = $f['title']['stringValue'] ?? '';
$content = $f['content']['stringValue'] ?? '';

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

$tutorialUrl = '';
$ch = curl_init($urlTut);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $bodyTut);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
$respTut = curl_exec($ch);
$httpTut = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($httpTut === 200 && $respTut) {
  $dt = json_decode($respTut, true);
  if ($dt && isset($dt[0]['document'])) {
    $t = $dt[0]['document']['fields'];
    $tutorialUrl = '/tutorial.php?id=' . basename($dt[0]['document']['name']);
  }
} else {
  // Debug: logga fel (ta bort i produktion eller flytta till error log)
  error_log("Tutorial query failed: HTTP $httpTut, Error: $curlError, Response: " . substr($respTut, 0, 200));
}
?>

<h1><?= htmlspecialchars($title) ?></h1>
<div><?= $content /* innehållet är redan HTML-säkrat i backend */ ?></div>
<?php if ($tutorialUrl): ?>
  <p><a href="<?= htmlspecialchars($tutorialUrl) ?>">Läs tutorial</a></p>
<?php endif; ?>
```

> Tips: För bättre prestanda, cacha JSON-svar på servern (t.ex. 5–15 min).

---

## 2) Node/SSR – Firestore SDK (om du hostar Node)

```js
// server.js (Express-exempel)
import express from 'express';
import { Firestore } from '@google-cloud/firestore';

const app = express();
const db = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT });

app.get('/api/posts', async (req, res) => {
  const snap = await db.collection('posts').orderBy('createdAt','desc').limit(10).get();
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  res.json({ items });
});

app.get('/api/posts/:slug', async (req, res) => {
  const q = await db.collection('posts').where('slug','==', req.params.slug).limit(1).get();
  if (q.empty) return res.status(404).json({ error: 'not found' });
  const doc = q.docs[0];
  const post = { id: doc.id, ...doc.data() };
  const tut = await db.collection('tutorials').where('postId','==', doc.id).limit(1).get();
  const tutorial = tut.empty ? null : { id: tut.docs[0].id, ...tut.docs[0].data() };
  res.json({ post, tutorial });
});

app.listen(3000, () => console.log('Server on :3000'));
```

---

## URL-struktur på AI-arne.se
- Lista: `/` eller `/nyheter` → senaste `posts`
- Post: `/post/{slug}` → rendera `posts` + länk till `tutorial`
- Tutorial: `/tutorial/{id}` → rendera `tutorials`

## Säkerhet & best practice
- Lägg `FIRESTORE_API_KEY` server-side i PHP (inte i JS)
- Använd HTTPS på alla anrop
- Begränsa mängden data (limit, orderBy)
- Cacha svar för att spara read-kostnad
- Firestore-regler tillåter publik läsning; skrivning endast via Cloud Functions

## Felsökning
- 404 vid post: kontrollera att `slug` är korrekt och finns
- 403: felaktig/avsaknad API-nyckel
- Tomma listor: kör Cloud Run-funktionen manuellt med `?force=1` för att fylla data
