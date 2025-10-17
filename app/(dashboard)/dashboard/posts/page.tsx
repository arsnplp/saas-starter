import { Suspense } from 'react';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db/drizzle';
import { linkedinPosts, linkedinPostSettings } from '@/lib/db/schema';
import { eq, desc, or, and, isNull, isNotNull } from 'drizzle-orm';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, CheckCircle, Clock, Edit, Plus, Settings } from 'lucide-react';
import Link from 'next/link';

async function getPosts(teamId: number) {
  return await db.query.linkedinPosts.findMany({
    where: eq(linkedinPosts.teamId, teamId),
    orderBy: [desc(linkedinPosts.scheduledFor), desc(linkedinPosts.createdAt)],
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

function getPostTypeLabel(type: string) {
  const types = {
    'call_to_action': '📣 Call-to-action',
    'publicite': '📢 Publicité',
    'annonce': '🎉 Annonce',
    'classique': '💬 Classique',
  };
  return types[type as keyof typeof types] || type;
}

function getStatusBadge(status: string) {
  const variants = {
    draft: { label: 'Brouillon', className: 'bg-gray-100 text-gray-700' },
    pending: { label: 'En attente GPT', className: 'bg-yellow-100 text-yellow-700' },
    generated: { label: 'Généré', className: 'bg-blue-100 text-blue-700' },
    scheduled: { label: 'Programmé', className: 'bg-purple-100 text-purple-700' },
    published: { label: 'Publié', className: 'bg-green-100 text-green-700' },
    failed: { label: 'Échec', className: 'bg-red-100 text-red-700' },
  };
  
  const variant = variants[status as keyof typeof variants] || { label: status, className: 'bg-gray-100 text-gray-700' };
  
  return <Badge className={`${variant.className} border-0`}>{variant.label}</Badge>;
}

export default async function PostsPage() {
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }

  const team = await getTeamForUser();
  if (!team) {
    redirect('/dashboard');
  }

  const posts = await getPosts(team.id);
  const settings = await getSettings(team.id);

  const scheduledPosts = posts.filter((p) => 
    ['draft', 'pending', 'generated', 'scheduled'].includes(p.status)
  );
  const publishedPosts = posts.filter((p) => p.status === 'published');

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-2">
            Posts LinkedIn
          </h1>
          <p className="text-sm text-gray-500">
            Gérez vos publications LinkedIn automatisées
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/posts/settings">
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Configuration
            </Button>
          </Link>
          <Link href="/dashboard/posts/create">
            <Button size="sm" className="bg-[#0A66C2] hover:bg-[#004182]">
              <Plus className="w-4 h-4 mr-2" />
              Nouveau post
            </Button>
          </Link>
        </div>
      </div>

      {settings && (
        <Card className="p-4 mb-6 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {settings.postsPerWeek} posts par semaine
                </p>
                <p className="text-xs text-gray-500">
                  Mode {settings.autoValidationMode ? 'automatique' : 'avec validation'}
                </p>
              </div>
            </div>
            <Link href="/dashboard/posts/settings">
              <Button variant="ghost" size="sm">
                Modifier
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {!settings && (
        <Card className="p-6 mb-6 text-center">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Configurez votre calendrier de publication
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Définissez le nombre de posts par semaine et le mode de validation
          </p>
          <Link href="/dashboard/posts/settings">
            <Button className="bg-[#0A66C2] hover:bg-[#004182]">
              <Settings className="w-4 h-4 mr-2" />
              Configurer maintenant
            </Button>
          </Link>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-medium text-gray-900">
              Posts programmés ({scheduledPosts.length})
            </h2>
          </div>
          
          {scheduledPosts.length === 0 ? (
            <Card className="p-8 text-center">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                Aucun post programmé
              </p>
              <Link href="/dashboard/posts/create">
                <Button variant="outline" size="sm" className="mt-3">
                  Créer un post
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="space-y-3">
              {scheduledPosts.map((post) => (
                <Card key={post.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {getPostTypeLabel(post.type)}
                        </span>
                        {getStatusBadge(post.status)}
                      </div>
                      {post.scheduledFor && (
                        <p className="text-xs text-gray-500">
                          📅 {new Date(post.scheduledFor).toLocaleDateString('fr-FR', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      )}
                    </div>
                    <Link href={`/dashboard/posts/${post.id}`}>
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                  {(post.generatedContent || post.finalContent) && (
                    <p className="text-sm text-gray-600 line-clamp-2 mt-2">
                      {post.finalContent || post.generatedContent}
                    </p>
                  )}
                  {post.userContext && !post.generatedContent && (
                    <p className="text-xs text-gray-400 italic mt-2">
                      Contexte: {post.userContext.substring(0, 100)}...
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-medium text-gray-900">
              Posts publiés ({publishedPosts.length})
            </h2>
          </div>
          
          {publishedPosts.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                Aucun post publié
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {publishedPosts.map((post) => (
                <Card key={post.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {getPostTypeLabel(post.type)}
                        </span>
                        <Badge className="bg-green-100 text-green-700 border-0">✓ Publié</Badge>
                      </div>
                      {post.publishedAt && (
                        <p className="text-xs text-gray-500">
                          📅 {new Date(post.publishedAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      )}
                    </div>
                    {post.linkedinPostId && (
                      <a
                        href={`https://www.linkedin.com/feed/update/${post.linkedinPostId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="ghost" size="sm">
                          Voir sur LinkedIn
                        </Button>
                      </a>
                    )}
                  </div>
                  {post.finalContent && (
                    <p className="text-sm text-gray-600 line-clamp-3 mt-2">
                      {post.finalContent}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
