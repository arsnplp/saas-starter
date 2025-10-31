'use client';

import { X } from 'lucide-react';
import { deleteWorkflowNode } from '../workflow-actions';
import { toast } from 'sonner';

type DeleteNodeButtonProps = {
  nodeId: number;
  onDelete?: () => void;
};

export function DeleteNodeButton({ nodeId, onDelete }: DeleteNodeButtonProps) {
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const result = await deleteWorkflowNode(nodeId);
    if (result.success) {
      toast.success('Bloc supprimé');
      if (onDelete) onDelete();
    } else {
      toast.error(result.error || 'Erreur lors de la suppression');
    }
  };

  return (
    <button
      onClick={handleDelete}
      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
      title="Supprimer"
    >
      <X className="w-3 h-3" />
    </button>
  );
}
