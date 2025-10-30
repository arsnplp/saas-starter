'use client';

import { Mail, Trash2, Edit, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { deleteBlock } from './block-actions';
import { useState } from 'react';

type Block = {
  id: number;
  type: string;
  config: { subject: string; body: string };
  order: number;
  createdAt: Date;
};

type BlocksListProps = {
  blocks: Block[];
  onUpdate?: () => void;
};

export function BlocksList({ blocks, onUpdate }: BlocksListProps) {
  const [loading, setLoading] = useState<number | null>(null);

  const handleDelete = async (blockId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce bloc ?')) {
      return;
    }

    setLoading(blockId);
    try {
      const result = await deleteBlock(blockId);
      if (result.success) {
        toast.success('Bloc supprimé avec succès');
        onUpdate?.();
      } else {
        toast.error(result.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(null);
    }
  };

  if (blocks.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-lg bg-gray-50">
        <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-sm text-gray-600 mb-2">Aucun bloc ajouté</p>
        <p className="text-xs text-gray-500">Ajoutez un bloc email pour commencer</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => (
        <div
          key={block.id}
          className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
        >
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 text-blue-600 rounded-full text-sm font-bold flex-shrink-0">
              {index + 1}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Bloc Email
                </span>
              </div>

              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Sujet:</p>
                  <p className="text-sm font-medium text-gray-900 break-words">
                    {block.config.subject}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-1">Corps:</p>
                  <p className="text-sm text-gray-700 line-clamp-3 break-words whitespace-pre-wrap">
                    {block.config.body}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(block.createdAt).toLocaleDateString('fr-FR')}
                </div>
              </div>
            </div>

            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(block.id)}
                disabled={loading === block.id}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
