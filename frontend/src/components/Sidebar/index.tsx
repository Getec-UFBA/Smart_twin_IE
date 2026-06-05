import React from 'react';
import { Nav } from 'react-bootstrap';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaHome, FaFolder, FaUserPlus } from 'react-icons/fa';
import './style.css';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  isAdmin: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar, isAdmin }) => {
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

        {isAdmin && (
          <>
            <div className="sidebar-section-label">{t('sidebar.administration')}</div>
            <Nav.Link as={NavLink} to="/admin" onClick={handleNavLinkClick}>
              <FaUserPlus />
              <span>{t('sidebar.admin_dashboard')}</span>
            </Nav.Link>
          </>
        )}
      </Nav>
    </div>
  );
};

export default Sidebar;
