import { endOfDay, isWithinInterval, startOfDay } from 'date-fns';
import type { Session, SessionValidation, UserPreparation } from '../types';
import { filterSessionsForAthlete, getUserPrepIds } from './athleteSessions';

/**
 * Régularité (ex-« assiduité ») : calcul UNIQUE pour toute l'app.
 *
 * Règles (demande coach David, 08/2026) :
 *  - on ne compte que les séances du club (jamais les séances perso, sinon le
 *    ratio dépend de qui regarde à cause de la RLS) ;
 *  - on ne compte que les séances postérieures à l'arrivée de l'athlète
 *    (created_at du profil : un nouveau n'est pas « absent » sur la saison
 *    qu'il n'a pas faite) ;
 *  - on ne compte jamais les séances à venir (borne haute = fin de journée) ;
 *  - aucun dénominateur => rate null (à afficher « - », jamais « 0 % »).
 */

interface AttendanceUser {
  id: string;
  group_id: string | null;
  created_at: string;
}

export interface AttendanceResult {
  done: number;
  total: number;
  /** Pourcentage arrondi, ou null si aucune séance à compter. */
  rate: number | null;
}

/** Début de journée de l'arrivée de l'athlète dans l'app. */
export function getAthleteStartDate(user: Pick<AttendanceUser, 'created_at'>): Date {
  return startOfDay(new Date(user.created_at));
}

/** L'athlète était-il déjà au club à cette date ? (le jour même compte) */
export function hasJoinedBefore(user: Pick<AttendanceUser, 'created_at'>, date: Date | string): boolean {
  return getAthleteStartDate(user) <= new Date(date);
}

export function computeAttendance(
  user: AttendanceUser,
  sessions: Session[],
  validations: SessionValidation[],
  userPrepIds: string[],
  range: { start: Date; end: Date },
  now: Date = new Date()
): AttendanceResult {
  const start = new Date(Math.max(range.start.getTime(), getAthleteStartDate(user).getTime()));
  const end = new Date(Math.min(range.end.getTime(), endOfDay(now).getTime()));
  if (start > end) return { done: 0, total: 0, rate: null };

  const eligible = filterSessionsForAthlete(user, sessions, userPrepIds)
    .filter(f => !f.fromPersonal)
    .map(f => f.session)
    .filter(s => isWithinInterval(new Date(s.date), { start, end }));

  if (eligible.length === 0) return { done: 0, total: 0, rate: null };

  const doneIds = new Set(
    validations.filter(v => v.user_id === user.id && v.status === 'done').map(v => v.session_id)
  );
  const done = eligible.filter(s => doneIds.has(s.id)).length;
  return { done, total: eligible.length, rate: Math.round((done / eligible.length) * 100) };
}

/**
 * Participation collective : somme des régularités individuelles sur la même
 * période. Passe par computeAttendance athlète par athlète, donc hérite de
 * TOUTES ses règles (prépa exclusive, séance d'un autre groupe qui ne compte
 * pas, séances perso exclues, arrivée de l'athlète, pas de séance à venir).
 *
 * Ne jamais réimplémenter l'éligibilité ici : c'est cette duplication qui avait
 * fait diverger la page Club, où un coach était compté attendu sur toutes les
 * séances de tous les groupes (corrigé le 22/08/2026), puis où chaque séance de
 * préparation spécifique comptait le club entier au dénominateur alors que
 * seuls ses inscrits la voient.
 */
export function computeClubParticipation(
  athletes: AttendanceUser[],
  sessions: Session[],
  validations: SessionValidation[],
  userPreparations: UserPreparation[],
  range: { start: Date; end: Date },
  now: Date = new Date()
): AttendanceResult {
  let done = 0;
  let total = 0;
  for (const athlete of athletes) {
    const r = computeAttendance(
      athlete,
      sessions,
      validations,
      getUserPrepIds(athlete.id, userPreparations),
      range,
      now
    );
    done += r.done;
    total += r.total;
  }
  return { done, total, rate: total > 0 ? Math.round((done / total) * 100) : null };
}

/** « 12/15 » pour l'affichage compact ; « - » sans séance. */
export function formatAttendance(r: AttendanceResult): string {
  return r.total === 0 ? '-' : `${r.done}/${r.total}`;
}
