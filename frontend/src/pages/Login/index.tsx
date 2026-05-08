import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import PasswordInput from '../../components/PasswordInput';
import { FaEnvelope, FaSignInAlt } from 'react-icons/fa';
import logoSite from '../../assets/images/logo_site (1).png';
import './style.css';

const Login: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ email, password });
      navigate('/projetos');
    } catch (err) {
      setError(t('login.error_invalid_credentials'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <header className="login-logo-header">
          <img src={logoSite} alt="SMART TWIN-IE Logo" />
          <h2>{t('login.welcome')}</h2>
          <p className="login-subtitle">{t('login.subtitle')}</p>
        </header>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="input-group-custom">
            <label htmlFor="email">{t('login.email')}</label>
            <div className="input-wrapper">
              <FaEnvelope className="input-icon" />
              <input
                type="email"
                id="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <PasswordInput
            id="password"
            name="password"
            label={t('login.password')}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? t('login.entering') : <><FaSignInAlt /> {t('login.enter')}</>}
          </button>
        </form>

        <footer className="login-footer-links">
          <p>
            {t('login.no_password')} <Link to="/register-user">Cadastre-se</Link>
          </p>
          <p>
            <Link to="/forgot-password">{t('login.forgot_password')}</Link>
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Login;
