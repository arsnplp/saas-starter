'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { updateLeadStatus } from '@/app/(dashboard)/dashboard/leads/actions';

export default function MarkContactedButton({ id }: { id: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    async function onClick() {
        // ✅ UI optimiste immédiate : informe le sélecteur de ligne
        window.dispatchEvent(
            new CustomEvent('lead-status-updated', {
                detail: { id, status: 'contacted' as const },
            })
        );

        // ✅ Mise à jour serveur + re-render fiable
        const fd = new FormData();
        fd.set('id', id);
        fd.set('status', 'contacted');
        await updateLeadStatus(fd);
        startTransition(() => router.refresh());
    }

    return (
        <button
            type="button"
            onClick={onClick}
            className="text-xs border rounded px-2 py-1"
            disabled={isPending}
        >
            {isPending ? '...' : 'Marquer comme contacté'}
        </button>
    );
}
