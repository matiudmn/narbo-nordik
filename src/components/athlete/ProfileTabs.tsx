import { User as UserIcon, Trophy, Activity, Settings } from 'lucide-react';
import { motion, SPRING } from '../../lib/motion';

export type ProfileTab = 'infos' | 'sessions' | 'strava' | 'account';

interface ProfileTabsProps {
  current: ProfileTab;
  onChange: (tab: ProfileTab) => void;
}

const tabs: { id: ProfileTab; label: string; icon: typeof UserIcon }[] = [
  { id: 'infos', label: 'Infos', icon: UserIcon },
  { id: 'sessions', label: 'Séances', icon: Trophy },
  { id: 'strava', label: 'Strava', icon: Activity },
  { id: 'account', label: 'Compte', icon: Settings },
];

/**
 * Navigation par tabs sticky pour la page Profile éclatée.
 * 4 onglets : Infos / Séances (+ palmarès) / Strava / Compte (notifs, sécu, RGPD).
 *
 * Underline animée via layoutId — l'œil suit le tab actif.
 */
export function ProfileTabs({ current, onChange }: ProfileTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Sections du profil"
      className="sticky top-0 z-20 bg-bg-base/95 backdrop-blur-sm -mx-4 px-4 pt-2 pb-1"
    >
      <div className="flex gap-1 overflow-x-auto -mb-px scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = current === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={selected}
              aria-controls={`profile-tab-${tab.id}`}
              id={`profile-tab-button-${tab.id}`}
              onClick={() => onChange(tab.id)}
              className={[
                'relative flex-1 min-w-fit flex items-center justify-center gap-1.5 py-3 px-3 text-sm font-medium whitespace-nowrap transition-colors',
                selected ? 'text-primary' : 'text-neutral-500 hover:text-neutral-700',
              ].join(' ')}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{tab.label}</span>
              {selected && (
                <motion.span
                  layoutId="profile-tab-underline"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full"
                  transition={SPRING.smooth}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
