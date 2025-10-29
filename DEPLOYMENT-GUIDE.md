# Deployment Guide för AI-Arne Cloud

## Status ✅

### Klart:
- ✅ gcloud CLI installerad och konfigurerad
- ✅ Inloggad med pajohmail@gmail.com
- ✅ Projekt `ai-arne-cloud` skapat
- ✅ Cloud Functions och Firestore API:er aktiverade
- ✅ Firestore-databas skapad (europe-north1, gratis tier)
- ✅ Firebase CLI installerad
- ✅ firebase.json skapad

### Kräver aktion från dig:

#### 1. Aktivera Billing (KRÄVS)
Cloud Functions och Cloud Scheduler kräver att billing är aktiverat.

**Steg:**
1. Gå till [Google Cloud Console](https://console.cloud.google.com/)
2. Välj projekt `ai-arne-cloud`
3. Gå till "Billing" i menyn
4. Länka ett billing-konto
5. Om du inte har ett billing-konto, skapa ett (kräver betalkort)

**Obs:** Firestore har en generös gratis tier, men Cloud Functions kräver billing även för gratis tier-usage.

#### 2. Logga in på Firebase
```bash
firebase login
```
Detta öppnar en webbläsare. Logga in med pajohmail@gmail.com.

Efter inloggning:
```bash
firebase use ai-arne-cloud
firebase deploy --only firestore:rules
```

#### 3. Konfigurera miljövariabler
Innan du deployar Cloud Functions behöver du dessa värden:

- `LINKEDIN_ACCESS_TOKEN` - OAuth token för LinkedIn business-sida
- `LINKEDIN_ORG_URN` - Organisation URN från LinkedIn
- `RSS_FEEDS` - Kommaseparerade RSS-feed URLs (för generalNewsHandler)
- `ANTHROPIC_API_KEY` - API-nyckel för Anthropic Claude (för generalNewsHandler)

## Deployment-kommandon

Efter att billing är aktiverat och miljövariabler är redo:

### Deploya apiNewsHandler:
```bash
export PATH=/usr/local/share/google-cloud-sdk/bin:"$PATH"

gcloud functions deploy apiNewsHandler \
  --gen2 \
  --runtime=nodejs22 \
  --region=europe-north1 \
  --source=. \
  --entry-point=apiNewsHandler \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars=GOOGLE_CLOUD_PROJECT=ai-arne-cloud,PUBLIC_BASE_URL=https://ai-arne.se,LINKEDIN_ACCESS_TOKEN=din_token_här,LINKEDIN_ORG_URN=urn:li:organization:din_urn_här
```

### Deploya generalNewsHandler:
```bash
gcloud functions deploy generalNewsHandler \
  --gen2 \
  --runtime=nodejs22 \
  --region=europe-north1 \
  --source=. \
  --entry-point=generalNewsHandler \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars=GOOGLE_CLOUD_PROJECT=ai-arne-cloud,PUBLIC_BASE_URL=https://ai-arne.se,LINKEDIN_ACCESS_TOKEN=din_token_här,LINKEDIN_ORG_URN=urn:li:organization:din_urn_här,RSS_FEEDS=https://feeds.feedburner.com/oreilly/radar,https://techcrunch.com/feed/,ANTHROPIC_API_KEY=din_api_key_här
```

## Cloud Scheduler (efter billing aktiverat)

Efter att funktionerna är deployade kan du sätta upp Cloud Scheduler:

```bash
# För API-nyheter
gcloud scheduler jobs create http ai-arne-api-news \
  --schedule="0 9 * * MON" \
  --time-zone="Europe/Stockholm" \
  --uri="https://europe-north1-ai-arne-cloud.cloudfunctions.net/apiNewsHandler" \
  --http-method=GET

# För allmänna nyheter
gcloud scheduler jobs create http ai-arne-general-news \
  --schedule="0 9 * * MON" \
  --time-zone="Europe/Stockholm" \
  --uri="https://europe-north1-ai-arne-cloud.cloudfunctions.net/generalNewsHandler" \
  --http-method=GET
```

## Firestore Index

Firestore-index skapas automatiskt när första query körs. Om du vill skapa dem manuellt:

1. Gå till [Firestore Console](https://console.cloud.google.com/firestore)
2. Välj projekt `ai-arne-cloud`
3. Gå till "Indexes"
4. Klicka "Create Index"
5. Skapa index för:
   - Collection: `posts`, Field: `slug` (Ascending)
   - Collection: `tutorials`, Field: `postId` (Ascending)
   - Collection: `news`, Field: `slug` (Ascending)

## Testa deployment

Efter deployment kan du testa funktionerna:

```bash
# Testa apiNewsHandler
curl "https://europe-north1-ai-arne-cloud.cloudfunctions.net/apiNewsHandler?force=1"

# Testa generalNewsHandler
curl "https://europe-north1-ai-arne-cloud.cloudfunctions.net/generalNewsHandler?force=1"
```

## Nästa steg

1. ✅ Aktivera billing i Google Cloud Console
2. ✅ Logga in på Firebase och deploya Firestore-regler
3. ✅ Samla ihop miljövariabler (LinkedIn token, Anthropic API key, etc.)
4. ✅ Deploya Cloud Functions
5. ✅ Sätt upp Cloud Scheduler (valfritt)

