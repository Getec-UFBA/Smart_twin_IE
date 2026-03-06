import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import PasswordInput from '../../components/PasswordInput';
import { FaEnvelope, FaKey, FaArrowRight, FaCheckCircle, FaExclamationCircle, FaQuestionCircle } from 'react-icons/fa';
import './style.css';

const API_URL = 'http://localhost:3001';

type Stage = 'enter_email' | 'answer_question' | 'success';

const ForgotPassword = () => {
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
      setError('Email não encontrado ou sem pergunta de segurança configurada.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
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
        setError(err.response.data.error || 'Erro ao redefinir a senha.');
      } else {
        setError('Erro desconhecido ao redefinir a senha.');
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
            <h2>Esqueci Minha Senha</h2>
            <p>Informe seu email para recuperar o acesso à sua conta.</p>
            {error && (
              <div className="status-alert error d-flex align-items-center gap-2 justify-content-center">
                <FaExclamationCircle /> {error}
              </div>
            )}
            <div className="input-group-custom">
              <label htmlFor="email">Email</label>
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
            <button type="submit" className="forgot-password-button" disabled={loading}>
              {loading ? 'Processando...' : <><FaArrowRight /> Continuar</>}
            </button>
          </form>
        );
      case 'answer_question':
        return (
          <form onSubmit={handleResetSubmit} className="forgot-password-form">
            <h2>Pergunta de Segurança</h2>
            <p>Responda à pergunta abaixo para redefinir sua senha.</p>
            <div className="security-question-text d-flex align-items-center justify-content-center gap-2">
              <FaQuestionCircle /> {securityQuestion}
            </div>
            {error && (
              <div className="status-alert error d-flex align-items-center gap-2 justify-content-center">
                <FaExclamationCircle /> {error}
              </div>
            )}
            <div className="input-group-custom">
              <label htmlFor="securityAnswer">Sua Resposta</label>
              <div className="input-wrapper">
                <FaKey className="input-icon" />
                <input 
                  type="text" 
                  id="securityAnswer" 
                  placeholder="Sua resposta"
                  value={securityAnswer} 
                  onChange={e => setSecurityAnswer(e.target.value)} 
                  required 
                />
              </div>
            </div>
            <PasswordInput
              id="newPassword"
              name="newPassword"
              label="Senha"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
            />
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              label="Confirme a senha"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
            <button type="submit" className="forgot-password-button" disabled={loading}>
              {loading ? 'Redefinindo...' : <><FaCheckCircle /> Redefinir Senha</>}
            </button>
          </form>
        );
      case 'success':
        return (
          <div className="success-container animate-fade-in">
            <FaCheckCircle className="success-icon" />
            <h2>Senha Redefinida!</h2>
            <p>Sua senha foi alterada com sucesso. Você já pode acessar sua conta.</p>
            <Link to="/login" className="forgot-password-button">Ir para o Login</Link>
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
            <Link to="/login">Voltar para o Login</Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
