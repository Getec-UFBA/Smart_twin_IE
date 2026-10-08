import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Container, Button, Modal, Form, Badge, ProgressBar, Row, Col } from 'react-bootstrap';
import { 
  FaArrowLeft, 
  FaFolder, 
  FaCalendarAlt, 
  FaPlus, 
  FaTrashAlt, 
  FaCloudUploadAlt, 
  FaDownload, 
  FaExpand, 
  FaSearch, 
  FaThLarge, 
  FaList, 
  FaChevronLeft, 
  FaChevronRight, 
  FaTimes, 
  FaFileImage, 
  FaDraftingCompass, 
  FaCube, 
  FaMapMarkedAlt, 
  FaFileAlt,
  FaInfoCircle,
  FaEdit
} from 'react-icons/fa';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../config/firebase';
import type { IProject, IInspection, IImage, ILibraryFile, IPhotogrammetryBatch } from '../../models/IProject';
import EditLibraryProjectModal from '../../components/EditLibraryProjectModal';
import './style.css';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 9);

type ActiveTabType = 'inspections' | 'cad' | 'bim' | 'photogrammetry';

const BibliotecaView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<IProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTabType>('inspections');

  // --- EDIÇÃO DA EDIFICAÇÃO (PROJETO) ---
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);

  // --- PILAR 1: INSPEÇÕES (SEPARADAS POR DATA) ---
  const [activeInspection, setActiveInspection] = useState<IInspection | null>(null);
  const [showCreateInspModal, setShowCreateInspModal] = useState(false);
  const [newInspObjective, setNewInspObjective] = useState('');
  const [newInspType, setNewInspType] = useState('Visual');
  const [newInspDate, setNewInspDate] = useState('');
  const [newInspResponsible, setNewInspResponsible] = useState(user?.name || '');
  const [creatingInsp, setCreatingInsp] = useState(false);

  // Edição de inspeção
  const [showEditInspModal, setShowEditInspModal] = useState(false);
  const [editInspObjective, setEditInspObjective] = useState('');
  const [editInspType, setEditInspType] = useState('Visual');
  const [editInspDate, setEditInspDate] = useState('');
  const [editInspResponsible, setEditInspResponsible] = useState('');
  const [savingInsp, setSavingInsp] = useState(false);

  // Upload de fotos da inspeção
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isPhotoDragging, setIsPhotoDragging] = useState(false);
  const [photoUploadProgress, setPhotoUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [searchPhotoTerm, setSearchPhotoTerm] = useState('');
  const [photoViewMode, setPhotoViewMode] = useState<'grid' | 'list'>('grid');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [imageToDelete, setImageToDelete] = useState<IImage | null>(null);
  const [inspectionToDelete, setInspectionToDelete] = useState<IInspection | null>(null);

  // --- PILAR 2: PROJETOS CAD ---
  const cadInputRef = useRef<HTMLInputElement>(null);
  const [showCadModal, setShowCadModal] = useState(false);
  const [cadCategory, setCadCategory] = useState('Arquitetura');
  const [uploadingCad, setUploadingCad] = useState(false);
  const [cadToDelete, setCadToDelete] = useState<ILibraryFile | null>(null);

  // --- PILAR 3: PROJETOS BIM ---
  const bimInputRef = useRef<HTMLInputElement>(null);
  const [showBimModal, setShowBimModal] = useState(false);
  const [uploadingBim, setUploadingBim] = useState(false);
  const [bimToDelete, setBimToDelete] = useState<ILibraryFile | null>(null);

  // --- PILAR 4: PRODUTOS FOTOGRAMÉTRICOS (SEPARADOS POR DATA) ---
  const [activeBatch, setActiveBatch] = useState<IPhotogrammetryBatch | null>(null);
  const [showCreateBatchModal, setShowCreateBatchModal] = useState(false);
  const [batchTitle, setBatchTitle] = useState('');
  const [batchDate, setBatchDate] = useState('');
  const [batchResponsible, setBatchResponsible] = useState(user?.name || '');
  const [batchDescription, setBatchDescription] = useState('');
  const [creatingBatch, setCreatingBatch] = useState(false);
  const photoGramInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhotoGram, setUploadingPhotoGram] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<IPhotogrammetryBatch | null>(null);
  const [photoGramFileToDelete, setPhotoGramFileToDelete] = useState<ILibraryFile | null>(null);

  // Edição de lote fotogramétrico
  const [showEditBatchModal, setShowEditBatchModal] = useState(false);
  const [editBatchTitle, setEditBatchTitle] = useState('');
  const [editBatchDate, setEditBatchDate] = useState('');
  const [editBatchResponsible, setEditBatchResponsible] = useState('');
  const [editBatchDescription, setEditBatchDescription] = useState('');
  const [savingBatch, setSavingBatch] = useState(false);

  const fetchProject = async () => {
    if (!id) return;
    try {
      const response = await api.get(`/projects/${id}`);
      const data: IProject = response.data;
      setProject(data);

      // Sincroniza inspeção ativa com TODAS as inspeções do projeto
      const allInspList = data.inspections || [];
      if (allInspList.length > 0) {
        setActiveInspection(prev => {
          if (prev) {
            const found = allInspList.find(i => i.id === prev.id);
            return found || allInspList[0];
          }
          return allInspList[0];
        });
      } else {
        setActiveInspection(null);
      }

      // Sincroniza lote fotogramétrico ativo (manuais + ortomosaicos de inspeções)
      const batchList: IPhotogrammetryBatch[] = [...(data.photogrammetryProducts || [])];
      data.inspections?.forEach(insp => {
        if (insp.orthoResults && insp.orthoResults.length > 0) {
          batchList.push({
            id: `ortho-${insp.id}`,
            title: `Ortomosaico - ${insp.inspectionObjective}`,
            date: insp.inspectionDate || 'Sem data',
            responsible: insp.inspectionResponsible || 'Sistema',
            description: 'Gerado a partir do processamento fotogramétrico da inspeção',
            files: insp.orthoResults.map((ortho, idx) => ({
              id: `ortho-file-${insp.id}-${idx}`,
              name: ortho.originalName || `Ortomosaico_${idx + 1}.tif`,
              url: ortho.url,
              uploadedAt: insp.inspectionDate || '',
              format: 'GeoTIFF / Ortomosaico'
            }))
          });
        }
      });

      if (batchList.length > 0) {
        setActiveBatch(prev => {
          if (prev) {
            const found = batchList.find(b => b.id === prev.id);
            return found || batchList[0];
          }
          return batchList[0];
        });
      } else {
        setActiveBatch(null);
      }
    } catch (err) {
      console.error('Erro ao carregar edificação da biblioteca:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [id]);

  // Todas as inspeções do projeto ordenadas pela data (mais recentes primeiro)
  const inspectionsList = useMemo(() => {
    const list = project?.inspections || [];
    return [...list].sort((a, b) => {
      const dateA = new Date(a.inspectionDate).getTime() || 0;
      const dateB = new Date(b.inspectionDate).getTime() || 0;
      return dateB - dateA;
    });
  }, [project]);

  // Modelos BIM incluindo o modelo principal do projeto
  const allBimFiles = useMemo(() => {
    const files = [...(project?.bimFiles || [])];
    if (project?.bimModelUrl && !files.some(f => f.url === project.bimModelUrl)) {
      files.unshift({
        id: 'main-bim-model',
        name: `${project.name} - Modelo BIM Principal`,
        url: project.bimModelUrl,
        uploadedAt: 'Cadastro do Projeto',
        format: 'IFC / BIM',
      });
    }
    return files;
  }, [project]);

  // Produtos fotogramétricos unindo lotes manuais e ortomosaicos de inspeções
  const allPhotogrammetryBatches = useMemo(() => {
    const manualBatches = project?.photogrammetryProducts || [];
    const orthoBatches: IPhotogrammetryBatch[] = [];

    project?.inspections?.forEach(insp => {
      if (insp.orthoResults && insp.orthoResults.length > 0) {
        orthoBatches.push({
          id: `ortho-${insp.id}`,
          title: `Ortomosaico - ${insp.inspectionObjective}`,
          date: insp.inspectionDate || 'Sem data',
          responsible: insp.inspectionResponsible || 'Sistema',
          description: 'Gerado a partir do processamento fotogramétrico da inspeção',
          files: insp.orthoResults.map((ortho, idx) => ({
            id: `ortho-file-${insp.id}-${idx}`,
            name: ortho.originalName || `Ortomosaico_${idx + 1}.tif`,
            url: ortho.url,
            uploadedAt: insp.inspectionDate || '',
            format: 'GeoTIFF / Ortomosaico'
          }))
        });
      }
    });

    return [...manualBatches, ...orthoBatches];
  }, [project]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownloadFile = (url: string, filename?: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.download = filename || 'arquivo';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==========================================
  // HANDLERS: PILAR 1 - INSPEÇÕES PASSADAS
  // ==========================================
  const handleCreateInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    setCreatingInsp(true);
    try {
      const payload = {
        inspectionObjective: newInspObjective.trim(),
        inspectionType: newInspType,
        inspectionDate: newInspDate,
        inspectionResponsible: newInspResponsible.trim() || user?.name || 'Responsável',
        isPast: true,
      };

      const response = await api.post(`/projects/${project.id}/inspections`, payload);
      const created: IInspection = response.data;
      setShowCreateInspModal(false);
      setNewInspObjective('');
      setNewInspDate('');
      await fetchProject();
      setActiveInspection(created);
    } catch (err: any) {
      console.error('Erro ao criar inspeção:', err);
      alert(err.response?.data?.error || 'Erro ao criar inspeção.');
    } finally {
      setCreatingInsp(false);
    }
  };

  const handlePhotosUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !project || !activeInspection) return;
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (fileArray.length === 0) {
      alert('Selecione arquivos de imagem válidos.');
      return;
    }

    setUploadingPhotos(true);
    setPhotoUploadProgress({ current: 0, total: fileArray.length });
    const uploadedImages: IImage[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setPhotoUploadProgress({ current: i + 1, total: fileArray.length });
      try {
        const fileExt = file.name.split('.').pop() || 'jpg';
        const uniqueFileName = `${generateId()}.${fileExt}`;
        const storagePath = `projects/${project.id}/inspections/${activeInspection.id}/images/${uniqueFileName}`;
        const storageReference = ref(storage, storagePath);
        const snapshot = await uploadBytes(storageReference, file);
        const downloadUrl = await getDownloadURL(snapshot.ref);

        uploadedImages.push({
          url: downloadUrl,
          originalName: file.name,
          size: file.size,
        });
      } catch (uploadErr) {
        console.error(`Erro ao subir imagem ${file.name}:`, uploadErr);
      }
    }

    if (uploadedImages.length > 0) {
      try {
        await api.post(`/projects/${project.id}/inspections/${activeInspection.id}/images`, {
          images: uploadedImages
        });
        await fetchProject();
      } catch (apiErr) {
        console.error('Erro ao salvar imagens:', apiErr);
      }
    }

    setUploadingPhotos(false);
    setPhotoUploadProgress(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const confirmDeleteImage = async () => {
    if (!project || !activeInspection || !imageToDelete) return;
    try {
      const urlParts = imageToDelete.url.split('?')[0].split('/');
      const storageFile = decodeURIComponent(urlParts[urlParts.length - 1]);
      const imageName = storageFile.split('/').pop() || imageToDelete.originalName || 'image';
      await api.delete(`/projects/${project.id}/inspections/${activeInspection.id}/images/${encodeURIComponent(imageName)}`);
      setImageToDelete(null);
      if (lightboxIndex !== null) setLightboxIndex(null);
      await fetchProject();
    } catch (err) {
      alert('Erro ao excluir foto.');
    }
  };

  const confirmDeleteInspection = async () => {
    if (!project || !inspectionToDelete) return;
    try {
      await api.delete(`/projects/${project.id}/inspections/${inspectionToDelete.id}`);
      setInspectionToDelete(null);
      await fetchProject();
    } catch (err) {
      alert('Erro ao excluir inspeção.');
    }
  };

  const handleOpenEditInspection = (insp: IInspection) => {
    setEditInspObjective(insp.inspectionObjective || '');
    setEditInspType(insp.inspectionType || 'Visual');
    setEditInspDate(insp.inspectionDate || '');
    setEditInspResponsible(insp.inspectionResponsible || '');
    setShowEditInspModal(true);
  };

  const handleSaveInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !activeInspection) return;
    setSavingInsp(true);
    try {
      const payload = {
        inspectionObjective: editInspObjective,
        inspectionType: editInspType,
        inspectionDate: editInspDate,
        inspectionResponsible: editInspResponsible,
      };
      const response = await api.put(`/projects/${project.id}/inspections/${activeInspection.id}`, payload);
      const updatedProject: IProject = response.data;
      setProject(updatedProject);
      const updatedInsp = updatedProject.inspections?.find(i => i.id === activeInspection.id) || null;
      setActiveInspection(updatedInsp);
      setShowEditInspModal(false);
    } catch (err) {
      console.error('Erro ao salvar inspeção:', err);
      alert('Erro ao salvar as informações da inspeção.');
    } finally {
      setSavingInsp(false);
    }
  };

  const filteredPhotos = useMemo(() => {
    if (!activeInspection || !activeInspection.images) return [];
    if (!searchPhotoTerm.trim()) return activeInspection.images;
    const term = searchPhotoTerm.toLowerCase();
    return activeInspection.images.filter(img => 
      (img.originalName && img.originalName.toLowerCase().includes(term)) ||
      img.url.toLowerCase().includes(term)
    );
  }, [activeInspection, searchPhotoTerm]);

  // ==========================================
  // HANDLERS: PILAR 2 - PROJETOS CAD
  // ==========================================
  const handleCadUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !project) return;
    setUploadingCad(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const fileExt = file.name.split('.').pop()?.toUpperCase() || 'CAD';
        const uniqueName = `${generateId()}_${file.name}`;
        const storagePath = `projects/${project.id}/library/cad/${uniqueName}`;
        const storageReference = ref(storage, storagePath);
        const snapshot = await uploadBytes(storageReference, file);
        const downloadUrl = await getDownloadURL(snapshot.ref);

        const newCadFile: ILibraryFile = {
          id: generateId(),
          name: file.name,
          url: downloadUrl,
          size: file.size,
          uploadedAt: new Date().toLocaleDateString(),
          format: fileExt,
          category: cadCategory,
        };

        await api.post(`/projects/${project.id}/library/cad`, { file: newCadFile });
      } catch (err) {
        console.error('Erro ao enviar arquivo CAD:', err);
      }
    }

    setUploadingCad(false);
    setShowCadModal(false);
    if (cadInputRef.current) cadInputRef.current.value = '';
    await fetchProject();
  };

  const confirmDeleteCad = async () => {
    if (!project || !cadToDelete) return;
    try {
      await api.delete(`/projects/${project.id}/library/cad/${cadToDelete.id}`);
      setCadToDelete(null);
      await fetchProject();
    } catch (err) {
      alert('Erro ao excluir arquivo CAD.');
    }
  };

  // ==========================================
  // HANDLERS: PILAR 3 - PROJETOS BIM
  // ==========================================
  const handleBimUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !project) return;
    setUploadingBim(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const fileExt = file.name.split('.').pop()?.toUpperCase() || 'IFC';
        const uniqueName = `${generateId()}_${file.name}`;
        const storagePath = `projects/${project.id}/library/bim/${uniqueName}`;
        const storageReference = ref(storage, storagePath);
        const snapshot = await uploadBytes(storageReference, file);
        const downloadUrl = await getDownloadURL(snapshot.ref);

        const newBimFile: ILibraryFile = {
          id: generateId(),
          name: file.name,
          url: downloadUrl,
          size: file.size,
          uploadedAt: new Date().toLocaleDateString(),
          format: fileExt,
        };

        await api.post(`/projects/${project.id}/library/bim`, { file: newBimFile });
      } catch (err) {
        console.error('Erro ao enviar arquivo BIM:', err);
      }
    }

    setUploadingBim(false);
    setShowBimModal(false);
    if (bimInputRef.current) bimInputRef.current.value = '';
    await fetchProject();
  };

  const confirmDeleteBim = async () => {
    if (!project || !bimToDelete) return;
    try {
      await api.delete(`/projects/${project.id}/library/bim/${bimToDelete.id}`);
      setBimToDelete(null);
      await fetchProject();
    } catch (err) {
      alert('Erro ao excluir modelo BIM.');
    }
  };

  // ==========================================
  // HANDLERS: PILAR 4 - PRODUTOS FOTOGRAMÉTRICOS
  // ==========================================
  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    setCreatingBatch(true);
    try {
      const newBatch: IPhotogrammetryBatch = {
        id: generateId(),
        title: batchTitle.trim(),
        date: batchDate,
        responsible: batchResponsible.trim(),
        description: batchDescription.trim(),
        files: []
      };

      await api.post(`/projects/${project.id}/library/photogrammetry`, { batch: newBatch });
      setShowCreateBatchModal(false);
      setBatchTitle('');
      setBatchDate('');
      setBatchDescription('');
      await fetchProject();
      setActiveBatch(newBatch);
    } catch (err) {
      alert('Erro ao criar lote fotogramétrico.');
    } finally {
      setCreatingBatch(false);
    }
  };

  const handlePhotoGramFilesUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !project || !activeBatch) return;
    setUploadingPhotoGram(true);
    const uploadedList: ILibraryFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const fileExt = file.name.split('.').pop()?.toUpperCase() || 'DATA';
        const uniqueName = `${generateId()}_${file.name}`;
        const storagePath = `projects/${project.id}/library/photogrammetry/${activeBatch.id}/${uniqueName}`;
        const storageReference = ref(storage, storagePath);
        const snapshot = await uploadBytes(storageReference, file);
        const downloadUrl = await getDownloadURL(snapshot.ref);

        uploadedList.push({
          id: generateId(),
          name: file.name,
          url: downloadUrl,
          size: file.size,
          uploadedAt: new Date().toLocaleDateString(),
          format: fileExt,
        });
      } catch (err) {
        console.error('Erro ao enviar arquivo fotogramétrico:', err);
      }
    }

    if (uploadedList.length > 0) {
      await api.post(`/projects/${project.id}/library/photogrammetry/${activeBatch.id}/files`, {
        files: uploadedList
      });
      await fetchProject();
    }

    setUploadingPhotoGram(false);
    if (photoGramInputRef.current) photoGramInputRef.current.value = '';
  };

  const confirmDeleteBatch = async () => {
    if (!project || !batchToDelete) return;
    try {
      await api.delete(`/projects/${project.id}/library/photogrammetry/${batchToDelete.id}`);
      setBatchToDelete(null);
      await fetchProject();
    } catch (err) {
      alert('Erro ao excluir lote fotogramétrico.');
    }
  };

  const confirmDeletePhotoGramFile = async () => {
    if (!project || !activeBatch || !photoGramFileToDelete) return;
    try {
      await api.delete(`/projects/${project.id}/library/photogrammetry/${activeBatch.id}/files/${photoGramFileToDelete.id}`);
      setPhotoGramFileToDelete(null);
      await fetchProject();
    } catch (err) {
      alert('Erro ao excluir arquivo fotogramétrico.');
    }
  };

  const handleOpenEditBatch = (batch: IPhotogrammetryBatch) => {
    setEditBatchTitle(batch.title || '');
    setEditBatchDate(batch.date || '');
    setEditBatchResponsible(batch.responsible || '');
    setEditBatchDescription(batch.description || '');
    setShowEditBatchModal(true);
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !activeBatch) return;
    setSavingBatch(true);
    try {
      const payload = {
        title: editBatchTitle,
        date: editBatchDate,
        responsible: editBatchResponsible,
        description: editBatchDescription,
      };
      const response = await api.put(`/projects/${project.id}/library/photogrammetry/${activeBatch.id}`, payload);
      const updatedProject: IProject = response.data;
      setProject(updatedProject);
      const updatedBatch = updatedProject.photogrammetryProducts?.find(b => b.id === activeBatch.id) || null;
      setActiveBatch(updatedBatch);
      setShowEditBatchModal(false);
    } catch (err) {
      console.error('Erro ao salvar levantamento fotogramétrico:', err);
      alert('Erro ao salvar as alterações do levantamento.');
    } finally {
      setSavingBatch(false);
    }
  };

  if (loading) {
    return (
      <Container className="pt-5 text-center">
        <div className="spinner-border" style={{ color: '#10b981' }} role="status"></div>
        <p className="mt-2 text-muted">Carregando edificação...</p>
      </Container>
    );
  }

  if (!project) {
    return (
      <Container className="pt-5 text-center">
        <h4>Edificação não encontrada na biblioteca.</h4>
        <Button variant="primary" className="mt-3" onClick={() => navigate('/biblioteca')}>
          <FaArrowLeft className="me-2" /> Voltar à Biblioteca
        </Button>
      </Container>
    );
  }

  return (
    <div className="biblioteca-view-container animate-fade-in">
      <Container fluid className="px-lg-5">
        {/* TOPO: EDIFICAÇÃO X */}
        <div className="bib-view-top-bar mb-4">
          <Button 
            variant="outline-secondary" 
            className="d-inline-flex align-items-center gap-2 back-btn"
            onClick={() => navigate('/biblioteca')}
          >
            <FaArrowLeft /> {t('library.back_to_projects', 'Voltar aos Projetos da Biblioteca')}
          </Button>

          <div className="project-quick-info mt-3 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <FaFolder className="fs-3" style={{ color: '#10b981' }} />
                <h2 className="mb-0 fw-bold">{project.name}</h2>
                <Badge bg="primary" className="ms-2">{project.type}</Badge>
                {project.buildingAcronym && (
                  <Badge bg="secondary" className="ms-1">{project.buildingAcronym}</Badge>
                )}
              </div>
              <p className="text-muted mb-0 mt-1">
                {project.address} &bull; Responsável: {project.responsible || 'Engenharia'}
                {project.unitDirector && <span> &bull; Direção: {project.unitDirector}</span>}
              </p>
              {(project.buildingYear || project.builtArea || project.facadeTypology || project.roofTypology) && (
                <div className="d-flex flex-wrap gap-2 mt-2">
                  {project.buildingYear && (
                    <span className="badge bg-light text-dark border px-2 py-1">
                      <strong>Ano:</strong> {project.buildingYear}
                    </span>
                  )}
                  {project.builtArea && (
                    <span className="badge bg-light text-dark border px-2 py-1">
                      <strong>Área:</strong> {project.builtArea} m²
                    </span>
                  )}
                  {project.facadeTypology && (
                    <span className="badge bg-light text-dark border px-2 py-1">
                      <strong>Fachada:</strong> {project.facadeTypology}
                    </span>
                  )}
                  {project.roofTypology && (
                    <span className="badge bg-light text-dark border px-2 py-1">
                      <strong>Telhado/Cobertura:</strong> {project.roofTypology}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div>
              <Button
                variant="outline-primary"
                className="d-flex align-items-center gap-2"
                onClick={() => setShowEditProjectModal(true)}
              >
                <FaEdit /> Editar Edificação
              </Button>
            </div>
          </div>
        </div>

        {/* 4 PILARES DA EDIFICAÇÃO (IMAGE.PNG) */}
        <div className="pillars-nav-bar mb-4">
          <div className="pillars-grid">
            {/* PILAR 1 */}
            <button 
              className={`pillar-btn ${activeTab === 'inspections' ? 'active' : ''}`}
              onClick={() => setActiveTab('inspections')}
            >
              <div className="pillar-icon"><FaCalendarAlt style={{ color: '#10b981' }} /></div>
              <div className="pillar-text">
                <span className="pillar-title">Inspeções</span>
                <span className="pillar-sub">(separadas por data)</span>
              </div>
              <Badge bg="secondary" className="ms-auto pill-count">
                {inspectionsList.length}
              </Badge>
            </button>

            {/* PILAR 2 */}
            <button 
              className={`pillar-btn ${activeTab === 'cad' ? 'active' : ''}`}
              onClick={() => setActiveTab('cad')}
            >
              <div className="pillar-icon"><FaDraftingCompass style={{ color: '#10b981' }} /></div>
              <div className="pillar-text">
                <span className="pillar-title">Projetos CAD</span>
                <span className="pillar-sub">Plantas e Desenhos</span>
              </div>
              <Badge bg="secondary" className="ms-auto pill-count">
                {project.cadFiles?.length || 0}
              </Badge>
            </button>

            {/* PILAR 3 */}
            <button 
              className={`pillar-btn ${activeTab === 'bim' ? 'active' : ''}`}
              onClick={() => setActiveTab('bim')}
            >
              <div className="pillar-icon"><FaCube style={{ color: '#10b981' }} /></div>
              <div className="pillar-text">
                <span className="pillar-title">Projetos BIM</span>
                <span className="pillar-sub">Modelos Digitais</span>
              </div>
              <Badge bg="secondary" className="ms-auto pill-count">
                {allBimFiles.length}
              </Badge>
            </button>

            {/* PILAR 4 */}
            <button 
              className={`pillar-btn ${activeTab === 'photogrammetry' ? 'active' : ''}`}
              onClick={() => setActiveTab('photogrammetry')}
            >
              <div className="pillar-icon"><FaMapMarkedAlt style={{ color: '#10b981' }} /></div>
              <div className="pillar-text">
                <span className="pillar-title">Produtos fotogramétricos</span>
                <span className="pillar-sub">(separados por data)</span>
              </div>
              <Badge bg="secondary" className="ms-auto pill-count">
                {allPhotogrammetryBatches.length}
              </Badge>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CONTEÚDO DO PILAR 1: INSPEÇÕES SEPARADAS POR DATA         */}
        {/* ========================================================= */}
        {activeTab === 'inspections' && (
          <div className="tab-pane-content">
            {/* SELETOR DE INSPEÇÕES POR DATA */}
            <div className="past-inspections-selector-card mb-4">
              <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                <span className="fw-bold text-uppercase small text-muted">
                  <FaCalendarAlt className="me-2" style={{ color: '#10b981' }} />
                  Inspeções da Edificação ({inspectionsList.length})
                </span>
                <Button variant="primary" size="sm" onClick={() => setShowCreateInspModal(true)}>
                  <FaPlus className="me-1" /> Nova Inspeção
                </Button>
              </div>

              {inspectionsList.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <p className="mb-2">Nenhuma inspeção registrada para esta edificação.</p>
                  <Button variant="outline-primary" size="sm" onClick={() => setShowCreateInspModal(true)}>
                    <FaPlus className="me-1" /> Criar Inspeção Inicial
                  </Button>
                </div>
              ) : (
                <div className="past-inspections-scroll-list">
                  {inspectionsList.map((insp) => {
                    const isActive = activeInspection?.id === insp.id;
                    return (
                      <button
                        key={insp.id}
                        className={`past-insp-pill ${isActive ? 'active' : ''}`}
                        onClick={() => setActiveInspection(insp)}
                      >
                        <div className="pill-content">
                          <div className="pill-title">{insp.inspectionObjective}</div>
                          <div className="pill-sub">
                            <span>{insp.inspectionDate}</span>
                            <span>&bull;</span>
                            <span>{insp.images?.length || 0} fotos</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* GALERIA DE FOTOS DA INSPEÇÃO SELECIONADA */}
            {activeInspection && (
              <div className="active-inspection-card">
                <div className="inspection-header-bar">
                  <div>
                    <h3 className="mb-1 fw-bold">{activeInspection.inspectionObjective}</h3>
                    <div className="d-flex flex-wrap gap-3 text-secondary small align-items-center">
                      <span><strong>Data:</strong> {activeInspection.inspectionDate}</span>
                      <span><strong>Tipo:</strong> {activeInspection.inspectionType}</span>
                      <span><strong>Responsável:</strong> {activeInspection.inspectionResponsible}</span>
                      <span><strong>Total de Fotos:</strong> {activeInspection.images?.length || 0}</span>
                      {activeInspection.isPast ? (
                        <Badge bg="success" className="bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1">
                          Inspeção da Biblioteca
                        </Badge>
                      ) : (
                        <Badge bg="success" className="bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1">
                          Sincronizada do Projeto
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <Button 
                      variant="outline-secondary" 
                      size="sm"
                      className="d-flex align-items-center gap-1"
                      onClick={() => handleOpenEditInspection(activeInspection)}
                    >
                      <FaEdit /> Editar Inspeção
                    </Button>
                    {activeInspection.isPast && (
                      <Button 
                        variant="outline-danger" 
                        size="sm"
                        className="d-flex align-items-center gap-1"
                        onClick={() => setInspectionToDelete(activeInspection)}
                      >
                        <FaTrashAlt /> Excluir Inspeção
                      </Button>
                    )}
                  </div>
                </div>

                {/* DROPZONE DE UPLOAD - APENAS PARA INSPEÇÕES CRIADAS NA BIBLIOTECA */}
                {activeInspection.isPast ? (
                  <div 
                    className={`bib-upload-dropzone ${isPhotoDragging ? 'dragging' : ''} ${uploadingPhotos ? 'uploading' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setIsPhotoDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsPhotoDragging(false); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsPhotoDragging(false);
                      if (e.dataTransfer.files) handlePhotosUpload(e.dataTransfer.files);
                    }}
                    onClick={() => !uploadingPhotos && photoInputRef.current?.click()}
                  >
                    <input 
                      type="file" 
                      ref={photoInputRef} 
                      multiple 
                      accept="image/*" 
                      className="d-none" 
                      onChange={(e) => handlePhotosUpload(e.target.files)} 
                    />

                    {uploadingPhotos ? (
                      <div className="upload-progress-box">
                        <div className="spinner-border text-success mb-2" role="status"></div>
                        <h5>
                          {photoUploadProgress 
                            ? `Enviando ${photoUploadProgress.current} de ${photoUploadProgress.total} imagens...`
                            : 'Fazendo upload...'}
                        </h5>
                        {photoUploadProgress && (
                          <ProgressBar 
                            now={(photoUploadProgress.current / photoUploadProgress.total) * 100} 
                            variant="success"
                            className="mt-2 w-75 mx-auto" 
                          />
                        )}
                      </div>
                    ) : (
                      <div className="upload-idle-box">
                        <FaCloudUploadAlt className="upload-cloud-icon" style={{ color: '#10b981' }} />
                        <h4>Arraste e solte fotos da inspeção aqui</h4>
                        <p className="text-muted mb-3">
                          ou clique para selecionar fotos do seu computador (suporta múltiplas imagens)
                        </p>
                        <Button variant="primary" size="sm" className="px-4">
                          <FaCloudUploadAlt className="me-2" /> Upload de Imagens
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="project-inspection-readonly-banner mb-4 p-3 rounded-3 d-flex align-items-center gap-3">
                    <FaInfoCircle className="fs-3 flex-shrink-0" style={{ color: '#10b981' }} />
                    <div className="small">
                      <div className="fw-bold" style={{ color: 'var(--bs-body-color)' }}>
                        Inspeção sincronizada da aba de Projetos
                      </div>
                      <div className="text-muted">
                        Esta inspeção foi criada diretamente no projeto. O upload e gerenciamento de novas fotos devem ser realizados na aba de Projetos.
                      </div>
                    </div>
                  </div>
                )}

                {/* CONTROLES E GALERIA */}
                {activeInspection.images && activeInspection.images.length > 0 && (
                  <div className="bib-gallery-controls mt-4 mb-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div className="search-image-box">
                      <FaSearch className="search-icon" style={{ color: '#10b981' }} />
                      <input 
                        type="text" 
                        placeholder="Buscar fotos por nome..."
                        value={searchPhotoTerm}
                        onChange={(e) => setSearchPhotoTerm(e.target.value)}
                      />
                    </div>
                    <div className="view-toggle-btns d-flex border rounded overflow-hidden">
                      <button 
                        className={`btn-mode ${photoViewMode === 'grid' ? 'active' : ''}`}
                        onClick={() => setPhotoViewMode('grid')}
                      >
                        <FaThLarge style={{ color: photoViewMode === 'grid' ? '#10b981' : undefined }} />
                      </button>
                      <button 
                        className={`btn-mode ${photoViewMode === 'list' ? 'active' : ''}`}
                        onClick={() => setPhotoViewMode('list')}
                      >
                        <FaList style={{ color: photoViewMode === 'list' ? '#10b981' : undefined }} />
                      </button>
                    </div>
                  </div>
                )}

                {activeInspection.images && activeInspection.images.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <FaFileImage className="fs-1 mb-2" style={{ color: '#10b981', opacity: 0.5 }} />
                    <p>Nenhuma foto adicionada nesta inspeção ainda.</p>
                  </div>
                ) : photoViewMode === 'grid' ? (
                  <div className="bib-images-grid">
                    {filteredPhotos.map((img, idx) => (
                      <div key={idx} className="bib-image-card">
                        <div className="card-image-box" onClick={() => setLightboxIndex(idx)}>
                          <img src={img.url} alt={img.originalName || 'Foto'} loading="lazy" />
                          <div className="card-image-overlay">
                            <button className="overlay-btn view"><FaExpand style={{ color: '#10b981' }} /></button>
                          </div>
                        </div>
                        <div className="card-details-box">
                          <span className="card-filename truncate">{img.originalName || `foto-${idx + 1}.jpg`}</span>
                          {img.size && <span className="card-filesize text-muted">{formatFileSize(img.size)}</span>}
                          <div className="card-actions-bar mt-2 d-flex justify-content-between">
                            <Button variant="outline-secondary" size="sm" onClick={() => handleDownloadFile(img.url, img.originalName)}>
                              <FaDownload style={{ color: '#10b981' }} />
                            </Button>
                            {activeInspection.isPast && (
                              <Button variant="outline-danger" size="sm" onClick={() => setImageToDelete(img)}>
                                <FaTrashAlt />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bib-images-table-wrapper table-responsive">
                    <table className="bib-images-table">
                      <thead>
                        <tr>
                          <th style={{ width: '80px' }}>Miniatura</th>
                          <th>Nome do Arquivo</th>
                          <th>Tamanho</th>
                          <th className="text-end">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPhotos.map((img, idx) => (
                          <tr key={idx}>
                            <td>
                              <img src={img.url} alt="Miniatura" className="table-thumb" onClick={() => setLightboxIndex(idx)} />
                            </td>
                            <td className="fw-semibold text-truncate" style={{ maxWidth: '300px' }}>
                              {img.originalName || `foto-${idx + 1}.jpg`}
                            </td>
                            <td className="text-muted">{formatFileSize(img.size) || '---'}</td>
                            <td className="text-end">
                              <Button variant="outline-primary" size="sm" className="me-2" onClick={() => setLightboxIndex(idx)}>
                                <FaExpand style={{ color: '#10b981' }} />
                              </Button>
                              <Button variant="outline-secondary" size="sm" className="me-2" onClick={() => handleDownloadFile(img.url, img.originalName)}>
                                <FaDownload style={{ color: '#10b981' }} />
                              </Button>
                              {activeInspection.isPast && (
                                <Button variant="outline-danger" size="sm" onClick={() => setImageToDelete(img)}>
                                  <FaTrashAlt />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* CONTEÚDO DO PILAR 2: PROJETOS CAD                          */}
        {/* ========================================================= */}
        {activeTab === 'cad' && (
          <div className="tab-pane-content animate-fade-in">
            <div className="section-card">
              <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="fw-bold mb-1">Projetos CAD da Edificação</h3>
                  <p className="text-muted mb-0">Plantas arquitetônicas, estruturais e projetos técnicos (.DWG, .DXF, .PDF)</p>
                </div>
                <Button variant="primary" onClick={() => setShowCadModal(true)}>
                  <FaPlus className="me-2" /> Adicionar Arquivo CAD
                </Button>
              </div>

              {!project.cadFiles || project.cadFiles.length === 0 ? (
                <div className="text-center py-5 border rounded-4 bg-light">
                  <FaDraftingCompass className="fs-1 mb-3" style={{ color: '#10b981', opacity: 0.7 }} />
                  <h4>Nenhum arquivo CAD cadastrado</h4>
                  <p className="text-muted mb-3">Armazene desenhos técnicos, cortes, plantas baixas e detalhamentos.</p>
                  <Button variant="outline-primary" onClick={() => setShowCadModal(true)}>
                    <FaCloudUploadAlt className="me-2" /> Fazer Upload de CAD
                  </Button>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="bib-images-table">
                    <thead>
                      <tr>
                        <th>Formato</th>
                        <th>Nome do Projeto CAD</th>
                        <th>Disciplina / Categoria</th>
                        <th>Tamanho</th>
                        <th>Data de Envio</th>
                        <th className="text-end">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.cadFiles.map((file) => (
                        <tr key={file.id}>
                          <td>
                            <Badge bg="success" className="px-2 py-1">{file.format || 'CAD'}</Badge>
                          </td>
                          <td className="fw-semibold">
                            <FaDraftingCompass className="me-2" style={{ color: '#10b981' }} /> {file.name}
                          </td>
                          <td>
                            <Badge bg="info" className="bg-opacity-10 text-info border border-info border-opacity-25">
                              {file.category || 'Geral'}
                            </Badge>
                          </td>
                          <td className="text-muted">{formatFileSize(file.size) || '---'}</td>
                          <td className="text-muted">{file.uploadedAt}</td>
                          <td className="text-end">
                            <Button 
                              variant="outline-primary" 
                              size="sm" 
                              className="me-2"
                              onClick={() => handleDownloadFile(file.url, file.name)}
                            >
                              <FaDownload className="me-1" style={{ color: '#10b981' }} /> Baixar
                            </Button>
                            <Button 
                              variant="outline-danger" 
                              size="sm" 
                              onClick={() => setCadToDelete(file)}
                            >
                              <FaTrashAlt />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* CONTEÚDO DO PILAR 3: PROJETOS BIM                          */}
        {/* ========================================================= */}
        {activeTab === 'bim' && (
          <div className="tab-pane-content animate-fade-in">
            <div className="section-card">
              <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="fw-bold mb-1">Modelos e Projetos BIM</h3>
                  <p className="text-muted mb-0">Modelos tridimensionais, arquivos IFC, Revit e gêmeos digitais da edificação</p>
                </div>
                <Button variant="primary" onClick={() => setShowBimModal(true)}>
                  <FaPlus className="me-2" /> Adicionar Modelo BIM
                </Button>
              </div>

              {!allBimFiles || allBimFiles.length === 0 ? (
                <div className="text-center py-5 border rounded-4 bg-light">
                  <FaCube className="fs-1 mb-3" style={{ color: '#10b981', opacity: 0.7 }} />
                  <h4>Nenhum modelo BIM cadastrado</h4>
                  <p className="text-muted mb-3">Armazene arquivos .IFC, .RVT ou vincule modelos digitais 3D.</p>
                  <Button variant="outline-primary" onClick={() => setShowBimModal(true)}>
                    <FaCloudUploadAlt className="me-2" /> Fazer Upload de BIM
                  </Button>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="bib-images-table">
                    <thead>
                      <tr>
                        <th>Formato</th>
                        <th>Nome do Modelo BIM</th>
                        <th>Tamanho</th>
                        <th>Data de Envio</th>
                        <th className="text-end">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allBimFiles.map((file) => (
                        <tr key={file.id}>
                          <td>
                            <Badge bg="primary" className="px-2 py-1">{file.format || 'BIM'}</Badge>
                          </td>
                          <td className="fw-semibold">
                            <FaCube className="me-2" style={{ color: '#10b981' }} /> {file.name}
                          </td>
                          <td className="text-muted">{formatFileSize(file.size) || '---'}</td>
                          <td className="text-muted">{file.uploadedAt}</td>
                          <td className="text-end">
                            <Button 
                              variant="outline-primary" 
                              size="sm" 
                              className="me-2"
                              onClick={() => handleDownloadFile(file.url, file.name)}
                            >
                              <FaDownload className="me-1" style={{ color: '#10b981' }} /> Baixar
                            </Button>
                            {file.id !== 'main-bim-model' && (
                              <Button 
                                variant="outline-danger" 
                                size="sm" 
                                onClick={() => setBimToDelete(file)}
                              >
                                <FaTrashAlt />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* CONTEÚDO DO PILAR 4: PRODUTOS FOTOGRAMÉTRICOS (POR DATA)  */}
        {/* ========================================================= */}
        {activeTab === 'photogrammetry' && (
          <div className="tab-pane-content animate-fade-in">
            {/* SELETOR DE LOTES POR DATA */}
            <div className="past-inspections-selector-card mb-4">
              <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                <span className="fw-bold text-uppercase small text-muted">
                  <FaMapMarkedAlt className="me-2" style={{ color: '#10b981' }} />
                  Levantamentos Fotogramétricos ({allPhotogrammetryBatches.length})
                </span>
                <Button variant="primary" size="sm" onClick={() => setShowCreateBatchModal(true)}>
                  <FaPlus className="me-1" /> Novo Levantamento (Data)
                </Button>
              </div>

              {!allPhotogrammetryBatches || allPhotogrammetryBatches.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <p className="mb-2">Nenhum levantamento fotogramétrico registrado.</p>
                  <Button variant="outline-primary" size="sm" onClick={() => setShowCreateBatchModal(true)}>
                    <FaPlus className="me-1" /> Cadastrar Levantamento por Data
                  </Button>
                </div>
              ) : (
                <div className="past-inspections-scroll-list">
                  {allPhotogrammetryBatches.map((batch) => {
                    const isActive = activeBatch?.id === batch.id;
                    return (
                      <button
                        key={batch.id}
                        className={`past-insp-pill ${isActive ? 'active' : ''}`}
                        onClick={() => setActiveBatch(batch)}
                      >
                        <div className="pill-content">
                          <div className="pill-title">{batch.title}</div>
                          <div className="pill-sub">
                            <span>{batch.date}</span>
                            <span>&bull;</span>
                            <span>{batch.files?.length || 0} arquivos</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ARQUIVOS DO LOTE FOTOGRAMÉTRICO SELECIONADO */}
            {activeBatch && (
              <div className="section-card">
                <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-2">
                  <div>
                    <h3 className="fw-bold mb-1">{activeBatch.title}</h3>
                    <div className="d-flex flex-wrap gap-3 text-secondary small">
                      <span><strong>Data do Voo/Levantamento:</strong> {activeBatch.date}</span>
                      {activeBatch.responsible && <span><strong>Responsável:</strong> {activeBatch.responsible}</span>}
                      {activeBatch.description && <span>&bull; {activeBatch.description}</span>}
                    </div>
                  </div>
                  <div className="d-flex gap-2">
                    {!activeBatch.id.startsWith('ortho-') && (
                      <>
                        <Button 
                          variant="primary" 
                          size="sm" 
                          onClick={() => photoGramInputRef.current?.click()}
                          disabled={uploadingPhotoGram}
                        >
                          <FaCloudUploadAlt className="me-1" /> 
                          {uploadingPhotoGram ? 'Enviando...' : 'Adicionar Arquivos'}
                        </Button>
                        <input 
                          type="file" 
                          ref={photoGramInputRef} 
                          multiple 
                          className="d-none" 
                          onChange={(e) => handlePhotoGramFilesUpload(e.target.files)} 
                        />
                        <Button 
                          variant="outline-secondary" 
                          size="sm" 
                          className="d-flex align-items-center gap-1"
                          onClick={() => handleOpenEditBatch(activeBatch)}
                          title="Editar Levantamento"
                        >
                          <FaEdit /> Editar
                        </Button>
                        <Button 
                          variant="outline-danger" 
                          size="sm" 
                          onClick={() => setBatchToDelete(activeBatch)}
                          title="Excluir Levantamento"
                        >
                          <FaTrashAlt />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {!activeBatch.files || activeBatch.files.length === 0 ? (
                  <div className="text-center py-5 border rounded-4 bg-light">
                    <FaMapMarkedAlt className="fs-1 mb-3" style={{ color: '#10b981', opacity: 0.7 }} />
                    <h4>Nenhum produto cadastrado neste levantamento</h4>
                    <p className="text-muted mb-3">
                      Faça o upload de ortomosaicos (.tif, .geotiff, .jpg), nuvens de pontos (.las, .laz) ou modelos 3D.
                    </p>
                    {!activeBatch.id.startsWith('ortho-') && (
                      <Button variant="outline-primary" onClick={() => photoGramInputRef.current?.click()}>
                        <FaCloudUploadAlt className="me-2" /> Upload de Produtos
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="bib-images-table">
                      <thead>
                        <tr>
                          <th>Formato</th>
                          <th>Nome do Arquivo</th>
                          <th>Tamanho</th>
                          <th>Data de Upload</th>
                          <th className="text-end">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeBatch.files.map((file) => (
                          <tr key={file.id}>
                            <td>
                              <Badge bg="secondary" className="px-2 py-1">{file.format || 'FOTO'}</Badge>
                            </td>
                            <td className="fw-semibold">
                              <FaFileAlt className="me-2" style={{ color: '#10b981' }} /> {file.name}
                            </td>
                            <td className="text-muted">{formatFileSize(file.size) || '---'}</td>
                            <td className="text-muted">{file.uploadedAt}</td>
                            <td className="text-end">
                              <Button 
                                variant="outline-primary" 
                                size="sm" 
                                className="me-2"
                                onClick={() => handleDownloadFile(file.url, file.name)}
                              >
                                <FaDownload className="me-1" style={{ color: '#10b981' }} /> Baixar
                              </Button>
                              {!activeBatch.id.startsWith('ortho-') && (
                                <Button 
                                  variant="outline-danger" 
                                  size="sm" 
                                  onClick={() => setPhotoGramFileToDelete(file)}
                                >
                                  <FaTrashAlt />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAIS DE APOIO                                            */}
        {/* ========================================================= */}

        {/* MODAL CRIAÇÃO DE INSPEÇÃO */}
        <Modal show={showCreateInspModal} onHide={() => setShowCreateInspModal(false)} centered>
          <Form onSubmit={handleCreateInspection}>
            <Modal.Header closeButton>
              <Modal.Title className="fw-bold">
                <FaCalendarAlt className="me-2" style={{ color: '#10b981' }} /> Nova Inspeção
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form.Group className="mb-3">
                <Form.Label>Objetivo / Título da Inspeção *</Form.Label>
                <Form.Control 
                  type="text" 
                  placeholder="Ex: Inspeção Cadastral 2021 ou Vistoria Inicial" 
                  value={newInspObjective} 
                  onChange={(e) => setNewInspObjective(e.target.value)} 
                  required 
                />
              </Form.Group>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Tipo</Form.Label>
                    <Form.Select value={newInspType} onChange={(e) => setNewInspType(e.target.value)}>
                      <option value="Visual">Visual</option>
                      <option value="Cadastral">Cadastral</option>
                      <option value="Rotina">Rotina</option>
                      <option value="Histórica">Histórica</option>
                      <option value="Especial">Especial</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Data Realizada *</Form.Label>
                    <Form.Control 
                      type="date" 
                      value={newInspDate} 
                      onChange={(e) => setNewInspDate(e.target.value)} 
                      required 
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Form.Group className="mb-3">
                <Form.Label>Responsável Técnico</Form.Label>
                <Form.Control 
                  type="text" 
                  value={newInspResponsible} 
                  onChange={(e) => setNewInspResponsible(e.target.value)} 
                />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowCreateInspModal(false)}>Cancelar</Button>
              <Button variant="primary" type="submit" disabled={creatingInsp}>
                {creatingInsp ? 'Criando...' : 'Criar Inspeção'}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* MODAL UPLOAD CAD */}
        <Modal show={showCadModal} onHide={() => setShowCadModal(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title className="fw-bold">
              <FaDraftingCompass className="me-2" style={{ color: '#10b981' }} /> Adicionar Arquivo CAD
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Disciplina / Categoria</Form.Label>
              <Form.Select value={cadCategory} onChange={(e) => setCadCategory(e.target.value)}>
                <option value="Arquitetura">Arquitetura</option>
                <option value="Estrutural">Estrutural</option>
                <option value="Fundações">Fundações</option>
                <option value="Instalações Elétricas">Instalações Elétricas</option>
                <option value="Instalações Hidráulicas">Instalações Hidráulicas</option>
                <option value="Geral">Geral</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Selecione os Arquivos (.DWG, .DXF, .PDF)</Form.Label>
              <Form.Control 
                type="file" 
                ref={cadInputRef}
                multiple 
                onChange={(e: any) => handleCadUpload(e.target.files)} 
              />
            </Form.Group>
            {uploadingCad && (
              <div className="text-center py-2" style={{ color: '#10b981' }}>
                <div className="spinner-border spinner-border-sm me-2" style={{ color: '#10b981' }}></div>
                Fazendo upload do projeto CAD...
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCadModal(false)}>Fechar</Button>
          </Modal.Footer>
        </Modal>

        {/* MODAL UPLOAD BIM */}
        <Modal show={showBimModal} onHide={() => setShowBimModal(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title className="fw-bold">
              <FaCube className="me-2" style={{ color: '#10b981' }} /> Adicionar Modelo BIM
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Selecione o Modelo BIM (.IFC, .RVT, etc.)</Form.Label>
              <Form.Control 
                type="file" 
                ref={bimInputRef}
                multiple 
                onChange={(e: any) => handleBimUpload(e.target.files)} 
              />
            </Form.Group>
            {uploadingBim && (
              <div className="text-center py-2" style={{ color: '#10b981' }}>
                <div className="spinner-border spinner-border-sm me-2" style={{ color: '#10b981' }}></div>
                Fazendo upload do modelo BIM...
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowBimModal(false)}>Fechar</Button>
          </Modal.Footer>
        </Modal>

        {/* MODAL CRIAÇÃO DE LOTE FOTOGRAMÉTRICO */}
        <Modal show={showCreateBatchModal} onHide={() => setShowCreateBatchModal(false)} centered>
          <Form onSubmit={handleCreateBatch}>
            <Modal.Header closeButton>
              <Modal.Title className="fw-bold">
                <FaMapMarkedAlt className="me-2" style={{ color: '#10b981' }} /> Novo Levantamento Fotogramétrico
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form.Group className="mb-3">
                <Form.Label>Título / Identificação do Voo *</Form.Label>
                <Form.Control 
                  type="text" 
                  placeholder="Ex: Levantamento Aéreo Drone - Ortofoto 2022" 
                  value={batchTitle} 
                  onChange={(e) => setBatchTitle(e.target.value)} 
                  required 
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Data do Levantamento *</Form.Label>
                <Form.Control 
                  type="date" 
                  value={batchDate} 
                  onChange={(e) => setBatchDate(e.target.value)} 
                  required 
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Piloto / Engenheiro Responsável</Form.Label>
                <Form.Control 
                  type="text" 
                  value={batchResponsible} 
                  onChange={(e) => setBatchResponsible(e.target.value)} 
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Observações / Descrição</Form.Label>
                <Form.Control 
                  as="textarea" 
                  rows={2} 
                  value={batchDescription} 
                  onChange={(e) => setBatchDescription(e.target.value)} 
                />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowCreateBatchModal(false)}>Cancelar</Button>
              <Button variant="primary" type="submit" disabled={creatingBatch}>
                {creatingBatch ? 'Criando...' : 'Criar Levantamento'}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* MODAIS DE EXCLUSÃO */}
        <Modal show={!!imageToDelete} onHide={() => setImageToDelete(null)} centered size="sm">
          <Modal.Header closeButton><Modal.Title className="fs-6">Excluir Foto</Modal.Title></Modal.Header>
          <Modal.Body>Deseja excluir esta imagem?</Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" size="sm" onClick={() => setImageToDelete(null)}>Cancelar</Button>
            <Button variant="danger" size="sm" onClick={confirmDeleteImage}>Excluir</Button>
          </Modal.Footer>
        </Modal>

        <Modal show={!!inspectionToDelete} onHide={() => setInspectionToDelete(null)} centered>
          <Modal.Header closeButton><Modal.Title className="fs-5">Excluir Inspeção</Modal.Title></Modal.Header>
          <Modal.Body>Deseja excluir esta inspeção e todas as suas imagens?</Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setInspectionToDelete(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmDeleteInspection}>Confirmar</Button>
          </Modal.Footer>
        </Modal>

        <Modal show={!!cadToDelete} onHide={() => setCadToDelete(null)} centered size="sm">
          <Modal.Header closeButton><Modal.Title className="fs-6">Excluir Arquivo CAD</Modal.Title></Modal.Header>
          <Modal.Body>Deseja excluir {cadToDelete?.name}?</Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" size="sm" onClick={() => setCadToDelete(null)}>Cancelar</Button>
            <Button variant="danger" size="sm" onClick={confirmDeleteCad}>Excluir</Button>
          </Modal.Footer>
        </Modal>

        <Modal show={!!bimToDelete} onHide={() => setBimToDelete(null)} centered size="sm">
          <Modal.Header closeButton><Modal.Title className="fs-6">Excluir Modelo BIM</Modal.Title></Modal.Header>
          <Modal.Body>Deseja excluir {bimToDelete?.name}?</Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" size="sm" onClick={() => setBimToDelete(null)}>Cancelar</Button>
            <Button variant="danger" size="sm" onClick={confirmDeleteBim}>Excluir</Button>
          </Modal.Footer>
        </Modal>

        <Modal show={!!batchToDelete} onHide={() => setBatchToDelete(null)} centered>
          <Modal.Header closeButton><Modal.Title className="fs-5">Excluir Levantamento</Modal.Title></Modal.Header>
          <Modal.Body>Deseja excluir o lote fotogramétrico e todos os seus arquivos?</Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setBatchToDelete(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmDeleteBatch}>Confirmar</Button>
          </Modal.Footer>
        </Modal>

        <Modal show={!!photoGramFileToDelete} onHide={() => setPhotoGramFileToDelete(null)} centered size="sm">
          <Modal.Header closeButton><Modal.Title className="fs-6">Excluir Arquivo</Modal.Title></Modal.Header>
          <Modal.Body>Deseja excluir {photoGramFileToDelete?.name}?</Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" size="sm" onClick={() => setPhotoGramFileToDelete(null)}>Cancelar</Button>
            <Button variant="danger" size="sm" onClick={confirmDeletePhotoGramFile}>Excluir</Button>
          </Modal.Footer>
        </Modal>

        {/* MODAL EDITAR EDIFICAÇÃO (PROJETO) */}
        <EditLibraryProjectModal
          show={showEditProjectModal}
          onHide={() => setShowEditProjectModal(false)}
          project={project}
          onSuccess={(updatedProject) => {
            setProject(updatedProject);
          }}
        />

        {/* MODAL EDITAR INSPEÇÃO */}
        <Modal show={showEditInspModal} onHide={() => !savingInsp && setShowEditInspModal(false)} centered>
          <Form onSubmit={handleSaveInspection}>
            <Modal.Header closeButton>
              <Modal.Title className="fw-bold d-flex align-items-center gap-2">
                <FaEdit style={{ color: '#10b981' }} /> Editar Informações da Inspeção
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Objetivo / Título da Inspeção *</Form.Label>
                <Form.Control 
                  type="text" 
                  value={editInspObjective} 
                  onChange={(e) => setEditInspObjective(e.target.value)} 
                  required 
                />
              </Form.Group>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">Tipo de Inspeção</Form.Label>
                    <Form.Select 
                      value={editInspType} 
                      onChange={(e) => setEditInspType(e.target.value)}
                    >
                      <option value="Visual">Visual</option>
                      <option value="Termográfica">Termográfica</option>
                      <option value="Estrutural">Estrutural</option>
                      <option value="Drone / Voo">Drone / Voo</option>
                      <option value="Rotina">Rotina</option>
                      <option value="Outro">Outro</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">Data da Inspeção *</Form.Label>
                    <Form.Control 
                      type="date" 
                      value={editInspDate} 
                      onChange={(e) => setEditInspDate(e.target.value)} 
                      required 
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Responsável Técnico</Form.Label>
                <Form.Control 
                  type="text" 
                  value={editInspResponsible} 
                  onChange={(e) => setEditInspResponsible(e.target.value)} 
                />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowEditInspModal(false)} disabled={savingInsp}>
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                type="submit" 
                disabled={savingInsp}
                style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
              >
                {savingInsp ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* MODAL EDITAR LEVANTAMENTO FOTOGRAMÉTRICO */}
        <Modal show={showEditBatchModal} onHide={() => !savingBatch && setShowEditBatchModal(false)} centered>
          <Form onSubmit={handleSaveBatch}>
            <Modal.Header closeButton>
              <Modal.Title className="fw-bold d-flex align-items-center gap-2">
                <FaEdit style={{ color: '#10b981' }} /> Editar Levantamento Fotogramétrico
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Título do Levantamento *</Form.Label>
                <Form.Control 
                  type="text" 
                  value={editBatchTitle} 
                  onChange={(e) => setEditBatchTitle(e.target.value)} 
                  required 
                />
              </Form.Group>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">Data do Voo/Levantamento *</Form.Label>
                    <Form.Control 
                      type="date" 
                      value={editBatchDate} 
                      onChange={(e) => setEditBatchDate(e.target.value)} 
                      required 
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">Responsável</Form.Label>
                    <Form.Control 
                      type="text" 
                      value={editBatchResponsible} 
                      onChange={(e) => setEditBatchResponsible(e.target.value)} 
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Descrição <span className="text-muted fw-normal small">(opcional)</span></Form.Label>
                <Form.Control 
                  as="textarea" 
                  rows={3} 
                  value={editBatchDescription} 
                  onChange={(e) => setEditBatchDescription(e.target.value)} 
                />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowEditBatchModal(false)} disabled={savingBatch}>
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                type="submit" 
                disabled={savingBatch}
                style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
              >
                {savingBatch ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* LIGHTBOX DE FOTOS DA INSPEÇÃO */}
        {lightboxIndex !== null && filteredPhotos[lightboxIndex] && (
          <div className="bib-lightbox-overlay" onClick={() => setLightboxIndex(null)}>
            <div className="bib-lightbox-container" onClick={(e) => e.stopPropagation()}>
              <div className="lightbox-top-bar">
                <span className="lightbox-filename truncate">
                  {filteredPhotos[lightboxIndex].originalName || `foto-${lightboxIndex + 1}.jpg`}
                </span>
                <div className="d-flex gap-2">
                  <button className="lightbox-btn" onClick={() => handleDownloadFile(filteredPhotos[lightboxIndex].url, filteredPhotos[lightboxIndex].originalName)}>
                    <FaDownload style={{ color: '#10b981' }} />
                  </button>
                  {activeInspection?.isPast && (
                    <button className="lightbox-btn delete" onClick={() => setImageToDelete(filteredPhotos[lightboxIndex])}>
                      <FaTrashAlt />
                    </button>
                  )}
                  <button className="lightbox-btn close" onClick={() => setLightboxIndex(null)}>
                    <FaTimes />
                  </button>
                </div>
              </div>
              <div className="lightbox-body">
                {lightboxIndex > 0 && (
                  <button className="nav-arrow left" onClick={() => setLightboxIndex(lightboxIndex - 1)}>
                    <FaChevronLeft />
                  </button>
                )}
                <img src={filteredPhotos[lightboxIndex].url} alt="Foto" className="lightbox-image" />
                {lightboxIndex < filteredPhotos.length - 1 && (
                  <button className="nav-arrow right" onClick={() => setLightboxIndex(lightboxIndex + 1)}>
                    <FaChevronRight />
                  </button>
                )}
              </div>
              <div className="lightbox-footer">
                <span>{lightboxIndex + 1} de {filteredPhotos.length} fotos</span>
                {filteredPhotos[lightboxIndex].size && <span>&bull; {formatFileSize(filteredPhotos[lightboxIndex].size)}</span>}
              </div>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
};

export default BibliotecaView;
