import React, { useState, useEffect, useRef } from 'react';
import { ViewPage, Contact, ImportConflict, ExchangeNote, Tag, Segment, FilterState } from './types';
import { INITIAL_CONTACTS, INITIAL_IMPORT_CONFLICTS, INITIAL_TAGS, INITIAL_SEGMENTS } from './data/mockData';
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

export default function App() {
  const [activePage, setActivePage] = useState<ViewPage>('dashboard');
  const [contacts, setContacts] = useState<Contact[]>(INITIAL_CONTACTS);
  const [conflicts, setConflicts] = useState<ImportConflict[]>(INITIAL_IMPORT_CONFLICTS);
  const [selectedContactId, setSelectedContactId] = useState<string>('amadou-diallo');
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);

  // Selected contacts in directory for bulk actions & export
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  // Pagination limit state across view switches
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Edit contact state
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Tags & Segments State
  const [tags, setTags] = useState<Tag[]>(INITIAL_TAGS);
  const [segments, setSegments] = useState<Segment[]>(INITIAL_SEGMENTS);
  const [activeSegmentId, setActiveSegmentId] = useState<string>('all');

  // Authentication State (defaults to true for smooth start, can toggle to auth page)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);

  // Initial backend API fetch / loading simulation
  useEffect(() => {
    let isMounted = true;
    setIsLoadingData(true);
    
    // Attempt fetching from API routes if active
    fetch('/api/contacts')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (isMounted && data && Array.isArray(data.contacts)) {
          setContacts(data.contacts);
        }
      })
      .catch(() => {
        // Fallback to local data seamlessly
      })
      .finally(() => {
        if (isMounted) {
          // Subtle minimum timer for visual skeleton smooth feedback
          setTimeout(() => {
            if (isMounted) setIsLoadingData(false);
          }, 450);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Currently selected contact
  const currentContact = contacts.find(c => c.id === selectedContactId) || contacts[0];

  // Login Handler
  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setActivePage('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Logout Handler
  const handleLogout = () => {
    setIsAuthenticated(false);
    setActivePage('auth');
  };

  // Navigation handler
  const handleNavigate = (page: ViewPage) => {
    if (page === 'auth') {
      setIsAuthenticated(false);
    }
    if (page !== 'new-contact') {
      setEditingContact(null);
    }
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Edit contact handler
  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setActivePage('new-contact');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Update existing contact handler
  const handleUpdateContact = (updatedContact: Contact) => {
    setContacts(prev => prev.map(c => c.id === updatedContact.id ? updatedContact : c));
    setEditingContact(null);
  };

  // Select contact detail handler
  const handleSelectContact = (contactId: string) => {
    setSelectedContactId(contactId);
    setActivePage('contact-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Add new contact handler
  const handleAddContact = (newContact: Contact) => {
    setContacts(prev => [newContact, ...prev]);
  };

  // Delete contact handler
  const handleDeleteContact = (contactId: string) => {
    setContacts(prev => prev.filter(c => c.id !== contactId));
  };

  // Add exchange note handler
  const handleAddNote = (contactId: string, note: Omit<ExchangeNote, 'id'>) => {
    const noteId = `note-${Date.now()}`;
    const completeNote: ExchangeNote = { ...note, id: noteId };

    setContacts(prev => prev.map(c => {
      if (c.id === contactId) {
        return {
          ...c,
          exchangeNotes: [completeNote, ...c.exchangeNotes]
        };
      }
      return c;
    }));
  };

  // Conflict resolution handler
  const handleResolveConflict = (conflictId: string, status: 'resolved_merged' | 'ignored' | 'forced_new') => {
    setConflicts(prev => prev.map(c => {
      if (c.id === conflictId) {
        return { ...c, status };
      }
      return c;
    }));
  };

  // Finalize import handler for real wizard (supports new & merged contacts)
  const handleImportContacts = (newContacts: Contact[], updatedContacts: Contact[] = []) => {
    setContacts(prev => {
      // 1. Update existing contacts that were merged
      const updatedList = prev.map(c => {
        const match = updatedContacts.find(u => u.id === c.id);
        return match ? match : c;
      });

      // 2. Prepend brand new contacts
      if (newContacts.length > 0) {
        return [...newContacts, ...updatedList];
      }
      return updatedList;
    });
  };

  // SEGMENT HANDLERS
  const handleSelectSegment = (segmentId: string) => {
    setActiveSegmentId(segmentId);
  };

  const handleApplySegmentFromManagement = (segment: Segment) => {
    setActiveSegmentId(segment.id);
    setActivePage('contacts');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveCurrentAsSegment = (segmentName: string, filters: FilterState) => {
    const newSeg: Segment = {
      id: `seg-${Date.now()}`,
      name: segmentName,
      description: 'Segment personnalisé enregistré depuis la recherche',
      filters
    };
    setSegments(prev => [...prev, newSeg]);
    setActiveSegmentId(newSeg.id);
  };

  const handleCreateSegment = (segment: Segment) => {
    setSegments(prev => [...prev, segment]);
  };

  const handleUpdateSegment = (updated: Segment) => {
    setSegments(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  const handleDeleteSegment = (segmentId: string) => {
    setSegments(prev => prev.filter(s => s.id !== segmentId));
    if (activeSegmentId === segmentId) {
      setActiveSegmentId('all');
    }
  };

  // TAG HANDLERS
  const handleCreateTag = (newTag: Tag) => {
    setTags(prev => [...prev, newTag]);
  };

  const handleUpdateTag = (updated: Tag) => {
    const oldTag = tags.find(t => t.id === updated.id);
    setTags(prev => prev.map(t => t.id === updated.id ? updated : t));

    // Rename tag in contacts if tag name changed
    if (oldTag && oldTag.name !== updated.name) {
      setContacts(prev => prev.map(c => {
        if (!c.tags) return c;
        return {
          ...c,
          tags: c.tags.map(t => t === oldTag.name ? updated.name : t)
        };
      }));
    }
  };

  const handleDeleteTag = (tagId: string) => {
    const tagToDelete = tags.find(t => t.id === tagId);
    setTags(prev => prev.filter(t => t.id !== tagId));

    if (tagToDelete) {
      setContacts(prev => prev.map(c => ({
        ...c,
        tags: c.tags?.filter(t => t !== tagToDelete.name)
      })));
    }
  };

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

      if (currentScrollY > lastScrollY.current + 5) {
        setIsHeaderVisible(false);
      } else if (currentScrollY < lastScrollY.current - 5) {
        setIsHeaderVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activePage]);

  useEffect(() => {
    setIsHeaderVisible(true);
    lastScrollY.current = 0;
  }, [activePage]);

  const handleToggleContactTag = (contactId: string, tagName: string) => {
    setContacts(prev => prev.map(c => {
      if (c.id === contactId) {
        const currentTags = c.tags || [];
        const has = currentTags.includes(tagName);
        return {
          ...c,
          tags: has ? currentTags.filter(t => t !== tagName) : [...currentTags, tagName]
        };
      }
      return c;
    }));
  };

  if (activePage === 'auth' || !isAuthenticated) {
    return <AuthView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F6F8] text-[#071f1f] font-sans selection:bg-[#35b8b2] selection:text-white w-full max-w-full overflow-x-hidden">
      
      {/* Global Header */}
      <Header 
        activePage={activePage} 
        onNavigate={handleNavigate} 
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
        isHeaderVisible={isHeaderVisible}
      />

      {/* Main Content Area */}
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

      {/* Global Footer (Spans 100% width under Sidebar & Content) */}
      <Footer onNavigate={handleNavigate} />

    </div>
  );
}
