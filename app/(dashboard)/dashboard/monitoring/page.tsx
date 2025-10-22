'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Trash2, Power, PowerOff, Radio, Clock, CheckCircle2, XCircle, Zap } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  addMonitoredProfile,
  getMonitoredProfiles,
  deleteMonitoredProfile,
  toggleProfileActive,
  getDetectedPosts,
  manualDetectPosts,
  toggleAutoMode,
} from './actions';

interface MonitoredProfile {
  id: string;
  linkedinCompanyUrl: string;
  companyName: string;
  profileType: string;
  logoUrl: string | null;
  isActive: boolean;
  addedAt: Date;
  lastPostAt: Date | null;
  lastCheckedAt: Date | null;
  totalPostsReceived: number;
  delayHours: number | null;
  isEnabled: boolean | null;
}

interface DetectedPost {
  id: string;
  postUrl: string;
  authorName: string;
  content: string;
  publishedAt: Date;
  receivedAt: Date;
  isNew: boolean;
  profileName: string;
  profileType: string;
  scheduledFor: Date | null;
  collectionStatus: string | null;
  leadsCreated: number | null;
  reactionsCollected: number | null;
  commentsCollected: number | null;
}

export default function MonitoringPage() {
  const [profiles, setProfiles] = useState<MonitoredProfile[]>([]);
  const [detectedPosts, setDetectedPosts] = useState<DetectedPost[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [formData, setFormData] = useState({
    linkedinUrl: '',
    profileName: '',
    profileType: 'company' as 'company' | 'personal',
    delayHours: 24,
  });

  const [manualPosts, setManualPosts] = useState(1);
  const [isManualDetecting, setIsManualDetecting] = useState(false);
  const [autoModeEnabled, setAutoModeEnabled] = useState(true);

  const loadProfiles = async () => {
    const result = await getMonitoredProfiles({});
    if (result.success && result.profiles) {
      setProfiles(result.profiles as MonitoredProfile[]);
      if (result.profiles.length > 0) {
        setAutoModeEnabled(result.profiles[0].isEnabled ?? true);
      }
    }
  };

  const loadPosts = async (profileId?: string) => {
    const result = await getDetectedPosts({ profileId });
    if (result.success && result.posts) {
      setDetectedPosts(result.posts as DetectedPost[]);
    }
  };

  useEffect(() => {
    loadProfiles();
    loadPosts();
  }, []);

  const handleAddProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = await addMonitoredProfile(formData);
    
    if (result.success) {
      toast.success('Profil ajouté avec succès');
      setShowAddForm(false);
      setFormData({
        linkedinUrl: '',
        profileName: '',
        profileType: 'company',
        delayHours: 24,
      });
      loadProfiles();
    } else {
      toast.error(result.error || 'Erreur lors de l\'ajout du profil');
    }

    setLoading(false);
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce profil ? Tous les posts détectés seront également supprimés.')) {
      return;
    }

    const result = await deleteMonitoredProfile({ profileId });
    
    if (result.success) {
      toast.success('Profil supprimé');
      loadProfiles();
      if (selectedProfile === profileId) {
        setSelectedProfile(null);
        loadPosts();
      }
    } else {
      toast.error(result.error || 'Erreur lors de la suppression');
    }
  };

  const handleToggleActive = async (profileId: string, isActive: boolean) => {
    const result = await toggleProfileActive({ profileId, isActive });
    
    if (result.success) {
      toast.success(isActive ? 'Profil activé' : 'Profil désactivé');
      loadProfiles();
    } else {
      toast.error(result.error || 'Erreur');
    }
  };

  const handleManualDetect = async () => {
    setIsManualDetecting(true);
    
    const result = await manualDetectPosts({ maxPosts: manualPosts, includeReposts: true });
    
    if (result.success) {
      toast.success(`${result.postsDetected} nouveaux posts détectés sur ${result.profilesChecked} profils`);
      loadProfiles();
      loadPosts();
    } else {
      toast.error(result.error || 'Erreur lors de la détection');
    }

    if (result.errors && result.errors.length > 0) {
      result.errors.forEach(error => toast.error(error));
    }
    
    setIsManualDetecting(false);
  };

  const handleToggleAutoMode = async (enabled: boolean) => {
    const result = await toggleAutoMode({ enabled });
    
    if (result.success) {
      setAutoModeEnabled(enabled);
      toast.success(enabled ? 'Mode automatique activé' : 'Mode automatique désactivé');
      loadProfiles();
    } else {
      toast.error(result.error || 'Erreur lors du changement de mode');
    }
  };

  const getTimeRemaining = (scheduledFor: Date) => {
    const now = new Date();
    const diff = new Date(scheduledFor).getTime() - now.getTime();
    
    if (diff <= 0) return 'Prêt pour extraction';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `Dans ${hours}h ${minutes}min`;
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />En attente</span>;
      case 'processing':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><Radio className="w-3 h-3 mr-1 animate-pulse" />En cours</span>;
      case 'completed':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" />Terminé</span>;
      case 'failed':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Échec</span>;
      default:
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Non planifié</span>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Monitoring LinkedIn</h1>
          <p className="text-gray-600">Surveillez automatiquement les posts et extrayez les leads</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un profil
        </Button>
      </div>

      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-blue-900 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Détection des posts
              </CardTitle>
              <CardDescription className="text-blue-700">
                Contrôlez la détection automatique ou manuelle des nouveaux posts
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-2 shadow-sm border border-blue-200">
              <span className={`text-sm font-medium ${!autoModeEnabled ? 'text-gray-900' : 'text-gray-500'}`}>
                Manuel
              </span>
              <Switch
                checked={autoModeEnabled}
                onCheckedChange={handleToggleAutoMode}
              />
              <span className={`text-sm font-medium ${autoModeEnabled ? 'text-blue-900' : 'text-gray-500'}`}>
                Auto
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!autoModeEnabled && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex gap-4 items-end">
                  <div className="flex-1 max-w-xs">
                    <Label htmlFor="manualPosts">Nombre de posts par profil</Label>
                    <Input
                      id="manualPosts"
                      type="number"
                      min={1}
                      max={10}
                      value={manualPosts}
                      onChange={(e) => setManualPosts(parseInt(e.target.value) || 1)}
                      className="mt-1"
                    />
                  </div>
                  <Button 
                    onClick={handleManualDetect}
                    disabled={isManualDetecting}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isManualDetecting ? 'Détection...' : 'Détecter maintenant'}
                  </Button>
                </div>
                <div className="bg-blue-50 rounded-lg px-4 py-3 border border-blue-200">
                  <p className="text-xs text-blue-800">
                    💡 <strong>Astuce :</strong> Le système récupère tous les posts (originaux + republications). 
                    Si vous cherchez un post original spécifique et que les derniers posts sont des republications, 
                    augmentez le nombre de posts (ex: 5-10) pour remonter plus loin dans l'historique.
                  </p>
                </div>
              </div>
            </div>
          )}
          {autoModeEnabled && (
            <div className="bg-white/60 rounded-lg p-4 border border-blue-100">
              <p className="text-sm text-blue-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Mode automatique activé : vérification toutes les 2 heures (1 post par profil)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Ajouter un profil à surveiller</CardTitle>
            <CardDescription>
              Ajoutez une entreprise ou un profil personnel LinkedIn à surveiller
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="linkedinUrl">URL LinkedIn</Label>
                  <Input
                    id="linkedinUrl"
                    type="url"
                    placeholder="https://www.linkedin.com/in/..."
                    value={formData.linkedinUrl}
                    onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="profileName">Nom du profil</Label>
                  <Input
                    id="profileName"
                    placeholder="Nom de l'entreprise ou de la personne"
                    value={formData.profileName}
                    onChange={(e) => setFormData({ ...formData, profileName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Type de profil</Label>
                  <RadioGroup
                    value={formData.profileType}
                    onValueChange={(value: 'company' | 'personal') =>
                      setFormData({ ...formData, profileType: value })
                    }
                    className="flex gap-4 mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="company" id="company" />
                      <Label htmlFor="company" className="font-normal cursor-pointer">
                        Entreprise
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="personal" id="personal" />
                      <Label htmlFor="personal" className="font-normal cursor-pointer">
                        Profil personnel
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                <div>
                  <Label htmlFor="delayHours">Délai avant extraction (heures)</Label>
                  <Input
                    id="delayHours"
                    type="number"
                    min="1"
                    max="168"
                    value={formData.delayHours}
                    onChange={(e) =>
                      setFormData({ ...formData, delayHours: parseInt(e.target.value) })
                    }
                    required
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Ajout...' : 'Ajouter'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                  Annuler
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Profils surveillés ({profiles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Aucun profil surveillé. Ajoutez-en un pour commencer.
            </p>
          ) : (
            <div className="space-y-3">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">{profile.companyName}</h3>
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100">
                        {profile.profileType === 'company' ? 'Entreprise' : 'Profil'}
                      </span>
                      {!profile.isActive && (
                        <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800">
                          Inactif
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {profile.totalPostsReceived} posts détectés
                      {profile.lastPostAt && ` • Dernier post: ${new Date(profile.lastPostAt).toLocaleDateString()}`}
                      {profile.lastCheckedAt && ` • Dernière vérification: ${new Date(profile.lastCheckedAt).toLocaleString()}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Délai d'extraction: {profile.delayHours || 24}h
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(profile.id, !profile.isActive)}
                    >
                      {profile.isActive ? (
                        <Power className="w-4 h-4 text-green-600" />
                      ) : (
                        <PowerOff className="w-4 h-4 text-gray-400" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedProfile(profile.id);
                        loadPosts(profile.id);
                      }}
                    >
                      Voir les posts
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteProfile(profile.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Posts détectés ({detectedPosts.length})</CardTitle>
            {selectedProfile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedProfile(null);
                  loadPosts();
                }}
              >
                Voir tous les posts
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {detectedPosts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Aucun post détecté pour le moment.
            </p>
          ) : (
            <div className="space-y-4">
              {detectedPosts.map((post) => (
                <div key={post.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold">{post.authorName}</h4>
                      <p className="text-xs text-gray-500">
                        {post.profileName} • {new Date(post.publishedAt).toLocaleString()}
                      </p>
                    </div>
                    {getStatusBadge(post.collectionStatus)}
                  </div>
                  <p className="text-sm text-gray-700 mb-3 line-clamp-2">{post.content}</p>
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-600">
                      {post.collectionStatus === 'pending' && post.scheduledFor && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {getTimeRemaining(post.scheduledFor)}
                        </span>
                      )}
                      {post.collectionStatus === 'completed' && (
                        <span>
                          {post.leadsCreated || 0} leads créés • {post.reactionsCollected || 0} réactions + {post.commentsCollected || 0} commentaires
                        </span>
                      )}
                    </div>
                    <a
                      href={post.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Voir le post
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
