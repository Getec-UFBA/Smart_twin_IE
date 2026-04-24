import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import PasswordInput from '../../components/PasswordInput';
import { FaEnvelope, FaKey, FaArrowRight, FaCheckCircle, FaExclamationCircle, FaQuestionCircle } from 'react-icons/fa';
import './style.css';

const API_URL = 'http://localhost:3001';

type Stage = 'enter_email' | 'answer_question' | 'success';

const ForgotPassword = () => {
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>('enter_email');
  const [email, setEmail] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/auth/security-question/${email}`);
      setSecurityQuestion(response.data.securityQuestion);
      setStage('answer_question');
    } catch (err) {
      setError(t('forgot_password.error_email_not_found'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError(t('forgot_password.error_passwords_dont_match'));
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/reset-password-with-answer`, {
        email,
        securityAnswer,
        newPassword,
        confirmPassword,
      });
      setStage('success');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error || t('forgot_password.error_reset_failed'));
      } else {
        setError(t('forgot_password.error_unknown'));
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderStage = () => {
    switch (stage) {
      case 'enter_email':
        return (
          <form onSubmit={handleEmailSubmit} className="forgot-password-form">
            <h2>{t('forgot_password.title')}</h2>
            <p>{t('forgot_password.subtitle')}</p>
            {error && (
              <div className="status-alert error d-flex align-items-center gap-2 justify-content-center">
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
              {loading ? t('forgot_password.processing') : <><FaArrowRight /> {t('forgot_password.continue_button')}</>}
            </button>
          </form>
        );
      case 'answer_question':
        return (
          <form onSubmit={handleResetSubmit} className="forgot-password-form">
            <h2>{t('forgot_password.security_question_title')}</h2>
            <p>{t('forgot_password.security_question_subtitle')}</p>
            <div className="security-question-text d-flex align-items-center justify-content-center gap-2">
              <FaQuestionCircle /> {securityQuestion}
            </div>
            {error && (
              <div className="status-alert error d-flex align-items-center gap-2 justify-content-center">
                <FaExclamationCircle /> {error}
              </div>
            )}
            <div className="input-group-custom">
              <label htmlFor="securityAnswer">{t('forgot_password.answer_label')}</label>
              <div className="input-wrapper">
                <FaKey className="input-icon" />
                <input 
                  type="text" 
                  id="securityAnswer" 
                  placeholder={t('forgot_password.answer_placeholder')}
                  value={securityAnswer} 
                  onChange={e => setSecurityAnswer(e.target.value)} 
                  required 
                />
              </div>
            </div>
            <PasswordInput
              id="newPassword"
              name="newPassword"
              label={t('forgot_password.password_label')}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
            />
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              label={t('forgot_password.confirm_password_label')}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
            <button type="submit" className="forgot-password-button" disabled={loading}>
              {loading ? t('forgot_password.redefining') : <><FaCheckCircle /> {t('forgot_password.reset_button')}</>}
            </button>
          </form>
        );
      case 'success':
        return (
          <div className="success-container animate-fade-in">
            <FaCheckCircle className="success-icon" />
            <h2>{t('forgot_password.success_title')}</h2>
            <p>{t('forgot_password.success_message')}</p>
            <Link to="/login" className="forgot-password-button">{t('forgot_password.go_to_login')}</Link>
          </div>
        );
    }
  };

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-box">
        {renderStage()}
        {stage !== 'success' && (
          <div className="back-to-login">
            <Link to="/login">{t('forgot_password.back_to_login')}</Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
