import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, isThisWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TrendingUp, Users, MessageSquare, CheckCircle, AlertTriangle, ChevronRight, Settings, Paperclip, FileText } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { SUPER_ADMIN_EMAIL } from '../../lib/constants';
import { getAttachmentUrl } from '../../lib/storage';
import { getSessionCode } from '../../lib/calculations';
import { computeRiskScores, topRiskAthletes } from '../../lib/risk';
import { CoachHeroCTA } from '../../components/coach/CoachHeroCTA';
import { RiskScoreCard } from '../../components/coach/RiskScoreCard';
import { KpiTrioCard } from '../../components/shared/KpiTrioCard';

export default function Dashboard() {
  const { user } = useAuth();
  const { sessions, validations, users } = useData();

  const members = useMemo(() => users.filter(u => u.email !== SUPER_ADMIN_EMAIL && u.role !== 'coach'), [users]);

  const stats = useMemo(() => {
    const weekSessions = sessions.filter(s => !s.is_personal && isThisWeek(new Date(s.date), { weekStartsOn: 1 }));
    const weekSessionIds = weekSessions.map(s => s.id);
    const weekValidations = validations.filter(v => weekSessionIds.includes(v.session_id));
    const doneCount = weekValidations.filter(v => v.status === 'done').length;
    const totalExpected = weekSessions.length * members.length;

    return {
      completionRate: totalExpected > 0 ? Math.round((doneCount / totalExpected) * 100) : 0,
      sessionsThisWeek: weekSessions.length,
      memberCount: members.length,
    };
  }, [sessions, validations, members]);

  const riskScores = useMemo(
    () => topRiskAthletes(computeRiskScores(members, sessions, validations), 5),
    [members, sessions, validations]
  );

  const recentFeedback = useMemo(() => {
    return validations
      .filter(v => {
        if (!v.feedback && !v.attachment_path) return false;
        const s = sessions.find(s => s.id === v.session_id);
        if (!s || s.is_personal) return false;
        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map(v => {
        const athlete = users.find(u => u.id === v.user_id);
        const session = sessions.find(s => s.id === v.session_id);
        return { ...v, athlete, session };
      });
  }, [validations, users, sessions]);

  return (
    <div className="py-4 space-y-4">
      {/* Header avec greeting */}
      <header>
        <h1 className="text-h1 font-display font-bold text-neutral-900">
          Bonjour {user?.firstname ?? 'coach'}
        </h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Semaine du {format(new Date(), 'd MMMM', { locale: fr })}
        </p>
      </header>

      {/* CTA primaire */}
      <CoachHeroCTA />

      {/* KPIs harmonisés */}
      <KpiTrioCard
        kpis={[
          {
            value: `${stats.completionRate}%`,
            label: 'Réalisation semaine',
            tone: 'primary',
            icon: <TrendingUp size={20} aria-hidden="true" />,
          },
          {
            value: stats.sessionsThisWeek,
            label: 'Séances cette semaine',
            tone: 'accent',
            icon: <CheckCircle size={20} aria-hidden="true" />,
          },
          {
            value: stats.memberCount,
            label: 'Membres',
            tone: 'success',
            icon: <Users size={20} aria-hidden="true" />,
          },
        ]}
      />

      {/* Quick action — paramètres */}
      <Link
        to="/coach/settings"
        className="flex items-center gap-3 bg-white rounded-xl border border-neutral-100 p-4 hover:shadow-card-hover transition-shadow"
      >
        <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center">
          <Settings size={18} className="text-primary" aria-hidden="true" />
        </div>
        <span className="flex-1 text-sm font-medium text-neutral-900">Paramètres du club</span>
        <ChevronRight size={16} className="text-neutral-300" aria-hidden="true" />
      </Link>

      {/* Score de risque + Feedback côte à côte sur desktop */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
        {/* Athlètes à risque */}
        {riskScores.length > 0 && (
          <section className="bg-white rounded-xl border border-neutral-100 p-4" aria-labelledby="risk-heading">
            <h2 id="risk-heading" className="flex items-center gap-2 font-bold text-neutral-900 mb-3">
              <AlertTriangle size={18} className="text-warning-600" aria-hidden="true" />
              Athlètes à rappeler
              <span className="text-xs font-medium text-neutral-400">({riskScores.length})</span>
            </h2>
            <div className="space-y-2">
              {riskScores.map((rs) => (
                <RiskScoreCard key={rs.athlete.id} riskScore={rs} />
              ))}
            </div>
            <Link
              to="/directory"
              className="block text-center text-sm text-primary font-medium mt-3 hover:underline"
            >
              Voir tous les athlètes →
            </Link>
          </section>
        )}

        {/* Recent feedback */}
        <section className="bg-white rounded-xl border border-neutral-100 p-4" aria-labelledby="feedback-heading">
          <h2 id="feedback-heading" className="flex items-center gap-2 font-bold text-neutral-900 mb-3">
            <MessageSquare size={18} className="text-primary" aria-hidden="true" />
            Derniers retours athlètes
          </h2>

          {recentFeedback.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-4">Aucun retour pour le moment.</p>
          ) : (
            <div className="space-y-3">
              {recentFeedback.map(item => (
                <div key={item.id} className="border-l-2 border-primary/20 pl-3">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-neutral-900">
                      {item.athlete?.firstname} {item.athlete?.lastname}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {format(new Date(item.created_at), 'dd/MM', { locale: fr })}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mb-0.5">
                    {item.session?.title}
                    {item.session && (
                      <span className="text-neutral-400 ml-1">{getSessionCode(item.session, sessions)}</span>
                    )}
                  </p>
                  {item.feedback && <p className="text-sm text-neutral-700 italic">« {item.feedback} »</p>}
                  {item.attachment_path && (
                    <a
                      href={getAttachmentUrl(item.attachment_path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                    >
                      {item.attachment_type?.startsWith('image/') ? <Paperclip size={12} aria-hidden="true" /> : <FileText size={12} aria-hidden="true" />}
                      {item.attachment_type?.startsWith('image/') ? 'Photo jointe' : 'PDF joint'}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
