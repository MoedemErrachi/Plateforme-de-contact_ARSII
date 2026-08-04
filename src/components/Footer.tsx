import React from 'react';
import { ViewPage } from '../types';
import { Globe, Mail, HelpCircle, Shield, FileText, Activity } from 'lucide-react';

interface FooterProps {
  onNavigate?: (page: ViewPage) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="w-full bg-white border-t border-slate-200 py-6 px-4 sm:px-8 mt-auto text-slate-600 text-xs">
      <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        <div className="flex items-center gap-3">
          <span className="font-extrabold text-[#006a66] text-sm">ARSII</span>
          <span className="text-slate-300">|</span>
          <span>© 2026 Réseau de Recherche & Innovation ARSII (Europe - Afrique)</span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-6 text-slate-500 font-medium">
          <a href="#status" className="hover:text-[#006a66] transition-colors flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-[#006a66]" /> État du système
          </a>
          <a href="#help" className="hover:text-[#006a66] transition-colors flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-[#006a66]" /> Centre d'aide
          </a>
          <a href="#privacy" className="hover:text-[#006a66] transition-colors flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-[#006a66]" /> Politique de confidentialité
          </a>
        </nav>

        <div className="flex items-center gap-3 text-slate-400">
          <Globe className="w-4 h-4 hover:text-[#006a66] cursor-pointer transition-colors" />
          <Mail className="w-4 h-4 hover:text-[#006a66] cursor-pointer transition-colors" />
          <FileText className="w-4 h-4 hover:text-[#006a66] cursor-pointer transition-colors" />
        </div>

      </div>
    </footer>
  );
};
