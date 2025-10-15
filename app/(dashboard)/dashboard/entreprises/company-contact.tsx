"use client";

import { useState } from "react";
import { findContactAction } from "./actions";
import type { TargetCompany } from "@/lib/db/schema";

export function CompanyContact({ company }: { company: TargetCompany }) {
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contactProfile = company.contactProfile as {
    name: string;
    title: string;
    linkedinUrl: string;
    searchLevel: 'precise' | 'broad' | 'fallback';
    foundWithQuery: string;
  } | null;

  async function handleFindContact() {
    setIsSearching(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("companyId", company.id);

      const result = await findContactAction(formData);

      if (!result.success) {
        setError(result.message);
      }
    } catch (err) {
      setError("Erreur lors de la recherche");
    } finally {
      setIsSearching(false);
    }
  }

  if (contactProfile) {
    const levelLabels = {
      precise: '🎯 Exact',
      broad: '🔍 Large',
      fallback: '🔄 Alternatif',
    };

    return (
      <div className="text-sm">
        <div className="font-medium text-gray-900">{contactProfile.name}</div>
        <div className="text-xs text-gray-600">{contactProfile.title}</div>
        {contactProfile.linkedinUrl && (
          <a
            href={
              contactProfile.linkedinUrl.startsWith("http")
                ? contactProfile.linkedinUrl
                : `https://${contactProfile.linkedinUrl}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#0A66C2] hover:underline"
          >
            Voir profil →
          </a>
        )}
        <div className="text-xs text-gray-500 mt-1">
          {levelLabels[contactProfile.searchLevel]}
        </div>
      </div>
    );
  }

  return (
    <div className="text-sm">
      {error && <div className="text-xs text-red-600 mb-1">{error}</div>}
      <button
        onClick={handleFindContact}
        disabled={isSearching}
        className="text-sm text-[#0A66C2] hover:text-[#004182] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSearching ? "🔍 Recherche..." : "🔍 Trouver contact"}
      </button>
    </div>
  );
}
