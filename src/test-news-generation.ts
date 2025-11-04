import { config } from 'dotenv';
import { checkProviders } from './agents/providers.js';
import { generateNewsContent } from './agents/newsAgent.js';
import { generateTutorialContent } from './agents/tutorialAgent.js';
import { writeFileSync } from 'fs';

// Ladda miljövariabler
config();

async function testNewsGeneration() {
  console.log('🧪 Testar AI-generering av nyheter...');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY saknas');
    return;
  }
  
  try {
    // Hämta en release
    const releases = await checkProviders();
    if (releases.length === 0) {
      console.log('ℹ️ Inga releases hittades');
      return;
    }
    
    const testRelease = releases[0];
    console.log(`\n🎯 Testar med: ${testRelease.provider} - ${testRelease.name} ${testRelease.version || ''}`);
    
    // Testa news generation
    console.log('\n📰 Testar news generation...');
    const newsContent = await generateNewsContent(testRelease);
    
    if (newsContent) {
      console.log('✅ News content genererat!');
      console.log(`   Titel: ${newsContent.title}`);
      console.log(`   Titel längd: ${newsContent.title.length} tecken`);
      console.log(`   Introduktion: ${newsContent.introduction.slice(0, 100)}...`);
      console.log(`   Introduktion längd: ${newsContent.introduction.length} tecken`);
      console.log(`   Innehåll: ${newsContent.content.slice(0, 100)}...`);
      console.log(`   Innehåll längd: ${newsContent.content.length} tecken`);
      console.log(`   Excerpt: ${newsContent.excerpt}`);
      console.log(`   Excerpt längd: ${newsContent.excerpt.length} tecken`);
      
      // Skriv till fil
      const report = `News Generation Test Resultat\n=====================================\n\nTitel:\n${newsContent.title}\n\nIntroduktion:\n${newsContent.introduction}\n\nInnehåll:\n${newsContent.content}\n\nExcerpt:\n${newsContent.excerpt}\n`;
      writeFileSync('news-generation-test.txt', report, 'utf8');
      console.log('\n📄 Resultat sparad i news-generation-test.txt');
    } else {
      console.error('❌ Kunde inte generera news content');
    }
    
    // Testa tutorial generation
    console.log('\n📚 Testar tutorial generation...');
    const tutorialContent = await generateTutorialContent(testRelease);
    
    if (tutorialContent) {
      console.log('✅ Tutorial content genererat!');
      console.log(`   Titel: ${tutorialContent.title}`);
      console.log(`   Titel längd: ${tutorialContent.title.length} tecken`);
      console.log(`   Introduktion: ${tutorialContent.introduction.slice(0, 100)}...`);
      console.log(`   Introduktion längd: ${tutorialContent.introduction.length} tecken`);
      console.log(`   Kodexempel: ${tutorialContent.codeExamples.length} exempel`);
      console.log(`   Förbättringar: ${tutorialContent.improvements.length} punkter`);
      
      // Skriv till fil
      let report = `Tutorial Generation Test Resultat\n=====================================\n\nTitel:\n${tutorialContent.title}\n\nIntroduktion:\n${tutorialContent.introduction}\n\nVad är nytt:\n${tutorialContent.whatsNew}\n\nFörbättringar:\n${tutorialContent.improvements.map((imp, i) => `${i + 1}. ${imp}`).join('\n')}\n\nKodexempel:\n`;
      tutorialContent.codeExamples.forEach((ex, i) => {
        report += `\nExempel ${i + 1}: ${ex.title}\n${ex.description}\n${ex.code}\n`;
      });
      writeFileSync('tutorial-generation-test.txt', report, 'utf8');
      console.log('\n📄 Resultat sparad i tutorial-generation-test.txt');
    } else {
      console.error('❌ Kunde inte generera tutorial content');
    }
    
  } catch (error) {
    console.error('❌ Fel:', error);
    if (error instanceof Error) {
      console.error('   Felmeddelande:', error.message);
      console.error('   Stack:', error.stack);
    }
  }
}

testNewsGeneration();

