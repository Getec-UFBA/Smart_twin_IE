import { Router } from 'express';
import multer from 'multer';
import uploadConfig from '../config/upload';
import ProjectController from '../controllers/ProjectController';
import { authenticateToken, authorizeRole } from '../middlewares/auth';

const projectRouter = Router();
const upload = multer({ storage: uploadConfig.storage(uploadConfig.projectsDirectory) });
const projectController = new ProjectController();

// Todas as rotas de projeto precisam de autenticação
projectRouter.use(authenticateToken);

projectRouter.get('/', projectController.index);
projectRouter.get('/:id', projectController.show);
projectRouter.put('/:id', authorizeRole(['admin']), projectController.update);
projectRouter.delete('/:id', authorizeRole(['admin']), projectController.delete);

// Route to start the image processing and create a pending review
projectRouter.post(
  '/process-images',
  upload.array('images', 50),
  projectController.processImagesForResults
);

// Route to process a single orthomosaic (GeoTIFF)
projectRouter.post(
  '/process-ortho',
  upload.single('ortho'),
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

export default projectRouter;