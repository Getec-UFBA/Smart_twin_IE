import React, { useState, useContext } from 'react';
import { Navbar, Container, Nav, Dropdown, Image, Button, Row, Col, Stack, Badge } from 'react-bootstrap';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ThemeContext } from '../../contexts/ThemeContext';
import ThemeToggleSwitch from '../ThemeToggleSwitch';
import Sidebar from '../Sidebar'; 
import { FaUserCircle, FaSignOutAlt, FaKey, FaUser } from 'react-icons/fa';
import './style.css';
import logoSite from '../../assets/images/logo_site (1).png';

const API_URL = 'http://localhost:3001';

const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme } = useContext(ThemeContext);
  const [sidebarIsOpen, setSidebarIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const toggleSidebar = () => {
    setSidebarIsOpen(!sidebarIsOpen);
  };

  // Verifica se a rota atual corresponde a /projetos/:id
  const isProjectViewPage = /^\/projetos\/.+/.test(location.pathname);

  const getMainContentClassName = () => {
    if (isProjectViewPage) {
      return 'main-content no-sidebar';
    }
    return `main-content ${sidebarIsOpen ? 'sidebar-open' : 'sidebar-closed'}`;
  };

  return (
    <div className="d-flex min-vh-100">
      {!isProjectViewPage && <Sidebar isOpen={sidebarIsOpen} toggleSidebar={toggleSidebar} isAdmin={user?.role === 'admin'} />}
      
      <div className={getMainContentClassName()}>
        <Navbar bg="dark" expand={false} variant="dark" fixed="top">
          <Container fluid>
            <div className="d-flex align-items-center">
              {!isProjectViewPage && (
                <Button variant="outline-light" onClick={toggleSidebar} className="me-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-list" viewBox="0 0 16 16">
                    <path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/>
                  </svg>
                </Button>
              )}
              <Navbar.Brand href="/" className="navbar-brand-custom d-flex align-items-center">
                <Image src={logoSite} alt="Logo" width="30" height="30" className="me-2 d-inline-block align-top" />
                <span className="d-none d-lg-block">SMART TWIN-IE</span>
                <span className="d-lg-none">SMART TWIN-IE</span>
              </Navbar.Brand>
            </div>

            <div className="ms-auto d-flex align-items-center">
              <ThemeToggleSwitch />
              {user ? (
                <Dropdown align="end">
                  <Dropdown.Toggle as="div" id="dropdown-user" className="avatar-dropdown-toggle cursor-pointer ms-3" style={{ cursor: 'pointer' }}>
                    {user.avatarUrl ? (
                      <Image
                        src={`${API_URL}/files/${user.avatarUrl}`}
                        roundedCircle
                        className="navbar-avatar"
                      />
                    ) : (
                      <FaUserCircle className="text-white-50" size={32} />
                    )}
                  </Dropdown.Toggle>

                  <Dropdown.Menu variant={theme} className="user-dropdown-menu">
                    <div className="dropdown-user-header">
                      <span className="dropdown-user-email">{user.email}</span>
                      <Badge bg="success" className="bg-opacity-10 text-success mt-1 small" style={{ fontSize: '0.7rem' }}>
                        {user.role === 'admin' ? 'Administrador' : 'Usuário'}
                      </Badge>
                    </div>
                    
                    <Dropdown.Item onClick={() => navigate('/profile')} className="user-dropdown-item">
                      <FaUser /> Perfil
                    </Dropdown.Item>
                    
                    <Dropdown.Item onClick={() => navigate('/change-password')} className="user-dropdown-item">
                      <FaKey /> Alterar Senha
                    </Dropdown.Item>
                    
                    <Dropdown.Divider />
                    
                    <Dropdown.Item onClick={logout} className="user-dropdown-item logout-item">
                      <FaSignOutAlt /> Sair da conta
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              ) : (
                <Nav.Link href="/login" className="ms-3 text-white">Login</Nav.Link>
              )}
            </div>
          </Container>
        </Navbar>

        <Container as="main" className="my-5 flex-grow-1 pt-5">
          <Outlet />
        </Container>

        <footer className="footer-custom mt-auto py-5">
          <Container>
            <Row className="gy-4">
              <Col lg={4} md={6}>
                <div className="d-flex align-items-center mb-3">
                  <Image src={logoSite} alt="Logo" width="24" height="24" className="me-2 opacity-75" />
                  <span className="footer-brand">SMART TWIN-IE</span>
                </div>
                <p className="mb-0">
                  Plataforma inteligente para inspeção de patologias e gestão de gêmeos digitais na engenharia civil.
                </p>
              </Col>
              
              <Col lg={4} md={6} className="text-md-center">
                <h6 className="fw-bold mb-3 text-white-50">Desenvolvimento</h6>
                <div className="mb-2">
                  <span className="fw-bold text-getec">GETEC</span>
                  <span className="mx-2 opacity-25">|</span>
                  <span>UFBA</span>
                </div>
                <p className="mb-0">Grupo de Pesquisa e Extensão em Gestão e Tecnologia das Construções</p>
              </Col>

              <Col lg={4} md={12} className="text-lg-end">
                <h6 className="fw-bold mb-3 text-white-50">Suporte e Links</h6>
                <Stack direction="horizontal" gap={3} className="justify-content-lg-end justify-content-start mb-3">
                  <a href="#" className="footer-link">Documentação</a>
                  <a href="#" className="footer-link">Suporte</a>
                  <a href="#" className="footer-link">Privacidade</a>
                </Stack>
                <div>
                  Versão <span className="footer-version">1.0.0-stable</span>
                </div>
              </Col>
            </Row>
            
            <hr className="my-4 opacity-10" />
            
            <div className="d-flex justify-content-between align-items-center">
              <span>&copy; 2026 SMART TWIN-IE. Todos os direitos reservados.</span>
              <div className="d-flex align-items-center gap-2">
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                <span className="text-muted">Sistemas operacionais</span>
              </div>
            </div>
          </Container>
        </footer>
      </div>
    </div>
  );
};

export default Layout;
