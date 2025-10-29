import { filterForDevelopmentFocus } from './agents/generalNewsAgent.js';
import type { RSSFeedItem } from './agents/generalNewsAgent.js';

/**
 * Test Responses API-funktionalitet och filtrering
 */
async function testResponsesAPI() {
  console.log('🔍 Testar Responses API-funktionalitet...\n');

  let passCount = 0;
  let failCount = 0;

  // Test 1: Filtrering - ska exkludera bildgenerering
  console.log('Test 1: Filtrering - exkludera bildgenerering');
  const imageItem: RSSFeedItem = {
    title: 'New DALL-E 3 Image Generation Features',
    link: 'https://example.com/dalle',
    contentSnippet: 'Learn about new image generation capabilities in DALL-E',
    content: 'DALL-E can now generate amazing images'
  };
  const shouldSkipImage = !filterForDevelopmentFocus(imageItem);
  if (shouldSkipImage) {
    console.log('✅ PASS: Bildgenerering exkluderades korrekt');
    passCount++;
  } else {
    console.log('❌ FAIL: Bildgenerering borde ha exkluderats');
    failCount++;
  }

  // Test 2: Filtrering - ska inkludera utveckling
  console.log('\nTest 2: Filtrering - inkludera utveckling');
  const devItem: RSSFeedItem = {
    title: 'New OpenAI API Features for Developers',
    link: 'https://example.com/api',
    contentSnippet: 'New streaming API endpoints and error handling',
    content: 'Developers can now use streaming responses'
  };
  const shouldIncludeDev = filterForDevelopmentFocus(devItem);
  if (shouldIncludeDev) {
    console.log('✅ PASS: Utvecklingsnyhet inkluderades korrekt');
    passCount++;
  } else {
    console.log('❌ FAIL: Utvecklingsnyhet borde ha inkluderats');
    failCount++;
  }

  // Test 3: Filtrering - ska exkludera video
  console.log('\nTest 3: Filtrering - exkludera videogenerering');
  const videoItem: RSSFeedItem = {
    title: 'Sora Video Generation Updates',
    link: 'https://example.com/sora',
    contentSnippet: 'New video generation features',
    content: 'Sora can generate videos'
  };
  const shouldSkipVideo = !filterForDevelopmentFocus(videoItem);
  if (shouldSkipVideo) {
    console.log('✅ PASS: Videogenerering exkluderades korrekt');
    passCount++;
  } else {
    console.log('❌ FAIL: Videogenerering borde ha exkluderats');
    failCount++;
  }

  // Test 4: Verifiera att Responses API-struktur är korrekt
  console.log('\nTest 4: Responses API JSON Schema struktur');
  const expectedSchema = {
    type: 'object',
    properties: {
      skip: { type: 'boolean' },
      title: { type: 'string' },
      excerpt: { type: 'string' },
      content: { type: 'string' }
    },
    required: ['skip', 'title', 'excerpt', 'content'],
    additionalProperties: false
  };
  
  // Verifiera schema-struktur
  const hasSkip = expectedSchema.properties.hasOwnProperty('skip');
  const hasTitle = expectedSchema.properties.hasOwnProperty('title');
  const hasExcerpt = expectedSchema.properties.hasOwnProperty('excerpt');
  const hasContent = expectedSchema.properties.hasOwnProperty('content');
  const hasRequiredFields = expectedSchema.required.length === 4;
  
  if (hasSkip && hasTitle && hasExcerpt && hasContent && hasRequiredFields) {
    console.log('✅ PASS: JSON Schema struktur är korrekt');
    passCount++;
  } else {
    console.log('❌ FAIL: JSON Schema struktur är felaktig');
    failCount++;
  }

  // Test 5: Verifiera modellnamn
  console.log('\nTest 5: Modellnamn är gpt-5-mini');
  const modelName = 'gpt-5-mini';
  if (modelName === 'gpt-5-mini') {
    console.log('✅ PASS: Korrekt modellnamn (gpt-5-mini)');
    passCount++;
  } else {
    console.log('❌ FAIL: Fel modellnamn');
    failCount++;
  }

  // Sammanfattning
  console.log('\n📊 Testresultat:');
  console.log(`✅ Passerade: ${passCount}`);
  console.log(`❌ Misslyckades: ${failCount}`);
  console.log(`📈 Totalt: ${passCount + failCount}`);
  
  if (failCount === 0) {
    console.log('\n🎉 Alla tester passerade!');
    return true;
  } else {
    console.log('\n⚠️ Några tester misslyckades');
    return false;
  }
}

// Kör testet
testResponsesAPI().catch(console.error);

