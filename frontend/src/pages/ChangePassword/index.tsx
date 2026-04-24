import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import PasswordInput from '../../components/PasswordInput';
import { FaKey, FaSave, FaExclamationCircle, FaCheckCircle } from 'react-icons/fa';
import './style.css';

const ChangePassword: React.FC = () => {
  const { t } = useTranslation();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError(t('change_password.error_mismatch'));
      return;
    }

    setLoading(true);
    try {
      await api.patch('/profile/change-password', {
        oldPassword,
        newPassword,
        confirmPassword,
      });
      setSuccess(t('change_password.success_message'));
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.error || t('change_password.error_change'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-password-container">
      <div className="change-password-box animate-fade-in">
        <header className="change-password-header">
          <div className="icon-circle">
            <FaKey />
          </div>
          <h2>{t('change_password.title')}</h2>
          <p>{t('change_password.subtitle')}</p>
        </header>

        <form onSubmit={handleSubmit} className="registration-form">
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

          <PasswordInput
            id="oldPassword"
            name="oldPassword"
            label={t('change_password.old_password_label')}
            value={oldPassword}
            onChange={e => setOldPassword(e.target.value)}
            required
          />

          <PasswordInput
            id="newPassword"
            name="newPassword"
            label={t('change_password.new_password_label')}
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
          />

          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            label={t('change_password.confirm_password_label')}
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
          />

          <button type="submit" className="btn-save-password w-100" disabled={loading}>
            {loading ? t('change_password.changing') : <><FaSave /> {t('change_password.submit_button')}</>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
