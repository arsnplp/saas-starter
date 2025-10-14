"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateCompaniesAction } from "../actions";

export default function GenerateCompaniesForm({
  icps,
}: {
  icps: any[];
}) {
  const router = useRouter();
  const [selectedIcpId, setSelectedIcpId] = useState<string>("");
  const [count, setCount] = useState(15);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success?: boolean;
    message?: string;
    companiesCount?: number;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedIcpId) {
      setResult({ success: false, message: "Veuillez sélectionner un ICP" });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("icpId", selectedIcpId);
      formData.append("count", count.toString());

      const response = await generateCompaniesAction(formData);
      setResult(response);

      if (response.success) {
        setTimeout(() => {
          router.push("/dashboard/entreprises");
        }, 2000);
      }
    } catch (error) {
      setResult({
        success: false,
        message: "Une erreur est survenue lors de la génération",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedIcp = icps.find((icp) => icp.id === parseInt(selectedIcpId));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sélectionner un ICP
          </label>
          <select
            value={selectedIcpId}
            onChange={(e) => setSelectedIcpId(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A66C2] focus:border-transparent"
            disabled={isLoading}
          >
            <option value="">Choisir un profil ICP...</option>
            {icps.map((icp) => (
              <option key={icp.id} value={icp.id}>
                {icp.name}
              </option>
            ))}
          </select>
        </div>

        {selectedIcp && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-3">Détails de l'ICP</h3>
            <div className="space-y-2 text-sm text-blue-800">
              {selectedIcp.industries && (
                <div>
                  <span className="font-medium">Industries:</span> {selectedIcp.industries}
                </div>
              )}
              {selectedIcp.locations && (
                <div>
                  <span className="font-medium">Localisations:</span> {selectedIcp.locations}
                </div>
              )}
              {selectedIcp.buyerRoles && (
                <div>
                  <span className="font-medium">Rôles cibles:</span> {selectedIcp.buyerRoles}
                </div>
              )}
              {selectedIcp.problemStatement && (
                <div>
                  <span className="font-medium">Problème:</span>{" "}
                  {selectedIcp.problemStatement}
                </div>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre d'entreprises à générer
          </label>
          <input
            type="number"
            min="5"
            max="30"
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value))}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A66C2] focus:border-transparent"
            disabled={isLoading}
          />
          <p className="text-sm text-gray-500 mt-1">Entre 5 et 30 entreprises</p>
        </div>
      </div>

      {result && (
        <div
          className={`p-4 rounded-lg ${
            result.success
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {result.success ? "✓" : "✗"} {result.message}
          {result.companiesCount !== undefined && (
            <div className="mt-1 text-sm">
              {result.companiesCount} entreprises ajoutées
            </div>
          )}
        </div>
      )}

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isLoading || !selectedIcpId}
          className="flex-1 bg-[#0A66C2] text-white px-6 py-3 rounded-lg hover:bg-[#004182] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Génération en cours...
            </span>
          ) : (
            "✨ Générer des entreprises"
          )}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isLoading}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
