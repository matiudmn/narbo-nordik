import { useCallback, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  User, Session, SessionValidation, RaceResult, RaceNordik, SessionNordik,
  ValidationReaction, Group, SpecificPreparation, UserPreparation, ClubSettings,
} from '../../types';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/monitoring';
import { fetchAllPages } from '../../lib/fetch-all-pages';
import { saveSnapshot, loadSnapshot, type OfflineState } from '../../lib/offline-cache';
import {
  toSession, toValidation, toRaceResult, toRaceNordik, toSessionNordik,
  toValidationReaction, toPreparation, toClubSettings, toUser,
} from './rows';

// Clés du cache offline = noms des collections telles que posées en state.
// Utilisées à la fois pour l'écriture (snapshot best effort après un
// bootstrap réussi) et pour la lecture (hydratation hors ligne).
const CACHE_KEYS = [
  'sessions', 'validations', 'groups', 'users', 'preparations', 'userPreparations', 'clubSettings',
  'raceResults', 'raceNordiks', 'sessionNordiks', 'validationReactions',
] as const;

/**
 * Une erreur PostgREST « réseau » (fetch qui n'a pas pu joindre le serveur)
 * revient avec `status: 0` sur l'enveloppe de réponse — supabase-js catche
 * l'échec du fetch lui-même et le resitue dans `{ data: null, error, status: 0 }`
 * plutôt que de rejeter la promesse (cf. postgrest-js `PostgrestBuilder.then` /
 * `processResponse`, où `status` est un champ de l'enveloppe, pas de `error`).
 * Une erreur RLS/auth, elle, revient toujours avec un vrai statut HTTP
 * (401/403) : jamais confondue avec un hors-ligne.
 */
