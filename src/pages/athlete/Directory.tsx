import { useState, useMemo } from 'react';
import { Search, Phone, ExternalLink, Shield, ChevronDown, Users } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import Avatar from '../../components/Avatar';
import type { User } from '../../types';

function GroupAccordion({ title, icon, members, badge, defaultOpen = false }: {
  title: string;
  icon: React.ReactNode;
  members: User[];
  badge?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-bold text-gray-900">{title}</span>
          {badge}
        </div>
        <ChevronDown size={18} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-3 -mt-1 space-y-2">
          {members.map(member => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberCard({ member }: { member: User }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50/80">
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
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {member.is_public && member.vma && (
            <span className="text-primary font-medium">VMA {member.vma}</span>
          )}
        </div>
      </div>
      {member.is_public && (
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
      )}
    </div>
  );
}

export default function Directory() {
  const { users, groups } = useData();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter(u =>
      u.firstname.toLowerCase().includes(q) || u.lastname.toLowerCase().includes(q)
    );
  }, [users, search]);

  const coaches = useMemo(() =>
    filtered.filter(u => u.role === 'coach'),
  [filtered]);

  const groupSections = useMemo(() => {
    const athletes = filtered.filter(u => u.role === 'athlete');
    return groups.map(group => ({
      group,
      members: athletes.filter(a => a.group_id === group.id),
    })).filter(s => s.members.length > 0);
  }, [filtered, groups]);

  const ungrouped = useMemo(() =>
    filtered.filter(u => u.role === 'athlete' && !u.group_id),
  [filtered]);

  const totalFiltered = filtered.length;

  return (
    <div className="py-4">
      <h1 className="text-lg font-bold text-gray-900 mb-4">Annuaire</h1>

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

      <div className="space-y-3">
        {coaches.length > 0 && (
          <GroupAccordion
            title="Encadrement"
            icon={<Shield size={18} className="text-primary" />}
            members={coaches}
            badge={<span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{coaches.length}</span>}
            defaultOpen={true}
          />
        )}

        {groupSections.map(({ group, members }) => (
          <GroupAccordion
            key={group.id}
            title={group.name}
            icon={<Users size={18} className="text-accent" />}
            members={members}
            badge={<span className="text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded-full font-medium">{members.length}</span>}
            defaultOpen={!search}
          />
        ))}

        {ungrouped.length > 0 && (
          <GroupAccordion
            title="Sans groupe"
            icon={<Users size={18} className="text-gray-400" />}
            members={ungrouped}
            badge={<span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">{ungrouped.length}</span>}
            defaultOpen={!search}
          />
        )}
      </div>

      {totalFiltered === 0 && (
        <p className="text-center text-gray-400 py-8">Aucun membre trouve</p>
      )}
    </div>
  );
}
