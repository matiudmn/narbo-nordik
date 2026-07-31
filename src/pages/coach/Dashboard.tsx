import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, isThisWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TrendingUp, Users, MessageSquare, CheckCircle, AlertTriangle, ChevronRight, Settings, Paperclip, FileText, Star, Sparkles } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { getAttachmentUrl } from '../../lib/storage';
import { supabase } from '../../lib/supabase';
import { getSessionCode } from '../../lib/calculations';
import { computeRiskScores, topRiskAthletes } from '../../lib/risk';
import { CoachHeroCTA } from '../../components/coach/CoachHeroCTA';
import { RiskScoreCard } from '../../components/coach/RiskScoreCard';
import { KpiTrioCard } from '../../components/shared/KpiTrioCard';
import { Badge } from '../../components/ui';
import type { BadgeTone } from '../../components/ui';
import type { ObjectiveReached, Sensations } from '../../types';

const OBJECTIVE_META: Record<ObjectiveReached, { label: string; tone: BadgeTone }> = {
  oui: { label: 'Objectif atteint', tone: 'success' },
  partiel: { label: 'Objectif partiel', tone: 'warning' },
  non: { label: 'Objectif non atteint', tone: 'danger' },
};

const SENSATION_META: Record<Sensations, { label: string; tone: BadgeTone }> = {
  excellentes: { label: 'Sensations excellentes', tone: 'success' },
  bonnes: { label: 'Bonnes sensations', tone: 'info' },
  mauvaises: { label: 'Sensations difficiles', tone: 'danger' },
};

// Set fermé de réactions positives (garde-fou : pas de pouce bas).
const REACTIONS = ['👏', '🔥', '💪', '🎯'];

export default function Dashboard() {
  const { user } = useAuth();
  const { sessions, validations, users, groups, validationReactions, toggleValidationReaction, clubSettings, setFeaturedValidation } = useData();

  const members = useMemo(() => users.filter(u => !u.is_super_admin && u.role !== 'coach'), [users]);

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
        if (!v.feedback && !v.attachment_path && !v.objective_reached && !v.sensations) return false;
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

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleAiSummary = async () => {
    setAiLoading(true);
    setAiError(null);
    const weekSessionIds = new Set(
      sessions.filter(s => !s.is_personal && isThisWeek(new Date(s.date), { weekStartsOn: 1 })).map(s => s.id)
    );
    const firstNameCounts = members.reduce<Record<string, number>>((acc, m) => { acc[m.firstname] = (acc[m.firstname] || 0) + 1; return acc; }, {});
    const week = members.map(m => {
      const vs = validations.filter(v => v.user_id === m.id && v.status === 'done' && weekSessionIds.has(v.session_id));
      const sensations = { excellentes: 0, bonnes: 0, mauvaises: 0 };
      const objectif = { oui: 0, partiel: 0, non: 0 };
      vs.forEach(v => {
        if (v.sensations) sensations[v.sensations]++;
        if (v.objective_reached) objectif[v.objective_reached]++;
      });
      return {
        // Nom de famille seulement si le prénom est partagé par plusieurs athletes (désambiguïsation pour le coach).
        nom: firstNameCounts[m.firstname] > 1 ? `${m.firstname} ${m.lastname}` : m.firstname,
        groupe: m.group_id ? (groups.find(g => g.id === m.group_id)?.name ?? null) : null,
        faites: vs.length,
        objectif,
        sensations,
        retours: vs.map(v => v.feedback).filter(Boolean).slice(0, 5),
      };
    });
    try {
      const { data, error } = await supabase.functions.invoke('ai-coach-summary', { body: { week } });
      if (error || data?.error) setAiError("Le résumé n'a pas pu être généré. Réessaie dans un instant.");
      else setAiSummary((data?.summary ?? '').replace(/\*\*/g, '').replace(/^#{1,6}\s*/gm, ''));
    } catch {
      setAiError("Le résumé n'a pas pu être généré. Réessaie dans un instant.");
    } finally {
      setAiLoading(false);
    }
  };

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

      {/* Résumé hebdo IA */}
      <section className="bg-white rounded-xl border border-neutral-100 p-4" aria-labelledby="ai-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="ai-heading" className="flex items-center gap-2 font-bold text-neutral-900">
            <Sparkles size={18} className="text-accent" aria-hidden="true" />
            Résumé de la semaine
          </h2>
          <button
            type="button"
            onClick={handleAiSummary}
            disabled={aiLoading}
            className="text-sm font-medium px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light disabled:opacity-60 transition-colors flex-shrink-0"
          >
            {aiLoading ? 'Génération…' : aiSummary ? 'Régénérer' : 'Générer'}
          </button>
        </div>
        {!aiSummary && !aiLoading && !aiError && (
          <p className="text-sm text-neutral-400 mt-2">Une synthèse IA des retours de tes athletes cette semaine (qui décroche, qui est en forme, qui recontacter).</p>
        )}
        {aiError && <p className="text-sm text-danger-600 mt-2">{aiError}</p>}
        {aiSummary && <p className="text-sm text-neutral-700 whitespace-pre-wrap mt-2">{aiSummary}</p>}
      </section>

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
                  {(item.objective_reached || item.sensations) && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {item.objective_reached && (
                        <Badge tone={OBJECTIVE_META[item.objective_reached].tone}>
                          {OBJECTIVE_META[item.objective_reached].label}
                        </Badge>
                      )}
                      {item.sensations && (
                        <Badge tone={SENSATION_META[item.sensations].tone}>
                          {SENSATION_META[item.sensations].label}
                        </Badge>
                      )}
                    </div>
                  )}
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
                  {user && (
                    <div className="flex items-center gap-1.5 mt-2">
                      {REACTIONS.map(emoji => {
                        const count = validationReactions.filter(r => r.validation_id === item.id && r.emoji === emoji).length;
                        const mine = validationReactions.some(r => r.validation_id === item.id && r.emoji === emoji && r.author_id === user.id);
                        return (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => toggleValidationReaction(item.id, emoji, user.id)}
                            aria-pressed={mine}
                            aria-label={mine ? `Retirer ${emoji}` : `Réagir ${emoji}`}
                            className={[
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm border transition-colors',
                              mine ? 'bg-accent/15 border-accent' : 'bg-neutral-50 border-neutral-200 hover:bg-neutral-100',
                            ].join(' ')}
                          >
                            <span aria-hidden="true">{emoji}</span>
                            {count > 0 && <span className="text-xs font-medium text-neutral-600">{count}</span>}
                          </button>
                        );
                      })}
                      {(() => {
                        const isFeatured = clubSettings?.featured_validation_id === item.id;
                        return (
                          <button
                            type="button"
                            onClick={() => setFeaturedValidation(isFeatured ? null : item.id)}
                            aria-pressed={isFeatured}
                            title="Coup de coeur de la semaine"
                            className={[
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ml-auto',
                              isFeatured ? 'bg-warning-100 border-warning-500 text-warning-700' : 'bg-neutral-50 border-neutral-200 text-neutral-500 hover:bg-neutral-100',
                            ].join(' ')}
                          >
                            <Star size={13} fill={isFeatured ? 'currentColor' : 'none'} aria-hidden="true" />
                            Coup de coeur
                          </button>
                        );
                      })()}
                    </div>
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
