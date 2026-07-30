import { describe, it, expect } from 'vitest';
import { parseInline, parseMarkdown } from './markdown';

describe('parseInline', () => {
  it('découpe gras, italique et texte', () => {
    expect(parseInline('avant **gras** et *italique*')).toEqual([
      { kind: 'text', value: 'avant ' },
      { kind: 'strong', value: 'gras' },
      { kind: 'text', value: ' et ' },
      { kind: 'em', value: 'italique' },
    ]);
  });

  it('gère les liens explicites', () => {
    expect(parseInline('voir [la CNIL](https://www.cnil.fr)')).toEqual([
      { kind: 'text', value: 'voir ' },
      { kind: 'link', href: 'https://www.cnil.fr', label: 'la CNIL' },
    ]);
  });

  it('auto-lie les URL sans avaler la ponctuation finale', () => {
    expect(parseInline('rendez-vous sur https://exemple.fr/page.')).toEqual([
      { kind: 'text', value: 'rendez-vous sur ' },
      { kind: 'link', href: 'https://exemple.fr/page', label: 'https://exemple.fr/page' },
      { kind: 'text', value: '.' },
    ]);
  });

  it('préfixe les URL en www avec https', () => {
    expect(parseInline('www.cnil.fr')).toEqual([
      { kind: 'link', href: 'https://www.cnil.fr', label: 'www.cnil.fr' },
    ]);
  });

  it('auto-lie les adresses e-mail en mailto', () => {
    expect(parseInline('écrire à narbo.nordik.club@gmail.com')).toEqual([
      { kind: 'text', value: 'écrire à ' },
      {
        kind: 'link',
        href: 'mailto:narbo.nordik.club@gmail.com',
        label: 'narbo.nordik.club@gmail.com',
      },
    ]);
  });

  it('renvoie une liste vide sur une chaîne vide', () => {
    expect(parseInline('')).toEqual([]);
  });
});

describe('parseMarkdown', () => {
  it('reconnaît les titres et leur niveau', () => {
    const blocks = parseMarkdown('# Titre\n\n## Section\n\n### Sous-section');
    expect(blocks.map(b => b.kind === 'heading' && b.level)).toEqual([1, 2, 3]);
  });

  it('reconnaît les séparateurs', () => {
    expect(parseMarkdown('---')).toEqual([{ kind: 'divider' }]);
  });

  it('conserve les retours à la ligne simples dans un paragraphe', () => {
    const blocks = parseMarkdown('**Version** : 1.0\n**Date** : 2026-05-23');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind === 'paragraph' && blocks[0].lines).toHaveLength(2);
  });

  it('regroupe les puces consécutives en une seule liste', () => {
    const blocks = parseMarkdown('- un\n- deux\n- trois');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind === 'list' && blocks[0].items).toHaveLength(3);
  });

  it('regroupe les lignes de citation en un seul bloc', () => {
    const blocks = parseMarkdown('> **Club**\n> 11100 Narbonne');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind === 'quote' && blocks[0].lines).toHaveLength(2);
  });

  it('parse un tableau GFM avec en-tête et corps', () => {
    const blocks = parseMarkdown('| Finalité | Base légale |\n|---|---|\n| Compte | Contrat |\n| Notifs | Consentement |');
    expect(blocks).toHaveLength(1);
    const table = blocks[0];
    if (table.kind !== 'table') throw new Error('bloc tableau attendu');
    expect(table.head).toHaveLength(2);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[1][1]).toEqual([{ kind: 'text', value: 'Consentement' }]);
  });

  it('accepte un tableau à en-tête vide', () => {
    const blocks = parseMarkdown('| | |\n|---|---|\n| Contact | Club |');
    const table = blocks[0];
    if (table.kind !== 'table') throw new Error('bloc tableau attendu');
    expect(table.head).toEqual([[], []]);
    expect(table.rows).toHaveLength(1);
  });

  it('retombe en paragraphe si la ligne de délimitation manque', () => {
    const blocks = parseMarkdown('| pas | un tableau |');
    expect(blocks[0].kind).toBe('paragraph');
  });

  it('ignore les lignes vides sans produire de bloc', () => {
    expect(parseMarkdown('\n\n\n')).toEqual([]);
  });
});
