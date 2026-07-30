/**
 * Mini parseur Markdown volontairement limité aux constructions utilisées par
 * les documents du dossier `legal/` : titres, paragraphes, listes, citations,
 * tableaux GFM, séparateurs, gras, italique, liens et adresses e-mail.
 *
 * Objectif : afficher un document légal versionné en Markdown sans embarquer de
 * dépendance de rendu. Toute construction non reconnue retombe en paragraphe.
 *
 * Rendu associé : src/pages/legal/PrivacyPolicy.tsx
 */

export type Inline =
  | { kind: 'text'; value: string }
  | { kind: 'strong'; value: string }
  | { kind: 'em'; value: string }
  | { kind: 'link'; href: string; label: string };

export type Block =
  | { kind: 'heading'; level: number; content: Inline[] }
  | { kind: 'paragraph'; lines: Inline[][] }
  | { kind: 'list'; items: Inline[][] }
  | { kind: 'quote'; lines: Inline[][] }
  | { kind: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { kind: 'divider' };

/**
 * Ordre des alternatives : gras avant italique (sinon `**x**` casse), liens
 * explicites avant auto-liens. Les URL et e-mails ne capturent pas la
 * ponctuation finale, pour ne pas l'avaler en fin de phrase.
 */
const INLINE =
  /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)|((?:https?:\/\/|www\.)[^\s)]*[^\s).,;:!?])|([\w.+-]+@[\w-]+\.[\w.-]*[\w-])/g;

const HEADING = /^(#{1,6})\s+(.*)$/;
const DIVIDER = /^(?:-{3,}|\*{3,}|_{3,})$/;
const BULLET = /^[-*+]\s+/;
const TABLE_DELIMITER = /^:?-{2,}:?$/;

function isDivider(line: string): boolean {
  return DIVIDER.test(line);
}

function startsBlock(line: string): boolean {
  return (
    !line ||
    isDivider(line) ||
    HEADING.test(line) ||
    BULLET.test(line) ||
    line.startsWith('>') ||
    line.startsWith('|')
  );
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim());
}

function isDelimiterRow(line: string | undefined): boolean {
  if (!line) return false;
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return false;
  const cells = splitRow(trimmed);
  return cells.length > 0 && cells.every(cell => TABLE_DELIMITER.test(cell));
}

export function parseInline(text: string): Inline[] {
  const nodes: Inline[] = [];
  let cursor = 0;

  for (const match of text.matchAll(INLINE)) {
    const at = match.index ?? 0;
    if (at > cursor) nodes.push({ kind: 'text', value: text.slice(cursor, at) });

    const [full, strong, em, label, href, url, email] = match;
    if (strong !== undefined) {
      nodes.push({ kind: 'strong', value: strong });
    } else if (em !== undefined) {
      nodes.push({ kind: 'em', value: em });
    } else if (label !== undefined) {
      nodes.push({ kind: 'link', href, label });
    } else if (url !== undefined) {
      nodes.push({ kind: 'link', href: url.startsWith('www.') ? `https://${url}` : url, label: url });
    } else if (email !== undefined) {
      nodes.push({ kind: 'link', href: `mailto:${email}`, label: email });
    }

    cursor = at + full.length;
  }

  if (cursor < text.length) nodes.push({ kind: 'text', value: text.slice(cursor) });
  return nodes;
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      i++;
      continue;
    }

    if (isDivider(line)) {
      blocks.push({ kind: 'divider' });
      i++;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, content: parseInline(heading[2].trim()) });
      i++;
      continue;
    }

    if (line.startsWith('>')) {
      const quoted: Inline[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoted.push(parseInline(lines[i].trim().replace(/^>\s?/, '')));
        i++;
      }
      blocks.push({ kind: 'quote', lines: quoted });
      continue;
    }

    if (BULLET.test(line)) {
      const items: Inline[][] = [];
      while (i < lines.length) {
        const item = lines[i].trim();
        if (!BULLET.test(item) || isDivider(item)) break;
        items.push(parseInline(item.replace(BULLET, '')));
        i++;
      }
      blocks.push({ kind: 'list', items });
      continue;
    }

    if (line.startsWith('|') && isDelimiterRow(lines[i + 1])) {
      const head = splitRow(line).map(parseInline);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i].trim()).map(parseInline));
        i++;
      }
      blocks.push({ kind: 'table', head, rows });
      continue;
    }

    // Paragraphe : la ligne courante est consommée d'office (elle a échoué à
    // tous les tests de bloc ci-dessus, y compris un tableau mal formé), ce qui
    // garantit la progression de la boucle. Les suivantes sont agrégées tant
    // qu'aucun bloc ne démarre : les retours à la ligne simples sont conservés,
    // comme en GFM.
    const paragraph: Inline[][] = [parseInline(line)];
    i++;
    while (i < lines.length && !startsBlock(lines[i].trim())) {
      paragraph.push(parseInline(lines[i].trim()));
      i++;
    }
    blocks.push({ kind: 'paragraph', lines: paragraph });
  }

  return blocks;
}
