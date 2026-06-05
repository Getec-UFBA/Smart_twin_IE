import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { FaEnvelope, FaArrowRight, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import './style.css';

const ForgotPassword = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found') {
        setError(t('forgot_password.error_email_not_found'));
      } else {
        setError("Erro ao enviar e-mail de recuperação. Verifique o endereço digitado.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="forgot-password-container">
        <div className="forgot-password-box">
          <div className="success-container animate-fade-in text-center">
            <FaCheckCircle className="success-icon mb-3" size={50} color="#28a745" />
            <h2>E-mail Enviado!</h2>
            <p>Enviamos um link de recuperação para <strong>{email}</strong>. Por favor, verifique sua caixa de entrada e spam.</p>
            <Link to="/login" className="forgot-password-button mt-4 d-inline-block text-decoration-none text-white p-2 rounded bg-primary">
              {t('forgot_password.go_to_login')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-box">
        <form onSubmit={handleSubmit} className="forgot-password-form">
          <h2>{t('forgot_password.title')}</h2>
          <p>Informe seu e-mail para receber um link de redefinição de senha.</p>
          {error && (
            <div className="status-alert error d-flex align-items-center gap-2 justify-content-center mb-3">
              <FaExclamationCircle /> {error}
            </div>
          )}
          <div className="input-group-custom">
            <label htmlFor="email">{t('forgot_password.email_label')}</label>
            <div className="input-wrapper">
              <FaEnvelope className="input-icon" />
              <input 
                type="email" 
                id="email" 
                placeholder={t('forgot_password.email_placeholder')}
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />
            </div>
          </div>
          <button type="submit" className="forgot-password-button" disabled={loading}>
            {loading ? "Enviando..." : <><FaArrowRight /> Enviar Link de Recuperação</>}
          </button>
        </form>
        <div className="back-to-login text-center mt-3">
          <Link to="/login" className="text-decoration-none">{t('forgot_password.back_to_login')}</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
