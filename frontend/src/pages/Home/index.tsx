import React from 'react';
import { Container, Row, Col, Image, Card, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './style.css';
import logoSite from '../../assets/images/logo_site (1).png';
import { FaRobot, FaMapMarkedAlt, FaCube, FaChartLine, FaArrowRight, FaLock } from 'react-icons/fa';

const Home: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <Container fluid className="home-container px-4">
      {/* Hero Section */}
      <Row className="align-items-center text-center text-md-start mb-4 py-4 hero-section">
        <Col md={4} className="text-center">
          <Image src={logoSite} alt="SMART TWIN-IE Logo" fluid className="home-logo shadow-drop" />
        </Col>
        <Col md={8}>
          <h1 className="display-2 fw-bold platform-title">
            SMART <span className="text-success">TWIN</span>-I<span className="text-success">E</span>
          </h1>
          <h2 className="display-6 subtitle-home">Gêmeos Digitais na Construção Civil</h2>
        </Col>
      </Row>

      {/* Funcionalidades em Containers/Cards */}
      <h2 className="text-center mb-5 fw-bold">Funcionalidades da Plataforma</h2>
      <Row className="g-4 mb-5">
        <Col lg={3} md={6}>
          <Card className="h-100 functionality-card border-0 shadow-sm">
            <Card.Body className="text-center p-4">
              <div className="icon-circle mb-3 bg-success-soft">
                <FaRobot className="text-success fs-2" />
              </div>
              <Card.Title className="fw-bold mb-3">Inspeção por IA</Card.Title>
              <Card.Text className="text-muted">
                Detecção automatizada de patologias em fachadas e telhados utilizando modelos de Deep Learning.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={3} md={6}>
          <Card className="h-100 functionality-card border-0 shadow-sm">
            <Card.Body className="text-center p-4">
              <div className="icon-circle mb-3 bg-primary-soft">
                <FaMapMarkedAlt className="text-primary fs-2" />
              </div>
              <Card.Title className="fw-bold mb-3">Ortomosaicos</Card.Title>
              <Card.Text className="text-muted">
                Processamento de Ortomosaicos com mapeamento de danos georreferenciados.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={3} md={6}>
          <Card className="h-100 functionality-card border-0 shadow-sm">
            <Card.Body className="text-center p-4">
              <div className="icon-circle mb-3 bg-info-soft">
                <FaCube className="text-info fs-2" />
              </div>
              <Card.Title className="fw-bold mb-3">Integração BIM</Card.Title>
              <Card.Text className="text-muted">
                Conexão entre dados de inspeção e modelos BIM, facilitando o ciclo de vida do Gêmeo Digital.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={3} md={6}>
          <Card className="h-100 functionality-card border-0 shadow-sm">
            <Card.Body className="text-center p-4">
              <div className="icon-circle mb-3 bg-warning-soft">
                <FaChartLine className="text-warning fs-2" />
              </div>
              <Card.Title className="fw-bold mb-3">Dashboards</Card.Title>
              <Card.Text className="text-muted">
                Visualização analítica de dados e indicadores de progresso para suporte à tomada de decisão.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Quick Access Card - Now as a separate section for better fluidity */}
      <div className="access-section">
        <Card className="access-card border-0 shadow-lg">
          <Card.Body className="p-4 d-flex align-items-center gap-4 flex-column flex-sm-row text-center text-sm-start">
            <div className="access-icon-wrapper">
              {user ? <FaArrowRight className="text-success fs-3" /> : <FaLock className="text-primary fs-3" />}
            </div>
            <div className="flex-grow-1">
              <h4 className="fw-bold mb-1">{user ? 'Bem-vindo de volta!' : 'Pronto para começar?'}</h4>
              <p className="text-muted mb-0 small">{user ? 'Continue gerenciando seus projetos e inspeções.' : 'Entre com sua conta para acessar os módulos exclusivos.'}</p>
            </div>
            <Button 
              variant={user ? "success" : "primary"} 
              size="lg"
              onClick={() => navigate(user ? '/projetos' : '/login')}
              className="px-5 fw-bold mt-3 mt-sm-0 shadow-sm"
            >
              {user ? 'Acesse seus Projetos' : 'Fazer Login'}
            </Button>
          </Card.Body>
        </Card>
      </div>

      {/* Seção Sobre o GETEC */}
      <Row className="justify-content-center text-center py-5 mt-5 rounded-4 about-getec-section">
        <Col md={8}>
          <h3 className="fw-bold mb-3">Uma Iniciativa GETEC UFBA</h3>
          <p className="lead mb-4">
            Desenvolvido pelo Grupo de Pesquisa e Extensão em Gestão e Tecnologia das Construções da Universidade Federal da Bahia.
          </p>
          <a href="https://getec.eng.ufba.br/" target="_blank" rel="noopener noreferrer" className="btn btn-success btn-lg px-5 py-3 shadow-sm fw-bold">
            Conheça o GETEC
          </a>
        </Col>
      </Row>
    </Container>
  );
};

export default Home;

