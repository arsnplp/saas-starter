'use client';

import { useState } from 'react';
import { UserSearch } from 'lucide-react';
import { findContactAction } from '../actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function FindContactButton({ companyId }: { companyId: string }) {
  const [isSearching, setIsSearching] = useState(false);
  const router = useRouter();

  const handleSearch = async () => {
    setIsSearching(true);

    try {
      const formData = new FormData();
      formData.append('companyId', companyId);

      const result = await findContactAction(formData);

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
      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
    >
      <UserSearch className="w-4 h-4" />
      {isSearching ? 'Recherche web en cours...' : 'Trouver contacte (web)'}
    </button>
  );
}
