import ProjectRepository from '../repositories/ProjectRepository';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import os from 'os';
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
    
    // No Firebase Functions, o único diretório gravável é o /tmp (os.tmpdir)
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `report_${projectId}_${Date.now()}.html`);
    fs.writeFileSync(tempFilePath, htmlContent);

    console.log(`[ReportService] HTML salvo em ${tempFilePath}, iniciando Puppeteer...`);

    // Configurações otimizadas para ambientes Serverless (Cloud Functions)
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process'
      ]
    });

    try {
      const page = await browser.newPage();
      console.log('[ReportService] Nova página criada.');
      
      // Aumentamos os timeouts para evitar erros de rede em PDFs pesados
      await page.setDefaultNavigationTimeout(240000);
      await page.setDefaultTimeout(240000);

      const fileUrl = pathToFileURL(tempFilePath).href;
      console.log(`[ReportService] Carregando arquivo HTML de: ${fileUrl}`);
      
      await page.goto(fileUrl, { 
        waitUntil: 'networkidle2', // Mudado para networkidle2 para ser mais resiliente
        timeout: 240000 
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
        timeout: 240000,
      });

      const pdfBuffer = Buffer.from(pdfBufferUint8Array);

      console.log('[ReportService] PDF gerado com sucesso.');
      return pdfBuffer;
    } catch (error) {
      console.error('[ReportService] ERRO CRÍTICO NO PUPPETEER:', error);
      if (error instanceof Error) {
        console.error('[ReportService] Nome do erro:', error.name);
        console.error('[ReportService] Mensagem do erro:', error.message);
        console.error('[ReportService] Stack trace:', error.stack);
      }
      throw error;
    } finally {
      console.log('[ReportService] Fechando navegador...');
      await browser.close();
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (err) {}
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
                    </tbody>
                  </table>
                ` : '<p>Nenhuma detecção encontrada neste ortomosaico.</p>'}
              </div>
            `;
          }).join('');
        }

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

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <title>Relatório - ${project.name}</title>
          <style>
              body { font-family: sans-serif; margin: 0; padding: 0; color: #333; line-height: 1.6; }
              .header { background-color: #004d40; color: white; padding: 20px; text-align: center; }
              .container { width: 95%; margin: 10px auto; }
              .section { margin-bottom: 20px; padding: 15px; border: 1px solid #eee; border-radius: 8px; background: white; }
              h2, h3 { color: #004d40; }
              img { max-width: 100%; height: auto; margin: 10px 0; border: 1px solid #ddd; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background: #f2f2f2; }
              .footer { text-align: center; font-size: 0.8em; color: #777; margin-top: 30px; }
          </style>
      </head>
      <body>
          <div class="header"><h1>Relatório de Projeto: ${project.name}</h1></div>
          <div class="container">
              <div class="section">
                  <h2>Informações Gerais</h2>
                  <p><strong>Responsável:</strong> ${project.responsible}</p>
                  <p><strong>Endereço:</strong> ${project.address}</p>
                  <p><strong>Ano:</strong> ${project.buildingYear || 'N/A'}</p>
              </div>
              <div class="section">
                  <h2>Resumo de Patologias</h2>
                  <p>Total detectado: <strong>${totalDefects}</strong></p>
                  ${defectsByClassHtml}
              </div>
              ${inspectionsHtml}
          </div>
          <div class="footer"><p>Gerado em ${new Date().toLocaleString('pt-BR')}</p></div>
      </body>
      </html>
    `;
  }
}

export default ReportService;
