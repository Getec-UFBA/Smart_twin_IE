import React, { useState, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Container, Row, Col, Card, Button, Form, Dropdown, Alert, Modal } from 'react-bootstrap';
import api from '../../services/api';
import './style.css';
import { FaSave, FaDownload, FaArrowLeft, FaCheckCircle } from 'react-icons/fa';

interface IImage {
  url: string;
  detections?: any[];
}

interface IInspection {
  id: string;
  inspectionObjective: string;
}

const ProjectResults: React.FC = () => {
  const { t } = useTranslation();
  const { id: projectId } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [images, setImages] = useState<IImage[]>([]);
  const [inspections, setInspections] = useState<IInspection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ [key: string]: { saving: boolean; error: string | null; success: boolean } }>({});
  const [expandedImage, setExpandedImage] = useState<{ url: string; index: number } | null>(null);
  const [selectedGlobalInspectionId, setSelectedGlobalInspectionId] = useState<string>('');

  useEffect(() => {
    if (location.state && location.state.processedImages) {
      setImages(location.state.processedImages);
    } else {
      setError(t('project_results.error_no_images'));
    }

    const fetchInspections = async () => {
      try {
        const response = await api.get(`/projects/${projectId}`);
        const fetchedInspections = response.data.inspections || [];
        setInspections(fetchedInspections);
        if (fetchedInspections.length > 0) {
          setSelectedGlobalInspectionId(fetchedInspections[0].id);
        }
      } catch (err) {
        console.error('Erro ao buscar inspeções:', err);
        setError(t('project_results.error_load_insp'));
      }
    };

    if (projectId) {
      fetchInspections();
    }
  }, [location.state, projectId, t]);

  const handleSaveToInspection = async (imageUrl: string, detections: any[], inspectionId: string) => {
    if (!projectId || !inspectionId) {
      setSaveStatus(prev => ({
        ...prev,
        [imageUrl]: { saving: false, error: t('project_results.error_invalid_ids'), success: false }
      }));
      return;
    }

    setSaveStatus(prev => ({
      ...prev,
      [imageUrl]: { saving: true, error: null, success: false }
    }));

    try {
      const response = await fetch(`${api.defaults.baseURL}${imageUrl}`);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result;
        await api.post(`/projects/${projectId}/inspections/${inspectionId}/save-image`, {
          imageData: base64data,
          detections: JSON.stringify(detections),
        });

        setSaveStatus(prev => ({
          ...prev,
          [imageUrl]: { saving: false, error: null, success: true }
        }));
      };
    } catch (err) {
      console.error('Erro ao salvar imagem na inspeção:', err);
      const errorMessage = (err as any).response?.data?.error || t('project_results.error_save_image');
      setSaveStatus(prev => ({
        ...prev,
        [imageUrl]: { saving: false, error: errorMessage, success: false }
      }));
    }
  };

  const handleSaveAllToSelected = async () => {
    if (!selectedGlobalInspectionId) {
      alert(t('project_results.select_insp_first'));
      return;
    }

    const unsavedImages = images.filter(img => !saveStatus[img.url]?.success && !saveStatus[img.url]?.saving);
    
    for (const image of unsavedImages) {
      handleSaveToInspection(image.url, image.detections || [], selectedGlobalInspectionId);
    }
  };

  const handleDownloadImage = (imageUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = `${api.defaults.baseURL}${imageUrl}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (error && images.length === 0) {
    return (
      <Container>
        <Alert variant="danger" className="mt-4">{error}</Alert>
        <Button variant="outline-primary" onClick={() => navigate(`/projetos/${projectId}`)}>
          <FaArrowLeft className="me-2" /> {t('project_results.back_to_project')}
        </Button>
      </Container>
    );
  }

  return (
    <Container fluid className="project-results-container py-4">
      <Row className="mb-4 align-items-center">
        <Col>
          <h1 className="h3 mb-1">{t('project_results.title')}</h1>
          <p className="text-muted">{t('project_results.subtitle')}</p>
        </Col>
        <Col xs="auto">
          <Button variant="outline-secondary" onClick={() => navigate(`/projetos/${projectId}`)}>
            <FaArrowLeft className="me-2" /> {t('project_results.back')}
          </Button>
        </Col>
      </Row>

      <Card className="mb-4 shadow-sm border-0 selection-header-card">
        <Card.Body>
          <Row className="align-items-end g-3">
            <Col md={5}>
              <Form.Group>
                <Form.Label className="fw-bold">{t('project_results.save_in')}</Form.Label>
                <Form.Select 
                  value={selectedGlobalInspectionId} 
                  onChange={(e) => setSelectedGlobalInspectionId(e.target.value)}
                  className="form-select-lg"
                >
                  <option value="" disabled>{t('project_results.select_inspection')}</option>
                  {inspections.map(insp => (
                    <option key={insp.id} value={insp.id}>{insp.inspectionObjective}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md="auto">
              <Button 
                variant="success" 
                size="lg" 
                onClick={handleSaveAllToSelected}
                disabled={!selectedGlobalInspectionId || images.every(img => saveStatus[img.url]?.success)}
                className="px-4"
              >
                <FaSave className="me-2" /> {t('project_results.save_all')}
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Row>
        {images.map((image, index) => (
          <Col xs={12} sm={6} md={4} lg={3} key={index} className="mb-4">
            <Card className="h-100 shadow-sm border-0 result-card">
              <div className="position-relative overflow-hidden card-img-container">
                <Card.Img 
                  variant="top" 
                  src={`${api.defaults.baseURL}${image.url}`} 
                  alt={`Imagem Processada ${index + 1}`} 
                  className="result-img"
                  onClick={() => setExpandedImage({ url: `${api.defaults.baseURL}${image.url}`, index })}
                />
                {saveStatus[image.url]?.success && (
                  <div className="save-badge">
                    <FaCheckCircle className="me-1" /> {t('project_results.saved')}
                  </div>
                )}
              </div>
              <Card.Body className="d-flex flex-column">
                <div className="d-flex justify-content-between align-items-center mt-auto gap-2">
                  <Dropdown className="flex-grow-1">
                    <Dropdown.Toggle 
                      variant={saveStatus[image.url]?.success ? "outline-success" : "success"}
                      id={`dropdown-save-${index}`}
                      disabled={saveStatus[image.url]?.saving || saveStatus[image.url]?.success}
                      className="w-100"
                    >
                      {saveStatus[image.url]?.saving ? t('project_results.saving') : saveStatus[image.url]?.success ? t('project_results.saved') : t('project_results.save_button')}
                    </Dropdown.Toggle>

                    <Dropdown.Menu className="shadow">
                      <Dropdown.Header>{t('project_results.choose_inspection')}</Dropdown.Header>
                      {inspections.length > 0 ? (
                        inspections.map(inspection => (
                          <Dropdown.Item 
                            key={inspection.id}
                            onClick={() => handleSaveToInspection(image.url, image.detections || [], inspection.id)}
                          >
                            {inspection.inspectionObjective}
                          </Dropdown.Item>
                        ))
                      ) : (
                        <Dropdown.Item disabled>{t('project_results.no_inspections')}</Dropdown.Item>
                      )}
                    </Dropdown.Menu>
                  </Dropdown>
                  <Button
                    variant="outline-secondary"
                    onClick={() => handleDownloadImage(image.url, `processed-image-${index}.png`)}
                    title="Download"
                  >
                    <FaDownload />
                  </Button>
                </div>
                {saveStatus[image.url]?.error && (
                  <Alert variant="danger" className="mt-2 py-1 px-2 mb-0" style={{ fontSize: '0.75rem' }}>
                    {saveStatus[image.url]?.error}
                  </Alert>
                )}
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <Modal 
        show={!!expandedImage} 
        onHide={() => setExpandedImage(null)} 
        size="xl" 
        centered
        className="result-preview-modal"
      >
        <Modal.Header closeButton className="border-0">
          <Modal.Title>{t('project_results.title')} {expandedImage ? expandedImage.index + 1 : ''}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center p-0 pb-3">
          {expandedImage && (
            <img 
              src={expandedImage.url} 
              alt="Imagem Expandida" 
              className="img-fluid rounded-bottom"
              style={{ maxHeight: '80vh', objectFit: 'contain' }}
            />
          )}
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default ProjectResults;
