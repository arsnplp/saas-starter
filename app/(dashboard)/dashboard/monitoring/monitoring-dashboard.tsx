'use client';

import { useState, useTransition, useEffect } from 'react';
import { Plus, Play, Pause, Bell, Clock, Settings2, ExternalLink, Trash2, Download } from 'lucide-react';
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
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Status du Monitoring
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {webhookStatus.hasAccount
                ? webhookStatus.isActive
                  ? 'Monitoring actif - vous recevez les posts en temps réel'
                  : 'Monitoring en pause - aucun post reçu'
                : 'Webhook non configuré'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {webhookStatus.hasAccount ? (
              <button
                onClick={handleToggleMonitoring}
                disabled={isPending}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  webhookStatus.isActive
                    ? 'bg-red-50 text-red-700 hover:bg-red-100'
                    : 'bg-green-50 text-green-700 hover:bg-green-100'
                }`}
              >
                {webhookStatus.isActive ? (
                  <>
                    <Pause className="w-4 h-4" />
                    Arrêter
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Démarrer
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleSetupWebhook}
                disabled={isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                <Settings2 className="w-4 h-4" />
                Configurer le Webhook
              </button>
            )}

            {newPostsCount > 0 && (
              <button
                onClick={() => setShowPostsPanel(true)}
                className="relative inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                <Bell className="w-4 h-4" />
                Nouveaux posts
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {newPostsCount}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

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
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

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
                {company.companyName}
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
              <p className="text-gray-600">Aucun post reçu pour ce compte</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post: any) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onConfigure={() => setSelectedPostId(post.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedPostId && (
        <PostConfigModal
          post={posts.find((p: any) => p.id === selectedPostId)!}
          config={company.collectionConfig}
          onClose={() => setSelectedPostId(null)}
          onSave={async (config) => {
            const result = await configurePostCollectionAction(selectedPostId, config);
            if (result.success) {
              toast.success('Collecte configurée pour ce post');
              setSelectedPostId(null);
            } else {
              toast.error(result.error || 'Erreur');
            }
          }}
        />
      )}
    </div>
  );
}

function PostCard({ post, onConfigure }: any) {
  const hasScheduledCollection = post.scheduledCollection;
  const collectionStatus = hasScheduledCollection?.status;

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-900">
              {post.authorName || 'Auteur inconnu'}
            </span>
            {post.isNew && (
              <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-medium rounded">
                NOUVEAU
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600">
            {new Date(post.publishedAt).toLocaleString('fr-FR')}
          </p>
        </div>
        {collectionStatus && (
          <div className={`px-2 py-1 rounded text-xs font-medium ${
            collectionStatus === 'completed' ? 'bg-green-100 text-green-800' :
            collectionStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {collectionStatus === 'completed' ? 'Collecté' :
             collectionStatus === 'pending' ? 'Programmé' : 'Annulé'}
          </div>
        )}
      </div>

      {post.content && (
        <p className="text-sm text-gray-700 mb-3 line-clamp-4">
          {post.content}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-gray-600">
          <span>👍 {post.totalReactions || 0} réactions</span>
          <span>💬 {post.totalComments || 0} commentaires</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={post.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-linkedin-blue hover:underline inline-flex items-center gap-1"
          >
            Voir
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={onConfigure}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm inline-flex items-center gap-1"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Configurer
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
