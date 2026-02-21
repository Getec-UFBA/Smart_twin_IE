import rasterio
from rasterio.windows import Window
import numpy as np
from ultralytics import YOLO
import os
from shapely.geometry import box
from shapely.ops import unary_union

class OrthoProcessor:
    def __init__(self, model_path, tile_size=1024, overlap=200):
        self.model = YOLO(model_path, task='detect')
        self.tile_size = tile_size
        self.overlap = overlap

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
