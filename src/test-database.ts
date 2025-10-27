import { config } from 'dotenv';
import { checkProviders } from './agents/providers.js';
import { upsertNews } from './agents/newsAgent.js';
import { createOrUpdateTutorial } from './agents/tutorialAgent.js';
import { writeFileSync } from 'fs';

// Ladda miljövariabler
config();

async function runDatabaseTest() {
  console.log('🔍 Kör databastest av agentsystemet...');
  console.log('📅 Tidsstämpel:', new Date().toISOString());
  
  // Kontrollera att miljövariabler är laddade
  console.log('🔧 Databasinställningar:');
  console.log(`   Host: ${process.env.DB_HOST}`);
  console.log(`   Port: ${process.env.DB_PORT}`);
  console.log(`   Database: ${process.env.DB_NAME}`);
  console.log(`   User: ${process.env.DB_USER}`);
  console.log(`   SSL: ${process.env.DB_SSL}`);
  
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
    
    let report = `AI-Arne Cloud Database Test Resultat\n`;
    report += `=====================================\n`;
    report += `Test kördes: ${new Date().toLocaleString('sv-SE')}\n`;
    report += `Antal funna uppdateringar: ${releases.length}\n`;
    report += `Antal testade: ${testReleases.length}\n\n`;
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const release of testReleases) {
      try {
        console.log(`💾 Sparar: ${release.provider} - ${release.name}`);
        
        // Spara nyhet till databas
        const newsResult = await upsertNews(release);
        console.log(`✅ Nyhet sparad med ID: ${newsResult.id}, slug: ${newsResult.slug}`);
        
        // Skapa tutorial
        const tutorialResult = await createOrUpdateTutorial(newsResult.id, release);
        console.log(`✅ Tutorial skapad med ID: ${tutorialResult.id}`);
        
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
    writeFileSync('database-test-results.txt', report, 'utf8');
    console.log('📄 Resultat sparade i database-test-results.txt');
    
    console.log(`\n📊 Sammanfattning:`);
    console.log(`✅ Lyckade: ${successCount}`);
    console.log(`❌ Fel: ${errorCount}`);
    
  } catch (error) {
    console.error('❌ Fel vid körning av databastest:', error);
    
    const errorReport = `AI-Arne Cloud Database Test Resultat\n=====================================\nTest kördes: ${new Date().toLocaleString('sv-SE')}\n\nFEL: ${error}\n`;
    writeFileSync('database-test-results.txt', errorReport, 'utf8');
  }
}

// Kör testet
runDatabaseTest();
