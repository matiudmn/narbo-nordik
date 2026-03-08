import { useState, useMemo } from 'react';
import { Search, Phone, ExternalLink } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import Avatar from '../../components/Avatar';

export default function Directory() {
  const { users, groups } = useData();
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<string | null>(null);

  const athletes = useMemo(() => {
    return users
      .filter(u => {
        if (search) {
          const q = search.toLowerCase();
          return u.firstname.toLowerCase().includes(q) || u.lastname.toLowerCase().includes(q);
        }
        return true;
      })
      .filter(u => !groupFilter || u.group_id === groupFilter);
  }, [users, search, groupFilter]);

  const getGroupName = (groupId: string | null) =>
    groupId ? groups.find(g => g.id === groupId)?.name || '' : '';


  return (
    <div className="py-4">
      <h1 className="text-lg font-bold text-gray-900 mb-4">Annuaire</h1>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher un athlete..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      {/* Group filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
        <button
          onClick={() => setGroupFilter(null)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !groupFilter ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Tous
        </button>
        {groups.map(group => (
          <button
            key={group.id}
            onClick={() => setGroupFilter(group.id === groupFilter ? null : group.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              groupFilter === group.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {group.name}
          </button>
        ))}
      </div>

      {/* Athletes list */}
      <div className="space-y-2">
        {athletes.map((athlete) => (
          <div key={athlete.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <Avatar user={athlete} size="md" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">
                {athlete.firstname} {athlete.lastname}
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{getGroupName(athlete.group_id)}</span>
                {athlete.is_public && athlete.vma && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span className="text-primary font-medium">VMA {athlete.vma}</span>
                  </>
                )}
              </div>
            </div>
            {athlete.is_public && (
              <div className="flex items-center gap-1">
                {athlete.phone && (
                  <a
                    href={`https://wa.me/${athlete.phone.replace(/\+/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="WhatsApp"
                  >
                    <Phone size={18} />
                  </a>
                )}
                {athlete.strava_id && (
                  <a
                    href={athlete.strava_id}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                    title="Strava"
                  >
                    <ExternalLink size={18} />
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {athletes.length === 0 && (
        <p className="text-center text-gray-400 py-8">Aucun athlete trouve</p>
      )}
    </div>
  );
}
