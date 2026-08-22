import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ShieldCheck, Plus, Trash2, Loader2, X, Check, AlertTriangle, Users, Search, Eye, Save } from 'lucide-react';
import { apiFetch } from '../services/api';
import { User, Privilege } from '../types';
import { PRIVILEGE_LABELS } from '../utils/privileges';
import { Modal } from './Modal';
import { useToast } from './Toast';

interface AdminUser extends User {
  lastLogin?: string | null;
  createdAt?: string;
}

interface CreateUserForm {
  name: string;
  email: string;
  role: 'user' | 'admin';
  privilege: Privilege;
}

type RoleFilter = 'all' | 'admin' | 'user';
type PrivilegeFilter = 'all' | Privilege;

const PRIVILEGE_OPTIONS: Privilege[] = ['READ', 'READ_WRITE', 'FULL_ACCESS'];

export const AdminView: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Confirmations & résultats (remplacent confirm()/alert() natifs)
  const { showToast } = useToast();
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<AdminUser | null>(null);
  const [confirmCreateUser, setConfirmCreateUser] = useState<CreateUserForm | null>(null);
  // Alerte doublon affichée sous le champ e-mail du formulaire de création.
  const [createFormError, setCreateFormError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserForm>({ name: '', email: '', role: 'user', privilege: 'FULL_ACCESS' });

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch('/api/admin/users');
      setUsers(data?.users || []);
    } catch (err: any) {
      showToast(err.message || 'Erreur de chargement des utilisateurs.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  const [isCreating, setIsCreating] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Recherche + filtres (rôle / privilège) — filtrage client de la liste chargée
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [privilegeFilter, setPrivilegeFilter] = useState<PrivilegeFilter>('all');

  // Panneau de consultation (clic sur une ligne) — lecture seule, privilège modifiable
  const [viewingUser, setViewingUser] = useState<AdminUser | null>(null);
  const [editingPrivilege, setEditingPrivilege] = useState<Privilege>('FULL_ACCESS');
  const [isSavingPrivilege, setIsSavingPrivilege] = useState(false);

  const openUserDetails = (u: AdminUser) => {
    setViewingUser(u);
    setEditingPrivilege(u.privilege || 'FULL_ACCESS');
  };

  const savePrivilege = async () => {
    if (!viewingUser) return;
    setIsSavingPrivilege(true);
    try {
      await apiFetch(`/api/admin/users/${viewingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ privilege: editingPrivilege })
      });
      showToast('Privilège mis à jour.', 'success');
      setViewingUser(null);
      await loadUsers();
    } catch (err: any) {
      showToast(err.message || 'Erreur de mise à jour', 'error');
    } finally {
      setIsSavingPrivilege(false);
    }
  };

  // Liste filtrée : recherche insensible à la casse (nom/e-mail) + rôle + privilège
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter(u => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (privilegeFilter !== 'all' && (u.privilege || 'FULL_ACCESS') !== privilegeFilter) return false;
      if (!q) return true;
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [users, searchQuery, roleFilter, privilegeFilter]);

  // Étape 1 du formulaire : validation locale puis panneau de confirmation
  // dédié. Un doublon d'e-mail est détecté en amont : alerte sous le champ
  // au lieu d'un échec serveur après confirmation.
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = createForm.name.trim();
    const email = createForm.email.trim();
    if (!name || !email) return;
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      setCreateFormError(`Un compte existe déjà pour ${email}.`);
      return;
    }
    setShowCreateModal(false);
    setConfirmCreateUser({ ...createForm, name, email });
  };

  // Étape 2 : confirmation explicite → création réelle + e-mail d'identifiants.
  const performCreate = async () => {
    if (!confirmCreateUser) return;
    setIsCreating(true);
    try {
      const data = await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(confirmCreateUser)
      });
      setCreatedPassword(data?.temporaryPassword || null);
      setConfirmCreateUser(null);
      setShowCreateModal(true);
      await loadUsers();
    } catch (err: any) {
      showToast(err.message || 'Erreur de création', 'error');
      setConfirmCreateUser(null);
      setShowCreateModal(true);
    } finally {
      setIsCreating(false);
    }
  };

  const performDelete = async (userId: string) => {
    setDeletingId(userId);
    try {
      await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      showToast('Utilisateur supprimé.', 'success');
      await loadUsers();
    } catch (err: any) {
      showToast(err.message || 'Erreur de suppression', 'error');
    } finally {
      setDeletingId(null);
      setConfirmDeleteUser(null);
    }
  };

  const formatDateTime = (value?: string | null) =>
    value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : 'Jamais';

  const roleBadge = (role: string) => (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${role === 'admin' ? 'bg-[#005596]/10 text-[#005596]' : 'bg-slate-100 text-[#55636B]'}`}>
      {role}
    </span>
  );

  const privilegeBadge = (privilege?: Privilege | null) => {
    const p = privilege || 'FULL_ACCESS';
    const styles: Record<Privilege, string> = {
      READ: 'bg-amber-50 text-amber-700',
      READ_WRITE: 'bg-[#E8F1F8] text-[#005596]',
      FULL_ACCESS: 'bg-emerald-50 text-emerald-700'
    };
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold ${styles[p]}`}>
        {PRIVILEGE_LABELS[p]}
      </span>
    );
  };

  const isFilterActive = searchQuery.trim() !== '' || roleFilter !== 'all' || privilegeFilter !== 'all';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <ShieldCheck className="w-6 h-6 text-[#005596]" />
        <h1 className="text-xl font-black text-[#1C2529]">Administration — Utilisateurs</h1>
      </div>

      {/* Recherche + filtre par rôle + création */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom ou e-mail…"
            className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#005596] focus:border-transparent"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-500 hover:text-white hover:bg-slate-400 transition-colors cursor-pointer"
              title="Effacer la recherche"
              aria-label="Effacer la recherche"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value as RoleFilter)}
          className="py-2.5 pl-3 pr-8 bg-white border border-slate-200 rounded-xl text-xs font-bold text-[#1C2529] focus:ring-2 focus:ring-[#005596] cursor-pointer"
          title="Filtrer par rôle"
        >
          <option value="all">Tous les rôles</option>
          <option value="admin">Administrateurs</option>
          <option value="user">Utilisateurs</option>
        </select>

        <select
          value={privilegeFilter}
          onChange={e => setPrivilegeFilter(e.target.value as PrivilegeFilter)}
          className="py-2.5 pl-3 pr-8 bg-white border border-slate-200 rounded-xl text-xs font-bold text-[#1C2529] focus:ring-2 focus:ring-[#005596] cursor-pointer"
          title="Filtrer par privilège"
        >
          <option value="all">Tous les privilèges</option>
          {PRIVILEGE_OPTIONS.map(p => (
            <option key={p} value={p}>{PRIVILEGE_LABELS[p]}</option>
          ))}
        </select>

        <button
          onClick={() => { setShowCreateModal(true); setCreatedPassword(null); setCreateFormError(''); setCreateForm({ name: '', email: '', role: 'user', privilege: 'FULL_ACCESS' }); }}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-[#005596] text-white text-xs font-bold rounded-xl hover:bg-[#003d6d] cursor-pointer transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> Créer un utilisateur
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm text-[#55636B]">
        <Users className="w-4 h-4" />
        <span className="font-bold">{filteredUsers.length}</span> utilisateur(s)
        {isFilterActive && users.length !== filteredUsers.length && (
          <span className="text-[11px] font-semibold text-[#8A98A1]">sur {users.length} au total</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-[#005596] animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#C9D4DE]/40 shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F4F6F8] border-b border-[#C9D4DE]/40">
                <th className="text-left px-4 py-3 font-bold text-[#55636B]">Nom</th>
                <th className="text-left px-4 py-3 font-bold text-[#55636B]">Email</th>
                <th className="text-left px-4 py-3 font-bold text-[#55636B]">Rôle</th>
                <th className="text-left px-4 py-3 font-bold text-[#55636B]">Privilège</th>
                <th className="text-left px-4 py-3 font-bold text-[#55636B]">Dernière connexion</th>
                <th className="text-right px-4 py-3 font-bold text-[#55636B]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Clic sur la ligne = consultation ; les boutons stoppent la propagation */}
              {filteredUsers.map(u => (
                <tr
                  key={u.id}
                  onClick={() => openUserDetails(u)}
                  className="border-b border-[#C9D4DE]/20 hover:bg-[#E8F1F8]/60 cursor-pointer transition-colors"
                  title="Consulter la fiche utilisateur"
                >
                  <td className="px-4 py-3 font-bold text-[#1C2529]">{u.name}</td>
                  <td className="px-4 py-3 text-[#55636B]">{u.email}</td>
                  <td className="px-4 py-3">{roleBadge(u.role)}</td>
                  <td className="px-4 py-3">{privilegeBadge(u.privilege)}</td>
                  <td className="px-4 py-3 text-[#8A98A1] text-[11px]">{formatDateTime(u.lastLogin)}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openUserDetails(u)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-[#55636B] hover:text-[#005596] transition-colors cursor-pointer"
                        title="Consulter"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteUser(u)}
                        disabled={deletingId === u.id}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-[#55636B] hover:text-red-600 transition-colors cursor-pointer disabled:opacity-50"
                        title="Supprimer"
                      >
                        {deletingId === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#8A98A1]">
                    {isFilterActive ? 'Aucun utilisateur ne correspond à la recherche.' : 'Aucun utilisateur trouvé.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[10000] bg-black/40 flex items-center justify-center p-4" onClick={() => !isCreating && setShowCreateModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[#1C2529]">Créer un utilisateur</h2>
              <button onClick={() => setShowCreateModal(false)} className="cursor-pointer"><X className="w-4 h-4 text-[#55636B]" /></button>
            </div>
            {createdPassword ? (
              <div className="space-y-3 text-center py-4">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-800">Utilisateur créé !</p>
                <div className="bg-[#F4F6F8] rounded-xl p-3 text-xs">
                  <p className="text-[#55636B] mb-1">Mot de passe temporaire :</p>
                  <p className="font-mono font-bold text-[#1C2529] break-all">{createdPassword}</p>
                </div>
                <p className="text-[11px] text-[#8A98A1]">Un e-mail avec ces identifiants a été envoyé à l'adresse du compte.</p>
                <button onClick={() => setShowCreateModal(false)} className="px-5 py-2 bg-[#005596] text-white font-bold text-xs rounded-xl cursor-pointer">Fermer</button>
              </div>
            ) : (
              <form onSubmit={handleCreateSubmit} className="space-y-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-[11px]">Nom complet *</label>
                  <input type="text" required value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#005596]" />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-[11px]">Email *</label>
                  <input
                    type="email"
                    required
                    value={createForm.email}
                    onChange={e => {
                      setCreateForm(p => ({ ...p, email: e.target.value }));
                      if (createFormError) setCreateFormError('');
                    }}
                    className={`w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-[#005596] ${createFormError ? 'border-red-400 bg-red-50/40' : 'border-slate-200'}`}
                  />
                  {createFormError && (
                    <p className="text-[11px] font-semibold text-red-500 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      {createFormError}
                    </p>
                  )}
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-[11px]">Rôle</label>
                  <select value={createForm.role} onChange={e => setCreateForm(p => ({ ...p, role: e.target.value as 'user' | 'admin' }))} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#005596]">
                    <option value="user">Utilisateur</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </div>
                {createForm.role === 'user' && (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1 text-[11px]">Privilège</label>
                    <select
                      value={createForm.privilege}
                      onChange={e => setCreateForm(p => ({ ...p, privilege: e.target.value as Privilege }))}
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#005596]"
                    >
                      {PRIVILEGE_OPTIONS.map(p => (
                        <option key={p} value={p}>{PRIVILEGE_LABELS[p]}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-[#8A98A1] mt-1">
                      Lecture seule : consultation sans écriture · Lecture/Écriture : création et modification · Accès complet : toutes les actions.
                    </p>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Annuler</button>
                  <button type="submit" disabled={isCreating} className="px-5 py-2 bg-[#005596] text-white font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer disabled:opacity-75">
                    Continuer
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Confirmation dédiée : création d'un nouvel utilisateur */}
      {confirmCreateUser && (
        <Modal
          open
          onClose={() => !isCreating && setConfirmCreateUser(null)}
          maxWidth="max-w-md"
          title={
            <div className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#005596]" />
              <h3 className="font-extrabold text-base text-[#1C2529]">Confirmer la création</h3>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="bg-[#F4F6F8] rounded-xl p-4 space-y-2">
              <p><span className="font-bold text-[#55636B]">Nom :</span> <span className="font-bold text-[#1C2529]">{confirmCreateUser.name}</span></p>
              <p><span className="font-bold text-[#55636B]">Email :</span> <span className="font-mono text-[#1C2529]">{confirmCreateUser.email}</span></p>
              <p><span className="font-bold text-[#55636B]">Rôle :</span> {roleBadge(confirmCreateUser.role)}</p>
              {confirmCreateUser.role === 'user' && (
                <p><span className="font-bold text-[#55636B]">Privilège :</span> {privilegeBadge(confirmCreateUser.privilege)}</p>
              )}
            </div>
            <p className="text-slate-600 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              Un e-mail contenant le nom, l'e-mail et le mot de passe temporaire sera envoyé à cette adresse.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setConfirmCreateUser(null)}
                disabled={isCreating}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl cursor-pointer disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                onClick={performCreate}
                disabled={isCreating}
                className="px-5 py-2 bg-[#005596] hover:bg-[#004275] text-white font-bold rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-75"
              >
                {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirmer et envoyer l'e-mail
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Consultation : fiche utilisateur en lecture seule */}
      {viewingUser && (
        <Modal
          open
          onClose={() => setViewingUser(null)}
          maxWidth="max-w-md"
          title={
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-[#005596]" />
              <h3 className="font-extrabold text-base text-[#1C2529]">Fiche utilisateur</h3>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#005596] to-[#B8167C] text-white flex items-center justify-center text-sm font-black shrink-0">
                {viewingUser.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-black text-sm text-[#1C2529] truncate">{viewingUser.name}</p>
                <p className="text-[#55636B] truncate">{viewingUser.email}</p>
              </div>
            </div>
            <dl className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <dt className="font-bold text-[#55636B]">Rôle</dt>
                <dd>{roleBadge(viewingUser.role)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-bold text-[#55636B]">Privilège</dt>
                <dd>
                  {viewingUser.role === 'admin' ? (
                    privilegeBadge('FULL_ACCESS')
                  ) : (
                    <select
                      value={editingPrivilege}
                      onChange={e => setEditingPrivilege(e.target.value as Privilege)}
                      disabled={isSavingPrivilege}
                      className="p-1.5 border border-slate-200 rounded-lg text-[11px] font-bold text-[#1C2529] focus:ring-2 focus:ring-[#005596] cursor-pointer disabled:opacity-60"
                      title="Modifier le privilège"
                    >
                      {PRIVILEGE_OPTIONS.map(p => (
                        <option key={p} value={p}>{PRIVILEGE_LABELS[p]}</option>
                      ))}
                    </select>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-bold text-[#55636B]">Dernière connexion</dt>
                <dd className="text-right text-[#1C2529] font-semibold">{formatDateTime(viewingUser.lastLogin)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-bold text-[#55636B]">Compte créé le</dt>
                <dd className="text-right text-[#1C2529] font-semibold">
                  {viewingUser.createdAt ? new Date(viewingUser.createdAt).toLocaleDateString('fr-FR', { dateStyle: 'medium' }) : '—'}
                </dd>
              </div>
            </dl>
            {viewingUser.role !== 'admin' && editingPrivilege !== (viewingUser.privilege || 'FULL_ACCESS') && (
              <button
                onClick={savePrivilege}
                disabled={isSavingPrivilege}
                className="w-full py-2.5 bg-[#005596] hover:bg-[#004275] text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
              >
                {isSavingPrivilege ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Enregistrer le nouveau privilège
              </button>
            )}
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button onClick={() => setViewingUser(null)} className="px-5 py-2 bg-[#005596] text-white font-bold rounded-xl cursor-pointer">Fermer</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm Delete User Modal */}
      {confirmDeleteUser && (
        <Modal
          open
          onClose={() => setConfirmDeleteUser(null)}
          maxWidth="max-w-md"
          title={
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h3 className="font-extrabold text-base text-[#1C2529]">Supprimer l'utilisateur</h3>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Supprimer <span className="font-bold text-[#1C2529]">{confirmDeleteUser.name}</span> ({confirmDeleteUser.email}) ?
              Cette action est irréversible.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => setConfirmDeleteUser(null)} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl cursor-pointer">Annuler</button>
              <button
                onClick={() => performDelete(confirmDeleteUser.id)}
                disabled={deletingId === confirmDeleteUser.id}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-75"
              >
                {deletingId === confirmDeleteUser.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Supprimer
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