function isNetworkError(result: { error: unknown; status?: number }): boolean {
  return !!result.error && result.status === 0;
}

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
  setOffline: Dispatch<SetStateAction<OfflineState>>;
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
    setClubSettings, setLoading, setOffline,
  } = setters;

  // Hydratation hors ligne : relit le dernier snapshot IndexedDB et le pose
  // tel quel en state (deja normalise par saveSnapshot cote succes). Best
  // effort : si IndexedDB est elle-meme indisponible, on log et on laisse le
  // state existant (potentiellement vide au tout premier lancement offline).
  const hydrateFromCache = useCallback(async () => {
    try {
      const snapshot = await loadSnapshot([...CACHE_KEYS]);
      const sessions = snapshot.get('sessions');
      if (sessions) setSessions(sessions.data as Session[]);
      const validations = snapshot.get('validations');
      if (validations) setValidations(validations.data as SessionValidation[]);
      const groups = snapshot.get('groups');
      if (groups) setGroups(groups.data as Group[]);
      const users = snapshot.get('users');
      if (users) setUsers(users.data as User[]);
      const preparations = snapshot.get('preparations');
      if (preparations) setPreparations(preparations.data as SpecificPreparation[]);
      const userPreparations = snapshot.get('userPreparations');
      if (userPreparations) setUserPreparations(userPreparations.data as UserPreparation[]);
      const clubSettings = snapshot.get('clubSettings');
      if (clubSettings) setClubSettings(clubSettings.data as ClubSettings);
      const raceResults = snapshot.get('raceResults');
      if (raceResults) setRaceResults(raceResults.data as RaceResult[]);
      const raceNordiks = snapshot.get('raceNordiks');
      if (raceNordiks) setRaceNordiks(raceNordiks.data as RaceNordik[]);
      const sessionNordiks = snapshot.get('sessionNordiks');
      if (sessionNordiks) setSessionNordiks(sessionNordiks.data as SessionNordik[]);
      const validationReactions = snapshot.get('validationReactions');
      if (validationReactions) setValidationReactions(validationReactions.data as ValidationReaction[]);

      // cachedAt de reference pour le bandeau : celui du groupe bloquant
      // (sessions), toujours ecrit ensemble lors d'un snapshot reussi.
      setOffline({ isOffline: true, cachedAt: sessions?.cachedAt ?? null });
    } catch (err) {
      captureError('offline-cache.hydrate', err);
      setOffline({ isOffline: true, cachedAt: null });
    }
  }, [
    setSessions, setValidations, setRaceResults, setRaceNordiks, setSessionNordiks,
    setValidationReactions, setGroups, setUsers, setPreparations, setUserPreparations,
    setClubSettings, setOffline,
  ]);

  const fetchAll = useCallback(async () => {
    // navigator.onLine a deja tranche : inutile de tenter un fetch voue a
    // l'echec (et a un delai de timeout reseau avant de retomber sur le cache).
    if (!navigator.onLine) {
      await hydrateFromCache();
      return;
    }

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
    // Les collections a l'echelle du club entier (sessions, validations,
    // resultats) passent par fetchAllPages : PostgREST plafonne chaque reponse
    // a 1000 lignes et session_validations a franchi ce seuil le 02/09/2026
    // (validations recentes silencieusement absentes au boot). L'ORDER BY id
    // en dernier critere est requis pour une pagination stable.
    const blocking = Promise.all([
      fetchAllPages((from, to) => supabase.from('sessions').select('*').order('date').order('id').range(from, to)),
      fetchAllPages((from, to) => supabase.from('session_validations').select('*').order('id').range(from, to)),
      supabase.from('groups').select('*'),
      usersQuery,
      supabase.from('specific_preparations').select('*').order('event_date'),
      supabase.from('user_preparations').select('*'),
      supabase.from('club_settings').select('*').limit(1).maybeSingle(),
    ]);
    // Groupe non bloquant : absent de Home, continue de renseigner son state
    // en arriere-plan sans retarder la levee de `loading`.
    const nonBlocking = Promise.all([
      fetchAllPages((from, to) => supabase.from('race_results').select('*').order('id').range(from, to)),
      fetchAllPages((from, to) => supabase.from('race_nordiks').select('*').order('id').range(from, to)),
      supabase.from('session_nordiks').select('*'),
      supabase.from('validation_reactions').select('*'),
    ]);

    const [s, v, g, u, p, up, cs] = await blocking;

    // supabase-js ne rejette jamais sur un echec de fetch : il resitue
    // l'erreur reseau dans `.error` (status 0, cf. isNetworkError). Une
    // panne reseau en cours de route retombe donc ici, au meme titre qu'une
    // coupure detectee avant meme de partir.
    if (
      isNetworkError(s) || isNetworkError(v) || isNetworkError(g) ||
      isNetworkError(u) || isNetworkError(p) || isNetworkError(up) || isNetworkError(cs)
    ) {
      await hydrateFromCache();
      return;
    }

    if (s.data) setSessions(s.data.map(toSession));
    if (v.data) setValidations(v.data.map(toValidation));
    if (g.data) setGroups(g.data);
    if (u.data) setUsers(u.data.map(toUser));
    if (p.data) setPreparations(p.data.map(toPreparation));
    if (up.data) setUserPreparations(up.data);
    if (cs.data) setClubSettings(toClubSettings(cs.data));
    else if (cs.error && cs.error.code !== 'PGRST116') captureError('bootstrap.club_settings fetch error', cs.error);
    setOffline({ isOffline: false, cachedAt: null });

    // Snapshot best effort du groupe bloquant : ne bloque jamais l'affichage,
    // echec silencieux logge via captureError (cf. lot cache offline).
    const blockingCacheEntries: Record<string, unknown> = {};
    if (s.data) blockingCacheEntries.sessions = s.data.map(toSession);
    if (v.data) blockingCacheEntries.validations = v.data.map(toValidation);
    if (g.data) blockingCacheEntries.groups = g.data;
    if (u.data) blockingCacheEntries.users = u.data.map(toUser);
    if (p.data) blockingCacheEntries.preparations = p.data.map(toPreparation);
    if (up.data) blockingCacheEntries.userPreparations = up.data;
    if (cs.data) blockingCacheEntries.clubSettings = toClubSettings(cs.data);
    saveSnapshot(blockingCacheEntries).catch((err) => captureError('offline-cache.save.blocking', err));

    nonBlocking.then(([rr, rn, sn, vr]) => {
      if (
        isNetworkError(rr) || isNetworkError(rn) ||
        isNetworkError(sn) || isNetworkError(vr)
      ) {
        // Le groupe bloquant vient de reussir : on garde le cache existant
        // pour ces 4 collections plutot que d'ecraser avec un etat hors ligne.
        return;
      }
      if (rr.data) setRaceResults(rr.data.map(toRaceResult));
      if (rn.data) setRaceNordiks(rn.data.map(toRaceNordik));
      if (sn.data) setSessionNordiks(sn.data.map(toSessionNordik));
      if (vr.data) setValidationReactions(vr.data.map(toValidationReaction));

      const nonBlockingCacheEntries: Record<string, unknown> = {};
      if (rr.data) nonBlockingCacheEntries.raceResults = rr.data.map(toRaceResult);
      if (rn.data) nonBlockingCacheEntries.raceNordiks = rn.data.map(toRaceNordik);
      if (sn.data) nonBlockingCacheEntries.sessionNordiks = sn.data.map(toSessionNordik);
      if (vr.data) nonBlockingCacheEntries.validationReactions = vr.data.map(toValidationReaction);
      saveSnapshot(nonBlockingCacheEntries).catch((err) => captureError('offline-cache.save.nonBlocking', err));
    });
  }, [
    authUser?.role, authUser?.is_super_admin, hydrateFromCache,
    setSessions, setValidations, setRaceResults, setRaceNordiks, setSessionNordiks,
    setGroups, setUsers, setPreparations, setUserPreparations, setValidationReactions, setClubSettings, setOffline,
  ]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await fetchAll();
    } finally {
      // Garde-fou : meme si fetchAll rejette de facon inattendue (bug, pas
      // un cas gere ci-dessus), on ne laisse jamais loading bloque a `true`
      // (coquille vide indefinie).
      setLoading(false);
    }
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
      setOffline({ isOffline: false, cachedAt: null });
    }
  }, [
    authUser, refreshAll,
    setSessions, setValidations, setRaceResults, setRaceNordiks, setSessionNordiks,
    setGroups, setUsers, setPreparations, setUserPreparations, setValidationReactions,
    setClubSettings, setLoading, setOffline,
  ]);

  // Ecoute reseau. 'online' : relance un bootstrap complet, ce qui fait
  // disparaitre le bandeau des que les donnees fraiches arrivent (et
  // retombe de nouveau sur le cache si la reconnexion s'avere illusoire,
  // cf. isNetworkError plus haut). 'offline' : bascule juste le bandeau,
  // SANS toucher aux collections deja en memoire — les re-hydrater depuis
  // le disque ecraserait des mutations locales reussies depuis le dernier
  // bootstrap (ex. une validation faite juste avant la coupure) par un
  // snapshot plus vieux. hydrateFromCache() reste reserve aux cas ou l'etat
  // memoire est perime a coup sur : boot hors ligne ou echec reseau en
  // plein fetch (fetchAll ci-dessus).
  useEffect(() => {
    if (!authUser) return;
    const handleOffline = () => { setOffline({ isOffline: true, cachedAt: Date.now() }); };
    const handleOnline = () => { refreshAll(); };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [authUser, refreshAll, setOffline]);

  return { refreshAll };
}
