import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, Download, Loader2, MessageSquare, RotateCcw, Search, Send, UserRound, X } from 'lucide-react';
import { Contact, FilterState, Gender, ResearchCareerStage } from '../../types';
import { downloadContactsCsv } from '../../utils/exportCsv';

const SESSION_KEY = 'chatbot_session_id';
const API_URL = import.meta.env.VITE_CHATBOT_API_URL || 'http://localhost:8000';

const WELCOME_MESSAGE =
  "Bonjour ! Je suis l'assistant IA du CRM EURAXESS Africa.\n\n" +
  'Je peux rechercher des chercheurs, répondre à vos questions sur la base de données et préparer des exports.\n\n' +
  'Essayez par exemple :\n' +
  '- « Chercheurs au Sénégal »\n' +
  '- « Combien de chercheurs sont basés en Afrique ? »\n' +
  '- « Aide »';

const QUICK_ACTIONS = ['Aide', 'Chercheurs au Sénégal'];

interface ContactFilters {
  countryOfOrigin?: string | null;
  affiliation?: string | null;
  facultyDepartment?: string | null;
  researchCareerStage?: ResearchCareerStage | null;
  gender?: Gender | null;
  [key: string]: unknown;
}

type ChatAction =
  | { type: 'view_filtered_list'; filters?: ContactFilters | null }
  | { type: 'export_csv'; filters?: ContactFilters | null }
  | { type: 'view_contact_profile'; contactId?: string | null };

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: ChatAction[];
  isError?: boolean;
}

interface ChatWidgetProps {
  contacts: Contact[];
  getToken?: () => string | null;
}

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getOrCreateSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = generateSessionId();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return generateSessionId();
  }
}

function resetSessionId(): string {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore storage failures
  }
  return getOrCreateSessionId();
}

const TOKEN_KEYS = ['euraxess_token', 'auth_token', 'accessToken', 'token', 'jwt', 'access_token'];

function resolveAuthToken(): { token: string; source: string | null } {
  const sources: Array<{ storage: Storage | undefined; label: string }> = [
    { storage: window.localStorage, label: 'localStorage' },
    { storage: window.sessionStorage, label: 'sessionStorage' }
  ];
  try {
    for (const { storage, label } of sources) {
      if (!storage) continue;
      for (const key of TOKEN_KEYS) {
        try {
          const value = storage.getItem(key);
          if (value && value.trim()) {
            return { token: value.trim(), source: `${label}.${key}` };
          }
        } catch {
          // ignore storage failures
        }
      }
    }
  } catch {
    // ignore storage failures
  }
  return { token: '', source: null };
}

function normalizeAction(raw: unknown): ChatAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.type !== 'string') return null;
  const type = candidate.type;
  const filters =
    candidate.filters && typeof candidate.filters === 'object'
      ? (candidate.filters as ContactFilters)
      : null;
  const contactId =
    typeof candidate.contactId === 'string'
      ? candidate.contactId
      : typeof candidate.contact_id === 'string'
        ? (candidate.contact_id as string)
        : null;
  if (type === 'view_filtered_list' || type === 'export_csv') {
    return { type, filters };
  }
  if (type === 'view_contact_profile') {
    return { type, contactId };
  }
  return null;
}

function filterValueMatches(actual: string | null | undefined, expected: string | null | undefined): boolean {
  if (!expected) return true;
  return (actual || '').trim().toLowerCase() === expected.trim().toLowerCase();
}

function contactMatches(contact: Contact, filters?: ContactFilters | null): boolean {
  if (!filters) return true;
  if (!filterValueMatches(contact.countryOfOrigin, filters.countryOfOrigin)) return false;
  if (!filterValueMatches(contact.gender, filters.gender)) return false;
  if (!filterValueMatches(contact.researchCareerStage, filters.researchCareerStage)) return false;
  if (filters.affiliation && !(contact.affiliation || '').toLowerCase().includes(filters.affiliation.toLowerCase())) {
    return false;
  }
  if (
    filters.facultyDepartment &&
    !(contact.facultyDepartment || '').toLowerCase().includes(filters.facultyDepartment.toLowerCase())
  ) {
    return false;
  }
  return true;
}

