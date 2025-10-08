'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { updateLeadStatus } from '@/app/(dashboard)/dashboard/leads/actions';

type Props = {
    id: string;
    defaultStatus: 'new' | 'contacted' | 'replied' | 'qualified' | 'lost';
};

export default function LeadStatusForm({ id, defaultStatus }: Props) {
    const [status, setStatus] = useState<Props['defaultStatus']>(defaultStatus);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    // 🔊 Écoute les mises à jour “externes” (ex: bouton Marquer comme contacté)
    useEffect(() => {
        function onUpdate(e: Event) {
            const detail = (e as CustomEvent).detail as { id: string; status: Props['defaultStatus'] };
            if (detail?.id === id) {
                setStatus(detail.status); // UI optimiste immédiate
            }
        }
        window.addEventListener('lead-status-updated', onUpdate as EventListener);
        return () => window.removeEventListener('lead-status-updated', onUpdate as EventListener);
    }, [id]);

    async function onSave() {
        const fd = new FormData();
        fd.set('id', id);
        fd.set('status', status);
        await updateLeadStatus(fd);
        startTransition(() => router.refresh());
    }

    return (
        <div className="flex items-center gap-2">
            <select
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as Props['defaultStatus'])}
                className="border rounded p-1"
                disabled={isPending}
            >
                <option value="new">new</option>
                <option value="contacted">contacted</option>
                <option value="replied">replied</option>
                <option value="qualified">qualified</option>
                <option value="lost">lost</option>
            </select>
            <button
                type="button"
                onClick={onSave}
                className="text-xs border rounded px-2 py-1"
                disabled={isPending}
            >
                {isPending ? '...' : 'Save'}
            </button>
        </div>
    );
}
