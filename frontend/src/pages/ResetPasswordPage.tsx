import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';

export const ResetPasswordPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      // Jeton absent dans l'URL : le lien ne peut pas être valide.
      navigate('/reset-password-expired', { replace: true });
    }
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword || !confirmPassword) {
      setError('Veuillez remplir les deux champs.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (!token) {
      navigate('/reset-password-expired', { replace: true });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, newPassword })
      });

      const data = await res.json();

      if (!res.ok) {
        // Lien invalide, expiré ou déjà consommé → page dédiée avec
        // possibilité de redemander un nouveau lien.
        if (res.status === 400 || res.status === 404 || res.status === 410) {
          navigate('/reset-password-expired', { replace: true });
          return;
        }
        setError(data.error || 'Erreur lors de la réinitialisation.');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Erreur réseau. Vérifiez que le serveur est démarré.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-[#F1F7FC]">
        <div className="w-full max-w-[440px] bg-white rounded-[16px] p-8 sm:p-10 shadow-xl border border-[#C9D4DE]/40 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-5">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-black text-[#1C2529] mb-2">Mot de passe réinitialisé</h1>
          <p className="text-sm text-[#55636B] mb-6">
            Votre mot de passe a été modifié avec succès. Vous pouvez maintenant vous connecter.
          </p>
          <Link
            to="/login"
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#005596] to-[#004275] text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            Se connecter
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-[#F1F7FC]">
      <div className="w-full max-w-[440px] bg-white rounded-[16px] p-8 sm:p-10 shadow-xl border border-[#C9D4DE]/40 flex flex-col items-center">
        <div className="mb-6">
          <span className="block w-20 h-20 rounded-full bg-[#005596]/10 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-[#005596]" />
          </span>
        </div>

        <h1 className="text-xl font-black text-[#1C2529] mb-1">Nouveau mot de passe</h1>
        <p className="text-xs text-[#55636B] mb-6 text-center">
          Choisissez un mot de passe sécurisé d'au moins 8 caractères.
        </p>

        {error && (
          <div className="w-full mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-extrabold text-[#55636B] uppercase tracking-wider">
              Nouveau mot de passe
            </label>
            <div className="relative group">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A98A1] group-focus-within:text-[#005596] transition-colors" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-11 py-3 bg-[#E8F1F8]/60 focus:bg-white border border-[#C9D4DE] focus:border-[#005596] rounded-xl text-xs font-bold text-[#1C2529] placeholder-[#8A98A1]/60 focus:outline-none focus:ring-2 focus:ring-[#005596]/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A98A1] hover:text-[#005596] transition-colors cursor-pointer p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-extrabold text-[#55636B] uppercase tracking-wider">
              Confirmer le mot de passe
            </label>
            <div className="relative group">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A98A1] group-focus-within:text-[#005596] transition-colors" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 bg-[#E8F1F8]/60 focus:bg-white border border-[#C9D4DE] focus:border-[#005596] rounded-xl text-xs font-bold text-[#1C2529] placeholder-[#8A98A1]/60 focus:outline-none focus:ring-2 focus:ring-[#005596]/20 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !token}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-[#005596] to-[#004275] hover:from-[#004275] hover:to-[#003B66] text-white font-extrabold rounded-xl text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-75"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Réinitialisation en cours...</span>
              </>
            ) : (
              <>
                <span>Réinitialiser le mot de passe</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <Link to="/login" className="mt-4 text-xs font-bold text-[#005596] hover:underline">
          Retour à la connexion
        </Link>
      </div>
    </div>
  );
};
