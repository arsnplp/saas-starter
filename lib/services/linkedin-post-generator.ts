import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface PostGenerationParams {
  type: 'call_to_action' | 'publicite' | 'annonce' | 'classique';
  userContext: string;
  companyName?: string;
  targetAudience?: string;
  expertise?: string;
}

const LINKEDIN_POST_PROMPT = `Tu es *votre nom*, un top writer LinkedIn dans le domaine de *votre expertise*. Tu as une expérience et des connaissances approfondies sur ce sujet, et tu veux partager les leçons apprises et expériences passées. Tu écris à des *votre audience* qui veulent *leur pain point*. À chaque fois que je te soumets une proposition de post, tu me la rédiges pour créer le plus d'engagement possible. Répond « Ok » si c'est clair pour toi.

Chaque fois que tu commences un post LinkedIn, garde à l'esprit ces 5 lignes directrices :

Commence toujours par une accroche qui exprime une opinion ou une émotion.

Raconte à la première personne ce que tu veux dire.

Saute une ligne chaque fois que tu termines une phrase.

Alterne entre des phrases courtes et des phrases longues.

Mets un smiley dans une phrase quand tu le trouves nécessaire.

Répond "ok" si c'est clair pour toi.
Voici un exemple de texte qui va t'aider à déterminer le style et le ton que j'attends de toi :

"Je n'aime vraiment pas le titre "SDR"

La raison en est que les gens le traitent comme ça.

Comme un titre.

Quelque chose dont on veut s'éloigner.

En fait, la plupart des SDR obtiennent ce titre et ensuite veulent s'en débarrasser.

Le SDR n'est pas un titre.

C'est une compétence."

Répond "ok" si c'est clair pour toi.
Voici un exemple de texte qui va t'aider à déterminer le style et le ton que j'attends de toi :

En respectant les instructions précédentes en termes de style et de ton, rédige un post LinkedIn de 200 mots en te basant sur ces idées : *votre brouillon d'idées*

Répond "ok" si c'est clair pour toi.

Pense à alterner les phrases courtes et les phrases longues

N'oublie pas de sauter une ligne chaque fois que tu termines une phrase.

Réécris le post en utilisant une structure moins prévisible et ajoute des pattern-interrupts

Réécris le post en adoptant un style plus concret et plus direct`;

function getPostTypeInstructions(type: string): string {
  const instructions = {
    call_to_action: `Ce post doit inciter à l'action. Termine par un appel clair (commentaire, partage, visite du profil, etc.). Sois persuasif mais authentique.`,
    publicite: `Ce post promeut un produit/service. Mets en avant les bénéfices concrets pour l'audience. Utilise la preuve sociale si possible. Reste subtil et apporte de la valeur.`,
    annonce: `Ce post annonce une nouveauté importante. Crée de l'anticipation et de l'enthousiasme. Explique pourquoi c'est important pour ton audience.`,
    classique: `Ce post partage une réflexion ou une expérience. Apporte de la valeur éducative. Sois authentique et personnel.`,
  };
  
  return instructions[type as keyof typeof instructions] || instructions.classique;
}

export async function generateLinkedInPost(params: PostGenerationParams): Promise<string> {
  const {
    type,
    userContext,
    companyName = 'ton entreprise',
    targetAudience = 'tes prospects',
    expertise = 'ton domaine',
  } = params;

  const typeInstructions = getPostTypeInstructions(type);

  const systemPrompt = LINKEDIN_POST_PROMPT
    .replace(/\*votre nom\*/g, companyName || 'un expert')
    .replace(/\*votre expertise\*/g, expertise)
    .replace(/\*votre audience\*/g, targetAudience)
    .replace(/\*leur pain point\*/g, 'résoudre leurs problèmes');

  const userPrompt = `${typeInstructions}

En respectant le style LinkedIn que je t'ai donné (phrases courtes/longues alternées, sauts de ligne, première personne, pattern-interrupts), rédige un post de 150-250 mots basé sur ce contexte :

${userContext}

IMPORTANT :
- Commence par une accroche forte (opinion ou émotion)
- Raconte à la première personne
- Saute une ligne après chaque phrase
- Alterne phrases courtes et longues
- Ajoute des smileys si pertinent
- Sois concret et direct
- ${typeInstructions}

Réponds UNIQUEMENT avec le post final, sans commentaire ni introduction.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 500,
    });

    const generatedContent = completion.choices[0]?.message?.content?.trim() || '';
    
    if (!generatedContent) {
      throw new Error('GPT n\'a pas généré de contenu');
    }

    return generatedContent;
  } catch (error) {
    console.error('Error generating LinkedIn post:', error);
    throw new Error('Impossible de générer le post. Veuillez réessayer.');
  }
}

export async function improveLinkedInPost(currentPost: string, improvements: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: LINKEDIN_POST_PROMPT + '\n\nTu es un expert en amélioration de posts LinkedIn. Tu gardes le même style et ton, mais tu appliques les améliorations demandées.'
        },
        { 
          role: 'user', 
          content: `Post actuel :\n${currentPost}\n\nAméliorations à apporter :\n${improvements}\n\nRéponds UNIQUEMENT avec le post amélioré, sans commentaire.`
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const improvedContent = completion.choices[0]?.message?.content?.trim() || '';
    
    if (!improvedContent) {
      throw new Error('GPT n\'a pas généré de contenu amélioré');
    }

    return improvedContent;
  } catch (error) {
    console.error('Error improving LinkedIn post:', error);
    throw new Error('Impossible d\'améliorer le post. Veuillez réessayer.');
  }
}
