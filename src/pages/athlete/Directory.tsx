import { useState, useMemo } from 'react';
import { Search, Phone, ExternalLink, Shield, Cake } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { SUPER_ADMIN_EMAIL } from '../../lib/constants';
import { getFFACategory, formatBirthDatePublic } from '../../lib/ffa';
import Avatar from '../../components/Avatar';
import type { User } from '../../types';

function MemberCard({ member, groupName }: { member: User; groupName?: string }) {
  const category = member.birth_date ? getFFACategory(member.birth_date) : null;
  const birthday = member.birth_date ? formatBirthDatePublic(member.birth_date) : null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-3">
        <Avatar user={member} size="md" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 flex items-center gap-1.5">
            {member.firstname} {member.lastname}
            {member.role === 'coach' && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                <Shield size={10} />
                Coach
              </span>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
            {member.vma && (
              <span className="text-xs text-primary font-bold">VMA {member.vma}</span>
            )}
            {groupName && (
              <span className="text-xs text-gray-500">{groupName}</span>
            )}
            {category && (
              <span className="text-xs text-accent font-medium">{category.code}</span>
            )}
            {birthday && (
              <span className="text-xs text-gray-400 flex items-center gap-0.5">
                <Cake size={11} />
                {birthday}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {member.phone && (
            <a
              href={`https://wa.me/${member.phone.replace(/\+/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="WhatsApp"
            >
              <Phone size={18} />
            </a>
          )}
          {member.strava_id && (
            <a
              href={member.strava_id}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
              title="Strava"
            >
              <ExternalLink size={18} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Directory() {
  const { users, groups } = useData();
  const [search, setSearch] = useState('');

  const visibleUsers = useMemo(() => users.filter(u => u.email !== SUPER_ADMIN_EMAIL), [users]);

  const groupMap = useMemo(() => {
    const map = new Map<string, string>();
    groups.forEach(g => map.set(g.id, g.name));
    return map;
  }, [groups]);

  const sorted = useMemo(() => {
    let list = visibleUsers;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        u.firstname.toLowerCase().includes(q) || u.lastname.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => a.firstname.localeCompare(b.firstname, 'fr'));
  }, [visibleUsers, search]);

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-gray-900">Annuaire</h1>
        <span className="text-xs text-gray-400 font-medium">{sorted.length} membre{sorted.length > 1 ? 's' : ''}</span>
      </div>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher un membre..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      <div className="space-y-2">
        {sorted.map(member => (
          <MemberCard
            key={member.id}
            member={member}
            groupName={member.group_id ? groupMap.get(member.group_id) : undefined}
          />
        ))}
      </div>

      {sorted.length === 0 && (
        <p className="text-center text-gray-400 py-8">Aucun membre trouve</p>
      )}
    </div>
  );
}
