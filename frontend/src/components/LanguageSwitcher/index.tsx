import React from 'react';
import { useTranslation } from 'react-i18next';
import './style.css';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'pt' ? 'en' : 'pt';
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="language-switcher" onClick={toggleLanguage} title={i18n.language === 'pt' ? 'Mudar para Inglês' : 'Switch to Portuguese'}>
      <div className={`lang-option ${i18n.language === 'pt' ? 'active' : ''}`}>PT</div>
      <div className="lang-separator">|</div>
      <div className={`lang-option ${i18n.language === 'en' ? 'active' : ''}`}>EN</div>
    </div>
  );
};

export default LanguageSwitcher;
