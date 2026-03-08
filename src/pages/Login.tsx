import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const { login, signup, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
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
    if (err) setError('Email ou mot de passe incorrect');
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caracteres');
      return;
    }
    setLoading(true);
    const err = await signup(email, password, firstname.trim(), lastname.trim());
    setLoading(false);
    if (err) setError(err);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Entrez votre email');
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
              <h2 className="text-lg font-bold text-gray-900 mb-4">Mot de passe oublie</h2>
              {resetSent ? (
                <div className="text-center py-4">
                  <p className="text-sm text-green-600 mb-4">
                    Un email de reinitialisation a ete envoye a {email}
                  </p>
                  <button
                    onClick={() => switchMode('login')}
                    className="text-sm text-primary font-medium"
                  >
                    Retour a la connexion
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-3">
                  <p className="text-sm text-gray-500 mb-2">
                    Entrez votre email pour recevoir un lien de reinitialisation.
                  </p>
                  <input
                    type="email" placeholder="Email"
                    value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <button
                    type="submit" disabled={loading}
                    className="w-full bg-accent text-white font-semibold py-3 rounded-xl hover:bg-accent-light transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    Envoyer
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="w-full text-sm text-gray-500 hover:text-gray-700"
                  >
                    Retour
                  </button>
                </form>
              )}
            </>
          ) : mode === 'signup' ? (
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-4">Creer un compte</h2>
              <form onSubmit={handleSignup} className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text" placeholder="Prenom" required
                    value={firstname} onChange={e => setFirstname(e.target.value)}
                    className="w-1/2 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <input
                    type="text" placeholder="Nom" required
                    value={lastname} onChange={e => setLastname(e.target.value)}
                    className="w-1/2 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <input
                  type="email" placeholder="Email" required
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <input
                  type="password" placeholder="Mot de passe (min. 6 car.)" required
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button
                  type="submit" disabled={loading || !firstname || !lastname}
                  className="w-full bg-accent text-white font-semibold py-3 rounded-xl hover:bg-accent-light transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  S'inscrire
                </button>
              </form>
              <button
                onClick={() => switchMode('login')}
                className="mt-4 w-full text-sm text-gray-400 hover:text-gray-600 text-center"
              >
                Deja un compte ? Se connecter
              </button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-4">Connexion</h2>
              <form onSubmit={handleLogin} className="space-y-3">
                <input
                  type="email" placeholder="Email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <input
                  type="password" placeholder="Mot de passe"
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button
                  type="submit" disabled={loading}
                  className="w-full bg-accent text-white font-semibold py-3 rounded-xl hover:bg-accent-light transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  Se connecter
                </button>
              </form>
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => switchMode('reset')}
                  className="w-full text-sm text-gray-400 hover:text-gray-600 text-center"
                >
                  Mot de passe oublie ?
                </button>
                <button
                  onClick={() => switchMode('signup')}
                  className="w-full text-sm text-primary font-medium hover:text-primary-light text-center"
                >
                  Rejoindre le club
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
