import { useState, useEffect } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { DEFAULT_RACE_PACES, DEFAULT_ALLURE_ZONES, VMA_LEVELS } from '../../lib/calculations';
import type { RacePaceConfig, AllureZoneConfig } from '../../types';

export default function AlluresTab() {
  const { clubSettings, updateClubSettings } = useData();
  const [racePaces, setRacePaces] = useState<Record<string, RacePaceConfig>>({});
  const [allureZones, setAllureZones] = useState<Record<string, AllureZoneConfig>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (clubSettings) {
      setRacePaces(clubSettings.race_paces && Object.keys(clubSettings.race_paces).length > 0
        ? clubSettings.race_paces
        : DEFAULT_RACE_PACES);
      setAllureZones(clubSettings.allure_zones && Object.keys(clubSettings.allure_zones).length > 0
        ? clubSettings.allure_zones
        : DEFAULT_ALLURE_ZONES);
    } else {
      setRacePaces(DEFAULT_RACE_PACES);
      setAllureZones(DEFAULT_ALLURE_ZONES);
    }
  }, [clubSettings]);

  const handleSave = async () => {
    setSaving(true);
    await updateClubSettings(racePaces, allureZones);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setRacePaces(DEFAULT_RACE_PACES);
    setAllureZones(DEFAULT_ALLURE_ZONES);
  };

  const updatePaceLevelPct = (key: string, levelIdx: number, value: number) => {
    setRacePaces(prev => {
      const current = prev[key];
      const newPctByLevel = [...current.pctByLevel];
      newPctByLevel[levelIdx] = value;
      return { ...prev, [key]: { ...current, pctByLevel: newPctByLevel } };
    });
  };

  const updateZoneMin = (key: string, pctMin: number) => {
    setAllureZones(prev => ({ ...prev, [key]: { ...prev[key], pctMin } }));
  };

  const updateZoneMax = (key: string, pctMax: number) => {
    setAllureZones(prev => ({ ...prev, [key]: { ...prev[key], pctMax } }));
  };

  return (
    <div className="space-y-6">
      {/* Race Paces - table by level */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-1">Allures de reference</h3>
        <p className="text-xs text-gray-500 mb-3">
          % VMA par niveau. L'allure affichee sur la fiche athlete depend de sa VMA.
        </p>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-1 font-bold text-gray-700 w-16">Zone</th>
                {VMA_LEVELS.map(level => (
                  <th key={level.key} className="text-center py-2 px-0.5 font-medium text-gray-500">
                    <div className="text-[10px] leading-tight">{level.label}</div>
                    <div className="text-[8px] text-gray-400 font-normal">{level.description}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(racePaces).map(([key, zone]) => (
                <tr key={key} className="border-b border-gray-50">
                  <td className="py-1.5 px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: zone.color }} />
                      <span className="font-bold text-gray-700">{zone.label}</span>
                    </div>
                  </td>
                  {zone.pctByLevel.map((pct, levelIdx) => (
                    <td key={levelIdx} className="py-1.5 px-0.5 text-center">
                      <input
                        type="number"
                        min={40}
                        max={120}
                        value={pct}
                        onChange={e => updatePaceLevelPct(key, levelIdx, Number(e.target.value))}
                        className="w-12 text-center text-xs font-bold border border-gray-200 rounded py-1"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Allure Zones */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-1">Zones d'entrainement</h3>
        <p className="text-xs text-gray-500 mb-3">
          Fourchettes de % VMA utilisees dans les blocs de seances.
        </p>
        <div className="space-y-2">
          {Object.entries(allureZones).map(([key, zone]) => (
            <div key={key} className="flex items-center gap-3 bg-white rounded-lg border border-gray-100 p-3">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: zone.color }} />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-gray-700">{zone.label}</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={30}
                  max={120}
                  value={zone.pctMin}
                  onChange={e => updateZoneMin(key, Number(e.target.value))}
                  className="w-14 text-center text-sm font-bold border border-gray-200 rounded-md py-1"
                />
                <span className="text-xs text-gray-400">-</span>
                <input
                  type="number"
                  min={30}
                  max={130}
                  value={zone.pctMax}
                  onChange={e => updateZoneMax(key, Number(e.target.value))}
                  className="w-14 text-center text-sm font-bold border border-gray-200 rounded-md py-1"
                />
                <span className="text-xs text-gray-400">%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleReset}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600"
        >
          <RotateCcw size={14} />
          Valeurs par defaut
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? 'Enregistrement...' : saved ? 'Enregistre !' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
