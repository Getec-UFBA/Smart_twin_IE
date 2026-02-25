import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Container, Row, Col, Card, Button, Form, Modal, Alert } from 'react-bootstrap';
import './style.css';
import path from 'path-browserify';
import { FaCog, FaPencilAlt, FaTrash, FaUpload, FaDownload } from 'react-icons/fa';
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
  const [targetInspectionId, setTargetInspectionId] = useState<string>('');
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);
  const [newInspectionObjective, setNewInspectionObjective] = useState('');
  const [inspectionType, setInspectionType] = useState('Preventiva');
  const [inspectionDate, setInspectionDate] = useState('');
  const [inspectionResponsible, setInspectionResponsible] = useState('');
  const [showCreateInspectionModal, setShowCreateInspectionModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [selectedInspectionImages, setSelectedInspectionImages] = useState<IImage[]>([]);
  const [selectedInspectionOrthoResults, setSelectedInspectionOrthoResults] = useState<IOrthoResult[]>([]);
  const [selectedInspectionObjective, setSelectedInspectionObjective] = useState<string>('');
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<IProject>>({});
  const [showEditInspectionModal, setShowEditInspectionModal] = useState(false);
  const [editingInspection, setEditingInspection] = useState<IInspection | null>(null);
  const [expandedImage, setExpandedImage] = useState<{ url: string; title: string } | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      const response = await api.get(`/projects/${id}`);
      setProject(response.data);
    } catch (err) {
      setError('Erro ao carregar o projeto.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

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
      alert('Projeto atualizado com sucesso!');
    } catch (err) {
      console.error('Erro ao atualizar projeto:', err);
      alert('Erro ao atualizar projeto.');
    }
  };

  const openEditInspectionModal = (inspection: IInspection) => {
    setEditingInspection({ ...inspection });
    setShowEditInspectionModal(true);
  };

  const handleUpdateInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !editingInspection) return;

    try {
      const updatedInspections = project.inspections?.map(insp => 
        insp.id === editingInspection.id ? editingInspection : insp
      );

      await api.put(`/projects/${project.id}`, {
        inspections: updatedInspections
      });

      setShowEditInspectionModal(false);
      fetchProject();
      alert('Inspeção atualizada com sucesso!');
    } catch (err) {
      console.error('Erro ao atualizar inspeção:', err);
      alert('Erro ao atualizar inspeção.');
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
      setNewInspectionObjective('');
      setInspectionDate('');
      setInspectionResponsible('');
      fetchProject();
      alert('Inspeção criada com sucesso!');
    } catch (err) {
      console.error('Erro ao criar inspeção:', err);
      alert('Erro ao criar inspeção.');
    }
  };

  const handleDeleteInspection = async (inspectionId: string) => {
    if (!project) return;

    if (!window.confirm('Tem certeza que deseja excluir esta inspeção? Todos os resultados contidos nela serão apagados.')) return;

    try {
      await api.delete(`/projects/${project.id}/inspections/${inspectionId}`);
      fetchProject();
      alert('Inspeção excluída com sucesso!');
    } catch (err) {
      console.error('Erro ao excluir inspeção:', err);
      alert('Erro ao excluir inspeção.');
    }
  };

  const handleDeleteImageFromInspection = async (imageUrl: string, inspectionId: string) => {
    if (!project) return;

    if (!window.confirm('Tem certeza que deseja excluir esta imagem?')) return;

    try {
      const imageName = path.basename(imageUrl);
      await api.delete(`/projects/${project.id}/inspections/${inspectionId}/images/${imageName}`);
      
      if (selectedInspectionId === inspectionId) {
        setSelectedInspectionImages(prev => prev.filter(img => img.url !== imageUrl));
      }
      
      fetchProject();
    } catch (err) {
      console.error('Erro ao excluir imagem:', err);
      alert('Erro ao excluir imagem.');
    }
  };

  const handleDeleteOrthoFromInspection = async (orthoUrl: string, inspectionId: string) => {
    if (!project) return;

    if (!window.confirm('Tem certeza que deseja excluir este resultado de ortomosaico?')) return;

    try {
      const orthoName = path.basename(orthoUrl);
      await api.delete(`/projects/${project.id}/inspections/${inspectionId}/ortho/${orthoName}`);
      
      if (selectedInspectionId === inspectionId) {
        setSelectedInspectionOrthoResults(prev => prev.filter(o => o.url !== orthoUrl));
      }
      
      fetchProject();
    } catch (err) {
      console.error('Erro ao excluir ortomosaico:', err);
      alert('Erro ao excluir ortomosaico.');
    }
  };

  const handleInspectionClick = (inspection: IInspection) => {
    setSelectedInspectionImages(inspection.images);
    setSelectedInspectionOrthoResults(inspection.orthoResults || []);
    setSelectedInspectionObjective(inspection.inspectionObjective);
    setSelectedInspectionId(inspection.id);
    setShowImageModal(true);
  };

  const handleProcess = async () => {
    if (selectedFiles.length === 0 || !project) return;

    if (processingType === 'ortho' && !targetInspectionId) {
      alert('Por favor, selecione uma inspeção para salvar o ortomosaico.');
      return;
    }

    setProcessing(true);
    setError(null);
    const formData = new FormData();

    try {
      if (processingType === 'images') {
        selectedFiles.forEach(file => {
          formData.append('images', file);
        });
        const response = await api.post('/projects/process-images', formData);
        setSelectedFiles([]);
        alert('Imagens enviadas para revisão!');
        navigate(`/review/${response.data.reviewId}`);
      } else {
        formData.append('ortho', selectedFiles[0]);
        formData.append('projectId', project.id);
        formData.append('inspectionId', targetInspectionId);

        await api.post('/projects/process-ortho', formData, {
          timeout: 0,
        });
        
        setSelectedFiles([]);
        setTargetInspectionId('');
        alert('Ortomosaico processado e salvo com sucesso!');
        fetchProject();
      }
    } catch (err) {
      console.error('Erro ao processar:', err);
      const errorMessage = (err as any).response?.data?.error || 'Erro desconhecido ao processar.';
      setError(errorMessage);
      alert(`Ocorreu um erro: ${errorMessage}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadImage = (imageUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (id) {
      fetchProject();
    }
  }, [fetchProject, id]);

  const handleGenerateInspectionPdfReport = async (projectId: string, inspectionId: string) => {
    if (!projectId || !inspectionId) {
      setError('ID do projeto ou ID da inspeção ausente. Não é possível gerar o relatório.');
      return;
    }

    setIsGeneratingReport(true);
    setError(null);

    try {
      const response = await api.get(`/projects/${projectId}/report/pdf/inspections/${inspectionId}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `relatorio-inspecao-${inspectionId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      alert(`Relatório PDF da inspeção "${inspectionId}" gerado com sucesso!`);
    } catch (err) {
      console.error(`Erro ao gerar relatório PDF da inspeção "${inspectionId}":`, err);
      setError(`Erro ao gerar relatório PDF da inspeção "${inspectionId}".`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleGeneratePdfReport = async () => {
    if (!project?.id) {
      setError('ID do projeto ausente. Não é possível gerar o relatório.');
      return;
    }

    setIsGeneratingReport(true);
    setError(null);

    try {
      const response = await api.get(`/projects/${project.id}/report/pdf`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `relatorio-projeto-${project.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      alert('Relatório PDF gerado com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar relatório PDF:', err);
      setError('Erro ao gerar relatório PDF.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles(Array.from(event.target.files));
      setLastBatchId(null);
    }
  };

  if (loading) {
    return <p>Carregando...</p>;
  }

  if (error) {
    return <p className="error-message">{error}</p>;
  }

  if (!project) {
    return <p>Projeto não encontrado.</p>;
  }

  return (
    <Container fluid className="project-view-container">
      <Row className="align-items-center my-4 project-header">
        <Col>
          <h1 className="project-title">
            {project.name}
            <Button variant="link" onClick={openEditModal} className="ms-2">
              <FaCog />
            </Button>
          </h1>
        </Col>
        <Col xs="auto">
          <Button variant="primary" onClick={() => navigate(`/projetos/${id}/dashboard`)} className="me-2">
            Dashboard
          </Button>
        </Col>
      </Row>
      <Row>
        <Col md={8}>
          <Card>
            <Card.Body>
              <Card.Title>Processamento com IA</Card.Title>
              
              <Form.Group className="mb-3">
                <Form.Label>Tipo de Processamento</Form.Label>
                <div>
                  <Form.Check
                    inline
                    label="Imagens de Inspeção"
                    type="radio"
                    name="processingType"
                    checked={processingType === 'images'}
                    onChange={() => {
                      setProcessingType('images');
                      setSelectedFiles([]);
                    }}
                  />
                  <Form.Check
                    inline
                    label="Ortomosaico (GeoTIFF)"
                    type="radio"
                    name="processingType"
                    checked={processingType === 'ortho'}
                    onChange={() => {
                      setProcessingType('ortho');
                      setSelectedFiles([]);
                    }}
                  />
                </div>
              </Form.Group>

              {processingType === 'ortho' && (
                <Form.Group className="mb-3">
                  <Form.Label>Salvar na Inspeção</Form.Label>
                  <Form.Select 
                    value={targetInspectionId} 
                    onChange={e => setTargetInspectionId(e.target.value)}
                    required
                  >
                    <option value="">Selecione uma inspeção...</option>
                    {project.inspections?.map(insp => (
                      <option key={insp.id} value={insp.id}>
                        {insp.inspectionObjective}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              )}

              <div className="image-input-group">
                <Form.Group controlId="formFile" className="mb-3" style={{ flex: 1 }}>
                  <Form.Label className="custom-file-upload">
                    <FaUpload />
                    {selectedFiles.length > 0 
                      ? `${selectedFiles.length} arquivos selecionados` 
                      : processingType === 'images' 
                        ? 'Clique para selecionar Imagens de Inspeção' 
                        : 'Clique para selecionar GeoTIFF (.tif, .tiff)'}
                    <Form.Control 
                      type="file" 
                      onChange={handleFileChange} 
                      multiple={processingType === 'images'}
                      accept={processingType === 'images' ? "image/*" : ".tif,.tiff,.jpg,.jpeg"}
                      style={{ display: 'none' }}
                    />
                  </Form.Label>
                </Form.Group>
                <Button
                  variant="success"
                  onClick={handleProcess}
                  disabled={selectedFiles.length === 0 || processing || (processingType === 'ortho' && !targetInspectionId)}
                  className="w-100"
                >
                  {processing ? 'Processando...' : processingType === 'images' ? 'Processar Imagens' : 'Processar Ortomosaico/JPEG'}
                </Button>
              </div>

              {processing && processingType === 'ortho' && (
                <Alert variant="info" className="mt-3">
                  O processamento de ortomosaicos pode levar alguns minutos. Por favor, aguarde...
                </Alert>
              )}
            </Card.Body>
          </Card>
          <Card className="mt-4">
            <Card.Body>
              <Card.Title className="d-flex justify-content-between align-items-center">
                Inspeções e Imagens Salvas
                <Button variant="success" size="sm" onClick={() => setShowCreateInspectionModal(true)}>
                  Criar Nova Inspeção
                </Button>
              </Card.Title>

              {project.inspections && project.inspections.length > 0 ? (
                <Row xs={1} sm={2} md={3} lg={4} className="g-4">
                  {project.inspections.map((inspection) => (
                    <Col key={inspection.id}>
                      <Card
                        className="text-center folder-card"
                        onClick={() => handleInspectionClick(inspection)}
                        style={{ cursor: 'pointer' }}
                      >
                        <Card.Body>
                          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📋</div>
                          <Card.Title>{inspection.inspectionObjective}</Card.Title>
                          <Card.Text>
                            Tipo: {inspection.inspectionType} <br />
                            Data: {inspection.inspectionDate} <br />
                            Responsável: {inspection.inspectionResponsible} <br />
                            {inspection.images.length} imagens
                          </Card.Text>
                        </Card.Body>
                        <Card.Footer>
                          <Button
                            variant="light"
                            size="sm"
                            className="me-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditInspectionModal(inspection);
                            }}
                          >
                            <FaPencilAlt />
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteInspection(inspection.id);
                            }}
                          >
                            Excluir Inspeção
                          </Button>
                        </Card.Footer>
                      </Card>
                    </Col>
                  ))}
                </Row>
              ) : (
                <p>Nenhuma inspeção ou imagem salva ainda para este projeto.</p>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="modules-card">
            <Card.Header>Módulos</Card.Header>
            <Card.Body>
              {project.modules.progress && <p>Acompanhamento de Progresso</p>}
              {project.modules.security && <p>Segurança do Trabalho</p>}
              {project.modules.maintenance && <p>Manutenção Preditiva</p>}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Modal show={showCreateInspectionModal} onHide={() => setShowCreateInspectionModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Criar Nova Inspeção</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={(e) => { e.preventDefault(); handleCreateInspection(); }}>
            <Form.Group className="mb-3">
              <Form.Label>Tipo de Inspeção</Form.Label>
              <Form.Select value={inspectionType} onChange={e => setInspectionType(e.target.value)}>
                <option value="Preventiva">Preventiva</option>
                <option value="Corretiva">Corretiva</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Objetivo da Inspeção</Form.Label>
              <Form.Control
                type="text"
                placeholder="Ex: Verificação de rachaduras na fachada principal"
                value={newInspectionObjective}
                onChange={e => setNewInspectionObjective(e.target.value)}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Data da Inspeção</Form.Label>
              <Form.Control
                type="date"
                value={inspectionDate}
                onChange={e => setInspectionDate(e.target.value)}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Responsável pela Inspeção</Form.Label>
              <Form.Control
                type="text"
                placeholder="Ex: João da Silva (Engenheiro Civil)"
                value={inspectionResponsible}
                onChange={e => setInspectionResponsible(e.target.value)}
                required
              />
            </Form.Group>
            <Button variant="primary" type="submit" disabled={!newInspectionObjective.trim() || !inspectionDate || !inspectionResponsible.trim()}>
              Criar Inspeção
            </Button>
          </Form>
        </Modal.Body>
      </Modal>

      <Modal show={showImageModal} onHide={() => setShowImageModal(false)} size="lg" className="image-modal">
        <Modal.Header closeButton>
          <Modal.Title>Detalhes da Inspeção: "{selectedInspectionObjective}"</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Seção de Ortomosaicos */}
          {selectedInspectionOrthoResults && selectedInspectionOrthoResults.length > 0 && (
            <div className="mb-4">
              <h5>Ortomosaicos Processados</h5>
              <Row>
                {selectedInspectionOrthoResults.map((ortho, index) => (
                  <Col xs={12} key={index} className="mb-3">
                    <Card>
                      {ortho.previewUrl && (
                        <Card.Img 
                          variant="top" 
                          src={`http://localhost:3001${ortho.previewUrl}`} 
                          alt={`Preview do Ortomosaico ${index}`}
                          style={{ maxHeight: '400px', objectFit: 'contain', backgroundColor: '#f8f9fa', cursor: 'pointer' }}
                          onClick={() => setExpandedImage({ 
                            url: `http://localhost:3001${ortho.previewUrl}`, 
                            title: path.basename(ortho.url) 
                          })}
                        />
                      )}
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <strong>{path.basename(ortho.url)}</strong>
                            <br />
                            <small className="text-muted">
                              {ortho.detections.length} patologias detectadas via georreferenciamento.
                            </small>
                          </div>
                          <div className="d-flex gap-2">
                            <Button 
                              variant="primary" 
                              size="sm"
                              onClick={() => window.open(`http://localhost:3001${ortho.url}`, '_blank')}
                            >
                              Baixar GeoTIFF Anotado
                            </Button>
                            <Button 
                              variant="outline-danger" 
                              size="sm"
                              onClick={() => selectedInspectionId && handleDeleteOrthoFromInspection(ortho.url, selectedInspectionId)}
                            >
                              <FaTrash />
                            </Button>
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                ))}
              </Row>
              <hr />
            </div>
          )}

          {/* Seção de Imagens Comuns */}
          <h5>Imagens de Inspeção</h5>
          {selectedInspectionImages.length > 0 ? (
            <Row>
              {selectedInspectionImages.map((image, index) => (
                <Col xs={6} md={4} lg={3} key={index} className="mb-3">
                  <Card>
                    {(() => {
                      const imageUrlForDisplay = image.url ? `http://localhost:3001${image.url}` : '';
                      return imageUrlForDisplay ? (
                        <Card.Img 
                          variant="top" 
                          src={imageUrlForDisplay} 
                          alt={`Imagem ${index}`} 
                          style={{ cursor: 'pointer' }}
                          onClick={() => setExpandedImage({ 
                            url: imageUrlForDisplay, 
                            title: path.basename(image.url) 
                          })}
                        />
                      ) : (
                        <div style={{ padding: '10px', textAlign: 'center', color: '#666' }}>
                          Imagem não disponível
                        </div>
                      );
                    })()}
                    <Card.Body className="p-2">
                      <Card.Text className="text-muted small text-truncate mb-2">
                        {image.url ? path.basename(image.url) : 'Nome da imagem indisponível'}
                      </Card.Text>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          if (image.url && selectedInspectionId) {
                            handleDeleteImageFromInspection(image.url, selectedInspectionId);
                          }
                        }}
                        disabled={!image.url}
                      >
                        Excluir
                      </Button>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <p className="text-muted">Nenhuma imagem comum nesta inspeção.</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          {isGeneratingReport && <p className="text-center w-100">Gerando relatório...</p>}
          <Button
            variant="primary"
            onClick={() => project && selectedInspectionId && handleGenerateInspectionPdfReport(project.id, selectedInspectionId)}
            disabled={isGeneratingReport}
          >
            {isGeneratingReport ? 'Gerando Relatório...' : 'Gerar Relatório da Inspeção'}
          </Button>
          <Button variant="secondary" onClick={() => setShowImageModal(false)} disabled={isGeneratingReport}>
            Fechar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal para Visualização Expandida da Imagem */}
      <Modal 
        show={!!expandedImage} 
        onHide={() => setExpandedImage(null)} 
        size="xl" 
        centered
        className="expanded-image-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>{expandedImage?.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center p-0">
          {expandedImage && (
            <>
              <img 
                src={expandedImage.url} 
                alt={expandedImage.title} 
                style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
              />
              <div className="p-3">
                <Button 
                  variant="success" 
                  onClick={() => handleDownloadImage(expandedImage.url, expandedImage.title)}
                >
                  <FaDownload className="me-2" /> Baixar Imagem
                </Button>
              </div>
            </>
          )}
        </Modal.Body>
      </Modal>

      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Editar Projeto</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleUpdateProject}>
            <Form.Group className="mb-3">
              <Form.Label>Nome do Projeto</Form.Label>
              <Form.Control
                type="text"
                value={editFormData.name || ''}
                onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Endereço</Form.Label>
              <Form.Control
                type="text"
                value={editFormData.address || ''}
                onChange={e => setEditFormData({ ...editFormData, address: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Tipo</Form.Label>
              <Form.Control
                type="text"
                value={editFormData.type || ''}
                onChange={e => setEditFormData({ ...editFormData, type: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Responsável</Form.Label>
              <Form.Control
                type="text"
                value={editFormData.responsible || ''}
                onChange={e => setEditFormData({ ...editFormData, responsible: e.target.value })}
              />
            </Form.Group>
            <Button variant="primary" type="submit">
              Salvar Alterações
            </Button>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Modal para Editar Inspeção */}
      <Modal show={showEditInspectionModal} onHide={() => setShowEditInspectionModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Editar Inspeção</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editingInspection && (
            <Form onSubmit={handleUpdateInspection}>
              <Form.Group className="mb-3">
                <Form.Label>Objetivo da Inspeção</Form.Label>
                <Form.Control
                  type="text"
                  value={editingInspection.inspectionObjective}
                  onChange={e => setEditingInspection({ ...editingInspection, inspectionObjective: e.target.value })}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Tipo</Form.Label>
                <Form.Control
                  type="text"
                  value={editingInspection.inspectionType}
                  onChange={e => setEditingInspection({ ...editingInspection, inspectionType: e.target.value })}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Data</Form.Label>
                <Form.Control
                  type="date"
                  value={editingInspection.inspectionDate}
                  onChange={e => setEditingInspection({ ...editingInspection, inspectionDate: e.target.value })}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Responsável</Form.Label>
                <Form.Control
                  type="text"
                  value={editingInspection.inspectionResponsible}
                  onChange={e => setEditingInspection({ ...editingInspection, inspectionResponsible: e.target.value })}
                />
              </Form.Group>
              <Button variant="primary" type="submit">
                Salvar Alterações
              </Button>
            </Form>
          )}
        </Modal.Body>
      </Modal>

    </Container>
  );
};

export default ProjectView;