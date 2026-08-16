import { describe, it, expect } from 'vitest';
import { buildChatGptPrompt, buildPlanSample } from './importSamples';
import { parseImport } from './importParser';
import type { Group } from '../types';

// Volontairement plus de 3 groupes : c'est le cas qui a fait perdre des
// groupes dans le prompt (il n'en listait que 3).
const GROUPS: Group[] = [
  { id: 'g-ess', name: 'Essentiel' },
  { id: 'g-int', name: 'Intermédiaire' },
  { id: 'g-ren', name: 'Renforcé' },
  { id: 'g-tra', name: 'Trail long' },
  { id: 'g-mar', name: 'Marche nordique' },
];

describe('buildChatGptPrompt', () => {
  it('liste TOUS les groupes du club', () => {
    const prompt = buildChatGptPrompt(GROUPS);
    for (const g of GROUPS) {
      expect(prompt).toContain(`- ${g.name}`);
    }
  });

  it('reste utilisable quand le club n\'a encore aucun groupe', () => {
    expect(buildChatGptPrompt([])).toContain('- Tous');
  });
});

describe('buildPlanSample', () => {
  it('produit un JSON qui s\'importe sans erreur', () => {
    const r = parseImport(buildPlanSample(GROUPS), {
      defaultYear: 2026,
      groups: GROUPS,
      forceFormat: 'plan',
    });
    expect(r.errors).toHaveLength(0);
    expect(r.sessions.length).toBeGreaterThan(0);
    expect(r.sessions.every(s => s.groupId !== null)).toBe(true);
  });
});
