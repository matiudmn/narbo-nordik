import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';
import type { Session, SessionValidation, RaceResult, RaceNordik, SessionNordik, ValidationReaction, Group, User, NotificationPreferences, SpecificPreparation, UserPreparation, ObjectiveReached, Sensations, SessionMetricsInput, ClubSettings, RacePaceConfig, AllureZoneConfig } from '../types';
import type { OfflineState } from '../lib/offline-cache';
import { useAuth } from './AuthContext';
import { useDataBootstrap } from './data/bootstrap';
import { useSessionActions } from './data/sessions';
import { useValidationActions } from './data/validations';
import { useRaceActions } from './data/races';
import { useNordikActions } from './data/nordiks';
import { useUserActions, type AddUserResult } from './data/users';
import { useGroupActions } from './data/groups';
import { usePreparationActions } from './data/preparations';
import { useClubSettingsActions } from './data/clubSettings';

interface DataContextType {
  sessions: Session[];
  validations: SessionValidation[];
  raceResults: RaceResult[];
  raceNordiks: RaceNordik[];
  sessionNordiks: SessionNordik[];
  validationReactions: ValidationReaction[];
  groups: Group[];
  users: User[];
  preparations: SpecificPreparation[];
  userPreparations: UserPreparation[];
  loading: boolean;
  addSession: (session: Omit<Session, 'id' | 'created_at'>) => Promise<{ id: string } | { error: string }>;
  addSessionsBulk: (sessions: Omit<Session, 'id' | 'created_at'>[]) => Promise<{ created: number } | { error: string }>;
  updateSession: (id: string, updates: Partial<Session>) => Promise<{ error: string | null }>;
  deleteSession: (id: string) => Promise<{ error: string | null }>;
  validateSession: (sessionId: string, userId: string, status: 'done' | 'missed', feedback?: string, file?: File, objectiveReached?: ObjectiveReached, sensations?: Sensations, metrics?: SessionMetricsInput) => Promise<{ id: string } | { error: string }>;
  updateValidation: (validationId: string, updates: { feedback?: string; objective_reached?: ObjectiveReached | null; sensations?: Sensations | null; metrics?: SessionMetricsInput }, file?: File) => Promise<{ error?: string }>;
  addRaceResult: (result: Omit<RaceResult, 'id' | 'created_at'>) => Promise<{ error: string | null }>;
  updateRaceResult: (id: string, updates: Partial<Omit<RaceResult, 'id' | 'created_at'>>) => Promise<{ error: string | null }>;
  deleteRaceResult: (id: string) => Promise<{ error: string | null }>;
  toggleNordik: (raceId: string, userId: string) => Promise<{ error: string | null }>;
  toggleSessionNordik: (sessionId: string, userId: string) => Promise<{ error: string | null }>;
  toggleValidationReaction: (validationId: string, emoji: string, authorId: string) => Promise<{ error: string | null }>;
  updateUser: (userId: string, updates: Partial<User>) => Promise<{ error: string | null }>;
  updateUserVma: (userId: string, vma: number, reason?: string) => Promise<{ error: string | null }>;
  updateUserPublic: (userId: string, isPublic: boolean) => Promise<{ error: string | null }>;
  updateUserPhone: (userId: string, phone: string | null) => Promise<{ error: string | null }>;
  updateUserLicense: (userId: string, licenseNumber: string | null) => Promise<{ error: string | null }>;
  updateUserBirthDate: (userId: string, birthDate: string | null) => Promise<{ error: string | null }>;
  updateUserPhoto: (userId: string, file: File | null) => Promise<{ error: string | null }>;
  addUser: (user: Omit<User, 'id' | 'created_at' | 'vma_history' | 'photo_url' | 'license_number' | 'birth_date' | 'notification_preferences' | 'email'> & { email: string }) => Promise<AddUserResult | null>;
  deleteUser: (id: string) => Promise<{ error: string | null }>;
  addGroup: (name: string) => Promise<{ error: string | null }>;
  updateGroup: (id: string, name: string) => Promise<{ error: string | null }>;
  deleteGroup: (id: string) => Promise<{ error: string | null }>;
  updateUserGroup: (userId: string, groupId: string | null) => Promise<{ error: string | null }>;
  updateNotificationPreferences: (userId: string, prefs: NotificationPreferences) => Promise<{ error: string | null }>;
  addPreparation: (name: string, eventDate: string, description: string | null) => Promise<{ error: string | null }>;
  updatePreparation: (id: string, updates: Partial<SpecificPreparation>) => Promise<{ error: string | null }>;
  deletePreparation: (id: string) => Promise<{ error: string | null }>;
  addUserToPreparation: (userId: string, preparationId: string) => Promise<{ error: string | null }>;
  removeUserFromPreparation: (userId: string, preparationId: string) => Promise<{ error: string | null }>;
  clubSettings: ClubSettings | null;
  updateClubSettings: (racePaces: Record<string, RacePaceConfig>, allureZones: Record<string, AllureZoneConfig>, inviteCode?: string) => Promise<{ error: string | null }>;
  setFeaturedValidation: (validationId: string | null) => Promise<{ error: string | null }>;
  refreshAll: () => Promise<void>;
  offline: OfflineState;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user: authUser } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [validations, setValidations] = useState<SessionValidation[]>([]);
  const [raceResults, setRaceResults] = useState<RaceResult[]>([]);
  const [raceNordiks, setRaceNordiks] = useState<RaceNordik[]>([]);
  const [sessionNordiks, setSessionNordiks] = useState<SessionNordik[]>([]);
  const [validationReactions, setValidationReactions] = useState<ValidationReaction[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [preparations, setPreparations] = useState<SpecificPreparation[]>([]);
  const [userPreparations, setUserPreparations] = useState<UserPreparation[]>([]);
  const [clubSettings, setClubSettings] = useState<ClubSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<OfflineState>({ isOffline: false, cachedAt: null });

  const { refreshAll } = useDataBootstrap(authUser, {
    setSessions, setValidations, setRaceResults, setRaceNordiks, setSessionNordiks,
    setValidationReactions, setGroups, setUsers, setPreparations, setUserPreparations,
    setClubSettings, setLoading, setOffline,
  });

  const sessionActions = useSessionActions({ setSessions, setValidations });
  const validationActions = useValidationActions({ setValidations });
  const raceActions = useRaceActions({ setRaceResults, setSessions, setValidations, setRaceNordiks });
  const nordikActions = useNordikActions({ setRaceNordiks, setSessionNordiks, setValidationReactions });
  const userActions = useUserActions({ setUsers, setValidations, setRaceResults, setRaceNordiks, setSessionNordiks });
  const groupActions = useGroupActions({ setGroups, setUsers, setSessions });
  const preparationActions = usePreparationActions({ setPreparations, setUserPreparations, setSessions }, authUser?.id);
  const clubSettingsActions = useClubSettingsActions({ clubSettings, setClubSettings }, authUser?.id);

  const value = useMemo<DataContextType>(() => ({
    sessions, validations, raceResults, raceNordiks, sessionNordiks, validationReactions, groups, users, preparations, userPreparations, clubSettings, loading,
    ...sessionActions, ...validationActions, ...raceActions, ...nordikActions, ...userActions, ...groupActions, ...preparationActions, ...clubSettingsActions,
    refreshAll, offline,
  }), [
    sessions, validations, raceResults, raceNordiks, sessionNordiks, validationReactions, groups, users, preparations, userPreparations, clubSettings, loading,
    sessionActions, validationActions, raceActions, nordikActions, userActions, groupActions, preparationActions, clubSettingsActions,
    refreshAll, offline,
  ]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
