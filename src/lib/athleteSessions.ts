/**
 * Filtrage centralisé des sessions visibles par un athlète.
 *
 * Règle de priorité (fix bug "Amandine", renforcée par décision David 06/2026) :
 * Quand un athlète appartient à une préparation spécifique active, il voit
 * UNIQUEMENT les séances rattachées à cette prépa (+ ses séances perso). Tout
 * le programme général du club est masqué par défaut : aussi bien les séances
 * de son groupe QUE les séances globales ("pour tous"). Le toggle
 * `includeGroupSessions` réaffiche ce programme en mode secondaire (dégradé).
 *
 * Note : on a d'abord laissé les séances globales toujours visibles (option a),
 * mais David a demandé que la prépa soit exclusive — un athlète en prépa ne
 * doit pas voir l'entraînement général du club, pour ne pas brouiller son plan.
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

    // 3. Séances du programme général du club : soit globales (group_id null,
    //    « pour tous »), soit celles du groupe de l'athlète. Les séances d'un
    //    AUTRE groupe ne le concernent jamais.
    const isGlobal = !s.group_id;
    const isMyGroup = s.group_id === user.group_id;
    if (!isGlobal && !isMyGroup) continue;

    if (hasActivePrep) {
      // RÈGLE DE PRIORITÉ (décision David, 06/2026) : un athlète en prépa
      // spécifique ne voit QUE sa prépa. Tout le programme général du club
      // (groupe ET séances globales) est masqué par défaut, pour ne pas
      // brouiller son plan. Le toggle "Voir aussi le programme du groupe" les
      // réaffiche en mode secondaire (dégradé) pour ceux qui veulent jeter
      // un œil.
      if (includeGroup) {
        out.push({
          session: s,
          fromPreparation: false,
          fromGroup: true,
          fromPersonal: false,
          isSecondary: true,
        });
      }
      // sinon : skip silencieux
    } else {
      // Pas de prépa active → programme du club affiché normalement
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
