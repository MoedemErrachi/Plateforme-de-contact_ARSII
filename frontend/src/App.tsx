import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Contact, Tag, Segment, FilterState, User, ContactSelection, SelectionMode } from './types';
import { apiFetch, getAuthToken, clearStoredAuth, isServiceUnreachable, setGlobalApiErrorHandler } from './services/api';
import { csrfHeaders } from './utils/csrf';
import { isTokenExpired } from './utils/jwt';
import { mapContactFromApi } from './utils/mapContact';
import { emptyFilterState } from './utils/contactQuery';
import { canCreate, canEdit, canDelete } from './utils/privileges';
import { ShieldAlert } from 'lucide-react';
import { useToast } from './components/Toast';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { AuthView } from './components/AuthView';
import { FirstLoginWelcomeModal } from './components/FirstLoginWelcomeModal';
import { ModalConfirmation } from './components/ModalConfirmation';
import { AuthSplash } from './components/Skeletons';

// ─────────────────────────────────────────────────────────────
// Code splitting : chaque page est un chunk distinct chargé à la demande.
// AuthView reste eager (écran d'entrée — doit s'afficher sans délai).
// Les librairies lourdes (exceljs, papaparse, react-markdown) sont elles-mêmes
// chargées dynamiquement dans leurs vues hôtes (ImportWizardView, ChatWidget).
// ─────────────────────────────────────────────────────────────
const lazyNamed = <T extends Record<string, any>, K extends keyof T>(
  loader: () => Promise<T>,
  name: K
) =>
  lazy(async () => {
    const mod = await loader();
    return { default: mod[name] as T[K] };
  });

const DashboardView = lazyNamed(() => import('./components/DashboardView'), 'DashboardView');
const ContactsView = lazyNamed(() => import('./components/ContactsView'), 'ContactsView');
const ContactDetailView = lazyNamed(() => import('./components/ContactDetailView'), 'ContactDetailView');
const ImportWizardView = lazyNamed(() => import('./components/ImportWizardView'), 'ImportWizardView');
const NewContactView = lazyNamed(() => import('./components/NewContactView'), 'NewContactView');
const ExportView = lazyNamed(() => import('./components/ExportView'), 'ExportView');
const SegmentationView = lazyNamed(() => import('./components/SegmentationView'), 'SegmentationView');
const ProfileView = lazyNamed(() => import('./components/ProfileView'), 'ProfileView');
const AdminView = lazyNamed(() => import('./components/AdminView'), 'AdminView');
const ResetPasswordPage = lazyNamed(() => import('./pages/ResetPasswordPage'), 'ResetPasswordPage');
const ResetPasswordExpiredPage = lazyNamed(() => import('./pages/ResetPasswordExpiredPage'), 'ResetPasswordExpiredPage');
const ChatWidget = lazyNamed(() => import('./components/chat/ChatWidget'), 'ChatWidget');

// Fallback de transition entre chunks : voile discret cohérent avec le style
// de chargement de l'application (aucun saut visuel brutal).
const RouteFallback: React.FC = () => (
  <div className="flex items-center justify-center py-24" aria-busy="true">
    <div className="w-8 h-8 rounded-full border-[3px] border-[#C9D4DE] border-t-[#005596] animate-spin" />
  </div>
);

