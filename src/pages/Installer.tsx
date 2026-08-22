import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Download, ShieldAlert, Smartphone, Share, Star, TriangleAlert } from 'lucide-react';
import { Button, Card } from '../components/ui';
import { isSamsungBrowser } from '../lib/platform';

/**
 * Aide à l'installation, route publique /installer.
 *
 * Envoyée en lien direct dans le groupe WhatsApp du club à un membre qui
 * bloque : elle doit donc s'ouvrir sans session. Le bloc Samsung passe en
 * premier quand le navigateur Samsung est détecté, puisque c'est lui qui
 * déclenche le message de sécurité d'Android.
 */

const APP_URL = 'https://narbo-nordik.vercel.app';

function Paragraph({ children }: { children: ReactNode }) {
  return <p className="text-body leading-relaxed text-neutral-700">{children}</p>;
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="list-decimal space-y-2 pl-5 text-body leading-relaxed text-neutral-700 marker:font-semibold marker:text-accent-text">
      {items.map(item => (
        <li key={item}>{item}</li>
      ))}
    </ol>
  );
}

function Section({
  icon,
  title,
  className = '',
  children,
}: {
  icon: ReactNode;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card padding="lg" className={['space-y-3', className].filter(Boolean).join(' ')}>
      <h2 className="font-display flex items-start gap-2 text-h2 font-bold text-neutral-900">
        <span className="mt-0.5 shrink-0" aria-hidden="true">
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </Card>
  );
}

function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(APP_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="accent"
      onClick={handleCopy}
      leftIcon={copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
    >
      {copied ? 'Lien copié' : 'Copier le lien'}
    </Button>
  );
}

export default function Installer() {
  const samsung = isSamsungBrowser();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Installer l'appli du club | Narbo Nordik Club";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="min-h-screen bg-bg-base">
      <header className="safe-top bg-primary text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <img src="/logo-club.png" alt="Narbo Nordik Club" className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0">
            <p className="label-micro text-accent">Narbo Nordik Club</p>
            <p className="text-caption text-neutral-300">Aide à l'installation</p>
          </div>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-caption text-neutral-300">
            <Download size={14} className="text-accent" aria-hidden="true" />
            Appli
          </span>
        </div>
        <div className="h-0.5 bg-accent" />
      </header>

      <main className="animate-fade-in mx-auto max-w-3xl px-4 pt-8 pb-16 safe-x">
        <h1 className="font-display text-2xl font-bold leading-tight text-neutral-900 sm:text-3xl">
          Installer l'appli du club
        </h1>
        <p className="mt-3 text-body leading-relaxed text-neutral-700">
          L'appli s'utilise très bien dans le navigateur. L'installer sert juste à avoir l'icône sur ton écran
          d'accueil et à l'ouvrir en plein écran, sans barre d'adresse. Si ça coince, ce n'est pas grave, le favori
          marche aussi bien.
        </p>

        <div className="mt-8 space-y-4">
          {samsung && (
            <Section
              icon={<TriangleAlert size={20} className="text-warning-700" />}
              title="Ton téléphone ouvre le navigateur Samsung"
              className="border-warning-500"
            >
              <Paragraph>
                L'installation depuis le navigateur Samsung ne fonctionne pas en ce moment, et Android affiche un
                message de sécurité. Ce n'est pas un virus, et ce n'est pas l'appli du club : c'est un défaut connu de
                Samsung qui touche beaucoup d'applications de ce type.
              </Paragraph>
              <Paragraph>
                Pour installer, ouvre cette page dans Chrome, le rond de couleur avec du rouge, du jaune et du vert.
              </Paragraph>
              <CopyLinkButton />
              <Paragraph>
                Ensuite, dans Chrome, appuie sur la barre en haut de l'écran, colle le lien, et suis les étapes Android
                ci-dessous.
              </Paragraph>
            </Section>
          )}

          <Section
            icon={<Share size={20} className="text-accent-text" />}
            title="Si tu as un iPhone ou un iPad"
          >
            <Paragraph>À faire depuis Safari. Depuis Chrome ou Firefox, l'option n'existe pas.</Paragraph>
            <Steps
              items={[
                "Appuie sur les trois petits points en bas à droite de l'écran, puis sur Partager. Sur les iPhone plus anciens, le bouton Partager est directement dans la barre du bas : c'est le carré avec une flèche vers le haut.",
                "Fais défiler le menu si besoin, et choisis Sur l'écran d'accueil.",
                'Appuie sur Ajouter, en haut à droite.',
              ]}
            />
          </Section>

          <Section
            icon={<Smartphone size={20} className="text-accent-text" />}
            title="Si tu as un téléphone Android"
          >
            <Paragraph>À faire depuis Chrome, le rond de couleur avec du rouge, du jaune et du vert.</Paragraph>
            <Steps
              items={[
                "Utilise l'appli une trentaine de secondes avant d'essayer. Chrome ne propose l'installation qu'une fois que tu t'en es servi un peu.",
                'Appuie sur les trois petits points en haut à droite.',
                "Choisis Installer et créer un raccourci, puis Installer. Selon l'âge du téléphone, l'entrée peut s'appeler Installer l'application ou Ajouter à l'écran d'accueil.",
                'Confirme.',
              ]}
            />
          </Section>

          <Section
            icon={<Download size={20} className="text-accent-text" />}
            title="Si Installer ne marche pas, ou n'apparaît pas"
          >
            <Paragraph>
              Au même endroit, dans les trois petits points, choisis Créer un raccourci puis Ajouter. Tu obtiens la
              même icône sur ton écran d'accueil, ça fonctionne sur tous les téléphones, et aucun message de sécurité
              n'apparaît.
            </Paragraph>
          </Section>

          <Section
            icon={<Star size={20} className="text-accent-text" />}
            title="Je ne veux rien installer du tout"
          >
            <Paragraph>
              Aucun souci, et c'est même le plus simple. Mets la page en favori avec l'étoile de ton navigateur. Tu
              retrouveras le club dans tes favoris, et tout fonctionne exactement pareil.
            </Paragraph>
          </Section>

          <Section
            icon={<ShieldAlert size={20} className="text-accent-text" />}
            title="Mon téléphone affiche un message de sécurité"
          >
            <Paragraph>
              Si ton téléphone affiche un message qui parle de sécurité ou d'application bloquée, ferme-le et
              recommence depuis Chrome. N'appuie pas sur Installer quand même : ce n'est pas nécessaire ici, et ce
              n'est pas un réflexe à prendre.
            </Paragraph>
            <Paragraph>
              Si ça bloque encore, envoie une photo de l'écran dans le groupe du club, on regarde ensemble.
            </Paragraph>
          </Section>
        </div>

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
