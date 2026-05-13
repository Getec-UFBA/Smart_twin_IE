import rasterio
from rasterio.windows import Window
import numpy as np
from ultralytics import YOLO
import os
import cv2
from shapely.geometry import box
from shapely.ops import unary_union
import shutil
import gc
import asyncio

class OrthoProcessor:
    def __init__(self, model_path, tile_size=1024, overlap=250):
        self.model = YOLO(model_path, task='detect')
        self.tile_size = tile_size
        self.overlap = overlap

    def _draw_on_image(self, img, detections_in_tile, offset_x=0, offset_y=0, scale=1.0, is_full_res=False):
        res_multiplier = 4.0 if is_full_res else 1.0
        for d in detections_in_tile:
            pb = d["pixel_box"]
            x1, y1 = int((pb["x1"] - offset_x) * scale), int((pb["y1"] - offset_y) * scale)
            x2, y2 = int((pb["x2"] - offset_x) * scale), int((pb["y2"] - offset_y) * scale)
            conf, label = d["confidence"], f"{d['class_name']} {d['confidence']:.2f}"
            color, thickness = (0, 0, 255), max(2, int(6 * scale * res_multiplier))
            cv2.rectangle(img, (x1, y1), (x2, y2), color, thickness)
            font_scale, font_thickness = 1.2 * scale * res_multiplier, max(1, int(3 * scale * res_multiplier))
            (w, h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, font_thickness)
            cv2.rectangle(img, (x1, y1 - h - 20), (x1 + w, y1), color, -1)
            cv2.putText(img, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, font_scale, (255, 255, 255), font_thickness)
        return img

    def save_annotated_ortho(self, input_path, output_path, detections):
        if not detections:
            shutil.copy(input_path, output_path)
            return
        print(f"[IA] Gerando ortomosaico anotado...")
        shutil.copy(input_path, output_path)
        with rasterio.open(output_path, "r+") as dst:
            for d in detections:
                pb = d["pixel_box"]
                margin = 100
                x1, y1 = max(0, int(pb["x1"]) - margin), max(0, int(pb["y1"]) - margin)
                x2, y2 = min(dst.width, int(pb["x2"]) + margin), min(dst.height, int(pb["y2"]) + margin)
                win = Window(x1, y1, x2 - x1, y2 - y1)
                img_data = dst.read([1, 2, 3], window=win)
                if img_data.dtype != np.uint8:
                    img_data = ((img_data - img_data.min()) / (img_data.max() - img_data.min() + 1e-5) * 255).astype(np.uint8)
                img = np.moveaxis(img_data, 0, -1).copy()
                self._draw_on_image(img, [d], offset_x=x1, offset_y=y1, is_full_res=True)
                dst.write(np.moveaxis(img, -1, 0), [1, 2, 3], window=win)
                del img_data, img
                gc.collect()

    def generate_preview(self, tiff_path, output_path, detections, max_dim=2048):
        print(f"[IA] Gerando pré-visualização...")
        with rasterio.open(tiff_path) as src:
            scale = max_dim / max(src.width, src.height)
            if scale > 1.0: scale = 1.0
            new_w, new_h = int(src.width * scale), int(src.height * scale)
            img_data = src.read([1, 2, 3], out_shape=(3, new_h, new_w), resampling=rasterio.enums.Resampling.bilinear)
            if img_data.dtype != np.uint8:
                img_data = ((img_data - img_data.min()) / (img_data.max() - img_data.min() + 1e-5) * 255).astype(np.uint8)
            img = np.moveaxis(img_data, 0, -1).copy()
            if detections: self._draw_on_image(img, detections, scale=scale)
            cv2.imwrite(output_path, img, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
            del img_data, img
            gc.collect()

    def _apply_nms(self, detections, iou_threshold=0.3):
        if not detections: return []
        boxes = [box(d["pixel_box"]["x1"], d["pixel_box"]["y1"], d["pixel_box"]["x2"], d["pixel_box"]["y2"]) for d in detections]
        sorted_indices = sorted(range(len(detections)), key=lambda i: detections[i]["confidence"], reverse=True)
        final_indices = []
        while sorted_indices:
            current = sorted_indices.pop(0)
            final_indices.append(current)
            remaining_indices = []
            for i in sorted_indices:
                iou = boxes[current].intersection(boxes[i]).area / boxes[current].union(boxes[i]).area if boxes[current].union(boxes[i]).area > 0 else 0
                if iou < iou_threshold: remaining_indices.append(i)
            sorted_indices = remaining_indices
        return [detections[i] for i in final_indices]

    async def process_ortho_async(self, tiff_path, on_progress=None):
        raw_detections = []
        with rasterio.open(tiff_path) as src:
            w, h, transform = src.width, src.height, src.transform
            print(f"[IA] Processando {w}x{h} pixels.")

            # 1. SCAN GLOBAL (PARA DEFEITOS GRANDES)
            if on_progress: await on_progress("IA: Realizando varredura global...")
            global_sz = 2048 # Tamanho equilibrado para segurança e detecção
            img_data = src.read([1, 2, 3], out_shape=(3, global_sz, global_sz), resampling=rasterio.enums.Resampling.bilinear)
            if img_data.dtype != np.uint8:
                img_data = ((img_data - img_data.min()) / (img_data.max() - img_data.min() + 1e-5) * 255).astype(np.uint8)
            res = self.model(np.moveaxis(img_data, 0, -1), imgsz=global_sz, conf=0.15, verbose=False)
            if res and res[0].boxes:
                sx, sy = w / global_sz, h / global_sz
                for b in res[0].boxes:
                    x1, y1, x2, y2 = map(float, b.xyxy[0])
                    raw_detections.append({"class_name": self.model.names[int(b.cls[0])], "confidence": float(b.conf[0]), "pixel_box": {"x1": x1*sx, "y1": y1*sy, "x2": x2*sx, "y2": y2*sy}, "source": "global"})
            del img_data
            gc.collect()

            # 2. SCAN POR FATIAS (PARA DEFEITOS PEQUENOS)
            step = self.tile_size - self.overlap
            x_steps = list(range(0, w, step))
            y_steps = list(range(0, h, step))
            total = len(x_steps) * len(y_steps)
            count = 0

            for y in y_steps:
                for x in x_steps:
                    count += 1
                    if count % 10 == 0 and on_progress:
                        await on_progress(f"IA: Fatiando ortomosaico ({count}/{total})...")
                    
                    win = Window(x, y, min(self.tile_size, w - x), min(self.tile_size, h - y))
                    img_data = src.read([1, 2, 3], window=win)
                    if np.mean(img_data) < 1.0: continue
                    if img_data.dtype != np.uint8:
                        img_data = ((img_data - img_data.min()) / (img_data.max() - img_data.min() + 1e-5) * 255).astype(np.uint8)
                    tile_img = np.moveaxis(img_data, 0, -1)
                    if tile_img.shape[0] != self.tile_size or tile_img.shape[1] != self.tile_size:
                        pad = np.zeros((self.tile_size, self.tile_size, 3), dtype=np.uint8)
                        pad[:tile_img.shape[0], :tile_img.shape[1], :] = tile_img
                        tile_img = pad
                    res = self.model(tile_img, imgsz=self.tile_size, conf=0.20, verbose=False)
                    if res and res[0].boxes:
                        for b in res[0].boxes:
                            x1, y1, x2, y2 = map(float, b.xyxy[0])
                            raw_detections.append({"class_name": self.model.names[int(b.cls[0])], "confidence": float(b.conf[0]), "pixel_box": {"x1": x+x1, "y1": y+y1, "x2": x+x2, "y2": y+y2}, "source": "tile"})
                    del img_data, tile_img
                    gc.collect()

            # 3. NMS E GEO-REFERENCIAMENTO
            if on_progress: await on_progress("IA: Unificando detecções e calculando coordenadas...")
            filtered = self._apply_nms(raw_detections)
            final = []
            for d in filtered:
                pb = d["pixel_box"]
                lon1, lat1 = transform * (pb["x1"], pb["y1"])
                lon2, lat2 = transform * (pb["x2"], pb["y2"])
                d["geo_box"] = {"lat1": lat1, "lon1": lon1, "lat2": lat2, "lon2": lon2}
                d["center"] = {"lat": (lat1+lat2)/2, "lon": (lon1+lon2)/2}
                final.append(d)
        return final

if __name__ == "__main__":
    pass
