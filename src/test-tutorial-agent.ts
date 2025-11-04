import { config } from 'dotenv';
import { checkProviders } from './agents/providers.js';
import { createOrUpdateTutorial, generateTutorialContent, fetchReleaseNotes, fetchPreviousVersions, searchCommunityFeedback } from './agents/tutorialAgent.js';
import { writeFileSync } from 'fs';

// Ladda miljövariabler
config();

async function testTutorialAgent() {
  console.log('🧪 Testar förbättrad tutorial-agent...');
  console.log('📅 Tidsstämpel:', new Date().toISOString());
  
  // Kontrollera att OpenAI API-nyckel finns
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY saknas i miljövariabler');
    return;
  }
  
  console.log('✅ OpenAI API-nyckel hittad');
  
  try {
    // Hämta API-uppdateringar
    console.log('📡 Hämtar API-uppdateringar från leverantörer...');
    const releases = await checkProviders();
    
    if (releases.length === 0) {
      console.log('ℹ️ Inga API-uppdateringar hittades');
      return;
    }
    
    console.log(`✅ Hittade ${releases.length} API-uppdateringar`);
    
    // Testa med första release
    const testRelease = releases[0];
    console.log(`\n🎯 Testar med: ${testRelease.provider} - ${testRelease.name} ${testRelease.version || ''}`);
    console.log(`   URL: ${testRelease.url}`);
    
    // Test 1: Hämta release notes
    console.log('\n📝 Test 1: Hämtar release notes...');
    const releaseNotes = await fetchReleaseNotes(testRelease);
    console.log(`✅ Release notes hämtade (${releaseNotes.length} tecken)`);
    console.log(`   Förhandsvisning: ${releaseNotes.slice(0, 200)}...`);
    
    // Test 2: Hämta tidigare versioner
    console.log('\n📚 Test 2: Hämtar tidigare versioner...');
    const previousVersions = await fetchPreviousVersions(testRelease.provider, testRelease.version);
    console.log(`✅ Hittade ${previousVersions.length} tidigare versioner`);
    previousVersions.forEach((v, i) => {
      console.log(`   ${i + 1}. ${v.version} (${v.publishedAt})`);
    });
    
    // Test 3: Sök community-feedback
    console.log('\n💬 Test 3: Söker community-feedback...');
    const communityFeedback = await searchCommunityFeedback(
      testRelease.provider,
      testRelease.name,
      testRelease.version
    );
    if (communityFeedback) {
      console.log(`✅ Community-feedback hittad (${communityFeedback.length} tecken)`);
      console.log(`   Förhandsvisning: ${communityFeedback.slice(0, 200)}...`);
    } else {
      console.log('ℹ️ Ingen community-feedback hittad');
    }
    
    // Test 4: Generera tutorial-innehåll med AI
    console.log('\n🤖 Test 4: Genererar tutorial-innehåll med AI...');
    const tutorialContent = await generateTutorialContent(testRelease);
    
    if (tutorialContent) {
      console.log('✅ Tutorial-innehåll genererat!');
      console.log(`   Titel: ${tutorialContent.title}`);
      console.log(`   Introduktion: ${tutorialContent.introduction.slice(0, 100)}...`);
      console.log(`   Förbättringar: ${tutorialContent.improvements.length} punkter`);
      console.log(`   Kodexempel: ${tutorialContent.codeExamples.length} exempel`);
      console.log(`   Resurser: ${tutorialContent.resources.length} länkar`);
      
      // Skriv detaljerad rapport
      let report = `Tutorial Agent Test Resultat\n`;
      report += `=====================================\n`;
      report += `Test kördes: ${new Date().toLocaleString('sv-SE')}\n`;
      report += `Release: ${testRelease.provider} - ${testRelease.name} ${testRelease.version || ''}\n\n`;
      
      report += `TITEL:\n${tutorialContent.title}\n\n`;
      report += `INTRODUKTION:\n${tutorialContent.introduction}\n\n`;
      report += `VAD ÄR NYTT:\n${tutorialContent.whatsNew}\n\n`;
      report += `FÖRBÄTTRINGAR:\n${tutorialContent.improvements.map((imp, i) => `${i + 1}. ${imp}`).join('\n')}\n\n`;
      report += `INSTALLATION:\n${tutorialContent.installation}\n\n`;
      report += `KODEXEMPEL:\n`;
      tutorialContent.codeExamples.forEach((ex, i) => {
        report += `\nExempel ${i + 1}: ${ex.title}\n`;
        report += `Beskrivning: ${ex.description}\n`;
        report += `Språk: ${ex.language}\n`;
        report += `Kod:\n${ex.code}\n`;
      });
      report += `\n\nCOMMUNITY-RECENSIONER:\n${tutorialContent.communityReviews}\n\n`;
      report += `RESURSER:\n${tutorialContent.resources.map(r => `- ${r.title}: ${r.url}`).join('\n')}\n`;
      
      writeFileSync('tutorial-test-results.txt', report, 'utf8');
      console.log('\n📄 Detaljerad rapport sparad i tutorial-test-results.txt');
      
    } else {
      console.error('❌ Kunde inte generera tutorial-innehåll');
    }
    
    console.log('\n✅ Alla tester klara!');
    
  } catch (error) {
    console.error('❌ Fel vid testning:', error);
    if (error instanceof Error) {
      console.error('   Felmeddelande:', error.message);
      console.error('   Stack:', error.stack);
    }
  }
}

// Kör testet
testTutorialAgent();

