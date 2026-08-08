import { useCallback, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  User, Session, SessionValidation, RaceResult, RaceNordik, SessionNordik,
  ValidationReaction, Group, SpecificPreparation, UserPreparation, ClubSettings,
} from '../../types';
import { supabase } from '../../lib/supabase';
import {
  toSession, toValidation, toRaceResult, toRaceNordik, toSessionNordik,
  toValidationReaction, toPreparation, toClubSettings, toUser,
} from './rows';

// Cartographie des groupes de chargement (mesuree par grep sur `useData()`
// puis rattachement aux routes de App.tsx) :
//
//   BLOQUANT (Home, "/", ecran d'atterrissage apres connexion, seule route
//   qui lit `loading`) : sessions, validations, users, groups, preparations,
//   userPreparations, club_settings.
//   NON BLOQUANT (absentes de "/") : raceResults, raceNordiks,
//   sessionNordiks, validationReactions.
//
// Aucune collection n'est coach-only : les 5 pages coach (Dashboard,
// SessionEditor, Import, QuickAddSession, Settings) ne consomment aucune
// collection hors des routes partagees. Le seul axe reellement differencie
// par role est `users` (RPC vs GRANT colonne), deja gere par isStaff
// ci-dessous. club_settings rejoint le lot bloquant : son fetch partait
// auparavant APRES le Promise.all des 10 autres collections (un aller-retour
// reseau serialise sur chaque boot et chaque refreshAll), pour une table
// d'une ligne dont Home a besoin immediatement
// (getRacePaces(clubSettings?.race_paces)) : le laisser hors du groupe
// bloquant ferait peindre Home avec des allures par defaut puis re-peindre
// (scintillement) des que le fetch tardif arrive.

// Colonnes de `users` accordees a un athlete (role authenticated) depuis la
// migration 20260731120000 (cf. UserRowLike dans rows.ts, qui code la meme
// frontiere cote types). email/phone/license_number/birth_date/
// notification_preferences n'en font plus partie : un SELECT direct qui les
// demanderait echouerait en 42501. Seul get_own_profile() (soi-meme) et
// get_users_for_coach() (coach/super-admin, cf. fetchAll ci-dessous) les
// renvoient encore.
// Const litterale obligatoire (pas d'annotation `: string`) : supabase-js
// infere la forme de la ligne depuis le litteral de cette chaine (cf. risque
// 2 du lot data-layer-v2).
const ATHLETE_USER_COLUMNS = 'id, role, firstname, lastname, vma, vma_history, group_id, photo_url, is_public, created_at, is_super_admin';

interface DataBootstrapSetters {
  setSessions: Dispatch<SetStateAction<Session[]>>;
  setValidations: Dispatch<SetStateAction<SessionValidation[]>>;
  setRaceResults: Dispatch<SetStateAction<RaceResult[]>>;
  setRaceNordiks: Dispatch<SetStateAction<RaceNordik[]>>;
  setSessionNordiks: Dispatch<SetStateAction<SessionNordik[]>>;
  setValidationReactions: Dispatch<SetStateAction<ValidationReaction[]>>;
  setGroups: Dispatch<SetStateAction<Group[]>>;
  setUsers: Dispatch<SetStateAction<User[]>>;
  setPreparations: Dispatch<SetStateAction<SpecificPreparation[]>>;
  setUserPreparations: Dispatch<SetStateAction<UserPreparation[]>>;
  setClubSettings: Dispatch<SetStateAction<ClubSettings | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
}

/**
 * Bootstrap des donnees a la connexion : les 11 requetes partent toutes en
 * meme temps (deux groupes de Promise.all lances sans await intermediaire),
 * mais seul le groupe bloquant est attendu avant de lever `loading` ; le
 * groupe non bloquant continue de renseigner son state en arriere-plan (cf.
 * cartographie en tete de module). Remise a zero a la deconnexion. Isole
 * dans son propre hook car c'est le seul endroit qui a besoin de la
 * totalite des setters du provider.
 */
