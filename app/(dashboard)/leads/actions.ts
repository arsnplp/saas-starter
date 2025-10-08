// app/leads/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leads as leadsTable } from '@/lib/db/schema';
import { z } from 'zod';

/* Validations */
const LeadSchema = z.object({
    email: z.string().email(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    company: z.string().optional(),
    title: z.string().optional(),
    linkedinUrl: z.string().url().optional().or(z.literal('')),
    notes: z.string().optional(),
});

const StatusSchema = z.enum(['new', 'contacted', 'replied', 'qualified', 'lost']);

/** Créer un lead */
export async function createLead(formData: FormData) {
    const raw = {
        email: String(formData.get('email') || ''),
        firstName: (formData.get('firstName') as string) || undefined,
        lastName: (formData.get('lastName') as string) || undefined,
        company: (formData.get('company') as string) || undefined,
        title: (formData.get('title') as string) || undefined,
        linkedinUrl: (formData.get('linkedinUrl') as string) || '',
        notes: (formData.get('notes') as string) || undefined,
    };

    const parsed = LeadSchema.safeParse(raw);
    if (!parsed.success) return;

    const toInsert = { ...parsed.data, linkedinUrl: parsed.data.linkedinUrl || undefined };
    await db.insert(leadsTable).values(toInsert);
    revalidatePath('/leads');
}

/** Met à jour le statut */
export async function updateLeadStatus(formData: FormData) {
    const id = String(formData.get('id') || '');
    const status = String(formData.get('status') || '');
    if (!id || !StatusSchema.safeParse(status).success) return;

    await db.execute(sql`
        update leads
        set status = ${status}, updated_at = now()
        where id = ${id}::uuid
    `);

    revalidatePath('/leads');
}

/** Met à jour les notes */
export async function updateLeadNotes(formData: FormData) {
    const id = String(formData.get('id') || '');
    const notes = (formData.get('notes') ?? '') as string;
    if (!id) return;

    await db.execute(sql`
        update leads
        set notes = ${notes}, updated_at = now()
        where id = ${id}::uuid
    `);

    revalidatePath('/leads');
}
