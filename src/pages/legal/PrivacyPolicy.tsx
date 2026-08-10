import { Fragment, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import privacyMarkdown from '../../../legal/privacy-policy.md?raw';
import { parseMarkdown, type Block, type Inline } from '../../lib/markdown';

/**
 * Politique de confidentialité RGPD, route publique /legal/privacy.
 *
 * Source unique : legal/privacy-policy.md (document versionné du dépôt), importé
 * en brut et rendu ici. Toute mise à jour du document se reflète sans toucher au
 * composant. URL de production :
 * https://narbo-nordik.vercel.app/legal/privacy
 */

const BLOCKS = parseMarkdown(privacyMarkdown);

function renderInline(nodes: Inline[]) {
  return nodes.map((node, i) => {
    switch (node.kind) {
      case 'strong':
        return (
          <strong key={i} className="font-semibold text-neutral-900">
            {node.value}
          </strong>
        );
      case 'em':
        return <em key={i}>{node.value}</em>;
      case 'link':
        return (
          <a
            key={i}
            href={node.href}
            {...(node.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="text-accent-dark underline underline-offset-2 break-words hover:text-primary"
          >
            {node.label}
          </a>
        );
      default:
        return <Fragment key={i}>{node.value}</Fragment>;
    }
  });
}

function renderLines(lines: Inline[][]) {
  return lines.map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {renderInline(line)}
    </Fragment>
  ));
}

function renderBlock(block: Block, key: number) {
  switch (block.kind) {
    case 'divider':
      return <hr key={key} className="my-8 border-neutral-200" />;

    case 'heading':
      if (block.level === 1) {
        return (
          <h1
            key={key}
            className="font-display text-2xl font-bold leading-tight text-neutral-900 sm:text-3xl"
          >
            {renderInline(block.content)}
          </h1>
        );
      }
      if (block.level === 2) {
        return (
          <h2 key={key} className="font-display mt-8 mb-3 text-h2 font-bold text-neutral-900">
            {renderInline(block.content)}
          </h2>
        );
      }
      return (
        <h3 key={key} className="mt-6 mb-2 text-h3 font-semibold text-neutral-900">
          {renderInline(block.content)}
        </h3>
      );

    case 'paragraph':
      return (
        <p key={key} className="my-3 text-body leading-relaxed text-neutral-700">
          {renderLines(block.lines)}
        </p>
      );

    case 'list':
      return (
        <ul
          key={key}
          className="my-3 list-disc space-y-2 pl-5 text-body leading-relaxed text-neutral-700 marker:text-accent-dark"
        >
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );

    case 'quote':
      return (
        <blockquote
          key={key}
          className="my-4 rounded-r-xl border-l-4 border-accent bg-bg-elevated px-4 py-3 text-body leading-relaxed text-neutral-700"
        >
          {renderLines(block.lines)}
        </blockquote>
      );

    case 'table': {
      const hasHead = block.head.some(cell => cell.length > 0);
      // Au-delà de 2 colonnes, on impose une largeur minimale et la table défile
      // dans son conteneur : sur mobile, la compression rendrait les cellules
      // illisibles. À 2 colonnes, elle tient dans la largeur d'écran.
      const columns = Math.max(block.head.length, block.rows[0]?.length ?? 0);
      return (
        <div
          key={key}
          className="my-5 overflow-x-auto rounded-xl border border-neutral-200 bg-bg-elevated"
        >
          <table
            className={`w-full border-collapse text-body-sm ${columns > 2 ? 'min-w-[34rem]' : ''}`}
          >
            {hasHead && (
              <thead>
                <tr className="bg-neutral-50">
                  {block.head.map((cell, i) => (
                    <th
                      key={i}
                      scope="col"
                      className="border-b border-neutral-200 px-3 py-2.5 text-left font-semibold text-neutral-900"
                    >
                      {renderInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r} className="border-b border-neutral-100 last:border-0">
                  {row.map((cell, c) => (
                    <td key={c} className="px-3 py-2.5 align-top leading-relaxed text-neutral-700">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  }
}

export default function PrivacyPolicy() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Politique de confidentialité | Narbo Nordik Club';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="min-h-screen bg-bg-base">
      <header className="safe-top bg-primary text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <img
            src="/logo-club.png"
            alt="Narbo Nordik Club"
            className="h-9 w-9 shrink-0 rounded-full"
          />
          <div className="min-w-0">
            <p className="label-micro text-accent">Narbo Nordik Club</p>
            <p className="text-caption text-neutral-300">Document légal public</p>
          </div>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-caption text-neutral-300">
            <ShieldCheck size={14} className="text-accent" />
            RGPD
          </span>
        </div>
        <div className="h-0.5 bg-accent" />
      </header>

      <main className="animate-fade-in mx-auto max-w-3xl px-4 pt-8 pb-16 safe-x">
        <article>{BLOCKS.map(renderBlock)}</article>

        <div className="mt-10 border-t border-neutral-200 pt-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-body-sm font-medium text-neutral-600 hover:text-primary"
          >
            <ArrowLeft size={16} />
            Retour à l'application
          </Link>
        </div>
      </main>
    </div>
  );
}
