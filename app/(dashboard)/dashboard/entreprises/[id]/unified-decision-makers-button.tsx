'use client';

import { useState } from 'react';
import { UserSearch } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { findDecisionMakersUnifiedAction } from '../actions';

export function UnifiedDecisionMakersButton({ companyId }: { companyId: string }) {
  const [isSearching, setIsSearching] = useState(false);
  const router = useRouter();

  const handleSearch = async () => {
    setIsSearching(true);

    try {
      const result = await findDecisionMakersUnifiedAction(companyId);

      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la recherche');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <button
      onClick={handleSearch}
      disabled={isSearching}
      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-linkedin-blue to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
    >
      <UserSearch className="w-4 h-4" />
      {isSearching ? 'Recherche intelligente en cours...' : 'Trouver des décideurs'}
    </button>
  );
}
