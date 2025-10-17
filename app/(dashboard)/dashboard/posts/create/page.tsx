import { getUser, getTeamForUser } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import { CreatePostForm } from './create-post-form';
import { Card } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function CreatePostPage() {
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }

  const team = await getTeamForUser();
  if (!team) {
    redirect('/dashboard');
  }

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
          Créer un nouveau post
        </h1>
        <p className="text-sm text-gray-500">
          Créez un post LinkedIn personnalisé
        </p>
      </div>

      <Card className="p-6 max-w-2xl">
        <CreatePostForm userId={user.id} teamId={team.id} />
      </Card>
    </section>
  );
}
