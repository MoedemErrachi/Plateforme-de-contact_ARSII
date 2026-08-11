import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ChevronRight, 
  Save, 
  Camera, 
  Loader2, 
  UserCircle, 
  ShieldCheck, 
  LogOut,
  AtSign,
  BadgeCheck
} from 'lucide-react';
import { User } from '../types';
import { useToast } from './Toast';
import { validateImageFile, uploadImage, readFileAsDataUrl } from '../utils/upload';

interface ProfileViewProps {
  user: User | null;
  onUserUpdate: (user: User) => void;
  onLogout: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(p => p[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'AR';
}

export const ProfileView: React.FC<ProfileViewProps> = ({ user, onUserUpdate, onLogout }) => {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl || null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="text-sm text-[#55636B]">Profil non disponible.</p>
      </div>
    );
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

    setIsUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const url = await uploadImage(dataUrl);
      setAvatarUrl(url);
      showToast('Photo de profil mise à jour.', 'success');
    } catch (err: any) {
      showToast(`Erreur d'import de la photo : ${err.message}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Le nom complet est requis.', 'error');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      showToast('Adresse e-mail invalide.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim(), email: email.trim(), avatarUrl })
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || json.message || `API error ${res.status}`);
      }
      onUserUpdate(json.user);
      showToast('Profil mis à jour avec succès.', 'success');
      navigate('/dashboard');
    } catch (err: any) {
      showToast(`Erreur mise à jour : ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const roleLabel = user.role === 'admin' ? 'Administrateur' : 'Membre EURAXESS Africa';

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-6 animate-fade-in">
      <div>
        <nav className="flex items-center gap-1.5 text-xs text-[#55636B] font-semibold mb-2">
          <Link to="/dashboard" className="hover:text-[#005596] cursor-pointer">
            Tableau de bord
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[#005596] font-bold">Mon profil</span>
        </nav>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1C2529]">Mon profil</h1>
        <p className="text-xs text-[#55636B] mt-1">
          Gérez vos informations personnelles et votre photo de profil.
        </p>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Avatar Card */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-2xl p-6 shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#C9D4DE]/50 flex flex-col items-center text-center space-y-4">
            <div className="relative">
              <div className="w-28 h-28 rounded-full overflow-hidden bg-[#D9E6F2] border-4 border-[#005596]/30 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Photo de profil" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-black text-[#005596]">{getInitials(name)}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[#005596] hover:bg-[#004275] text-white flex items-center justify-center shadow-lg border-2 border-white transition-colors cursor-pointer disabled:opacity-75"
                title="Changer la photo de profil"
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div>
              <p className="font-bold text-sm text-[#1C2529]">{user.name}</p>
              <p className="text-xs text-[#55636B] mt-0.5">{user.email}</p>
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F1F8] text-[#005596] text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              {roleLabel}
            </span>

            <p className="text-[11px] text-slate-400">
              Formats acceptés : PNG, JPEG, WebP — 5 Mo maximum.
            </p>
          </div>
        </div>

        {/* Edit Fields Card */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl p-6 shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#C9D4DE]/50 space-y-5">
            <h2 className="text-base font-bold text-[#1C2529] flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-[#005596]" />
              Informations personnelles
            </h2>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="profile-name" className="text-[11px] font-extrabold text-[#55636B] uppercase tracking-wider">
                Nom complet
              </label>
              <div className="relative">
                <UserCircle className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A98A1]" />
                <input
                  id="profile-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[#E8F1F8]/60 focus:bg-white border border-[#C9D4DE] focus:border-[#005596] rounded-xl text-xs font-bold text-[#1C2529] focus:outline-none focus:ring-2 focus:ring-[#005596]/20 transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="profile-email" className="text-[11px] font-extrabold text-[#55636B] uppercase tracking-wider">
                Adresse e-mail
              </label>
              <div className="relative">
                <AtSign className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A98A1]" />
                <input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[#E8F1F8]/60 focus:bg-white border border-[#C9D4DE] focus:border-[#005596] rounded-xl text-xs font-bold text-[#1C2529] focus:outline-none focus:ring-2 focus:ring-[#005596]/20 transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-extrabold text-[#55636B] uppercase tracking-wider">
                Rôle
              </label>
              <div className="relative">
                <BadgeCheck className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A98A1]" />
                <input
                  type="text"
                  readOnly
                  value={roleLabel}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-[#C9D4DE] rounded-xl text-xs font-bold text-[#55636B] cursor-not-allowed"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={isSaving || isUploading}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-[#005596] to-[#004275] hover:from-[#004275] hover:to-[#003B66] text-white font-extrabold rounded-xl text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Enregistrer les modifications
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="py-3 px-5 bg-white border border-[#005596] text-[#005596] font-bold rounded-xl hover:bg-[#E8F1F8] transition-colors cursor-pointer"
              >
                Annuler
              </button>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-2 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