export function useDataBootstrap(authUser: User | null, setters: DataBootstrapSetters) {
  const {
    setSessions, setValidations, setRaceResults, setRaceNordiks, setSessionNordiks,
    setValidationReactions, setGroups, setUsers, setPreparations, setUserPreparations,
    setClubSettings, setLoading,
  } = setters;

  const fetchAll = useCallback(async () => {
    // Un coach (ou le super-admin) recoit les lignes completes de tout le club
    // via get_users_for_coach() (RPC SECURITY DEFINER) ; un athlete recoit la
    // liste club mais sans les colonnes PII, retirees par le GRANT de
    // 20260731120000 (sa propre valeur reste disponible via useAuth().user,
    // alimente par get_own_profile()).
    const isStaff = authUser?.role === 'coach' || authUser?.is_super_admin === true;
    const usersQuery = isStaff
      ? supabase.rpc('get_users_for_coach')
      : supabase.from('users').select(ATHLETE_USER_COLUMNS);

    // Groupe bloquant : requis par Home ("/"), attendu avant de lever
    // `loading`. club_settings y est inclus (cf. cartographie en tete de
    // module) ; la tolerance PGRST116 (aucune ligne) est preservee.
    const blocking = Promise.all([
      supabase.from('sessions').select('*').order('date'),
      supabase.from('session_validations').select('*'),
      supabase.from('groups').select('*'),
      usersQuery,
      supabase.from('specific_preparations').select('*').order('event_date'),
      supabase.from('user_preparations').select('*'),
      supabase.from('club_settings').select('*').limit(1).maybeSingle(),
    ]);
    // Groupe non bloquant : absent de Home, continue de renseigner son state
    // en arriere-plan sans retarder la levee de `loading`.
    const nonBlocking = Promise.all([
      supabase.from('race_results').select('*'),
      supabase.from('race_nordiks').select('*'),
      supabase.from('session_nordiks').select('*'),
      supabase.from('validation_reactions').select('*'),
    ]);

    const [s, v, g, u, p, up, cs] = await blocking;
    if (s.data) setSessions(s.data.map(toSession));
    if (v.data) setValidations(v.data.map(toValidation));
    if (g.data) setGroups(g.data);
    if (u.data) setUsers(u.data.map(toUser));
    if (p.data) setPreparations(p.data.map(toPreparation));
    if (up.data) setUserPreparations(up.data);
    if (cs.data) setClubSettings(toClubSettings(cs.data));
    else if (cs.error && cs.error.code !== 'PGRST116') console.error('club_settings fetch error:', cs.error.message);

    nonBlocking.then(([rr, rn, sn, vr]) => {
      if (rr.data) setRaceResults(rr.data.map(toRaceResult));
      if (rn.data) setRaceNordiks(rn.data.map(toRaceNordik));
      if (sn.data) setSessionNordiks(sn.data.map(toSessionNordik));
      if (vr.data) setValidationReactions(vr.data.map(toValidationReaction));
    });
  }, [
    authUser?.role, authUser?.is_super_admin,
    setSessions, setValidations, setRaceResults, setRaceNordiks, setSessionNordiks,
    setGroups, setUsers, setPreparations, setUserPreparations, setValidationReactions, setClubSettings,
  ]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await fetchAll();
    setLoading(false);
  }, [fetchAll, setLoading]);

  useEffect(() => {
    if (authUser) {
      // Bootstrap des données à la connexion (toggle loading sync assumé).
      refreshAll();
    } else {
      setSessions([]);
      setValidations([]);
      setRaceResults([]);
      setRaceNordiks([]);
      setSessionNordiks([]);
      setGroups([]);
      setUsers([]);
      setPreparations([]);
      setUserPreparations([]);
      setValidationReactions([]);
      setClubSettings(null);
      setLoading(false);
    }
  }, [
    authUser, refreshAll,
    setSessions, setValidations, setRaceResults, setRaceNordiks, setSessionNordiks,
    setGroups, setUsers, setPreparations, setUserPreparations, setValidationReactions,
    setClubSettings, setLoading,
  ]);

  return { refreshAll };
}