function toFilterState(filters?: ContactFilters | null): FilterState {
  return {
    search: filters?.facultyDepartment?.trim() || '',
    countries: filters?.countryOfOrigin ? [filters.countryOfOrigin] : [],
    genders: filters?.gender ? [filters.gender] : [],
    careerStages: filters?.researchCareerStage ? [filters.researchCareerStage] : [],
    affiliations: filters?.affiliation?.trim() || '',
    tags: []
  };
}

const Markdown: React.FC<{ content: string }> = ({ content }) => {
  const navigate = useNavigate();
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-5 my-1.5 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 my-1.5 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
        em: ({ children }) => <em>{children}</em>,
        h1: ({ children }) => <h1 className="text-base font-bold mt-2 mb-1">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold mt-2 mb-1">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-bold mt-1.5 mb-1">{children}</h3>,
        h4: ({ children }) => <h4 className="text-xs font-bold mt-1.5 mb-0.5">{children}</h4>,
        a: ({ children, href }) => {
          if (href && href.startsWith('/contacts/')) {
            return (
              <a
                href={href}
                onClick={e => {
                  e.preventDefault();
                  navigate(href);
                }}
                className="text-[#005596] underline cursor-pointer"
              >
                {children}
              </a>
            );
          }
          return (
            <a href={href} target="_blank" rel="noreferrer" className="text-[#005596] underline">
              {children}
            </a>
          );
        },
        code: ({ children }) => (
          <code className="bg-slate-100 rounded px-1 py-0.5 text-xs font-mono break-all">{children}</code>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="w-full text-xs border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead>{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr className="border-b border-slate-200">{children}</tr>,
        th: ({ children }) => (
          <th className="border border-slate-200 bg-slate-50 px-2 py-1 text-left font-semibold">{children}</th>
        ),
        td: ({ children }) => <td className="border border-slate-200 px-2 py-1">{children}</td>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-slate-300 pl-3 my-1.5 italic text-slate-600">{children}</blockquote>
        ),
        hr: () => <hr className="my-2 border-slate-200" />
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

const TypingIndicator: React.FC = () => (
  <span className="inline-flex items-center gap-1 py-1">
    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
  </span>
);

interface ActionButtonsProps {
  actions: ChatAction[];
  onViewList: (filters?: ContactFilters | null) => void;
  onExport: (filters?: ContactFilters | null) => void;
  onProfile: (contactId?: string | null) => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ actions, onViewList, onExport, onProfile }) => (
  <div className="mt-2 flex flex-col gap-1.5">
    {actions.map((action, index) => {
      if (action.type === 'view_filtered_list') {
        return (
          <button
            key={index}
            onClick={() => onViewList(action.filters)}
            className="flex items-center gap-2 text-xs font-semibold text-[#005596] bg-[#005596]/5 hover:bg-[#005596]/10 border border-[#005596]/20 rounded-lg px-3 py-2 transition-colors cursor-pointer text-left"
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            Voir la liste des contacts
          </button>
        );
      }
      if (action.type === 'export_csv') {
        return (
          <button
            key={index}
            onClick={() => onExport(action.filters)}
            className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-600/5 hover:bg-emerald-600/10 border border-emerald-600/20 rounded-lg px-3 py-2 transition-colors cursor-pointer text-left"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            Exporter en CSV
          </button>
        );
      }
      return (
        <button
          key={index}
          onClick={() => onProfile(action.contactId)}
          className="flex items-center gap-2 text-xs font-semibold text-[#B8167C] bg-[#B8167C]/5 hover:bg-[#B8167C]/10 border border-[#B8167C]/20 rounded-lg px-3 py-2 transition-colors cursor-pointer text-left"
        >
          <UserRound className="w-3.5 h-3.5 shrink-0" />
          Voir le profil du chercheur
        </button>
      );
    })}
  </div>
);

