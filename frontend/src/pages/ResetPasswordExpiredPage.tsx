import React from 'react';
import { Link } from 'react-router-dom';
import { LinkIcon, RotateCcw, ShieldAlert } from 'lucide-react';

/**
 * Page dédiée aux liens de réinitialisation expirés ou déjà utilisés.
 * L'utilisateur peut redemander un nouveau lien : /login?forgot=1 ouvre
 * directement la modale « Mot de passe oublié ».
 */
export const ResetPasswordExpiredPage: React.FC = () => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#F1F7FC]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center space-y-5 animate-fade-in">
        <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 flex items-center justify-center">
          <ShieldAlert className="w-7 h-7 text-amber-500" />
        </div>

        <div className="space-y-2">
          <h1 className="text-lg font-extrabold text-[#1C2529]">Lien expiré</h1>
          <p className="text-xs text-[#55636B] leading-relaxed">
            Ce lien de réinitialisation est invalide, expiré ou a déjà été utilisé.
            Pour des raisons de sécurité, les liens ne sont valables qu'une seule fois
            et pendant une durée limitée.
          </p>
        </div>

        <Link
          to="/login?forgot=1"
          className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 bg-gradient-to-r from-[#005596] to-[#004275] hover:from-[#004275] hover:to-[#003B66] text-white font-extrabold rounded-xl text-sm shadow-md transition-all active:scale-[0.98]"
        >
          <RotateCcw className="w-4 h-4" />
          Demander un nouveau lien
        </Link>

        <p className="text-[11px] text-[#8A98A1] flex items-center justify-center gap-1.5">
          <LinkIcon className="w-3.5 h-3.5" />
          Un nouveau lien vous sera envoyé par e-mail.
        </p>
      </div>
    </div>
  );
};
