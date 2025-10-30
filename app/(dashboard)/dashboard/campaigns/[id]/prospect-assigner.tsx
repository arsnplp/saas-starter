'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus, User, Mail, Building, X } from 'lucide-react';
import { toast } from 'sonner';
import { addProspectToCampaign, getCampaignProspects, removeProspectFromCampaign } from './prospect-actions';
import { searchProspects } from './prospect-search-actions';
import { Input } from '@/components/ui/input';

type ProspectAssignerProps = {
  campaignId: number;
  onUpdate?: () => void;
};

export function ProspectAssigner({ campaignId, onUpdate }: ProspectAssignerProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [assignedProspects, setAssignedProspects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const loadAssignedProspects = async () => {
    const result = await getCampaignProspects(campaignId);
    if (result.success && result.prospects) {
      setAssignedProspects(result.prospects);
    }
  };

  useEffect(() => {
    loadAssignedProspects();
  }, [campaignId]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const result = await searchProspects(searchQuery);
      if (result.success && result.prospects) {
        const assignedIds = new Set(assignedProspects.map(p => p.id));
        const filteredResults = result.prospects.filter(p => !assignedIds.has(p.id));
        setSearchResults(filteredResults);
      }
    } catch (error) {
      toast.error('Erreur lors de la recherche');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAssign = async (prospectId: string) => {
    setLoading(true);
    try {
      const result = await addProspectToCampaign(campaignId, prospectId);
      if (result.success) {
        toast.success('Prospect assigné avec succès');
        await loadAssignedProspects();
        setSearchQuery('');
        setSearchResults([]);
        setShowSearch(false);
        onUpdate?.();
      } else {
        toast.error(result.error || 'Erreur lors de l\'assignation');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (prospectId: string) => {
    if (!confirm('Retirer ce prospect de la campagne ?')) {
      return;
    }

    setLoading(true);
    try {
      const result = await removeProspectFromCampaign(campaignId, prospectId);
      if (result.success) {
        toast.success('Prospect retiré');
        await loadAssignedProspects();
        onUpdate?.();
      } else {
        toast.error(result.error || 'Erreur');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="mb-4">
        <h2 className="text-base font-medium text-gray-900">Prospects assignés</h2>
        <p className="text-sm text-gray-500">
          {assignedProspects.length} prospect{assignedProspects.length > 1 ? 's' : ''}
        </p>
      </div>

      {showSearch ? (
        <div className="mb-4 space-y-3">
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Rechercher un prospect..."
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={searchLoading}>
              {searchLoading ? 'Recherche...' : 'Chercher'}
            </Button>
            <Button variant="outline" onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
              setSearchResults([]);
            }}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="max-h-60 overflow-y-auto space-y-2 border rounded-lg p-2">
              {searchResults.map((prospect) => (
                <div
                  key={prospect.id}
                  className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer flex items-start justify-between"
                  onClick={() => handleAssign(prospect.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {prospect.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {prospect.title && `${prospect.title} • `}
                      {prospect.company}
                    </p>
                  </div>
                  <UserPlus className="w-4 h-4 text-blue-600 flex-shrink-0 ml-2" />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <Button
          onClick={() => setShowSearch(true)}
          variant="outline"
          className="w-full mb-4"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Assigner un prospect
        </Button>
      )}

      <div className="space-y-2">
        {assignedProspects.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            Aucun prospect assigné
          </div>
        ) : (
          assignedProspects.map((prospect) => (
            <div
              key={prospect.id}
              className="p-3 border rounded-lg bg-gray-50 flex items-start justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <p className="font-medium text-sm text-gray-900 truncate">
                    {prospect.name}
                  </p>
                </div>
                {prospect.title && (
                  <div className="flex items-center gap-2 text-xs text-gray-600 ml-6">
                    <Building className="w-3 h-3" />
                    {prospect.title}
                    {prospect.company && ` • ${prospect.company}`}
                  </div>
                )}
                {prospect.email && (
                  <div className="flex items-center gap-2 text-xs text-gray-600 ml-6">
                    <Mail className="w-3 h-3" />
                    {prospect.email}
                  </div>
                )}
                {prospect.executionStats && (
                  <div className="mt-2 ml-6 text-xs">
                    <span className="text-green-600">✓ {prospect.executionStats.done}</span>
                    {' • '}
                    <span className="text-gray-500">⏳ {prospect.executionStats.pending}</span>
                    {prospect.executionStats.failed > 0 && (
                      <>
                        {' • '}
                        <span className="text-red-600">✗ {prospect.executionStats.failed}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(prospect.id)}
                disabled={loading}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
