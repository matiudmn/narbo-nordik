import type { ReactNode } from 'react';

export type KpiTone = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface KpiEntry {
  /** Valeur affichée en gros (déjà formatée, ex: "82%", "47", "4") */
  value: ReactNode;
  /** Label sous la valeur */
  label: string;
  /** Tonalité visuelle */
  tone?: KpiTone;
  /** Icône optionnelle (Lucide) */
  icon?: ReactNode;
  /** Delta vs période précédente (ex: "+12%", "-3 séances"). Couleur auto. */
  delta?: { value: string; positive?: boolean };
}

interface KpiTrioCardProps {
  kpis: [KpiEntry, KpiEntry, KpiEntry];
  className?: string;
}

const toneClasses: Record<KpiTone, { iconBg: string; iconText: string; value: string }> = {
  primary: { iconBg: 'bg-primary/10', iconText: 'text-primary', value: 'text-primary' },
  accent: { iconBg: 'bg-accent/15', iconText: 'text-accent-dark', value: 'text-accent-dark' },
  success: { iconBg: 'bg-success-50', iconText: 'text-success-600', value: 'text-success-700' },
  warning: { iconBg: 'bg-warning-50', iconText: 'text-warning-600', value: 'text-warning-700' },
  danger: { iconBg: 'bg-danger-50', iconText: 'text-danger-600', value: 'text-danger-700' },
  info: { iconBg: 'bg-info-50', iconText: 'text-info-600', value: 'text-info-700' },
  neutral: { iconBg: 'bg-neutral-100', iconText: 'text-neutral-600', value: 'text-neutral-800' },
};

/**
 * Trio de KPI cards harmonisé — utilisé sur Dashboard coach et ClubProfile.
 * Garantit la cohérence visuelle des stats à travers l'app.
 */
export function KpiTrioCard({ kpis, className = '' }: KpiTrioCardProps) {
  return (
    <div className={['grid grid-cols-3 gap-3', className].filter(Boolean).join(' ')}>
      {kpis.map((kpi, i) => {
        const cfg = toneClasses[kpi.tone ?? 'neutral'];
        return (
          <div key={i} className="bg-white rounded-xl border border-neutral-100 p-4 text-center shadow-card">
            {kpi.icon && (
              <div className="flex justify-center mb-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cfg.iconBg} ${cfg.iconText}`}>
                  {kpi.icon}
                </div>
              </div>
            )}
            <p className={`text-2xl font-bold tabular ${cfg.value}`}>{kpi.value}</p>
            <p className="text-xs text-neutral-500 mt-0.5">{kpi.label}</p>
            {kpi.delta && (
              <p
                className={`text-[10px] mt-1 font-medium tabular ${
                  kpi.delta.positive === false ? 'text-danger-600' : 'text-success-600'
                }`}
              >
                {kpi.delta.value}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
