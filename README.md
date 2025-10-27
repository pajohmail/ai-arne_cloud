# AI-Arne Cloud Agentsystem

Ett agentsystem som körs på Google Cloud Functions och övervakar AI-API:er från stora leverantörer. Använder Firestore som databas och PHP API på one.com för att visa innehåll.

## Arkitektur

```
Cloud Scheduler (varannan vecka)
    ↓
Cloud Functions (Node.js agenter)
    ↓
Firestore (NoSQL databas, gratis tier)
    ↓
PHP API på one.com (läser från Firestore)
    ↓
AI-arne.se (visar innehåll)
```

## Funktioner

- **Chefagent**: Orkestrerar systemet varannan vecka
- **Provider-agent**: Övervakar OpenAI, Google Gemini, Meta Llama, Anthropic
- **Nyhetsagent**: Publicerar bearbetade nyheter till Firestore
- **Tutorial-agent**: Skapar översiktliga tutorials
- **LinkedIn-integration**: Uppdaterar företagsprofil automatiskt
- **PHP API**: Hämtar innehåll från Firestore för AI-arne.se

## Installation

```bash
cd /home/paj/Dev/ai-arne_cloud
npm install
npm run build
```

## Miljövariabler

Kopiera `env.example` till `.env` och fyll i:

```bash
cp env.example .env
```

### Cloud Functions (.env)
```bash
GOOGLE_CLOUD_PROJECT=your-project-id
PUBLIC_BASE_URL=https://ai-arne.se
LINKEDIN_ACCESS_TOKEN=...
LINKEDIN_ORG_URN=urn:li:organization:...
```

### PHP API (på one.com)
```php
define('FIRESTORE_PROJECT_ID', 'your-project-id');
define('FIRESTORE_API_KEY', 'your-firestore-api-key');
define('API_KEY', 'your-secret-api-key');
```

## Firestore Datastruktur

```
posts/
  {postId}/
    slug: string
    title: string
    excerpt: string
    content: string
    provider: string
    sourceUrl: string
    linkedinUrn: string
    createdAt: timestamp
    updatedAt: timestamp
    
tutorials/
  {tutorialId}/
    postId: string
    title: string
    content: string
    sourceUrl: string
    createdAt: timestamp
    updatedAt: timestamp
```

## Deployment

### 1. Bygg projektet
```bash
npm run build
```

### 2. Deploy till Google Cloud Functions
```bash
gcloud functions deploy managerHandler \
  --gen2 \
  --runtime=nodejs22 \
  --region=europe-north1 \
  --source=/home/paj/Dev/ai-arne_cloud \
  --entry-point=managerHandler \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars=GOOGLE_CLOUD_PROJECT=your-project-id \
  --set-env-vars=PUBLIC_BASE_URL=https://ai-arne.se \
  --set-env-vars=LINKEDIN_ACCESS_TOKEN=...,LINKEDIN_ORG_URN=urn:li:organization:...
```

### 3. Sätt upp Cloud Scheduler
```bash
gcloud scheduler jobs create http ai-arne-biweekly \
  --schedule="0 9 * * MON" \
  --time-zone="Europe/Stockholm" \
  --uri="https://REGION-PROJECT.cloudfunctions.net/managerHandler" \
  --http-method=GET
```

### 4. Deploy Firestore säkerhetsregler
```bash
firebase deploy --only firestore:rules
```

### 5. Ladda upp PHP API till one.com
- Kopiera `api/posts.php` och `api/tutorials.php` till din one.com webbplats
- Konfigurera miljövariabler i PHP-filerna

## Testning

### Lokal testning (utan databas)
```bash
npm run test:local
```

### Firestore testning (kräver Google Cloud setup)
```bash
npm run test:firestore
```

## API Endpoints (PHP)

- `GET /api/posts.php?latest=10` - Senaste 10 nyheter
- `GET /api/posts.php?slug={slug}` - Specifik post
- `GET /api/tutorials.php?post_id={id}` - Tutorial för post

## Kostnad

- **Firestore**: GRATIS (under 50K reads/dag)
- **Cloud Functions**: ~$0.40/månad (2 runs/månad)
- **Cloud Scheduler**: GRATIS (3 jobs gratis)
- **Total: ~$0.40/månad**

## Säkerhet

- Firestore säkerhetsregler: Endast Cloud Functions kan skriva
- PHP läser via REST API med API-nyckel
- API-nyckel lagras server-side i PHP (ej i JS)
- HTTPS för all kommunikation
