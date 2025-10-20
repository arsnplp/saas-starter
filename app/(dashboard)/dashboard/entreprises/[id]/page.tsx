import { notFound } from 'next/navigation';
import { db } from '@/lib/db/drizzle';
import { targetCompanies, decisionMakers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getTeamForUser } from '@/lib/db/queries';
import { Building2, MapPin, Globe, Phone, Mail, Linkedin, Users, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { DecisionMakersList } from './decision-makers-list';
import { FindDecisionMakersButton } from './find-decision-makers-button';
import { FindContactButton } from './find-contact-button';

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const team = await getTeamForUser();

  if (!team) {
    notFound();
  }

  const company = await db.query.targetCompanies.findFirst({
    where: and(
      eq(targetCompanies.id, id),
      eq(targetCompanies.teamId, team.id)
    ),
  });

  if (!company) {
    notFound();
  }

  const makers = await db.query.decisionMakers.findMany({
    where: and(
      eq(decisionMakers.companyId, id),
      eq(decisionMakers.teamId, team.id)
    ),
    orderBy: (dm, { desc }) => [desc(dm.relevanceScore)],
  });

  const companyData = company.companyData as any;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/dashboard/entreprises"
          className="inline-flex items-center text-sm text-gray-600 hover:text-linkedin-blue mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux entreprises cibles
        </Link>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-linkedin-blue to-blue-700 px-6 py-8 text-white">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">{company.name}</h1>
                {company.industry && (
                  <p className="text-blue-100 text-lg">{company.industry}</p>
                )}
              </div>
              {company.linkedinUrl && (
                <a
                  href={company.linkedinUrl.startsWith('http') ? company.linkedinUrl : `https://${company.linkedinUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors"
                >
                  <Linkedin className="w-5 h-5" />
                  <span>Voir sur LinkedIn</span>
                </a>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-linkedin-blue" />
                Informations générales
              </h2>
              
              <div className="space-y-3">
                {company.reason && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      Pertinence
                    </p>
                    <p className="text-sm text-gray-900">{company.reason}</p>
                  </div>
                )}

                {companyData?.employeeCount && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span>{companyData.employeeCount.toLocaleString()} employés</span>
                  </div>
                )}

                {companyData?.description && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      Description
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {companyData.description}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Phone className="w-5 h-5 text-linkedin-blue" />
                Contact
              </h2>

              <div className="space-y-3">
                {companyData?.websiteUrl && (
                  <a
                    href={companyData.websiteUrl.startsWith('http') ? companyData.websiteUrl : `https://${companyData.websiteUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-linkedin-blue hover:underline"
                  >
                    <Globe className="w-4 h-4" />
                    <span>{companyData.websiteUrl}</span>
                  </a>
                )}

                {companyData?.phone && (
                  <a
                    href={`tel:${companyData.phone}`}
                    className="flex items-center gap-2 text-sm text-gray-700 hover:text-linkedin-blue"
                  >
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{companyData.phone}</span>
                  </a>
                )}

                {companyData?.headquarter && (
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      {companyData.headquarter.line1 && (
                        <p>{companyData.headquarter.line1}</p>
                      )}
                      {companyData.headquarter.line2 && (
                        <p>{companyData.headquarter.line2}</p>
                      )}
                      <p>
                        {companyData.headquarter.postalCode && `${companyData.headquarter.postalCode} `}
                        {companyData.headquarter.city}
                        {companyData.headquarter.country && `, ${companyData.headquarter.country}`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Décideurs identifiés
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {makers.length} personne{makers.length > 1 ? 's' : ''} trouvée{makers.length > 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <FindContactButton companyId={id} />
              <FindDecisionMakersButton companyId={id} />
            </div>
          </div>

          <DecisionMakersList decisionMakers={makers} />
        </div>
      </div>
    </div>
  );
}
