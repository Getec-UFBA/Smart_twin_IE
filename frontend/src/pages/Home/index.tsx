import React from 'react';
import { Container, Row, Col, Image, Card } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import './style.css';
import logoSite from '../../assets/images/logo_site (1).png';
import { 
  FaRobot, FaMapMarkedAlt, FaCube, FaChartLine, 
  FaArrowRight, FaLock 
} from 'react-icons/fa';

const Home: React.FC = () => {
  const { t } = useTranslation();
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
              <h2 className="subtitle-home">{t('home.platform_subtitle')}</h2>
            </Col>
          </Row>
        </Container>
      </section>

      <Container>
        {/* Funcionalidades */}
        <h2 className="section-title text-center">{t('home.tech_section_title')}</h2>
        <Row className="g-4 mb-5">
          <Col lg={3} md={6}>
            <Card className="functionality-card border-0">
              <Card.Body>
                <div className="icon-box-premium"><FaRobot /></div>
                <h4 className="fw-bold mb-3">{t('home.feature_ia_title')}</h4>
                <p className="text-muted mb-0">{t('home.feature_ia_desc')}</p>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={3} md={6}>
            <Card className="functionality-card border-0">
              <Card.Body>
                <div className="icon-box-premium"><FaMapMarkedAlt /></div>
                <h4 className="fw-bold mb-3">{t('home.feature_ortho_title')}</h4>
                <p className="text-muted mb-0">{t('home.feature_ortho_desc')}</p>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={3} md={6}>
            <Card className="functionality-card border-0">
              <Card.Body>
                <div className="icon-box-premium"><FaCube /></div>
                <h4 className="fw-bold mb-3">{t('home.feature_twins_title')}</h4>
                <p className="text-muted mb-0">{t('home.feature_twins_desc')}</p>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={3} md={6}>
            <Card className="functionality-card border-0">
              <Card.Body>
                <div className="icon-box-premium"><FaChartLine /></div>
                <h4 className="fw-bold mb-3">{t('home.feature_analytics_title')}</h4>
                <p className="text-muted mb-0">{t('home.feature_analytics_desc')}</p>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Access Banner (CTA) */}
        <div className="access-section">
          <div className="access-banner">
            <div className="access-content">
              <h3>{user ? t('home.cta_welcome_user', { name: user.name || 'Usuário' }) : t('home.cta_welcome_guest')}</h3>
              <p>{user ? t('home.cta_desc_user') : t('home.cta_desc_guest')}</p>
            </div>
            <button 
              className="btn-cta"
              onClick={() => navigate(user ? '/projetos' : '/login')}
            >
              {user ? <><FaArrowRight className="me-2" /> {t('home.cta_button_user')}</> : <><FaLock className="me-2" /> {t('home.cta_button_guest')}</>}
            </button>
          </div>
        </div>
      </Container>
    </div>
  );
};

export default Home;
