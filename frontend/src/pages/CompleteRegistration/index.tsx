import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import PasswordInput from '../../components/PasswordInput';
import { FaEnvelope, FaShieldAlt, FaExclamationCircle, FaCheckCircle } from 'react-icons/fa';
import './style.css';

const API_URL = 'http://localhost:3001';

const CompleteRegistration: React.FC = () => {
  const { t } = useTranslation();
  
  const securityQuestions = [
    t('security_questions.pet'),
    t('security_questions.mother'),
    t('security_questions.city'),
    t('security_questions.car'),
  ];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [question, setQuestion] = useState(securityQuestions[0]);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError(t('complete_registration.error_mismatch'));
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/users/complete-registration`, {
        email,
        password,
        confirmPassword,
        securityQuestion: question,
        securityAnswer: answer,
      });
      setSuccess(t('complete_registration.success_message'));
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error || t('complete_registration.error_complete'));
      } else {
        setError(t('complete_registration.error_unknown'));
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="complete-registration-container">
      <div className="complete-registration-box animate-fade-in">
        <h2>{t('complete_registration.title')}</h2>
        <p className="subtitle">{t('complete_registration.subtitle')}</p>
        
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

          <div className="input-group-custom">
            <label htmlFor="email">{t('complete_registration.email_label')}</label>
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
            label={t('complete_registration.password_label')}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            label={t('complete_registration.confirm_password_label')}
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
          />

          <div className="input-group-custom">
            <label htmlFor="securityQuestion">{t('complete_registration.security_question_label')}</label>
            <div className="input-wrapper">
              <FaShieldAlt className="input-icon" />
              <select 
                id="securityQuestion" 
                value={question} 
                onChange={e => setQuestion(e.target.value)}
                required
              >
                {securityQuestions.map((q, idx) => (
                  <option key={idx} value={q}>{q}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="input-group-custom">
            <label htmlFor="securityAnswer">{t('complete_registration.answer_label')}</label>
            <div className="input-wrapper">
              <FaShieldAlt className="input-icon" />
              <input 
                type="text" 
                id="securityAnswer" 
                placeholder={t('complete_registration.answer_placeholder')}
                value={answer} 
                onChange={e => setAnswer(e.target.value)} 
                required 
              />
            </div>
          </div>

          <button type="submit" className="registration-button" disabled={loading}>
            {loading ? t('complete_registration.completing') : t('complete_registration.submit_button')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CompleteRegistration;
