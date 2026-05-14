import { Clock, Repeat, Layers, Trash2 } from 'lucide-react';
import type { SessionTemplate } from '../../types';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../lib/sessionTemplates';
import { calculateSessionTotalSeconds, formatSeconds } from '../../lib/calculations';

interface TemplateCardProps {
  template: SessionTemplate;
  onUse: (template: SessionTemplate) => void;
  onDelete?: (template: SessionTemplate) => void;
}

/**
 * Carte d'un template de séance dans la bibliothèque coach.
 * Affiche : nom, description, catégorie en pastille colorée,
 * durée totale, nb blocs, indicateur "seed" (template système).
 * CTA principal : "Utiliser".
 */
export function TemplateCard({ template, onUse, onDelete }: TemplateCardProps) {
  const totalSeconds = calculateSessionTotalSeconds(template.blocks);
  const blocksCount = template.blocks.length;

  return (
    <div className="bg-white rounded-xl border border-neutral-100 hover:border-neutral-200 hover:shadow-card-hover transition-all p-4">
      <div className="flex items-start gap-3">
        <span
          className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
          style={{ backgroundColor: CATEGORY_COLORS[template.category] }}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-neutral-900 truncate">{template.name}</h3>
            <span
              className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: CATEGORY_COLORS[template.category] + '20',
                color: CATEGORY_COLORS[template.category],
              }}
            >
              {CATEGORY_LABELS[template.category]}
            </span>
            {template.is_seed && (
              <span
                title="Template système — non supprimable"
                className="text-[10px] text-neutral-400"
                aria-label="Template système"
              >
                ★
              </span>
            )}
          </div>
          {template.description && (
            <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{template.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-neutral-500 tabular">
            {totalSeconds > 0 && (
              <span className="inline-flex items-center gap-1">
                <Clock size={12} aria-hidden="true" />
                {formatSeconds(totalSeconds)}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Layers size={12} aria-hidden="true" />
              {blocksCount} bloc{blocksCount > 1 ? 's' : ''}
            </span>
            {template.usage_count > 0 && (
              <span className="inline-flex items-center gap-1">
                <Repeat size={12} aria-hidden="true" />
                {template.usage_count}×
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onUse(template)}
          className="flex-1 py-2 bg-accent text-white text-sm font-semibold rounded-lg hover:bg-accent-light transition-colors"
        >
          Utiliser
        </button>
        {onDelete && !template.is_seed && (
          <button
            onClick={() => onDelete(template)}
            aria-label={`Supprimer le template ${template.name}`}
            className="px-3 py-2 text-neutral-400 hover:text-danger hover:bg-danger-50 rounded-lg transition-colors"
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
