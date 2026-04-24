import React, { useState } from 'react';
import { Modal, Table, Form, Button, Badge, Row, Col } from 'react-bootstrap';
import { FaCheck, FaTools, FaUndo, FaCircle, FaUser, FaCalendarAlt, FaCommentAlt, FaExclamationTriangle } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import type { IDetection, IGeoDetection, IInspection } from '../../models/IProject';
import './style.css';

interface MaintenanceFeedbackProps {
  show: boolean;
  onHide: () => void;
  inspection: IInspection;
  projectId: string;
  onUpdate: () => void;
}

interface GroupedDetection {
  className: string;
  status: 'pending' | 'resolved';
  maintenanceAt?: string;
  maintenanceResponsible?: string;
  maintenanceNotes?: string;
  detectionIds: string[];
  count: number;
}

const MaintenanceFeedback: React.FC<MaintenanceFeedbackProps> = ({ 
  show, 
  onHide, 
  inspection, 
  projectId,
  onUpdate 
}) => {
  const { t } = useTranslation();
  const [updatingClass, setUpdatingClass] = useState<string | null>(null);
  const [showResolveModal, setShowResolveModal] = useState<GroupedDetection | null>(null);
  
  const [resolveForm, setResolveForm] = useState({
    maintenanceAt: new Date().toISOString().split('T')[0],
    maintenanceResponsible: localStorage.getItem('user_name') || '',
    maintenanceNotes: ''
  });

  // Agrupamento por Classe (Deduplicação Gerencial)
  const groupedMap = new Map<string, GroupedDetection>();
  
  const processDetection = (det: IDetection | IGeoDetection) => {
    const className = det.class_name;
    const existing = groupedMap.get(className);
    
    if (existing) {
      existing.detectionIds.push(det.id);
      existing.count += 1;
      // Se houver conflito de status, prevalece o pendente para segurança gerencial
      if (det.status === 'pending') existing.status = 'pending';
    } else {
      groupedMap.set(className, {
        className,
        status: det.status || 'pending',
        maintenanceAt: det.maintenanceAt,
        maintenanceResponsible: det.maintenanceResponsible,
        maintenanceNotes: det.maintenanceNotes,
        detectionIds: [det.id],
        count: 1
      });
    }
  };

  inspection.images.forEach(img => img.detections?.forEach(processDetection));
  inspection.orthoResults?.forEach(ortho => ortho.detections.forEach(processDetection));

  const groupedDetections = Array.from(groupedMap.values());

  const handleToggleStatus = async (group: GroupedDetection) => {
    if (group.status === 'resolved') {
      setUpdatingClass(group.className);
      try {
        await api.patch(`/projects/${projectId}/inspections/${inspection.id}/detections`, {
          detectionIds: group.detectionIds,
          status: 'pending',
          maintenanceAt: null,
          maintenanceResponsible: null,
          maintenanceNotes: null
        });
        onUpdate();
      } catch (err) {
        console.error(err);
      } finally {
        setUpdatingClass(null);
      }
    } else {
      setResolveForm({
        maintenanceAt: new Date().toISOString().split('T')[0],
        maintenanceResponsible: localStorage.getItem('user_name') || '',
        maintenanceNotes: ''
      });
      setShowResolveModal(group);
    }
  };

  const submitResolution = async () => {
    if (!showResolveModal) return;
    setUpdatingClass(showResolveModal.className);
    
    try {
      await api.patch(`/projects/${projectId}/inspections/${inspection.id}/detections`, {
        detectionIds: showResolveModal.detectionIds,
        status: 'resolved',
        ...resolveForm
      });
      setShowResolveModal(null);
      onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingClass(null);
    }
  };

  return (
    <>
      <Modal show={show} onHide={onHide} size="xl" centered className="maintenance-modal-v2">
        <Modal.Header closeButton className="border-0 px-4 pt-4">
          <Modal.Title className="h5 fw-bold d-flex align-items-center gap-2">
            <div className="bg-success-soft p-2 rounded-3">
              <FaTools className="text-success" size={18} />
            </div>
            {t('project_view.maintenance_feedback_title', 'Controle de Patologias e Manutenção')}
          </Modal.Title>
        </Modal.Header>
        
        <Modal.Body className="px-4 pb-4">
          <div className="inspection-summary-bar mb-4">
            <div className="d-flex align-items-center gap-4 py-2 px-3 bg-faint rounded-3 border shadow-sm">
              <div>
                <label className="label-tiny">Inspeção</label>
                <div className="fw-semibold small">{inspection.inspectionObjective}</div>
              </div>
              <div className="vr opacity-10"></div>
              <div>
                <label className="label-tiny">Data</label>
                <div className="fw-semibold small">{inspection.inspectionDate}</div>
              </div>
              <div className="ms-auto d-flex gap-2">
                <Badge bg="success-soft" className="text-success border border-success border-opacity-10 px-3 py-2">
                  {groupedDetections.filter(d => d.status === 'resolved').length} Tipos Resolvidos
                </Badge>
                <Badge bg="warning-soft" className="text-warning border border-warning border-opacity-10 px-3 py-2">
                  {groupedDetections.filter(d => d.status !== 'resolved').length} Tipos Pendentes
                </Badge>
              </div>
            </div>
          </div>

          <div className="table-responsive custom-table-wrapper rounded-4 border">
            <Table borderless hover className="align-middle mb-0">
              <thead className="bg-light">
                <tr className="border-bottom">
                  <th className="text-muted small fw-bold text-uppercase py-3 ps-4">Patologia / Classe</th>
                  <th className="text-muted small fw-bold text-uppercase py-3">Ocorrências</th>
                  <th className="text-muted small fw-bold text-uppercase py-3">Status Atual</th>
                  <th className="text-muted small fw-bold text-uppercase py-3">Última Correção</th>
                  <th className="text-muted small fw-bold text-uppercase py-3 text-center">Ações de Gestão</th>
                </tr>
              </thead>
              <tbody>
                {groupedDetections.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-5 text-muted opacity-50">
                      <FaExclamationTriangle size={24} className="mb-2 d-block mx-auto" />
                      Nenhuma patologia identificada para controle.
                    </td>
                  </tr>
                ) : (
                  groupedDetections.map((group) => (
                    <tr key={group.className} className={`item-row ${group.status === 'resolved' ? 'resolved' : ''}`}>
                      <td className="fw-bold py-4 ps-4">
                        <div className="d-flex align-items-center gap-3">
                          <div className={`status-indicator ${group.status === 'resolved' ? 'bg-success' : 'bg-warning'}`}></div>
                          <span className="text-capitalize">{group.className.replace(/_/g, ' ')}</span>
                        </div>
                      </td>
                      <td>
                        <Badge bg="secondary-soft" className="text-secondary border fw-bold">
                          {group.count} instâncias
                        </Badge>
                      </td>
                      <td>
                        <Badge bg={group.status === 'resolved' ? 'success' : 'warning-soft'} className={group.status === 'resolved' ? 'px-3' : 'text-warning px-3'}>
                          {group.status === 'resolved' ? 'Corrigido' : 'Pendente'}
                        </Badge>
                      </td>
                      <td className="small text-muted font-monospace">
                        {group.status === 'resolved' ? (
                          <div>
                            <div className="fw-bold text-dark">{group.maintenanceAt}</div>
                            <div className="x-small">por {group.maintenanceResponsible}</div>
                          </div>
                        ) : '---'}
                      </td>
                      <td className="text-center pe-4">
                        <Button 
                          variant={group.status === 'resolved' ? 'outline-light' : 'success'}
                          size="sm"
                          className={`action-btn-v2 ${group.status === 'resolved' ? 'text-muted' : 'shadow-sm'}`}
                          disabled={updatingClass === group.className}
                          onClick={() => handleToggleStatus(group)}
                        >
                          {group.status === 'resolved' ? <><FaUndo size={10} className="me-1" /> Reabrir Classe</> : <><FaCheck size={10} className="me-1" /> Resolver Tudo</>}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
      </Modal>

      {/* MODAL PROFISSIONAL DE RESOLUÇÃO */}
      <Modal show={!!showResolveModal} onHide={() => setShowResolveModal(null)} centered className="resolve-details-modal">
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="h6 fw-bold">Registrar Correção em Massa</Modal.Title>
        </Modal.Header>
        <Modal.Body className="px-4 pb-4">
          <div className="mb-4 selected-pathology-box shadow-sm">
            <div className="text-success small fw-bold text-uppercase mb-1">Patologia Selecionada</div>
            <div className="pathology-name text-capitalize">{showResolveModal?.className.replace(/_/g, ' ')}</div>
            <div className="text-muted small mt-2">Isto marcará as <strong>{showResolveModal?.count} ocorrências</strong> desta patologia como resolvidas.</div>
          </div>
          
          <Form>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="label-tiny-dark"><FaCalendarAlt className="me-1" /> Data da Correção</Form.Label>
                  <Form.Control 
                    type="date" 
                    className="modern-input"
                    value={resolveForm.maintenanceAt}
                    onChange={e => setResolveForm({...resolveForm, maintenanceAt: e.target.value})}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="label-tiny-dark"><FaUser className="me-1" /> Responsável Técnico</Form.Label>
                  <Form.Control 
                    type="text" 
                    className="modern-input"
                    placeholder="Nome do engenheiro/técnico"
                    value={resolveForm.maintenanceResponsible}
                    onChange={e => setResolveForm({...resolveForm, maintenanceResponsible: e.target.value})}
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label className="label-tiny-dark"><FaCommentAlt className="me-1" /> Notas de Execução</Form.Label>
                  <Form.Control 
                    as="textarea" 
                    rows={4} 
                    className="modern-input"
                    placeholder="Descreva detalhadamente a técnica corretiva utilizada e materiais aplicados..."
                    value={resolveForm.maintenanceNotes}
                    onChange={e => setResolveForm({...resolveForm, maintenanceNotes: e.target.value})}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer className="border-0 px-4 pb-4">
          <Button variant="link" className="text-muted text-decoration-none fw-bold" onClick={() => setShowResolveModal(null)}>Cancelar</Button>
          <Button variant="success" className="px-4 fw-bold shadow-sm" onClick={submitResolution} disabled={updatingClass !== null}>
            {updatingClass ? 'Processando...' : 'Confirmar e Resolver Todas'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default MaintenanceFeedback;
