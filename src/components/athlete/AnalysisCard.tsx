import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/monitoring';

interface SessionAnalysisVerdict {
  points_forts: string[];
  attention: string | null;
  recommandation: string;
}

interface SessionAnalysisRow {
  id: string;
  validation_id: string;
  verdict: SessionAnalysisVerdict;
  model: string;
  created_at: string;
}

// session_analyses (migration 20260810120000) : absente des types generes tant
// que la migration n'est pas appliquee en prod et que `npm run gen:types` n'a
// pas tourne (meme raison documentee que registerProfile dans AuthContext).
// Cast local borne a ce seul appel, a retirer au profit de
// `Tables<'session_analyses'>` une fois les types regeneres.
function fetchAnalysis(validationId: string) {
  return (
    supabase.from as unknown as (table: 'session_analyses') => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: SessionAnalysisRow | null; error: { message: string } | null }>;
        };
      };
    }
  )('session_analyses').select('*').eq('validation_id', validationId).maybeSingle();
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
      setAnalysis(data ?? null);
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
