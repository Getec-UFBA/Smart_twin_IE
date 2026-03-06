import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import PasswordInput from '../../components/PasswordInput';
import { FaEnvelope, FaShieldAlt, FaKey, FaUserCheck, FaExclamationCircle, FaCheckCircle } from 'react-icons/fa';
import './style.css';

const API_URL = 'http://localhost:3001';

const securityQuestions = [
  "Qual o nome do seu primeiro animal de estimação?",
  "Qual o nome de solteira da sua mãe?",
  "Em que cidade você nasceu?",
  "Qual era o modelo do seu primeiro carro?",
];

const CompleteRegistration: React.FC = () => {
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
      setError('As senhas não coincidem.');
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
      setSuccess('Cadastro finalizado com sucesso! Redirecionando...');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error || 'Erro ao finalizar o cadastro.');
      } else {
        setError('Erro desconhecido ao finalizar o cadastro.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="complete-registration-container">
      <div className="complete-registration-box animate-fade-in">
        <h2>Finalizar Cadastro</h2>
        <p className="subtitle">Defina sua senha e uma pergunta de segurança para proteger sua conta.</p>
        
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

          <PasswordInput
            id="password"
            name="password"
            label="Senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
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

          <div className="input-group-custom">
            <label htmlFor="securityQuestion">Pergunta de Segurança</label>
            <div className="input-wrapper">
              <FaShieldAlt className="input-icon" />
              <select id="securityQuestion" value={question} onChange={e => setQuestion(e.target.value)} required>
                {securityQuestions.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
          </div>

          <div className="input-group-custom">
            <label htmlFor="securityAnswer">Sua Resposta</label>
            <div className="input-wrapper">
              <FaKey className="input-icon" />
              <input 
                type="text" 
                id="securityAnswer" 
                placeholder="Digite sua resposta"
                value={answer} 
                onChange={e => setAnswer(e.target.value)} 
                required 
              />
            </div>
          </div>

          <button type="submit" className="complete-registration-button" disabled={loading}>
            {loading ? 'Processando...' : <><FaUserCheck /> Finalizar Cadastro</>}
          </button>
        </form>

        <div className="back-to-login">
          <Link to="/login">Voltar para o Login</Link>
        </div>
      </div>
    </div>
  );
};

export default CompleteRegistration;
