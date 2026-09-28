import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Badge } from 'react-bootstrap';
import { 
  FaUsers, 
  FaUser, 
  FaEnvelope, 
  FaBuilding, 
  FaSearch, 
  FaUserShield, 
  FaCalendarAlt, 
  FaThLarge, 
  FaList, 
  FaUserPlus, 
  FaInfoCircle, 
  FaEdit, 
  FaIdBadge
} from 'react-icons/fa';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import './style.css';

interface UserProfile {
  id: string;
  name?: string;
  email: string;
  company?: string;
  bio?: string;
  avatarUrl?: string;
  role: 'admin' | 'user';
  createdAt?: any;
}

const AdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Tenta buscar via Backend API
      const response = await api.get('/users');
      if (Array.isArray(response.data)) {
        setUsers(response.data);
        return;
      }
    } catch (apiError) {
      console.warn('Falha na API /users, tentando Firestore diretamente:', apiError);
    }

    // 2. Fallback direto no Firestore
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const firestoreUsers: UserProfile[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          email: data.email || '',
          company: data.company,
          bio: data.bio,
          avatarUrl: data.avatarUrl,
          role: data.role || 'user',
          createdAt: data.createdAt
        };
      });
      setUsers(firestoreUsers);
    } catch (fsError) {
      console.error('Erro ao buscar usuários do Firestore:', fsError);
      setError('Não foi possível carregar a lista de usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filtros de busca e role
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term || 
        (u.name && u.name.toLowerCase().includes(term)) ||
        (u.email && u.email.toLowerCase().includes(term)) ||
        (u.company && u.company.toLowerCase().includes(term));
      return matchesRole && matchesSearch;
    });
  }, [users, searchTerm, roleFilter]);

  // Estatísticas
  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter(u => u.role === 'admin').length;
    const members = users.filter(u => u.role !== 'admin').length;
    return { total, admins, members };
  }, [users]);

  const formatDate = (dateVal: any) => {
    if (!dateVal) return '---';
    try {
      if (dateVal._seconds) {
        return new Date(dateVal._seconds * 1000).toLocaleDateString();
      }
      if (dateVal.seconds) {
        return new Date(dateVal.seconds * 1000).toLocaleDateString();
      }
      return new Date(dateVal).toLocaleDateString();
    } catch (e) {
      return '---';
    }
  };

  return (
    <div className="users-dashboard-container animate-fade-in">
      {/* HEADER DA PÁGINA */}
      <header className="users-header">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <div className="d-flex align-items-center gap-2">
              <FaUsers className="text-primary fs-2" />
              <h1 className="mb-0">{t('users.title', 'Usuários')}</h1>
            </div>
            <p className="users-subtitle mt-1 mb-0">
              {t('users.subtitle', 'Visualize o perfil e informações de todos os membros da plataforma')}
            </p>
          </div>

          <div className="d-flex align-items-center gap-2">
            <Button 
              variant="primary" 
              className="d-flex align-items-center gap-2 new-user-btn"
              onClick={() => navigate('/register-user')}
            >
              <FaUserPlus />
              <span>{t('users.new_user', 'Cadastrar Novo Usuário')}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* CARDS DE ESTATÍSTICAS */}
      <div className="users-stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrapper total">
            <FaUsers />
          </div>
          <div className="stat-info">
            <span className="stat-label">{t('users.total_users', 'Total de Usuários')}</span>
            <h3 className="stat-value">{stats.total}</h3>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper admins">
            <FaUserShield />
          </div>
          <div className="stat-info">
            <span className="stat-label">{t('users.admins_count', 'Administradores')}</span>
            <h3 className="stat-value">{stats.admins}</h3>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper members">
            <FaUser />
          </div>
          <div className="stat-info">
            <span className="stat-label">{t('users.members_count', 'Membros')}</span>
            <h3 className="stat-value">{stats.members}</h3>
          </div>
        </div>
      </div>

      {/* AVISO INFORMATIVO */}
      <div className="access-info-banner">
        <FaInfoCircle className="info-icon" />
        <span>{t('users.all_profiles_info', 'Nesta versão, todos os usuários têm acesso para consultar os perfis da comunidade.')}</span>
      </div>

      {/* BARRA DE PESQUISA, FILTROS E MODOS DE VISUALIZAÇÃO */}
      <div className="users-toolbar-card">
        <div className="search-box">
          <FaSearch className="search-icon" />
          <input 
            type="text"
            placeholder={t('users.search_placeholder', 'Buscar por nome, e-mail ou empresa...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search-btn" onClick={() => setSearchTerm('')}>×</button>
          )}
        </div>

        <div className="toolbar-controls">
          <div className="role-filters">
            <button 
              className={`filter-chip ${roleFilter === 'all' ? 'active' : ''}`}
              onClick={() => setRoleFilter('all')}
            >
              {t('users.filter_all', 'Todos')} ({stats.total})
            </button>
            <button 
              className={`filter-chip ${roleFilter === 'admin' ? 'active' : ''}`}
              onClick={() => setRoleFilter('admin')}
            >
              {t('users.filter_admin', 'Administradores')} ({stats.admins})
            </button>
            <button 
              className={`filter-chip ${roleFilter === 'user' ? 'active' : ''}`}
              onClick={() => setRoleFilter('user')}
            >
              {t('users.filter_user', 'Usuários')} ({stats.members})
            </button>
          </div>

          <div className="view-mode-toggle">
            <button 
              className={`view-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
              title={t('users.cards_view', 'Cards')}
            >
              <FaThLarge />
            </button>
            <button 
              className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title={t('users.table_view', 'Tabela')}
            >
              <FaList />
            </button>
          </div>
        </div>
      </div>

      {/* LISTAGEM DE USUÁRIOS */}
      {loading ? (
        <div className="users-loading">
          <div className="spinner-border text-primary" role="status"></div>
          <p>Carregando usuários...</p>
        </div>
      ) : error ? (
        <div className="alert alert-danger d-flex align-items-center gap-2">
          <FaInfoCircle /> {error}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="users-empty-state">
          <FaUsers className="empty-icon" />
          <h4>{t('users.no_users_found', 'Nenhum usuário encontrado')}</h4>
          <p className="text-muted">Tente ajustar seus termos de busca ou filtros.</p>
        </div>
      ) : viewMode === 'cards' ? (
        /* VISUALIZAÇÃO EM CARDS */
        <div className="user-cards-grid">
          {filteredUsers.map((u) => {
            const isSelf = currentUser?.id === u.id;
            return (
              <div 
                key={u.id} 
                className={`user-profile-card ${isSelf ? 'is-self' : ''}`}
                onClick={() => setSelectedUser(u)}
              >
                <div className="card-top-accent"></div>
                <div className="user-card-body">
                  <div className="avatar-section">
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt={u.name || u.email} className="user-card-avatar" />
                    ) : (
                      <div className="avatar-placeholder">
                        {(u.name ? u.name[0] : u.email[0]).toUpperCase()}
                      </div>
                    )}
                    <span className={`role-badge ${u.role}`}>
                      {u.role === 'admin' ? t('register_user.admin_option', 'Administrador') : t('register_user.user_option', 'Usuário')}
                    </span>
                  </div>

                  <h3 className="user-card-name">
                    {u.name || u.email.split('@')[0]}
                    {isSelf && <span className="self-badge">(Você)</span>}
                  </h3>

                  <div className="user-card-info-list">
                    <div className="info-row" title={u.email}>
                      <FaEnvelope className="info-icon" />
                      <span className="truncate">{u.email}</span>
                    </div>

                    <div className="info-row" title={u.company || 'Não informada'}>
                      <FaBuilding className="info-icon" />
                      <span className="truncate">{u.company || 'Empresa não informada'}</span>
                    </div>

                    <div className="info-row">
                      <FaCalendarAlt className="info-icon" />
                      <span>{formatDate(u.createdAt)}</span>
                    </div>
                  </div>

                  {u.bio && (
                    <p className="user-card-bio" title={u.bio}>
                      {u.bio}
                    </p>
                  )}

                  <div className="user-card-footer">
                    <Button 
                      variant="outline-primary" 
                      size="sm" 
                      className="w-100 view-profile-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedUser(u);
                      }}
                    >
                      <FaUser /> {t('users.view_profile', 'Ver Perfil')}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VISUALIZAÇÃO EM TABELA */
        <div className="users-table-card">
          <div className="table-responsive">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>E-mail</th>
                  <th>Empresa</th>
                  <th>Nível de Acesso</th>
                  <th>Cadastro</th>
                  <th className="text-end">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const isSelf = currentUser?.id === u.id;
                  return (
                    <tr key={u.id} className="clickable-row" onClick={() => setSelectedUser(u)}>
                      <td>
                        <div className="d-flex align-items-center gap-3">
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt={u.name || u.email} className="table-avatar" />
                          ) : (
                            <div className="table-avatar-placeholder">
                              {(u.name ? u.name[0] : u.email[0]).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className="fw-semibold text-body">
                              {u.name || u.email.split('@')[0]}
                            </span>
                            {isSelf && <Badge bg="primary" className="ms-2">Você</Badge>}
                          </div>
                        </div>
                      </td>
                      <td className="text-secondary">{u.email}</td>
                      <td className="text-secondary">{u.company || '---'}</td>
                      <td>
                        <span className={`role-badge ${u.role}`}>
                          {u.role === 'admin' ? t('register_user.admin_option', 'Administrador') : t('register_user.user_option', 'Usuário')}
                        </span>
                      </td>
                      <td className="text-secondary">{formatDate(u.createdAt)}</td>
                      <td className="text-end">
                        <Button 
                          variant="outline-primary" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUser(u);
                          }}
                        >
                          <FaUser className="me-1" /> {t('users.view_profile', 'Ver Perfil')}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DETALHADO DE PERFIL */}
      <Modal 
        show={!!selectedUser} 
        onHide={() => setSelectedUser(null)} 
        centered
        className="user-profile-modal"
      >
        {selectedUser && (
          <>
            <Modal.Header closeButton className="border-0 pb-0">
              <Modal.Title className="fs-5 text-secondary">
                {t('users.profile_details', 'Perfil do Usuário')}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body className="pt-2 px-4 pb-4">
              <div className="modal-profile-header">
                <div className="modal-avatar-wrapper">
                  {selectedUser.avatarUrl ? (
                    <img src={selectedUser.avatarUrl} alt={selectedUser.name || selectedUser.email} className="modal-avatar" />
                  ) : (
                    <div className="modal-avatar-placeholder">
                      {(selectedUser.name ? selectedUser.name[0] : selectedUser.email[0]).toUpperCase()}
                    </div>
                  )}
                </div>
                <h3 className="modal-user-name mb-1">
                  {selectedUser.name || selectedUser.email.split('@')[0]}
                </h3>
                <span className={`role-badge ${selectedUser.role} mb-2`}>
                  {selectedUser.role === 'admin' ? t('register_user.admin_option', 'Administrador') : t('register_user.user_option', 'Usuário')}
                </span>
                {currentUser?.id === selectedUser.id && (
                  <Badge bg="success" className="bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1">
                    Seu Perfil Atual
                  </Badge>
                )}
              </div>

              <div className="modal-profile-details mt-4">
                <div className="detail-item">
                  <div className="detail-icon"><FaEnvelope /></div>
                  <div className="detail-content">
                    <label>{t('login.email', 'E-mail')}</label>
                    <p>{selectedUser.email}</p>
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-icon"><FaBuilding /></div>
                  <div className="detail-content">
                    <label>{t('users.company', 'Empresa / Instituição')}</label>
                    <p>{selectedUser.company || 'Não informada'}</p>
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-icon"><FaCalendarAlt /></div>
                  <div className="detail-content">
                    <label>{t('users.member_since', 'Membro desde')}</label>
                    <p>{formatDate(selectedUser.createdAt)}</p>
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-icon"><FaIdBadge /></div>
                  <div className="detail-content">
                    <label>UID (Identificador)</label>
                    <p className="font-monospace small text-muted text-break">{selectedUser.id}</p>
                  </div>
                </div>

                <div className="detail-bio-box mt-3">
                  <label className="fw-semibold text-secondary small mb-1">
                    {t('users.bio', 'Biografia / Sobre')}
                  </label>
                  <p className="bio-text">
                    {selectedUser.bio || <span className="text-muted italic">{t('users.no_bio', 'Nenhuma biografia informada.')}</span>}
                  </p>
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer className="border-0 pt-0 px-4 pb-4 d-flex justify-content-between">
              {currentUser?.id === selectedUser.id ? (
                <Button 
                  variant="primary" 
                  className="d-flex align-items-center gap-2"
                  onClick={() => {
                    setSelectedUser(null);
                    navigate('/profile');
                  }}
                >
                  <FaEdit /> {t('users.edit_my_profile', 'Editar Meu Perfil')}
                </Button>
              ) : (
                <div></div>
              )}
              <Button variant="secondary" onClick={() => setSelectedUser(null)}>
                Fechar
              </Button>
            </Modal.Footer>
          </>
        )}
      </Modal>
    </div>
  );
};

export default AdminDashboard;
