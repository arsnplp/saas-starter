import React from "react";
import { db } from "@/lib/db";
import { icpProfiles } from "@/lib/db/schema";
import { getUser, getTeamForUser } from "@/lib/db/queries";
import { eq } from "drizzle-orm";
import GenerateCompaniesForm from "./generate-companies-form";

export const dynamic = "force-dynamic";

export default async function GenerateCompaniesPage() {
  const user = await getUser();
  if (!user) {
    return <div className="p-8">Vous devez être connecté pour voir cette page.</div>;
  }

  const team = await getTeamForUser();
  if (!team) {
    return <div className="p-8">Vous devez faire partie d'une équipe.</div>;
  }

  const icps = await db.query.icpProfiles.findMany({
    where: eq(icpProfiles.teamId, team.id),
  });

  if (icps.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold text-[#0A66C2]">Générer des Entreprises</h1>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-orange-900 mb-2">
            Aucun ICP configuré
          </h2>
          <p className="text-orange-700 mb-4">
            Vous devez d'abord créer un profil ICP (Ideal Customer Profile) avant de générer
            des entreprises cibles.
          </p>
          <a
            href="/dashboard/icp"
            className="inline-block bg-[#0A66C2] text-white px-6 py-3 rounded-lg hover:bg-[#004182] transition-colors font-medium"
          >
            Créer un ICP
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#0A66C2]">Générer des Entreprises Cibles</h1>
        <p className="text-gray-600 mt-1">
          Utilisez GPT pour trouver des entreprises pertinentes à contacter
        </p>
      </div>

      <GenerateCompaniesForm icps={icps} />
    </div>
  );
}
