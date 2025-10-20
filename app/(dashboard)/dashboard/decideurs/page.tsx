import { db } from '@/lib/db/drizzle';
import { decisionMakers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getTeamForUser } from '@/lib/db/queries';
import { Mail, Phone, Linkedin, Building2, AlertCircle, Download } from 'lucide-react';
import Link from 'next/link';
import { EnrichButton } from './enrich-button';

export default async function DecideursPage() {
  const team = await getTeamForUser();

  if (!team) {
    return <div className="p-8">Vous devez faire partie d'une équipe.</div>;
  }

  const makers = await db.query.decisionMakers.findMany({
    where: eq(decisionMakers.teamId, team.id),
    orderBy: (dm, { desc }) => [desc(dm.createdAt)],
    with: {
      company: true,
    },
  });

  const stats = {
    total: makers.length,
    withEmail: makers.filter((m) => m.emailStatus === 'found').length,
    withPhone: makers.filter((m) => m.phoneStatus === 'found').length,
    enriched: makers.filter((m) => m.emailStatus === 'found' || m.phoneStatus === 'found').length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0A66C2]">Base de Décideurs</h1>
          <p className="text-gray-600 mt-1">
            Tous les décideurs découverts à travers vos entreprises cibles
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Total décideurs</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Avec email</div>
          <div className="text-2xl font-bold text-green-600">{stats.withEmail}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Avec téléphone</div>
          <div className="text-2xl font-bold text-blue-600">{stats.withPhone}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Enrichis</div>
          <div className="text-2xl font-bold text-[#0A66C2]">{stats.enriched}</div>
        </div>
      </div>

      {makers.length === 0 ? (
        <div className="bg-white p-12 rounded-lg border border-gray-200 text-center">
          <div className="text-4xl mb-4">👥</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Aucun décideur trouvé
          </h2>
          <p className="text-gray-600 mb-6">
            Visitez une entreprise cible et utilisez "Trouver des décideurs" pour commencer à construire votre base.
          </p>
          <Link
            href="/dashboard/entreprises"
            className="inline-block bg-[#0A66C2] text-white px-6 py-3 rounded-lg hover:bg-[#004182] transition-colors font-medium"
          >
            Voir les entreprises cibles
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="divide-y divide-gray-200">
            {makers.map((maker) => {
              const needsEnrichment = maker.emailStatus === 'not_found' || maker.phoneStatus === 'not_found';
              const hasRealLinkedinUrl = maker.linkedinUrl && !maker.linkedinUrl.startsWith('temp-');

              return (
                <div key={maker.id} className="px-6 py-5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      {maker.profilePictureUrl ? (
                        <img
                          src={maker.profilePictureUrl}
                          alt={maker.fullName}
                          className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-linkedin-blue flex items-center justify-center text-white text-xl font-semibold">
                          {maker.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {maker.fullName}
                          </h3>
                          {maker.title && (
                            <p className="text-sm text-gray-600 mt-1">{maker.title}</p>
                          )}
                          {maker.company && (
                            <Link
                              href={`/dashboard/entreprises/${maker.company.id}`}
                              className="inline-flex items-center gap-1 text-sm text-[#0A66C2] hover:underline mt-2"
                            >
                              <Building2 className="w-3 h-3" />
                              {maker.company.name}
                            </Link>
                          )}
                          {maker.relevanceScore !== null && (
                            <div className="mt-2">
                              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Score: {maker.relevanceScore}/100
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {needsEnrichment && hasRealLinkedinUrl && (
                            <EnrichButton decisionMakerId={maker.id} />
                          )}
                          
                          {hasRealLinkedinUrl && (
                            <a
                              href={maker.linkedinUrl.startsWith('http') ? maker.linkedinUrl : `https://${maker.linkedinUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-linkedin-blue hover:bg-blue-700 rounded-lg transition-colors"
                            >
                              <Linkedin className="w-4 h-4" />
                              LinkedIn
                            </a>
                          )}
                          
                          {!hasRealLinkedinUrl && (
                            <div className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-400 bg-gray-100 rounded-lg">
                              <Linkedin className="w-4 h-4" />
                              Profil non trouvé
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          {maker.email ? (
                            <a
                              href={`mailto:${maker.email}`}
                              className="text-linkedin-blue hover:underline truncate"
                            >
                              {maker.email}
                            </a>
                          ) : (
                            <span className="text-gray-400 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Non trouvé
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          {maker.phone ? (
                            <a
                              href={`tel:${maker.phone}`}
                              className="text-linkedin-blue hover:underline"
                            >
                              {maker.phone}
                            </a>
                          ) : (
                            <span className="text-gray-400 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Non trouvé
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
