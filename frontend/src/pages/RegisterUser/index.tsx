import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../config/firebase';
import api from '../../services/api';
import PasswordInput from '../../components/PasswordInput';
import { FaUser, FaEnvelope, FaBuilding, FaUserPlus, FaExclamationCircle } from 'react-icons/fa';
import './style.css';

const RegisterUser: React.FC = () => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Passo 5: Validação de senha no frontend
    if (password !== confirmPassword) {
      setError(t('complete_registration.error_mismatch'));
      return;
    }

    setLoading(true);
    try {
      // 1. Tenta criar o usuário no Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Chama o backend para validar autorização e salvar dados no Firestore
      try {
        await api.post('/users', {
          id: user.uid,
          email: user.email,
          name,
          company,
          role: 'user'
        });
        
        alert('Cadastro realizado com sucesso!');
        navigate('/login');
      } catch (backendError: any) {
        // Se o backend falhar (ex: não autorizado), removemos o usuário do Auth para não ficar sujo
        await user.delete();
        setError(backendError.response?.data?.message || 'Erro ao validar autorização.');
      }
    } catch (firebaseError: any) {
      setError('Erro ao criar conta: ' + firebaseError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-user-container">
      <div className="register-user-box">
        {/* Título e Subtítulo estilizados */}
        <h2>{t('register_user.title')}</h2>
        <p className="register-user-subtitle">{t('register_user.subtitle')}</p>
        
        <form onSubmit={handleSubmit} className="register-form">
          {/* Passo 6: Alerta de erro estilizado */}
          {error && (
            <div className="status-alert error d-flex align-items-center gap-2 justify-content-center">
              <FaExclamationCircle /> {error}
            </div>
          )}
          
          {/* Passo 4: Campos com ícones */}
          <div className="input-group-custom">
            <label>{t('profile.full_name')}</label>
            <div className="input-wrapper">
              <FaUser className="input-icon" />
              <input 
                type="text" 
                placeholder={t('profile.name_placeholder')} 
                value={name} 
                onChange={e => setName(e.target.value)} 
                required 
              />
            </div>
          </div>

          <div className="input-group-custom">
            <label>{t('login.email')}</label>
            <div className="input-wrapper">
              <FaEnvelope className="input-icon" />
              <input 
                type="email" 
                placeholder="seu@email.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />
            </div>
          </div>

          <div className="input-group-custom">
            <label>{t('profile.company_label')}</label>
            <div className="input-wrapper">
              <FaBuilding className="input-icon" />
              <input 
                type="text" 
                placeholder={t('profile.company_placeholder')} 
                value={company} 
                onChange={e => setCompany(e.target.value)} 
                required 
              />
            </div>
          </div>

          {/* Passo 3: PasswordInput com lógica de visibilidade e ícones */}
          <PasswordInput
            id="password"
            label={t('login.password')}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          {/* Passo 2: Novo campo para confirmar senha */}
          <PasswordInput
            id="confirmPassword"
            label={t('complete_registration.confirm_password_label')}
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
          />

          <button type="submit" className="register-button" disabled={loading}>
            {loading ? t('register_user.processing') : <><FaUserPlus /> {t('login.finish_registration')}</>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default RegisterUser;
