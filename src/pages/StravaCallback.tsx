import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useStrava } from '../hooks/useStrava';

export default function StravaCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { connect } = useStrava();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setStatus('error');
      setErrorMsg(errorParam === 'access_denied'
        ? 'Vous avez refuse la connexion Strava.'
        : `Erreur Strava : ${errorParam}`);
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMsg('Code d\'autorisation manquant.');
      return;
    }

    connect(code).then((success) => {
      if (success) {
        setStatus('success');
        setTimeout(() => navigate('/profile', { state: { stravaConnected: true } }), 1500);
      } else {
        setStatus('error');
        setErrorMsg('Impossible de finaliser la connexion Strava.');
      }
    });
  }, [searchParams, connect, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-[#FC4C02] animate-spin mx-auto mb-4" />
            <p className="text-gray-700 font-medium">Connexion a Strava en cours...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-700 font-medium">Strava connecte avec succes !</p>
            <p className="text-gray-500 text-sm mt-2">Redirection vers votre profil...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-700 font-medium mb-2">Erreur de connexion</p>
            <p className="text-gray-500 text-sm mb-4">{errorMsg}</p>
            <button
              onClick={() => navigate('/profile')}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
            >
              Retour au profil
            </button>
          </>
        )}
      </div>
    </div>
  );
}
