import React, { useState, useRef, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { 
  Bell, 
  HelpCircle, 
  Search, 
  Menu, 
  X, 
  LogOut, 
  Download, 
  PlusCircle,
  UserCircle
} from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  isAuthenticated: boolean;
  user?: User | null;
  onLogout: () => void;
  isHeaderVisible?: boolean;
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

export const Header: React.FC<HeaderProps> = ({
  isAuthenticated,
  user,
  onLogout,
  isHeaderVisible = true
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const navLinks: { to: string; label: string }[] = [
    { to: '/dashboard', label: 'Tableau de bord' },
    { to: '/contacts', label: 'Contacts' },
    { to: '/import', label: 'Importation' },
    { to: '/segments', label: 'Segmentation' }
  ];

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 h-16 w-full bg-gradient-to-r from-[#005596] via-[#005596] to-[#B8167C] shadow-md text-white transition-transform duration-300 ${
      isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
    }`}>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between">
        
        {/* Left: Brand & Mobile Toggle */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          <Link 
            to="/dashboard"
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <span className="bg-white rounded-md px-3 py-1 shadow-sm flex items-center">
              <img 
                src="/euraxess-africa-logo.png" 
                alt="EURAXESS Africa" 
                className="h-7 sm:h-8 w-auto object-contain group-hover:scale-105 transition-transform"
              />
            </span>
            <span className="font-extrabold text-lg tracking-tight hidden sm:inline-block text-white">
              EURAXESS <span className="text-[#FFC20C]">Africa</span>
            </span>
          </Link>
        </div>

        {/* Center: Desktop Navigation Links */}
        <nav className="hidden md:flex items-center justify-center gap-8 flex-1">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `py-1 text-sm font-medium transition-all relative cursor-pointer ${
                isActive 
                  ? 'text-white font-semibold border-b-2 border-white' 
                  : 'text-white/80 hover:text-white'
              }`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Right: Quick Utilities & User Profile */}
        <div className="flex items-center gap-2 sm:gap-4">
          <Link 
            to="/contacts"
            className="p-2 rounded-full hover:bg-white/10 text-white/90 hover:text-white transition-colors cursor-pointer"
            title="Rechercher des contacts"
          >
            <Search className="w-5 h-5" />
          </Link>

          {/* Notifications Dropdown */}
          <div className="relative" ref={notificationsRef}>
            <button 
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-2 rounded-full hover:bg-white/10 text-white/90 hover:text-white transition-colors relative cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FFC20C] animate-ping" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FFC20C]" />
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 py-3 text-slate-800 z-[100] animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                  <span className="font-bold text-sm">Notifications R&I</span>
                  <span className="text-xs text-[#005596] font-semibold bg-[#E8F1F8] px-2 py-0.5 rounded-full">3 nouvelles</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  <div className="px-4 py-2.5 hover:bg-slate-50 transition-colors text-xs">
                    <p className="font-semibold text-slate-900">Dr. Elena Volkov - Conflit de doublons</p>
                    <p className="text-slate-500 mt-0.5">Importation network_audit_2024.csv requiert votre attention.</p>
                  </div>
                  <div className="px-4 py-2.5 hover:bg-slate-50 transition-colors text-xs">
                    <p className="font-semibold text-slate-900">Nouveau projet Solaire-Hub</p>
                    <p className="text-slate-500 mt-0.5">Ajouté par le secteur Énergie à Dakar.</p>
                  </div>
                  <div className="px-4 py-2.5 hover:bg-slate-50 transition-colors text-xs">
                    <p className="font-semibold text-slate-900">Prof. Amadou Diallo</p>
                    <p className="text-slate-500 mt-0.5">Mise à jour des notes d'échange récente.</p>
                  </div>
                </div>
                <div className="px-4 pt-2 border-t border-slate-100 text-center">
                  <Link 
                    to="/import"
                    onClick={() => setNotificationsOpen(false)}
                    className="text-xs text-[#005596] font-bold hover:underline cursor-pointer"
                  >
                    Voir l'importation en cours
                  </Link>
                </div>
              </div>
            )}
          </div>

          <button 
            className="p-2 rounded-full hover:bg-white/10 text-white/90 hover:text-white transition-colors hidden sm:flex cursor-pointer"
            title="Aide & Documentation"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          {/* Profile Menu / Login Button */}
          {isAuthenticated ? (
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1 rounded-full border-2 border-white/30 hover:border-white transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden bg-white/20 flex items-center justify-center">
                  {user?.avatarUrl ? (
                    <img 
                      src={user.avatarUrl} 
                      alt="User profile" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-bold text-white">
                      {getInitials(user?.name || '')}
                    </span>
                  )}
                </div>
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 text-slate-800 z-[100] animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="font-bold text-sm text-slate-900">{user?.name || 'Utilisateur EURAXESS'}</p>
                    <p className="text-xs text-slate-500">{user?.email || ''}</p>
                  </div>

                  <div className="py-1">
                    <Link
                      to="/profile"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-[#005596]/10 hover:text-[#005596] flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <UserCircle className="w-4 h-4" />
                      Mon profil
                    </Link>
                    <Link
                      to="/contacts/new"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-[#005596]/10 hover:text-[#005596] flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Nouveau contact
                    </Link>
                    <Link
                      to="/export"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-[#005596]/10 hover:text-[#005596] flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      Exporter les données
                    </Link>
                  </div>

                  <div className="border-t border-slate-100 pt-1">
                    <button
                      onClick={() => { setProfileDropdownOpen(false); onLogout(); }}
                      className="w-full px-4 py-2 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      Se déconnecter
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="px-4 py-1.5 rounded-lg bg-white/20 hover:bg-white text-white hover:text-[#005596] font-semibold text-xs transition-all shadow-sm cursor-pointer"
            >
              Se connecter
            </Link>
          )}

        </div>
      </div>

      {/* Mobile Drawer Menu - Positioned Absolute so it floats over page content */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 w-full bg-gradient-to-r from-[#005596] to-[#B8167C] border-t border-white/10 px-4 py-4 space-y-2 shadow-2xl z-[100] animate-in fade-in slide-in-from-top-2 duration-150">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `w-full text-left py-2.5 px-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                isActive ? 'bg-white/20 font-bold text-white' : 'text-white/80 hover:bg-white/10'
              }`}
            >
              {link.label}
            </NavLink>
          ))}
          <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
            <Link
              to="/contacts/new"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-left py-2 px-3 rounded-lg text-xs bg-[#FFC20C] text-[#1C2529] font-bold flex items-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" /> Ajouter un expert
            </Link>
            <Link
              to="/export"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-left py-2 px-3 rounded-lg text-xs border border-white/30 hover:bg-white/10 flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" /> Exporter la base
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
