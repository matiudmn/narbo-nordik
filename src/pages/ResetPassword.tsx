import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Ton mot de passe doit faire au moins 6 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => navigate('/', { replace: true }), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Lock size={24} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900">Choisis ton nouveau mot de passe</h1>
          <p className="text-sm text-neutral-500 mt-1">Il faut au moins 6 caractères.</p>
        </div>

        {success ? (
          <div className="bg-success-50 border border-success-100 rounded-lg p-4 text-center">
            <p className="text-success-700 font-medium">Mot de passe modifié !</p>
            <p className="text-success-600 text-sm mt-1">Redirection en cours…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              placeholder="Nouveau mot de passe (min. 6 car.)"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              type="password"
              placeholder="Confirmer le mot de passe"
              autoComplete="new-password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {error && <p className="text-danger text-sm">{error}</p>}
            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={loading}
              disabled={!password || !confirm}
            >
              Enregistrer le nouveau mot de passe
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
