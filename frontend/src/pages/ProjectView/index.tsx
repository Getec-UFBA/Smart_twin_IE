import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Row, Col, Card, Button, Form, Modal, Alert, Badge, ProgressBar } from 'react-bootstrap';
import './style.css';
import path from 'path-browserify';
import { 
  FaCog, FaPencilAlt, FaTrash, FaUpload, FaDownload, 
  FaClipboardList, FaProjectDiagram, FaMapMarkedAlt, 
  FaImages, FaChartLine, FaPlus, FaCloudUploadAlt, FaFolderOpen, FaTools,
  FaChevronLeft, FaChevronRight 
} from 'react-icons/fa';
import type { IProject, IInspection, IImage, IOrthoResult } from '../../models/IProject';

const ProjectView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<IProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processingType, setProcessingType] = useState<'images' | 'ortho'>('images');
  
  // Controle de Progresso
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  // Controle de Visualização
  const [activeInspection, setActiveInspection] = useState<IInspection | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  const [newInspectionObjective, setNewInspectionObjective] = useState('');
  const [inspectionType, setInspectionType] = useState('Preventiva');
  const [inspectionDate, setInspectionDate] = useState('');
  const [inspectionResponsible, setInspectionResponsible] = useState('');
  const [showCreateInspectionModal, setShowCreateInspectionModal] = useState(false);
  
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<IProject>>({});
  
  // Navegação de Imagens Expandidas
  const [expandedImageIndex, setExpandedImageIndex] = useState<number | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      const response = await api.get(`/projects/${id}`);
      const data = response.data;
      setProject(data);
      
      if (activeInspection) {
        const updated = data.inspections?.find((i: IInspection) => i.id === activeInspection.id);
        if (updated) setActiveInspection(updated);
      }
    } catch (err) {
      setError('Erro ao carregar o projeto.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, activeInspection]);

  useEffect(() => {
    if (id) fetchProject();
  }, [id]);

  // Navegação por teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (expandedImageIndex === null) return;
      if (e.key === 'ArrowRight') handleNextImage();
      if (e.key === 'ArrowLeft') handlePrevImage();
      if (e.key === 'Escape') setExpandedImageIndex(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedImageIndex, activeInspection]);

  const handleNextImage = () => {
    if (activeInspection && expandedImageIndex !== null) {
      const nextIndex = (expandedImageIndex + 1) % activeInspection.images.length;
      setExpandedImageIndex(nextIndex);
    }
  };

  const handlePrevImage = () => {
    if (activeInspection && expandedImageIndex !== null) {
      const prevIndex = (expandedImageIndex - 1 + activeInspection.images.length) % activeInspection.images.length;
      setExpandedImageIndex(prevIndex);
    }
  };

  const openEditModal = () => {
    if (project) {
      setEditFormData({
        name: project.name,
        address: project.address,
        type: project.type,
        responsible: project.responsible,
      });
      setShowEditModal(true);
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    try {
      await api.put(`/projects/${project.id}`, editFormData);
      setShowEditModal(false);
      fetchProject();
    } catch (err) {
      alert('Erro ao atualizar projeto.');
    }
  };

  const handleCreateInspection = async () => {
    if (!project) return;
    try {
      await api.post(`/projects/${project.id}/inspections`, {
        inspectionType,
        inspectionObjective: newInspectionObjective,
        inspectionDate,
        inspectionResponsible,
      });
      setShowCreateInspectionModal(false);
      fetchProject();
    } catch (err) {
      alert('Erro ao criar inspeção.');
    }
  };

  const handleDeleteInspection = async (inspectionId: string) => {
    if (!project || !window.confirm('Excluir esta inspeção permanentemente?')) return;
    try {
      await api.delete(`/projects/${project.id}/inspections/${inspectionId}`);
      if (activeInspection?.id === inspectionId) setActiveInspection(null);
      fetchProject();
    } catch (err) {
      alert('Erro ao excluir inspeção.');
    }
  };

  const startFakeProgress = (startFrom: number, max: number, speed: number) => {
    if (progressInterval.current) clearInterval(progressInterval.current);
    let current = startFrom;
    progressInterval.current = setInterval(() => {
      current += (max - current) * 0.1;
      setProgress(Math.round(current));
      if (current >= max - 1) {
        if (progressInterval.current) clearInterval(progressInterval.current);
      }
    }, speed);
  };

  const handleProcess = async () => {
    if (selectedFiles.length === 0 || !project || !activeInspection) return;
    setProcessing(true);
    setProgress(0);
    setProgressStatus('Iniciando transferência...');
    
    const formData = new FormData();
    try {
      const config = {
        onUploadProgress: (progressEvent: any) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percentCompleted * 0.4); 
          if (percentCompleted === 100) {
            setProgressStatus('IA processando (pode demorar)...');
            startFakeProgress(40, 98, 1500);
          } else {
            setProgressStatus(`Enviando arquivos: ${percentCompleted}%`);
          }
        }
      };

      if (processingType === 'images') {
        selectedFiles.forEach(file => formData.append('images', file));
        formData.append('inspectionId', activeInspection.id);
        const response = await api.post('/projects/process-images', formData, config);
        setProgress(100);
        setProgressStatus('Finalizado! Redirecionando...');
        setTimeout(() => {
          setShowUploadModal(false);
          fetchProject();
          setProcessing(false);
          setProgress(0);
        }, 1500);
      } else {
        formData.append('ortho', selectedFiles[0]);
        formData.append('projectId', project.id);
        formData.append('inspectionId', activeInspection.id);
        await api.post('/projects/process-ortho', formData, { ...config, timeout: 0 });
        setProgress(100);
        setProgressStatus('Ortomosaico processado com sucesso!');
        setTimeout(() => {
          setShowUploadModal(false);
          fetchProject();
          setProcessing(false);
          setProgress(0);
        }, 1500);
      }
    } catch (err) {
      alert('Erro no processamento.');
      setProcessing(false);
      setProgress(0);
    } finally {
      if (progressInterval.current) clearInterval(progressInterval.current);
    }
  };

  const handleGenerateInspectionPdfReport = async (inspectionId: string) => {
    if (!project) return;
    setIsGeneratingReport(true);
    try {
      const response = await api.get(`/projects/${project.id}/report/pdf/inspections/${inspectionId}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio-${inspectionId}.pdf`;
      link.click();
    } catch (err) {
      alert('Erro ao gerar relatório.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  if (loading) return <div className="p-4">Carregando Centro de Comando...</div>;
  if (!project) return <div className="p-4">Projeto não encontrado.</div>;

  return (
    <div className="project-view-container">
      {/* SIDEBAR */}
      <aside className="project-sidebar">
        <div className="sidebar-header">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <h5 className="mb-0 fw-bold text-truncate" title={project.name}>{project.name}</h5>
            <Button variant="link" size="sm" className="p-0 text-muted" onClick={openEditModal}>
              <FaCog />
            </Button>
          </div>
          <p className="small text-muted mb-0 text-truncate">{project.address || 'Sem endereço'}</p>
          <div className="mt-3 d-flex gap-1 flex-wrap">
            {project.modules.maintenance && <Badge className="badge-custom-green" pill>Manutenção</Badge>}
            {project.modules.security && <Badge className="badge-custom-warning" pill>Segurança</Badge>}
            {project.modules.progress && <Badge className="badge-custom-info" pill>Progresso</Badge>}
          </div>
        </div>

        <div className="sidebar-content">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <span className="text-uppercase fw-bold small text-muted">Inspeções</span>
            <Button variant="link" size="sm" className="p-0 text-success" onClick={() => setShowCreateInspectionModal(true)}>
              <FaPlus /> Nova
            </Button>
          </div>

          <div 
            className={`inspection-item ${!activeInspection ? 'active' : ''}`}
            onClick={() => setActiveInspection(null)}
          >
            <div className="inspection-icon"><FaChartLine /></div>
            <div className="inspection-info">
              <h6>Visão Geral</h6>
              <span>Estatísticas do Projeto</span>
            </div>
          </div>

          {project.inspections?.map(insp => (
            <div 
              key={insp.id}
              className={`inspection-item ${activeInspection?.id === insp.id ? 'active' : ''}`}
              onClick={() => setActiveInspection(insp)}
            >
              <div className="inspection-icon">
                {insp.orthoResults?.length ? <FaMapMarkedAlt className="text-primary" /> : <FaClipboardList />}
              </div>
              <div className="inspection-info text-truncate">
                <h6 className="text-truncate">{insp.inspectionObjective}</h6>
                <span>{insp.inspectionDate} • {insp.images.length} fotos</span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* VIEWPORT PRINCIPAL */}
      <main className="main-viewport">
        {!activeInspection ? (
          /* DASHBOARD DE VISÃO GERAL */
          <div className="animate__animated animate__fadeIn">
            <h3 className="fw-bold mb-4">Dashboard do Projeto</h3>
            <Row>
              <Col md={4}>
                <Card className="modern-card stat-card">
                  <div className="stat-value">{project.inspections?.length || 0}</div>
                  <div className="stat-label">Total de Inspeções</div>
                </Card>
              </Col>
              <Col md={4}>
                <Card className="modern-card stat-card">
                  <div className="stat-value">
                    {project.inspections?.reduce((acc, i) => acc + i.images.length, 0)}
                  </div>
                  <div className="stat-label">Fotos Analisadas</div>
                </Card>
              </Col>
              <Col md={4}>
                <Card className="modern-card stat-card">
                  <div className="stat-value">
                    {project.inspections?.reduce((acc, i) => acc + (i.orthoResults?.length || 0), 0)}
                  </div>
                  <div className="stat-label">Mapas Processados</div>
                </Card>
              </Col>
            </Row>
            <Card className="modern-card p-5 mt-4 text-center text-muted border-dashed" style={{ border: '2px dashed #ddd' }}>
              <FaProjectDiagram size={48} className="mb-3 opacity-25" />
              <h5>Inicie uma análise</h5>
              <p>Selecione uma inspeção na barra lateral para visualizar os dados ou crie uma nova inspeção para começar o processamento.</p>
              <Button variant="success" onClick={() => setShowCreateInspectionModal(true)} className="mt-2 py-2 px-4 fw-bold">
                + Gerar Nova Inspeção
              </Button>
            </Card>
          </div>
        ) : (
          /* VISUALIZAÇÃO DA INSPEÇÃO ATIVA */
          <div className="animate__animated animate__fadeIn">
            <div className="d-flex justify-content-between align-items-start mb-4 bg-white p-4 rounded-4 shadow-sm border">
              <div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <h3 className="fw-bold mb-0">{activeInspection.inspectionObjective}</h3>
                  <Badge bg="success" className="bg-opacity-10 text-success">{activeInspection.inspectionType}</Badge>
                </div>
                <p className="text-muted mb-0">
                  <FaChartLine className="me-1" /> {activeInspection.inspectionDate} • Resp: {activeInspection.inspectionResponsible}
                </p>
              </div>
              <div className="d-flex gap-2">
                <Button 
                  variant="primary" 
                  className="d-flex align-items-center gap-2"
                  onClick={() => {
                    setSelectedFiles([]);
                    setProgress(0);
                    setShowUploadModal(true);
                  }}
                >
                  <FaCloudUploadAlt /> Processar Novos Dados
                </Button>
                <Button 
                  variant="outline-primary" 
                  onClick={() => handleGenerateInspectionPdfReport(activeInspection.id)}
                  disabled={isGeneratingReport}
                >
                  {isGeneratingReport ? 'Gerando...' : <><FaDownload className="me-2" /> PDF</>}
                </Button>
                <Button variant="outline-danger" onClick={() => handleDeleteInspection(activeInspection.id)}>
                  <FaTrash />
                </Button>
              </div>
            </div>

            {/* Seção de Ortomosaicos */}
            {activeInspection.orthoResults && activeInspection.orthoResults.length > 0 && (
              <div className="mb-5">
                <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
                  <FaMapMarkedAlt className="text-success" /> Ortomosaicos Processados
                </h5>
                <Row>
                  {activeInspection.orthoResults.map((ortho, idx) => (
                    <Col md={12} key={idx} className="mb-3">
                      <Card className="modern-card overflow-hidden">
                        <Row className="g-0">
                          <Col md={4}>
                            <div 
                              className="position-relative"
                              onClick={() => {}} // Ortomosaico por enquanto não entra no carrosel de fotos comuns
                              style={{ cursor: 'pointer', height: '100%', minHeight: '200px', background: '#f8f9fa' }}
                            >
                              <img 
                                src={`http://localhost:3001${ortho.previewUrl}`} 
                                className="w-100 h-100 object-fit-cover" 
                                alt="Preview" 
                              />
                            </div>
                          </Col>
                          <Col md={8}>
                            <Card.Body className="d-flex flex-column justify-content-center">
                              <h6 className="fw-bold mb-1">{path.basename(ortho.url)}</h6>
                              <div className="ortho-info-badge mb-3 w-fit-content">
                                {ortho.detections.length} anomalias detectadas
                              </div>
                              <div className="d-flex gap-2">
                                <Button size="sm" variant="primary" onClick={() => window.open(`http://localhost:3001${ortho.url}`)}>
                                  <FaDownload className="me-1" /> TIFF Anotado
                                </Button>
                              </div>
                            </Card.Body>
                          </Col>
                        </Row>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            )}

            {/* Galeria de Imagens */}
            <div>
              <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
                <FaImages className="text-success" /> Galeria de Fotos ({activeInspection.images.length})
              </h5>
              {activeInspection.images.length > 0 ? (
                <div className="results-grid">
                  {activeInspection.images.map((img, idx) => (
                    <img 
                      key={idx}
                      src={`http://localhost:3001${img.url}`} 
                      className="result-card-img"
                      alt={`Defeito ${idx}`}
                      onClick={() => setExpandedImageIndex(idx)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-5 border rounded-4 bg-light opacity-50">
                  <FaImages size={32} className="mb-2" />
                  <p className="mb-0">Nenhuma imagem comum processada nesta inspeção.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL DE UPLOAD / PROCESSAMENTO */}
      <Modal show={showUploadModal} onHide={() => !processing && setShowUploadModal(false)} centered size="lg">
        <Modal.Header closeButton={!processing}>
          <Modal.Title className="fw-bold">Adicionar Dados à Inspeção</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!processing ? (
            <>
              <Alert variant="info" className="border-0 rounded-4 mb-4">
                Os dados carregados serão vinculados automaticamente à inspeção: <strong>{activeInspection?.inspectionObjective}</strong>
              </Alert>

              <Form.Group className="mb-4 text-center">
                <div className="d-flex justify-content-center gap-4">
                  <Form.Check
                    type="radio"
                    label="Múltiplas Fotos"
                    name="pType"
                    checked={processingType === 'images'}
                    onChange={() => setProcessingType('images')}
                  />
                  <Form.Check
                    type="radio"
                    label="Ortomosaico (TIFF/JPG)"
                    name="pType"
                    checked={processingType === 'ortho'}
                    onChange={() => setProcessingType('ortho')}
                  />
                </div>
              </Form.Group>

              <div 
                className="p-5 border-2 border-dashed rounded-4 text-center bg-light"
                style={{ border: '2px dashed #10b98144', cursor: 'pointer' }}
                onClick={() => document.getElementById('fileInput')?.click()}
              >
                <FaUpload size={32} className="text-success mb-3" />
                <h6 className="fw-bold">
                  {selectedFiles.length ? `${selectedFiles.length} arquivos prontos` : 'Clique para selecionar arquivos'}
                </h6>
                <p className="small text-muted mb-0">
                  {processingType === 'images' ? 'Suporta JPG, PNG' : 'Suporta GeoTIFF ou JPEGs gigantes'}
                </p>
                <input 
                  id="fileInput"
                  type="file" 
                  multiple={processingType === 'images'} 
                  className="d-none" 
                  onChange={e => e.target.files && setSelectedFiles(Array.from(e.target.files))}
                />
              </div>

              <Button 
                variant="primary" 
                className="w-100 mt-4 py-2 fw-bold"
                disabled={!selectedFiles.length}
                onClick={handleProcess}
              >
                Iniciar Processamento
              </Button>
            </>
          ) : (
            <div className="py-4 text-center">
              <h5 className="fw-bold mb-3">{progressStatus}</h5>
              <ProgressBar 
                animated 
                now={progress} 
                label={`${progress}%`} 
                variant="success" 
                style={{ height: '25px', borderRadius: '10px' }} 
              />
              <p className="text-muted mt-3 small">
                {processingType === 'ortho' 
                  ? 'Ortomosaicos são arquivos grandes. Por favor, mantenha esta janela aberta.' 
                  : 'Analisando imagens. O tempo depende da quantidade de fotos.'}
              </p>
            </div>
          )}
        </Modal.Body>
      </Modal>

      {/* MODAL DE CRIAÇÃO DE INSPEÇÃO */}
      <Modal show={showCreateInspectionModal} onHide={() => setShowCreateInspectionModal(false)} centered>
        <Modal.Header closeButton><Modal.Title className="fw-bold">Nova Inspeção</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form onSubmit={e => { e.preventDefault(); handleCreateInspection(); }}>
            <Form.Group className="mb-3">
              <Form.Label>Objetivo</Form.Label>
              <Form.Control required value={newInspectionObjective} onChange={e => setNewInspectionObjective(e.target.value)} placeholder="Ex: Fachada Norte" />
            </Form.Group>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Data</Form.Label>
                  <Form.Control type="date" required value={inspectionDate} onChange={e => setInspectionDate(e.target.value)} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <FaTools className="me-2" />
                  <Form.Label>Tipo</Form.Label>
                  <Form.Select value={inspectionType} onChange={e => setInspectionType(e.target.value)}>
                    <option value="Preventiva">Preventiva</option>
                    <option value="Corretiva">Corretiva</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>Responsável Técnico</Form.Label>
              <Form.Control required value={inspectionResponsible} onChange={e => setInspectionResponsible(e.target.value)} placeholder="Nome do Engenheiro" />
            </Form.Group>
            <Button variant="primary" type="submit" className="w-100">Criar Agora</Button>
          </Form>
        </Modal.Body>
      </Modal>

      {/* VISUALIZAÇÃO EXPANDIDA COM NAVEGAÇÃO */}
      <Modal 
        show={expandedImageIndex !== null} 
        onHide={() => setExpandedImageIndex(null)} 
        size="xl" 
        centered 
        className="expanded-image-modal"
      >
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="small text-muted">
            {expandedImageIndex !== null && activeInspection && (
              `Imagem ${expandedImageIndex + 1} de ${activeInspection.images.length} — ${path.basename(activeInspection.images[expandedImageIndex].url)}`
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center p-0 position-relative bg-black d-flex align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
          {expandedImageIndex !== null && activeInspection && (
            <>
              {/* Botão Anterior */}
              <button 
                className="carousel-control-prev border-0 bg-transparent" 
                style={{ width: '10%' }}
                onClick={(e) => { e.stopPropagation(); handlePrevImage(); }}
              >
                <FaChevronLeft size={40} className="text-white opacity-50 hover-opacity-100" />
              </button>

              <img 
                src={`http://localhost:3001${activeInspection.images[expandedImageIndex].url}`} 
                style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain' }} 
                alt="Fullscreen" 
              />

              {/* Botão Próximo */}
              <button 
                className="carousel-control-next border-0 bg-transparent" 
                style={{ width: '10%' }}
                onClick={(e) => { e.stopPropagation(); handleNextImage(); }}
              >
                <FaChevronRight size={40} className="text-white opacity-50 hover-opacity-100" />
              </button>
            </>
          )}
        </Modal.Body>
      </Modal>

      {/* MODAL EDITAR PROJETO */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>Configurações do Projeto</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleUpdateProject}>
            <Form.Group className="mb-3"><Form.Label>Nome</Form.Label><Form.Control value={editFormData.name || ''} onChange={e => setEditFormData({ ...editFormData, name: e.target.value })} /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Endereço</Form.Label><Form.Control value={editFormData.address || ''} onChange={e => setEditFormData({ ...editFormData, address: e.target.value })} /></Form.Group>
            <Button variant="primary" type="submit" className="w-100">Salvar</Button>
          </Form>
        </Modal.Body>
      </Modal>

    </div>
  );
};

export default ProjectView;