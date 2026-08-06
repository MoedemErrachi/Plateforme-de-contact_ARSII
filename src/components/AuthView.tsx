import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, ShieldCheck, Sparkles, CheckCircle2, ArrowRight, HelpCircle, X, Mail, Building2 } from 'lucide-react';
import { ArsiiLogo } from './ArsiiLogo';
import { User as AuthUser } from '../types';

interface AuthViewProps {
  onLoginSuccess: (userData: AuthUser) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Forgot Password Modal State
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // Request Access Modal State
  const [isRequestAccessOpen, setIsRequestAccessOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ name: '', email: '', org: '', reason: '' });
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Veuillez remplir votre identifiant et votre mot de passe.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password })
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Identifiants invalides. Veuillez réessayer.');
        setIsLoading(false);
        return;
      }

      onLoginSuccess({
        id: data.data?.user?.id,
        name: data.data?.user?.name || email.split('@')[0].toUpperCase(),
        email: data.data?.user?.email || email,
        role: data.data?.user?.role || 'user',
        avatarUrl: data.data?.user?.avatarUrl || null
      });
    } catch (err) {
      setErrorMessage('Erreur réseau. Vérifiez que le serveur est démarré sur le port 5000.');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-[#e4fffe]">
      {/* Mesh Background Gradients */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-80"
        style={{
          background: `
            radial-gradient(at 0% 0%, #e4fffe 0%, transparent 50%),
            radial-gradient(at 100% 0%, #cee8e7 0%, transparent 50%),
            radial-gradient(at 100% 100%, #dff9f8 0%, transparent 50%),
            radial-gradient(at 0% 100%, #ffffff 0%, transparent 50%)
          `
        }}
      />

      {/* Floating Decorative Elements */}
      <div className="absolute top-10 left-10 w-48 h-48 bg-[#35b8b2]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-64 h-64 bg-[#006a66]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Authentication Card Container */}
      <main className="w-full max-w-[440px] z-10 animate-fade-in my-auto">
        
        {/* Auth Card */}
        <div className="bg-white rounded-[16px] p-8 sm:p-10 shadow-xl border border-[#bcc9c7]/40 flex flex-col items-center relative">
          
          {/* Logo Badge */}
          <div className="mb-6 relative">
            <ArsiiLogo className="w-24 h-24 drop-shadow-md" />
            <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-1 shadow-sm" title="Réseau Sécurisé SSL/TLS">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Header Text */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-black text-[#071f1f] tracking-tight mb-1">
              Bienvenue sur ARSII
            </h1>
            <p className="text-xs font-semibold text-[#3d4948]">
              Écosystème de contacts R&I Europe-Afrique
            </p>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="w-full mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium flex items-center gap-2">
              <X className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
            
            {/* Email Field */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-[11px] font-extrabold text-[#3d4948] uppercase tracking-wider">
                IDENTIFIANT / E-MAIL
              </label>
              <div className="relative group">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6d7a78] group-focus-within:text-[#006a66] transition-colors" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre.nom@arsii.org"
                  className="w-full pl-10 pr-4 py-3 bg-[#dff9f8]/60 focus:bg-white border border-[#bcc9c7] focus:border-[#006a66] rounded-xl text-xs font-bold text-[#071f1f] placeholder-[#6d7a78]/60 focus:outline-none focus:ring-2 focus:ring-[#006a66]/20 transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-[11px] font-extrabold text-[#3d4948] uppercase tracking-wider">
                MOT DE PASSE
              </label>
              <div className="relative group">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6d7a78] group-focus-within:text-[#006a66] transition-colors" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-3 bg-[#dff9f8]/60 focus:bg-white border border-[#bcc9c7] focus:border-[#006a66] rounded-xl text-xs font-bold text-[#071f1f] placeholder-[#6d7a78]/60 focus:outline-none focus:ring-2 focus:ring-[#006a66]/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6d7a78] hover:text-[#006a66] transition-colors focus:outline-none cursor-pointer p-1"
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
                  className="w-4 h-4 rounded border-[#bcc9c7] text-[#006a66] focus:ring-[#006a66] cursor-pointer"
                />
                <span className="text-xs font-semibold text-[#3d4948] group-hover:text-[#071f1f] transition-colors">
                  Se souvenir de moi
                </span>
              </label>
              
              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(true)}
                className="text-xs font-bold text-[#006a66] hover:underline decoration-2 underline-offset-4 transition-all cursor-pointer"
              >
                Mot de passe oublié ?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#35b8b2] to-[#256865] hover:from-[#2ca39d] hover:to-[#1d5351] text-white font-extrabold rounded-xl text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-75"
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

          {/* Footer Access Request Link */}
          <div className="mt-6 text-center flex items-center gap-1.5 text-xs">
            <span className="text-[#3d4948] font-medium">Nouveau membre ?</span>
            <button
              type="button"
              onClick={() => setIsRequestAccessOpen(true)}
              className="font-bold text-[#006a66] hover:underline decoration-2 underline-offset-4 cursor-pointer"
            >
              Demander un accès
            </button>
          </div>

        </div>

        {/* Network Copyright Anchor */}
        <p className="text-center mt-6 text-xs font-semibold text-[#3d4948]/70">
          © 2024 Réseau ARSII Recherche & Innovation
        </p>

      </main>

      {/* FORGOT PASSWORD MODAL */}
      {isForgotPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-fade-in relative">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-[#071f1f]">Réinitialisation du mot de passe</h3>
              <button onClick={() => { setIsForgotPasswordOpen(false); setResetSent(false); }} className="p-1 hover:bg-slate-100 rounded-full text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

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
                  className="px-5 py-2 bg-[#006a66] text-white font-bold text-xs rounded-xl shadow cursor-pointer mt-2"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  setResetSent(true);
                }} 
                className="space-y-4 text-xs"
              >
                <p className="text-slate-600 text-xs">
                  Saisissez l'adresse e-mail associée à votre compte ARSII. Un lien sécurisé vous sera transmis immédiatement.
                </p>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">E-mail professionnel ARSII *</label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="votre.nom@arsii.org"
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#006a66]"
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
                    className="px-5 py-2 bg-[#006a66] text-white font-bold rounded-xl shadow"
                  >
                    Envoyer le lien
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* REQUEST ACCESS MODAL */}
      {isRequestAccessOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-fade-in relative">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-[#071f1f]">Demande d'accès au réseau ARSII</h3>
              <button onClick={() => { setIsRequestAccessOpen(false); setRequestSubmitted(false); }} className="p-1 hover:bg-slate-100 rounded-full text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {requestSubmitted ? (
              <div className="py-4 text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-800">Demande transmise avec succès !</p>
                <p className="text-[11px] text-slate-500">
                  L'administration du Réseau ARSII examinera vos informations sous 24h ouvrées.
                </p>
                <button
                  onClick={() => { setIsRequestAccessOpen(false); setRequestSubmitted(false); }}
                  className="px-5 py-2 bg-[#006a66] text-white font-bold text-xs rounded-xl shadow cursor-pointer mt-2"
                >
                  Compris
                </button>
              </div>
            ) : (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  setRequestSubmitted(true);
                }} 
                className="space-y-3 text-xs"
              >
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nom & Prénom *</label>
                  <input
                    type="text"
                    required
                    value={requestForm.name}
                    onChange={(e) => setRequestForm({ ...requestForm, name: e.target.value })}
                    placeholder="ex: Dr. Marie Curie"
                    className="w-full p-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Adresse E-mail institutionnelle *</label>
                  <input
                    type="email"
                    required
                    value={requestForm.email}
                    onChange={(e) => setRequestForm({ ...requestForm, email: e.target.value })}
                    placeholder="m.curie@univ-paris.fr"
                    className="w-full p-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Organisme / Laboratoire *</label>
                  <input
                    type="text"
                    required
                    value={requestForm.org}
                    onChange={(e) => setRequestForm({ ...requestForm, org: e.target.value })}
                    placeholder="ex: CNRS / Institut Pasteur / Université"
                    className="w-full p-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Motif de la demande</label>
                  <textarea
                    rows={3}
                    value={requestForm.reason}
                    onChange={(e) => setRequestForm({ ...requestForm, reason: e.target.value })}
                    placeholder="Précisez votre cadre de collaboration R&I..."
                    className="w-full p-2 border border-slate-200 rounded-xl resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsRequestAccessOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#006a66] text-white font-bold rounded-xl shadow cursor-pointer"
                  >
                    Envoyer ma demande
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
