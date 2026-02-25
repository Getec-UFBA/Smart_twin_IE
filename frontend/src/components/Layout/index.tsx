import React, { useState, useContext } from 'react';
import { Navbar, Container, Nav, Dropdown, Image, Button } from 'react-bootstrap';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ThemeContext } from '../../contexts/ThemeContext';
import ThemeToggleSwitch from '../ThemeToggleSwitch';
import Sidebar from '../Sidebar'; 
import './style.css';
import logoSite from '../../assets/images/logo_site (1).png';

const API_URL = 'http://localhost:3001';

const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme } = useContext(ThemeContext);
  const [sidebarIsOpen, setSidebarIsOpen] = useState(false);
  const location = useLocation();

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
                  <Dropdown.Toggle as={Nav.Link} id="dropdown-user" className="avatar-dropdown-toggle text-white-50">
                    {user.avatarUrl ? (
                      <Image
                        src={`${API_URL}/files/${user.avatarUrl}`}
                        roundedCircle
                        className="navbar-avatar"
                      />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" className="bi bi-person-circle" viewBox="0 0 16 16">
                        <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
                        <path fillRule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z"/>
                      </svg>
                    )}
                  </Dropdown.Toggle>

                  <Dropdown.Menu variant={theme}>
                    <Dropdown.ItemText className={theme === 'dark' ? 'text-light' : ''}>{user.email}</Dropdown.ItemText>
                    <Dropdown.Divider />
                    <Dropdown.Item href="/profile">Perfil</Dropdown.Item>
                    <Dropdown.Item href="/change-password">Alterar Senha</Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item onClick={logout}>Sair</Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              ) : (
                <Nav.Link href="/login">Login</Nav.Link>
              )}
            </div>
          </Container>
        </Navbar>

        <Container as="main" className="my-5 flex-grow-1 pt-5">
          <Outlet />
        </Container>

        <footer className="mt-auto p-4 bg-dark text-white text-center">
          <Container>
            <p className="mb-0">&copy; 2026 SMART TWIN-IE. Todos os direitos reservados.</p>
          </Container>
        </footer>
      </div>
    </div>
  );
};

export default Layout;
