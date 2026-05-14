import { Link } from 'react-router-dom';
import { Plus, Copy } from 'lucide-react';

interface CoachHeroCTAProps {
  /** Si défini, "Dupliquer la semaine passée" est cliquable et appelle ce handler */
  onDuplicateLastWeek?: () => void;
  /** Compte de séances de la semaine passée (pour afficher / désactiver) */
  lastWeekSessionCount?: number;
}

/**
 * Hero CTA principal du Dashboard coach.
 * Action primaire dominante : créer une nouvelle séance.
 * Action secondaire conditionnelle : dupliquer la semaine passée.
 */
export function CoachHeroCTA({ onDuplicateLastWeek, lastWeekSessionCount }: CoachHeroCTAProps) {
  const canDuplicate = Boolean(onDuplicateLastWeek && (lastWeekSessionCount ?? 0) > 0);

  return (
    <div className="space-y-2">
      <Link
        to="/coach/sessions"
        className="group flex items-center justify-between gap-3 bg-primary text-white rounded-xl p-4 hover:bg-primary-light transition-colors shadow-card hover:shadow-card-hover"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <Plus size={20} className="text-accent" aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-semibold">Nouvelle séance</p>
            <p className="text-xs text-white/60">Publie le programme du club</p>
          </div>
        </div>
        <span className="text-white/40 group-hover:text-white/80 transition-colors" aria-hidden="true">→</span>
      </Link>

      <button
        type="button"
        onClick={canDuplicate ? onDuplicateLastWeek : undefined}
        disabled={!canDuplicate}
        aria-label={
          canDuplicate
            ? `Dupliquer les ${lastWeekSessionCount} séances de la semaine passée`
            : 'Aucune séance à dupliquer'
        }
        title={
          canDuplicate
            ? `Dupliquer les ${lastWeekSessionCount} séances de la semaine passée`
            : 'Aucune séance la semaine passée'
        }
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Copy size={14} aria-hidden="true" />
        Dupliquer la semaine passée
        {canDuplicate && (
          <span className="text-xs text-neutral-400">({lastWeekSessionCount})</span>
        )}
      </button>
    </div>
  );
}
