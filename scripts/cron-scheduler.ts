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

// Fonction pour nettoyer les états OAuth expirés
async function cleanupOAuthStates() {
  console.log(`[${new Date().toISOString()}] 🧹 Nettoyage des états OAuth expirés...`);
  await callCronEndpoint('cleanup-oauth-states');
}

// Fonction pour exécuter les campagnes
async function executeCampaigns() {
  console.log(`[${new Date().toISOString()}] 📧 Exécution des campagnes email...`);
  await callCronEndpoint('execute-campaigns');
}

// Fonction pour traiter les workflows
async function processWorkflows() {
  console.log(`[${new Date().toISOString()}] ⚙️  Traitement des workflows...`);
  await callCronEndpoint('process-workflows');
}

// Configuration des intervalles
const DETECT_INTERVAL = 2 * 60 * 60 * 1000; // 2 heures
const EXTRACT_INTERVAL = 2 * 60 * 60 * 1000; // 2 heures
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 heure
const CAMPAIGN_INTERVAL = 60 * 60 * 1000; // 1 heure
const WORKFLOW_INTERVAL = 1 * 60 * 1000; // 1 minute

console.log('🚀 Démarrage du planificateur de cron jobs...');
console.log(`   - Détection des posts: toutes les ${DETECT_INTERVAL / 60000} minutes`);
console.log(`   - Extraction des leads: toutes les ${EXTRACT_INTERVAL / 60000} minutes`);
console.log(`   - Nettoyage OAuth: toutes les ${CLEANUP_INTERVAL / 60000} minutes`);
console.log(`   - Exécution des campagnes: toutes les ${CAMPAIGN_INTERVAL / 60000} minutes`);
console.log(`   - Traitement des workflows: toutes les ${WORKFLOW_INTERVAL / 60000} minutes`);

// Exécution immédiate au démarrage
detectPosts();
extractLeads();
cleanupOAuthStates();
executeCampaigns();
processWorkflows();

// Planification des exécutions régulières
setInterval(detectPosts, DETECT_INTERVAL);
setInterval(extractLeads, EXTRACT_INTERVAL);
setInterval(cleanupOAuthStates, CLEANUP_INTERVAL);
setInterval(executeCampaigns, CAMPAIGN_INTERVAL);
setInterval(processWorkflows, WORKFLOW_INTERVAL);
