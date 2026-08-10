/**
 * Attribution des séances aux groupes, vue coach.
 *
 * `sessions.group_id` n'est renseigné que depuis mai 2026 : les séances
 * antérieures (dont les 46 séances de mars 2026, premier mois de l'app) ont
 * group_id NULL alors qu'elles ont bien été courues par les trois groupes. La
 * seule trace exploitable est `session_validations` : le groupe du validant.
 *
 * Deux règles distinctes, à ne pas confondre :
 * - Attribution (quels groupes ont eu cette séance au programme) : déduite de
 *   TOUTES les validations, quel que soit leur statut. Une validation
 *   `missed` prouve que la séance était bien au programme du groupe, au même
 *   titre qu'une validation `done`.
 * - Compteurs de participation (combien d'athlètes l'ont faite) : seules les
 *   validations `done` comptent.
 *
 * Limite assumée : le groupe retenu est le groupe ACTUEL de l'athlète, la base
 * ne conservant pas d'historique d'appartenance. Un athlète ayant changé de
 * groupe depuis est donc compté dans son groupe d'aujourd'hui, indépendamment
 * de `session.group_id`.
 */

import type { Session, SessionValidation } from '../types';

/** Clé de regroupement des participations d'athlètes sans groupe. */
export const NO_GROUP_KEY = '__sans_groupe__';

interface MinimalUser {
  id: string;
  group_id: string | null;
}

/** Rattachement d'une séance à un ou plusieurs groupes. */
export type GroupAttribution =
  /** `sessions.group_id` renseigné : rattachement porté par la donnée. */
  | 'explicite'
  /** `group_id` NULL mais des validations existent : rattachement déduit. */
  | 'reconstituee'
  /** Aucun rattachement déductible : séance « pour tous ». */
  | 'aucune';

export interface ResolvedGroups {
  groupIds: string[];
  attribution: GroupAttribution;
}

export interface SessionParticipation {
  session: Session;
  /** Participations (validations `done`) par group_id, NO_GROUP_KEY si l'athlète n'a pas de groupe. */
  doneByGroup: Record<string, number>;
  doneTotal: number;
  /**
   * Groupes rattachés à la séance : `session.group_id` s'il est renseigné,
   * sinon les groupes ayant au moins une validation (`done` ou `missed`).
   */
  groupIds: string[];
  /** `groupIds` vient des validations et non de `session.group_id`. */
  groupsInferred: boolean;
}

/**
 * Résout le ou les groupes d'une séance.
 *
 * Les séances antérieures à mai 2026 ont toutes `group_id` NULL sans être
 * globales pour autant (le rattachement n'existait pas encore). On le
 * reconstitue par les groupes des athlètes qui ont une validation sur la
 * séance : toutes issues confondues, car une séance marquée « manquée » était
 * au programme du groupe au même titre qu'une séance faite.
 */
export function resolveSessionGroups(
  session: Session,
  sessionValidations: SessionValidation[],
  groupIdByUserId: Map<string, string | null>,
): ResolvedGroups {
  if (session.group_id) return { groupIds: [session.group_id], attribution: 'explicite' };

  const ids = new Set<string>();
  for (const validation of sessionValidations) {
    const groupId = groupIdByUserId.get(validation.user_id);
    if (groupId) ids.add(groupId);
  }
  if (ids.size === 0) return { groupIds: [], attribution: 'aucune' };
  return { groupIds: [...ids], attribution: 'reconstituee' };
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
    const sessionValidations = validationsBySession.get(session.id) ?? [];
    const resolved = resolveSessionGroups(session, sessionValidations, groupByUser);

    const doneByGroup: Record<string, number> = {};
    let doneTotal = 0;

    sessionValidations.forEach((v) => {
      if (v.status !== 'done') return;
      // Athlète inconnu (compte supprimé) ou sans groupe : même colonne.
      const key = groupByUser.get(v.user_id) ?? NO_GROUP_KEY;
      doneByGroup[key] = (doneByGroup[key] ?? 0) + 1;
      doneTotal++;
    });

    return {
      session,
      doneByGroup,
      doneTotal,
      groupIds: resolved.groupIds,
      groupsInferred: resolved.attribution === 'reconstituee',
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
