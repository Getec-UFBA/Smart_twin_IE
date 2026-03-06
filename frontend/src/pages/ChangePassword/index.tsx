import React, { useState } from 'react';
import api from '../../services/api';
import PasswordInput from '../../components/PasswordInput';
import { FaSave, FaExclamationCircle, FaCheckCircle } from 'react-icons/fa';
import './style.css';

const ChangePassword: React.FC = () => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmNewPassword) {
      setError('A nova senha e a confirmação não coincidem.');
      return;
    }

    setLoading(true);
    try {
      await api.patch('/profile/password', {
        oldPassword,
        newPassword,
        confirmNewPassword,
      });
      setSuccess('Sua senha foi alterada com sucesso!');
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      if (api.isAxiosError(err) && err.response) {
        setError(err.response.data.error || 'Erro ao alterar a senha.');
      } else {
        setError('Erro desconhecido ao alterar a senha.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-password-container">
      <div className="change-password-box animate-fade-in">
        <h2>Segurança</h2>
        <p className="change-password-subtitle">Mantenha sua conta protegida atualizando sua senha regularmente.</p>
        
        {error && (
          <div className="status-alert error">
            <FaExclamationCircle /> {error}
          </div>
        )}
        {success && (
          <div className="status-alert success">
            <FaCheckCircle /> {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="change-password-form">
          <PasswordInput
            id="oldPassword"
            name="oldPassword"
            label="Senha Atual"
            value={oldPassword}
            onChange={e => setOldPassword(e.target.value)}
            required
          />
          
          <PasswordInput
            id="newPassword"
            name="newPassword"
            label="Nova Senha"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
          />
          
          <PasswordInput
            id="confirmNewPassword"
            name="confirmNewPassword"
            label="Confirme a nova senha"
            value={confirmNewPassword}
            onChange={e => setConfirmNewPassword(e.target.value)}
            required
          />

          <button 
            type="submit" 
            className="btn-save-password w-100" 
            disabled={loading}
          >
            {loading ? 'Processando...' : <><FaSave /> Salvar Nova Senha</>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
