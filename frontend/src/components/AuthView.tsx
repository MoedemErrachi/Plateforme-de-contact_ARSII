import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { User as AuthUser } from '../types';
import { apiFetch } from '../services/api';

interface AuthViewProps {
  onLoginSuccess: (userData: AuthUser) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Forgot Password Modal State
  // Ouverture directe de la modale via /login?forgot=1 : utilisée par la page
  // « lien expiré » pour redemander un nouveau lien de réinitialisation.
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(
    () => searchParams.get('forgot') === '1'
  );
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get('forgot') === '1') {
      setIsForgotPasswordOpen(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      showToast('Veuillez remplir votre identifiant et votre mot de passe.', 'error');
      return;
    }

    setIsLoading(true);

    try {
      // Couche API centralisée : erreurs réseau/timeout normalisées en
      // français. Un 401 ici est un résultat métier (identifiants invalides),
      // pas une session expirée — aucun effet de bord sur l'état de connexion.
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, rememberMe })
      });

      const u = data?.user || data?.data?.user;
      if (typeof data?.token === 'string' && data.token) {
        try {
          if (rememberMe) {
            localStorage.setItem('euraxess_token', data.token);
          } else {
            sessionStorage.setItem('euraxess_token', data.token);
          }
        } catch {
          // ignore storage failures
        }
      }
      onLoginSuccess({
        id: u?.id,
        name: u?.name || email.split('@')[0].toUpperCase(),
        email: u?.email || email,
        role: u?.role || 'user',
        privilege: u?.privilege || 'FULL_ACCESS',
        avatarUrl: u?.avatarUrl || null,
        isFirstLogin: Boolean(u?.isFirstLogin)
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Identifiants invalides. Veuillez réessayer.', 'error');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-[#F1F7FC]">
      {/* Mesh Background Gradients */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-80"
        style={{
          background: `
            radial-gradient(at 0% 0%, #F1F7FC 0%, transparent 50%),
            radial-gradient(at 100% 0%, #D9E6F2 0%, transparent 50%),
            radial-gradient(at 100% 100%, #E8F1F8 0%, transparent 50%),
            radial-gradient(at 0% 100%, #ffffff 0%, transparent 50%)
          `
        }}
      />

      {/* Floating Decorative Elements */}
      <div className="absolute top-10 left-10 w-48 h-48 bg-[#005596]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-64 h-64 bg-[#005596]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Authentication Card Container */}
      <main className="w-full max-w-[440px] z-10 animate-fade-in my-auto">
        
        {/* Auth Card */}
        <div className="bg-white rounded-[16px] p-8 sm:p-10 shadow-xl border border-[#C9D4DE]/40 flex flex-col items-center relative">
          
          {/* Logo Badge */}
          <div className="mb-6 relative">
            <span className="block w-24 h-24 rounded-full bg-white shadow-md p-1.5 border border-[#C9D4DE]/40">
              <img
                src="/euraxess-africa-logo.png"
                alt="EURAXESS Africa"
                className="w-full h-full object-contain"
              />
            </span>
            <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-1 shadow-sm" title="Réseau Sécurisé SSL/TLS">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Header Text */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-black text-[#1C2529] tracking-tight mb-1">
              Bienvenue sur EURAXESS Africa
            </h1>
            <p className="text-xs font-semibold text-[#55636B]">
              Écosystème de contacts R&I Europe-Afrique
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
            
            {/* Email Field */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-[11px] font-extrabold text-[#55636B] uppercase tracking-wider">
                IDENTIFIANT / E-MAIL
              </label>
              <div className="relative group">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A98A1] group-focus-within:text-[#005596] transition-colors" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre.nom@euraxess-africa.org"
                  className="w-full pl-10 pr-4 py-3 bg-[#E8F1F8]/60 focus:bg-white border border-[#C9D4DE] focus:border-[#005596] rounded-xl text-xs font-bold text-[#1C2529] placeholder-[#8A98A1]/60 focus:outline-none focus:ring-2 focus:ring-[#005596]/20 transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-[11px] font-extrabold text-[#55636B] uppercase tracking-wider">
                MOT DE PASSE
              </label>
              <div className="relative group">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A98A1] group-focus-within:text-[#005596] transition-colors" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-3 bg-[#E8F1F8]/60 focus:bg-white border border-[#C9D4DE] focus:border-[#005596] rounded-xl text-xs font-bold text-[#1C2529] placeholder-[#8A98A1]/60 focus:outline-none focus:ring-2 focus:ring-[#005596]/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A98A1] hover:text-[#005596] transition-colors focus:outline-none cursor-pointer p-1"
                  title={showPassword ? 'Masquer' : 'Afficher'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Extra Options */}
            <div className="flex items-center justify-between mt-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-[#C9D4DE] text-[#005596] focus:ring-[#005596] cursor-pointer"
                />
                <span className="text-xs font-semibold text-[#55636B] group-hover:text-[#1C2529] transition-colors">
                  Se souvenir de moi
                </span>
              </label>
              
              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(true)}
                className="text-xs font-bold text-[#005596] hover:underline decoration-2 underline-offset-4 transition-all cursor-pointer"
              >
                Mot de passe oublié ?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#005596] to-[#004275] hover:from-[#004275] hover:to-[#003B66] text-white font-extrabold rounded-xl text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-75"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Connexion en cours...</span>
                </>
              ) : (
                <>
                  <span>Se connecter</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

          </form>

        </div>

        {/* Network Copyright Anchor */}
        <p className="text-center mt-6 text-xs font-semibold text-[#55636B]/70">
          © {new Date().getFullYear()} EURAXESS Africa Recherche & Innovation
        </p>

      </main>

      {/* FORGOT PASSWORD MODAL */}
      {isForgotPasswordOpen && (
        <Modal
          open={isForgotPasswordOpen}
          onClose={() => { setIsForgotPasswordOpen(false); setResetSent(false); }}
          maxWidth="max-w-md"
          title={<h3 className="font-extrabold text-base text-[#1C2529]">Réinitialisation du mot de passe</h3>}
        >
          {resetSent ? (
              <div className="py-4 text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-800">Un e-mail de réinitialisation a été envoyé !</p>
                <p className="text-[11px] text-slate-500">
                  Consultez votre boîte de réception pour définir un nouveau mot de passe sécurisé.
                </p>
                <button
                  onClick={() => { setIsForgotPasswordOpen(false); setResetSent(false); }}
                  className="px-5 py-2 bg-[#005596] text-white font-bold text-xs rounded-xl shadow cursor-pointer mt-2"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!resetEmail.trim()) return;
                  setIsResetLoading(true);
                  try {
                    await apiFetch('/api/auth/forgot-password', {
                      method: 'POST',
                      body: JSON.stringify({ email: resetEmail.trim().toLowerCase() }),
                      suppressGlobalError: true // énumération d'e-mails : succès affiché quoi qu'il arrive
                    });
                  } catch {
                    // Silently ignore — we always show success to prevent email enumeration
                  } finally {
                    setIsResetLoading(false);
                    setResetSent(true);
                  }
                }} 
                className="space-y-4 text-xs"
              >
                <p className="text-slate-600 text-xs">
                  Saisissez l'adresse e-mail associée à votre compte EURAXESS Africa. Un lien sécurisé vous sera transmis immédiatement.
                </p>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">E-mail professionnel EURAXESS Africa *</label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="votre.nom@euraxess-africa.org"
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#005596]"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotPasswordOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isResetLoading}
                    className="px-5 py-2 bg-[#005596] text-white font-bold rounded-xl shadow flex items-center gap-2 cursor-pointer disabled:opacity-75"
                  >
                    {isResetLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Envoi...</span>
                      </>
                    ) : (
                      'Envoyer le lien'
                    )}
                  </button>
                </div>
              </form>
            )}
        </Modal>
      )}

    </div>
  );
};
