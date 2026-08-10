import { describe, it, expect } from 'vitest';
import { getDisclosureTriggerProps, getDisclosurePanelProps, toggleDisclosure } from './disclosureAria';

// NOTE : le repo n'a pas encore de fondation de test de composants React
// (pas de @testing-library/react en dépendance, environnement vitest en
// 'node' sans jsdom, cf. commentaire dans vitest.config.ts). Le rendu réel
// du bouton/panel et un vrai `fireEvent` clavier ne sont donc pas
// testables ici. On teste à la place la logique pure de Disclosure.tsx :
// bascule d'état (déclenchée aussi bien par un clic souris que par
// l'activation clavier native Espace/Entrée sur le <button>, puisque les
// deux passent par le même onClick) et cohérence des attributs ARIA.

describe('toggleDisclosure', () => {
  it('passe de fermé à ouvert', () => {
    expect(toggleDisclosure(false)).toBe(true);
  });

  it('passe de ouvert à fermé', () => {
    expect(toggleDisclosure(true)).toBe(false);
  });

  it('est involutive sur plusieurs bascules successives', () => {
    let open = false;
    open = toggleDisclosure(open);
    open = toggleDisclosure(open);
    open = toggleDisclosure(open);
    expect(open).toBe(true);
  });
});

describe('getDisclosureTriggerProps', () => {
  it('reflète aria-expanded sur l\'état ouvert', () => {
    expect(getDisclosureTriggerProps('d1', true)['aria-expanded']).toBe(true);
  });

  it('reflète aria-expanded sur l\'état fermé', () => {
    expect(getDisclosureTriggerProps('d1', false)['aria-expanded']).toBe(false);
  });

  it('pointe aria-controls vers l\'id du panel', () => {
    const trigger = getDisclosureTriggerProps('zone-42', true);
    expect(trigger['aria-controls']).toBe('zone-42-panel');
  });

  it('génère un id de bouton dérivé et stable', () => {
    expect(getDisclosureTriggerProps('abc', false).id).toBe('abc-trigger');
  });
});

describe('getDisclosurePanelProps', () => {
  it('expose role="region"', () => {
    expect(getDisclosurePanelProps('abc').role).toBe('region');
  });

  it('labellise le panel via aria-labelledby vers le bouton', () => {
    const panel = getDisclosurePanelProps('abc');
    expect(panel['aria-labelledby']).toBe('abc-trigger');
  });

  it('utilise le même id que celui référencé par aria-controls du bouton', () => {
    const trigger = getDisclosureTriggerProps('abc', false);
    const panel = getDisclosurePanelProps('abc');
    expect(panel.id).toBe(trigger['aria-controls']);
  });

  it('utilise le même id que celui référencé par aria-labelledby du panel pour le bouton', () => {
    const trigger = getDisclosureTriggerProps('abc', false);
    const panel = getDisclosurePanelProps('abc');
    expect(trigger.id).toBe(panel['aria-labelledby']);
  });
});
