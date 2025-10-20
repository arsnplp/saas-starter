'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { enrichDecisionMakerAction } from '../entreprises/actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function EnrichButton({ decisionMakerId }: { decisionMakerId: string }) {
  const [isEnriching, setIsEnriching] = useState(false);
  const router = useRouter();

  const handleEnrich = async () => {
    setIsEnriching(true);

    try {
      const result = await enrichDecisionMakerAction(decisionMakerId);

      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'enrichissement');
    } finally {
      setIsEnriching(false);
    }
  };

  return (
    <button
      onClick={handleEnrich}
      disabled={isEnriching}
      className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-linkedin-blue bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Download className="w-4 h-4" />
      {isEnriching ? 'Enrichissement...' : 'Enrichir'}
    </button>
  );
}
