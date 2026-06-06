import { startOfWeek, subWeeks } from 'date-fns';

/**
 * Série d'assiduité hebdomadaire : nombre de semaines consécutives (lundi -> dimanche)
 * comptant au moins une séance validée, en remontant depuis la semaine en cours.
 *
 * Tolérant volontairement (décision produit, cf. PRD compte-rendu de séance) :
 * la granularité est la SEMAINE et non le jour (on ne pousse pas au surentraînement),
 * et si la semaine en cours n'a pas encore de séance validée, on ne casse pas la série :
 * on démarre le décompte à la semaine précédente.
 *
 * Note : les "jokers repos" et la tolérance aux semaines de récup de prépa sont des
 * raffinements prévus en phase ultérieure, non implémentés ici.
 */
export function computeWeeklyStreak(doneDates: Date[], today: Date): number {
  const weekKey = (d: Date) => startOfWeek(d, { weekStartsOn: 1 }).getTime();
  const weeks = new Set(doneDates.map(weekKey));
  if (weeks.size === 0) return 0;

  let cursor = startOfWeek(today, { weekStartsOn: 1 });
  // Semaine en cours encore vide : on démarre à la semaine précédente (pas de rupture en milieu de semaine).
  if (!weeks.has(cursor.getTime())) {
    cursor = startOfWeek(subWeeks(cursor, 1), { weekStartsOn: 1 });
  }

  let streak = 0;
  while (weeks.has(cursor.getTime())) {
    streak++;
    cursor = startOfWeek(subWeeks(cursor, 1), { weekStartsOn: 1 });
  }
  return streak;
}
