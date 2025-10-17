import { getUser, getTeamForUser } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db/drizzle';
import { linkedinPosts, linkedinPostSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { PostEditor } from './post-editor';
import { Card } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

async function getPost(postId: number, teamId: number) {
  return await db.query.linkedinPosts.findFirst({
    where: eq(linkedinPosts.id, postId),
    with: {
      creator: true,
      validator: true,
    },
  });
}

async function getSettings(teamId: number) {
  return await db.query.linkedinPostSettings.findFirst({
    where: eq(linkedinPostSettings.teamId, teamId),
  });
}

export default async function PostEditPage({ params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }

  const team = await getTeamForUser();
  if (!team) {
    redirect('/dashboard');
  }

  const postId = parseInt(params.id);
  const post = await getPost(postId, team.id);
  
  if (!post || post.teamId !== team.id) {
    redirect('/dashboard/posts');
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
          Éditer le post LinkedIn
        </h1>
        <p className="text-sm text-gray-500">
          Configurez et générez votre post avec l'IA
        </p>
      </div>

      <PostEditor 
        post={post} 
        autoValidationMode={settings?.autoValidationMode || false}
      />
    </section>
  );
}
