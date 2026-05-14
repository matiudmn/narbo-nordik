import { useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, TrendingUp, TrendingDown, Gauge } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js';
import type { ChartOptions, TooltipItem } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useAuth } from '../contexts/AuthContext';
import { EmptyState, MetricTile } from '../components/ui';
import { useData } from '../contexts/DataContext';
import { CHART_COLORS } from '../lib/chartTheme';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

export default function VmaHistory() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { users } = useData();

  const targetUserId = searchParams.get('user');
  const targetUser = targetUserId ? users.find((u) => u.id === targetUserId) : user;

  // history du plus ancien au plus récent (pour le chart)
  const sortedHistory = useMemo(() => {
    if (!targetUser) return [];
    return [...targetUser.vma_history].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [targetUser]);

  // history du plus récent au plus ancien (pour la liste)
  const listHistory = useMemo(() => [...sortedHistory].reverse(), [sortedHistory]);

  const chartData = useMemo(() => {
    return {
      labels: sortedHistory.map((e) => format(new Date(e.date), 'd MMM yyyy', { locale: fr })),
      datasets: [
        {
          label: 'VMA',
          data: sortedHistory.map((e) => e.vma),
          borderColor: CHART_COLORS.accent,
          backgroundColor: CHART_COLORS.accentSoft,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: CHART_COLORS.accent,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 2.5,
        },
      ],
    };
  }, [sortedHistory]);

  const chartOptions = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: TooltipItem<'line'>) => `${ctx.parsed.y} km/h`,
            afterLabel: (ctx: TooltipItem<'line'>) => {
              const entry = sortedHistory[ctx.dataIndex];
              return entry?.reason ? `Contexte : ${entry.reason}` : '';
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: false,
          grid: { color: '#e2e8f0' },
          ticks: { color: '#94a3b8', font: { size: 11 } },
          title: { display: true, text: 'km/h', color: '#64748b', font: { size: 11 } },
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { size: 11 }, maxRotation: 0 },
        },
      },
    }),
    [sortedHistory]
  );

  if (!targetUser) {
    return (
      <div className="py-8 text-center">
        <p className="text-gray-500">Utilisateur introuvable</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary font-medium">Retour</button>
      </div>
    );
  }

  const isOwnProfile = !targetUserId || targetUserId === user?.id;

  // Insight : evolution vs début historique
  const insight = useMemo(() => {
    if (sortedHistory.length < 2) return null;
    const first = sortedHistory[0];
    const last = sortedHistory[sortedHistory.length - 1];
    const diff = last.vma - first.vma;
    const pct = ((diff / first.vma) * 100).toFixed(1);
    const months = Math.max(
      1,
      Math.round((new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24 * 30))
    );
    return { diff, pct: Number(pct), months };
  }, [sortedHistory]);

  return (
    <div className="py-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-gray-500 hover:text-gray-900 mb-4">
        <ArrowLeft size={20} />
        <span className="text-sm">Retour</span>
      </button>

      <h1 className="text-lg font-bold text-gray-900 mb-1">Historique VMA</h1>
      {!isOwnProfile && (
        <p className="text-sm text-gray-500 mb-4">
          {targetUser.firstname} {targetUser.lastname}
        </p>
      )}

      {targetUser.vma && (
        <div className="mb-4">
          <MetricTile
            valueDisplay={targetUser.vma}
            unit="km/h"
            label="VMA actuelle"
            tone="primary"
            size="lg"
            delta={
              insight
                ? {
                    value: `${insight.diff > 0 ? '+' : ''}${insight.diff.toFixed(1)} km/h en ${insight.months} mois`,
                    positive: insight.diff >= 0,
                  }
                : undefined
            }
          />
        </div>
      )}

      {sortedHistory.length >= 2 && (
        <div className="bg-white rounded-xl border border-neutral-100 p-4 mb-4 shadow-card">
          <p className="label-micro text-neutral-400 mb-3">Évolution</p>
          <div className="h-48">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {listHistory.length === 0 ? (
        <EmptyState
          icon={<Gauge size={28} />}
          title="Aucun test VMA pour l'instant"
          description="L'évolution de ta VMA apparaîtra ici après ton premier test piste."
        />
      ) : (
        <div className="space-y-2">
          <p className="label-micro text-neutral-400 mb-2">Tests passés</p>
          {listHistory.map((entry, idx) => {
            const prevEntry = idx < listHistory.length - 1 ? listHistory[idx + 1] : null;
            const diff = prevEntry ? entry.vma - prevEntry.vma : null;
            return (
              <div key={`${entry.date}-${entry.vma}`} className="bg-white rounded-xl border border-neutral-100 p-4 shadow-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-primary tabular">{entry.vma}</span>
                    <span className="text-sm text-neutral-400">km/h</span>
                    {diff !== null && diff !== 0 && (
                      <span className={`flex items-center gap-0.5 text-xs font-medium tabular ${diff > 0 ? 'text-success-600' : 'text-danger-600'}`}>
                        {diff > 0 ? <TrendingUp size={12} aria-hidden="true" /> : <TrendingDown size={12} aria-hidden="true" />}
                        {diff > 0 ? '+' : ''}
                        {diff.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-neutral-400">
                    {format(new Date(entry.date), 'd MMM yyyy', { locale: fr })}
                  </span>
                </div>
                {entry.reason && <p className="text-sm text-neutral-600 mt-2 italic">{entry.reason}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
