import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ContactInfo {
  email?: string;
  phone?: string;
  source: 'linkup' | 'company_site' | 'linkedin_public' | 'web_search';
  confidence: 'high' | 'medium' | 'low';
}

export interface EnrichmentTarget {
  fullName: string;
  firstName: string;
  lastName: string;
  title?: string;
  companyName: string;
  companyWebsite?: string;
  linkedinUrl?: string;
}

interface ValidationResult {
  isValid: boolean;
  normalized?: string;
}

function validateEmail(email: string): ValidationResult {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const normalized = email.toLowerCase().trim();
  
  if (!emailRegex.test(normalized)) {
    return { isValid: false };
  }
  
  const suspiciousPatterns = ['@example.com', '@test.com', 'noreply@', 'no-reply@'];
  if (suspiciousPatterns.some(pattern => normalized.includes(pattern))) {
    return { isValid: false };
  }
  
  return { isValid: true, normalized };
}

function validatePhone(phone: string): ValidationResult {
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  
  if (cleaned.length < 8 || cleaned.length > 15) {
    return { isValid: false };
  }
  
  const phoneRegex = /^[\+]?[0-9]+$/;
  if (!phoneRegex.test(cleaned)) {
    return { isValid: false };
  }
  
  return { isValid: true, normalized: phone };
}

async function searchCompanySite(target: EnrichmentTarget): Promise<ContactInfo | null> {
  const tavilyApiKey = process.env.TAVILY_API_KEY;
  
  if (!tavilyApiKey) {
    console.log('   ⚠️ TAVILY_API_KEY non disponible');
    return null;
  }

  try {
    console.log(`   🔍 Recherche sur le site de l'entreprise...`);
    
    const searchQuery = target.companyWebsite
      ? `site:${target.companyWebsite} "${target.fullName}" contact email phone`
      : `"${target.companyName}" "${target.fullName}" contact email phone équipe team`;

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: tavilyApiKey,
        query: searchQuery,
        max_results: 5,
        include_raw_content: true,
      }),
    });

    if (!response.ok) {
      console.log(`   ❌ Erreur Tavily: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const results = data.results || [];
    
    if (results.length === 0) {
      console.log(`   ⚠️ Aucun résultat trouvé sur le site`);
      return null;
    }

    const combinedContent = results
      .map((r: any) => r.content || r.raw_content || '')
      .join('\n\n')
      .slice(0, 6000);

    console.log(`   🤖 Extraction GPT des coordonnées...`);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en extraction de coordonnées professionnelles. Analyse le contenu web fourni et extrais l'email et le téléphone de la personne spécifiée.

IMPORTANT:
- Cherche uniquement les coordonnées de "${target.fullName}"
- Ignore les emails génériques (contact@, info@, etc.)
- Vérifie que l'email/téléphone est bien associé à cette personne
- Retourne UNIQUEMENT un JSON valide, rien d'autre

Format de réponse (JSON uniquement):
{
  "email": "email trouvé ou null",
  "phone": "téléphone trouvé ou null",
  "confidence": "high|medium|low"
}`,
        },
        {
          role: 'user',
          content: `Personne recherchée: ${target.fullName} (${target.title || 'fonction inconnue'})
Entreprise: ${target.companyName}

Contenu web à analyser:
${combinedContent}`,
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    
    if (result.email || result.phone) {
      console.log(`   ✅ Coordonnées trouvées sur le site`);
      if (result.email) console.log(`      Email: ${result.email}`);
      if (result.phone) console.log(`      Tél: ${result.phone}`);
      
      return {
        email: result.email || undefined,
        phone: result.phone || undefined,
        source: 'company_site',
        confidence: result.confidence || 'medium',
      };
    }

    return null;
  } catch (error) {
    console.error(`   ❌ Erreur searchCompanySite:`, error);
    return null;
  }
}

