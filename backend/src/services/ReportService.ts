import ProjectRepository from '../repositories/ProjectRepository';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { IProject, IInspection, IDetection, IImage } from '../models/IProject';

class ReportService {
  private projectRepository: ProjectRepository;

  constructor() {
    this.projectRepository = new ProjectRepository();
  }

  public async generatePdfReport(projectId: string, inspectionId?: string): Promise<Buffer> {
    console.log(`[ReportService] Iniciando geração de PDF para projeto ${projectId}${inspectionId ? `, inspeção ${inspectionId}` : ''}`);
    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new Error('Projeto não encontrado para gerar o relatório.');
    }

    const htmlContent = this.generateHtmlReport(project, inspectionId);
    
    // Criar um arquivo temporário para o HTML
    const tempDir = path.join(__dirname, '..', '..', 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempFilePath = path.join(tempDir, `report_${projectId}_${Date.now()}.html`);
    fs.writeFileSync(tempFilePath, htmlContent);

    console.log('[ReportService] HTML gerado e salvo em arquivo temporário, iniciando Puppeteer...');

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--allow-file-access-from-files'
      ]
    });

    try {
      const page = await browser.newPage();
      
      await page.setDefaultNavigationTimeout(120000);
      await page.setDefaultTimeout(120000);

      console.log('[ReportService] Carregando arquivo HTML temporário no Puppeteer...');
      const fileUrl = pathToFileURL(tempFilePath).href;
      await page.goto(fileUrl, { 
        waitUntil: 'networkidle0',
        timeout: 120000 
      });

      console.log('[ReportService] Gerando buffer do PDF...');
      const pdfBufferUint8Array = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '10mm',
          right: '10mm',
        },
        timeout: 120000,
      });

      const pdfBuffer = Buffer.from(pdfBufferUint8Array);

      console.log('[ReportService] PDF gerado com sucesso.');
      return pdfBuffer;
    } catch (error) {
      console.error('[ReportService] Erro durante o processamento do Puppeteer:', error);
      throw error;
    } finally {
      await browser.close();
      // Remover o arquivo temporário
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (unlinkError) {
          console.error('[ReportService] Erro ao remover arquivo temporário:', unlinkError);
        }
      }
    }
  }

  private generateHtmlReport(project: IProject, targetInspectionId?: string): string {
    let targetInspection: IInspection | undefined;

    if (targetInspectionId) {
      targetInspection = project.inspections?.find(inspection => inspection.id === targetInspectionId);
    } else {
      targetInspection = project.inspections?.[0]; 
    }

    let totalDefects = 0;
    const defectsByClass: { [key: string]: number } = {};

    const inspectionsToReport = targetInspection ? [targetInspection] : (project.inspections || []);

    inspectionsToReport.forEach(inspection => {
        // Detecções em imagens comuns
        inspection.images.forEach(image => {
          let detections = image.detections;
          if (typeof detections === 'string') {
            try {
              detections = JSON.parse(detections);
            } catch (error) {
              detections = [];
            }
          }

          if (detections && Array.isArray(detections)) {
            totalDefects += detections.length;
            detections.forEach(detection => {
              defectsByClass[detection.class_name] = (defectsByClass[detection.class_name] || 0) + 1;
            });
          }
        });

        // Detecções em ortomosaicos
        if (inspection.orthoResults) {
          inspection.orthoResults.forEach(ortho => {
            if (ortho.detections) {
              totalDefects += ortho.detections.length;
              ortho.detections.forEach(det => {
                defectsByClass[det.class_name] = (defectsByClass[det.class_name] || 0) + 1;
              });
            }
          });
        }
    });

    let defectsByClassHtml = '';
    if (Object.keys(defectsByClass).length > 0) {
      defectsByClassHtml = `
        <p><strong>Defeitos por Classe:</strong></p>
        <ul>
          ${Object.entries(defectsByClass).map(([className, count]) => `
            <li>${className}: ${count}</li>
          `).join('')}
        </ul>
      `;
    } else {
      defectsByClassHtml = '<p>Nenhum defeito classificado encontrado.</p>';
    }

    let inspectionsHtml = '';
    if (inspectionsToReport.length > 0) {
      inspectionsHtml = inspectionsToReport.map(inspection => {
        // Renderizar Ortomosaicos
        let orthoResultsHtml = '';
        if (inspection.orthoResults && inspection.orthoResults.length > 0) {
          orthoResultsHtml = inspection.orthoResults.map(ortho => {
            const orthoImgSrc = ortho.previewUrl || '';

            return `
              <div style="margin-bottom: 20px; padding: 10px; border: 1px solid #004d40; border-radius: 5px; page-break-inside: avoid; background-color: #fff;">
                <h4>Ortomosaico: ${path.basename(ortho.url)}</h4>
                ${orthoImgSrc ? `<img src="${orthoImgSrc}" alt="Preview Ortomosaico" style="max-width: 100%; height: auto; display: block; margin-bottom: 10px; border: 1px solid #ccc;">` : '<p style="color: gray;">Pré-visualização do ortomosaico não disponível.</p>'}
                <p><strong>Detecções Georreferenciadas (${ortho.detections?.length || 0}):</strong></p>
                ${ortho.detections && ortho.detections.length > 0 ? `
                  <table style="width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 0.9em;">
                    <thead>
                      <tr>
                        <th>Classe</th>
                        <th>Confiança</th>
                        <th>Coordenadas (Lat, Lon)</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${ortho.detections.slice(0, 50).map(det => `
                        <tr>
                          <td>${det.class_name}</td>
                          <td>${(det.confidence * 100).toFixed(2)}%</td>
                          <td>${det.center.lat.toFixed(6)}, ${det.center.lon.toFixed(6)}</td>
                        </tr>
                      `).join('')}
                      ${ortho.detections.length > 50 ? '<tr><td colspan="3" style="text-align:center;">... e mais ${ortho.detections.length - 50} detecções</td></tr>' : ''}
                    </tbody>
                  </table>
                ` : '<p>Nenhuma detecção encontrada neste ortomosaico.</p>'}
              </div>
            `;
          }).join('');
        }

        // Renderizar Imagens Comuns
        let imagesHtml = '';
        if (inspection.images && inspection.images.length > 0) {
          imagesHtml = inspection.images.map(image => {
            let detections = image.detections;
            if (typeof detections === 'string') {
              try {
                detections = JSON.parse(detections);
              } catch (error) {
                detections = [];
              }
            }

            const imgSrc = image.url || '';

            return `
              <div style="margin-bottom: 20px; padding: 10px; border: 1px solid #eee; border-radius: 5px; page-break-inside: avoid;">
                <h4>Imagem: ${image.url ? path.basename(image.url) : 'Nome da imagem indisponível'}</h4>
                ${imgSrc ? `<img src="${imgSrc}" alt="Imagem Processada" style="max-width: 100%; height: auto; display: block; margin-bottom: 10px; border: 1px solid #ccc;">` : '<p style="color: red;">Imagem não pôde ser carregada.</p>'}
                <p><strong>Detecções (${detections?.length || 0}):</strong></p>
                ${detections && Array.isArray(detections) && detections.length > 0 ? `
                  <table style="width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 0.9em;">
                    <thead>
                      <tr>
                        <th>Classe</th>
                        <th>Confiança</th>
                        <th>Caixa (x1,y1,x2,y2)</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${detections.map(det => `
                        <tr>
                          <td>${det.class_name}</td>
                          <td>${(det.confidence * 100).toFixed(2)}%</td>
                          <td>(${det.box.x1.toFixed(0)},${det.box.y1.toFixed(0)},${det.box.x2.toFixed(0)},${det.box.y2.toFixed(0)})</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                ` : 'Nenhuma detecção.'}
              </div>
            `;
          }).join('');
        }

        return `
          <div style="margin-bottom: 30px; padding: 15px; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9;">
            <h2 style="border-bottom: 2px solid #004d40; padding-bottom: 5px;">Inspeção: ${inspection.inspectionObjective}</h2>
            <div style="display: flex; gap: 20px; margin-bottom: 15px;">
              <p><strong>Tipo:</strong> ${inspection.inspectionType}</p>
              <p><strong>Data:</strong> ${inspection.inspectionDate}</p>
              <p><strong>Responsável:</strong> ${inspection.inspectionResponsible}</p>
            </div>
            
            ${orthoResultsHtml ? `<h3>Resultados de Ortomosaicos</h3>${orthoResultsHtml}` : ''}
            
            ${imagesHtml ? `<h3>Imagens de Inspeção</h3>${imagesHtml}` : ''}
          </div>
        `;
      }).join('');
    } else {
      inspectionsHtml = '<p>Nenhuma inspeção ou imagem processada neste projeto.</p>';
    }

    const reportHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Relatório de Projeto - ${project.name}</title>
          <style>
              body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; color: #333; line-height: 1.6; }
              .header { background-color: #004d40; color: #ffffff; padding: 30px; text-align: center; }
              .header h1 { margin: 0; font-size: 2.5em; }
              .container { width: 90%; margin: 20px auto; }
              .section { margin-bottom: 25px; padding: 20px; border: 1px solid #eee; border-radius: 8px; background-color: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
              h2, h3, h4 { color: #004d40; margin-top: 0; }
              img { max-width: 100%; height: auto; display: block; margin: 15px 0; border: 1px solid #ddd; border-radius: 4px; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; }
              th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
              th { background-color: #f2f2f2; font-weight: bold; }
              .footer { text-align: center; margin-top: 50px; padding: 20px; font-size: 0.9em; color: #777; border-top: 1px solid #eee; }
              @media print {
                .section { box-shadow: none; border: 1px solid #eee; }
                .header { -webkit-print-color-adjust: exact; }
              }
          </style>
      </head>
      <body>
          <div class="header">
              <h1>Relatório de Projeto</h1>
              <p style="font-size: 1.2em; margin-top: 10px;">${project.name}</p>
          </div>
          <div class="container">
              <div class="section">
                  <h2>Informações do Projeto</h2>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <p><strong>Nome:</strong> ${project.name}</p>
                    <p><strong>Responsável:</strong> ${project.responsible}</p>
                    <p><strong>Endereço:</strong> ${project.address}</p>
                    <p><strong>Tipo:</strong> ${project.type}</p>
                  </div>
                  <p><strong>Módulos Ativos:</strong> ${Object.keys(project.modules).filter(key => project.modules[key as keyof typeof project.modules]).map(key => {
                    switch (key) {
                      case 'progress': return 'Progresso';
                      case 'security': return 'Segurança';
                      case 'maintenance': return 'Manutenção';
                      default: return key;
                    }
                  }).join(', ') || 'Nenhum'}</p>
                  ${project.modules.maintenance ? `
                    <h3 style="margin-top: 15px;">Dados Técnicos (Manutenção)</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                      <p><strong>Ano Construído:</strong> ${project.buildingYear || 'Não informado'}</p>
                      <p><strong>Área Construída:</strong> ${project.builtArea || 'Não informado'} m²</p>
                      <p><strong>Tipologia da Fachada:</strong> ${project.facadeTypology || 'Não informado'}</p>
                      <p><strong>Tipologia da Cobertura:</strong> ${project.roofTypology || 'Não informado'}</p>
                    </div>
                  ` : ''}
              </div>
              <div class="section">
                  <h2>Resumo de Patologias Detectadas</h2>
                  <p><strong>Total de Defeitos Identificados:</strong> <span style="font-size: 1.2em; font-weight: bold; color: #d32f2f;">${totalDefects}</span></p>
                  ${defectsByClassHtml}
              </div>
              <div class="section">
                  <h2>Detalhamento por Inspeção</h2>
                  ${inspectionsHtml}
              </div>
          </div>
          <div class="footer">
              <p>SMART TWIN-IE - Relatório Automatizado via IA</p>
              <p>Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
          </div>
      </body>
      </html>
    `;
    return reportHtml;
  }
}

export default ReportService;
