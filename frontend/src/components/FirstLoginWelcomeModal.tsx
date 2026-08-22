import React, { useState } from 'react';
import { Lock, Eye, EyeOff, Loader2, PartyPopper, ShieldCheck } from 'lucide-react';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { apiFetch, isServiceUnreachable } from '../services/api';

interface FirstLoginWelcomeModalProps {
  open: boolean;
  userName: string;
  onClose: () => void;
}

/**
 * Modale d'accueil affichée lors de la première connexion : invite l'utilisateur
 * à remplacer son mot de passe temporaire. Le bouton « Passer » permet de
 * différer ce changement (le flag de première connexion est alors consommé).
 */
export const FirstLoginWelcomeModal: React.FC<FirstLoginWelcomeModalProps> = ({ open, userName, onClose }) => {
  const { showToast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [localError, setLocalError] = useState('');

  if (!open) return null;

  const resetForm = () => {
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setLocalError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!newPassword || !confirmPassword) {
      setLocalError('Veuillez remplir les deux champs.');
      return;
    }
    if (newPassword.length < 8) {
      setLocalError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await apiFetch('/api/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({ newPassword })
      });
      // Le changement de mot de passe invalide l'ancien JWT (tokenVersion) :
      // on remplace la copie locale en respectant la sémantique du login
      // (localStorage = « se souvenir de moi », sinon sessionStorage).
      if (typeof data?.token === 'string' && data.token) {
        try {
          if (localStorage.getItem('euraxess_token') !== null) {
            localStorage.setItem('euraxess_token', data.token);
          } else {
            sessionStorage.setItem('euraxess_token', data.token);
          }
        } catch {
          // ignore storage failures
        }
      }
      showToast('Mot de passe défini avec succès. Bienvenue !', 'success');
      resetForm();
      onClose();
    } catch (err: any) {
      if (!isServiceUnreachable(err)) {
        setLocalError(err.message || 'Erreur lors de la définition du mot de passe.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setIsSkipping(true);
    try {
      await apiFetch('/api/auth/first-login/acknowledge', { method: 'POST' });
      showToast(`Bienvenue ${userName} ! Pensez à changer votre mot de passe depuis votre profil.`, 'info');
      resetForm();
      onClose();
    } catch {
      // Même en cas d'échec réseau on referme : l'invite réapparaîtra à la
      // prochaine session tant que le flag n'aura pas été consommé.
      resetForm();
      onClose();
    } finally {
      setIsSkipping(false);
    }
  };

  return (
    <Modal open={open} onClose={() => {}} maxWidth="max-w-md" showClose={false}>
      <div className="space-y-4 text-xs">
        <div className="text-center space-y-2 pb-3 border-b border-slate-100">
          <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-[#005596] to-[#B8167C] text-white flex items-center justify-center">
            <PartyPopper className="w-5 h-5" />
          </div>
          <h3 className="font-extrabold text-base text-[#1C2529]">Bienvenue {userName} !</h3>
          <p className="text-[#55636B] leading-relaxed">
            Votre compte a été créé avec un mot de passe temporaire.
            Choisissez un nouveau mot de passe personnel pour sécuriser votre accès.
          </p>
        </div>

        {localError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-medium flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{localError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="font-extrabold text-[#55636B] uppercase tracking-wider text-[10px] block mb-1.5">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A98A1]" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                autoFocus
                className="w-full pl-10 pr-11 py-3 bg-[#E8F1F8]/60 focus:bg-white border border-[#C9D4DE] focus:border-[#005596] rounded-xl font-bold placeholder-[#8A98A1]/60 focus:outline-none focus:ring-2 focus:ring-[#005596]/20 transition-all"
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

          <div>
            <label className="font-extrabold text-[#55636B] uppercase tracking-wider text-[10px] block mb-1.5">
              Confirmer le mot de passe
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A98A1]" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                className="w-full pl-10 pr-4 py-3 bg-[#E8F1F8]/60 focus:bg-white border border-[#C9D4DE] focus:border-[#005596] rounded-xl font-bold placeholder-[#8A98A1]/60 focus:outline-none focus:ring-2 focus:ring-[#005596]/20 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-gradient-to-r from-[#B8167C] to-[#9A1268] hover:from-[#9A1268] hover:to-[#7D0E56] text-white font-extrabold rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 mt-1"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Définition en cours...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Définir mon mot de passe
              </>
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={handleSkip}
          disabled={isSkipping || isSubmitting}
          className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-60"
        >
          {isSkipping ? '...' : 'Passer'}
        </button>
        <p className="text-[10px] text-[#8A98A1] text-center -mt-1">
          Vous pourrez changer votre mot de passe à tout moment depuis « Mon profil ».
        </p>
      </div>
    </Modal>
  );
};
