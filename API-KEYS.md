# AI-Arne Cloud - API-nycklar & Konfiguration

## 🔑 API-nycklar (Obligatoriska)

### 1. OpenAI API Key
**Miljövariabel:** `OPENAI_API_KEY`
**Format:** `sk-...`
**Används för:**
- Responses API för RSS-nyhetssammanfattning
- Modell: `gpt-5-mini`
- Structured outputs för JSON parsing

**Var att hämta:**
- https://platform.openai.com/api-keys
- Skapa ett konto och generera en nyckel

---

### 2. LinkedIn Access Token
**Miljövariabel:** `LINKEDIN_ACCESS_TOKEN`
**Format:** OAuth Bearer token (t.ex. `ya29...`)
**Används för:**
- Posta till LinkedIn business-sida
- Via LinkedIn API v2

**Var att hämta:**
- LinkedIn Developer Portal (redan konfigurerad för AI-Arne business-sida)
- OAuth-flow för business-sida
- Token måste vara för rätt organisation

---

### 3. LinkedIn Organization URN
**Miljövariabel:** `LINKEDIN_ORG_URN`
**Format:** `urn:li:organization:123456789`
**Används för:**
- Identifiera vilken LinkedIn-organisation som ska posta
- Tillsammans med Access Token

**Var att hämta:**
- LinkedIn Developer Portal
- Organisationens URN från din business-sida

---

## ⚙️ Konfiguration (Obligatoriska)

### 4. Google Cloud Project ID
**Miljövariabel:** `GOOGLE_CLOUD_PROJECT`
**Format:** `ai-arne-cloud`
**Används för:**
- Firestore database
- Cloud Functions
- **INTE en API-nyckel** - använder Application Default Credentials (ADC)

**OBS:** Autentisering sker automatiskt via Google Cloud när du deployar!

---

### 5. Public Base URL
**Miljövariabel:** `PUBLIC_BASE_URL`
**Format:** `https://ai-arne.se`
**Används för:**
- Generera publika länkar i innehåll
- LinkedIn-poster med länkar

---

### 6. RSS Feeds
**Miljövariabel:** `RSS_FEEDS`
**Format:** Kommaseparerade URLs (t.ex. `https://feeds.feedburner.com/oreilly/radar,https://techcrunch.com/feed/`)
**Används för:**
- Hämtar AI-nyheter från RSS-feeds
- För generalNewsAgent

**Ingen API-nyckel behövs** - publika RSS-feeds

---

## 📋 Checklist för Deployment

- [ ] OpenAI API Key skapad och kopierad
- [ ] LinkedIn Access Token erhållen (för AI-Arne business-sida)
- [ ] LinkedIn Organization URN noterad
- [ ] Google Cloud Project ID bekräftat (`ai-arne-cloud`)
- [ ] Public Base URL bekräftad (`https://ai-arne.se`)
- [ ] RSS Feeds konfigurerade

---

## 🔐 Säkerhet

**Viktigt:**
- **ALDRIG** commit API-nycklar till git
- Använd `.env` fil lokalt (som är gitignorade)
- I Cloud Functions: Använd `--set-env-vars` vid deployment
- Eller använd Google Secret Manager för känsliga nycklar (rekommenderat)

---

## 💡 Tips

### Google Secret Manager (Rekommenderat)
Istället för miljövariabler kan du använda Secret Manager:

```bash
# Skapa secrets
echo -n "sk-..." | gcloud secrets create openai-api-key --data-file=-

# Använd i Cloud Function
gcloud functions deploy ... \
  --set-secrets=OPENAI_API_KEY=openai-api-key:latest
```

### Testa nycklar lokalt
Kör innan deployment:
```bash
# Sätt i .env fil
OPENAI_API_KEY=sk-...
LINKEDIN_ACCESS_TOKEN=ya29...
LINKEDIN_ORG_URN=urn:li:organization:...

# Testa
npm run test:local
```

---

## 📞 Hjälp

Om något saknas:
- OpenAI: https://platform.openai.com/api-keys
- LinkedIn: https://www.linkedin.com/developers/
- Google Cloud: https://console.cloud.google.com/

