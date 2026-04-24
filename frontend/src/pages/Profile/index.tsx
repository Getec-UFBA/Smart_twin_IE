import React, { useState, useEffect } from 'react';
import { Form, Button, Image } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { FaUser, FaBuilding, FaInfoCircle, FaCamera, FaSave, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import './style.css';

const Profile: React.FC = () => {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setCompany(user.company || '');
      setBio(user.bio || '');
      if (user.avatarUrl) {
        setAvatarUrl(`http://localhost:3001/files/${user.avatarUrl}`);
      }
    }
  }, [user]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const data = new FormData();
      data.append('avatar', e.target.files[0]);

      try {
        const response = await api.patch(`/profile/avatar`, data);
        const updatedUser = response.data;

        if (updatedUser.avatarUrl) {
          setAvatarUrl(`http://localhost:3001/files/${updatedUser.avatarUrl}`);
        }
        updateUser(updatedUser);
        setSuccess(t('profile.success_avatar'));
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        setError(t('profile.error_avatar'));
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const response = await api.put(`/profile/me`, { name, company, bio });
      updateUser(response.data);
      setSuccess(t('profile.success_profile'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(t('profile.error_profile'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-card">
        {/* HEADER DO PERFIL */}
        <header className="profile-header">
          <div className="avatar-wrapper">
            <Image 
              src={avatarUrl || 'https://via.placeholder.com/150'} 
              className="avatar-image" 
            />
            <label htmlFor="avatar-upload" className="avatar-edit-btn">
              <FaCamera />
              <input 
                id="avatar-upload" 
                type="file" 
                className="d-none" 
                onChange={handleAvatarChange} 
              />
            </label>
          </div>
          <h2 className="profile-name-display">{name || t('profile.name_placeholder')}</h2>
          <span className="profile-email-display">{user?.email}</span>
        </header>

        {/* CONTEÚDO DO PERFIL */}
        <div className="profile-content">
          {error && (
            <div className="status-alert error">
              <FaExclamationCircle /> {error}
            </div>
          )}
          {success && (
            <div className="status-alert success">
              <FaCheckCircle /> {success}
            </div>
          )}

          <Form onSubmit={handleSubmit} className="registration-form">
            <div className="form-section-title">{t('profile.personal_info')}</div>
            
            <div className="input-group-custom">
              <label>{t('profile.full_name')}</label>
              <div className="input-wrapper">
                <FaUser className="input-icon" />
                <Form.Control 
                  type="text" 
                  placeholder={t('profile.name_placeholder')}
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                />
              </div>
            </div>

            <div className="input-group-custom">
              <label>{t('profile.company_label')}</label>
              <div className="input-wrapper">
                <FaBuilding className="input-icon" />
                <Form.Control 
                  type="text" 
                  placeholder={t('profile.company_placeholder')}
                  value={company} 
                  onChange={e => setCompany(e.target.value)} 
                />
              </div>
            </div>

            <div className="form-section-title">{t('profile.about_you')}</div>

            <div className="input-group-custom">
              <label>{t('profile.bio_label')}</label>
              <div className="input-wrapper">
                <FaInfoCircle className="input-icon" style={{ top: '16px', transform: 'none' }} />
                <Form.Control 
                  as="textarea" 
                  rows={4} 
                  placeholder={t('profile.bio_placeholder')}
                  value={bio} 
                  onChange={e => setBio(e.target.value)} 
                  style={{ paddingLeft: '44px' }}
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="btn-save-profile w-100" 
              disabled={loading}
            >
              {loading ? t('profile.saving') : <><FaSave /> {t('profile.save_button')}</>}
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
