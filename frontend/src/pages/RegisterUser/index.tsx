import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { isAxiosError } from '../../services/api';
import { FaEnvelope, FaShieldAlt, FaUserPlus, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import './style.css';

const RegisterUser: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await api.post('/users/pre-register', { email, role });
      setSuccess(t('register_user.success_message', { email }));
      setEmail('');
      setRole('user');
    } catch (err: any) {
      if (isAxiosError(err) && err.response) {
        setError(err.response.data.message || err.response.data.error || t('register_user.error_pre_register'));
      } else {
        setError(t('register_user.error_unknown'));
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-user-container">
      <div className="register-user-box animate-fade-in">
        <h2>{t('register_user.title')}</h2>
        <p className="register-user-subtitle">{t('register_user.subtitle')}</p>
        
        <form onSubmit={handleSubmit} className="register-form">
          {error && (
            <div className="status-alert error d-flex align-items-center gap-2 justify-content-center">
              <FaExclamationCircle /> {error}
            </div>
          )}
          {success && (
            <div className="status-alert success d-flex align-items-center gap-2 justify-content-center">
              <FaCheckCircle /> {success}
            </div>
          )}

          <div className="input-group-custom">
            <label htmlFor="email">{t('register_user.email_label')}</label>
            <div className="input-wrapper">
              <FaEnvelope className="input-icon" />
              <input
                type="email"
                id="email"
                placeholder="exemplo@ufba.br"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group-custom">
            <label htmlFor="role">{t('register_user.role_label')}</label>
            <div className="input-wrapper">
              <FaShieldAlt className="input-icon" />
              <select id="role" value={role} onChange={e => setRole(e.target.value as 'admin' | 'user')}>
                <option value="user">{t('register_user.user_option')}</option>
                <option value="admin">{t('register_user.admin_option')}</option>
              </select>
            </div>
          </div>

          <button type="submit" className="register-button" disabled={loading}>
            {loading ? t('register_user.processing') : <><FaUserPlus /> {t('register_user.submit_button')}</>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default RegisterUser;
