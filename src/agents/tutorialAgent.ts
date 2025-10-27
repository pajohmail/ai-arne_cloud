import { withFirestore } from '../services/firestore.js';
import { sanitizeHtml } from '../utils/text.js';
import type { ProviderRelease } from './providers.js';

export async function createOrUpdateTutorial(postId: string, release: ProviderRelease) {
  const title = `Kom igång med ${release.name}${release.version ? ' ' + release.version : ''}`;
  const html = sanitizeHtml(
    [
      `<h2>${title}</h2>`,
      `<p>I den här guiden går vi igenom det nya API:et från ${release.provider}.</p>`,
      `<h3>Förutsättningar</h3>`,
      `<ul><li>Konto hos leverantören</li><li>API-nyckel</li><li>Node.js 22+</li></ul>`,
      `<h3>Installation</h3>`,
      `<pre><code>npm i provider-sdk</code></pre>`,
      `<h3>Exempelkod</h3>`,
      `<pre><code>import Client from 'provider-sdk';\nconst client = new Client(process.env.PROVIDER_API_KEY);\nconst resp = await client.doSomething();\nconsole.log(resp);</code></pre>`,
      `<h3>Läs mer</h3>`,
      `<p><a href="${release.url}" rel="noopener" target="_blank">${release.url}</a></p>`
    ].join('\n')
  );

  return await withFirestore(async (db) => {
    const tutorialsRef = db.collection('tutorials');
    
    // Kolla om tutorial redan finns för denna post
    const existingQuery = await tutorialsRef.where('postId', '==', postId).limit(1).get();
    
    const tutorialData = {
      postId,
      title,
      content: html,
      sourceUrl: release.url,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (!existingQuery.empty) {
      // Uppdatera befintlig tutorial
      const existingDoc = existingQuery.docs[0];
      await existingDoc.ref.update({
        title,
        content: html,
        sourceUrl: release.url,
        updatedAt: new Date()
      });
      return { 
        id: existingDoc.id, 
        updated: true 
      };
    } else {
      // Skapa ny tutorial
      const docRef = await tutorialsRef.add(tutorialData);
      return { 
        id: docRef.id, 
        updated: false 
      };
    }
  });
}
