import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db';
import { campaigns } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { CampaignBuilder } from '../campaign-builder';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

export default async function EditCampaignPage({ params }: PageProps) {
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }

  const team = await getTeamForUser();
  if (!team) {
    redirect('/dashboard');
  }

  const { id } = await params;
  const campaignId = parseInt(id);

  if (isNaN(campaignId)) {
    notFound();
  }

  const campaignData = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.teamId, team.id)))
    .limit(1);

  if (campaignData.length === 0) {
    notFound();
  }

  const campaign = campaignData[0];

  return (
    <CampaignBuilder
      campaign={{
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        blocks: campaign.blocks,
        isActive: campaign.isActive,
      }}
    />
  );
}
