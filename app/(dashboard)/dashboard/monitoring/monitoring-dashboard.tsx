'use client';

import { useState, useTransition, useEffect } from 'react';
import { Plus, Play, Pause, Bell, Clock, Settings2, ExternalLink, Trash2, Download, Users } from 'lucide-react';
import {
  addMonitoredCompanyAction,
  removeMonitoredCompanyAction,
  updateCollectionConfigAction,
  toggleMonitoringAction,
  markPostsAsReadAction,
  setupWebhookAccountAction,
  getAccountPostsAction,
  configurePostCollectionAction,
  fetchPostsForAccountAction,
  extractLeadsFromPostAction,
} from './actions';
import { toast } from 'sonner';
import { estimateLeadCollectionCredits } from '@/lib/utils/credit-estimation';

type MonitoringData = Awaited<ReturnType<typeof import('./actions').getMonitoringDataAction>>;

export function MonitoringDashboard({ initialData }: { initialData: MonitoringData }) {
  const [data, setData] = useState(initialData);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPostsPanel, setShowPostsPanel] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [showAccountDetail, setShowAccountDetail] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { companies, recentPosts, webhookStatus, newPostsCount } = data;

  const handleToggleMonitoring = async () => {
    const enable = !webhookStatus.isActive;
    
    startTransition(async () => {
      const result = await toggleMonitoringAction(enable);
      if (result.success) {
        toast.success(enable ? 'Monitoring démarré' : 'Monitoring arrêté');
        window.location.reload();
      } else {
        toast.error(result.error || 'Erreur');
      }
    });
  };

  const handleSetupWebhook = async () => {
    startTransition(async () => {
      const result = await setupWebhookAccountAction();
      if (result.success) {
        toast.success('Webhook configuré avec succès');
        window.location.reload();
      } else {
        toast.error(result.error || 'Erreur configuration webhook');
      }
    });
  };

  const handleMarkAsRead = async () => {
    await markPostsAsReadAction();
    setShowPostsPanel(false);
    window.location.reload();
  };

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          Comptes suivis ({companies.length})
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          <Plus className="w-4 h-4" />
          Ajouter un compte
        </button>
      </div>

      {companies.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-600 mb-4">
            Aucun compte suivi. Ajoutez-en un pour commencer !
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            <Plus className="w-4 h-4" />
            Ajouter mon premier compte
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              onClick={() => {
                setSelectedCompanyId(company.id);
                setShowAccountDetail(true);
              }}
              onRemove={async (e) => {
                e.stopPropagation();
                const result = await removeMonitoredCompanyAction(company.id);
                if (result.success) {
                  toast.success('Compte retiré');
                  window.location.reload();
                } else {
                  toast.error(result.error || 'Erreur');
                }
              }}
              onFetchPosts={async (e) => {
                e.stopPropagation();
                toast.loading('Récupération des posts...');
                const result = await fetchPostsForAccountAction(company.id);
                toast.dismiss();
                if (result.success) {
                  toast.success(`${result.newPostsCount} nouveau(x) post(s) récupéré(s)`);
                  window.location.reload();
                } else {
                  toast.error(result.error || 'Erreur de récupération');
                }
              }}
            />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddCompanyModal
          onClose={() => setShowAddModal(false)}
          onAdd={async (data) => {
            const result = await addMonitoredCompanyAction(data);
            if (result.success) {
              toast.success('Entreprise ajoutée');
              setShowAddModal(false);
              window.location.reload();
            } else {
              toast.error(result.error || 'Erreur');
            }
          }}
        />
      )}

      {showPostsPanel && (
        <PostsPanel
          posts={recentPosts}
          onClose={() => setShowPostsPanel(false)}
          onMarkAsRead={handleMarkAsRead}
        />
      )}

      {selectedCompanyId && showAccountDetail && (
        <AccountDetailModal
          company={companies.find((c) => c.id === selectedCompanyId)!}
          onClose={() => {
            setShowAccountDetail(false);
            setSelectedCompanyId(null);
          }}
        />
      )}
    </div>
  );
}

