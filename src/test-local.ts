import { checkProviders } from './agents/providers.js';
import { writeFileSync } from 'fs';

async function runLocalTest() {
  console.log('🔍 Kör lokal test av agentsystemet...');
  console.log('📅 Tidsstämpel:', new Date().toISOString());
  
  try {
    // Kör provider-agenten för att hämta API-uppdateringar
    const releases = await checkProviders();
    
    console.log(`✅ Hittade ${releases.length} API-uppdateringar`);
    
    // Formatera resultatet för textfil
    const timestamp = new Date().toLocaleString('sv-SE');
    let report = `AI-Arne Cloud Agent Test Resultat\n`;
    report += `=====================================\n`;
    report += `Test kördes: ${timestamp}\n`;
    report += `Antal funna uppdateringar: ${releases.length}\n\n`;
    
    if (releases.length === 0) {
      report += `Inga nya API-uppdateringar hittades från leverantörerna.\n`;
    } else {
      report += `Detaljer:\n`;
      report += `----------\n\n`;
      
      releases.forEach((release, index) => {
        report += `${index + 1}. ${release.provider.toUpperCase()} - ${release.name}\n`;
        report += `   Version: ${release.version || 'N/A'}\n`;
        report += `   Typ: ${release.kind}\n`;
        report += `   Publicerad: ${new Date(release.publishedAt).toLocaleString('sv-SE')}\n`;
        report += `   URL: ${release.url}\n`;
        report += `   Sammanfattning: ${release.summary}\n\n`;
      });
    }
    
    // Skriv till textfil
    writeFileSync('test-results.txt', report, 'utf8');
    console.log('📄 Resultat sparade i test-results.txt');
    
    // Visa sammanfattning i konsolen
    console.log('\n📊 Sammanfattning:');
    releases.forEach((release, index) => {
      console.log(`${index + 1}. [${release.provider}] ${release.name} ${release.version || ''}`);
    });
    
  } catch (error) {
    console.error('❌ Fel vid körning av test:', error);
    
    const errorReport = `AI-Arne Cloud Agent Test Resultat\n=====================================\nTest kördes: ${new Date().toLocaleString('sv-SE')}\n\nFEL: ${error}\n`;
    writeFileSync('test-results.txt', errorReport, 'utf8');
  }
}

// Kör testet
runLocalTest();
