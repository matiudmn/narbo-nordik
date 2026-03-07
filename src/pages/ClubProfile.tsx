import { useMemo } from 'react';
import { format, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Trophy, Medal } from 'lucide-react';
import NordikButton from '../components/NordikButton';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useData } from '../contexts/DataContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

function formatPace(vma: number): string {
  const pace = 60 / vma;
  const min = Math.floor(pace);
  const sec = Math.round((pace - min) * 60);
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function formatDuration(duration: string): string {
  const parts = duration.split(':');
  const h = parseInt(parts[0]);
  const m = parseInt(parts[1]);
  const s = parseInt(parts[2]);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ClubProfile() {
  const { users, groups, sessions, validations, raceResults } = useData();

  const athletes = useMemo(() =>
    users.filter(u => u.vma !== null)
      .sort((a, b) => (b.vma || 0) - (a.vma || 0)),
    [users]
  );

  const vmaValues = useMemo(() =>
    athletes.map(a => a.vma!).sort((a, b) => a - b),
    [athletes]
  );

  const stats = useMemo(() => {
    if (vmaValues.length === 0) return { count: 0, avg: 0, max: 0, min: 0, median: 0, q1: 0, q3: 0 };
    const sum = vmaValues.reduce((a, b) => a + b, 0);
    return {
      count: vmaValues.length,
      avg: Math.round((sum / vmaValues.length) * 10) / 10,
      max: vmaValues[vmaValues.length - 1],
      min: vmaValues[0],
      median: quantile(vmaValues, 0.5),
      q1: quantile(vmaValues, 0.25),
      q3: quantile(vmaValues, 0.75),
    };
  }, [vmaValues]);

  // Participation rate over last 4 weeks
  const participationRate = useMemo(() => {
    const now = new Date();
    const fourWeeksAgo = subWeeks(startOfWeek(now, { weekStartsOn: 1 }), 4);
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const recentSessions = sessions.filter(s => {
      const d = new Date(s.date);
      return d >= fourWeeksAgo && d <= weekEnd;
    });

    if (recentSessions.length === 0) return { rate: 0, done: 0, total: 0 };

    const athleteIds = athletes.map(a => a.id);
    let totalExpected = 0;
    let totalDone = 0;

    recentSessions.forEach(s => {
      const eligibleAthletes = athleteIds.filter(id => {
        const user = users.find(u => u.id === id);
        if (!user) return false;
        if (!s.group_id) return true;
        return s.group_id === user.group_id || user.role === 'coach';
      });
      totalExpected += eligibleAthletes.length;
      totalDone += validations.filter(
        v => v.session_id === s.id && v.status === 'done' && eligibleAthletes.includes(v.user_id)
      ).length;
    });

    return {
      rate: totalExpected > 0 ? Math.round((totalDone / totalExpected) * 100) : 0,
      done: totalDone,
      total: totalExpected,
    };
  }, [sessions, validations, athletes, users]);

  const groupDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    athletes.forEach(a => {
      const g = groups.find(g => g.id === a.group_id);
      const name = g?.name || 'Coach / Mixte';
      counts[name] = (counts[name] || 0) + 1;
    });
    return counts;
  }, [athletes, groups]);

  // VMA distribution by bins
  const vmaHistogram = useMemo(() => {
    if (vmaValues.length === 0) return { labels: [], counts: [] };
    const binStart = Math.floor(stats.min);
    const binEnd = Math.ceil(stats.max);
    const labels: string[] = [];
    const counts: number[] = [];

    for (let i = binStart; i < binEnd; i++) {
      labels.push(`${i}-${i + 1}`);
      counts.push(vmaValues.filter(v => v >= i && v < i + 1).length);
    }
    // Include values exactly at the upper bound in the last bin
    const lastBinIdx = counts.length - 1;
    if (lastBinIdx >= 0) {
      counts[lastBinIdx] += vmaValues.filter(v => v === binEnd).length;
    }

    return { labels, counts };
  }, [vmaValues, stats.min, stats.max]);

  // Collective palmares - recent races
  const palmares = useMemo(() => {
    return raceResults
      .map(r => {
        const user = users.find(u => u.id === r.user_id);
        return { ...r, user };
      })
      .filter(r => r.user)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [raceResults, users]);

  const barData = {
    labels: athletes.map(a => `${a.firstname} ${a.lastname.charAt(0)}.`),
    datasets: [{
      label: 'VMA (km/h)',
      data: athletes.map(a => a.vma),
      backgroundColor: '#6CCBE6',
      hoverBackgroundColor: '#4ABDD9',
      borderRadius: 6,
    }],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: false,
        min: Math.max(0, stats.min - 2),
        title: { display: true, text: 'VMA (km/h)', font: { weight: 'bold' as const } },
      },
      x: { ticks: { font: { size: 11 } } },
    },
  };

  const histogramData = {
    labels: vmaHistogram.labels,
    datasets: [{
      label: 'Nombre de coureurs',
      data: vmaHistogram.counts,
      backgroundColor: '#F43F5E',
      hoverBackgroundColor: '#E11D48',
      borderRadius: 4,
    }],
  };

  const histogramOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1 },
        title: { display: true, text: 'Coureurs', font: { weight: 'bold' as const } },
      },
      x: {
        title: { display: true, text: 'VMA (km/h)', font: { weight: 'bold' as const } },
      },
    },
  };

  const groupLabels = Object.keys(groupDistribution);
  const groupColors = ['#6CCBE6', '#F43F5E', '#8B5CF6', '#F59E0B', '#10B981'];

  const donutData = {
    labels: groupLabels,
    datasets: [{
      data: Object.values(groupDistribution),
      backgroundColor: groupColors.slice(0, groupLabels.length),
      borderWidth: 2,
      hoverOffset: 4,
    }],
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: { legend: { position: 'bottom' as const } },
  };

  // Box plot dimensions
  const boxRange = stats.max - stats.min || 1;
  const toPercent = (v: number) => ((v - stats.min) / boxRange) * 100;

  const raceTypeLabels: Record<string, string> = {
    route: 'Route',
    trail: 'Trail',
    piste: 'Piste',
  };

  const raceTypeColors: Record<string, string> = {
    route: 'bg-blue-100 text-blue-700',
    trail: 'bg-emerald-100 text-emerald-700',
    piste: 'bg-violet-100 text-violet-700',
  };

  return (
    <div className="py-4 space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Profil Athletique du Club</h1>
        <p className="text-sm text-gray-500 mt-1">
          Vue d'ensemble des performances et de l'activite du club.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border-l-4 border-accent p-3 shadow-sm">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Effectif</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">
            {stats.count}<span className="text-sm text-gray-400 font-medium ml-1">coureurs</span>
          </p>
        </div>
        <div className="bg-white rounded-xl border-l-4 border-emerald-500 p-3 shadow-sm">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Participation</p>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">
            {participationRate.rate}<span className="text-sm text-emerald-400 font-medium ml-1">%</span>
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">4 dernieres semaines</p>
        </div>
        <div className="bg-white rounded-xl border-l-4 border-rose-500 p-3 shadow-sm">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">VMA Moyenne</p>
          <p className="text-2xl font-extrabold text-rose-500 mt-1">
            {stats.avg}<span className="text-sm text-rose-300 font-medium ml-1">km/h</span>
          </p>
        </div>
        <div className="bg-white rounded-xl border-l-4 border-violet-500 p-3 shadow-sm">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Plafond VMA</p>
          <p className="text-2xl font-extrabold text-violet-600 mt-1">
            {stats.max}<span className="text-sm text-violet-300 font-medium ml-1">km/h</span>
          </p>
        </div>
      </div>

      {/* Palmares collectif */}
      {palmares.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Trophy size={18} className="text-amber-500" />
            Palmares Collectif
          </h2>
          <div className="space-y-2">
            {palmares.map((race, idx) => (
              <div
                key={race.id}
                className={`bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-3 ${
                  idx === 0 ? 'ring-2 ring-amber-200' : ''
                }`}
              >
                <div className="flex-shrink-0">
                  {idx < 3 ? (
                    <Medal size={20} className={
                      idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-gray-400' : 'text-amber-700'
                    } />
                  ) : (
                    <div className="w-5 h-5 flex items-center justify-center text-xs text-gray-400 font-bold">
                      {idx + 1}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{race.race_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">
                      {race.user?.firstname} {race.user?.lastname.charAt(0)}.
                    </span>
                    <span className="text-xs text-gray-400">
                      {format(new Date(race.date), 'd MMM yyyy', { locale: fr })}
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-bold text-gray-900">{formatDuration(race.time_duration)}</p>
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    <span className="text-xs text-gray-400">{race.distance_km}km</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${raceTypeColors[race.race_type] || 'bg-gray-100 text-gray-600'}`}>
                      {raceTypeLabels[race.race_type] || race.race_type}
                    </span>
                  </div>
                </div>
                <NordikButton raceId={race.id} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Distribution */}
      <section>
        <h2 className="text-base font-bold text-gray-900 mb-3">Repartition & Distribution</h2>

        {/* Group donut */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-3">
          <h3 className="text-sm font-bold text-gray-700 mb-3 text-center">Repartition par Groupe</h3>
          <div className="h-[220px]">
            <Doughnut data={donutData} options={donutOptions} />
          </div>
        </div>

        {/* VMA Histogram */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-3">
          <h3 className="text-sm font-bold text-gray-700 mb-3 text-center">Distribution VMA par Tranche</h3>
          <div className="h-[220px]">
            <Bar data={histogramData} options={histogramOptions} />
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Repartition des {stats.count} coureurs par tranche de 1 km/h
          </p>
        </div>

        {/* Box plot */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3 text-center">Dispersion de la VMA</h3>
          <div className="px-2">
            {/* Scale */}
            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
              <span>{stats.min}</span>
              <span>{stats.avg} (moy.)</span>
              <span>{stats.max}</span>
            </div>
            {/* Box plot visual */}
            <div className="relative h-12 bg-gray-100 rounded-lg overflow-hidden">
              {/* Whisker line */}
              <div
                className="absolute top-1/2 -translate-y-1/2 h-0.5 bg-gray-400"
                style={{ left: '0%', right: '0%' }}
              />
              {/* IQR Box */}
              <div
                className="absolute top-1 bottom-1 bg-rose-200 border-2 border-rose-400 rounded"
                style={{
                  left: `${toPercent(stats.q1)}%`,
                  width: `${toPercent(stats.q3) - toPercent(stats.q1)}%`,
                }}
              />
              {/* Median line */}
              <div
                className="absolute top-0.5 bottom-0.5 w-0.5 bg-rose-600"
                style={{ left: `${toPercent(stats.median)}%` }}
              />
              {/* Min whisker */}
              <div className="absolute top-2 bottom-2 w-0.5 bg-gray-400" style={{ left: '0%' }} />
              {/* Max whisker */}
              <div className="absolute top-2 bottom-2 w-0.5 bg-gray-400" style={{ right: '0%' }} />
              {/* Individual dots */}
              {vmaValues.map((v, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 bg-rose-500 rounded-full -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${toPercent(v)}%`, top: `${30 + (i % 3) * 15}%` }}
                  title={`${v} km/h`}
                />
              ))}
            </div>
            {/* Labels */}
            <div className="flex justify-between mt-2 text-[10px] text-gray-500">
              <span>Q1: {stats.q1.toFixed(1)}</span>
              <span>Mediane: {stats.median.toFixed(1)}</span>
              <span>Q3: {stats.q3.toFixed(1)}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">
            Amplitude: {stats.min} - {stats.max} km/h.
            Allures a 100%&nbsp;: de {formatPace(stats.min)}/km a {formatPace(stats.max)}/km
          </p>
        </div>
      </section>

      {/* Bar chart - Individual VMA */}
      <section>
        <h2 className="text-base font-bold text-gray-900 mb-3">Profils VMA Individuels</h2>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="h-[300px]">
            <Bar data={barData} options={barOptions} />
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">
            Variable d'entree du moteur de calcul : VMA x Pourcentage cible
          </p>
        </div>
      </section>
    </div>
  );
}
