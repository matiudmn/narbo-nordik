import { useState, useEffect } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { DEFAULT_RACE_PACES, DEFAULT_ALLURE_ZONES, VMA_LEVELS } from '../../lib/calculations';
import { ZoneAccordion } from '../../components/coach/ZoneAccordion';
import { Button, useToast } from '../../components/ui';
import type { RacePaceConfig, AllureZoneConfig } from '../../types';

export default function AlluresTab() {
  const { clubSettings, updateClubSettings } = useData();
  const toast = useToast();
  const [racePaces, setRacePaces] = useState<Record<string, RacePaceConfig>>({});
  const [allureZones, setAllureZones] = useState<Record<string, AllureZoneConfig>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (clubSettings) {
      const rp = clubSettings.race_paces;
      const hasValidPaces =
        rp &&
        Object.keys(rp).length > 0 &&
        Object.values(rp).every((z) => Array.isArray(z.pctByLevel));
      setRacePaces(hasValidPaces ? { ...DEFAULT_RACE_PACES, ...rp } : DEFAULT_RACE_PACES);

      const az = clubSettings.allure_zones;
      const hasValidZones =
        az &&
        Object.keys(az).length > 0 &&
        Object.values(az).every(
          (z) => Array.isArray(z.pctMinByLevel) && Array.isArray(z.pctMaxByLevel)
        );
      setAllureZones(hasValidZones ? { ...DEFAULT_ALLURE_ZONES, ...az } : DEFAULT_ALLURE_ZONES);
    } else {
      setRacePaces(DEFAULT_RACE_PACES);
      setAllureZones(DEFAULT_ALLURE_ZONES);
    }
  }, [clubSettings]);

  const handleSave = async () => {
    setSaving(true);
    await updateClubSettings(racePaces, allureZones);
    setSaving(false);
    toast.success('Allures et zones enregistrées');
  };

  const handleReset = () => {
    setRacePaces(DEFAULT_RACE_PACES);
    setAllureZones(DEFAULT_ALLURE_ZONES);
    toast.info('Valeurs par défaut restaurées (non enregistrées)');
  };

  const updatePaceLevelPct = (key: string, levelIdx: number, value: number) => {
    setRacePaces((prev) => {
      const current = prev[key];
      const newPctByLevel = [...current.pctByLevel];
      newPctByLevel[levelIdx] = value;
      return { ...prev, [key]: { ...current, pctByLevel: newPctByLevel } };
    });
  };

  const updateZoneLevelMin = (key: string, levelIdx: number, value: number) => {
    setAllureZones((prev) => {
      const current = prev[key];
      const arr = [...current.pctMinByLevel];
      arr[levelIdx] = value;
      return { ...prev, [key]: { ...current, pctMinByLevel: arr } };
    });
  };

  const updateZoneLevelMax = (key: string, levelIdx: number, value: number) => {
    setAllureZones((prev) => {
      const current = prev[key];
      const arr = [...current.pctMaxByLevel];
      arr[levelIdx] = value;
      return { ...prev, [key]: { ...current, pctMaxByLevel: arr } };
    });
  };

  // Résumé compact d'une zone repliée
  const racePaceSummary = (zone: RacePaceConfig): string => {
    const values = zone.pctByLevel.filter((v) => v > 0);
    if (values.length === 0) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    return min === max ? `${min}%` : `${min}-${max}%`;
  };

  const allureZoneSummary = (zone: AllureZoneConfig): string => {
    const mins = zone.pctMinByLevel.filter((v) => v > 0);
    const maxs = zone.pctMaxByLevel.filter((v) => v > 0);
    if (mins.length === 0 || maxs.length === 0) return '';
    return `${Math.min(...mins)}-${Math.max(...maxs)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Allures de référence */}
      <section aria-labelledby="race-paces-heading">
        <h3 id="race-paces-heading" className="text-sm font-bold text-neutral-900 mb-1">
          Allures de référence
        </h3>
        <p className="text-xs text-neutral-500 mb-3">
          % VMA par niveau. L'allure affichée sur la fiche athlète dépend de sa VMA.
        </p>
        <div className="space-y-2">
          {Object.entries(racePaces).map(([key, zone]) => (
            <ZoneAccordion
              key={key}
              id={`pace-${key}`}
              color={zone.color}
              label={zone.label}
              summary={racePaceSummary(zone)}
            >
              <div className="space-y-2">
                {VMA_LEVELS.map((level, levelIdx) => (
                  <div key={level.key} className="flex items-center gap-3">
                    <label
                      htmlFor={`pace-${key}-level-${levelIdx}`}
                      className="flex-1 min-w-0"
                    >
                      <span className="text-sm font-medium text-neutral-800 block">
                        {level.label}
                      </span>
                      <span className="text-xs text-neutral-400">{level.description}</span>
                    </label>
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        id={`pace-${key}-level-${levelIdx}`}
                        type="number"
                        min={40}
                        max={120}
                        value={zone.pctByLevel[levelIdx]}
                        onChange={(e) => updatePaceLevelPct(key, levelIdx, Number(e.target.value))}
                        className="w-16 text-center text-sm font-semibold tabular border border-neutral-200 rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                        aria-label={`${zone.label} pour ${level.label} en pourcentage de VMA`}
                      />
                      <span className="text-xs text-neutral-400">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </ZoneAccordion>
          ))}
        </div>
      </section>

      {/* Zones d'entraînement */}
      <section aria-labelledby="allure-zones-heading">
        <h3 id="allure-zones-heading" className="text-sm font-bold text-neutral-900 mb-1">
          Zones d'entraînement
        </h3>
        <p className="text-xs text-neutral-500 mb-3">
          Fourchettes min-max de % VMA par niveau, utilisées dans les blocs de séances.
        </p>
        <div className="space-y-2">
          {Object.entries(allureZones).map(([key, zone]) => (
            <ZoneAccordion
              key={key}
              id={`zone-${key}`}
              color={zone.color}
              label={zone.label}
              summary={allureZoneSummary(zone)}
            >
              <div className="space-y-2">
                {VMA_LEVELS.map((level, levelIdx) => (
                  <div key={level.key} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-neutral-800 block">
                        {level.label}
                      </span>
                      <span className="text-xs text-neutral-400">{level.description}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min={30}
                        max={130}
                        value={zone.pctMinByLevel[levelIdx]}
                        onChange={(e) => updateZoneLevelMin(key, levelIdx, Number(e.target.value))}
                        className="w-14 text-center text-sm font-semibold tabular border border-neutral-200 rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                        aria-label={`${zone.label} min pour ${level.label}`}
                      />
                      <span className="text-neutral-300 text-xs" aria-hidden="true">
                        –
                      </span>
                      <input
                        type="number"
                        min={30}
                        max={130}
                        value={zone.pctMaxByLevel[levelIdx]}
                        onChange={(e) => updateZoneLevelMax(key, levelIdx, Number(e.target.value))}
                        className="w-14 text-center text-sm font-semibold tabular border border-neutral-200 rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                        aria-label={`${zone.label} max pour ${level.label}`}
                      />
                      <span className="text-xs text-neutral-400">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </ZoneAccordion>
          ))}
        </div>
      </section>

      {/* Actions */}
      <div className="flex gap-2 sticky bottom-4 z-10">
        <Button
          variant="secondary"
          fullWidth
          leftIcon={<RotateCcw size={14} aria-hidden="true" />}
          onClick={handleReset}
        >
          Valeurs par défaut
        </Button>
        <Button
          variant="primary"
          fullWidth
          loading={saving}
          leftIcon={!saving ? <Save size={14} aria-hidden="true" /> : undefined}
          onClick={handleSave}
        >
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
