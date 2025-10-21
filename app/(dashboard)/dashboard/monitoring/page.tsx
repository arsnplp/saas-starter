import { Suspense } from 'react';
import { MonitoringDashboard } from './monitoring-dashboard';
import { getMonitoringDataAction } from './actions';

export const metadata = {
  title: 'Monitoring Temps Réel | Dashboard',
};

export default async function MonitoringPage() {
  const data = await getMonitoringDataAction();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Monitoring Temps Réel
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Suivez les publications LinkedIn des comptes ciblés (entreprises et personnes) et collectez
            automatiquement les leads engagés
          </p>
        </div>

        <Suspense fallback={<div>Chargement...</div>}>
          <MonitoringDashboard initialData={data} />
        </Suspense>
      </div>
    </div>
  );
}
