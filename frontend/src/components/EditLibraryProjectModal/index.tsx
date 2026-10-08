import React, { useState, useEffect, useRef } from 'react';
import { Modal, Form, Button, Row, Col, Spinner } from 'react-bootstrap';
import { FaEdit, FaTimes } from 'react-icons/fa';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../config/firebase';
import api from '../../services/api';
import type { IProject } from '../../models/IProject';

interface EditLibraryProjectModalProps {
  show: boolean;
  onHide: () => void;
  project: IProject | null;
  onSuccess: (updatedProject: IProject) => void;
}

const STANDARD_FACADES = [
  'Argamassa / Pintura',
  'Pastilha',
  'Cerâmica',
  'Concreto Aparente',
  'Vidro / Pele de Vidro',
  'Metálica / ACM',
  'Mista',
  ''
];

const STANDARD_ROOFS = [
  'Fibrocimento',
  'Cerâmico',
  'Concreto',
  'Metálico',
  'Misto',
  ''
];

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1541888946425-d0fbb1861564?auto=format&fit=crop&w=800&q=80';

const EditLibraryProjectModal: React.FC<EditLibraryProjectModalProps> = ({
  show,
  onHide,
  project,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState('Edifício');
  const [responsible, setResponsible] = useState('');
  const [buildingAcronym, setBuildingAcronym] = useState('');
  const [unitDirector, setUnitDirector] = useState('');
  const [buildingYear, setBuildingYear] = useState('');
  const [builtArea, setBuiltArea] = useState('');
  const [facadeTypology, setFacadeTypology] = useState('');
  const [roofTypology, setRoofTypology] = useState('');
  const [customFacade, setCustomFacade] = useState(false);
  const [customRoof, setCustomRoof] = useState(false);

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (project && show) {
      setName(project.name || '');
      setAddress(project.address || '');
      setType(project.type || 'Edifício');
      setResponsible(project.responsible || '');
      setBuildingAcronym(project.buildingAcronym || '');
      setUnitDirector(project.unitDirector || '');
      setBuildingYear(project.buildingYear || '');
      setBuiltArea(project.builtArea || '');

      const isCustomFacade = !!project.facadeTypology && !STANDARD_FACADES.includes(project.facadeTypology);
      setCustomFacade(isCustomFacade);
      setFacadeTypology(project.facadeTypology || '');

      const isCustomRoof = !!project.roofTypology && !STANDARD_ROOFS.includes(project.roofTypology);
      setCustomRoof(isCustomRoof);
      setRoofTypology(project.roofTypology || '');

      setCoverFile(null);
      setCoverPreview(project.coverImageUrl || DEFAULT_COVER);
      if (coverFileInputRef.current) coverFileInputRef.current.value = '';
    }
  }, [project, show]);

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveCover = () => {
    setCoverFile(null);
    setCoverPreview(DEFAULT_COVER);
    if (coverFileInputRef.current) coverFileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;

    setSubmitting(true);
    try {
      let finalCoverUrl = coverPreview || project.coverImageUrl || DEFAULT_COVER;

      if (coverFile) {
        const sanitizedName = coverFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `library/covers/${Date.now()}_${sanitizedName}`;
        const storageRef = ref(storage, storagePath);
        const snapshot = await uploadBytes(storageRef, coverFile);
        finalCoverUrl = await getDownloadURL(snapshot.ref);
      }

      const payload = {
        name,
        address,
        type,
        responsible,
        buildingAcronym,
        unitDirector,
        buildingYear,
        builtArea,
        facadeTypology,
        roofTypology,
        coverImageUrl: finalCoverUrl,
      };

      const response = await api.put(`/projects/${project.id}`, payload);
      onSuccess(response.data);
      onHide();
    } catch (err) {
      console.error('Erro ao atualizar informações da edificação:', err);
      alert('Erro ao salvar as alterações da edificação.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold d-flex align-items-center gap-2">
            <FaEdit style={{ color: '#10b981' }} /> Editar Informações da Edificação
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row>
            <Col md={8}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Nome do Projeto / Edificação *</Form.Label>
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
                <Form.Label className="fw-semibold">Sigla da Edificação <span className="text-muted fw-normal small">(opcional)</span></Form.Label>
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
                <Form.Label className="fw-semibold">Endereço / Localização *</Form.Label>
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
                <Form.Label className="fw-semibold">Diretor / Unidade <span className="text-muted fw-normal small">(opcional)</span></Form.Label>
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
                <Form.Label className="fw-semibold">Geral / Tipologia</Form.Label>
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
                <Form.Label className="fw-semibold">Responsável Técnico</Form.Label>
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
                <Form.Label className="fw-semibold">Ano Construído <span className="text-muted fw-normal small">(opcional)</span></Form.Label>
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
                <Form.Label className="fw-semibold">Área Quadrada (m²) <span className="text-muted fw-normal small">(opcional)</span></Form.Label>
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
              Sistemas Construtivos
            </h6>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-semibold">Fachada <span className="text-muted fw-normal small">(opcional)</span></Form.Label>
                  <Form.Select 
                    value={STANDARD_FACADES.includes(facadeTypology) && !customFacade ? facadeTypology : 'Outro'} 
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
                  <Form.Label className="fw-semibold">Telhado e Cobertura <span className="text-muted fw-normal small">(opcional)</span></Form.Label>
                  <Form.Select 
                    value={STANDARD_ROOFS.includes(roofTypology) && !customRoof ? roofTypology : 'Outro'} 
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

          {/* FOTO DE CAPA */}
          <div className="border-top pt-3 mt-2">
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">Imagem de Capa <span className="text-muted fw-normal small">(opcional)</span></Form.Label>
              <Form.Control 
                type="file" 
                accept="image/*"
                ref={coverFileInputRef}
                onChange={handleCoverFileChange} 
              />
              <Form.Text className="text-muted small">
                Faça o upload de uma nova imagem para substituir a foto de capa atual
              </Form.Text>
              {coverPreview && (
                <div className="mt-3 position-relative d-inline-block">
                  <img 
                    src={coverPreview} 
                    alt="Prévia da capa" 
                    style={{ maxHeight: '160px', maxWidth: '100%', borderRadius: '8px', objectFit: 'cover' }} 
                    className="border shadow-sm"
                  />
                  <Button 
                    variant="danger" 
                    size="sm" 
                    className="position-absolute top-0 end-0 m-1 p-0 d-flex align-items-center justify-content-center"
                    style={{ width: '24px', height: '24px', borderRadius: '50%' }}
                    onClick={handleRemoveCover}
                    title="Remover / Redefinir imagem"
                  >
                    <FaTimes size={12} />
                  </Button>
                </div>
              )}
            </Form.Group>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={submitting}>
            Cancelar
          </Button>
          <Button 
            variant="primary" 
            type="submit" 
            disabled={submitting}
            style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
          >
            {submitting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Salvando alterações...
              </>
            ) : (
              'Salvar Alterações'
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default EditLibraryProjectModal;