// Garde de route RBAC : réserve l'espace d'administration au rôle admin.
// Tout autre utilisateur (ou session dégradée) est renvoyé vers /dashboard.
const RequireAdmin: React.FC<{ role?: string | null; children: React.ReactNode }> = ({ role, children }) => {
  if (role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

// Garde inverse (layout sans chemin) : l'admin n'accède qu'à l'espace
// d'administration — toute page métier le renvoie vers /admin.
const RequireUser: React.FC<{ role?: string | null }> = ({ role }) => {
  if (role === 'admin') {
    return <Navigate to="/admin" replace />;
  }
  return <Outlet />;
};

// Redirection d'accueil selon le rôle : /admin pour l'admin, /dashboard sinon.
const HomeRedirect: React.FC<{ role?: string | null }> = ({ role }) => (
  <Navigate to={role === 'admin' ? '/admin' : '/dashboard'} replace />
);

// Garde de privilège : protège les pages à fort impact d'écriture (création,
// import) contre les accès directs par URL pour les comptes en lecture seule.
const RequirePrivilege: React.FC<{ user: User | null; need: 'create' | 'edit'; children: React.ReactNode }> = ({ user, need, children }) => {
  const allowed = need === 'create' ? canCreate(user) : canEdit(user);
  if (allowed) {
    return <>{children}</>;
  }
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center animate-fade-in">
      <div className="bg-white rounded-2xl border border-[#C9D4DE]/50 shadow-sm p-10 space-y-3">
        <ShieldAlert className="w-10 h-10 mx-auto text-[#B8167C]" />
        <h1 className="text-lg font-extrabold text-[#1C2529]">Accès restreint</h1>
        <p className="text-xs text-[#55636B] leading-relaxed">
          Votre compte dispose du niveau « Lecture seule ». La création et la modification de contenus
          sont réservées aux comptes avec droits d'écriture. Contactez votre administrateur pour faire
          évoluer vos accès.
        </p>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="mt-2 inline-flex items-center gap-2 px-4 py-2.5 bg-[#005596] text-white text-xs font-bold rounded-xl hover:bg-[#003d6d] transition-colors cursor-pointer"
        >
          Retour
        </button>
      </div>
    </div>
  );
};

// Garde des routes publiques (/login, liens e-mail d'authentification).
// Règle : les VRAIS liens e-mail ferment automatiquement une session active
// (ils doivent être traités dans une session propre), tandis qu'une simple
// navigation vers /login ne déconnecte jamais — l'utilisateur est redirigé
// silencieusement vers son espace.
// Liens authentiques :
//  - /reset-password/:token (jeton présent dans l'URL)
//  - /login?invite=1 (lien d'invitation émis par l'e-mail de création de compte)
// Anti-course : pendant les 2 s suivant un login réussi, aucune déconnexion
// automatique — le rendu transitoire sur l'ancienne URL ne doit pas reprendre
// la session de l'utilisateur qui vient de se connecter.
const AUTH_LINK_SUPPRESSION_MS = 2000;

const PublicOnlyRoute: React.FC<{
  mode: 'login' | 'reset';
  isAuthenticated: boolean;
  user: User | null;
  lastLoginAtRef: React.MutableRefObject<number>;
  onForceSignOut: () => void;
  children: React.ReactNode;
}> = ({ mode, isAuthenticated, user, lastLoginAtRef, onForceSignOut, children }) => {
  const searchParams = useSearchParams()[0];
  const [isSigningOut, setIsSigningOut] = useState(false);

  const isGenuineAuthLink =
    mode === 'reset' || searchParams.get('invite') === '1';

  useEffect(() => {
    if (!isAuthenticated || !isGenuineAuthLink) return;
    // Fenêtre de protection post-login : voir commentaire du composant.
    if (Date.now() - lastLoginAtRef.current < AUTH_LINK_SUPPRESSION_MS) return;
    setIsSigningOut(true);
    onForceSignOut();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isGenuineAuthLink]);

  if (isSigningOut) {
    return <AuthSplash />;
  }

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  // Session active sur /login : aucun panneau intermédiaire — redirection
  // silencieuse vers l'espace dédié au rôle (jamais de déconnexion passive).
  if (mode === 'login') {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  // mode === 'reset', session active mais dans la fenêtre anti-course :
  // écran de transition le temps que la navigation vers /dashboard aboutisse.
  return <AuthSplash />;
};

// --- API helper ---
export default function App() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Couche API → toast global : tout service injoignable (réseau, timeout,
  // 5xx) notifie l'utilisateur automatiquement, sans dupliquer les messages
  // déjà gérés par les composants (garde isServiceUnreachable côté appelants).
  useEffect(() => {
    setGlobalApiErrorHandler((err) => showToast(err.message, 'error'));
    return () => setGlobalApiErrorHandler(null);
  }, [showToast]);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);

  // Selection (4 modes) in directory for bulk actions & export
  const [selection, setSelection] = useState<ContactSelection>(() => {
    try {
      const saved = localStorage.getItem('euraxess_contacts_selected_ids');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migration de l'ancien format (simple tableau d'ids) → partial
        if (Array.isArray(parsed)) {
          const ids = parsed.filter((id: any) => typeof id === 'string');
          return { mode: ids.length ? 'partial' : 'none', ids, filters: emptyFilterState(), totalCount: ids.length };
        }
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.ids)) {
          const ids = parsed.ids.filter((id: any) => typeof id === 'string');
          const validModes = ['none', 'page', 'partial', 'all-filtered'];
          let mode: SelectionMode = validModes.includes(parsed.mode) ? parsed.mode : ids.length ? 'partial' : 'none';
          // Après un rechargement, page / all-filtered perdent leur validité (filtres non rejoués)
          if (mode === 'page' || mode === 'all-filtered') {
            mode = ids.length ? 'partial' : 'none';
          }
          return {
            mode,
            ids,
            filters: parsed.filters && typeof parsed.filters === 'object' ? { ...emptyFilterState(), ...parsed.filters } : emptyFilterState(),
            totalCount: Number(parsed.totalCount) || 0
          };
        }
      }
    } catch {
      // ignore corrupted storage
    }
    return { mode: 'none', ids: [], filters: emptyFilterState(), totalCount: 0 };
  });

  // Persist selection across page refreshes (survives reload of /export)
  useEffect(() => {
    try {
      if (selection.mode !== 'none') {
        localStorage.setItem('euraxess_contacts_selected_ids', JSON.stringify(selection));
      } else {
        localStorage.removeItem('euraxess_contacts_selected_ids');
      }
    } catch {
      // ignore
    }
  }, [selection]);

  // Pagination limit state across view switches (persisted locally)
  const [itemsPerPage, setItemsPerPage] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('euraxess_contacts_items_per_page');
      const n = saved ? Number(saved) : NaN;
      return [10, 20, 50, 100].includes(n) ? n : 10;
    } catch {
      return 10;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('euraxess_contacts_items_per_page', String(itemsPerPage));
    } catch {
      // ignore
    }
  }, [itemsPerPage]);

  // Tags & Segments State
  const [tags, setTags] = useState<Tag[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isLoadingTaxonomy, setIsLoadingTaxonomy] = useState(true);
  const [activeSegmentId, setActiveSegmentId] = useState<string>('all');

  // Authentication State (defaults to true for smooth start, can toggle to auth page)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(getAuthToken);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [showFirstLoginModal, setShowFirstLoginModal] = useState(false);

  // Horodatage du dernier login réussi : protège PublicOnlyRoute contre les
  // rendus transitoires sur un lien d'authentification juste après connexion.
  const lastLoginAtRef = useRef(0);

  // Compteur de rafraîchissement : incrémenté après chaque mutation de contact
  // (création, import, suppression simple ou en lot) pour que ContactsView
  // recharge sa liste depuis la base — source de vérité unique.
  const [contactsRefreshKey, setContactsRefreshKey] = useState(0);
  const bumpContactsRefresh = useCallback(() => setContactsRefreshKey(k => k + 1), []);

  // Suppression de contact : confirmation obligatoire avant l'appel API.
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  // Suppression en lot : ids de la sélection courante, confirmation requise.
  const [pendingBulkDelete, setPendingBulkDelete] = useState<string[] | null>(null);

  // ──────────────────────────────────────────────
  // Load contacts from database on mount
  // ──────────────────────────────────────────────
  const loadContacts = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const data = await apiFetch('/api/contacts?limit=100');
      if (data?.data?.contacts) {
        setContacts(data.data.contacts.map(mapContactFromApi));
      }
    } catch (err: any) {
      console.error('Error loading contacts:', err);
      showToast('Erreur lors du chargement des contacts.', 'error');
    } finally {
      setTimeout(() => setIsLoadingData(false), 300);
    }
  }, []);

  // Load tags & segments from database
  const loadTagsAndSegments = useCallback(async () => {
    setIsLoadingTaxonomy(true);
    try {
      const data = await apiFetch('/api/segments');
      if (data?.data) {
        if (Array.isArray(data.data.tags)) {
          setTags(data.data.tags);
        }
        if (Array.isArray(data.data.segments)) {
          setSegments(
            data.data.segments.map((s: any) => ({
              id: s.id,
              name: s.name,
              description: s.description,
              icon: s.icon,
              filters: s.filters ?? {},
              memberCount: typeof s.memberCount === 'number' ? s.memberCount : undefined
            }))
          );
        }
      }
    } catch (err) {
      showToast('Erreur lors du chargement des segments.', 'error');
    } finally {
      setIsLoadingTaxonomy(false);
    }
  }, []);

  // Les données protégées ne sont chargées QUE lorsqu'une session est active :
  // sur la page de login, aucun appel /api/contacts → aucun 401 ni toast parasite.
  useEffect(() => {
    if (!isAuthenticated) return;
    loadContacts();
    loadTagsAndSegments();
  }, [isAuthenticated, loadContacts, loadTagsAndSegments]);

  // Restore active session on mount (real DB-backed user)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = getAuthToken();

      // Aucun jeton stocké → session inexistante : on bascule directement sur
      // le formulaire de login SANS appel réseau (ni /api/auth/me, ni données).
      if (!stored) {
        if (!cancelled) {
          setUser(null);
          setIsAuthenticated(false);
          setAuthToken(null);
          setIsSessionReady(true);
        }
        return;
      }

      // Contrôle proactif : si un jeton stocké est déjà expiré, on déconnecte
      // immédiatement SANS appel réseau (pas de 401/500 inutiles, pas de flash).
      if (isTokenExpired(stored)) {
        if (!cancelled) {
          clearStoredAuth();
          setUser(null);
          setIsAuthenticated(false);
          setAuthToken(null);
          setIsSessionReady(true);
          showToast('Votre session a expiré. Veuillez vous reconnecter.', 'error');
        }
        return;
      }

      try {
        const data = await apiFetch('/api/auth/me');
        if (!cancelled && data?.authenticated && data?.user) {
          setUser(data.user);
          setIsAuthenticated(true);
          setAuthToken(getAuthToken());
          // Aucune écriture de jeton ici : /me ne ré-émet plus de token, et
          // réécrire écraserait la sémantique localStorage (remember-me) vs
          // sessionStorage (session simple) choisie au login.
          // RBAC : un admin est toujours ramené vers son espace dédié.
          if (data.user.role === 'admin' && !window.location.pathname.startsWith('/admin')) {
            navigate('/admin', { replace: true });
          }
        } else if (!cancelled) {
          setAuthToken(null);
        }
      } catch {
        // Vérification silencieuse : purge locale sans toast ni log bruyant.
        if (!cancelled) {
          setUser(null);
          setIsAuthenticated(false);
          setAuthToken(null);
          try {
            localStorage.removeItem('euraxess_token');
          } catch {
            // ignore storage failures
          }
        }
      } finally {
        if (!cancelled) {
          setIsSessionReady(true);
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Déconnexion client instantanée : purge l'état et redirige dès qu'une
  // session morte est détectée (401 serveur ou expiration locale), sans
  // attendre ni déclencher d'autres appels API.
  useEffect(() => {
    const onAuthExpired = () => {
      setUser(null);
      setIsAuthenticated(false);
      setAuthToken(null);
      clearStoredAuth();
      showToast('Votre session a expiré. Veuillez vous reconnecter.', 'error');
      navigate('/login');
    };
    window.addEventListener('auth:expired', onAuthExpired);
    return () => window.removeEventListener('auth:expired', onAuthExpired);
  }, [navigate, showToast]);

  // ──────────────────────────────────────────────
  // AUTH
  // ──────────────────────────────────────────────
  const handleLoginSuccess = (userData: User) => {
    // Horodatage utilisé par PublicOnlyRoute pour ignorer les rendus
    // transitoires sur un lien d'authentification juste après un login.
    lastLoginAtRef.current = Date.now();
    setUser(userData);
    setIsAuthenticated(true);
    setAuthToken(getAuthToken());
    setIsSessionReady(true);
    // Première connexion : invite de changement du mot de passe temporaire
    // (fermable via « Passer »).
    setShowFirstLoginModal(Boolean(userData.isFirstLogin));
    // RBAC : les administrateurs atterrissent dans leur console dédiée.
    navigate(userData.role === 'admin' ? '/admin' : '/dashboard');
  };

  // Déconnexion silencieuse sans navigation : utilisée quand un utilisateur
  // connecté ouvre un lien e-mail d'authentification (reset / invitation).
  // On purge la session locale puis on laisse la page cible s'afficher à
  // la même URL — d'où l'absence de navigate('/login') ici.
  const forceSignOutForAuthLink = () => {
    setUser(null);
    setIsAuthenticated(false);
    setAuthToken(null);
    clearStoredAuth();
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include', headers: csrfHeaders() }).catch(() => {});
    showToast('Votre session active a été fermée pour traiter ce lien.', 'info');
  };

  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
    setAuthToken(null);
    clearStoredAuth();
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include', headers: csrfHeaders() }).catch(() => {});
    navigate('/login');
  };

  const getChatToken = useCallback(() => authToken, [authToken]);

  const handleUserUpdate = (updatedUser: User) => {
    setUser(updatedUser);
  };

  // ──────────────────────────────────────────────
  // CONTACT CRUD — all persisted to DB
  // ──────────────────────────────────────────────
  const handleUpdateContact = async (updatedContact: Contact) => {
    try {
      const res = await apiFetch(`/api/contacts/${updatedContact.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          firstName: updatedContact.firstName,
          lastName: updatedContact.lastName,
          email: updatedContact.email,
          gender: updatedContact.gender,
          countryOfOrigin: updatedContact.countryOfOrigin,
          city: updatedContact.city,
          phone: updatedContact.phone,
          affiliation: updatedContact.affiliation,
          function: updatedContact.function,
          experience: updatedContact.experience,
          facultyDepartment: updatedContact.facultyDepartment,
          researchCareerStage: updatedContact.researchCareerStage,
          avatarUrl: updatedContact.avatarUrl,
          tagIds: (updatedContact.tags || [])
            .map(name => tags.find(t => t.name.toLowerCase() === name.toLowerCase())?.id)
            .filter(Boolean)
        })
      });
      const saved = mapContactFromApi(res.data.contact);
      setContacts(prev => prev.map(c => c.id === saved.id ? saved : c));
      showToast(`Contact ${saved.name} mis à jour avec succès.`, 'success');
    } catch (err: any) {
      // Service injoignable : le toast global suffit (pas de doublon).
      if (!isServiceUnreachable(err)) showToast(`Erreur mise à jour : ${err.message}`, 'error');
      setContacts(prev => prev.map(c => c.id === updatedContact.id ? updatedContact : c));
    }
  };

  const handleSelectContact = (contactId: string) => {
    navigate(`/contacts/${contactId}`);
  };

  const handleExportAll = () => {
    // « Tous les contacts » préselectionné : périmètre all-filtered sans filtre.
    setSelection({ mode: 'all-filtered', ids: [], filters: emptyFilterState(), totalCount: 0 });
    navigate('/export');
  };

  const handleAddContact = async (newContact: Contact) => {
    try {
      const res = await apiFetch('/api/contacts', {
        method: 'POST',
        body: JSON.stringify({
          firstName: newContact.firstName,
          lastName: newContact.lastName,
          email: newContact.email,
          gender: newContact.gender,
          countryOfOrigin: newContact.countryOfOrigin,
          city: newContact.city,
          phone: newContact.phone,
          affiliation: newContact.affiliation,
          function: newContact.function,
          experience: newContact.experience,
          facultyDepartment: newContact.facultyDepartment,
          researchCareerStage: newContact.researchCareerStage,
          avatarUrl: newContact.avatarUrl,
          tagIds: (newContact.tags || [])
            .map(name => tags.find(t => t.name.toLowerCase() === name.toLowerCase())?.id)
            .filter(Boolean)
        })
      });
      const saved = mapContactFromApi(res.data.contact);
      setContacts(prev => [saved, ...prev]);
      bumpContactsRefresh();
      showToast(`Contact ${saved.name} enregistré avec succès.`, 'success');
    } catch (err: any) {
      if (!isServiceUnreachable(err)) showToast(`Erreur création contact : ${err.message}`, 'error');
      throw err; // rethrow so NewContactView does not navigate away
    }
  };

  // Étape 1 : ouverture de la confirmation avec le nom du contact.
  const requestDeleteContact = (contactId: string) => {
    const target = contacts.find(c => c.id === contactId);
    setPendingDelete({ id: contactId, name: target?.name || 'ce contact' });
  };

  // Étape 2 : suppression effective après confirmation.
  const performDeleteContact = async (contactId: string) => {
    try {
      await apiFetch(`/api/contacts/${contactId}`, { method: 'DELETE' });
      setContacts(prev => prev.filter(c => c.id !== contactId));
      bumpContactsRefresh();
      showToast('Contact supprimé.', 'success');
    } catch (err: any) {
      if (!isServiceUnreachable(err)) showToast(`Erreur suppression : ${err.message}`, 'error');
    } finally {
      setPendingDelete(null);
    }
  };

  // Suppression en lot : même parcours en deux temps que la suppression
  // unitaire (confirmation puis appel API), avec rafraîchissement de la
  // liste et réinitialisation de la sélection.
  const requestBulkDeleteContacts = (ids: string[]) => {
    if (ids.length > 0) setPendingBulkDelete(ids);
  };

  const performBulkDeleteContacts = async () => {
    const ids = pendingBulkDelete || [];
    try {
      const res = await apiFetch('/api/contacts/bulk', {
        method: 'DELETE',
        body: JSON.stringify({ ids })
      });
      const deletedCount = Number(res?.data?.deletedCount ?? ids.length);
      setContacts(prev => prev.filter(c => !ids.includes(c.id)));
      setSelection({ mode: 'none', ids: [], filters: emptyFilterState(), totalCount: 0 });
      bumpContactsRefresh();
      showToast(
        deletedCount === 1 ? 'Contact supprimé.' : `${deletedCount} contacts supprimés.`,
        'success'
      );
    } catch (err: any) {
      if (!isServiceUnreachable(err)) showToast(`Erreur suppression en lot : ${err.message}`, 'error');
    } finally {
      setPendingBulkDelete(null);
    }
  };

  // ──────────────────────────────────────────────
  // IMPORT
  // ──────────────────────────────────────────────
  const handleImportContacts = async (newContacts: Contact[], updatedContacts: Contact[] = []) => {
    try {
      const body = await apiFetch('/api/contacts/bulk', {
        suppressGlobalError: true, // le wizard affiche lui-même le retour contextuel
        method: 'POST',
        body: JSON.stringify({
          newContacts: newContacts.map(c => ({
            firstName: c.firstName,
            lastName: c.lastName,
            email: c.email,
            gender: c.gender,
            countryOfOrigin: c.countryOfOrigin,
            city: c.city,
            phone: c.phone,
            affiliation: c.affiliation,
            function: c.function,
            experience: c.experience,
            facultyDepartment: c.facultyDepartment,
            researchCareerStage: c.researchCareerStage
          })),
          updatedContacts: updatedContacts.map(c => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            email: c.email,
            gender: c.gender,
            countryOfOrigin: c.countryOfOrigin,
            city: c.city,
            phone: c.phone,
            affiliation: c.affiliation,
            function: c.function,
            experience: c.experience,
            facultyDepartment: c.facultyDepartment,
            researchCareerStage: c.researchCareerStage
          }))
        })
      });

      if (body?.status !== 'SUCCESS') {
        const errorMessage = body?.errorMessage || body?.message || body?.error || 'Erreur serveur';
        showToast(`Échec de l'importation : ${errorMessage}`, 'error');
        return { ok: false, httpStatus: 200, status: body?.status || 'FAILED', errorMessage, data: null };
      }

      const createdCount = body.data?.createdCount || 0;
      const updatedCount = body.data?.updatedCount || 0;
      // Doublons détectés à l'import (OCR / CSV) : les fiches existantes ont
      // été enrichies plutôt que dupliquées.
      if (createdCount === 0 && updatedCount > 0) {
        showToast('Contact existant détecté : les informations ont été mises à jour.', 'success');
      } else {
        showToast(`Importation réussie : ${createdCount} créés, ${updatedCount} mis à jour.`, 'success');
      }
      await loadContacts();
      bumpContactsRefresh();
      return { ok: true, httpStatus: 200, status: body.status, errorMessage: '', data: body.data };
    } catch (err: any) {
      const httpStatus = err?.status || 0;
      // err.message est déjà normalisé et en français par la couche API.
      showToast(`Échec de l'importation : ${err.message}`, 'error');
      return { ok: false, httpStatus, status: err?.data?.status || 'FAILED', errorMessage: err.message, data: null };
    }
  };

  // ──────────────────────────────────────────────
  // SEGMENTS — persisted to DB
  // ──────────────────────────────────────────────
  const handleSelectSegment = (segmentId: string) => {
    setActiveSegmentId(segmentId);
  };

  const handleApplySegmentFromManagement = (segment: Segment) => {
    setActiveSegmentId(segment.id);
    navigate('/contacts');
  };

  const handleSaveCurrentAsSegment = async (segmentName: string, filters: FilterState) => {
    try {
      const res = await apiFetch('/api/segments', {
        method: 'POST',
        body: JSON.stringify({
          name: segmentName,
          description: 'Segment personnalisé enregistré depuis la recherche',
          filters
        })
      });
      const newSeg: Segment = {
        id: res.data.segment.id,
        name: res.data.segment.name,
        description: res.data.segment.description,
        icon: res.data.segment.icon,
        filters: res.data.segment.filters
      };
      setSegments(prev => [...prev, newSeg]);
      setActiveSegmentId(newSeg.id);
    } catch (err: any) {
      console.error('Error saving segment:', err.message);
      if (!isServiceUnreachable(err)) showToast(`Erreur lors de l'enregistrement du segment : ${err.message}`, 'error');
    }
  };

  const handleCreateSegment = async (segment: Segment) => {
    try {
      const res = await apiFetch('/api/segments', {
        method: 'POST',
        body: JSON.stringify({
          name: segment.name,
          description: segment.description,
          icon: segment.icon,
          filters: segment.filters
        })
      });
      const newSeg: Segment = {
        id: res.data.segment.id,
        name: res.data.segment.name,
        description: res.data.segment.description,
        icon: res.data.segment.icon,
        filters: res.data.segment.filters
      };
      setSegments(prev => [...prev, newSeg]);
    } catch (err: any) {
      console.error('Error creating segment:', err.message);
      if (!isServiceUnreachable(err)) showToast(`Erreur lors de la création du segment : ${err.message}`, 'error');
    }
  };

  const handleUpdateSegment = async (updated: Segment) => {
    try {
      const res = await apiFetch(`/api/segments/${updated.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: updated.name,
          description: updated.description,
          icon: updated.icon,
          filters: updated.filters
        })
      });
      const saved = res.data.segment;
      setSegments(prev => prev.map(s => s.id === saved.id ? { ...s, ...saved } : s));
    } catch (err: any) {
      console.error('Error updating segment:', err.message);
      if (!isServiceUnreachable(err)) showToast(`Erreur lors de la mise à jour du segment : ${err.message}`, 'error');
    }
  };

  const handleDeleteSegment = async (segmentId: string) => {
    try {
      await apiFetch(`/api/segments/${segmentId}`, { method: 'DELETE' });
      setSegments(prev => prev.filter(s => s.id !== segmentId));
      if (activeSegmentId === segmentId) setActiveSegmentId('all');
    } catch (err: any) {
      console.error('Error deleting segment:', err.message);
      if (!isServiceUnreachable(err)) showToast(`Erreur lors de la suppression du segment : ${err.message}`, 'error');
    }
  };

  // ──────────────────────────────────────────────
  // TAGS — persisted to DB via segment API
  // ──────────────────────────────────────────────
  const handleCreateTag = async (newTag: Tag) => {
    try {
      const res = await apiFetch('/api/segments/tags', {
        method: 'POST',
        body: JSON.stringify({
          name: newTag.name,
          color: newTag.color,
          description: newTag.description
        })
      });
      setTags(prev => [...prev, res.data.tag ?? newTag]);
    } catch (err: any) {
      console.error('Error creating tag:', err.message);
      if (!isServiceUnreachable(err)) showToast(`Erreur lors de la création du tag : ${err.message}`, 'error');
    }
  };

  const handleUpdateTag = async (updated: Tag) => {
    const oldTag = tags.find(t => t.id === updated.id);
    try {
      await apiFetch(`/api/segments/tags/${updated.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: updated.name, color: updated.color })
      });
      setTags(prev => prev.map(t => t.id === updated.id ? updated : t));
      if (oldTag && oldTag.name !== updated.name) {
        setContacts(prev => prev.map(c => ({
          ...c,
          tags: c.tags?.map(t => t === oldTag.name ? updated.name : t)
        })));
      }
    } catch (err: any) {
      console.error('Error updating tag:', err.message);
      if (!isServiceUnreachable(err)) showToast(`Erreur lors de la mise à jour du tag : ${err.message}`, 'error');
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    const tagToDelete = tags.find(t => t.id === tagId);
    try {
      await apiFetch(`/api/segments/tags/${tagId}`, { method: 'DELETE' });
      setTags(prev => prev.filter(t => t.id !== tagId));
      if (tagToDelete) {
        setContacts(prev => prev.map(c => ({
          ...c,
          tags: c.tags?.filter(t => t !== tagToDelete.name)
        })));
      }
    } catch (err: any) {
      console.error('Error deleting tag:', err.message);
      if (!isServiceUnreachable(err)) showToast(`Erreur lors de la suppression du tag : ${err.message}`, 'error');
    }
  };

  const handleSaveTagContacts = async (tagId: string, contactIds: string[]) => {
    try {
      const res = await apiFetch(`/api/segments/tags/${tagId}/contacts`, {
        method: 'PUT',
        body: JSON.stringify({ contactIds })
      });
      const savedTag = res.data.tag;
      const savedContactIds = new Set((savedTag.contacts || []).map((rel: any) => rel.contactId));
      setContacts(prev => prev.map(c => {
        const currentTags = c.tags || [];
        const has = currentTags.includes(savedTag.name);
        const shouldHave = savedContactIds.has(c.id);
        if (has === shouldHave) return c;
        return {
          ...c,
          tags: shouldHave
            ? [...currentTags, savedTag.name]
            : currentTags.filter(t => t !== savedTag.name)
        };
      }));
      showToast(`${savedContactIds.size} contact(s) associé(s) au tag "${savedTag.name}".`, 'success');
    } catch (err: any) {
      if (!isServiceUnreachable(err)) showToast(`Erreur d'association du tag : ${err.message}`, 'error');
      throw err;
    }
  };

  // ──────────────────────────────────────────────
  // SCROLL-HIDE HEADER
  // ──────────────────────────────────────────────
  const isContactsPage = location.pathname === '/contacts';
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    if (isContactsPage) {
      setIsHeaderVisible(true);
      return;
    }
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY <= 20) {
        setIsHeaderVisible(true);
        lastScrollY.current = currentScrollY;
        return;
      }
      if (currentScrollY > lastScrollY.current + 5) setIsHeaderVisible(false);
      else if (currentScrollY < lastScrollY.current - 5) setIsHeaderVisible(true);
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isContactsPage]);

  useEffect(() => {
    setIsHeaderVisible(true);
    lastScrollY.current = 0;
  }, [isContactsPage]);

  // Clear bulk-selection when returning to the directory (export scope lock)
  useEffect(() => {
    if (location.pathname === '/contacts') {
      setSelection({ mode: 'none', ids: [], filters: emptyFilterState(), totalCount: 0 });
      try {
        localStorage.removeItem('euraxess_contacts_selected_ids');
      } catch {
        // ignore
      }
    }
  }, [location.pathname]);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  // ──────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────
  // Tant que la session n'est pas réhydratée (/api/auth/me en vol), on affiche
  // un écran de chargement plein écran : ni flash du formulaire de login, ni
  // redirection prématurée — l'utilisateur reste sur son URL active.
  if (!isSessionReady) {
    return <AuthSplash />;
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<AuthView onLoginSuccess={handleLoginSuccess} />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          <Route path="/reset-password-expired" element={<ResetPasswordExpiredPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  // Session active : les routes publiques restent atteignables, mais sans
  // jamais fermer la session passivement (panneau « déjà connecté » sur
  // /login, consentement explicite pour traiter un lien e-mail).
  return (
    <div className="min-h-screen flex flex-col bg-[#F4F6F8] text-[#1C2529] font-sans selection:bg-[#005596] selection:text-white w-full max-w-full overflow-x-hidden">
      <Header
        isAuthenticated={isAuthenticated}
        user={user}
        onLogout={handleLogout}
        onExportAll={handleExportAll}
        isHeaderVisible={isHeaderVisible}
      />

      <main className="flex-1 pt-16 w-full max-w-full overflow-x-hidden flex flex-col">
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<PublicOnlyRoute mode="login" isAuthenticated={isAuthenticated} user={user} lastLoginAtRef={lastLoginAtRef} onForceSignOut={forceSignOutForAuthLink}><AuthView onLoginSuccess={handleLoginSuccess} /></PublicOnlyRoute>} />
        <Route path="/reset-password/:token" element={<PublicOnlyRoute mode="reset" isAuthenticated={isAuthenticated} user={user} lastLoginAtRef={lastLoginAtRef} onForceSignOut={forceSignOutForAuthLink}><ResetPasswordPage /></PublicOnlyRoute>} />
        <Route path="/reset-password-expired" element={<ResetPasswordExpiredPage />} />

        <Route path="/" element={<HomeRedirect role={user?.role} />} />

        {/* Profil accessible à TOUS les rôles (y compris l'admin depuis le
            menu « Mon profil ») : volontairement hors du groupe RequireUser. */}
        <Route
          path="/profile"
          element={
            <ProfileView
              user={user}
              onUserUpdate={handleUserUpdate}
              onLogout={handleLogout}
            />
          }
        />

        {/* Espace métier : interdit au rôle admin (redirigé vers /admin) */}
        <Route element={<RequireUser role={user?.role} />}>
        <Route
          path="/dashboard"
          element={
            <DashboardView
              contacts={contacts}
              tags={tags}
              onExportAll={handleExportAll}
              isLoading={isLoadingData}
              user={user}
            />
          }
        />

        <Route
          path="/contacts"
          element={
            <ContactsView
              segments={segments}
              tags={tags}
              activeSegmentId={activeSegmentId}
              onSelectSegment={handleSelectSegment}
              onSaveCurrentAsSegment={handleSaveCurrentAsSegment}
              onSelectContact={handleSelectContact}
              onDeleteContact={requestDeleteContact}
              onDeleteContacts={requestBulkDeleteContacts}
              refreshKey={contactsRefreshKey}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
              selection={selection}
              onSelectionChange={setSelection}
              user={user}
            />
          }
        />

        <Route
          path="/contacts/new"
          element={
            <RequirePrivilege user={user} need="create">
              <NewContactView
                onAddContact={handleAddContact}
                onUpdateContact={handleUpdateContact}
                existingContacts={contacts}
                tags={tags}
              />
            </RequirePrivilege>
          }
        />

        <Route
          path="/contacts/:id/edit"
          element={
            <RequirePrivilege user={user} need="edit">
              <NewContactView
                onAddContact={handleAddContact}
                onUpdateContact={handleUpdateContact}
                existingContacts={contacts}
                tags={tags}
              />
            </RequirePrivilege>
          }
        />

        <Route
          path="/contacts/:id"
          element={
            <ContactDetailView
              contacts={contacts}
              user={user}
            />
          }
        />

        <Route
          path="/import"
          element={
            <RequirePrivilege user={user} need="create">
              <ImportWizardView
                onImportContacts={handleImportContacts}
                existingContacts={contacts}
              />
            </RequirePrivilege>
          }
        />

        <Route
          path="/export"
          element={
            <ExportView
              selection={selection}
              tags={tags}
            />
          }
        />

        <Route path="/segments" element={
            <SegmentationView
              contacts={contacts}
              tags={tags}
              segments={segments}
              isLoading={isLoadingTaxonomy}
              onApplySegment={handleApplySegmentFromManagement}
              onCreateSegment={handleCreateSegment}
              onUpdateSegment={handleUpdateSegment}
              onDeleteSegment={handleDeleteSegment}
              onCreateTag={handleCreateTag}
              onUpdateTag={handleUpdateTag}
              onDeleteTag={handleDeleteTag}
              onSaveTagContacts={handleSaveTagContacts}
              user={user}
            />
          }
        />
        </Route>

        <Route path="/admin/dashboard" element={<Navigate to="/admin" replace />} />

        <Route
          path="/admin"
          element={
            <RequireAdmin role={user?.role}>
              <AdminView />
            </RequireAdmin>
          }
        />

        <Route path="*" element={<HomeRedirect role={user?.role} />} />
      </Routes>
      </Suspense>
      </main>

      <Footer />

      <FirstLoginWelcomeModal
        open={showFirstLoginModal && Boolean(user?.isFirstLogin)}
        userName={user?.name?.split(' ')[0] || ''}
        onClose={() => {
          setShowFirstLoginModal(false);
          setUser(prev => (prev ? { ...prev, isFirstLogin: false } : prev));
        }}
      />

      <ModalConfirmation
        open={Boolean(pendingDelete)}
        title="Supprimer le contact"
        confirmLabel="Supprimer"
        variant="danger"
        isLoading={false}
        onConfirm={() => performDeleteContact(pendingDelete!.id)}
        onCancel={() => setPendingDelete(null)}
        message={
          <span>
            Voulez-vous vraiment supprimer définitivement la fiche de{' '}
            <strong>{pendingDelete?.name}</strong> ? Cette action est irréversible.
          </span>
        }
      />

      <ModalConfirmation
        open={Boolean(pendingBulkDelete)}
        title="Supprimer la sélection"
        confirmLabel={`Supprimer (${pendingBulkDelete?.length ?? 0})`}
        variant="danger"
        isLoading={false}
        onConfirm={performBulkDeleteContacts}
        onCancel={() => setPendingBulkDelete(null)}
        message={
          <span>
            Voulez-vous vraiment supprimer définitivement{' '}
            <strong>{pendingBulkDelete?.length ?? 0} contact(s)</strong> ? Cette action est irréversible.
          </span>
        }
      />

      {isSessionReady && !location.pathname.startsWith('/admin') && (
        <ChatWidget getToken={getChatToken} />
      )}
    </div>
  );
}
