import rasterio
from rasterio.windows import Window
import numpy as np
from ultralytics import YOLO
import os
import cv2
from shapely.geometry import box
from shapely.ops import unary_union
import shutil

class OrthoProcessor:
    def __init__(self, model_path, tile_size=1024, overlap=200):
        self.model = YOLO(model_path, task='detect')
        self.tile_size = tile_size
        self.overlap = overlap

    def _draw_on_image(self, img, detections_in_tile, offset_x=0, offset_y=0, scale=1.0):
        """
        Desenha as caixas e textos em uma imagem (numpy array).
        """
        for d in detections_in_tile:
            pb = d["pixel_box"]
            x1 = int((pb["x1"] - offset_x) * scale)
            y1 = int((pb["y1"] - offset_y) * scale)
            x2 = int((pb["x2"] - offset_x) * scale)
            y2 = int((pb["y2"] - offset_y) * scale)
            
            conf = d["confidence"]
            label = f"{d['class_name']} {conf:.2f}"
            
            # Cor: Vermelho para defeitos
            color = (0, 0, 255) # BGR
            thickness = max(1, int(3 * scale))
            
            cv2.rectangle(img, (x1, y1), (x2, y2), color, thickness)
            
            font_scale = 0.8 * scale
            font_thickness = max(1, int(2 * scale))
            (w, h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, font_thickness)
            
            cv2.rectangle(img, (x1, y1 - h - 10), (x1 + w, y1), color, -1)
            cv2.putText(img, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, font_scale, (255, 255, 255), font_thickness)
        
        return img

    def save_annotated_ortho(self, input_path, output_path, detections):
        """
        Cria uma cópia do GeoTIFF e desenha as detecções nele.
        """
        if not detections:
            shutil.copy(input_path, output_path)
            return

        print(f"[IA] Gerando ortomosaico anotado: {output_path}")
        # Copia o arquivo original para o destino para manter todos os metadados e estrutura
        shutil.copy(input_path, output_path)
        
        # Abre o arquivo de saída em modo leitura/escrita
        with rasterio.open(output_path, "r+") as dst:
            # Agrupa detecções por "área" para minimizar operações de escrita
            # Mas para simplificar e garantir precisão, vamos desenhar cada detecção individualmente
            # lendo apenas o pedaço necessário.
            for d in detections:
                pb = d["pixel_box"]
                # Adiciona uma margem para o texto não ser cortado
                margin = 50
                x1 = max(0, int(pb["x1"]) - margin)
                y1 = max(0, int(pb["y1"]) - margin)
                x2 = min(dst.width, int(pb["x2"]) + margin)
                y2 = min(dst.height, int(pb["y2"]) + margin)
                
                win = Window(x1, y1, x2 - x1, y2 - y1)
                
                # Lê os dados (RGB)
                img_data = dst.read([1, 2, 3], window=win)
                # Transpõe para HWC
                img = np.moveaxis(img_data, 0, -1).copy()
                
                # Desenha
                self._draw_on_image(img, [d], offset_x=x1, offset_y=y1)
                
                # Transpõe de volta para CHW
                out_data = np.moveaxis(img, -1, 0)
                # Escreve de volta
                dst.write(out_data, [1, 2, 3], window=win)

    def generate_preview(self, tiff_path, output_path, detections, max_dim=2048):
        """
        Gera um JPEG de pré-visualização em baixa resolução.
        """
        print(f"[IA] Gerando imagem de pré-visualização: {output_path}")
        with rasterio.open(tiff_path) as src:
            width = src.width
            height = src.height
            
            # Calcula escala para o preview
            scale = max_dim / max(width, height)
            if scale > 1.0: scale = 1.0
            
            new_width = int(width * scale)
            new_height = int(height * scale)
            
            # Lê a imagem inteira com o tamanho reduzido (decimation)
            img_data = src.read(
                [1, 2, 3],
                out_shape=(3, new_height, new_width),
                resampling=rasterio.enums.Resampling.bilinear
            )
            
            img = np.moveaxis(img_data, 0, -1).copy()
            
            # Desenha todas as detecções na imagem escalonada
            if detections:
                self._draw_on_image(img, detections, scale=scale)
            
            # Converte BGR -> RGB para salvar corretamente se usar PIL, mas OpenCV salva em BGR
            # Como usamos cv2.imwrite, mantemos BGR (que é o que o _draw_on_image produz)
            cv2.imwrite(output_path, img, [int(cv2.IMWRITE_JPEG_QUALITY), 85])

    def _apply_nms(self, detections, iou_threshold=0.5):
        if not detections:
            return []
        
        # Converte para formato esperado pelo YOLO NMS ou faz manual com Shapely
        # Como temos poucas detecções comparado a pixels, Shapely é viável e preciso
        boxes = []
        for d in detections:
            pb = d["pixel_box"]
            boxes.append(box(pb["x1"], pb["y1"], pb["x2"], pb["y2"]))
        
        indices_to_keep = list(range(len(detections)))
        
        # Ordena por confiança (descendente)
        sorted_indices = sorted(range(len(detections)), key=lambda i: detections[i]["confidence"], reverse=True)
        
        final_indices = []
        while sorted_indices:
            current = sorted_indices.pop(0)
            final_indices.append(current)
            
            remaining_indices = []
            for i in sorted_indices:
                intersection = boxes[current].intersection(boxes[i]).area
                union = boxes[current].union(boxes[i]).area
                iou = intersection / union if union > 0 else 0
                
                if iou < iou_threshold:
                    remaining_indices.append(i)
            sorted_indices = remaining_indices
            
        return [detections[i] for i in final_indices]

    def process_ortho(self, tiff_path):
        raw_detections = []
        
        with rasterio.open(tiff_path) as src:
            width = src.width
            height = src.height
            transform = src.transform
            
            # Calcula o número total de tiles para o log de progresso
            x_steps = list(range(0, width, self.tile_size - self.overlap))
            y_steps = list(range(0, height, self.tile_size - self.overlap))
            total_tiles = len(x_steps) * len(y_steps)
            processed_tiles = 0
            
            print(f"[IA] Ortofoto carregada: {width}x{height} pixels.")
            print(f"[IA] Total de fatias (tiles) a processar: {total_tiles}")
            print(f"[IA] Usando dispositivo: {self.model.device}")

            # Divide a ortofoto em janelas (tiles)
            for y in y_steps:
                for x in x_steps:
                    processed_tiles += 1
                    if processed_tiles % 10 == 0 or processed_tiles == total_tiles:
                        print(f"[IA] Processando fatia {processed_tiles}/{total_tiles} ({(processed_tiles/total_tiles)*100:.1f}%)")
                    
                    # Define a janela de leitura
                    window = Window(x, y, self.tile_size, self.tile_size)
                    
                    # Lê a imagem nessa janela (3 canais RGB)
                    img_data = src.read([1, 2, 3], window=window)
                    
                    # Otimização: Pula janelas que são majoritariamente pretas ou sem dados (nodata)
                    # Verifica se há conteúdo significativo (pelo menos 1% dos pixels com valor > 0)
                    if np.sum(img_data) < (self.tile_size * self.tile_size * 3 * 0.01):
                        continue

                    # Converte para formato HWC (OpenCV/YOLO compatível)
                    img = np.moveaxis(img_data, 0, -1)
                    
                    # Se a janela for menor que o esperado (bordas), preenche com preto
                    if img.shape[0] != self.tile_size or img.shape[1] != self.tile_size:
                        canvas = np.zeros((self.tile_size, self.tile_size, 3), dtype=np.uint8)
                        canvas[:img.shape[0], :img.shape[1], :] = img
                        img = canvas
                    
                    # Inferência na fatia
                    results = self.model(img, imgsz=self.tile_size, conf=0.25, verbose=False)
                    
                    # Extrai e converte as detecções desta janela
                    if results and results[0].boxes:
                        for b in results[0].boxes:
                            x1, y1, x2, y2 = map(float, b.xyxy[0])
                            conf = float(b.conf[0])
                            cls = int(b.cls[0])
                            class_name = self.model.names[cls]
                            
                            # Ajusta coordenadas de pixel para a imagem global (Ortofoto)
                            global_x1 = x + x1
                            global_y1 = y + y1
                            global_x2 = x + x2
                            global_y2 = y + y2
                            
                            raw_detections.append({
                                "class_name": class_name,
                                "confidence": conf,
                                "pixel_box": {"x1": global_x1, "y1": global_y1, "x2": global_x2, "y2": global_y2}
                            })
            
            # Aplica NMS nas detecções brutas
            filtered_detections = self._apply_nms(raw_detections)
            
            # Converte as detecções finais para coordenadas geográficas
            final_detections = []
            for d in filtered_detections:
                pb = d["pixel_box"]
                lon1, lat1 = transform * (pb["x1"], pb["y1"])
                lon2, lat2 = transform * (pb["x2"], pb["y2"])
                
                d["geo_box"] = {"lat1": lat1, "lon1": lon1, "lat2": lat2, "lon2": lon2}
                d["center"] = {"lat": (lat1 + lat2) / 2, "lon": (lon1 + lon2) / 2}
                final_detections.append(d)
                
        return final_detections

if __name__ == "__main__":
    # Teste básico se chamado diretamente
    pass
