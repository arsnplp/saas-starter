'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { findDecisionMakersAction } from '../actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function FindDecisionMakersButton({ companyId }: { companyId: string }) {
  const [isSearching, setIsSearching] = useState(false);
  const router = useRouter();

  const handleSearch = async () => {
    setIsSearching(true);

    try {
      const result = await findDecisionMakersAction(companyId);

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
      className="inline-flex items-center gap-2 px-4 py-2 bg-linkedin-blue text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
    >
      <Search className="w-4 h-4" />
      {isSearching ? 'Recherche en cours...' : 'Trouver des décideurs'}
    </button>
  );
}
