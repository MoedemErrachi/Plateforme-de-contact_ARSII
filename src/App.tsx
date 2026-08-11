import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Contact, ExchangeNote, Tag, Segment, FilterState, User } from './types';
import { useToast } from './components/Toast';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { DashboardView } from './components/DashboardView';
import { ContactsView } from './components/ContactsView';
import { ContactDetailView } from './components/ContactDetailView';
import { ImportWizardView } from './components/ImportWizardView';
import { NewContactView } from './components/NewContactView';
import { ExportView } from './components/ExportView';
import { SegmentationView } from './components/SegmentationView';
import { ProfileView } from './components/ProfileView';
import { AuthView } from './components/AuthView';

// --- API helper ---
function mapContactFromApi(c: any): Contact {
  const firstName = c.firstName || '';
  const lastName = c.lastName || '';
  return {
    ...c,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim() || c.name || 'Nouveau Contact',
    initials: `${(firstName[0] || '')}${(lastName[0] || '')}`.toUpperCase() || c.initials || 'NC',
    gender: c.gender || 'PREFER_NOT_TO_SAY',
    researchCareerStage: c.researchCareerStage || 'R1_FIRST_STAGE',
    countryOfOrigin: c.countryOfOrigin || '',
    city: c.city || '',
    phone: c.phone || '',
    affiliation: c.affiliation || '',
    tags: Array.isArray(c.tags)
      ? c.tags.map((t: any) => t.tag?.name ?? t.name ?? t)
      : [],
    exchangeNotes: Array.isArray(c.exchangeNotes)
      ? c.exchangeNotes.map((n: any) => ({
          ...n,
          type: (n.type || 'NOTE').toLowerCase() as ExchangeNote['type']
        }))
      : []
  };
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || json.message || `API error ${res.status}`);
  }
  return json;
}

