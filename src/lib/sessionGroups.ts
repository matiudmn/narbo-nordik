/**
 * Attribution des séances aux groupes, vue coach.
 *
 * `sessions.group_id` n'est renseigné que depuis mai 2026 : les séances
 * antérieures (dont les 46 séances de mars 2026, premier mois de l'app) ont
 * group_id NULL alors qu'elles ont bien été courues par les trois groupes. La
 * seule trace exploitable est `session_validations` : le groupe du validant.
 *
 * Règle appliquée ici : la participation par groupe est TOUJOURS déduite des
 * validations (c'est la réalité du terrain), `group_id` ne servant qu'à savoir
 * si l'audience a été posée explicitement par le coach ou reconstituée.
 *
 * Limite assumée : le groupe retenu est le groupe ACTUEL de l'athlète, la base
 * ne conservant pas d'historique d'appartenance. Un athlète ayant changé de
 * groupe depuis est donc compté dans son groupe d'aujourd'hui.
 */

import type { Session, SessionValidation } from '../types';

/** Clé de regroupement des participations d'athlètes sans groupe. */
export const NO_GROUP_KEY = '__sans_groupe__';

interface MinimalUser {
  id: string;
  group_id: string | null;
}

export interface SessionParticipation {
  session: Session;
  /** Participations (validations `done`) par group_id, NO_GROUP_KEY si l'athlète n'a pas de groupe. */
  doneByGroup: Record<string, number>;
  doneTotal: number;
  /**
   * Groupes rattachés à la séance : `session.group_id` s'il est renseigné,
   * sinon les groupes ayant au moins une participation.
   */
  groupIds: string[];
  /** `groupIds` vient des validations et non de `session.group_id`. */
  groupsInferred: boolean;
}

export function computeSessionParticipation(
  sessions: Session[],
  validations: SessionValidation[],
  users: MinimalUser[],
): SessionParticipation[] {
  const groupByUser = new Map(users.map((u) => [u.id, u.group_id]));

  const validationsBySession = new Map<string, SessionValidation[]>();
  validations.forEach((v) => {
    const list = validationsBySession.get(v.session_id);
    if (list) list.push(v);
    else validationsBySession.set(v.session_id, [v]);
  });

  return sessions.map((session) => {
    const doneByGroup: Record<string, number> = {};
    let doneTotal = 0;

    (validationsBySession.get(session.id) ?? []).forEach((v) => {
      if (v.status !== 'done') return;
      // Athlète inconnu (compte supprimé) ou sans groupe : même colonne.
      const key = groupByUser.get(v.user_id) ?? NO_GROUP_KEY;
      doneByGroup[key] = (doneByGroup[key] ?? 0) + 1;
      doneTotal++;
    });

    const inferredGroupIds = Object.keys(doneByGroup).filter((k) => k !== NO_GROUP_KEY);

    return {
      session,
      doneByGroup,
      doneTotal,
      groupIds: session.group_id ? [session.group_id] : inferredGroupIds,
      groupsInferred: !session.group_id && inferredGroupIds.length > 0,
    };
  });
}

/** Totaux de participation par groupe sur un ensemble de séances (une colonne du tableau). */
export function sumParticipationByGroup(rows: SessionParticipation[]): Record<string, number> {
  const totals: Record<string, number> = {};
  rows.forEach((row) => {
    Object.entries(row.doneByGroup).forEach(([key, count]) => {
      totals[key] = (totals[key] ?? 0) + count;
    });
  });
  return totals;
}
