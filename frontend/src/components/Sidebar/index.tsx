import React from 'react';
import { Nav } from 'react-bootstrap';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaHome, FaFolder, FaUsers, FaBook } from 'react-icons/fa';
import './style.css';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  isAdmin?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar }) => {
  const { t } = useTranslation();

  const handleNavLinkClick = () => {
    if (isOpen) {
      toggleSidebar();
    }
  };
  
  return (
    <div className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <Nav className="flex-column">
        <div className="sidebar-section-label">{t('sidebar.menu')}</div>
        <Nav.Link as={NavLink} to="/" end onClick={handleNavLinkClick}>
          <FaHome />
          <span>{t('sidebar.home')}</span>
        </Nav.Link>
        <Nav.Link as={NavLink} to="/projetos" onClick={handleNavLinkClick}>
          <FaFolder />
          <span>{t('sidebar.projects')}</span>
        </Nav.Link>
        <Nav.Link as={NavLink} to="/biblioteca" onClick={handleNavLinkClick}>
          <FaBook />
          <span>{t('sidebar.library', 'Biblioteca')}</span>
        </Nav.Link>
        <Nav.Link as={NavLink} to="/usuarios" onClick={handleNavLinkClick}>
          <FaUsers />
          <span>{t('sidebar.users', 'Usuários')}</span>
        </Nav.Link>
      </Nav>
    </div>
  );
};

export default Sidebar;
