import React, { useState, useRef, useEffect } from 'react';
import { ViewPage } from '../types';
import { ArsiiLogo } from './ArsiiLogo';
import { 
  Bell, 
  HelpCircle, 
  Search, 
  Menu, 
  X, 
  User, 
  LogOut, 
  Download, 
  PlusCircle, 
  PieChart, 
  Layers, 
  Database,
  CheckCircle2
} from 'lucide-react';

interface HeaderProps {
  activePage: ViewPage;
  onNavigate: (page: ViewPage) => void;
  isAuthenticated: boolean;
  onLogout: () => void;
  isHeaderVisible?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activePage,
  onNavigate,
  isAuthenticated,
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

  const navLinks: { id: ViewPage; label: string }[] = [
    { id: 'dashboard', label: 'Tableau de bord' },
    { id: 'contacts', label: 'Contacts' },
    { id: 'importation', label: 'Importation' },
    { id: 'segmentation', label: 'Segmentation' }
  ];

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 h-16 w-full bg-gradient-to-r from-[#35B8B2] to-[#256865] shadow-md text-white transition-transform duration-300 ${
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

          <div 
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <ArsiiLogo className="w-9 h-9 sm:w-10 sm:h-10 group-hover:scale-105 transition-transform" />
            <span className="font-extrabold text-xl tracking-tight hidden sm:inline-block text-white">ARSII</span>
          </div>
        </div>

        {/* Center: Desktop Navigation Links */}
        <nav className="hidden md:flex items-center justify-center gap-8 flex-1">
          {navLinks.map((link) => {
            const isActive = activePage === link.id || 
              (link.id === 'contacts' && (activePage === 'contact-detail' || activePage === 'new-contact' || activePage === 'exportation'));
            return (
              <button
                key={link.id}
                onClick={() => onNavigate(link.id)}
                className={`py-1 text-sm font-medium transition-all relative cursor-pointer ${
                  isActive 
                    ? 'text-white font-bold border-b-2 border-white' 
                    : 'text-white/80 hover:text-white'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Right: Quick Utilities & User Profile */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            onClick={() => onNavigate('contacts')}
            className="p-2 rounded-full hover:bg-white/10 text-white/90 hover:text-white transition-colors cursor-pointer"
            title="Rechercher des contacts"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Notifications Dropdown */}
          <div className="relative" ref={notificationsRef}>
            <button 
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-2 rounded-full hover:bg-white/10 text-white/90 hover:text-white transition-colors relative cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#34fcec] animate-ping" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#34fcec]" />
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 py-3 text-slate-800 z-[100] animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                  <span className="font-bold text-sm">Notifications R&I</span>
                  <span className="text-xs text-[#006a66] font-semibold bg-[#dff9f8] px-2 py-0.5 rounded-full">3 nouvelles</span>
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
                  <button 
                    onClick={() => { setNotificationsOpen(false); onNavigate('importation'); }}
                    className="text-xs text-[#006a66] font-bold hover:underline cursor-pointer"
                  >
                    Voir l'importation en cours
                  </button>
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
                <div className="w-8 h-8 rounded-full overflow-hidden bg-white/20">
                  <img 
                    src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80" 
                    alt="User profile" 
                    className="w-full h-full object-cover"
                  />
                </div>
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 text-slate-800 z-[100] animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="font-bold text-sm text-slate-900">Marie Curie</p>
                    <p className="text-xs text-slate-500">m.curie@arsii.org</p>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => { setProfileDropdownOpen(false); onNavigate('new-contact'); }}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-[#dff9f8] hover:text-[#006a66] flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Nouveau contact
                    </button>
                    <button
                      onClick={() => { setProfileDropdownOpen(false); onNavigate('exportation'); }}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-[#dff9f8] hover:text-[#006a66] flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      Exporter les données
                    </button>
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
            <button
              onClick={() => onNavigate('auth')}
              className="px-4 py-1.5 rounded-lg bg-white/20 hover:bg-white text-white hover:text-[#006a66] font-semibold text-xs transition-all shadow-sm cursor-pointer"
            >
              Se connecter
            </button>
          )}

        </div>
      </div>

      {/* Mobile Drawer Menu - Positioned Absolute so it floats over page content */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 w-full bg-[#006a66] border-t border-white/10 px-4 py-4 space-y-2 shadow-2xl z-[100] animate-in fade-in slide-in-from-top-2 duration-150">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => {
                onNavigate(link.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left py-2.5 px-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activePage === link.id ? 'bg-white/20 font-bold text-white' : 'text-white/80 hover:bg-white/10'
              }`}
            >
              {link.label}
            </button>
          ))}
          <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
            <button
              onClick={() => { onNavigate('new-contact'); setMobileMenuOpen(false); }}
              className="w-full text-left py-2 px-3 rounded-lg text-xs bg-[#35b8b2] font-semibold flex items-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" /> Ajouter un expert
            </button>
            <button
              onClick={() => { onNavigate('exportation'); setMobileMenuOpen(false); }}
              className="w-full text-left py-2 px-3 rounded-lg text-xs border border-white/30 hover:bg-white/10 flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" /> Exporter la base
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
