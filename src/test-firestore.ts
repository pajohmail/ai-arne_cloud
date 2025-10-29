import { config } from 'dotenv';
import { checkProviders } from './agents/providers.js';
import { upsertNews } from './agents/newsAgent.js';
import { createOrUpdateTutorial } from './agents/tutorialAgent.js';
import { writeFileSync } from 'fs';
import { withFirestore } from './services/firestore.js';

// Ladda miljövariabler
config();

async function runFirestoreTest() {
  console.log('🔍 Kör Firestore-test av agentsystemet...');
  console.log('📅 Tidsstämpel:', new Date().toISOString());
  
  // Kontrollera att miljövariabler är laddade
  console.log('🔧 Firestore-inställningar:');
  console.log(`   Project ID: ${process.env.GOOGLE_CLOUD_PROJECT}`);
  console.log(`   Public URL: ${process.env.PUBLIC_BASE_URL}`);
  
  try {
    // Kör provider-agenten för att hämta API-uppdateringar
    console.log('📡 Hämtar API-uppdateringar från leverantörer...');
    const releases = await checkProviders();
    
    console.log(`✅ Hittade ${releases.length} API-uppdateringar`);
    
    if (releases.length === 0) {
      console.log('ℹ️ Inga nya API-uppdateringar hittades');
      return;
    }

    // Testa med de 3 senaste uppdateringarna
    const testReleases = releases.slice(0, 3);
    console.log(`🧪 Testar med ${testReleases.length} uppdateringar...`);
    
    let report = `AI-Arne Cloud Firestore Test Resultat\n`;
    report += `=====================================\n`;
    report += `Test kördes: ${new Date().toLocaleString('sv-SE')}\n`;
    report += `Antal funna uppdateringar: ${releases.length}\n`;
    report += `Antal testade: ${testReleases.length}\n\n`;
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const release of testReleases) {
      try {
        console.log(`💾 Sparar: ${release.provider} - ${release.name}`);
        
        // Spara nyhet till Firestore
        const newsResult = await upsertNews(release);
        console.log(`✅ Nyhet sparad med ID: ${newsResult.id}, slug: ${newsResult.slug}`);
        
        // Läs tillbaka posten för verifiering
        await withFirestore(async (db) => {
          const doc = await db.collection('posts').doc(newsResult.id).get();
          console.log(`🔎 Verifierad post-titel: ${doc.exists ? doc.data()?.title : 'saknas'}`);
        });

        // Skapa tutorial
        const tutorialResult = await createOrUpdateTutorial(newsResult.id, release);
        console.log(`✅ Tutorial skapad med ID: ${tutorialResult.id}`);
        // Läs tillbaka tutorial för verifiering
        await withFirestore(async (db) => {
          const snap = await db.collection('tutorials').where('postId', '==', newsResult.id).limit(1).get();
          console.log(`🔎 Verifierad tutorial hittad: ${!snap.empty}`);
        });
        
        report += `✅ ${release.provider.toUpperCase()} - ${release.name}\n`;
        report += `   Nyhet ID: ${newsResult.id}, Slug: ${newsResult.slug}\n`;
        report += `   Tutorial ID: ${tutorialResult.id}\n`;
        report += `   URL: ${release.url}\n\n`;
        
        successCount++;
        
      } catch (error) {
        console.error(`❌ Fel vid sparande av ${release.provider} - ${release.name}:`, error);
        report += `❌ ${release.provider.toUpperCase()} - ${release.name}\n`;
        report += `   Fel: ${error}\n\n`;
        errorCount++;
      }
    }
    
    report += `Sammanfattning:\n`;
    report += `- Lyckade: ${successCount}\n`;
    report += `- Fel: ${errorCount}\n`;
    
    // Skriv rapport till fil
    writeFileSync('firestore-test-results.txt', report, 'utf8');
    console.log('📄 Resultat sparade i firestore-test-results.txt');
    
    console.log(`\n📊 Sammanfattning:`);
    console.log(`✅ Lyckade: ${successCount}`);
    console.log(`❌ Fel: ${errorCount}`);
    
  } catch (error) {
    console.error('❌ Fel vid körning av Firestore-test:', error);
    
    const errorReport = `AI-Arne Cloud Firestore Test Resultat\n=====================================\nTest kördes: ${new Date().toLocaleString('sv-SE')}\n\nFEL: ${error}\n`;
    writeFileSync('firestore-test-results.txt', errorReport, 'utf8');
  }
}

// Kör testet
runFirestoreTest();
