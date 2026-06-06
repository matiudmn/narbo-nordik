import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Check, Loader2, MapPin } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useToast } from '../../components/ui';
import type { SessionType } from '../../types';

/**
 * Saisie rapide d'UNE séance (fast path mobile).
 *
 * Pensé pour les cas dernière minute : ajout d'une séance la veille, retouche
 * météo, coach sur le terrain au téléphone. Quatre champs essentiels, aucun
 * block-builder, texte libre préservé tel quel (le `|` sépare les phases côté
 * athlète, comme à l'import). Pour les séances structurées avec allures, le
 * coach garde l'éditeur complet (/coach/sessions).
 *
 * Ref PRD v3 Feature 2 (Sprint S2).
 */

const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: 'entrainement', label: 'Entraînement' },
  { value: 'sortie_longue', label: 'Sortie longue' },
  { value: 'recuperation', label: 'Récupération' },
  { value: 'course', label: 'Course' },
];

export default function QuickAddSession() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { groups, addSessionsBulk } = useData();
  const toast = useToast();

  const [datetime, setDatetime] = useState<string>(() => {
    // Défaut : aujourd'hui 18:30 (créneau le plus fréquent)
    const d = new Date();
    d.setHours(18, 30, 0, 0);
    return format(d, "yyyy-MM-dd'T'HH:mm");
  });
  // Groupes cochés. 'all' = séance globale (tous, group_id null).
  const [targetGroupIds, setTargetGroupIds] = useState<string[]>([]);
  const [targetAll, setTargetAll] = useState<boolean>(false);
  const [sessionType, setSessionType] = useState<SessionType>('entrainement');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const targetCount = targetAll ? 1 : targetGroupIds.length;
  const canSave =
    user?.role === 'coach' &&
    !!datetime &&
    content.trim().length > 0 &&
    targetCount > 0 &&
    !saving;

  // Aperçu du nombre de séances qui seront créées (1 par groupe cible)
  const summary = useMemo(() => {
    if (targetAll) return 'Tous les groupes (séance globale)';
    if (targetGroupIds.length === 0) return 'Aucun groupe sélectionné';
    const names = targetGroupIds
      .map(id => groups.find(g => g.id === id)?.name)
      .filter(Boolean);
    return names.join(', ');
  }, [targetAll, targetGroupIds, groups]);

  function toggleGroup(id: string) {
    setTargetAll(false);
    setTargetGroupIds(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    setTargetAll(prev => !prev);
    setTargetGroupIds([]);
  }

  async function handleSave() {
    if (!user || !canSave) return;
    setSaving(true);

    const isoDate = new Date(datetime).toISOString();
    const finalTitle = title.trim() || content.split('|')[0].trim().slice(0, 60) || 'Séance';
    const description = content.trim();

    // Une row par groupe cible (ou une seule globale si "Tous").
    const targetGroups: (string | null)[] = targetAll ? [null] : targetGroupIds;
    const rows = targetGroups.map(groupId => ({
      date: isoDate,
      title: finalTitle,
      session_type: sessionType,
      terrain_options: [],
      location: location.trim() || null,
      location_url: null,
      description,
      group_id: groupId,
      preparation_id: null,
      target_distance: null,
      vma_percent_min: null,
      vma_percent_max: null,
      blocks: [],
      is_personal: false,
      created_by: user.id,
    }));

    try {
      const res = await addSessionsBulk(rows);
      if ('error' in res) {
        toast.error(`Création échouée : ${res.error}`);
        return;
      }
      toast.success(
        res.created > 1
          ? `${res.created} séances créées`
          : 'Séance créée'
      );
      navigate('/coach');
    } catch (e) {
      toast.error(`Création échouée : ${e instanceof Error ? e.message : 'erreur inattendue'}`);
    } finally {
      setSaving(false);
    }
  }

  if (user?.role !== 'coach') {
    return (
      <div className="py-8 text-center text-gray-500">
        Cette page est réservée au coach.
      </div>
    );
  }

  return (
    <div className="pt-4 pb-28 max-w-lg mx-auto px-4">
      {/* HEADER */}
      <div className="mb-5">
        <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">
          Saisie rapide
        </div>
        <h1 className="text-xl font-bold text-gray-900">Nouvelle séance</h1>
        <p className="text-sm text-gray-500 mt-1">
          Pour un ajout ponctuel. Pour un plan complet, utilise{' '}
          <button onClick={() => navigate('/coach/import')} className="text-primary hover:underline">
            l'import Excel
          </button>.
        </p>
      </div>

      <div className="space-y-5">
        {/* DATE + HEURE */}
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
            Date et heure
          </label>
          <input
            type="datetime-local"
            value={datetime}
            onChange={e => setDatetime(e.target.value)}
            className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* CIBLE */}
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
            Pour quel(s) groupe(s)
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleAll}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                targetAll
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Tous
            </button>
            {groups.map(g => {
              const active = targetGroupIds.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGroup(g.id)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    active
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-400">{summary}</p>
            <button
              type="button"
              onClick={() => navigate('/coach/settings?tab=preparations')}
              className="text-xs text-primary hover:underline whitespace-nowrap"
            >
              + Prépa spécifique
            </button>
          </div>
        </div>

        {/* TYPE */}
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
            Type
          </label>
          <div className="flex flex-wrap gap-2">
            {SESSION_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setSessionType(t.value)}
                className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                  sessionType === t.value
                    ? 'bg-accent/15 text-primary border-accent'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* TITRE */}
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
            Titre <span className="text-gray-400 normal-case">(optionnel)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="ex : VMA courte, Sortie Clape…"
            className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* LIEU */}
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
            Lieu <span className="text-gray-400 normal-case">(optionnel)</span>
          </label>
          <div className="relative">
            <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="ex : Stade, Moujan, Chapelle Auzils…"
              className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* CONTENU */}
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
            Contenu de la séance
          </label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={5}
            placeholder="ex : 20' EF | 8 x 200m | 10' retour au calme"
            className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">
            Sépare les phases avec « | » — elles s'afficheront en étapes côté athlète.
          </p>
        </div>
      </div>

      {/* CTA STICKY */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-60 bg-white border-t border-gray-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-2 z-40">
        <button
          type="button"
          onClick={() => navigate('/coach')}
          className="px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-600"
          disabled={saving}
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="flex-1 px-5 py-3 bg-accent text-primary rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Création…
            </>
          ) : (
            <>
              <Check size={16} />
              {targetCount > 1 ? `Créer ${targetCount} séances` : 'Créer la séance'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
