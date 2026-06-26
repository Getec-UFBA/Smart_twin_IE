import React, { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Button, Modal, Form, Card, ProgressBar } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../../config/firebase';
import { 
  FaSearch, FaTools, FaShieldAlt, FaChartLine, 
  FaFolderOpen, FaPlus, FaTrashAlt 
} from 'react-icons/fa';
import './style.css';

interface IOAE {
  id: string;
  name: string;
  bimModelUrl: string;
}

interface IProject {
  id: string;
  name: string;
  responsible: string;
  coverImageUrl: string;
  modules: {
    progress: boolean;
    security: boolean;
    maintenance: boolean;
  };
  oae?: IOAE[];
}

const Projetos: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [allProjects, setAllProjects] = useState<IProject[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<IProject | null>(null);

  // Estados de Filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModules, setSelectedModules] = useState({ 
    progress: false, 
    security: false, 
    maintenance: false 
  });

  // Estados do formulário
  const [projectName, setProjectName] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState('');
  const [responsible, setResponsible] = useState('');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [bimModel, setBimModel] = useState<File | null>(null);
  const [modules, setModules] = useState({ progress: false, security: false, maintenance: false });
  const [buildingYear, setBuildingYear] = useState('');
  const [builtArea, setBuiltArea] = useState('');
  const [roofTypology, setRoofTypology] = useState('');
  
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await api.get('/projects');
        setAllProjects(response.data);
      } catch (err) {
        console.error("Erro ao buscar projetos:", err);
      }
    };
    fetchProjects();
  }, []);

  const toggleModuleFilter = (module: keyof typeof selectedModules) => {
    setSelectedModules(prev => ({ ...prev, [module]: !prev[module] }));
  };

  const filteredProjects = useMemo(() => {
    return allProjects.filter(project => {
      const name = project.name || '';
      const responsible = project.responsible || '';
      const searchMatch = searchTerm === '' ||
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        responsible.toLowerCase().includes(searchTerm.toLowerCase());

      const activeFilters = (Object.keys(selectedModules) as Array<keyof typeof selectedModules>).filter(key => selectedModules[key]);
      const moduleMatch = activeFilters.length === 0 || (project.modules && activeFilters.every(module => project.modules[module]));

      return searchMatch && moduleMatch;
    });
  }, [allProjects, searchTerm, selectedModules]);

  const uploadFile = (file: File, path: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        }, 
        (error) => reject(error), 
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            resolve(downloadURL);
          });
        }
      );
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coverImage) {
      setError("A imagem de capa é obrigatória.");
      return;
    }

    const allowedCoverExtensions = ['.jpg', '.jpeg', '.png'];
    const coverExtension = coverImage.name.slice(coverImage.name.lastIndexOf('.')).toLowerCase();
    if (!allowedCoverExtensions.includes(coverExtension)) {
      setError(t('projects.error_invalid_cover_format'));
      return;
    }

    if (bimModel) {
      const allowedExtensions = ['.rvt', '.ifc'];
      const fileExtension = bimModel.name.slice(bimModel.name.lastIndexOf('.')).toLowerCase();
      if (!allowedExtensions.includes(fileExtension)) {
        setError(t('projects.error_invalid_bim_format'));
        return;
      }
    }

    setIsUploading(true);
    setError('');

    try {
      const projectId = crypto.randomUUID(); // Geramos um ID temporário para o path do storage
      
      // 1. Upload da Capa
      const coverUrl = await uploadFile(coverImage, `projects/${projectId}/cover/${coverImage.name}`);
      
      // 2. Upload do Modelo BIM (Opcional)
      let bimUrl = '';
      if (bimModel) {
        bimUrl = await uploadFile(bimModel, `projects/${projectId}/bim/${bimModel.name}`);
      }

      // 3. Salva no Backend
      const response = await api.post('/projects', {
        name: projectName,
        address,
        type,
        responsible,
        coverImageUrl: coverUrl,
        bimModelUrl: bimUrl,
        modules: JSON.stringify(modules),
        oaeData: JSON.stringify([]),
        oaeBimModelUrls: [],
        buildingYear,
        builtArea,
        roofTypology
      });

      setAllProjects([...allProjects, response.data]);
      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      console.error(err);
      setError(t('projects.error_create'));
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const resetForm = () => {
    setProjectName('');
    setAddress('');
    setType('');
    setResponsible('');
    setCoverImage(null);
    setBimModel(null);
    setBuildingYear('');
    setBuiltArea('');
    setRoofTypology('');
    setModules({ progress: false, security: false, maintenance: false });
  };

  const confirmDelete = async () => {
    if (!projectToDelete) return;
    try {
      await api.delete(`/projects/${projectToDelete.id}`);
      setAllProjects(allProjects.filter(p => p.id !== projectToDelete.id));
    } catch (err) {
      setError(t('projects.error_delete'));
    } finally {
      setShowDeleteModal(false);
      setProjectToDelete(null);
    }
  };

  return (
    <div className="projects-container pt-5">
      <Container>
        <div className="d-flex justify-content-between align-items-end mb-5">
          <div>
            <h1 className="page-header-title mb-0">{t('projects.title')}</h1>
            <p className="text-muted mt-2 mb-0">{t('projects.subtitle')}</p>
          </div>
          {user?.role === 'admin' && (
            <Button className="btn-primary d-flex align-items-center gap-2" onClick={() => setShowCreateModal(true)}>
              <FaPlus /> {t('projects.new_project')}
            </Button>
          )}
        </div>

        {/* BARRA DE BUSCA E FILTROS */}
        <div className="search-filter-section">
          <Row className="align-items-center">
            <Col lg={5} className="mb-3 mb-lg-0">
              <div className="position-relative">
                <div className="search-icon-wrapper">
                  <FaSearch />
                </div>
                <Form.Control
                  className="modern-search-input"
                  placeholder={t('projects.search_placeholder')}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </Col>
            <Col lg={7}>
              <div className="filter-pills justify-content-lg-end">
                <span className="small fw-bold text-muted me-2 align-self-center">{t('projects.filter_by')}</span>
                <div 
                  className={`filter-pill ${selectedModules.maintenance ? 'active' : ''}`}
                  onClick={() => toggleModuleFilter('maintenance')}
                >
                  <FaTools className="me-2" /> {t('projects.maintenance')}
                </div>
                <div 
                  className={`filter-pill ${selectedModules.progress ? 'active' : ''}`}
                  onClick={() => toggleModuleFilter('progress')}
                >
                  <FaChartLine className="me-2" /> {t('projects.progress')}
                </div>
                <div 
                  className={`filter-pill ${selectedModules.security ? 'active' : ''}`}
                  onClick={() => toggleModuleFilter('security')}
                >
                  <FaShieldAlt className="me-2" /> {t('projects.security')}
                </div>
              </div>
            </Col>
          </Row>
        </div>

        {/* LISTA DE PROJETOS */}
        <Row className="g-4">
          {filteredProjects.length > 0 ? filteredProjects.map(project => (
            <Col lg={4} md={6} key={project.id}>
              <Card className="project-card">
                <div className="project-card-img-wrapper">
                  <Card.Img variant="top" src={project.coverImageUrl} />
                  <div className="project-card-overlay">
                    {project.modules.maintenance && <div className="module-badge" title={t('projects.maintenance')}><FaTools /></div>}
                    {project.modules.progress && <div className="module-badge" title={t('projects.progress')}><FaChartLine /></div>}
                    {project.modules.security && <div className="module-badge" title={t('projects.security')}><FaShieldAlt /></div>}
                  </div>
                </div>
                <Card.Body>
                  <Card.Title className="text-truncate">{project.name}</Card.Title>
                  <Card.Text className="text-muted small mb-4">{project.responsible}</Card.Text>
                  <div className="d-flex gap-2 mt-auto">
                    <Button 
                      variant="primary" 
                      className="flex-grow-1"
                      onClick={() => navigate(`/projetos/${project.id}`)}
                    >
                      {t('projects.open_project')}
                    </Button>
                    {user?.role === 'admin' && (
                      <Button 
                        variant="outline-danger" 
                        onClick={() => {
                          setProjectToDelete(project);
                          setShowDeleteModal(true);
                        }}
                      >
                        <FaTrashAlt />
                      </Button>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          )) : (
            <Col xs={12}>
              <div className="empty-state-card">
                <FaFolderOpen className="empty-state-icon" />
                <h4 className="fw-bold">{t('projects.empty_state_title')}</h4>
                <p>{t('projects.empty_state_subtitle')}</p>
                {searchTerm && (
                  <Button variant="link" className="text-success p-0" onClick={() => setSearchTerm('')}>
                    {t('projects.clear_search')}
                  </Button>
                )}
              </div>
            </Col>
          )}
        </Row>
      </Container>

      {/* MODAL CRIAR PROJETO */}
      <Modal show={showCreateModal} onHide={() => !isUploading && setShowCreateModal(false)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>{t('projects.modal_create_title')}</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Row>
              {isUploading && (
                <Col md={12} className="mb-4">
                  <Form.Label>Fazendo upload dos arquivos ({Math.round(uploadProgress)}%)...</Form.Label>
                  <ProgressBar animated now={uploadProgress} />
                </Col>
              )}
              <Col md={12} className="mb-4">
                <Form.Label className="fw-bold">{t('projects.modal_active_modules')}</Form.Label>
                <div className="d-flex gap-3">
                  <Form.Check type="switch" label={t('projects.progress')} checked={modules.progress} onChange={e => setModules({...modules, progress: e.target.checked})} />
                  <Form.Check type="switch" label={t('projects.security')} checked={modules.security} onChange={e => setModules({...modules, security: e.target.checked})} />
                  <Form.Check type="switch" label={t('projects.maintenance')} checked={modules.maintenance} onChange={e => setModules({...modules, maintenance: e.target.checked})} />
                </div>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3"><Form.Label>{t('projects.modal_project_name')}</Form.Label><Form.Control required value={projectName} onChange={e => setProjectName(e.target.value)} disabled={isUploading} /></Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3"><Form.Label>{t('projects.modal_responsible')}</Form.Label><Form.Control required value={responsible} onChange={e => setResponsible(e.target.value)} disabled={isUploading} /></Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group className="mb-3"><Form.Label>{t('projects.modal_address')}</Form.Label><Form.Control value={address} onChange={e => setAddress(e.target.value)} disabled={isUploading} /></Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>{t('projects.modal_cover_image')}</Form.Label>
                  <Form.Control 
                    type="file" 
                    required 
                    accept="image/png, image/jpeg, image/jpg"
                    onChange={e => setCoverImage((e.target as any).files ? (e.target as any).files[0] : null)} 
                    disabled={isUploading} 
                  />
                  <Form.Text className="text-muted d-block mt-1">
                    {t('projects.modal_cover_image_help')}
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>{t('projects.modal_bim_model')}</Form.Label>
                  <Form.Control 
                    type="file" 
                    accept=".rvt,.ifc"
                    onChange={e => setBimModel((e.target as any).files ? (e.target as any).files[0] : null)} 
                    disabled={isUploading} 
                  />
                  <Form.Text className="text-muted d-block mt-1">
                    {t('projects.modal_bim_model_help')}
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>{t('projects.modal_building_year')}</Form.Label>
                  <Form.Control 
                    type="text" 
                    placeholder="Ex: 2020" 
                    value={buildingYear} 
                    onChange={e => setBuildingYear(e.target.value)} 
                    disabled={isUploading} 
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>{t('projects.modal_built_area')}</Form.Label>
                  <Form.Control 
                    type="text" 
                    placeholder="Ex: 150" 
                    value={builtArea} 
                    onChange={e => setBuiltArea(e.target.value)} 
                    disabled={isUploading} 
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>{t('projects.modal_roof_typology')}</Form.Label>
                  <Form.Select 
                    value={roofTypology} 
                    onChange={e => setRoofTypology(e.target.value)} 
                    disabled={isUploading}
                  >
                    <option value="">{t('projects.modal_select_roof')}</option>
                    <option value="Fibrocimento">Fibrocimento</option>
                    <option value="Cerâmico">Cerâmico</option>
                    <option value="Concreto">Concreto</option>
                    <option value="Metálico">Metálico</option>
                    <option value="misto">misto</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            {error && <p className="text-danger mt-2">{error}</p>}
            <Button variant="primary" type="submit" className="w-100 mt-4" disabled={isUploading}>
              {isUploading ? "Processando..." : t('projects.modal_create_button')}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>

      {/* MODAL EXCLUIR */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>{t('projects.modal_delete_title')}</Modal.Title></Modal.Header>
        <Modal.Body>
          {t('projects.modal_delete_message', { name: projectToDelete?.name })}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowDeleteModal(false)}>{t('projects.modal_delete_cancel')}</Button>
          <Button variant="danger" onClick={confirmDelete}>{t('projects.modal_delete_confirm')}</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Projetos;
