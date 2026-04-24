import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Container, Row, Col, Card } from 'react-bootstrap';
// import './style.css';

const API_URL = 'http://localhost:3001';

interface IProject {
  id: string;
  name: string;
  responsible: string;
  address: string;
  type: string;
  modules: {
    progress: boolean;
    security: boolean;
    maintenance: boolean;
  };
}

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<IProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await axios.get(`${API_URL}/projects/${id}`);
        setProject(response.data);
      } catch (err) {
        setError(t('dashboard.error_loading'));
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [id, t]);

  if (loading) {
    return <p>{t('dashboard.loading')}</p>;
  }

  if (error) {
    return <p className="error-message">{error}</p>;
  }

  if (!project) {
    return <p>{t('dashboard.project_not_found')}</p>;
  }

  return (
    <Container fluid>
      <h1 className="my-4">{t('dashboard.title')}: {project.name}</h1>
      <Row>
        <Col md={6}>
          <Card>
            <Card.Body>
              <Card.Title>{t('dashboard.general_info')}</Card.Title>
              <p><strong>{t('dashboard.responsible')}:</strong> {project.responsible}</p>
              <p><strong>{t('dashboard.address')}:</strong> {project.address}</p>
              <p><strong>{t('dashboard.type')}:</strong> {project.type}</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card>
            <Card.Header>{t('dashboard.active_modules')}</Card.Header>
            <Card.Body>
              {project.modules.progress && <p>{t('dashboard.module_progress')}</p>}
              {project.modules.security && <p>{t('dashboard.module_security')}</p>}
              {project.modules.maintenance && <p>{t('dashboard.module_maintenance')}</p>}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Dashboard;
