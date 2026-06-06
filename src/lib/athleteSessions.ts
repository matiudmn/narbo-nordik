/**
 * Filtrage centralisé des sessions visibles par un athlète.
 *
 * Règle de priorité (fix bug "Amandine") :
 * Quand un athlète appartient à une préparation spécifique active, il voit
 * UNIQUEMENT les séances rattachées à cette prépa. Les séances de son groupe
 * club sont masquées par défaut, sauf si le toggle `includeGroupSessions`
 * est activé (auquel cas elles sont marquées comme secondaires pour
 * permettre un style dégradé côté UI).
 *
 * Avant ce fix, plusieurs vues répétaient le même filtre sans cette règle
 * (Home weekly, Suivi, TrainingHistory, Directory, AthleteDetail) et un
 * athlète en prépa voyait DEUX séances par jour, ce qui causait confusion
 * et abandons (le coach David a remonté le cas d'Amandine le 26 mai 2026).
 *
 * Cette lib est la source de vérité unique. Tout filtre de sessions athlète
 * dans le projet doit passer par ici.
 */

import type { Session, UserPreparation } from '../types';

export interface AthleteSessionFilterOpts {
  /**
   * Si vrai, les séances du groupe club sont visibles ET marquées comme
   * secondaires même quand l'athlète a une prépa active. Sert le toggle
   * "Voir aussi le programme du groupe".
   *
   * Par défaut : false (règle de priorité stricte).
   */
  includeGroupSessions?: boolean;
}

/** Métadonnée attachée à chaque session retournée. */
export interface FilteredSession {
  session: Session;
  /** Vient d'une préparation à laquelle l'athlète est inscrit. */
  fromPreparation: boolean;
  /** Vient du groupe club de l'athlète (ou globale sans groupe). */
  fromGroup: boolean;
  /** Séance personnelle créée par l'athlète. */
  fromPersonal: boolean;
  /**
   * L'athlète a une prépa active ET cette séance vient du groupe.
   * À styliser en mode dégradé côté UI (opacité réduite, badge "Programme groupe").
   */
  isSecondary: boolean;
}

interface MinimalUser {
  id: string;
  group_id: string | null;
}

/**
 * Filtre les sessions visibles par un athlète selon la règle de priorité,
 * en retournant chaque session enrichie de métadonnées d'origine.
 */
export function filterSessionsForAthlete(
  user: MinimalUser,
  sessions: Session[],
  userPrepIds: string[],
  opts: AthleteSessionFilterOpts = {}
): FilteredSession[] {
  const hasActivePrep = userPrepIds.length > 0;
  const includeGroup = opts.includeGroupSessions ?? false;

  const out: FilteredSession[] = [];

  for (const s of sessions) {
    // 1. Séances personnelles : uniquement le créateur
    if (s.is_personal) {
      if (s.created_by === user.id) {
        out.push({
          session: s,
          fromPreparation: false,
          fromGroup: false,
          fromPersonal: true,
          isSecondary: false,
        });
      }
      continue;
    }

    // 2. Séances liées à une préparation : uniquement si l'athlète est inscrit
    if (s.preparation_id) {
      if (userPrepIds.includes(s.preparation_id)) {
        out.push({
          session: s,
          fromPreparation: true,
          fromGroup: false,
          fromPersonal: false,
          isSecondary: false,
        });
      }
      continue;
    }

    // 3. Séances groupe (ou globales sans group_id)
    const matchesGroup = !s.group_id || s.group_id === user.group_id;
    if (!matchesGroup) continue;

    if (hasActivePrep) {
      // RÈGLE DE PRIORITÉ : prépa active → on masque le programme groupe
      // sauf si le toggle est activé (auquel cas la séance est secondaire)
      if (includeGroup) {
        out.push({
          session: s,
          fromPreparation: false,
          fromGroup: true,
          fromPersonal: false,
          isSecondary: true,
        });
      }
      // sinon : skip silencieux (c'est le fix)
    } else {
      // Pas de prépa active → séance groupe affichée normalement
      out.push({
        session: s,
        fromPreparation: false,
        fromGroup: true,
        fromPersonal: false,
        isSecondary: false,
      });
    }
  }

  return out;
}

/**
 * Helper pour extraire les preparation_id auxquels appartient un athlète,
 * à partir du tableau global userPreparations.
 */
export function getUserPrepIds(
  userId: string,
  userPreparations: UserPreparation[]
): string[] {
  return userPreparations
    .filter(up => up.user_id === userId)
    .map(up => up.preparation_id);
}
