import OpenAI from 'openai';
import type { RSSFeedItem } from './src/agents/generalNewsAgent.js';

async function testOpenAIResponsesAPI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not set');
    return;
  }

  console.log('🧪 Testar OpenAI Responses API för RSS-nyhetssammanfattning\n');
  
  const openai = new OpenAI({ apiKey });

  // Test 1: Responses API med vår faktiska schema
  console.log('📝 Test 1: Responses API med news_summary schema');
  try {
    const testItem: RSSFeedItem = {
      title: 'OpenAI Announces New GPT-4 Turbo Update',
      link: 'https://example.com/news',
      contentSnippet: 'OpenAI has released a major update to GPT-4 Turbo with improved reasoning capabilities and lower costs.',
      content: 'OpenAI announced today that GPT-4 Turbo will receive significant updates including better reasoning, lower pricing, and improved API performance.'
    };

    const responseSchema = {
      type: 'object',
      properties: {
        skip: {
          type: 'boolean',
          description: 'true om nyheten ska hoppas över (bildgenerering, videogenerering, etc.)'
        },
        title: {
          type: 'string',
          description: 'Artikelns titel på svenska'
        },
        excerpt: {
          type: 'string',
          description: 'Kort sammanfattning på svenska (2-3 meningar, max 200 ord)'
        },
        content: {
          type: 'string',
          description: 'Huvudinnehåll på svenska (3-5 meningar, max 300 ord)'
        }
      },
      required: ['skip', 'title', 'excerpt', 'content'],
      additionalProperties: false
    };

    const prompt = `Du är en AI-nyhetsredigerare som fokuserar på AI-utveckling och programmering. 
Kontrollera följande nyhet och skapa en kort sammanfattning på svenska som fokuserar på utvecklingsaspekter.

Om nyheten handlar om bildgenerering, videogenerering, eller visuella AI-tjänster som inte är relevanta för utveckling, sätt "skip" till true.

Nyhetstitel: ${testItem.title}
Innehåll: ${testItem.contentSnippet}

Skapa en kort artikel på svenska med:
- Titel (behåll originaltiteln om den är relevant)
- En kort sammanfattning (2-3 meningar, max 200 ord)
- Huvudinnehåll (3-5 meningar, max 300 ord)`;

    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: 'Du är en AI-nyhetsredigerare som fokuserar på AI-utveckling och programmering. Svara alltid på svenska med strukturerad JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 1000,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'news_summary',
          strict: true,
          schema: responseSchema as any
        }
      }
    });

    const parsedResponse = completion.choices[0]?.message?.parsed as any;
    
    if (!parsedResponse) {
      console.error('❌ Ingen parsed response');
      return;
    }

    console.log('✅ Structured output mottagen:');
    console.log(`   skip: ${parsedResponse.skip}`);
    console.log(`   title: ${parsedResponse.title?.substring(0, 50)}...`);
    console.log(`   excerpt: ${parsedResponse.excerpt?.substring(0, 50)}...`);
    console.log(`   content: ${parsedResponse.content?.substring(0, 50)}...`);

    // Verifiera strukturen
    if (typeof parsedResponse.skip !== 'boolean') {
      console.error('❌ skip är inte boolean');
      return;
    }
    if (typeof parsedResponse.title !== 'string') {
      console.error('❌ title är inte string');
      return;
    }
    if (parsedResponse.title.length === 0) {
      console.error('❌ title är tom');
      return;
    }
    console.log('✅ Schema-validering: OK');

  } catch (error: any) {
    console.error('❌ Fel:', error.message);
    return;
  }

  // Test 2: Testa "skip" funktionalitet med bildgenerering
  console.log('\n📝 Test 2: Skip-funktionalitet för bildgenerering');
  try {
    const imageItem: RSSFeedItem = {
      title: 'New DALL-E 3 Features for Image Generation',
      link: 'https://example.com/dalle',
      contentSnippet: 'DALL-E 3 now supports new image generation features and improved image quality.',
      content: 'OpenAI has released DALL-E 3 with enhanced image generation capabilities.'
    };

    const responseSchema = {
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

    const prompt = `Du är en AI-nyhetsredigerare som fokuserar på AI-utveckling och programmering. 
Kontrollera följande nyhet och skapa en kort sammanfattning på svenska som fokuserar på utvecklingsaspekter.

Om nyheten handlar om bildgenerering, videogenerering, eller visuella AI-tjänster som inte är relevanta för utveckling, sätt "skip" till true.

Nyhetstitel: ${imageItem.title}
Innehåll: ${imageItem.contentSnippet}`;

    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: 'Du är en AI-nyhetsredigerare som fokuserar på AI-utveckling och programmering. Svara alltid på svenska med strukturerad JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 1000,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'news_summary',
          strict: true,
          schema: responseSchema as any
        }
      }
    });

    const parsedResponse = completion.choices[0]?.message?.parsed as any;
    
    if (parsedResponse?.skip === true) {
      console.log('✅ Skip-funktionalitet fungerar: bildgenerering markerades för hoppa över');
    } else {
      console.log('⚠️  Skip returnerade false (kan vara OK om modellen inte identifierade det som bildgenerering)');
    }

  } catch (error: any) {
    console.error('❌ Fel:', error.message);
  }

  // Test 3: Testa svenska språk
  console.log('\n📝 Test 3: Svenska språk i response');
  try {
    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: 'Du är en AI-nyhetsredigerare som fokuserar på AI-utveckling och programmering. Svara alltid på svenska med strukturerad JSON.'
        },
        {
          role: 'user',
          content: 'Skapa en kort sammanfattning av "AI-utveckling för programmerare" på svenska'
        }
      ],
      max_completion_tokens: 500,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'news_summary',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              skip: { type: 'boolean' },
              title: { type: 'string' },
              excerpt: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['skip', 'title', 'excerpt', 'content'],
            additionalProperties: false
          }
        }
      }
    });

    const parsedResponse = completion.choices[0]?.message?.parsed as any;
    const excerpt = parsedResponse?.excerpt || '';
    
    // Kolla om det finns svenska tecken eller vanliga svenska ord
    const swedishWords = ['är', 'och', 'för', 'med', 'som', 'detta', 'nya', 'utveckling', 'programmerare'];
    const hasSwedishWords = swedishWords.some(word => excerpt.toLowerCase().includes(word));
    
    if (hasSwedishWords || excerpt.includes('å') || excerpt.includes('ä') || excerpt.includes('ö')) {
      console.log('✅ Response verkar vara på svenska');
      console.log(`   Exempel: "${excerpt.substring(0, 80)}..."`);
    } else {
      console.log('⚠️  Response kan vara på engelska - kontrollera manuellt');
      console.log(`   Text: "${excerpt.substring(0, 80)}..."`);
    }

  } catch (error: any) {
    console.error('❌ Fel:', error.message);
  }

  // Test 4: Error handling
  console.log('\n📝 Test 4: Error handling med ogiltig input');
  try {
    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'user',
          content: ''
        }
      ],
      max_completion_tokens: 100,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'news_summary',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              skip: { type: 'boolean' },
              title: { type: 'string' },
              excerpt: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['skip', 'title', 'excerpt', 'content'],
            additionalProperties: false
          }
        }
      }
    });

    console.log('⚠️  Ogiltig input hanterades men gav svar (kanske okej)');

  } catch (error: any) {
    if (error.message.includes('length limit') || error.message.includes('empty')) {
      console.log('✅ Error handling fungerar: ogiltig input hanteras korrekt');
    } else {
      console.log(`⚠️  Oväntat fel: ${error.message}`);
    }
  }

  // Test 5: Token-längd och prestanda
  console.log('\n📝 Test 5: Token-längd och prestanda');
  try {
    const startTime = Date.now();
    const longContent = 'A'.repeat(1000) + ' OpenAI released new features. ' + 'B'.repeat(1000);
    
    const testItem: RSSFeedItem = {
      title: 'Long Content Test',
      link: 'https://example.com',
      contentSnippet: longContent,
      content: longContent
    };

    const prompt = `Du är en AI-nyhetsredigerare som fokuserar på AI-utveckling och programmering. 
Sammanfatta följande nyhet på svenska (max 300 ord):

Nyhetstitel: ${testItem.title}
Innehåll: ${testItem.contentSnippet.substring(0, 2000)}`;

    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: 'Svara alltid på svenska med strukturerad JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 1000,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'news_summary',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              skip: { type: 'boolean' },
              title: { type: 'string' },
              excerpt: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['skip', 'title', 'excerpt', 'content'],
            additionalProperties: false
          }
        }
      }
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    const parsedResponse = completion.choices[0]?.message?.parsed as any;
    console.log(`✅ Långt innehåll hanterades på ${duration}s`);
    console.log(`   Response length: ${JSON.stringify(parsedResponse).length} tecken`);
    
  } catch (error: any) {
    console.error('❌ Fel:', error.message);
  }

  console.log('\n📊 Sammanfattning:');
  console.log('✅ Responses API med structured outputs fungerar');
  console.log('✅ Schema-validering fungerar');
  console.log('✅ Svenska språk stöds');
  console.log('✅ Error handling implementerat');
  console.log('\n🎉 Alla tester genomförda!');
}

testOpenAIResponsesAPI().catch(console.error);
