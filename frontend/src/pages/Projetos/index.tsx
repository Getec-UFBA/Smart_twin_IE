import React, { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Button, Modal, Form, Card, CloseButton, Stack, InputGroup, DropdownButton } from 'react-bootstrap';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import './style.css';

const API_URL = 'http://localhost:3001';

const generateYears = (startYear: number, endYear: number) => {
  const years = [];
  for (let i = endYear; i >= startYear; i--) {
    years.push(i);
  }
  return years;
};

const currentYear = new Date().getFullYear();
const yearsOptions = generateYears(1900, currentYear);

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
  const [selectedModules, setSelectedModules] = useState({ progress: false, security: false, maintenance: false });

  // Estados do formulário
  const [projectName, setProjectName] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState('');
  const [responsible, setResponsible] = useState('');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [bimModel, setBimModel] = useState<File | null>(null);
  const [modules, setModules] = useState({ progress: false, security: false, maintenance: false });
  const [hasOAE, setHasOAE] = useState(false);
  const [oaes, setOaes] = useState<{ name: string; file: File | null }[]>([]);
  // Novos estados para manutenção
  const [buildingAcronym, setBuildingAcronym] = useState(''); // Sigla/Código da edificação
  const [unitDirector, setUnitDirector] = useState(''); // Diretor(a) da unidade
  const [buildingYear, setBuildingYear] = useState('');
  const [builtArea, setBuiltArea] = useState('');
  const [facadeTypology, setFacadeTypology] = useState('');
  const [roofTypology, setRoofTypology] = useState('');
  
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

  const handleModuleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setSelectedModules(prev => ({ ...prev, [name]: checked }));
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

  const handleAddOAE = () => setOaes([...oaes, { name: '', file: null }]);
  const handleRemoveOAE = (index: number) => setOaes(oaes.filter((_, i) => i !== index));
  const handleOAEChange = (index: number, field: string, value: any) => {
    const newOaes = [...oaes];
    (newOaes[index] as any)[field] = value;
    setOaes(newOaes);
  };
  
  const resetForm = () => {
    setProjectName(''); setAddress(''); setType(''); setResponsible('');
    setCoverImage(null); setBimModel(null);
    setModules({ progress: false, security: false, maintenance: false });
    setHasOAE(false); setOaes([]); setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    
    const formData = new FormData();
    formData.append('name', projectName);
    formData.append('address', address);
    formData.append('type', type);
    formData.append('responsible', responsible);
    if (coverImage) formData.append('coverImage', coverImage);
    if (bimModel) formData.append('bimModel', bimModel);
    formData.append('modules', JSON.stringify(modules));
    
    if (modules.progress && hasOAE) {
      formData.append('oaeData', JSON.stringify(oaes.map(oae => ({ name: oae.name }))));
      oaes.forEach((oae) => {
        if (oae.file) formData.append(`oaeBimModel[]`, oae.file);
      });
    }

    try {
      const response = await api.post('/projects', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAllProjects([...allProjects, response.data]);
      setSuccess('Projeto criado com sucesso!');
      setShowCreateModal(false);
      resetForm();
    } catch (err: any) {
      console.error("Erro detalhado ao criar projeto:", err);
      if (err.response) {
        console.error("Dados do erro:", err.response.data);
        setError(`Erro ao criar o projeto: ${err.response.data.error || 'Acesso negado.'}`);
      } else {
        setError('Erro ao criar o projeto. Verifique a conexão com o servidor.');
      }
    }
  };

  const handleDeleteClick = (project: IProject) => {
    setProjectToDelete(project);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!projectToDelete) return;
    try {
      await api.delete(`/projects/${projectToDelete.id}`);
      setAllProjects(allProjects.filter(p => p.id !== projectToDelete.id));
      setSuccess('Projeto excluído com sucesso!');
    } catch (err) {
      setError('Erro ao excluir o projeto.');
    } finally {
      setShowDeleteModal(false);
      setProjectToDelete(null);
    }
  };

  return (
    <Container fluid className="my-5">
      <Row className="justify-content-between align-items-center mb-4">
        <Col>
          <h1 className="display-4">Meus Projetos</h1>
        </Col>
        <Col xs="auto">
          {user && user.role === 'admin' && (
            <Button variant="primary" onClick={() => { resetForm(); setShowCreateModal(true); }}>+ Criar Novo Projeto</Button>
          )}
        </Col>
      </Row>

      {success && <p className="success-message">{success}</p>}
      {error && <p className="error-message">{error}</p>}

      {/* Nova Barra de Filtros Centralizada */}
      <Row className="justify-content-center mb-4">
        <Col md={8}>
          <InputGroup className="mb-3">
            <Form.Control
              size="lg"
              placeholder="Buscar por Nome ou Responsável..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <DropdownButton
              variant="outline-secondary"
              title="Módulos"
              id="input-group-dropdown-2"
              align="end"
            >
              <div className="px-3 py-2">
                <Form.Check type="checkbox" label="Progresso" name="progress" checked={selectedModules.progress} onChange={handleModuleFilterChange} />
                <Form.Check type="checkbox" label="Segurança" name="security" checked={selectedModules.security} onChange={handleModuleFilterChange} />
                <Form.Check type="checkbox" label="Manutenção" name="maintenance" checked={selectedModules.maintenance} onChange={handleModuleFilterChange} />
              </div>
            </DropdownButton>
          </InputGroup>
        </Col>
      </Row>

      {/* Lista de Projetos */}
      <Row>
        {filteredProjects.length > 0 ? filteredProjects.map(project => (
          <Col lg={4} md={6} key={project.id} className="mb-4">
            <Card className="project-card h-100">
              <Card.Img variant="top" src={`${API_URL}/files/projects/${project.coverImageUrl}`} />
              <Card.Body className="d-flex flex-column">
                <Card.Title>{project.name}</Card.Title>
                <Card.Text className="text-muted">{project.responsible}</Card.Text>
                <Stack direction="horizontal" gap={2} className="mt-auto">
                  <Button variant="primary" size="sm" onClick={() => navigate(`/projetos/${project.id}`)}>Abrir Projeto</Button>
                  {user && user.role === 'admin' && (
                    <Button variant="outline-danger" size="sm" onClick={() => handleDeleteClick(project)}>Excluir</Button>
                  )}
                </Stack>
              </Card.Body>
            </Card>
          </Col>
        )) : (
          <Col className="text-center">
            <p>Nenhum projeto encontrado com os filtros selecionados.</p>
          </Col>
        )}
      </Row>

      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Criar Novo Projeto</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3"><Form.Label>Módulos de acompanhamento</Form.Label><div><Form.Check inline label="Progresso" checked={modules.progress} onChange={e => setModules({...modules, progress: e.target.checked})} /><Form.Check inline label="Segurança" checked={modules.security} onChange={e => setModules({...modules, security: e.target.checked})} /><Form.Check inline label="Manutenção" checked={modules.maintenance} onChange={e => setModules({...modules, maintenance: e.target.checked})} /></div></Form.Group>

            {modules.maintenance ? (
              <div key="maintenance-fields"> {/* Chave única para o bloco */}
                <h5 className="mt-4 mb-3">Cadastro Geral (Manutenção)</h5>
                <Form.Group className="mb-3"><Form.Label>Nome da edificação*</Form.Label><Form.Control type="text" value={projectName} onChange={e => setProjectName(e.target.value)} required /></Form.Group>
                <Form.Group className="mb-3"><Form.Label>Sigla/Código da edificação</Form.Label><Form.Control type="text" value={buildingAcronym} onChange={e => setBuildingAcronym(e.target.value)} /></Form.Group>
                <Form.Group className="mb-3"><Form.Label>Endereço</Form.Label><Form.Control type="text" value={address} onChange={e => setAddress(e.target.value)} /></Form.Group>
                <Form.Group className="mb-3"><Form.Label>Diretor(a) da unidade</Form.Label><Form.Control type="text" value={unitDirector} onChange={e => setUnitDirector(e.target.value)} /></Form.Group>
                <Form.Group className="mb-3"><Form.Label>Responsável pela manutenção da unidade*</Form.Label><Form.Control type="text" value={responsible} onChange={e => setResponsible(e.target.value)} required /></Form.Group>
                <Form.Group className="mb-3"><Form.Label>Foto do projeto (capa)*</Form.Label><Form.Control type="file" onChange={e => setCoverImage(e.target.files ? e.target.files[0] : null)} required /></Form.Group>
                <Form.Group className="mb-3"><Form.Label>Modelo BIM 3D ou 4D*</Form.Label><Form.Control type="file" onChange={e => setBimModel(e.target.files ? e.target.files[0] : null)} required /></Form.Group>

                <h5 className="mt-4 mb-3">Informações da Edificação (Manutenção)</h5>
                <Form.Group className="mb-3"><Form.Label>Ano construído</Form.Label><Form.Control type="number" value={buildingYear} onChange={e => setBuildingYear(e.target.value)} /></Form.Group>
                <Form.Group className="mb-3"><Form.Label>Área construída (m²)</Form.Label><Form.Control type="number" value={builtArea} onChange={e => setBuiltArea(e.target.value)} /></Form.Group>
                <Form.Group className="mb-3"><Form.Label>Tipologia da fachada</Form.Label><Form.Control type="text" value={facadeTypology} onChange={e => setFacadeTypology(e.target.value)} /></Form.Group>
                <Form.Group className="mb-3"><Form.Label>Tipologia da cobertura</Form.Label><Form.Control type="text" value={roofTypology} onChange={e => setRoofTypology(e.target.value)} /></Form.Group>
              </div>
            ) : (
              <div key="other-modules-fields"> {/* Chave única para o bloco */}
                <Form.Group className="mb-3"><Form.Label>Nome do Projeto*</Form.Label><Form.Control type="text" value={projectName} onChange={e => setProjectName(e.target.value)} required /></Form.Group>
                <Form.Group className="mb-3"><Form.Label>Endereço</Form.Label><Form.Control type="text" value={address} onChange={e => setAddress(e.target.value)} /></Form.Group>
                <Form.Group className="mb-3"><Form.Label>Tipo de obra*</Form.Label><Form.Control type="text" value={type} onChange={e => setType(e.target.value)} required /></Form.Group>
                <Form.Group className="mb-3"><Form.Label>Responsável técnico*</Form.Label><Form.Control type="text" value={responsible} onChange={e => setResponsible(e.target.value)} required /></Form.Group>
                <Form.Group className="mb-3"><Form.Label>Foto do projeto (capa)*</Form.Label><Form.Control type="file" onChange={e => setCoverImage(e.target.files ? e.target.files[0] : null)} required /></Form.Group>
                <Form.Group className="mb-3"><Form.Label>Modelo BIM 3D ou 4D*</Form.Label><Form.Control type="file" onChange={e => setBimModel(e.target.files ? e.target.files[0] : null)} required /></Form.Group>
                
                {modules.progress && (<Form.Group className="mb-3 oae-section"><Form.Label>Possui OAE (obra de arte especial)?</Form.Label><Form.Check type="switch" id="has-oae-switch" checked={hasOAE} onChange={e => setHasOAE(e.target.checked)} />{hasOAE && oaes.map((oae, index) => (<div key={index} className="oae-item"><CloseButton onClick={() => handleRemoveOAE(index)} /><Form.Control className="mb-2" placeholder="Nome da OAE" value={oae.name} onChange={e => handleOAEChange(index, 'name', e.target.value)} /><Form.Control type="file" onChange={e => handleOAEChange(index, 'file', e.target.files ? e.target.files[0] : null)} /></div>))}{hasOAE && <Button variant="secondary" size="sm" onClick={handleAddOAE} className="mt-2">Adicionar OAE</Button>}</Form.Group>)}
              </div>
            )}
            <Button variant="primary" type="submit">Salvar Projeto</Button>
          </Form>
        </Modal.Body>
      </Modal>

      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirmar Exclusão</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Você tem certeza que deseja excluir o projeto <strong>{projectToDelete?.name}</strong>? Esta ação não pode ser desfeita.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancelar</Button>
          <Button variant="danger" onClick={confirmDelete}>Excluir</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default Projetos;
