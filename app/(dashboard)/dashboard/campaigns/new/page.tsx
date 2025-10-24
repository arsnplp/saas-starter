import React from 'react';
import { redirect } from 'next/navigation';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { CampaignBuilder } from '../campaign-builder';

export const dynamic = 'force-dynamic';

export default async function NewCampaignPage() {
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }

  const team = await getTeamForUser();
  if (!team) {
    redirect('/dashboard');
  }

  return <CampaignBuilder />;
}