function CompanyCard({ company, onClick, onRemove, onFetchPosts }: any) {
  const lastPost = company.lastPostAt
    ? new Date(company.lastPostAt).toLocaleDateString('fr-FR')
    : 'Aucun post';

  const newPostsCount = company.newPostsCount || 0;

  return (
    <div 
      onClick={onClick}
      className="relative bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer"
    >
      {newPostsCount > 0 && (
        <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white text-sm font-bold rounded-full flex items-center justify-center animate-pulse">
          {newPostsCount}
        </div>
      )}
      
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{company.companyName}</h3>
          <a
            href={`https://${company.linkedinCompanyUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-linkedin-blue hover:underline flex items-center gap-1 mt-1"
          >
            Voir sur LinkedIn
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-red-600 transition-colors z-10"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="w-4 h-4" />
          Dernier post: {lastPost}
        </div>
        <div className="text-sm text-gray-600">
          Posts reçus: {company.totalPostsReceived || 0}
        </div>
        {newPostsCount > 0 && (
          <div className="text-sm font-medium text-blue-600">
            {newPostsCount} nouveau{newPostsCount > 1 ? 'x' : ''} post{newPostsCount > 1 ? 's' : ''}
          </div>
        )}
        
        <button
          onClick={onFetchPosts}
          className="w-full mt-3 px-4 py-2 bg-linkedin-blue text-white rounded-lg hover:bg-blue-700 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
        >
          <Download className="w-4 h-4" />
          Récupérer les posts
        </button>
      </div>
    </div>
  );
}

function AddCompanyModal({ onClose, onAdd }: any) {
  const [companyName, setCompanyName] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onAdd({ companyName, linkedinCompanyUrl: linkedinUrl });
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Ajouter un compte LinkedIn
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom (Entreprise ou Personne)
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-linkedin-blue focus:border-transparent"
              placeholder="ex: Engie, EDF ou John Doe..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL LinkedIn du compte
            </label>
            <input
              type="text"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-linkedin-blue focus:border-transparent"
              placeholder="linkedin.com/company/engie ou linkedin.com/in/johndoe"
            />
            <p className="text-xs text-gray-500 mt-1">
              Collez l'URL de la page entreprise ou du profil personnel LinkedIn
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {isSubmitting ? 'Ajout...' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfigModal({ company, onClose, onSave }: any) {
  const config = company.collectionConfig || {
    delayHours: 24,
    maxReactions: 50,
    maxComments: 50,
    isEnabled: true,
  };

  const [delayHours, setDelayHours] = useState(config.delayHours);
  const [maxReactions, setMaxReactions] = useState(config.maxReactions);
  const [maxComments, setMaxComments] = useState(config.maxComments);
  const [isEnabled, setIsEnabled] = useState(config.isEnabled);

  const estimatedCredits = estimateLeadCollectionCredits({ maxReactions, maxComments });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Configuration: {company.companyName}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Délai de collecte (heures)
            </label>
            <input
              type="number"
              value={delayHours}
              onChange={(e) => setDelayHours(parseInt(e.target.value))}
              min="1"
              max="168"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">
              Temps d'attente après publication avant de collecter les leads (24h = 1 jour)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum de réactions à collecter
            </label>
            <input
              type="number"
              value={maxReactions}
              onChange={(e) => setMaxReactions(parseInt(e.target.value))}
              min="0"
              max="500"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum de commentaires à collecter
            </label>
            <input
              type="number"
              value={maxComments}
              onChange={(e) => setMaxComments(parseInt(e.target.value))}
              min="0"
              max="500"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm font-medium text-gray-900 mb-2">
              Estimation des crédits par post
            </div>
            <div className="text-2xl font-bold text-linkedin-blue">
              ~{estimatedCredits} crédits
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Basé sur {maxReactions} réactions + {maxComments} commentaires
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isEnabled"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="w-4 h-4 text-linkedin-blue rounded"
            />
            <label htmlFor="isEnabled" className="text-sm font-medium text-gray-700">
              Collecte automatique activée
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-6 mt-6 border-t">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
          >
            Annuler
          </button>
          <button
            onClick={() => onSave({ delayHours, maxReactions, maxComments, isEnabled })}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}

function PostsPanel({ posts, onClose, onMarkAsRead }: any) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Derniers posts ({posts.length})
          </h2>
          <div className="flex gap-3">
            <button
              onClick={onMarkAsRead}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
            >
              Marquer tout comme lu
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium text-sm"
            >
              Fermer
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {posts.map((post: any) => (
            <div
              key={post.id}
              className={`border rounded-lg p-4 ${
                post.isNew ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {post.monitoredCompany.companyName}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {new Date(post.publishedAt).toLocaleString('fr-FR')}
                  </p>
                </div>
                {post.isNew && (
                  <span className="px-2 py-1 bg-blue-500 text-white text-xs font-medium rounded">
                    NOUVEAU
                  </span>
                )}
              </div>

              {post.content && (
                <p className="text-sm text-gray-700 mb-3 line-clamp-3">
                  {post.content}
                </p>
              )}

              <a
                href={post.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-linkedin-blue hover:underline inline-flex items-center gap-1"
              >
                Voir le post sur LinkedIn
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AccountDetailModal({ company, onClose }: any) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPostForExtraction, setSelectedPostForExtraction] = useState<any | null>(null);

  useEffect(() => {
    async function loadPosts() {
      setLoading(true);
      const result = await getAccountPostsAction(company.id);
      setPosts(result.posts);
      setLoading(false);
    }
    loadPosts();
  }, [company.id]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">
                Feed: {company.companyName}
              </h2>
              <a
                href={`https://${company.linkedinCompanyUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-linkedin-blue hover:underline flex items-center gap-1 mt-1"
              >
                Voir sur LinkedIn
                <ExternalLink className="w-3 h-3" />
              </a>
              <p className="text-sm text-gray-600 mt-2">
                {posts.length} post{posts.length > 1 ? 's' : ''} enregistré{posts.length > 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
            >
              Fermer
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Chargement des posts...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Aucun post pour ce compte</p>
              <p className="text-sm text-gray-500 mt-2">Cliquez sur "Récupérer les posts" pour charger le feed</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post: any) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onExtractLeads={() => setSelectedPostForExtraction(post)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedPostForExtraction && (
        <LeadExtractionModal
          post={selectedPostForExtraction}
          onClose={() => setSelectedPostForExtraction(null)}
        />
      )}
    </div>
  );
}

function PostCard({ post, onExtractLeads }: any) {
  return (
    <div className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow bg-white">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold">
          {(post.authorName || 'U')[0].toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">
              {post.authorName || 'Auteur inconnu'}
            </span>
            {post.isNew && (
              <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded">
                NEW
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {new Date(post.publishedAt).toLocaleString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      </div>

      {post.content && (
        <p className="text-sm text-gray-800 mb-4 whitespace-pre-wrap">
          {post.content}
        </p>
      )}

      {post.mediaUrls && post.mediaUrls.length > 0 && (
        <div className="mb-4">
          <img 
            src={post.mediaUrls[0]} 
            alt="Post media" 
            className="w-full rounded-lg max-h-96 object-cover"
          />
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-4 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            👍 <span className="font-medium">{post.totalReactions || 0}</span>
          </span>
          <span className="flex items-center gap-1">
            💬 <span className="font-medium">{post.totalComments || 0}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={post.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-linkedin-blue hover:underline inline-flex items-center gap-1"
          >
            Voir sur LinkedIn
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={onExtractLeads}
            className="px-3 py-2 bg-linkedin-blue text-white rounded-lg hover:bg-blue-700 font-medium text-sm inline-flex items-center gap-2 transition-colors"
          >
            <Users className="w-4 h-4" />
            Extraire les leads
          </button>
        </div>
      </div>
    </div>
  );
}

function PostConfigModal({ post, config, onClose, onSave }: any) {
  const [delayHours, setDelayHours] = useState(24);
  const [maxReactions, setMaxReactions] = useState(config?.maxReactions || 50);
  const [maxComments, setMaxComments] = useState(config?.maxComments || 50);
  const [enabled, setEnabled] = useState(true);

  const estimatedCredits = estimateLeadCollectionCredits({ maxReactions, maxComments });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Configurer la collecte pour ce post
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Délai avant collecte
            </label>
            <select
              value={delayHours}
              onChange={(e) => setDelayHours(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value={24}>24 heures</option>
              <option value={48}>48 heures</option>
              <option value={72}>72 heures</option>
              <option value={168}>1 semaine</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum de réactions à collecter
            </label>
            <input
              type="number"
              value={maxReactions}
              onChange={(e) => setMaxReactions(Number(e.target.value))}
              min="0"
              max="500"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum de commentaires à collecter
            </label>
            <input
              type="number"
              value={maxComments}
              onChange={(e) => setMaxComments(Number(e.target.value))}
              min="0"
              max="500"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label className="text-sm font-medium text-gray-700">
              Activer la collecte pour ce post
            </label>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-900">
              <strong>Crédits estimés:</strong> {estimatedCredits} crédits LinkUp
            </p>
            <p className="text-xs text-blue-700 mt-1">
              (10 réactions ou commentaires = 1 crédit)
            </p>
          </div>
        </div>

        <div className="flex gap-3 pt-6 mt-6 border-t">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
          >
            Annuler
          </button>
          <button
            onClick={() => onSave({ delayHours, maxReactions, maxComments, enabled })}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}

function LeadExtractionModal({ post, onClose }: any) {
  const [extractionType, setExtractionType] = useState<'reactions' | 'comments'>('reactions');
  const [maxCount, setMaxCount] = useState(50);
  const [isExtracting, setIsExtracting] = useState(false);

  const estimatedCredits = Math.ceil(maxCount / 10);

  const handleExtract = async () => {
    setIsExtracting(true);
    const result = await extractLeadsFromPostAction({
      postId: post.id,
      extractionType,
      maxCount,
    });
    setIsExtracting(false);

    if (result.success) {
      toast.success(`${result.leadsCount} lead(s) extrait(s) avec succès !`);
      onClose();
    } else {
      toast.error(result.error || 'Erreur lors de l\'extraction');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Extraire les leads
        </h2>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-700 font-medium">Post de {post.authorName}</p>
          <p className="text-xs text-gray-500 mt-1">
            {new Date(post.publishedAt).toLocaleDateString('fr-FR')}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type d'engagement
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setExtractionType('reactions')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
                  extractionType === 'reactions'
                    ? 'border-linkedin-blue bg-blue-50 text-linkedin-blue'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                👍 Réactions
              </button>
              <button
                onClick={() => setExtractionType('comments')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
                  extractionType === 'comments'
                    ? 'border-linkedin-blue bg-blue-50 text-linkedin-blue'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                💬 Commentaires
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre maximum à extraire
            </label>
            <input
              type="number"
              value={maxCount}
              onChange={(e) => setMaxCount(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
              min="1"
              max="500"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-linkedin-blue focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Entre 1 et 500 {extractionType === 'reactions' ? 'réactions' : 'commentaires'}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm font-medium text-gray-900 mb-1">
              Estimation des crédits
            </div>
            <div className="text-2xl font-bold text-linkedin-blue">
              ~{estimatedCredits} crédit{estimatedCredits > 1 ? 's' : ''}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              10 {extractionType === 'reactions' ? 'réactions' : 'commentaires'} = 1 crédit LinkUp
            </p>
          </div>
        </div>

        <div className="flex gap-3 pt-6 mt-6 border-t">
          <button
            onClick={onClose}
            disabled={isExtracting}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleExtract}
            disabled={isExtracting}
            className="flex-1 px-4 py-2 bg-linkedin-blue text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {isExtracting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Extraction...
              </>
            ) : (
              <>
                <Users className="w-4 h-4" />
                Extraire
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
