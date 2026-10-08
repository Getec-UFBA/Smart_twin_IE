import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Container, Row, Col, Card, Button, Form, Modal, Badge } from 'react-bootstrap';
import { 
  FaBook, 
  FaFolder, 
  FaImages, 
  FaPlus, 
  FaSearch, 
  FaMapMarkerAlt, 
  FaUser, 
  FaInfoCircle, 
  FaCalendarAlt,
  FaEdit,
  FaTrashAlt
} from 'react-icons/fa';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../config/firebase';
import type { IProject } from '../../models/IProject';
import EditLibraryProjectModal from '../../components/EditLibraryProjectModal';
import './style.css';

const Biblioteca: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<IProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Estados para edição e exclusão de projeto
  const [editingProject, setEditingProject] = useState<IProject | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<IProject | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Formulário de novo projeto
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState('Edifício');
  const [responsible, setResponsible] = useState(user?.name || '');
  const [buildingAcronym, setBuildingAcronym] = useState('');
  const [unitDirector, setUnitDirector] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const [buildingYear, setBuildingYear] = useState('');
  const [builtArea, setBuiltArea] = useState('');
  const [facadeTypology, setFacadeTypology] = useState('');
  const [roofTypology, setRoofTypology] = useState('');
  const [customFacade, setCustomFacade] = useState(false);
  const [customRoof, setCustomRoof] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const response = await api.get('/projects');
      setProjects(response.data);
    } catch (err) {
      console.error('Erro ao buscar projetos para a biblioteca:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    } else {
      setCoverFile(null);
      setCoverPreview(null);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let uploadedCoverUrl = '';
      if (coverFile) {
        const sanitizedName = coverFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `library/covers/${Date.now()}_${sanitizedName}`;
        const storageRef = ref(storage, storagePath);
        const snapshot = await uploadBytes(storageRef, coverFile);
        uploadedCoverUrl = await getDownloadURL(snapshot.ref);
      }

      const defaultFallback = 'https://images.unsplash.com/photo-1541888946425-d0fbb1861564?auto=format&fit=crop&w=800&q=80';

      const payload = {
        name,
        address,
        type,
        responsible: responsible || user?.name || 'Responsável',
        buildingAcronym,
        unitDirector,
        coverImageUrl: uploadedCoverUrl || defaultFallback,
        modules: { progress: true, security: true, maintenance: true },
        bimModelUrl: '',
        inspections: [],
        buildingYear,
        builtArea,
        facadeTypology,
        roofTypology,
        onlyLibrary: true
      };

      const response = await api.post('/projects', payload);
      setShowCreateModal(false);
      setName('');
      setAddress('');
      setResponsible(user?.name || '');
      setBuildingAcronym('');
      setUnitDirector('');
      setCoverFile(null);
      setCoverPreview(null);
      if (coverFileInputRef.current) coverFileInputRef.current.value = '';
      setBuildingYear('');
      setBuiltArea('');
      setFacadeTypology('');
      setRoofTypology('');
      setCustomFacade(false);
      setCustomRoof(false);
      fetchProjects();
      navigate(`/biblioteca/${response.data.id}`);
    } catch (err) {
      console.error('Erro ao criar projeto:', err);
      alert('Erro ao criar projeto.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/projects/${projectToDelete.id}`);
      setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
      setShowDeleteModal(false);
      setProjectToDelete(null);
    } catch (err) {
      console.error('Erro ao excluir edificação:', err);
      alert('Erro ao excluir a edificação.');
    } finally {
      setDeleting(false);
    }
  };

  // Filtros
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesSearch = !searchTerm || 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.responsible?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = !typeFilter || p.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [projects, searchTerm, typeFilter]);

  // Estatísticas da biblioteca
  const stats = useMemo(() => {
    let totalInspections = 0;
    let totalPhotos = 0;

    projects.forEach(p => {
      const inspList = p.inspections || [];
      totalInspections += inspList.length;
      inspList.forEach(i => {
        totalPhotos += i.images?.length || 0;
      });
    });

    return {
      totalProjects: projects.length,
      totalInspections,
      totalPhotos
    };
  }, [projects]);

  const uniqueTypes = useMemo(() => {
    const setTypes = new Set<string>();
    projects.forEach(p => { if (p.type) setTypes.add(p.type); });
    return Array.from(setTypes);
  }, [projects]);

  return (
    <div className="biblioteca-container animate-fade-in">
      <Container>
        {/* HEADER DA BIBLIOTECA */}
        <div className="biblioteca-header mb-4">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
            <div>
              <div className="d-flex align-items-center gap-2">
                <FaBook className="fs-2" style={{ color: '#10b981' }} />
                <h1 className="mb-0 fw-bold">{t('library.title', 'Biblioteca')}</h1>
              </div>
              <p className="text-muted mt-1 mb-0">
                {t('library.subtitle', 'Repositório de imagens e documentos para inspeções e edificações')}
              </p>
            </div>

            <Button 
              variant="primary" 
              className="d-flex align-items-center gap-2"
              onClick={() => setShowCreateModal(true)}
            >
              <FaPlus /> Novo Projeto na Biblioteca
            </Button>
          </div>
        </div>

        {/* STATS CARDS */}
        <div className="biblioteca-stats-grid mb-4">
          <div className="bib-stat-card">
            <div className="bib-stat-icon projects"><FaFolder style={{ color: '#10b981' }} /></div>
            <div>
              <span className="bib-stat-label">Total de Projetos</span>
              <h3 className="bib-stat-val">{stats.totalProjects}</h3>
            </div>
          </div>

          <div className="bib-stat-card">
            <div className="bib-stat-icon inspections"><FaCalendarAlt style={{ color: '#10b981' }} /></div>
            <div>
              <span className="bib-stat-label">Total de Inspeções</span>
              <h3 className="bib-stat-val">{stats.totalInspections}</h3>
            </div>
          </div>

          <div className="bib-stat-card">
            <div className="bib-stat-icon photos"><FaImages style={{ color: '#10b981' }} /></div>
            <div>
              <span className="bib-stat-label">Total de Fotos</span>
              <h3 className="bib-stat-val">{stats.totalPhotos}</h3>
            </div>
          </div>
        </div>

        {/* BANNER INFORMATIVO */}
        <div className="bib-info-banner mb-4">
          <FaInfoCircle className="info-icon" style={{ color: '#10b981' }} />
          <span>
            {t('library.banner_info', 'Nesta aba não há detecção com IA ou plano de ação. Utilize para armazenar e consultar imagens, projetos CAD/BIM e levantamentos fotogramétricos.')}
          </span>
        </div>

        {/* BARRA DE PESQUISA E FILTROS */}
        <div className="bib-search-card mb-4">
          <Row className="g-3 align-items-center">
            <Col lg={7}>
              <div className="search-input-wrapper">
                <FaSearch className="search-icon" style={{ color: '#10b981' }} />
                <input 
                  type="text" 
                  placeholder={t('library.search_projects', 'Buscar projetos na biblioteca por nome, endereço ou responsável...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </Col>
            <Col lg={5}>
              <div className="d-flex gap-2">
                <Form.Select 
                  value={typeFilter} 
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bib-type-select"
                >
                  <option value="">Todos os Tipos</option>
                  {uniqueTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Form.Select>
              </div>
            </Col>
          </Row>
        </div>

        {/* GRID DE PROJETOS NA BIBLIOTECA */}
        {loading ? (
          <div className="bib-loading">
            <div className="spinner-border text-success" role="status"></div>
            <p>Carregando projetos da biblioteca...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="bib-empty-state">
            <FaBook className="empty-icon" style={{ color: '#10b981' }} />
            <h4>Nenhum projeto encontrado</h4>
            <p className="text-muted">Crie um novo projeto ou ajuste os termos da busca.</p>
          </div>
        ) : (
          <Row className="g-4">
            {filteredProjects.map((project) => {
              const allInspections = project.inspections || [];
              const allPhotosCount = allInspections.reduce((acc, i) => acc + (i.images?.length || 0), 0);

              return (
                <Col key={project.id} xs={12} md={6} lg={4}>
                  <Card className="bib-project-card h-100" onClick={() => navigate(`/biblioteca/${project.id}`)}>
                    <div className="bib-card-img-wrapper">
                      <Card.Img 
                        variant="top" 
                        src={project.coverImageUrl || 'https://images.unsplash.com/photo-1541888946425-d0fbb1861564?auto=format&fit=crop&w=800&q=80'} 
                        alt={project.name} 
                      />
                      <Badge bg="dark" className="bib-type-badge">
                        {project.type}
                      </Badge>
                    </div>

                    <Card.Body className="d-flex flex-direction-column flex-column justify-content-between">
                      <div>
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <h4 className="bib-project-title mb-0">{project.name}</h4>
                          {project.buildingAcronym && (
                            <Badge bg="light" text="dark" className="border ms-2">
                              {project.buildingAcronym}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="bib-project-meta mb-3">
                          <div className="meta-row">
                            <FaMapMarkerAlt className="meta-icon" style={{ color: '#10b981' }} />
                            <span className="truncate">{project.address || 'Endereço não informado'}</span>
                          </div>
                          <div className="meta-row">
                            <FaUser className="meta-icon" style={{ color: '#10b981' }} />
                            <span className="truncate">{project.responsible || 'Responsável'}</span>
                          </div>
                          {project.unitDirector && (
                            <div className="meta-row">
                              <span className="small text-muted fw-semibold">Direção:</span>
                              <span className="truncate">{project.unitDirector}</span>
                            </div>
                          )}
                        </div>

                        {(project.buildingYear || project.builtArea || project.facadeTypology || project.roofTypology) && (
                          <div className="d-flex flex-wrap gap-1 mb-3">
                            {project.buildingYear && (
                              <span className="badge bg-light text-secondary border small fw-normal">
                                Ano: {project.buildingYear}
                              </span>
                            )}
                            {project.builtArea && (
                              <span className="badge bg-light text-secondary border small fw-normal">
                                {project.builtArea} m²
                              </span>
                            )}
                            {project.facadeTypology && (
                              <span className="badge bg-light text-secondary border small fw-normal">
                                Fachada: {project.facadeTypology}
                              </span>
                            )}
                            {project.roofTypology && (
                              <span className="badge bg-light text-secondary border small fw-normal">
                                Telhado: {project.roofTypology}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="bib-card-counters mb-3">
                          <span className="bib-counter-pill">
                            <FaFolder className="me-1" style={{ color: '#10b981' }} /> {allInspections.length} {allInspections.length === 1 ? 'Inspeção' : 'Inspeções'}
                          </span>
                          <span className="bib-counter-pill">
                            <FaImages className="me-1" style={{ color: '#10b981' }} /> {allPhotosCount} {allPhotosCount === 1 ? 'Foto' : 'Fotos'}
                          </span>
                        </div>

                        <div className="d-flex gap-2">
                          <Button 
                            variant="primary" 
                            className="flex-grow-1 d-flex align-items-center justify-content-center gap-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/biblioteca/${project.id}`);
                            }}
                          >
                            <FaFolder /> {t('library.open_project', 'Abrir Edificação')}
                          </Button>
                          <Button 
                            variant="outline-secondary" 
                            className="d-flex align-items-center justify-content-center px-3"
                            title="Editar Informações da Edificação"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProject(project);
                              setShowEditModal(true);
                            }}
                          >
                            <FaEdit />
                          </Button>
                          <Button 
                            variant="outline-danger" 
                            className="d-flex align-items-center justify-content-center px-3"
                            title="Excluir Edificação"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProjectToDelete(project);
                              setShowDeleteModal(true);
                            }}
                          >
                            <FaTrashAlt />
                          </Button>
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}

        {/* MODAL DE CRIAÇÃO DE PROJETO */}
        <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} centered size="lg">
          <Form onSubmit={handleCreateProject}>
            <Modal.Header closeButton>
              <Modal.Title className="fw-bold">
                <FaFolder className="me-2" style={{ color: '#10b981' }} /> Criar Projeto para Biblioteca
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Row>
                <Col md={8}>
                  <Form.Group className="mb-3">
                    <Form.Label>Nome do Projeto / Edificação *</Form.Label>
                    <Form.Control 
                      type="text" 
                      placeholder="Ex: Pavilhão de Aulas da Federação" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      required 
                    />
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Sigla da Edificação <span className="text-muted fw-normal small">(opcional)</span></Form.Label>
                    <Form.Control 
                      type="text" 
                      placeholder="Ex: PAF I" 
                      value={buildingAcronym} 
                      onChange={(e) => setBuildingAcronym(e.target.value)} 
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={8}>
                  <Form.Group className="mb-3">
                    <Form.Label>Endereço / Localização *</Form.Label>
                    <Form.Control 
                      type="text" 
                      placeholder="Ex: Rua Aristides Novis, 02 - Federação" 
                      value={address} 
                      onChange={(e) => setAddress(e.target.value)} 
                      required 
                    />
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Diretor / Unidade <span className="text-muted fw-normal small">(opcional)</span></Form.Label>
                    <Form.Control 
                      type="text" 
                      placeholder="Ex: Prof. Dr. Silva" 
                      value={unitDirector} 
                      onChange={(e) => setUnitDirector(e.target.value)} 
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Geral</Form.Label>
                    <Form.Select value={type} onChange={(e) => setType(e.target.value)}>
                      <option value="Edifício">Edifício</option>
                      <option value="Residencial">Residencial</option>
                      <option value="Comercial">Comercial</option>
                      <option value="Institucional">Institucional</option>
                      <option value="Industrial">Industrial</option>
                      <option value="Ponte / Viaduto">Ponte / Viaduto</option>
                      <option value="Passarela / Túnel">Passarela / Túnel</option>
                      <option value="Outro">Outro</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Responsável Técnico</Form.Label>
                    <Form.Control 
                      type="text" 
                      placeholder="Nome do Engenheiro / Inspetor" 
                      value={responsible} 
                      onChange={(e) => setResponsible(e.target.value)} 
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Ano Construído <span className="text-muted fw-normal small">(opcional)</span></Form.Label>
                    <Form.Control 
                      type="text" 
                      placeholder="Ex: 2018" 
                      value={buildingYear} 
                      onChange={(e) => setBuildingYear(e.target.value)} 
                    />
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Área Quadrada (m²) <span className="text-muted fw-normal small">(opcional)</span></Form.Label>
                    <Form.Control 
                      type="text" 
                      placeholder="Ex: 1500" 
                      value={builtArea} 
                      onChange={(e) => setBuiltArea(e.target.value)} 
                    />
                  </Form.Group>
                </Col>
              </Row>

              {/* SEÇÃO DE SISTEMAS (FACHADA, TELHADO E COBERTURA) */}
              <div className="border-top pt-3 mt-2 mb-2">
                <h6 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: '#10b981' }}>
                  Sistemas
                </h6>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Fachada <span className="text-muted fw-normal small">(opcional)</span></Form.Label>
                      <Form.Select 
                        value={['Argamassa / Pintura', 'Pastilha', 'Cerâmica', 'Concreto Aparente', 'Vidro / Pele de Vidro', 'Metálica / ACM', 'Mista', ''].includes(facadeTypology) && !customFacade ? facadeTypology : 'Outro'} 
                        onChange={(e) => {
                          if (e.target.value === 'Outro') {
                            setCustomFacade(true);
                            setFacadeTypology('');
                          } else {
                            setCustomFacade(false);
                            setFacadeTypology(e.target.value);
                          }
                        }}
                      >
                        <option value="">Selecione a tipologia de fachada...</option>
                        <option value="Argamassa / Pintura">Argamassa / Pintura</option>
                        <option value="Pastilha">Pastilha</option>
                        <option value="Cerâmica">Cerâmica</option>
                        <option value="Concreto Aparente">Concreto Aparente</option>
                        <option value="Vidro / Pele de Vidro">Vidro / Pele de Vidro</option>
                        <option value="Metálica / ACM">Metálica / ACM</option>
                        <option value="Mista">Mista</option>
                        <option value="Outro">Outro (especificar)</option>
                      </Form.Select>
                      {customFacade && (
                        <Form.Control
                          type="text"
                          className="mt-2"
                          placeholder="Digite a tipologia de fachada"
                          value={facadeTypology}
                          onChange={(e) => setFacadeTypology(e.target.value)}
                          autoFocus
                        />
                      )}
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Telhado e Cobertura <span className="text-muted fw-normal small">(opcional)</span></Form.Label>
                      <Form.Select 
                        value={['Fibrocimento', 'Cerâmico', 'Concreto', 'Metálico', 'Misto', ''].includes(roofTypology) && !customRoof ? roofTypology : 'Outro'} 
                        onChange={(e) => {
                          if (e.target.value === 'Outro') {
                            setCustomRoof(true);
                            setRoofTypology('');
                          } else {
                            setCustomRoof(false);
                            setRoofTypology(e.target.value);
                          }
                        }}
                      >
                        <option value="">Selecione a tipologia de telhado/cobertura...</option>
                        <option value="Fibrocimento">Fibrocimento</option>
                        <option value="Cerâmico">Cerâmico / Telha Cerâmica</option>
                        <option value="Concreto">Concreto / Laje</option>
                        <option value="Metálico">Metálico / Telha Metálica</option>
                        <option value="Misto">Misto</option>
                        <option value="Outro">Outro (especificar)</option>
                      </Form.Select>
                      {customRoof && (
                        <Form.Control
                          type="text"
                          className="mt-2"
                          placeholder="Digite a tipologia de telhado/cobertura"
                          value={roofTypology}
                          onChange={(e) => setRoofTypology(e.target.value)}
                          autoFocus
                        />
                      )}
                    </Form.Group>
                  </Col>
                </Row>
              </div>

              {/* UPLOAD DA IMAGEM DE CAPA */}
              <div className="border-top pt-3 mt-2">
                <Form.Group className="mb-3">
                  <Form.Label>Imagem de Capa <span className="text-muted fw-normal small">(opcional)</span></Form.Label>
                  <Form.Control 
                    type="file" 
                    accept="image/*"
                    ref={coverFileInputRef}
                    onChange={handleCoverFileChange} 
                  />
                  <Form.Text className="text-muted small">
                    Faça o upload de uma imagem do seu computador para a capa da edificação
                  </Form.Text>
                  {coverPreview && (
                    <div className="mt-2 position-relative d-inline-block">
                      <img 
                        src={coverPreview} 
                        alt="Prévia da capa" 
                        style={{ maxHeight: '140px', maxWidth: '100%', borderRadius: '8px', objectFit: 'cover' }} 
                        className="border shadow-sm"
                      />
                      <Button 
                        variant="danger" 
                        size="sm" 
                        className="position-absolute top-0 end-0 m-1 p-0 d-flex align-items-center justify-content-center"
                        style={{ width: '22px', height: '22px', borderRadius: '50%' }}
                        onClick={() => {
                          setCoverFile(null);
                          setCoverPreview(null);
                          if (coverFileInputRef.current) coverFileInputRef.current.value = '';
                        }}
                        title="Remover imagem"
                      >
                        &times;
                      </Button>
                    </div>
                  )}
                </Form.Group>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" disabled={submitting}>
                {submitting ? 'Criando...' : 'Criar Projeto'}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* MODAL DE EDIÇÃO DE PROJETO */}
        <EditLibraryProjectModal
          show={showEditModal}
          onHide={() => {
            setShowEditModal(false);
            setEditingProject(null);
          }}
          project={editingProject}
          onSuccess={(updatedProject) => {
            setProjects(prev => prev.map(p => p.id === updatedProject.id ? { ...p, ...updatedProject } : p));
          }}
        />

        {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
        <Modal show={showDeleteModal} onHide={() => !deleting && setShowDeleteModal(false)} centered size="sm">
          <Modal.Header closeButton>
            <Modal.Title className="fs-6 fw-bold text-danger">Excluir Edificação</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            Tem certeza que deseja excluir a edificação <strong>{projectToDelete?.name}</strong>?
            Esta ação removerá todos os dados, inspeções e arquivos vinculados.
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" size="sm" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </div>
  );
};

export default Biblioteca;
