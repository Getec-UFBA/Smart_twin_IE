import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { FaEnvelope, FaUserShield, FaCheckCircle, FaExclamationCircle, FaUserPlus, FaCalendarAlt, FaShieldAlt } from 'react-icons/fa';
import './style.css';

interface AuthorizedEmail {
  email: string;
  authorizedAt: any;
  status: string;
  role: 'admin' | 'user';
}

const AdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [authorizedEmails, setAuthorizedEmails] = useState<AuthorizedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchEmails = async () => {
    try {
      const response = await api.get('/users/authorized');
      setAuthorizedEmails(response.data);
    } catch (error) {
      console.error('Erro ao buscar e-mails autorizados', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, []);

  const handleAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    
    try {
      await api.post('/users/authorize', { email, role });
      setSuccess(t('register_user.success_message', { email }));
      setEmail('');
      setRole('user');
      fetchEmails();
    } catch (error: any) {
      setError(error.response?.data?.message || t('register_user.error_pre_register'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-dashboard-container animate-fade-in">
      <header className="admin-header">
        <h1>{t('sidebar.admin_dashboard')}</h1>
        <p className="admin-subtitle">{t('register_user.subtitle')}</p>
      </header>
      
      {/* Passo 1 e 2: Seção de Autorização Estilizada */}
      <section className="admin-card authorize-card">
        <div className="card-header-custom">
          <FaUserPlus className="header-icon" />
          <h2>{t('register_user.title')}</h2>
        </div>

        <form onSubmit={handleAuthorize} className="admin-form">
          {error && (
            <div className="status-alert error d-flex align-items-center gap-2">
              <FaExclamationCircle /> {error}
            </div>
          )}
          {success && (
            <div className="status-alert success d-flex align-items-center gap-2">
              <FaCheckCircle /> {success}
            </div>
          )}

          <div className="admin-form-row">
            <div className="input-group-custom flex-grow-1">
              <label>{t('register_user.email_label')}</label>
              <div className="input-wrapper">
                <FaEnvelope className="input-icon" />
                <input 
                  type="email" 
                  placeholder="exemplo@empresa.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                />
              </div>
            </div>

            <div className="input-group-custom select-group">
              <label>{t('register_user.role_label')}</label>
              <div className="input-wrapper">
                <FaUserShield className="input-icon" />
                <select 
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
                >
                  <option value="user">{t('register_user.user_option')}</option>
                  <option value="admin">{t('register_user.admin_option')}</option>
                </select>
              </div>
            </div>

            <button type="submit" className="admin-btn-primary" disabled={submitting}>
              {submitting ? t('register_user.processing') : <><FaUserPlus /> {t('register_user.submit_button')}</>}
            </button>
          </div>
        </form>
      </section>

      {/* Passo 3: Listagem com Tabela Moderna */}
      <section className="admin-card list-card">
        <div className="card-header-custom">
          <FaShieldAlt className="header-icon" />
          <h2>{t('sidebar.administration')}</h2>
        </div>

        {loading ? (
          <div className="admin-loading">
            <div className="spinner-border text-primary" role="status"></div>
            <p>Carregando registros...</p>
          </div>
        ) : (
          <div className="table-responsive-custom">
            <table className="admin-table">
              <thead>
                <tr>
                  <th><FaEnvelope /> {t('register_user.email_label')}</th>
                  <th><FaUserShield /> {t('register_user.role_label')}</th>
                  <th><FaCalendarAlt /> Data</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {authorizedEmails.map((item) => (
                  <tr key={item.email}>
                    <td className="email-cell">{item.email}</td>
                    <td>
                      <span className={`role-badge ${item.role}`}>
                        {item.role === 'admin' ? t('register_user.admin_option') : t('register_user.user_option')}
                      </span>
                    </td>
                    <td className="date-cell">
                      {item.authorizedAt ? new Date(item.authorizedAt._seconds * 1000).toLocaleDateString() : '---'}
                    </td>
                    <td>
                      <span className={`status-dot ${item.status || 'pending'}`}></span>
                      {item.status || 'Pendente'}
                    </td>
                  </tr>
                ))}
                {authorizedEmails.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-table">Nenhum usuário autorizado ainda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminDashboard;
