'use client';

import React, { useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { createManualProspect } from './actions';
import { toast } from 'sonner';

type ProspectFolder = {
  id: number;
  name: string;
  color: string | null;
  icon: string | null;
  isDefault: boolean;
};

type Props = {
  folders: ProspectFolder[];
};

export function AddManualProspectModal({ folders }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    title: '',
    linkedinUrl: '',
    folderId: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    setIsSubmitting(true);
    const data = new FormData();
    data.append('name', formData.name.trim());
    data.append('email', formData.email.trim());
    data.append('phone', formData.phone.trim());
    data.append('company', formData.company.trim());
    data.append('title', formData.title.trim());
    data.append('linkedinUrl', formData.linkedinUrl.trim());
    if (formData.folderId) {
      data.append('folderId', formData.folderId);
    }

    try {
      const result = await createManualProspect(data);
      
      if (result.success) {
        toast.success('Prospect ajouté avec succès');
        setIsOpen(false);
        setFormData({
          name: '',
          email: '',
          phone: '',
          company: '',
          title: '',
          linkedinUrl: '',
          folderId: '',
        });
      } else {
        toast.error(result.error || 'Erreur lors de l\'ajout du prospect');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
      >
        <UserPlus className="w-4 h-4" />
        Ajouter un prospect
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Ajouter un prospect manuellement</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* Nom (requis) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom complet <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Jean Dupont"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Ex: jean.dupont@entreprise.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* Téléphone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Téléphone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Ex: +33 6 12 34 56 78"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* Entreprise */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Entreprise
              </label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="Ex: Acme Corp"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* Poste */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Poste
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Directeur Marketing"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* LinkedIn */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL LinkedIn
              </label>
              <input
                type="url"
                value={formData.linkedinUrl}
                onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                placeholder="Ex: https://www.linkedin.com/in/jeandupont"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* Dossier */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dossier de destination
              </label>
              <select
                value={formData.folderId}
                onChange={(e) => setFormData({ ...formData, folderId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="">Choisir un dossier</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Si non spécifié, le prospect sera ajouté au dossier par défaut
              </p>
            </div>
          </div>

          <div className="mt-6 flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Ajout en cours...' : 'Ajouter le prospect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
