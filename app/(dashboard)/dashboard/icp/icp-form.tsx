'use client';

import { useState, useActionState } from 'react';
import { saveIcpProfile } from './actions';
import { Button } from '@/components/ui/button';
import type { IcpProfile } from '@/lib/db/schema';

type IcpFormProps = {
  teamId: number;
  existingIcp?: IcpProfile | null;
};

export default function IcpForm({ teamId, existingIcp }: IcpFormProps) {
  const [state, formAction, isPending] = useActionState(saveIcpProfile, null);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="teamId" value={teamId} />
      {existingIcp && <input type="hidden" name="icpId" value={existingIcp.id} />}

      {/* Nom du profil ICP */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Nom du profil ICP *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          defaultValue={existingIcp?.name || ''}
          placeholder="Mon Prospect Idéal 2025"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
      </div>

      {/* Secteurs d'activité */}
      <div>
        <label htmlFor="industries" className="block text-sm font-medium text-gray-700 mb-1">
          Secteurs d'activité ciblés
        </label>
        <textarea
          id="industries"
          name="industries"
          defaultValue={existingIcp?.industries || ''}
          placeholder="SaaS, Technology, E-commerce, Marketing (séparés par des virgules)"
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
        <p className="mt-1 text-xs text-gray-500">Séparez les secteurs par des virgules</p>
      </div>

      {/* Postes/Titres recherchés */}
      <div>
        <label htmlFor="buyerRoles" className="block text-sm font-medium text-gray-700 mb-1">
          Postes/Titres recherchés
        </label>
        <textarea
          id="buyerRoles"
          name="buyerRoles"
          defaultValue={existingIcp?.buyerRoles || ''}
          placeholder="CEO, CTO, VP Engineering, Founder, Head of Product (séparés par des virgules)"
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
        <p className="mt-1 text-xs text-gray-500">Séparez les titres par des virgules</p>
      </div>

      {/* Taille d'entreprise */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="companySizeMin" className="block text-sm font-medium text-gray-700 mb-1">
            Taille entreprise (min)
          </label>
          <input
            type="number"
            id="companySizeMin"
            name="companySizeMin"
            defaultValue={existingIcp?.companySizeMin || 1}
            min="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <div>
          <label htmlFor="companySizeMax" className="block text-sm font-medium text-gray-700 mb-1">
            Taille entreprise (max)
          </label>
          <input
            type="number"
            id="companySizeMax"
            name="companySizeMax"
            defaultValue={existingIcp?.companySizeMax || 10000}
            min="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Localisation */}
      <div>
        <label htmlFor="locations" className="block text-sm font-medium text-gray-700 mb-1">
          Localisations ciblées
        </label>
        <input
          type="text"
          id="locations"
          name="locations"
          defaultValue={existingIcp?.locations || ''}
          placeholder="France, Europe, USA (séparés par des virgules)"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
        <p className="mt-1 text-xs text-gray-500">Séparez les régions par des virgules</p>
      </div>

      {/* Mots-clés importants */}
      <div>
        <label htmlFor="keywordsInclude" className="block text-sm font-medium text-gray-700 mb-1">
          Mots-clés importants
        </label>
        <textarea
          id="keywordsInclude"
          name="keywordsInclude"
          defaultValue={existingIcp?.keywordsInclude || ''}
          placeholder="AI, automation, B2B, SaaS, startup, innovation (séparés par des virgules)"
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
        <p className="mt-1 text-xs text-gray-500">Mots-clés à rechercher dans le profil/expérience</p>
      </div>

      {/* Mots-clés à exclure */}
      <div>
        <label htmlFor="keywordsExclude" className="block text-sm font-medium text-gray-700 mb-1">
          Mots-clés à exclure
        </label>
        <textarea
          id="keywordsExclude"
          name="keywordsExclude"
          defaultValue={existingIcp?.keywordsExclude || ''}
          placeholder="recruiter, student, freelance, intern (séparés par des virgules)"
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
        <p className="mt-1 text-xs text-gray-500">Mots-clés qui disqualifient le prospect</p>
      </div>

      {/* Catégorie produit */}
      <div>
        <label htmlFor="productCategory" className="block text-sm font-medium text-gray-700 mb-1">
          Catégorie de produit (optionnel)
        </label>
        <input
          type="text"
          id="productCategory"
          name="productCategory"
          defaultValue={existingIcp?.productCategory || ''}
          placeholder="Marketing Automation, CRM, Analytics..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
      </div>

      {/* Description du produit/entreprise */}
      <div>
        <label htmlFor="problemStatement" className="block text-sm font-medium text-gray-700 mb-1">
          Description du produit de l'entreprise (optionnel)
        </label>
        <textarea
          id="problemStatement"
          name="problemStatement"
          defaultValue={existingIcp?.problemStatement || ''}
          placeholder="Ex: Plateforme SaaS qui automatise la qualification de leads B2B via l'IA..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
        <p className="mt-1 text-xs text-gray-500">
          Décrivez ce que fait votre entreprise/produit pour aider l'IA à mieux comprendre votre cible
        </p>
      </div>

      {/* Exemple de client idéal (nouveau) */}
      <div>
        <label htmlFor="idealCustomerExample" className="block text-sm font-medium text-gray-700 mb-1">
          Exemple de client parfait (optionnel)
        </label>
        <textarea
          id="idealCustomerExample"
          name="idealCustomerExample"
          defaultValue={existingIcp?.idealCustomerExample || ''}
          placeholder="Ex: CEO d'une startup SaaS B2B, 20-50 employés, Series A, utilise Salesforce..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
        <p className="mt-1 text-xs text-gray-500">
          Décrivez un profil client concret pour calibrer le scoring IA
        </p>
      </div>

      {/* Score minimum */}
      <div>
        <label htmlFor="minScore" className="block text-sm font-medium text-gray-700 mb-1">
          Score minimum accepté (0-100)
        </label>
        <input
          type="number"
          id="minScore"
          name="minScore"
          defaultValue={existingIcp?.minScore || 50}
          min="0"
          max="100"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
        <p className="mt-1 text-xs text-gray-500">
          Les prospects avec un score inférieur seront marqués comme non qualifiés
        </p>
      </div>

      {/* Langue */}
      <div>
        <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">
          Langue
        </label>
        <select
          id="language"
          name="language"
          defaultValue={existingIcp?.language || 'fr'}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </div>

      {state?.success === false && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          Une erreur est survenue. Veuillez réessayer.
        </div>
      )}

      {state?.success === true && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-600">
          Profil ICP sauvegardé avec succès !
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Sauvegarde...' : 'Sauvegarder mon profil ICP'}
      </Button>
    </form>
  );
}
