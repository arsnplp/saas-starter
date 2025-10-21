import 'dotenv/config';

const INGEST_API_TOKEN = process.env.INGEST_API_TOKEN;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000';

// Fonction pour appeler les endpoints de cron
async function callCronEndpoint(endpoint: string) {
  try {
    const response = await fetch(`${BASE_URL}/api/cron/${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${INGEST_API_TOKEN}`,
      },
    });

    const data = await response.json();
    console.log(`[${new Date().toISOString()}] ${endpoint}:`, data);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Erreur ${endpoint}:`, error);
  }
}

// Fonction pour détecter les posts
async function detectPosts() {
  console.log(`[${new Date().toISOString()}] 🔍 Détection des nouveaux posts LinkedIn...`);
  await callCronEndpoint('detect-posts');
}

// Fonction pour extraire les leads
async function extractLeads() {
  console.log(`[${new Date().toISOString()}] 📥 Extraction des leads programmés...`);
  await callCronEndpoint('extract-leads');
}

// Configuration des intervalles
const DETECT_INTERVAL = 5 * 60 * 1000; // 5 minutes
const EXTRACT_INTERVAL = 5 * 60 * 1000; // 5 minutes

console.log('🚀 Démarrage du planificateur de cron jobs...');
console.log(`   - Détection des posts: toutes les ${DETECT_INTERVAL / 60000} minutes`);
console.log(`   - Extraction des leads: toutes les ${EXTRACT_INTERVAL / 60000} minutes`);

// Exécution immédiate au démarrage
detectPosts();
extractLeads();

// Planification des exécutions régulières
setInterval(detectPosts, DETECT_INTERVAL);
setInterval(extractLeads, EXTRACT_INTERVAL);
