import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/monitoring';
import type { Tables } from '../../types/database.types';

interface SessionAnalysisVerdict {
  points_forts: string[];
  attention: string | null;
  recommandation: string;
}

// verdict est un jsonb (Json) cote type genere : meme convention de pont
// `unknown` que dans rows.ts pour lui donner sa forme applicative.
type SessionAnalysisRow = Omit<Tables<'session_analyses'>, 'verdict'> & { verdict: SessionAnalysisVerdict };

function fetchAnalysis(validationId: string) {
  return supabase.from('session_analyses').select('*').eq('validation_id', validationId).maybeSingle();
}

interface AnalysisCardProps {
  validationId: string;
  /** Génération en cours côté SessionDetail (appel best-effort juste déclenché). */
  pending?: boolean;
}

export default function AnalysisCard({ validationId, pending = false }: AnalysisCardProps) {
  const [analysis, setAnalysis] = useState<SessionAnalysisRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAnalysis(validationId).then(({ data, error }) => {
      if (cancelled) return;
      if (error) captureError('AnalysisCard: lecture analyse', error);
      setAnalysis(data ? { ...data, verdict: data.verdict as unknown as SessionAnalysisVerdict } : null);
    });
    return () => { cancelled = true; };
  }, [validationId, pending]);

  if (analysis) {
    const { points_forts, attention, recommandation } = analysis.verdict;
    return (
      <div className="mt-3 bg-accent/5 border border-accent/20 rounded-xl p-3 text-left">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-text uppercase mb-2">
          <Sparkles size={14} aria-hidden="true" />
          Analyse IA
        </div>
        {points_forts.length > 0 && (
          <ul className="text-sm text-neutral-700 space-y-1">
            {points_forts.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        )}
        {attention && (
          <p className="text-sm text-warning-700 mt-2">
            <span className="font-medium">À surveiller : </span>{attention}
          </p>
        )}
        <p className="text-sm text-neutral-600 mt-2">{recommandation}</p>
      </div>
    );
  }

  if (pending) {
    return (
      <p className="mt-3 text-xs text-neutral-400 text-center" role="status" aria-live="polite">
        Analyse en cours…
      </p>
    );
  }

  return null;
}
