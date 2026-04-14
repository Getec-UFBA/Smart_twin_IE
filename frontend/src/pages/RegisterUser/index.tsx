import React, { useState } from 'react';
import api, { isAxiosError } from '../../services/api';
import { FaEnvelope, FaShieldAlt, FaUserPlus, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import './style.css';

const RegisterUser: React.FC = () => {
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
      setSuccess(`O convite para ${email} foi enviado com sucesso!`);
      setEmail('');
      setRole('user');
    } catch (err: any) {
      if (isAxiosError(err) && err.response) {
        setError(err.response.data.message || err.response.data.error || 'Erro ao pré-cadastrar usuário.');
      } else {
        setError('Erro desconhecido ao pré-cadastrar usuário.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-user-container">
      <div className="register-user-box animate-fade-in">
        <h2>Pré-cadastro</h2>
        <p className="register-user-subtitle">Adicione novos membros à plataforma SMART TWIN-IE</p>
        
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
            <label htmlFor="email">E-mail institucional</label>
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
            <label htmlFor="role">Nível de Acesso</label>
            <div className="input-wrapper">
              <FaShieldAlt className="input-icon" />
              <select id="role" value={role} onChange={e => setRole(e.target.value as 'admin' | 'user')}>
                <option value="user">Usuário</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>

          <button type="submit" className="register-button" disabled={loading}>
            {loading ? 'Processando...' : <><FaUserPlus /> Pré-cadastrar</>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default RegisterUser;