async function searchLinkedInPublic(target: EnrichmentTarget): Promise<ContactInfo | null> {
  const tavilyApiKey = process.env.TAVILY_API_KEY;
  
  if (!tavilyApiKey || !target.linkedinUrl) {
    return null;
  }

  try {
    console.log(`   🔍 Recherche sur le profil LinkedIn public...`);
    
    const searchQuery = `site:linkedin.com "${target.fullName}" "${target.companyName}" email phone contact`;

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: tavilyApiKey,
        query: searchQuery,
        max_results: 3,
        include_raw_content: true,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const results = data.results || [];
    
    if (results.length === 0) {
      return null;
    }

    const combinedContent = results
      .map((r: any) => r.content || r.raw_content || '')
      .join('\n\n')
      .slice(0, 4000);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Extrais l'email et le téléphone de "${target.fullName}" depuis le contenu LinkedIn fourni.

Retourne UNIQUEMENT un JSON:
{
  "email": "email ou null",
  "phone": "téléphone ou null",
  "confidence": "high|medium|low"
}`,
        },
        {
          role: 'user',
          content: combinedContent,
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    
    if (result.email || result.phone) {
      console.log(`   ✅ Coordonnées trouvées sur LinkedIn public`);
      return {
        email: result.email || undefined,
        phone: result.phone || undefined,
        source: 'linkedin_public',
        confidence: result.confidence || 'medium',
      };
    }

    return null;
  } catch (error) {
    console.error(`   ❌ Erreur searchLinkedInPublic:`, error);
    return null;
  }
}

async function searchOpenWeb(target: EnrichmentTarget): Promise<ContactInfo | null> {
  const tavilyApiKey = process.env.TAVILY_API_KEY;
  
  if (!tavilyApiKey) {
    return null;
  }

  try {
    console.log(`   🔍 Recherche web générale...`);
    
    const searchQuery = `"${target.fullName}" "${target.companyName}" email OR phone OR téléphone OR contact`;

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: tavilyApiKey,
        query: searchQuery,
        max_results: 5,
        include_raw_content: true,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const results = data.results || [];
    
    if (results.length === 0) {
      return null;
    }

    const combinedContent = results
      .map((r: any) => r.content || r.raw_content || '')
      .join('\n\n')
      .slice(0, 6000);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Extrais l'email et le téléphone professionnel de "${target.fullName}" (${target.companyName}).

IMPORTANT:
- Ignore les emails génériques (info@, contact@, etc.)
- Vérifie que les coordonnées sont bien associées à cette personne
- Retourne UNIQUEMENT un JSON valide

Format:
{
  "email": "email ou null",
  "phone": "téléphone ou null",
  "confidence": "high|medium|low"
}`,
        },
        {
          role: 'user',
          content: combinedContent,
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    
    if (result.email || result.phone) {
      console.log(`   ✅ Coordonnées trouvées sur le web`);
      return {
        email: result.email || undefined,
        phone: result.phone || undefined,
        source: 'web_search',
        confidence: result.confidence || 'low',
      };
    }

    return null;
  } catch (error) {
    console.error(`   ❌ Erreur searchOpenWeb:`, error);
    return null;
  }
}

export async function enrichContactInfo(
  target: EnrichmentTarget,
  existingEmail?: string | null,
  existingPhone?: string | null
): Promise<ContactInfo | null> {
  console.log(`\n🎯 Enrichissement multi-sources pour ${target.fullName}`);
  
  if (existingEmail && existingPhone) {
    console.log(`   ✓ Déjà enrichi complet`);
    return null;
  }

  const sources = [
    { name: 'site entreprise', fn: () => searchCompanySite(target) },
    { name: 'LinkedIn public', fn: () => searchLinkedInPublic(target) },
    { name: 'web général', fn: () => searchOpenWeb(target) },
  ];

  let foundEmail = existingEmail || null;
  let foundPhone = existingPhone || null;
  let lastSource: ContactInfo['source'] = 'web_search';
  let lastConfidence: ContactInfo['confidence'] = 'low';

  for (const source of sources) {
    if (foundEmail && foundPhone) {
      console.log(`   ✅ Email et téléphone trouvés, arrêt de la recherche`);
      break;
    }

    try {
      const result = await source.fn();
      
      if (result) {
        let hasNewData = false;
        
        // Validate and update email if found and not already have one
        if (result.email && !foundEmail) {
          const validation = validateEmail(result.email);
          if (validation.isValid) {
            foundEmail = validation.normalized!;
            lastSource = result.source;
            lastConfidence = result.confidence;
            hasNewData = true;
            console.log(`   ✅ Email trouvé via ${source.name}`);
          } else {
            console.log(`   ⚠️ Email invalide ignoré: ${result.email}`);
          }
        }
        
        // Validate and update phone if found and not already have one
        if (result.phone && !foundPhone) {
          const validation = validatePhone(result.phone);
          if (validation.isValid) {
            foundPhone = validation.normalized!;
            lastSource = result.source;
            lastConfidence = result.confidence;
            hasNewData = true;
            console.log(`   ✅ Téléphone trouvé via ${source.name}`);
          } else {
            console.log(`   ⚠️ Téléphone invalide ignoré: ${result.phone}`);
          }
        }
        
        if (!hasNewData) {
          console.log(`   ⚠️ Aucune donnée nouvelle de ${source.name}`);
        }
      }
    } catch (error) {
      console.error(`   ❌ Erreur source ${source.name}:`, error);
    }
  }

  // Return result if we found anything new
  if ((foundEmail && !existingEmail) || (foundPhone && !existingPhone)) {
    console.log(`   ✅ Résultat final: ${foundEmail ? 'email' : ''}${foundEmail && foundPhone ? ' + ' : ''}${foundPhone ? 'téléphone' : ''}`);
    return {
      email: foundEmail || undefined,
      phone: foundPhone || undefined,
      source: lastSource,
      confidence: lastConfidence,
    };
  }

  console.log(`   ⚠️ Aucune coordonnée supplémentaire trouvée`);
  return null;
}
