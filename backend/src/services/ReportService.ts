import ProjectRepository from '../repositories/ProjectRepository';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { pathToFileURL } from 'url';
import { IProject, IInspection, IDetection, IImage, IOrthoResult, IGeoDetection } from '../models/IProject';

interface ClassInfo {
  code: string;
  label: string;
  color: string;
}

function getClassInfo(className: string): ClassInfo {
  const normalized = className.toLowerCase().trim();
  
  if (normalized.includes('biofilm') || normalized.includes('biofilme') || normalized.includes('moss') || normalized.includes('algae') || normalized.includes('lichen') || normalized.includes('c10')) {
    return { code: 'C10', label: 'Acúmulo de biofilme', color: '#27ae60' };
  }
  if (normalized.includes('sujidade') || normalized.includes('stain') || normalized.includes('dirt') || normalized.includes('dirty') || normalized.includes('c09')) {
    return { code: 'C09', label: 'Sujidade no telhado', color: '#d63031' };
  }
  if (normalized.includes('detrito') || normalized.includes('debris') || normalized.includes('lixo') || normalized.includes('trash') || normalized.includes('c08')) {
    return { code: 'C08', label: 'Detritos no telhado', color: '#e84393' };
  }
  if (normalized.includes('excesso') || normalized.includes('excess_tiles') || normalized.includes('excess_tile') || normalized.includes('c07')) {
    return { code: 'C07', label: 'Telhas em excesso', color: '#2980b9' };
  }
  if (normalized.includes('vegeta') || normalized.includes('weed') || normalized.includes('plant') || normalized.includes('c06')) {
    return { code: 'C06', label: 'Crescimento de vegetação', color: '#34495e' };
  }
  if (normalized.includes('alcapao') || normalized.includes('alçapão') || normalized.includes('hatch') || normalized.includes('c05')) {
    return { code: 'C05', label: 'Alçapão aberto ou danificado', color: '#f1c40f' };
  }
  if (normalized.includes('calha') || normalized.includes('rufo') || normalized.includes('corrosion') || normalized.includes('rust') || normalized.includes('c04')) {
    return { code: 'C04', label: 'Corrosão ou deformação de calhas e rufos', color: '#9b59b6' };
  }
  if (normalized.includes('fissura') || normalized.includes('crack') || normalized.includes('fissures') || normalized.includes('c03')) {
    return { code: 'C03', label: 'Fissuras na laje', color: '#3498db' };
  }
  if (normalized.includes('desloca') || normalized.includes('displacement') || normalized.includes('displaced') || normalized.includes('c02')) {
    return { code: 'C02', label: 'Deslocamento de telhas', color: '#2ecc71' };
  }
  if (normalized.includes('dano') || normalized.includes('broken') || normalized.includes('damage') || normalized.includes('c01')) {
    return { code: 'C01', label: 'Danos em telha', color: '#e67e22' };
  }

  return { code: 'C11', label: className, color: '#95a5a6' };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
        waitUntil: 'networkidle2', 
        timeout: 240000 
      });

      console.log('[ReportService] Aguardando renderComplete do JS cliente...');
      await page.waitForFunction('window.renderComplete === true', { timeout: 15000 }).catch(err => {
        console.warn('[ReportService] Timeout esperando renderComplete, prosseguindo mesmo assim.');
      });

      console.log('[ReportService] Gerando buffer do PDF...');
      const pdfBufferUint8Array = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '0px',
          bottom: '0px',
          left: '0px',
          right: '0px',
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

    const inspectionsToReport = targetInspection ? [targetInspection] : (project.inspections || []);

    // 1. Contabilizar patologias
    let totalDefects = 0;
    const defectsByClass: { [key: string]: number } = {};

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

    // 2. Gráfico em HTML/CSS Puro (Barra Horizontal)
    let defectsChartHtml = '';
    if (Object.keys(defectsByClass).length > 0) {
      const maxCount = Math.max(...Object.values(defectsByClass), 1);
      
      const barsHtml = Object.entries(defectsByClass).map(([className, count]) => {
        const info = getClassInfo(className);
        const pct = Math.max((count / maxCount) * 80, 4); // escala max 80%
        return `
          <div class="chart-row">
            <div class="chart-label">${info.label}</div>
            <div class="chart-bar-wrapper">
              <div class="chart-bar" style="width: ${pct}%; background-color: ${info.color};"></div>
              <span class="chart-value">${count}</span>
            </div>
          </div>
        `;
      }).join('');

      defectsChartHtml = `
        <div class="chart-container">
          ${barsHtml}
          <div class="chart-axis">
            <span>0</span>
            <span>${Math.round(maxCount / 4)}</span>
            <span>${Math.round(maxCount / 2)}</span>
            <span>${Math.round(maxCount * 3 / 4)}</span>
            <span>${maxCount}</span>
          </div>
          <div class="chart-axis-label">Quantidade de anomalias identificadas</div>
        </div>
      `;
    } else {
      defectsChartHtml = '<p style="color: #7f8c8d; font-style: italic;">Nenhum defeito classificado encontrado.</p>';
    }

    // Formatação de data em português
    const formatDatePt = (dateStr?: string) => {
      if (!dateStr) return '05 de agosto de 2022';
      try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const year = parts[0];
          const monthNum = parseInt(parts[1], 10) - 1;
          const day = parts[2];
          const months = [
            'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
            'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
          ];
          return `${parseInt(day, 10)} de ${months[monthNum]} de ${year}`;
        }
      } catch (e) {}
      return dateStr;
    };

    const dateFormatted = targetInspection?.inspectionDate
      ? targetInspection.inspectionDate.split('-').reverse().join('').substring(2)
      : '160526';
    const shortId = `A${dateFormatted}`;
    const inspectionDateFormatted = formatDatePt(targetInspection?.inspectionDate);

    const isFacade = project.type?.toLowerCase().includes('fachada') || 
                    inspectionsToReport.some(ins => ins.inspectionType?.toLowerCase().includes('fachada'));
    const reportTitle = isFacade ? 'RELATÓRIO PARCIAL DE INSPEÇÃO DE FACHADAS' : 'RELATÓRIO DE INSPEÇÃO DE TELHADOS E COBERTURA';

    // 3. Montagem das páginas detalhadas de imagens/ortomosaicos (Página 2 em diante)
    let detailPagesHtml = '';

    inspectionsToReport.forEach(inspection => {
      // Ortomosaicos
      if (inspection.orthoResults && inspection.orthoResults.length > 0) {
        inspection.orthoResults.forEach(ortho => {
          const orthoImgSrc = ortho.previewUrl || '';
          if (!orthoImgSrc) return;

          const uniqueClasses = Array.from(new Set(ortho.detections.map(d => d.class_name)));
          const legendHtml = uniqueClasses.map(className => {
            const info = getClassInfo(className);
            return `
              <div class="legend-item">
                <span class="legend-color" style="background-color: ${info.color};"></span>
                <strong>${info.code}</strong> - ${info.label}
              </div>
            `;
          }).join('');

          const detectionsList = ortho.detections || [];
          const tableRowsHtml = detectionsList.map(det => {
            const info = getClassInfo(det.class_name);
            return `
              <tr>
                <td style="font-weight: bold; color: ${info.color};">${info.code}</td>
                <td>${info.label}</td>
                <td style="text-align: right;">${(det.confidence * 100).toFixed(2)}%</td>
              </tr>
            `;
          }).join('');

          const mappedDetections = detectionsList.map(det => {
            const info = getClassInfo(det.class_name);
            return {
              box: det.pixel_box,
              code: info.code,
              label: info.label,
              color: info.color,
              confidence: det.confidence
            };
          });

          detailPagesHtml += `
            <div class="page">
              <!-- HEADER -->
              <div class="report-header">
                <div class="header-content">
                  <div class="logos">UFBA | GETEC</div>
                  <div class="title">${reportTitle}</div>
                </div>
                <div class="header-wave">
                  <svg viewBox="0 0 500 80" preserveAspectRatio="none" style="height: 50px; width: 100%; display: block;">
                    <path d="M0,0 C150,90 350,-40 500,70 L500,80 L0,80 Z" fill="#ffffff"></path>
                  </svg>
                </div>
              </div>

              <!-- CONTENT -->
              <div class="page-content">
                <h3 class="section-title">Localização das anomalias identificadas</h3>
                <div class="image-wrapper-outer">
                  <div class="image-with-detections" data-detections="${escapeHtml(JSON.stringify(mappedDetections))}">
                    <img src="${orthoImgSrc}" alt="Ortomosaico Processado">
                  </div>
                </div>

                <div class="legend-container">
                  <p style="margin: 0 0 6px 0; font-weight: bold; font-size: 12px; color: #0d0f57;">Legenda</p>
                  <div class="legend-grid">
                    ${legendHtml || '<div style="color: #7f8c8d;">Nenhuma anomalia identificada.</div>'}
                  </div>
                </div>

                <h3 class="section-title" style="margin-top: 15px;">Detalhamento das anomalias identificadas</h3>
                <div class="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th style="width: 80px;">Classes</th>
                        <th>Anomalia / Descrição</th>
                        <th style="width: 150px; text-align: right;">Confiança alcançada</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${tableRowsHtml.length > 0 ? tableRowsHtml : '<tr><td colspan="3" style="text-align: center; color: #7f8c8d;">Nenhuma anomalia detalhada.</td></tr>'}
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- FOOTER -->
              <div class="report-footer">
                <svg viewBox="0 0 500 50" preserveAspectRatio="none" style="height: 30px; width: 100%; display: block; transform: rotate(180deg);">
                  <path d="M0,0 C150,50 350,-20 500,40 L500,50 L0,50 Z" fill="#f39c12"></path>
                  <path d="M0,10 C180,60 300,-10 500,30 L500,50 L0,50 Z" fill="#7f8c8d" opacity="0.5"></path>
                </svg>
                <div class="footer-text">
                  <span>Smart Twin IE | UFBA</span>
                  <span>Pág. </span>
                </div>
              </div>
            </div>
          `;
        });
      }

      // Imagens comuns
      if (inspection.images && inspection.images.length > 0) {
        inspection.images.forEach(image => {
          const imgSrc = image.url || '';
          if (!imgSrc) return;

          let detections = image.detections;
          if (typeof detections === 'string') {
            try {
              detections = JSON.parse(detections);
            } catch (error) {
              detections = [];
            }
          }
          const detectionsList = detections || [];

          const uniqueClasses = Array.from(new Set(detectionsList.map(d => d.class_name)));
          const legendHtml = uniqueClasses.map(className => {
            const info = getClassInfo(className);
            return `
              <div class="legend-item">
                <span class="legend-color" style="background-color: ${info.color};"></span>
                <strong>${info.code}</strong> - ${info.label}
              </div>
            `;
          }).join('');

          const tableRowsHtml = detectionsList.map(det => {
            const info = getClassInfo(det.class_name);
            return `
              <tr>
                <td style="font-weight: bold; color: ${info.color};">${info.code}</td>
                <td>${info.label}</td>
                <td style="text-align: right;">${(det.confidence * 100).toFixed(2)}%</td>
              </tr>
            `;
          }).join('');

          const mappedDetections = detectionsList.map(det => {
            const info = getClassInfo(det.class_name);
            return {
              box: det.box,
              code: info.code,
              label: info.label,
              color: info.color,
              confidence: det.confidence
            };
          });

          detailPagesHtml += `
            <div class="page">
              <!-- HEADER -->
              <div class="report-header">
                <div class="header-content">
                  <div class="logos">UFBA | GETEC</div>
                  <div class="title">${reportTitle}</div>
                </div>
                <div class="header-wave">
                  <svg viewBox="0 0 500 80" preserveAspectRatio="none" style="height: 50px; width: 100%; display: block;">
                    <path d="M0,0 C150,90 350,-40 500,70 L500,80 L0,80 Z" fill="#ffffff"></path>
                  </svg>
                </div>
              </div>

              <!-- CONTENT -->
              <div class="page-content">
                <h3 class="section-title">Localização das anomalias identificadas</h3>
                <div class="image-wrapper-outer">
                  <div class="image-with-detections" data-detections="${escapeHtml(JSON.stringify(mappedDetections))}">
                    <img src="${imgSrc}" alt="Imagem de Inspeção">
                  </div>
                </div>

                <div class="legend-container">
                  <p style="margin: 0 0 6px 0; font-weight: bold; font-size: 12px; color: #0d0f57;">Legenda</p>
                  <div class="legend-grid">
                    ${legendHtml || '<div style="color: #7f8c8d;">Nenhuma anomalia identificada.</div>'}
                  </div>
                </div>

                <h3 class="section-title" style="margin-top: 15px;">Detalhamento das anomalias identificadas</h3>
                <div class="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th style="width: 80px;">Classes</th>
                        <th>Anomalia / Descrição</th>
                        <th style="width: 150px; text-align: right;">Confiança alcançada</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${tableRowsHtml.length > 0 ? tableRowsHtml : '<tr><td colspan="3" style="text-align: center; color: #7f8c8d;">Nenhuma anomalia detalhada.</td></tr>'}
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- FOOTER -->
              <div class="report-footer">
                <svg viewBox="0 0 500 50" preserveAspectRatio="none" style="height: 30px; width: 100%; display: block; transform: rotate(180deg);">
                  <path d="M0,0 C150,50 350,-20 500,40 L500,50 L0,50 Z" fill="#f39c12"></path>
                  <path d="M0,10 C180,60 300,-10 500,30 L500,50 L0,50 Z" fill="#7f8c8d" opacity="0.5"></path>
                </svg>
                <div class="footer-text">
                  <span>Smart Twin IE | UFBA</span>
                  <span>Pág. </span>
                </div>
              </div>
            </div>
          `;
        });
      }
    });

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <title>Relatório - ${project.name}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;700;800&display=swap" rel="stylesheet">
          <style>
              @page {
                size: A4 portrait;
                margin: 0;
              }
              body {
                font-family: 'Outfit', sans-serif;
                margin: 0;
                padding: 0;
                background-color: #f5f6fa;
                color: #2f3640;
                -webkit-print-color-adjust: exact;
              }
              
              /* PÁGINAS A4 INDIVIDUAIS */
              .page {
                width: 210mm;
                height: 297mm;
                box-sizing: border-box;
                position: relative;
                page-break-after: always;
                background-color: #ffffff;
                overflow: hidden;
                display: flex;
                flex-direction: column;
              }
              .page:last-child {
                page-break-after: avoid;
              }
              
              .page-content {
                padding: 20px 40px;
                flex: 1;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
              }

              /* HEADER DO RELATÓRIO */
              .report-header {
                background: linear-gradient(135deg, #07073b 0%, #0d0f57 100%);
                position: relative;
                padding: 20px 40px 35px 40px;
                color: white;
                height: 50px;
                display: flex;
                align-items: center;
                box-sizing: border-box;
              }
              .header-content {
                width: 100%;
                display: flex;
                justify-content: space-between;
                align-items: center;
                z-index: 10;
              }
              .report-header .logos {
                font-size: 16px;
                font-weight: 800;
                letter-spacing: 1px;
                color: #ffffff;
              }
              .report-header .title {
                font-size: 13px;
                font-weight: 700;
                letter-spacing: 0.5px;
                text-align: right;
                max-width: 60%;
                opacity: 0.9;
              }
              .header-wave {
                position: absolute;
                bottom: -1px;
                left: 0;
                width: 100%;
                line-height: 0;
                z-index: 5;
              }

              /* FOOTER DO RELATÓRIO */
              .report-footer {
                position: absolute;
                bottom: 0;
                left: 0;
                width: 100%;
                height: 55px;
                z-index: 5;
              }
              .footer-text {
                position: absolute;
                bottom: 12px;
                left: 40px;
                right: 40px;
                display: flex;
                justify-content: space-between;
                font-size: 9px;
                color: #7f8c8d;
                font-weight: 500;
                z-index: 10;
              }

              /* TÍTULOS DE SEÇÃO */
              .section-title {
                font-size: 13px;
                font-weight: 700;
                color: #0d0f57;
                border-bottom: 2px solid #f1f2f6;
                padding-bottom: 4px;
                margin: 0 0 10px 0;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }

              /* LISTA DE INFORMAÇÕES (PAG 1) */
              .info-container {
                display: flex;
                flex-direction: column;
                gap: 5px;
                margin-bottom: 15px;
              }
              .info-item {
                font-size: 11.5px;
                line-height: 1.4;
                color: #2f3640;
              }
              .info-item strong {
                color: #000000;
              }

              /* GRÁFICO DE BARRAS */
              .chart-container {
                margin: 10px 0;
                padding: 10px 15px;
                background-color: #fafbfc;
                border: 1px solid #f1f2f6;
                border-radius: 6px;
              }
              .chart-row {
                display: flex;
                align-items: center;
                margin-bottom: 6px;
                font-size: 10.5px;
              }
              .chart-label {
                width: 180px;
                text-align: right;
                padding-right: 12px;
                font-weight: 500;
                color: #2f3640;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              .chart-bar-wrapper {
                flex: 1;
                display: flex;
                align-items: center;
              }
              .chart-bar {
                height: 12px;
                border-radius: 2px;
              }
              .chart-value {
                margin-left: 8px;
                font-weight: 700;
                color: #2f3640;
              }
              .chart-axis {
                margin-left: 180px;
                display: flex;
                justify-content: space-between;
                border-top: 1px dashed #dcdde1;
                padding-top: 3px;
                font-size: 8px;
                color: #7f8c8d;
              }
              .chart-axis-label {
                text-align: center;
                font-size: 8.5px;
                font-style: italic;
                color: #7f8c8d;
                margin-top: 4px;
              }

              /* IMAGEM COM DETECÇÕES */
              .image-wrapper-outer {
                display: flex;
                justify-content: center;
                align-items: center;
                background-color: #f8f9fa;
                border: 1px solid #f1f2f6;
                border-radius: 4px;
                padding: 5px;
                margin-bottom: 12px;
                max-height: 420px;
                box-sizing: border-box;
              }
              .image-with-detections {
                position: relative;
                display: inline-block;
                max-height: 410px;
                overflow: hidden;
              }
              .image-with-detections img {
                display: block;
                max-width: 100%;
                max-height: 410px;
                width: auto;
                height: auto;
              }

              /* LEGENDA DA PÁGINA DE DETALHES */
              .legend-container {
                background-color: #fafbfc;
                border: 1px solid #f1f2f6;
                border-radius: 5px;
                padding: 8px 12px;
                margin-bottom: 12px;
                box-sizing: border-box;
              }
              .legend-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 6px 15px;
              }
              .legend-item {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 10px;
                width: 47%;
                box-sizing: border-box;
              }
              .legend-color {
                display: inline-block;
                width: 10px;
                height: 10px;
                border-radius: 2px;
                flex-shrink: 0;
              }

              /* TABELA DE DETALHAMENTO */
              .table-container {
                flex: 1;
                overflow: hidden;
                box-sizing: border-box;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                font-size: 10px;
              }
              th, td {
                padding: 5px 8px;
                text-align: left;
                border-bottom: 1px solid #f1f2f6;
              }
              th {
                background-color: #fafbfc;
                font-weight: 700;
                color: #0d0f57;
                text-transform: uppercase;
                font-size: 9px;
                letter-spacing: 0.5px;
              }
              td {
                color: #2f3640;
              }
          </style>
      </head>
      <body>
          <!-- PÁGINA 1: INFORMAÇÕES GERAIS E GRÁFICO -->
          <div class="page">
              <!-- HEADER -->
              <div class="report-header">
                <div class="header-content">
                  <div class="logos">UFBA | GETEC</div>
                  <div class="title">${reportTitle}</div>
                </div>
                <div class="header-wave">
                  <svg viewBox="0 0 500 80" preserveAspectRatio="none" style="height: 50px; width: 100%; display: block;">
                    <path d="M0,0 C150,90 350,-40 500,70 L500,80 L0,80 Z" fill="#ffffff"></path>
                  </svg>
                </div>
              </div>

              <!-- CONTENT -->
              <div class="page-content">
                  <h3 class="section-title">Informações da inspeção</h3>
                  <div class="info-container">
                      <div class="info-item"><strong>ID:</strong> ${shortId}</div>
                      <div class="info-item"><strong>Edificação inspecionada:</strong> ${project.name}</div>
                      <div class="info-item"><strong>Piloto do drone:</strong> ${targetInspection?.inspectionResponsible || 'Alisson'}</div>
                      <div class="info-item"><strong>Observador:</strong> Matheus</div>
                      <div class="info-item"><strong>Responsável pela unidade:</strong> ${project.unitDirector || 'Nome'}</div>
                      <div class="info-item"><strong>Contato do responsável:</strong> (71) 99999-9999</div>
                      <div class="info-item"><strong>Solicitante da SUMAI:</strong> ${project.responsible || 'Jadi Ventin'}</div>
                  </div>

                  <h3 class="section-title">Informações da edificação</h3>
                  <div class="info-container">
                      <div class="info-item"><strong>Ano construído:</strong> ${project.buildingYear || 'N/A'}</div>
                      <div class="info-item"><strong>Área construída:</strong> ${project.builtArea || '1000'} m²</div>
                      <div class="info-item"><strong>Tipologia de telhado:</strong> ${project.roofTypology || 'Fibrocimento'}</div>
                      <div class="info-item"><strong>Data da inspeção:</strong> ${inspectionDateFormatted}</div>
                      <div class="info-item"><strong>Endereço:</strong> ${project.address || 'Av. Min. Antônio Carlos – Bairro, Cidade.'}</div>
                  </div>

                  <h3 class="section-title">Resultados da inspeção</h3>
                  <p style="font-size: 11px; margin: 0 0 10px 0; line-height: 1.4;">
                      O gráfico a seguir sintetiza as anomalias identificadas durante a inspeção. Na sequência, são apresentadas as imagens que evidenciam a localização espacial e a distribuição de cada ocorrência na cobertura inspecionada.
                  </p>
                  
                  ${defectsChartHtml}
              </div>

              <!-- FOOTER -->
              <div class="report-footer">
                <svg viewBox="0 0 500 50" preserveAspectRatio="none" style="height: 30px; width: 100%; display: block; transform: rotate(180deg);">
                  <path d="M0,0 C150,50 350,-20 500,40 L500,50 L0,50 Z" fill="#f39c12"></path>
                  <path d="M0,10 C180,60 300,-10 500,30 L500,50 L0,50 Z" fill="#7f8c8d" opacity="0.5"></path>
                </svg>
                <div class="footer-text">
                  <span>Smart Twin IE | UFBA</span>
                  <span>Pág. 1</span>
                </div>
              </div>
          </div>

          <!-- DETALHAMENTO DE CADA IMAGEM (PAGINA 2 EM DIANTE) -->
          ${detailPagesHtml}

          <!-- SCRIPT CLIENTE PARA DESENHAR BOXES DESSAS IMAGENS -->
          <script>
            window.addEventListener('DOMContentLoaded', () => {
              // Numerar dinamicamente as páginas
              const pageElements = document.querySelectorAll('.page');
              pageElements.forEach((el, index) => {
                const pagSpan = el.querySelector('.footer-text span:last-child');
                if (pagSpan) {
                  pagSpan.innerText = 'Pág. ' + (index + 1);
                }
              });

              // Processar as imagens e seus boxes
              const containers = document.querySelectorAll('.image-with-detections');
              let loadedImages = 0;
              
              const drawBoxes = () => {
                containers.forEach(container => {
                  const img = container.querySelector('img');
                  if (!img) return;
                  
                  const detections = JSON.parse(container.getAttribute('data-detections') || '[]');
                  const natW = img.naturalWidth;
                  const natH = img.naturalHeight;
                  
                  // Limpar caixas anteriores se houver
                  const oldBoxes = container.querySelectorAll('.box-overlay');
                  oldBoxes.forEach(b => b.remove());
                  
                  const rect = img.getBoundingClientRect();
                  const dispW = rect.width;
                  const dispH = rect.height;
                  
                  if (!natW || !natH || !dispW || !dispH) return;
                  
                  const scaleX = dispW / natW;
                  const scaleY = dispH / natH;
                  
                  detections.forEach(det => {
                    if (!det.box) return;
                    
                    const left = det.box.x1 * scaleX;
                    const top = det.box.y1 * scaleY;
                    const width = (det.box.x2 - det.box.x1) * scaleX;
                    const height = (det.box.y2 - det.box.y1) * scaleY;
                    
                    const boxEl = document.createElement('div');
                    boxEl.className = 'box-overlay';
                    boxEl.style.position = 'absolute';
                    boxEl.style.border = '2px solid ' + (det.color || 'red');
                    boxEl.style.left = left + 'px';
                    boxEl.style.top = top + 'px';
                    boxEl.style.width = width + 'px';
                    boxEl.style.height = height + 'px';
                    boxEl.style.boxSizing = 'border-box';
                    boxEl.style.pointerEvents = 'none';
                    
                    // Label overlay
                    const labelSpan = document.createElement('span');
                    labelSpan.innerText = det.code + ' (' + (det.confidence * 100).toFixed(0) + '%)';
                    labelSpan.style.position = 'absolute';
                    labelSpan.style.top = '-14px';
                    labelSpan.style.left = '-2px';
                    labelSpan.style.backgroundColor = det.color || 'red';
                    labelSpan.style.color = '#fff';
                    labelSpan.style.fontSize = '8px';
                    labelSpan.style.fontWeight = 'bold';
                    labelSpan.style.padding = '0px 2px';
                    labelSpan.style.borderRadius = '1px';
                    labelSpan.style.whiteSpace = 'nowrap';
                    labelSpan.style.lineHeight = '12px';
                    
                    boxEl.appendChild(labelSpan);
                    container.appendChild(boxEl);
                  });
                });
                
                // Indicar ao Puppeteer que a renderização foi concluída
                window.renderComplete = true;
              };

              const allImages = document.querySelectorAll('.image-with-detections img');
              if (allImages.length === 0) {
                window.renderComplete = true;
                return;
              }

              allImages.forEach(img => {
                if (img.complete) {
                  loadedImages++;
                  if (loadedImages === allImages.length) {
                    drawBoxes();
                  }
                } else {
                  img.addEventListener('load', () => {
                    loadedImages++;
                    if (loadedImages === allImages.length) {
                      drawBoxes();
                    }
                  });
                  img.addEventListener('error', () => {
                    loadedImages++;
                    if (loadedImages === allImages.length) {
                      drawBoxes();
                    }
                  });
                }
              });
              
              // Fallback para segurança caso demore
              setTimeout(() => {
                if (!window.renderComplete) {
                  drawBoxes();
                }
              }, 4000);
            });
          </script>
      </body>
      </html>
    `;
  }
}

export default ReportService;
