'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Brain, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { scoreProspect } from './actions';
import { toast } from 'sonner';

interface ProspectScoreButtonProps {
  prospectId: string;
  currentScore?: number | null;
  status: string;
}

export function ProspectScoreButton({ 
  prospectId, 
  currentScore,
  status 
}: ProspectScoreButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    score: number;
    converted: boolean;
    reasoning: string;
  } | null>(null);

  const handleScore = () => {
    startTransition(async () => {
      try {
        const response = await scoreProspect({ prospectId });
        
        if (response.success) {
          setResult({
            score: response.score,
            converted: response.converted,
            reasoning: response.reasoning,
          });
          
          if (response.converted) {
            toast.success('Prospect converti en lead !', {
              description: `Score: ${response.score}/100 - Ajouté aux leads qualifiés`,
            });
          } else {
            toast.info('Prospect analysé', {
              description: `Score: ${response.score}/100 - Reste en prospects`,
            });
          }
        }
      } catch (error) {
        toast.error('Erreur', {
          description: error instanceof Error ? error.message : 'Échec du scoring',
        });
      }
    });
  };

  if (status === 'converted') {
    return (
      <div className="flex items-center gap-2 text-xs text-green-600">
        <CheckCircle className="w-4 h-4" />
        Converti ({currentScore}/100)
      </div>
    );
  }

  if (status === 'analyzed' && currentScore !== null && currentScore !== undefined) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <XCircle className="w-4 h-4" />
        Scoré ({currentScore}/100)
      </div>
    );
  }

  return (
    <Button
      onClick={handleScore}
      disabled={isPending}
      size="sm"
      variant="outline"
      className="flex items-center gap-2"
    >
      {isPending ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          Analyse...
        </>
      ) : (
        <>
          <Brain className="w-3 h-3" />
          Scorer
        </>
      )}
    </Button>
  );
}
