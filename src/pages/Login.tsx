import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui';

export default function Login() {
  const { login, signup, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const err = await login(email, password);
    setLoading(false);
    if (err) setError('Email ou mot de passe incorrect. Réessaie ou réinitialise ton mot de passe.');
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Ton mot de passe doit faire au moins 6 caractères.');
      return;
    }
    setLoading(true);
    const err = await signup(email, password, firstname.trim(), lastname.trim(), inviteCode.trim());
    setLoading(false);
    if (err) setError(err);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Entre ton email pour recevoir le lien.');
      return;
    }
    setError('');
    setLoading(true);
    const err = await resetPassword(email);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      setResetSent(true);
    }
  };

  const switchMode = (newMode: 'login' | 'signup' | 'reset') => {
    setMode(newMode);
    setError('');
    setResetSent(false);
  };

  const inputClass =
    'w-full px-4 py-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo-club.png" alt="Narbo Nordik" className="h-24 w-24 rounded-full mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white tracking-tight">NARBO NORDIK</h1>
          <p className="text-white/60 mt-1">Club Running & Trail</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-xl">
          {mode === 'reset' ? (
            <>
              <h2 className="text-lg font-bold text-neutral-900 mb-4">Mot de passe oublié</h2>
              {resetSent ? (
                <div className="text-center py-4">
                  <p className="text-sm text-success-600 mb-4">
                    Un email de réinitialisation a été envoyé à {email}.
                  </p>
                  <button
                    onClick={() => switchMode('login')}
                    className="text-sm text-primary font-medium"
                  >
                    Retour à la connexion
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-3">
                  <p className="text-sm text-neutral-500 mb-2">
                    Entre ton email pour recevoir un lien de réinitialisation.
                  </p>
                  <label htmlFor="reset-email" className="sr-only">Email</label>
                  <input
                    id="reset-email"
                    type="email" placeholder="Email" autoComplete="email"
                    value={email} onChange={e => setEmail(e.target.value)}
                    aria-describedby={error ? 'reset-error' : undefined}
                    className={inputClass}
                  />
                  {error && <p id="reset-error" role="alert" className="text-danger text-sm">{error}</p>}
                  <Button type="submit" variant="accent" size="lg" fullWidth loading={loading}>
                    Envoyer le lien
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    fullWidth
                    onClick={() => switchMode('login')}
                  >
                    Retour
                  </Button>
                </form>
              )}
            </>
          ) : mode === 'signup' ? (
            <>
              <h2 className="text-lg font-bold text-neutral-900 mb-4">Créer mon compte</h2>
              <form onSubmit={handleSignup} className="space-y-3">
                <div className="flex gap-2">
                  <label htmlFor="signup-firstname" className="sr-only">Prénom</label>
                  <input
                    id="signup-firstname"
                    type="text" placeholder="Prénom" required autoComplete="given-name"
                    value={firstname} onChange={e => setFirstname(e.target.value)}
                    aria-describedby={error ? 'signup-error' : undefined}
                    className={`w-1/2 ${inputClass.replace('w-full ', '')}`}
                  />
                  <label htmlFor="signup-lastname" className="sr-only">Nom</label>
                  <input
                    id="signup-lastname"
                    type="text" placeholder="Nom" required autoComplete="family-name"
                    value={lastname} onChange={e => setLastname(e.target.value)}
                    aria-describedby={error ? 'signup-error' : undefined}
                    className={`w-1/2 ${inputClass.replace('w-full ', '')}`}
                  />
                </div>
                <label htmlFor="signup-email" className="sr-only">Email</label>
                <input
                  id="signup-email"
                  type="email" placeholder="Email" required autoComplete="email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  aria-describedby={error ? 'signup-error' : undefined}
                  className={inputClass}
                />
                <label htmlFor="signup-password" className="sr-only">Mot de passe (minimum 6 caractères)</label>
                <input
                  id="signup-password"
                  type="password" placeholder="Mot de passe (min. 6 car.)" required autoComplete="new-password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  aria-describedby={error ? 'signup-error' : undefined}
                  className={inputClass}
                />
                <div>
                  <label htmlFor="signup-invite-code" className="sr-only">Code d'invitation</label>
                  <input
                    id="signup-invite-code"
                    type="text" placeholder="Code d'invitation" required autoComplete="off"
                    value={inviteCode} onChange={e => setInviteCode(e.target.value)}
                    aria-describedby={error ? 'signup-invite-help signup-error' : 'signup-invite-help'}
                    className={inputClass}
                  />
                  <p id="signup-invite-help" className="text-xs text-neutral-400 mt-1">
                    Demande-le à ton coach.
                  </p>
                </div>
                {error && <p id="signup-error" role="alert" className="text-danger text-sm">{error}</p>}
                <Button
                  type="submit"
                  variant="accent"
                  size="lg"
                  fullWidth
                  loading={loading}
                  disabled={!firstname || !lastname || !inviteCode}
                >
                  S'inscrire
                </Button>
              </form>
              <button
                onClick={() => switchMode('login')}
                className="mt-4 w-full text-sm text-neutral-400 hover:text-neutral-600 text-center"
              >
                Déjà inscrit·e ? Connecte-toi
              </button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-neutral-900 mb-4">Connexion</h2>
              <form onSubmit={handleLogin} className="space-y-3">
                <label htmlFor="login-email" className="sr-only">Email</label>
                <input
                  id="login-email"
                  type="email" placeholder="Email" autoComplete="email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  aria-describedby={error ? 'login-error' : undefined}
                  className={inputClass}
                />
                <label htmlFor="login-password" className="sr-only">Mot de passe</label>
                <input
                  id="login-password"
                  type="password" placeholder="Mot de passe" autoComplete="current-password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  aria-describedby={error ? 'login-error' : undefined}
                  className={inputClass}
                />
                {error && <p id="login-error" role="alert" className="text-danger text-sm">{error}</p>}
                <Button type="submit" variant="accent" size="lg" fullWidth loading={loading}>
                  Se connecter
                </Button>
              </form>
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => switchMode('reset')}
                  className="w-full text-sm text-neutral-400 hover:text-neutral-600 text-center"
                >
                  Mot de passe oublié ?
                </button>
                <button
                  onClick={() => switchMode('signup')}
                  className="w-full text-sm text-primary font-medium hover:text-primary-light text-center"
                >
                  Rejoindre Narbo Nordik
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
