import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ViewPage, Contact, ImportConflict, ExchangeNote, Tag, Segment, FilterState } from './types';
import { INITIAL_IMPORT_CONFLICTS } from './data/mockData';
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
import { AuthView } from './components/AuthView';

// --- API helper ---
function mapContactFromApi(c: any): Contact {
  return {
    ...c,
    actorType: c.actorType || c.typeActeur?.name || 'PME',
    interventionZones: c.interventionZones || [],
    expertise: c.expertise || [],
    tags: Array.isArray(c.tags)
      ? c.tags.map((t: any) => t.tag?.name ?? t.name ?? t)
      : [],
    projects: Array.isArray(c.projects)
      ? c.projects.map((p: any) => p.project ?? p)
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
  const [activePage, setActivePage] = useState<ViewPage>('dashboard');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [conflicts, setConflicts] = useState<ImportConflict[]>(INITIAL_IMPORT_CONFLICTS);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);

  // Selected contacts in directory for bulk actions & export
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  // Pagination limit state across view switches
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Edit contact state
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Tags & Segments State
  const [tags, setTags] = useState<Tag[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<string>('all');

  // Authentication State (defaults to true for smooth start, can toggle to auth page)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);

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
        if (Array.isArray(data.data.savedSegments)) {
          setSegments(
            data.data.savedSegments.map((s: any) => ({
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

  // Currently selected contact
  const currentContact = contacts.find(c => c.id === selectedContactId) || contacts[0];

  // ──────────────────────────────────────────────
  // AUTH
  // ──────────────────────────────────────────────
  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setActivePage('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setActivePage('auth');
  };

  // ──────────────────────────────────────────────
  // NAVIGATION
  // ──────────────────────────────────────────────
  const handleNavigate = (page: ViewPage) => {
    if (page === 'auth') setIsAuthenticated(false);
    if (page !== 'new-contact') setEditingContact(null);
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ──────────────────────────────────────────────
  // CONTACT CRUD — all persisted to DB
  // ──────────────────────────────────────────────
  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setActivePage('new-contact');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateContact = async (updatedContact: Contact) => {
    try {
      const res = await apiFetch(`/api/contacts/${updatedContact.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: updatedContact.name,
          title: updatedContact.title,
          email: updatedContact.email,
          phone: updatedContact.phone,
          organization: updatedContact.organization,
          country: updatedContact.country,
          actorType: updatedContact.actorType,
          expertise: updatedContact.expertise,
          interventionZones: updatedContact.interventionZones,
          linkedin: updatedContact.linkedin
        })
      });
      const saved = mapContactFromApi(res.data.contact);
      setContacts(prev => prev.map(c => c.id === saved.id ? saved : c));
      showToast(`Contact ${saved.name} mis à jour avec succès.`, 'success');
    } catch (err: any) {
      showToast(`Erreur mise à jour : ${err.message}`, 'error');
      setContacts(prev => prev.map(c => c.id === updatedContact.id ? updatedContact : c));
    }
    setEditingContact(null);
  };

  const handleSelectContact = (contactId: string) => {
    setSelectedContactId(contactId);
    setActivePage('contact-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddContact = async (newContact: Contact) => {
    try {
      const res = await apiFetch('/api/contacts', {
        method: 'POST',
        body: JSON.stringify({
          name: newContact.name,
          title: newContact.title,
          email: newContact.email,
          phone: newContact.phone,
          organization: newContact.organization,
          country: newContact.country,
          actorType: newContact.actorType,
          expertise: newContact.expertise,
          interventionZones: newContact.interventionZones,
          linkedin: newContact.linkedin
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
  const handleResolveConflict = (conflictId: string, status: 'resolved_merged' | 'ignored' | 'forced_new') => {
    setConflicts(prev => prev.map(c => c.id === conflictId ? { ...c, status } : c));
  };

  const handleImportContacts = async (newContacts: Contact[], updatedContacts: Contact[] = []) => {
    try {
      const res = await apiFetch('/api/contacts/bulk', {
        method: 'POST',
        body: JSON.stringify({
          newContacts: newContacts.map(c => ({
            name: c.name,
            email: c.email,
            phone: c.phone,
            organization: c.organization,
            title: c.title,
            country: c.country,
            actorType: c.actorType,
            expertise: c.expertise,
            interventionZones: c.interventionZones
          })),
          updatedContacts: updatedContacts.map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            organization: c.organization,
            title: c.title,
            country: c.country,
            actorType: c.actorType,
            expertise: c.expertise
          }))
        })
      });
      showToast(`Importation réussie : ${res.data?.createdCount || 0} créés, ${res.data?.updatedCount || 0} mis à jour.`, 'success');
      await loadContacts();
    } catch (err: any) {
      showToast(`Erreur lors de l'importation : ${err.message}`, 'error');
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
    setActivePage('contacts');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const handleToggleContactTag = (contactId: string, tagName: string) => {
    // Optimistic local update — tag toggle is UI-only for now
    setContacts(prev => prev.map(c => {
      if (c.id === contactId) {
        const currentTags = c.tags || [];
        const has = currentTags.includes(tagName);
        return { ...c, tags: has ? currentTags.filter(t => t !== tagName) : [...currentTags, tagName] };
      }
      return c;
    }));
  };

  // ──────────────────────────────────────────────
  // SCROLL-HIDE HEADER
  // ──────────────────────────────────────────────
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    if (activePage === 'contacts') {
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
  }, [activePage]);

  useEffect(() => {
    setIsHeaderVisible(true);
    lastScrollY.current = 0;
  }, [activePage]);

  // ──────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────
  if (activePage === 'auth' || !isAuthenticated) {
    return <AuthView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F6F8] text-[#071f1f] font-sans selection:bg-[#35b8b2] selection:text-white w-full max-w-full overflow-x-hidden">
      
      <Header
        activePage={activePage}
        onNavigate={handleNavigate}
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
        isHeaderVisible={isHeaderVisible}
      />

      <main className="flex-1 pt-16 w-full max-w-full overflow-x-hidden flex flex-col">
        <div className={activePage === 'dashboard' ? 'block' : 'hidden'}>
          <DashboardView
            contacts={contacts}
            onNavigate={handleNavigate}
            onSelectContact={handleSelectContact}
            isLoading={isLoadingData}
          />
        </div>

        <div className={activePage === 'contacts' ? 'block' : 'hidden'}>
          <ContactsView
            contacts={contacts}
            segments={segments}
            tags={tags}
            activeSegmentId={activeSegmentId}
            onSelectSegment={handleSelectSegment}
            onSaveCurrentAsSegment={handleSaveCurrentAsSegment}
            onNavigate={handleNavigate}
            onSelectContact={handleSelectContact}
            onDeleteContact={handleDeleteContact}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={setItemsPerPage}
            onEditContact={handleEditContact}
            selectedContactIds={selectedContactIds}
            onSelectContactIds={setSelectedContactIds}
            isLoading={isLoadingData}
          />
        </div>

        <div className={activePage === 'segmentation' ? 'block' : 'hidden'}>
          <SegmentationView
            contacts={contacts}
            tags={tags}
            segments={segments}
            onNavigate={handleNavigate}
            onApplySegment={handleApplySegmentFromManagement}
            onCreateSegment={handleCreateSegment}
            onUpdateSegment={handleUpdateSegment}
            onDeleteSegment={handleDeleteSegment}
            onCreateTag={handleCreateTag}
            onUpdateTag={handleUpdateTag}
            onDeleteTag={handleDeleteTag}
            onToggleContactTag={handleToggleContactTag}
          />
        </div>

        {activePage === 'contact-detail' && currentContact && (
          <ContactDetailView
            contact={currentContact}
            onNavigate={handleNavigate}
            onAddNote={handleAddNote}
            onEditContact={handleEditContact}
          />
        )}

        <div className={activePage === 'importation' ? 'block' : 'hidden'}>
          <ImportWizardView
            onNavigate={handleNavigate}
            onImportContacts={handleImportContacts}
            existingContacts={contacts}
          />
        </div>

        {activePage === 'new-contact' && (
          <NewContactView
            onNavigate={handleNavigate}
            onAddContact={handleAddContact}
            contactToEdit={editingContact}
            onUpdateContact={handleUpdateContact}
            existingContacts={contacts}
          />
        )}

        <div className={activePage === 'exportation' ? 'block' : 'hidden'}>
          <ExportView
            onNavigate={handleNavigate}
            contacts={contacts}
            selectedContactIds={selectedContactIds}
          />
        </div>
      </main>

      <Footer onNavigate={handleNavigate} />
    </div>
  );
}
