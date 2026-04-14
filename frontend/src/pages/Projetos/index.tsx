import React, { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Button, Modal, Form, Card, Stack } from 'react-bootstrap';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  FaSearch, FaTools, FaShieldAlt, FaChartLine, 
  FaFolderOpen, FaPlus, FaTrashAlt 
} from 'react-icons/fa';
import './style.css';

const API_URL = 'http://localhost:3001';

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

  // Estados do formulário (Simplificados para este exemplo de refatoração de UI)
  const [projectName, setProjectName] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState('');
  const [responsible, setResponsible] = useState('');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [bimModel, setBimModel] = useState<File | null>(null);
  const [modules, setModules] = useState({ progress: false, security: false, maintenance: false });
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      const searchMatch = searchTerm === '' ||
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.responsible.toLowerCase().includes(searchTerm.toLowerCase());

      const activeFilters = (Object.keys(selectedModules) as Array<keyof typeof selectedModules>).filter(key => selectedModules[key]);
      const moduleMatch = activeFilters.length === 0 || activeFilters.every(module => project.modules[module]);

      return searchMatch && moduleMatch;
    });
  }, [allProjects, searchTerm, selectedModules]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', projectName);
    formData.append('address', address);
    formData.append('type', type);
    formData.append('responsible', responsible);
    if (coverImage) formData.append('coverImage', coverImage);
    if (bimModel) formData.append('bimModel', bimModel);
    formData.append('modules', JSON.stringify(modules));

    try {
      const response = await api.post('/projects', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAllProjects([...allProjects, response.data]);
      setShowCreateModal(false);
    } catch (err) {
      setError('Erro ao criar o projeto.');
    }
  };

  const confirmDelete = async () => {
    if (!projectToDelete) return;
    try {
      await api.delete(`/projects/${projectToDelete.id}`);
      setAllProjects(allProjects.filter(p => p.id !== projectToDelete.id));
    } catch (err) {
      setError('Erro ao excluir o projeto.');
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
            <h1 className="page-header-title mb-0">Meus Projetos</h1>
            <p className="text-muted mt-2 mb-0">Gerencie e acompanhe o progresso de suas obras e manutenções.</p>
          </div>
          {user?.role === 'admin' && (
            <Button className="btn-primary d-flex align-items-center gap-2" onClick={() => setShowCreateModal(true)}>
              <FaPlus /> Novo Projeto
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
                  placeholder="Buscar projeto ou responsável..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </Col>
            <Col lg={7}>
              <div className="filter-pills justify-content-lg-end">
                <span className="small fw-bold text-muted me-2 align-self-center">FILTRAR POR:</span>
                <div 
                  className={`filter-pill ${selectedModules.maintenance ? 'active' : ''}`}
                  onClick={() => toggleModuleFilter('maintenance')}
                >
                  <FaTools className="me-2" /> Manutenção
                </div>
                <div 
                  className={`filter-pill ${selectedModules.progress ? 'active' : ''}`}
                  onClick={() => toggleModuleFilter('progress')}
                >
                  <FaChartLine className="me-2" /> Progresso
                </div>
                <div 
                  className={`filter-pill ${selectedModules.security ? 'active' : ''}`}
                  onClick={() => toggleModuleFilter('security')}
                >
                  <FaShieldAlt className="me-2" /> Segurança
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
                  <Card.Img variant="top" src={`${API_URL}/files/projects/${project.coverImageUrl}`} />
                  <div className="project-card-overlay">
                    {project.modules.maintenance && <div className="module-badge" title="Manutenção"><FaTools /></div>}
                    {project.modules.progress && <div className="module-badge" title="Progresso"><FaChartLine /></div>}
                    {project.modules.security && <div className="module-badge" title="Segurança"><FaShieldAlt /></div>}
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
                      Abrir Projeto
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
                <h4 className="fw-bold">Nenhum projeto encontrado</h4>
                <p>Tente ajustar seus filtros ou buscar por outro termo.</p>
                {searchTerm && (
                  <Button variant="link" className="text-success p-0" onClick={() => setSearchTerm('')}>
                    Limpar busca
                  </Button>
                )}
              </div>
            </Col>
          )}
        </Row>
      </Container>

      {/* MODAL CRIAR PROJETO (Estrutura mantida, apenas polimento visual) */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>Novo Projeto</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={12} className="mb-4">
                <Form.Label className="fw-bold">Módulos Ativos</Form.Label>
                <div className="d-flex gap-3">
                  <Form.Check type="switch" label="Progresso" checked={modules.progress} onChange={e => setModules({...modules, progress: e.target.checked})} />
                  <Form.Check type="switch" label="Segurança" checked={modules.security} onChange={e => setModules({...modules, security: e.target.checked})} />
                  <Form.Check type="switch" label="Manutenção" checked={modules.maintenance} onChange={e => setModules({...modules, maintenance: e.target.checked})} />
                </div>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3"><Form.Label>Nome do Projeto</Form.Label><Form.Control required value={projectName} onChange={e => setProjectName(e.target.value)} /></Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3"><Form.Label>Responsável</Form.Label><Form.Control required value={responsible} onChange={e => setResponsible(e.target.value)} /></Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group className="mb-3"><Form.Label>Endereço</Form.Label><Form.Control value={address} onChange={e => setAddress(e.target.value)} /></Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3"><Form.Label>Imagem de Capa</Form.Label><Form.Control type="file" required onChange={e => setCoverImage((e.target as any).files ? (e.target as any).files[0] : null)} /></Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3"><Form.Label>Modelo BIM</Form.Label><Form.Control type="file" onChange={e => setBimModel((e.target as any).files ? (e.target as any).files[0] : null)} /></Form.Group>
              </Col>
            </Row>
            <Button variant="primary" type="submit" className="w-100 mt-4">Criar Projeto</Button>
          </Form>
        </Modal.Body>
      </Modal>

      {/* MODAL EXCLUIR */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>Confirmar Exclusão</Modal.Title></Modal.Header>
        <Modal.Body>
          Deseja excluir permanentemente o projeto <strong>{projectToDelete?.name}</strong>?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowDeleteModal(false)}>Cancelar</Button>
          <Button variant="danger" onClick={confirmDelete}>Excluir Agora</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Projetos;
