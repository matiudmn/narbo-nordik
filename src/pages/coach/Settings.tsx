import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UsersRound, Users, Target, Gauge } from 'lucide-react';
import GroupsTab from './GroupsTab';
import PreparationsTab from './PreparationsTab';
import AthletesTab from './AthletesTab';
import AlluresTab from './AlluresTab';

type Tab = 'groups' | 'preparations' | 'athletes' | 'allures';

const VALID_TABS: Tab[] = ['groups', 'preparations', 'athletes', 'allures'];

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Onglet initial depuis l'URL (?tab=preparations) pour permettre les
  // deep-links depuis la sidebar et les liens contextuels.
  const urlTab = searchParams.get('tab');
  const initialTab: Tab = VALID_TABS.includes(urlTab as Tab) ? (urlTab as Tab) : 'groups';
  const [tab, setTabState] = useState<Tab>(initialTab);

  const setTab = (t: Tab) => {
    setTabState(t);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', t);
      return next;
    }, { replace: true });
  };

  return (
    <div className="py-4 space-y-4">
      <h1 className="text-lg font-bold text-gray-900">Parametres</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setTab('groups')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${
            tab === 'groups' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          <UsersRound size={14} />
          Groupes
        </button>
        <button
          onClick={() => setTab('preparations')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${
            tab === 'preparations' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          <Target size={14} />
          Prépas
        </button>
        <button
          onClick={() => setTab('athletes')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${
            tab === 'athletes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          <Users size={14} />
          Athletes
        </button>
        <button
          onClick={() => setTab('allures')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${
            tab === 'allures' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          <Gauge size={14} />
          Allures
        </button>
      </div>

      {tab === 'groups' && <GroupsTab />}
      {tab === 'preparations' && <PreparationsTab />}
      {tab === 'athletes' && <AthletesTab />}
      {tab === 'allures' && <AlluresTab />}
    </div>
  );
}
