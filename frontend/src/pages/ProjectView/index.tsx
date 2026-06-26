import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { Row, Col, Card, Button, Form, Modal, Alert, Badge, ProgressBar } from 'react-bootstrap';
import './style.css';
import path from 'path-browserify';
import { 
  FaCog, FaTrash, FaUpload, FaDownload, 
  FaClipboardList, FaProjectDiagram, FaMapMarkedAlt, 
  FaImages, FaChartLine, FaPlus, FaCloudUploadAlt, FaTools,
  FaChevronLeft, FaChevronRight, FaHammer 
} from 'react-icons/fa';
import type { IProject, IInspection } from '../../models/IProject';
import MaintenanceFeedback from '../../components/MaintenanceFeedback';

const ProjectView: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<IProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processingType, setProcessingType] = useState<'images' | 'ortho'>('images');
  
  // Controle de Progresso
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Controle de Visualização
  const [activeInspection, setActiveInspection] = useState<IInspection | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  
  const [newInspectionObjective, setNewInspectionObjective] = useState('');
  const [inspectionType, setInspectionType] = useState('Preventiva');
  const [inspectionDate, setInspectionDate] = useState('');
  const [inspectionResponsible, setInspectionResponsible] = useState('');
  const [showCreateInspectionModal, setShowCreateInspectionModal] = useState(false);
  
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<IProject>>({});
  const [showConfirmEdit, setShowConfirmEdit] = useState(false);
  
  // Navegação de Imagens Expandidas
  const [expandedImageIndex, setExpandedImageIndex] = useState<number | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      const response = await api.get(`/projects/${id}`);
      const data = response.data;
      setProject(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchProject();
  }, [id, fetchProject]);

  // Sincroniza os dados da inspeção ativa quando o projeto é atualizado (ex: após processar imagens)
  useEffect(() => {
    if (project && activeInspection) {
      const updated = project.inspections?.find((i: IInspection) => i.id === activeInspection.id);
      if (updated) {
        // Só atualiza se houver mudança real nos dados (comparação simples de arrays para evitar loops)
        if (updated.images.length !== activeInspection.images.length || 
            (updated.orthoResults?.length || 0) !== (activeInspection.orthoResults?.length || 0)) {
          setActiveInspection(updated);
        }
      }
    }
  }, [project, activeInspection]);

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
        buildingYear: project.buildingYear,
        builtArea: project.builtArea,
        roofTypology: project.roofTypology,
      });
      setShowConfirmEdit(false);
      setShowEditModal(true);
    }
  };

  const handleSubmitEditForm = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmEdit(true);
  };

  const handleUpdateProject = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!project) return;
    try {
      await api.put(`/projects/${project.id}`, editFormData);
      setShowEditModal(false);
      setShowConfirmEdit(false);
      fetchProject();
    } catch (err) {
      alert(t('project_view.error_update'));
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
      alert(t('project_view.error_create_insp'));
    }
  };

  const handleDeleteInspection = async (inspectionId: string) => {
    if (!project || !window.confirm(t('project_view.confirm_delete_insp'))) return;
    try {
      await api.delete(`/projects/${project.id}/inspections/${inspectionId}`);
      if (activeInspection?.id === inspectionId) setActiveInspection(null);
      fetchProject();
    } catch (err) {
      alert(t('project_view.error_delete_insp'));
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
    setProgressStatus(t('project_view.progress_starting'));
    
    try {
      if (processingType === 'images') {
        let successCount = 0;
        let failCount = 0;
        const totalFiles = selectedFiles.length;

        for (let i = 0; i < totalFiles; i++) {
          const file = selectedFiles[i];
          const formData = new FormData();
          formData.append('images', file);
          formData.append('projectId', project.id);
          formData.append('inspectionId', activeInspection.id);

          setProgressStatus(`Processando imagem ${i + 1} de ${totalFiles}: ${file.name}`);
          
          try {
            await api.post('/projects/process-images', formData, {
              onUploadProgress: (progressEvent: any) => {
                const filePercent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                const totalPercent = Math.round(((successCount + failCount) * 100 + (filePercent * 0.9)) / totalFiles);
                setProgress(totalPercent);
              }
            });
            successCount++;
          } catch (err) {
            console.error(`Falha ao processar ${file.name}:`, err);
            failCount++;
          }
          
          setProgress(Math.round(((successCount + failCount) * 100) / totalFiles));
          
          if (i < totalFiles - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }

        if (successCount > 0) {
          setProgress(100);
          setProgressStatus(t('project_view.progress_finished'));
          setTimeout(() => {
            setShowUploadModal(false);
            fetchProject();
            setProcessing(false);
            setProgress(0);
          }, 1500);
        } else {
          alert(t('project_view.error_process'));
          setProcessing(false);
          setProgress(0);
        }

      } else {
        const formData = new FormData();
        formData.append('ortho', selectedFiles[0]);
        formData.append('projectId', project.id);
        formData.append('inspectionId', activeInspection.id);

        const currentOrthoCount = activeInspection.orthoResults?.length || 0;

        const config = {
          onUploadProgress: (progressEvent: any) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(percentCompleted * 0.4); 
            if (percentCompleted === 100) {
              setProgressStatus('Upload concluído! Iniciando IA...');
              startFakeProgress(40, 95, 2000);
            } else {
              setProgressStatus(t('project_view.progress_uploading', { percent: percentCompleted }));
            }
          },
          timeout: 0
        };

        await api.post('/projects/process-ortho', formData, config);
        
        setProgressStatus('A IA está recebendo o arquivo...');
        setProgress(95);
        
        let attempts = 0;
        const maxAttempts = 120; // 20 minutos
        
        const pollInterval = setInterval(async () => {
          attempts++;
          try {
            const response = await api.get(`/projects/${project.id}`);
            const updatedProject = response.data;
            const updatedInspection = updatedProject.inspections?.find((i: any) => i.id === activeInspection.id);
            
            // ATUALIZA O STATUS DA IA NA TELA
            if (updatedInspection?.orthoStatus) {
              setProgressStatus(updatedInspection.orthoStatus);
            }

            const newOrthoCount = updatedInspection?.orthoResults?.length || 0;

            if (newOrthoCount > currentOrthoCount) {
              clearInterval(pollInterval);
              setProject(updatedProject);
              setProgress(100);
              setProgressStatus('Processamento concluído com sucesso!');
              setTimeout(() => {
                setShowUploadModal(false);
                setProcessing(false);
                setProgress(0);
              }, 2500);
            } else if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
              setProgressStatus('Tempo esgotado. Verifique a dashboard em instantes.');
              setTimeout(() => {
                setProcessing(false);
                setShowUploadModal(false);
              }, 6000);
            }
          } catch (err) {
            console.error('Polling error:', err);
          }
        }, 5000); // Polling mais rápido (5s) para pegar os status da IA
      }
    } catch (err) {
      console.error('Erro no processamento:', err);
      alert(t('project_view.error_process'));
      setProcessing(false);
      setProgress(0);
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
      alert(t('project_view.error_report'));
    } finally {
      setIsGeneratingReport(false);
    }
  };

  if (loading) return <div className="p-4">{t('project_view.loading_center')}</div>;
  if (!project) return <div className="p-4">{t('project_view.project_not_found')}</div>;

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
          <p className="small text-muted mb-0 text-truncate">{project.address || t('project_view.no_address')}</p>
          <div className="mt-3 d-flex gap-1 flex-wrap">
            {project.modules.maintenance && <Badge className="badge-custom-green" pill>{t('projects.maintenance')}</Badge>}
            {project.modules.security && <Badge className="badge-custom-warning" pill>{t('projects.security')}</Badge>}
            {project.modules.progress && <Badge className="badge-custom-info" pill>{t('projects.progress')}</Badge>}
          </div>
        </div>

        <div className="sidebar-content">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <span className="text-uppercase fw-bold small text-muted">{t('project_view.inspections_title')}</span>
            <Button variant="link" size="sm" className="p-0 text-success" onClick={() => setShowCreateInspectionModal(true)}>
              <FaPlus /> {t('project_view.new_button')}
            </Button>
          </div>

          <div 
            className={`inspection-item ${!activeInspection ? 'active' : ''}`}
            onClick={() => setActiveInspection(null)}
          >
            <div className="inspection-icon"><FaChartLine /></div>
            <div className="inspection-info">
              <h6>{t('project_view.overview')}</h6>
              <span>Dashboard do Projeto</span>
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
                <span>{insp.inspectionDate} • {t('project_view.photos_count', { count: insp.images.length })}</span>
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
            <h3 className="fw-bold mb-4">{t('project_view.dashboard_title')}</h3>
            <Row>
              <Col md={4}>
                <Card className="modern-card stat-card">
                  <div className="stat-value">{project.inspections?.length || 0}</div>
                  <div className="stat-label">{t('project_view.stat_total_inspections')}</div>
                </Card>
              </Col>
              <Col md={4}>
                <Card className="modern-card stat-card">
                  <div className="stat-value">
                    {project.inspections?.reduce((acc, i) => acc + i.images.length, 0)}
                  </div>
                  <div className="stat-label">{t('project_view.stat_analyzed_photos')}</div>
                </Card>
              </Col>
              <Col md={4}>
                <Card className="modern-card stat-card">
                  <div className="stat-value">
                    {project.inspections?.reduce((acc, i) => acc + (i.orthoResults?.length || 0), 0)}
                  </div>
                  <div className="stat-label">{t('project_view.stat_processed_maps')}</div>
                </Card>
              </Col>
            </Row>
            <Card className="modern-card p-5 mt-4 text-center text-muted border-dashed" style={{ border: '2px dashed #ddd' }}>
              <FaProjectDiagram size={48} className="mb-3 opacity-25" />
              <h5>{t('project_view.start_analysis_title')}</h5>
              <p>{t('project_view.start_analysis_desc')}</p>
              <Button variant="success" onClick={() => setShowCreateInspectionModal(true)} className="mt-2 py-2 px-4 fw-bold">
                {t('project_view.generate_new_inspection')}
              </Button>
            </Card>
          </div>
        ) : (
          /* VISUALIZAÇÃO DA INSPEÇÃO ATIVA */
          <div className="animate__animated animate__fadeIn">
            <div className="d-flex justify-content-between align-items-start project-header-panel">
              <div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <h3 className="fw-bold mb-0">{activeInspection.inspectionObjective}</h3>
                  <Badge bg="success" className="bg-opacity-10 text-success">
                    {activeInspection.inspectionType === 'Preventiva' ? t('project_view.modal_insp_type_preventive') : t('project_view.modal_insp_type_corrective')}
                  </Badge>
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
                  <FaCloudUploadAlt /> {t('project_view.process_new_data')}
                </Button>
                <Button 
                  variant="outline-primary" 
                  onClick={() => handleGenerateInspectionPdfReport(activeInspection.id)}
                  disabled={isGeneratingReport}
                >
                  {isGeneratingReport ? t('project_view.generating') : <><FaDownload className="me-2" /> PDF</>}
                </Button>
                <Button 
                  variant="outline-success" 
                  className="d-flex align-items-center gap-2"
                  onClick={() => setShowMaintenanceModal(true)}
                >
                  <FaHammer /> {t('project_view.maintenance', 'Manutenção')}
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
                  <FaMapMarkedAlt className="text-success" /> {t('project_view.ortho_section_title')}
                </h5>
                <Row>
                  {activeInspection.orthoResults.map((ortho, idx) => (
                    <Col md={12} key={idx} className="mb-3">
                      <Card className="modern-card overflow-hidden">
                        <Row className="g-0">
                          <Col md={4}>
                            <div 
                              className="position-relative"
                              style={{ cursor: 'pointer', height: '100%', minHeight: '200px', background: 'var(--bg-main)' }}
                            >
                              <img 
                                src={ortho.previewUrl} 
                                className="w-100 h-100 object-fit-cover" 
                                alt="Preview" 
                              />
                            </div>
                          </Col>
                          <Col md={8}>
                            <Card.Body className="d-flex flex-column justify-content-center">
                              <h6 className="fw-bold mb-1">{path.basename(ortho.url)}</h6>
                              <div className="ortho-info-badge mb-3 w-fit-content">
                                {t('project_view.anomalies_detected', { count: ortho.detections.length })}
                              </div>
                              <div className="d-flex gap-2">
                                <Button size="sm" variant="primary" onClick={() => window.open(ortho.url)}>
                                  <FaDownload className="me-1" /> {t('project_view.download_tiff')}
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
                <FaImages className="text-success" /> {t('project_view.gallery_title')} ({activeInspection.images.length})
              </h5>
              {activeInspection.images.length > 0 ? (
                <div className="results-grid">
                  {activeInspection.images.map((img, idx) => (
                    <img 
                      key={idx}
                      src={img.url} 
                      className="result-card-img"
                      alt={`Defeito ${idx}`}
                      onClick={() => setExpandedImageIndex(idx)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-5 border rounded-4 bg-custom-light opacity-50">
                  <FaImages size={32} className="mb-2" />
                  <p className="mb-0">{t('project_view.no_images')}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL DE UPLOAD / PROCESSAMENTO */}
      <Modal show={showUploadModal} onHide={() => !processing && setShowUploadModal(false)} centered size="lg">
        <Modal.Header closeButton={!processing}>
          <Modal.Title className="fw-bold">{t('project_view.modal_upload_title')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!processing ? (
            <>
              <Alert variant="info" className="border-0 rounded-4 mb-4">
                {t('project_view.modal_upload_alert')} <strong>{activeInspection?.inspectionObjective}</strong>
              </Alert>

              <Form.Group className="mb-4 text-center">
                <div className="d-flex justify-content-center gap-4">
                  <Form.Check
                    type="radio"
                    label={t('project_view.modal_p_type_images')}
                    name="pType"
                    checked={processingType === 'images'}
                    onChange={() => setProcessingType('images')}
                  />
                  <Form.Check
                    type="radio"
                    label={t('project_view.modal_p_type_ortho')}
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
                  {selectedFiles.length ? t('project_view.modal_upload_ready', { count: selectedFiles.length }) : t('project_view.modal_upload_click')}
                </h6>
                <p className="small text-muted mb-0">
                  {processingType === 'images' ? t('project_view.modal_upload_support_images') : t('project_view.modal_upload_support_ortho')}
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
                {t('project_view.modal_start_process')}
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
                  ? t('project_view.modal_process_ortho_tip') 
                  : t('project_view.modal_process_images_tip')}
              </p>
            </div>
          )}
        </Modal.Body>
      </Modal>

      {/* MODAL DE CRIAÇÃO DE INSPEÇÃO */}
      <Modal show={showCreateInspectionModal} onHide={() => setShowCreateInspectionModal(false)} centered>
        <Modal.Header closeButton><Modal.Title className="fw-bold">{t('project_view.modal_new_insp_title')}</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form onSubmit={e => { e.preventDefault(); handleCreateInspection(); }}>
            <Form.Group className="mb-3">
              <Form.Label>{t('project_view.modal_insp_objective')}</Form.Label>
              <Form.Control required value={newInspectionObjective} onChange={e => setNewInspectionObjective(e.target.value)} placeholder={t('project_view.modal_insp_objective_placeholder')} />
            </Form.Group>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>{t('project_view.modal_insp_date')}</Form.Label>
                  <Form.Control type="date" required value={inspectionDate} onChange={e => setInspectionDate(e.target.value)} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <FaTools className="me-2" />
                  <Form.Label>{t('project_view.modal_insp_type')}</Form.Label>
                  <Form.Select value={inspectionType} onChange={e => setInspectionType(e.target.value)}>
                    <option value="Preventiva">{t('project_view.modal_insp_type_preventive')}</option>
                    <option value="Corretiva">{t('project_view.modal_insp_type_corrective')}</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>{t('project_view.modal_insp_responsible')}</Form.Label>
              <Form.Control required value={inspectionResponsible} onChange={e => setInspectionResponsible(e.target.value)} placeholder={t('project_view.modal_insp_responsible_placeholder')} />
            </Form.Group>
            <Button variant="primary" type="submit" className="w-100">{t('project_view.modal_insp_create')}</Button>
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
              `${t('project_results.save_button')} ${expandedImageIndex + 1} de ${activeInspection.images.length} — ${path.basename(activeInspection.images[expandedImageIndex].url)}`
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
                src={activeInspection.images[expandedImageIndex].url} 
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
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>{t('projects.modal_create_title')}</Modal.Title></Modal.Header>
        <Modal.Body>
          {showConfirmEdit ? (
            <div className="text-center py-4">
              <h4 className="mb-3 fw-bold text-warning">Confirmar Alterações?</h4>
              <p className="text-muted mb-4 text-center mx-auto" style={{ maxWidth: '450px' }}>
                Você tem certeza de que deseja salvar as novas informações do projeto? 
                Esta ação atualizará as especificações técnicas de forma permanente.
              </p>
              <div className="d-flex gap-3 justify-content-center">
                <Button variant="outline-secondary" className="px-4" onClick={() => setShowConfirmEdit(false)}>
                  Voltar e Editar
                </Button>
                <Button variant="primary" className="px-4" onClick={() => handleUpdateProject()}>
                  Confirmar e Salvar
                </Button>
              </div>
            </div>
          ) : (
            <Form onSubmit={handleSubmitEditForm}>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>{t('projects.modal_project_name')}</Form.Label>
                    <Form.Control 
                      required 
                      value={editFormData.name || ''} 
                      onChange={e => setEditFormData({ ...editFormData, name: e.target.value })} 
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>{t('projects.modal_responsible')}</Form.Label>
                    <Form.Control 
                      required 
                      value={editFormData.responsible || ''} 
                      onChange={e => setEditFormData({ ...editFormData, responsible: e.target.value })} 
                    />
                  </Form.Group>
                </Col>
                <Col md={12}>
                  <Form.Group className="mb-3">
                    <Form.Label>{t('projects.modal_address')}</Form.Label>
                    <Form.Control 
                      value={editFormData.address || ''} 
                      onChange={e => setEditFormData({ ...editFormData, address: e.target.value })} 
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>{t('projects.modal_building_year')}</Form.Label>
                    <Form.Control 
                      type="text" 
                      placeholder="Ex: 2020" 
                      value={editFormData.buildingYear || ''} 
                      onChange={e => setEditFormData({ ...editFormData, buildingYear: e.target.value })} 
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>{t('projects.modal_built_area')}</Form.Label>
                    <Form.Control 
                      type="text" 
                      placeholder="Ex: 150" 
                      value={editFormData.builtArea || ''} 
                      onChange={e => setEditFormData({ ...editFormData, builtArea: e.target.value })} 
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>{t('projects.modal_roof_typology')}</Form.Label>
                    <Form.Select 
                      value={editFormData.roofTypology || ''} 
                      onChange={e => setEditFormData({ ...editFormData, roofTypology: e.target.value })}
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
              <Button variant="primary" type="submit" className="w-100 mt-3">{t('profile.save_button')}</Button>
            </Form>
          )}
        </Modal.Body>
      </Modal>

      {/* MODAL DE FEEDBACK DE MANUTENÇÃO */}
      {activeInspection && project && (
        <MaintenanceFeedback 
          show={showMaintenanceModal}
          onHide={() => setShowMaintenanceModal(false)}
          inspection={activeInspection}
          projectId={project.id}
          onUpdate={fetchProject}
        />
      )}

    </div>
  );
};

export default ProjectView;