export default function App() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);

  // Selected contacts in directory for bulk actions & export
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

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
  const [activeSegmentId, setActiveSegmentId] = useState<string>('all');

  // Authentication State (defaults to true for smooth start, can toggle to auth page)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);

  // ──────────────────────────────────────────────
  // Load contacts from database on mount
  // ──────────────────────────────────────────────
  const loadContacts = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const data = await apiFetch('/api/contacts?limit=200');
      if (data?.data?.contacts) {
        setContacts(data.data.contacts.map(mapContactFromApi));
      }
    } catch (err) {
      console.error('Error loading contacts:', err);
    } finally {
      setTimeout(() => setIsLoadingData(false), 300);
    }
  }, []);

  // Load tags & segments from database
  const loadTagsAndSegments = useCallback(async () => {
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
              filters: s.filters ?? {}
            }))
          );
        }
      }
    } catch (err) {
      showToast('Erreur lors du chargement des segments.', 'error');
    }
  }, []);

  useEffect(() => {
    loadContacts();
    loadTagsAndSegments();
  }, [loadContacts, loadTagsAndSegments]);

  // Restore active session on mount (real DB-backed user)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch('/api/auth/me');
        if (!cancelled && data?.authenticated && data?.user) {
          setUser(data.user);
          setIsAuthenticated(true);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setIsAuthenticated(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ──────────────────────────────────────────────
  // AUTH
  // ──────────────────────────────────────────────
  const handleLoginSuccess = (userData: User) => {
    setUser(userData);
    setIsAuthenticated(true);
    navigate('/dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
    navigate('/login');
  };

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
      showToast(`Erreur mise à jour : ${err.message}`, 'error');
      setContacts(prev => prev.map(c => c.id === updatedContact.id ? updatedContact : c));
    }
  };

  const handleSelectContact = (contactId: string) => {
    navigate(`/contacts/${contactId}`);
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
      showToast(`Contact ${saved.name} enregistré avec succès.`, 'success');
    } catch (err: any) {
      showToast(`Erreur création contact : ${err.message}`, 'error');
      throw err; // rethrow so NewContactView does not navigate away
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    try {
      await apiFetch(`/api/contacts/${contactId}`, { method: 'DELETE' });
      setContacts(prev => prev.filter(c => c.id !== contactId));
      showToast('Contact supprimé.', 'success');
    } catch (err: any) {
      showToast(`Erreur suppression : ${err.message}`, 'error');
    }
  };

  // ──────────────────────────────────────────────
  // EXCHANGE NOTES — persisted to DB
  // ──────────────────────────────────────────────
  const handleAddNote = async (contactId: string, note: Omit<ExchangeNote, 'id'>) => {
    try {
      const res = await apiFetch(`/api/contacts/${contactId}/notes`, {
        method: 'POST',
        body: JSON.stringify({
          title: note.title,
          content: note.content,
          type: (note.type || 'note').toUpperCase(),
          date: note.date,
          relativeTime: note.relativeTime,
          author: note.author,
          authorInitials: note.authorInitials,
          projectName: note.projectName
        })
      });
      const savedNote: ExchangeNote = {
        ...res.data.note,
        type: (res.data.note.type || 'note').toLowerCase() as ExchangeNote['type']
      };
      setContacts(prev => prev.map(c =>
        c.id === contactId
          ? { ...c, exchangeNotes: [savedNote, ...c.exchangeNotes] }
          : c
      ));
      showToast('Note enregistrée.', 'success');
    } catch (err: any) {
      showToast(`Erreur note : ${err.message}`, 'error');
    }
  };

  // ──────────────────────────────────────────────
  // IMPORT
  // ──────────────────────────────────────────────
  const handleImportContacts = async (newContacts: Contact[], updatedContacts: Contact[] = []) => {
    let res: Response;
    try {
      res = await fetch('/api/contacts/bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
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
    } catch (err: any) {
      showToast(`Erreur réseau lors de l'importation : ${err.message}`, 'error');
      return { ok: false, httpStatus: 0, status: 'FAILED', errorMessage: err.message, data: null };
    }

    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    if (!res.ok || body?.status !== 'SUCCESS') {
      const errorMessage = body?.errorMessage || body?.message || body?.error || `Erreur serveur (HTTP ${res.status})`;
      showToast(`Échec de l'importation : ${errorMessage}`, 'error');
      return { ok: false, httpStatus: res.status, status: body?.status || 'FAILED', errorMessage, data: null };
    }

    showToast(`Importation réussie : ${body.data?.createdCount || 0} créés, ${body.data?.updatedCount || 0} mis à jour.`, 'success');
    await loadContacts();
    return { ok: true, httpStatus: res.status, status: body.status, errorMessage: '', data: body.data };
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
    }
  };

  const handleDeleteSegment = async (segmentId: string) => {
    try {
      await apiFetch(`/api/segments/${segmentId}`, { method: 'DELETE' });
      setSegments(prev => prev.filter(s => s.id !== segmentId));
      if (activeSegmentId === segmentId) setActiveSegmentId('all');
    } catch (err: any) {
      console.error('Error deleting segment:', err.message);
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
          category: newTag.category,
          description: newTag.description
        })
      });
      setTags(prev => [...prev, res.data.tag ?? newTag]);
    } catch (err: any) {
      console.error('Error creating tag:', err.message);
      setTags(prev => [...prev, newTag]); // fallback optimistic
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
      showToast(`Erreur d'association du tag : ${err.message}`, 'error');
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

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  // ──────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<AuthView onLoginSuccess={handleLoginSuccess} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F6F8] text-[#1C2529] font-sans selection:bg-[#005596] selection:text-white w-full max-w-full overflow-x-hidden">
      <Header
        isAuthenticated={isAuthenticated}
        user={user}
        onLogout={handleLogout}
        isHeaderVisible={isHeaderVisible}
      />

      <main className="flex-1 pt-16 w-full max-w-full overflow-x-hidden flex flex-col">
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route
          path="/dashboard"
          element={
            <DashboardView
              contacts={contacts}
              tags={tags}
              onSelectContact={handleSelectContact}
              isLoading={isLoadingData}
            />
          }
        />

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

        <Route
          path="/contacts"
          element={
            <ContactsView
              contacts={contacts}
              segments={segments}
              tags={tags}
              activeSegmentId={activeSegmentId}
              onSelectSegment={handleSelectSegment}
              onSaveCurrentAsSegment={handleSaveCurrentAsSegment}
              onSelectContact={handleSelectContact}
              onDeleteContact={handleDeleteContact}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
              selectedContactIds={selectedContactIds}
              onSelectContactIds={setSelectedContactIds}
              isLoading={isLoadingData}
            />
          }
        />

        <Route
          path="/contacts/new"
          element={
            <NewContactView
              onAddContact={handleAddContact}
              onUpdateContact={handleUpdateContact}
              existingContacts={contacts}
              tags={tags}
            />
          }
        />

        <Route
          path="/contacts/:id/edit"
          element={
            <NewContactView
              onAddContact={handleAddContact}
              onUpdateContact={handleUpdateContact}
              existingContacts={contacts}
              tags={tags}
            />
          }
        />

        <Route
          path="/contacts/:id"
          element={
            <ContactDetailView
              contacts={contacts}
              onAddNote={handleAddNote}
            />
          }
        />

        <Route
          path="/import"
          element={
            <ImportWizardView
              onImportContacts={handleImportContacts}
              existingContacts={contacts}
            />
          }
        />

        <Route
          path="/export"
          element={
            <ExportView
              contacts={contacts}
              selectedContactIds={selectedContactIds}
            />
          }
        />

        <Route
          path="/segments"
          element={
            <SegmentationView
              contacts={contacts}
              tags={tags}
              segments={segments}
              onApplySegment={handleApplySegmentFromManagement}
              onCreateSegment={handleCreateSegment}
              onUpdateSegment={handleUpdateSegment}
              onDeleteSegment={handleDeleteSegment}
              onCreateTag={handleCreateTag}
              onUpdateTag={handleUpdateTag}
              onDeleteTag={handleDeleteTag}
              onSaveTagContacts={handleSaveTagContacts}
            />
          }
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </main>

      <Footer />
    </div>
  );
}
