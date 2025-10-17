import { getUser, getTeamForUser } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db/drizzle';
import { linkedinPostSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { PostSettingsForm } from './settings-form';
import { Card } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

async function getSettings(teamId: number) {
  return await db.query.linkedinPostSettings.findFirst({
    where: eq(linkedinPostSettings.teamId, teamId),
  });
}

export default async function PostSettingsPage() {
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }

  const team = await getTeamForUser();
  if (!team) {
    redirect('/dashboard');
  }

  const settings = await getSettings(team.id);

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mb-6">
        <Link href="/dashboard/posts">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour aux posts
          </Button>
        </Link>
        <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-2">
          Configuration des posts LinkedIn
        </h1>
        <p className="text-sm text-gray-500">
          Définissez la récurrence et le mode de validation de vos publications
        </p>
      </div>

      <Card className="p-6 max-w-2xl">
        <PostSettingsForm 
          initialPostsPerWeek={settings?.postsPerWeek || 2}
          initialAutoValidationMode={settings?.autoValidationMode || false}
        />
      </Card>
    </section>
  );
}
