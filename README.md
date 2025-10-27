# AI-Arne Cloud Agentsystem

Ett agentsystem som körs på Google Cloud Functions och övervakar AI-API:er från stora leverantörer.

## Funktioner

- **Chefagent**: Orkestrerar systemet varannan vecka
- **Provider-agent**: Övervakar OpenAI, Google Gemini, Meta Llama, Anthropic
- **Nyhetsagent**: Publicerar bearbetade nyheter till MySQL-databas
- **Tutorial-agent**: Skapar översiktliga tutorials
- **LinkedIn-integration**: Uppdaterar företagsprofil automatiskt

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

## Databasschema

```sql
CREATE TABLE IF NOT EXISTS posts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  slug VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  excerpt TEXT,
  content MEDIUMTEXT NOT NULL,
  provider VARCHAR(64) NOT NULL,
  source_url VARCHAR(512),
  linkedin_urn VARCHAR(128),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tutorials (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  code_samples MEDIUMTEXT,
  source_url VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id)
);
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
  --set-env-vars=PUBLIC_BASE_URL=https://ai-arne.se \
  --set-env-vars=DB_HOST=XXXXX,DB_PORT=3306,DB_USER=XXXXX,DB_PASSWORD=XXXXX,DB_NAME=XXXXX,DB_SSL=true \
  --set-env-vars=LINKEDIN_ACCESS_TOKEN=XXXXX,LINKEDIN_ORG_URN=urn:li:organization:XXXXXX
```

### 3. Sätt upp Cloud Scheduler
```bash
gcloud scheduler jobs create http ai-arne-biweekly \
  --schedule="0 9 * * MON" \
  --time-zone="Europe/Stockholm" \
  --uri="https://REGION-PROJECT.cloudfunctions.net/managerHandler" \
  --http-method=GET
```

## Testning

Manuell körning (forcerad):
```bash
curl -X POST "https://REGION-PROJECT.cloudfunctions.net/managerHandler?force=1"
```

## Lokal utveckling

```bash
npm run dev
```

## Arkitektur

- **Cloud Functions (Gen2)**: Node.js 22
- **Databas**: MySQL på one.com
- **Schemaläggning**: Cloud Scheduler
- **API-övervakning**: GitHub releases från AI-leverantörer
- **Publicering**: MySQL + LinkedIn API
