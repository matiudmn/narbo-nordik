import { Link } from 'react-router-dom';
import { Plus, Upload } from 'lucide-react';

/**
 * Hero CTA principal du Dashboard coach.
 * Action primaire dominante : créer une nouvelle séance.
 * La duplication de la semaine passée vit dans le Planning
 * (« Nouvelle séance » > onglet « Semaine S-1 »), pas ici.
 */
export function CoachHeroCTA() {
  return (
    <div className="space-y-2">
      <Link
        to="/coach/nouvelle-seance"
        className="group flex items-center justify-between gap-3 bg-primary text-white rounded-xl p-4 hover:bg-primary-light transition-colors shadow-card hover:shadow-card-hover"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <Plus size={20} className="text-accent" aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-semibold">Nouvelle séance</p>
            <p className="text-xs text-white/60">Saisie rapide d'une séance</p>
          </div>
        </div>
        <span className="text-white/40 group-hover:text-white/80 transition-colors" aria-hidden="true">→</span>
      </Link>

      <Link
        to="/coach/import"
        className="group flex items-center justify-between gap-3 rounded-xl border border-neutral-200 p-3 hover:bg-neutral-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center">
            <Upload size={16} className="text-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-800">Importer un plan Excel</p>
            <p className="text-xs text-neutral-500">Colle ton tableau, l'app crée les séances</p>
          </div>
        </div>
        <span className="text-neutral-300 group-hover:text-neutral-500 transition-colors" aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
