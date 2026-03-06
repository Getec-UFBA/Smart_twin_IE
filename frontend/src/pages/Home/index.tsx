import React from 'react';
import { Container, Row, Col, Image, Card, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './style.css';
import logoSite from '../../assets/images/logo_site (1).png';
import { 
  FaRobot, FaMapMarkedAlt, FaCube, FaChartLine, 
  FaArrowRight, FaLock, FaExternalLinkAlt 
} from 'react-icons/fa';

const Home: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="home-container">
      {/* Hero Section */}
      <section className="hero-section">
        <Container>
          <Row className="align-items-center text-center text-lg-start">
            <Col lg={4} className="text-center mb-5 mb-lg-0">
              <Image src={logoSite} alt="SMART TWIN-IE Logo" className="home-logo" />
            </Col>
            <Col lg={8}>
              <h1 className="platform-title">
                SMART <span className="text-green">TWIN</span>-I<span className="text-green">E</span>
              </h1>
              <h2 className="subtitle-home">Gêmeos Digitais e Inspeção Estrutural Inteligente</h2>
            </Col>
          </Row>
        </Container>
      </section>

      <Container>
        {/* Funcionalidades */}
        <h2 className="section-title text-center">Tecnologia de Ponta</h2>
        <Row className="g-4 mb-5">
          <Col lg={3} md={6}>
            <Card className="functionality-card border-0">
              <Card.Body>
                <div className="icon-box-premium"><FaRobot /></div>
                <h4 className="fw-bold mb-3">Inspeção por IA</h4>
                <p className="text-muted mb-0">Detecção automatizada de patologias com modelos YOLOv8 otimizados para engenharia.</p>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={3} md={6}>
            <Card className="functionality-card border-0">
              <Card.Body>
                <div className="icon-box-premium"><FaMapMarkedAlt /></div>
                <h4 className="fw-bold mb-3">Ortomosaicos</h4>
                <p className="text-muted mb-0">Mapeamento georreferenciado de danos em ortofotos de alta resolução.</p>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={3} md={6}>
            <Card className="functionality-card border-0">
              <Card.Body>
                <div className="icon-box-premium"><FaCube /></div>
                <h4 className="fw-bold mb-3">Gêmeos Digitais</h4>
                <p className="text-muted mb-0">Integração completa com modelos BIM para gestão do ciclo de vida da estrutura.</p>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={3} md={6}>
            <Card className="functionality-card border-0">
              <Card.Body>
                <div className="icon-box-premium"><FaChartLine /></div>
                <h4 className="fw-bold mb-3">Analytics</h4>
                <p className="text-muted mb-0">Dashboards analíticos com indicadores de severidade e evolução temporal.</p>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Access Banner (CTA) */}
        <div className="access-section">
          <div className="access-banner">
            <div className="access-content">
              <h3>{user ? `Bem-vindo, ${user.name || 'Usuário'}!` : 'Pronto para começar?'}</h3>
              <p>{user ? 'Acesse seu painel administrativo para gerenciar seus projetos.' : 'Entre na plataforma para utilizar nossas ferramentas de IA e Gêmeos Digitais.'}</p>
            </div>
            <button 
              className="btn-cta"
              onClick={() => navigate(user ? '/projetos' : '/login')}
            >
              {user ? <><FaArrowRight className="me-2" /> Ir para Projetos</> : <><FaLock className="me-2" /> Acessar Plataforma</>}
            </button>
          </div>
        </div>

        {/* Seção Sobre o GETEC */}
        <div className="about-getec-section text-center">
          <span className="getec-badge">INICIATIVA ACADÊMICA</span>
          <h3 className="fw-bold mb-3">Desenvolvido pelo GETEC UFBA</h3>
          <p className="text-muted mb-4 mx-auto" style={{ maxWidth: '700px' }}>
            O <strong>Grupo de Pesquisa e Extensão em Gestão e Tecnologia das Construções</strong> da Universidade Federal da Bahia atua no desenvolvimento de soluções tecnológicas aplicadas à engenharia civil.
          </p>
          <Button 
            variant="outline-success" 
            href="https://getec.eng.ufba.br/" 
            target="_blank" 
            className="rounded-pill px-4 py-2"
          >
            <FaExternalLinkAlt className="me-2" /> Visitar Portal GETEC
          </Button>
        </div>
      </Container>
    </div>
  );
};

export default Home;