export const ChatWidget: React.FC<ChatWidgetProps> = ({ contacts, getToken }) => {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<string>(getOrCreateSessionId);
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: generateSessionId(), role: 'assistant', content: WELCOME_MESSAGE }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isPending, isOpen]);

  const handleSend = useCallback(
    async (rawMessage?: string) => {
      const text = (rawMessage ?? input).trim();
      if (!text || isPending) return;
      setInput('');
      const tokenInfo = getToken ? { token: getToken() ?? '', source: 'getToken prop' } : resolveAuthToken();
      const token = tokenInfo.token || null;
      console.log('[ChatWidget] Auth token check:', token ? `Token present (${token.length} chars, source: ${tokenInfo.source})` : 'NO TOKEN FOUND');
      if (!token) {
        console.error('[ChatWidget] No auth token available. localStorage euraxess_token:', localStorage.getItem('euraxess_token'));
        setMessages(prev => [
          ...prev,
          { id: generateSessionId(), role: 'user', content: text },
          {
            id: generateSessionId(),
            role: 'assistant',
            content: "Vous devez être connecté pour utiliser l'assistant IA. Veuillez rafraîchir la page ou vous reconnecter.",
            isError: true
          }
        ]);
        return;
      }
      setMessages(prev => [
        ...prev,
        { id: generateSessionId(), role: 'user', content: text }
      ]);
      setIsPending(true);
      const endpoint = `${API_URL}/api/chatbot/message`;
      console.log('[ChatWidget] Sending request to:', endpoint);
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ session_id: sessionId, message: text })
        });
        console.log('[ChatWidget] Response status:', res.status, res.statusText);
        let data: Record<string, unknown> | null = null;
        try {
          data = (await res.json()) as Record<string, unknown>;
        } catch {
          data = null;
        }
        if (!res.ok) {
          console.error('[ChatWidget] Backend error response:', { status: res.status, data });
          if (res.status === 401) {
            throw new Error('Session expirée ou non autorisée. Veuillez vous reconnecter.');
          }
          if (res.status === 429) {
            throw new Error('Trop de requêtes. Veuillez patienter quelques secondes avant de réessayer.');
          }
          if (res.status === 503) {
            throw new Error('Le service d\'assistance est temporairement indisponible. Réessayez plus tard.');
          }
          const detail =
            typeof data?.detail === 'string'
              ? data.detail
              : typeof data?.error === 'string'
                ? data.error
                : `Erreur serveur (HTTP ${res.status})`;
          throw new Error(detail);
        }
        const rawActions = Array.isArray(data?.actions)
          ? (data.actions as unknown[])
              .map(normalizeAction)
              .filter((action): action is ChatAction => action !== null)
          : [];
        const reply =
          typeof data?.message === 'string' && data.message.trim() ? data.message : 'Je n\'ai pas pu formuler de réponse.';
        setMessages(prev => [
          ...prev,
          { id: generateSessionId(), role: 'assistant', content: reply, actions: rawActions }
        ]);
      } catch (err) {
        console.error('[ChatWidget] Request failed:', err);
        const message =
          err instanceof Error ? err.message : 'Une erreur est survenue. Veuillez réessayer.';
        setMessages(prev => [
          ...prev,
          { id: generateSessionId(), role: 'assistant', content: message, isError: true }
        ]);
      } finally {
        setIsPending(false);
        inputRef.current?.focus();
      }
    },
    [input, isPending, sessionId, getToken]
  );

  const handleClear = () => {
    setMessages([{ id: generateSessionId(), role: 'assistant', content: WELCOME_MESSAGE }]);
    setSessionId(resetSessionId());
  };

  const handleViewList = useCallback(
    (filters?: ContactFilters | null) => {
      navigate('/contacts', { state: { filters: toFilterState(filters) } });
    },
    [navigate]
  );

  const handleExportCsv = useCallback(
    (filters?: ContactFilters | null) => {
      const matches = contacts.filter(c => contactMatches(c, filters));
      downloadContactsCsv(matches, 'EURAXESS_Africa_Contacts_Export.csv', { includeTags: true });
      try {
        fetch('/api/export/log', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recordCount: matches.length,
            fileName: 'EURAXESS_Africa_Contacts_Export.csv',
            format: 'CSV'
          })
        });
      } catch {
        // ignore logging failures
      }
    },
    [contacts]
  );

  const handleProfile = useCallback(
    (contactId?: string | null) => {
      if (!contactId) return;
      navigate(`/contacts/${contactId}`);
    },
    [navigate]
  );

  return (
    <div className="fixed bottom-6 right-6 z-[9970] flex flex-col items-end font-sans">
      <div
        className={`absolute bottom-20 right-0 flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200 transition-all duration-300 ease-out origin-bottom-right ${
          isOpen
            ? 'visible opacity-100 translate-y-0 scale-100'
            : 'invisible opacity-0 translate-y-4 scale-95 pointer-events-none'
        }`}
        style={{ width: 'min(420px, calc(100vw - 1.5rem))', height: 'min(580px, calc(100vh - 8rem))' }}
        aria-hidden={!isOpen}
      >
        <div className="flex items-center gap-2.5 bg-gradient-to-r from-[#005596] via-[#005596] to-[#B8167C] px-4 py-3 text-white shrink-0">
          <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <Bot className="w-[18px] h-[18px]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight truncate">EURAXESS AI Assistant</p>
            <p className="flex items-center gap-1.5 text-[11px] text-white/85 leading-tight">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              En ligne · Assistant intelligent du CRM
            </p>
          </div>
          <button
            onClick={handleClear}
            className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
            title="Effacer la conversation"
            aria-label="Effacer la conversation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
            title="Fermer"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#F4F6F8] px-3 py-4 space-y-3">
          {messages.map(message => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] text-sm shadow-sm ${
                  message.role === 'user'
                    ? 'bg-[#005596] text-white rounded-2xl rounded-br-sm px-3.5 py-2.5'
                    : 'bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3.5 py-2.5'
                }`}
              >
                {message.role === 'assistant' ? (
                  <>
                    <div className={message.isError ? 'text-rose-600' : 'text-slate-700'}>
                      <Markdown content={message.content} />
                    </div>
                    {message.actions && message.actions.length > 0 && (
                      <ActionButtons
                        actions={message.actions}
                        onViewList={handleViewList}
                        onExport={handleExportCsv}
                        onProfile={handleProfile}
                      />
                    )}
                  </>
                ) : (
                  <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                )}
              </div>
            </div>
          ))}
          {isPending && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3.5 py-2.5 shadow-sm">
                <TypingIndicator />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-3 pt-2 pb-3">
          <div className="flex gap-1.5 mb-2 overflow-x-auto">
            {QUICK_ACTIONS.map(action => (
              <button
                key={action}
                onClick={() => handleSend(action)}
                disabled={isPending}
                className="shrink-0 text-xs font-medium text-[#005596] bg-[#005596]/5 hover:bg-[#005596]/10 border border-[#005596]/20 rounded-full px-3 py-1 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {action}
              </button>
            ))}
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={event => {
              event.preventDefault();
              handleSend();
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder="Écrivez votre message…"
              disabled={isPending}
              className="flex-1 min-w-0 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#005596]/40 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!input.trim() || isPending}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#005596] text-white hover:bg-[#B8167C] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              aria-label="Envoyer"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>

      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-r from-[#005596] to-[#B8167C] text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
        aria-label={isOpen ? 'Fermer l\'assistant' : 'Ouvrir l\'assistant'}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        {!isOpen && (
          <>
            <span className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-[#FFC20C] animate-ping" />
            <span className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-[#FFC20C]" />
          </>
        )}
      </button>
    </div>
  );
};
