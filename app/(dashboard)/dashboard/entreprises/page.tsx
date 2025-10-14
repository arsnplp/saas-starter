import React from "react";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import Link from "next/link";

import { db } from "@/lib/db";
import { targetCompanies, icpProfiles } from "@/lib/db/schema";
import { getUser, getTeamForUser } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

type TargetCompany = typeof targetCompanies.$inferSelect;

const StatusSchema = z.enum(["not_contacted", "contacted", "in_progress", "closed"]);
type Status = z.infer<typeof StatusSchema>;

export default async function EntreprisesPage({
  searchParams,
}: {
  searchParams: Promise<{ f_status?: string; f_icp?: string }>;
}) {
  const user = await getUser();
  if (!user) {
    return <div className="p-8">Vous devez être connecté pour voir cette page.</div>;
  }

  const team = await getTeamForUser();
  if (!team) {
    return <div className="p-8">Vous devez faire partie d'une équipe.</div>;
  }

  const params = await searchParams;

  const rawStatus = (params.f_status ?? "").trim();
  const statusFilter: Status | undefined =
    rawStatus && StatusSchema.safeParse(rawStatus).success ? (rawStatus as Status) : undefined;

  const icpIdFilter = params.f_icp ? parseInt(params.f_icp) : undefined;

  const conditions = [eq(targetCompanies.teamId, team.id)];
  if (statusFilter) {
    conditions.push(eq(targetCompanies.status, statusFilter));
  }
  if (icpIdFilter) {
    conditions.push(eq(targetCompanies.icpId, icpIdFilter));
  }

  const companies = await db.query.targetCompanies.findMany({
    where: and(...conditions),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  const icps = await db.query.icpProfiles.findMany({
    where: eq(icpProfiles.teamId, team.id),
  });

  const stats = {
    total: companies.length,
    notContacted: companies.filter((c) => c.status === "not_contacted").length,
    contacted: companies.filter((c) => c.status === "contacted").length,
    inProgress: companies.filter((c) => c.status === "in_progress").length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0A66C2]">Entreprises Cibles</h1>
          <p className="text-gray-600 mt-1">
            Générez des entreprises pertinentes à contacter basées sur votre ICP
          </p>
        </div>
        <Link
          href="/dashboard/entreprises/generate"
          className="bg-[#0A66C2] text-white px-6 py-3 rounded-lg hover:bg-[#004182] transition-colors font-medium"
        >
          ✨ Trouver des entreprises
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Total</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Non contactées</div>
          <div className="text-2xl font-bold text-orange-600">{stats.notContacted}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Contactées</div>
          <div className="text-2xl font-bold text-green-600">{stats.contacted}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">En cours</div>
          <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <form method="GET" className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filtrer par statut
            </label>
            <select
              name="f_status"
              defaultValue={statusFilter || ""}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A66C2] focus:border-transparent"
            >
              <option value="">Tous les statuts</option>
              <option value="not_contacted">Non contactée</option>
              <option value="contacted">Contactée</option>
              <option value="in_progress">En cours</option>
              <option value="closed">Fermée</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filtrer par ICP
            </label>
            <select
              name="f_icp"
              defaultValue={icpIdFilter || ""}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A66C2] focus:border-transparent"
            >
              <option value="">Tous les ICPs</option>
              {icps.map((icp) => (
                <option key={icp.id} value={icp.id}>
                  {icp.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="px-6 py-2 bg-[#0A66C2] text-white rounded-lg hover:bg-[#004182] transition-colors"
          >
            Filtrer
          </button>
          <Link
            href="/dashboard/entreprises"
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Réinitialiser
          </Link>
        </form>
      </div>

      {companies.length === 0 ? (
        <div className="bg-white p-12 rounded-lg border border-gray-200 text-center">
          <div className="text-4xl mb-4">🏢</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Aucune entreprise trouvée
          </h2>
          <p className="text-gray-600 mb-6">
            Générez votre première liste d'entreprises cibles basée sur votre ICP
          </p>
          <Link
            href="/dashboard/entreprises/generate"
            className="inline-block bg-[#0A66C2] text-white px-6 py-3 rounded-lg hover:bg-[#004182] transition-colors font-medium"
          >
            ✨ Trouver des entreprises
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entreprise
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Industrie
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Raison
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-medium text-gray-900">{company.name}</div>
                        {company.linkedinUrl && (
                          <a
                            href={
                              company.linkedinUrl.startsWith("http")
                                ? company.linkedinUrl
                                : `https://${company.linkedinUrl}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#0A66C2] hover:underline"
                          >
                            Voir sur LinkedIn →
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{company.industry || "—"}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600 line-clamp-2">
                      {company.reason || "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <CompanyStatusBadge status={company.status} />
                  </td>
                  <td className="px-6 py-4">
                    <CompanyActions company={company} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CompanyStatusBadge({ status }: { status: string }) {
  const styles = {
    not_contacted: "bg-orange-100 text-orange-800",
    contacted: "bg-green-100 text-green-800",
    in_progress: "bg-blue-100 text-blue-800",
    closed: "bg-gray-100 text-gray-800",
  };

  const labels = {
    not_contacted: "Non contactée",
    contacted: "Contactée",
    in_progress: "En cours",
    closed: "Fermée",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        styles[status as keyof typeof styles] || styles.not_contacted
      }`}
    >
      {labels[status as keyof typeof labels] || status}
    </span>
  );
}

function CompanyActions({ company }: { company: TargetCompany }) {
  return (
    <div className="flex items-center gap-2">
      <form action={updateCompanyStatusAction}>
        <input type="hidden" name="id" value={company.id} />
        {company.status === "not_contacted" ? (
          <>
            <input type="hidden" name="status" value="contacted" />
            <button
              type="submit"
              className="text-sm text-green-600 hover:text-green-800 font-medium"
            >
              ✓ Marquer contactée
            </button>
          </>
        ) : (
          <>
            <input type="hidden" name="status" value="not_contacted" />
            <button
              type="submit"
              className="text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              ↺ Réinitialiser
            </button>
          </>
        )}
      </form>
    </div>
  );
}

async function updateCompanyStatusAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");

  const allowed = new Set(["not_contacted", "contacted", "in_progress", "closed"]);
  if (!id || !allowed.has(status)) return;

  await db.execute(sql`
    update target_companies
    set status = ${status}, updated_at = now()
    where id = ${id}::uuid
  `);

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/dashboard/entreprises");
}
