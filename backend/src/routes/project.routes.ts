import { Router } from 'express';
import multer from 'multer';
import uploadConfig from '../config/upload';
import ProjectController from '../controllers/ProjectController';
import { authenticateToken, authorizeRole } from '../middlewares/auth';

const projectRouter = Router();
const upload = multer({ 
  storage: uploadConfig.storage(uploadConfig.tempDirectory),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB por arquivo
    fieldSize: 50 * 1024 * 1024
  }
});
const projectController = new ProjectController();

// Rotas de callback e status para o ortomosaico (chamadas pela IA)
projectRouter.post('/ortho-callback', projectController.handleOrthoCallback);
projectRouter.post('/ortho-status', projectController.handleOrthoStatus);

// Todas as rotas de projeto abaixo precisam de autenticação
projectRouter.use(authenticateToken);

projectRouter.get('/', projectController.index);
projectRouter.get('/:id', projectController.show);
projectRouter.put('/:id', authorizeRole(['admin']), projectController.update);
projectRouter.delete('/:id', authorizeRole(['admin']), projectController.delete);

// Route to start the image processing (Busboy manual parsing)
projectRouter.post(
  '/process-images',
  projectController.processImagesForResults
);

// Route to process a single orthomosaic (Busboy manual parsing)
projectRouter.post(
  '/process-ortho',
  projectController.processOrthoForResults
);

// Route to get the data for a pending review
projectRouter.get(
  '/review/:reviewId',
  projectController.getReview
);

// Route to get a single image from a pending review
projectRouter.get(
  '/review/:reviewId/images/:imageId',
  projectController.getReviewImage
);

// Route to finalize a review and save the images to an inspection
projectRouter.post(
  '/review/:reviewId/save',
  projectController.saveReview
);

// New route for creating inspections
projectRouter.post(
  '/:projectId/inspections',
  authorizeRole(['admin']),
  projectController.createInspection
);

// Route for updating inspection
projectRouter.put(
  '/:projectId/inspections/:inspectionId',
  authorizeRole(['admin']),
  projectController.updateInspection
);

// New route for deleting inspections
projectRouter.delete(
  '/:projectId/inspections/:inspectionId',
  authorizeRole(['admin']),
  projectController.deleteInspection
);

// New route for deleting image from inspection
projectRouter.delete(
  '/:projectId/inspections/:inspectionId/images/:imageName',
  authorizeRole(['admin']),
  projectController.deleteImageFromInspection
);

// New route for deleting orthomosaic from inspection
projectRouter.delete(
  '/:projectId/inspections/:inspectionId/ortho/:orthoName',
  authorizeRole(['admin']),
  projectController.deleteOrthoFromInspection
);

// Route for saving multiple images to inspection (Biblioteca)
projectRouter.post(
  '/:projectId/inspections/:inspectionId/images',
  projectController.addImages
);

// New route for saving image directly to inspection
projectRouter.post(
  '/:projectId/inspections/:inspectionId/save-image',
  authorizeRole(['admin', 'user']),
  projectController.saveImageToInspection
);

// New route for updating detection maintenance status
projectRouter.patch(
  '/:projectId/inspections/:inspectionId/detections',
  authorizeRole(['admin', 'user']),
  projectController.updateDetectionMaintenance
);

// New route for generating PDF inspection report
projectRouter.get(
  '/:projectId/report/pdf/inspections/:inspectionId',
  projectController.generateInspectionPdfReport
);

projectRouter.post(
  '/',
  authorizeRole(['admin']),
  projectController.create
);

// --- ROTAS BIBLIOTECA: CAD ---
projectRouter.post('/:projectId/library/cad', projectController.addCadFile);
projectRouter.delete('/:projectId/library/cad/:fileId', projectController.deleteCadFile);

// --- ROTAS BIBLIOTECA: BIM ---
projectRouter.post('/:projectId/library/bim', projectController.addBimFile);
projectRouter.delete('/:projectId/library/bim/:fileId', projectController.deleteBimFile);

// --- ROTAS BIBLIOTECA: PRODUTOS FOTOGRAMÉTRICOS (SEPARADOS POR DATA) ---
projectRouter.post('/:projectId/library/photogrammetry', projectController.createPhotogrammetryBatch);
projectRouter.put('/:projectId/library/photogrammetry/:batchId', projectController.updatePhotogrammetryBatch);
projectRouter.post('/:projectId/library/photogrammetry/:batchId/files', projectController.addFilesToPhotogrammetryBatch);
projectRouter.delete('/:projectId/library/photogrammetry/:batchId', projectController.deletePhotogrammetryBatch);
projectRouter.delete('/:projectId/library/photogrammetry/:batchId/files/:fileId', projectController.deletePhotogrammetryFile);

export default projectRouter;