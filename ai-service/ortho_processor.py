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
    def __init__(self, model_path, tile_size=2048, overlap=500):
        self.model = YOLO(model_path, task='detect')
        self.tile_size = tile_size
        self.overlap = overlap

    def _draw_on_image(self, img, detections_in_tile, offset_x=0, offset_y=0, scale=1.0, is_full_res=False):
        """
        Desenha as caixas e textos em uma imagem.
        Se is_full_res=True, aumenta significativamente o tamanho para ser visível em imagens gigantes.
        """
        # Multiplicador de escala para imagens de alta resolução
        res_multiplier = 4.0 if is_full_res else 1.0
        
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
            thickness = max(2, int(6 * scale * res_multiplier))
            
            cv2.rectangle(img, (x1, y1), (x2, y2), color, thickness)
            
            font_scale = 1.2 * scale * res_multiplier
            font_thickness = max(1, int(3 * scale * res_multiplier))
            (w, h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, font_thickness)
            
            # Garante que o fundo do texto seja visível
            cv2.rectangle(img, (x1, y1 - h - 20), (x1 + w, y1), color, -1)
            cv2.putText(img, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, font_scale, (255, 255, 255), font_thickness)
        
        return img

    def save_annotated_ortho(self, input_path, output_path, detections):
        """
        Cria uma cópia do GeoTIFF e desenha as detecções nele.
        """
        if not detections:
            shutil.copy(input_path, output_path)
            return

        print(f"[IA] Gerando ortomosaico anotado: {output_path}")
        shutil.copy(input_path, output_path)
        
        with rasterio.open(output_path, "r+") as dst:
            for d in detections:
                pb = d["pixel_box"]
                # Margem maior para as marcações agora maiores
                margin = 150
                x1 = max(0, int(pb["x1"]) - margin)
                y1 = max(0, int(pb["y1"]) - margin)
                x2 = min(dst.width, int(pb["x2"]) + margin)
                y2 = min(dst.height, int(pb["y2"]) + margin)
                
                win = Window(x1, y1, x2 - x1, y2 - y1)
                
                img_data = dst.read([1, 2, 3], window=win)
                # Converte para uint8 para garantir que o OpenCV desenhe corretamente
                if img_data.dtype != np.uint8:
                    # Normalização simples se for 16-bit ou float
                    img_data = ((img_data - img_data.min()) / (img_data.max() - img_data.min() + 1e-5) * 255).astype(np.uint8)
                
                img = np.moveaxis(img_data, 0, -1).copy()
                
                # Desenha com multiplicador de alta resolução
                self._draw_on_image(img, [d], offset_x=x1, offset_y=y1, is_full_res=True)
                
                out_data = np.moveaxis(img, -1, 0)
                dst.write(out_data, [1, 2, 3], window=win)

    def generate_preview(self, tiff_path, output_path, detections, max_dim=2500):
        """
        Gera um JPEG de pré-visualização em baixa resolução.
        """
        print(f"[IA] Gerando imagem de pré-visualização: {output_path}")
        with rasterio.open(tiff_path) as src:
            width = src.width
            height = src.height
            
            scale = max_dim / max(width, height)
            if scale > 1.0: scale = 1.0
            
            new_width = int(width * scale)
            new_height = int(height * scale)
            
            img_data = src.read(
                [1, 2, 3],
                out_shape=(3, new_height, new_width),
                resampling=rasterio.enums.Resampling.bilinear
            )
            
            # Converte para uint8 se necessário
            if img_data.dtype != np.uint8:
                img_data = ((img_data - img_data.min()) / (img_data.max() - img_data.min() + 1e-5) * 255).astype(np.uint8)

            img = np.moveaxis(img_data, 0, -1).copy()
            
            if detections:
                self._draw_on_image(img, detections, scale=scale, is_full_res=False)
            
            cv2.imwrite(output_path, img, [int(cv2.IMWRITE_JPEG_QUALITY), 80])

    def _apply_nms(self, detections, iou_threshold=0.4):
        if not detections:
            return []
        
        boxes = []
        for d in detections:
            pb = d["pixel_box"]
            boxes.append(box(pb["x1"], pb["y1"], pb["x2"], pb["y2"]))
        
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
            
            print(f"[IA] Ortofoto carregada: {width}x{height} pixels ({src.dtypes[0]}).")

            # --- PASSO 1: VARREDURA GLOBAL (PARA DEFEITOS GRANDES) ---
            print("[IA] Iniciando varredura global (sem fatiamento) para defeitos grandes...")
            global_imgsz = 3072 # Tamanho razoável para detectar coisas grandes sem estourar memória
            
            # Lê e redimensiona a imagem inteira
            img_data_global = src.read(
                [1, 2, 3],
                out_shape=(3, global_imgsz, global_imgsz),
                resampling=rasterio.enums.Resampling.bilinear
            )
            
            if img_data_global.dtype != np.uint8:
                img_data_global = ((img_data_global - img_data_global.min()) / (img_data_global.max() - img_data_global.min() + 1e-5) * 255).astype(np.uint8)
            
            img_global = np.moveaxis(img_data_global, 0, -1)
            
            # Inferência Global
            results_global = self.model(img_global, imgsz=global_imgsz, conf=0.15, verbose=False)
            
            scale_x = width / global_imgsz
            scale_y = height / global_imgsz
            
            if results_global and results_global[0].boxes:
                for b in results_global[0].boxes:
                    x1, y1, x2, y2 = map(float, b.xyxy[0])
                    conf = float(b.conf[0])
                    cls = int(b.cls[0])
                    class_name = self.model.names[cls]
                    
                    # Mapeia de volta para as coordenadas originais do ortomosaico
                    raw_detections.append({
                        "class_name": class_name,
                        "confidence": conf,
                        "pixel_box": {
                            "x1": x1 * scale_x, 
                            "y1": y1 * scale_y, 
                            "x2": x2 * scale_x, 
                            "y2": y2 * scale_y
                        },
                        "source": "global"
                    })
                print(f"[IA] Varredura global concluída. {len(results_global[0].boxes)} possíveis defeitos grandes encontrados.")

            # --- PASSO 2: VARREDURA POR FATIAS (PARA DEFEITOS MENORES) ---
            print(f"[IA] Iniciando varredura por fatias ({self.tile_size}px)...")
            x_steps = list(range(0, width, self.tile_size - self.overlap))
            y_steps = list(range(0, height, self.tile_size - self.overlap))
            total_tiles = len(x_steps) * len(y_steps)
            processed_tiles = 0
            
            for y in y_steps:
                for x in x_steps:
                    processed_tiles += 1
                    if processed_tiles % 20 == 0 or processed_tiles == total_tiles:
                        print(f"[IA] Processando fatia {processed_tiles}/{total_tiles} ({(processed_tiles/total_tiles)*100:.1f}%)")
                    
                    window = Window(x, y, self.tile_size, self.tile_size)
                    img_data = src.read([1, 2, 3], window=window)
                    
                    if np.sum(img_data) < (self.tile_size * self.tile_size * 3 * 0.01):
                        continue

                    if img_data.dtype != np.uint8:
                        img_data = ((img_data - img_data.min()) / (img_data.max() - img_data.min() + 1e-5) * 255).astype(np.uint8)

                    img = np.moveaxis(img_data, 0, -1)
                    
                    # Padding se a fatia for menor que o tile_size (bordas da imagem)
                    if img.shape[0] != self.tile_size or img.shape[1] != self.tile_size:
                        canvas = np.zeros((self.tile_size, self.tile_size, 3), dtype=np.uint8)
                        canvas[:img.shape[0], :img.shape[1], :] = img
                        img = canvas
                    
                    # Inferência na Fatia
                    results = self.model(img, imgsz=self.tile_size, conf=0.20, verbose=False)
                    
                    if results and results[0].boxes:
                        for b in results[0].boxes:
                            x1, y1, x2, y2 = map(float, b.xyxy[0])
                            conf = float(b.conf[0])
                            cls = int(b.cls[0])
                            class_name = self.model.names[cls]
                            
                            raw_detections.append({
                                "class_name": class_name,
                                "confidence": conf,
                                "pixel_box": {"x1": x + x1, "y1": y + y1, "x2": x + x2, "y2": y + y2},
                                "source": "tile"
                            })
            
            # --- PASSO 3: NMS (UNIFICAR DETECÇÕES) ---
            filtered_detections = self._apply_nms(raw_detections, iou_threshold=0.3)
            
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
    pass
