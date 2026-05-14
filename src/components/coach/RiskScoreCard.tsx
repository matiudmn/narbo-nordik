import { Link } from 'react-router-dom';
import { Phone, MessageCircle, ChevronRight } from 'lucide-react';
import Avatar from '../Avatar';
import type { RiskScore } from '../../lib/risk';

interface RiskScoreCardProps {
  riskScore: RiskScore;
}

const bandConfig = {
  ok: {
    dotClass: 'bg-success-500',
    bandLabel: 'OK',
    scoreClass: 'text-success-700',
  },
  attention: {
    dotClass: 'bg-warning-500',
    bandLabel: 'Attention',
    scoreClass: 'text-warning-700',
  },
  risque: {
    dotClass: 'bg-danger-500 animate-pulse-dot',
    bandLabel: 'Risque élevé',
    scoreClass: 'text-danger-700',
  },
} as const;

/**
 * Carte d'athlète à risque sur le Dashboard coach.
 * Affiche : score 0-100, top 3 raisons, actions rapides (Appeler / Message).
 */
export function RiskScoreCard({ riskScore }: RiskScoreCardProps) {
  const { athlete, score, band, reasons } = riskScore;
  const cfg = bandConfig[band];

  return (
    <div className="bg-white rounded-xl border border-neutral-100 p-3 hover:border-neutral-200 transition-colors">
      <div className="flex items-start gap-3">
        <Avatar user={athlete} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} aria-hidden="true" />
            <p className="text-sm font-semibold text-neutral-900 truncate">
              {athlete.firstname} {athlete.lastname}
            </p>
          </div>
          {reasons.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {reasons.map((r, i) => (
                <li key={i} className="text-xs text-neutral-500">
                  · {r}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div
          role="meter"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Score de risque : ${score} sur 100, niveau ${cfg.bandLabel}`}
          className={`flex flex-col items-end shrink-0 ${cfg.scoreClass}`}
        >
          <span className="text-lg font-bold tabular leading-none">{score}</span>
          <span className="text-[10px] text-neutral-400">/ 100</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        {athlete.phone && (
          <a
            href={`tel:${athlete.phone}`}
            aria-label={`Appeler ${athlete.firstname} ${athlete.lastname}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-neutral-50 hover:bg-neutral-100 text-neutral-700 text-xs font-medium transition-colors"
          >
            <Phone size={14} aria-hidden="true" />
            Appeler
          </a>
        )}
        {athlete.phone && (
          <a
            href={`sms:${athlete.phone}`}
            aria-label={`Envoyer un SMS à ${athlete.firstname} ${athlete.lastname}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-neutral-50 hover:bg-neutral-100 text-neutral-700 text-xs font-medium transition-colors"
          >
            <MessageCircle size={14} aria-hidden="true" />
            Message
          </a>
        )}
        <Link
          to={`/directory/${athlete.id}`}
          aria-label={`Voir la fiche de ${athlete.firstname} ${athlete.lastname}`}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-neutral-50 hover:bg-neutral-100 text-neutral-500 transition-colors"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
