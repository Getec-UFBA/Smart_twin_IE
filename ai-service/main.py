from fastapi import FastAPI, File, UploadFile, BackgroundTasks
from fastapi.responses import StreamingResponse, JSONResponse
import cv2
import numpy as np
from ultralytics import YOLO
import io
import os
import base64
from ortho_processor import OrthoProcessor

app = FastAPI()

# --- caminhos dos modelos ---
script_dir = os.path.dirname(os.path.realpath(__file__))
# Prioriza ONNX se existir para melhor performance em CPU
BEST_MODEL_PATH = os.getenv("BEST_MODEL_PATH", os.path.join(script_dir, 'models/best.onnx' if os.path.exists(os.path.join(script_dir, 'models/best.onnx')) else 'models/best.pt'))
LAST_MODEL_PATH = os.getenv("LAST_MODEL_PATH", os.path.join(script_dir, 'models/last.pt'))

# Load the YOLO models
model_best = YOLO(BEST_MODEL_PATH)
model_last = YOLO(LAST_MODEL_PATH)

# Default model
model = model_best

# Inicializa o processador de ortofotos
ortho_processor = OrthoProcessor(BEST_MODEL_PATH)

@app.post("/process-image/")
async def process_image(file: UploadFile = File(...)):
    """
    Recebe uma imagem comum (PNG/JPG), processa e retorna base64 + detecções.
    """
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    results = model(img)
    detections_data = []
    if results and results[0].boxes:
        for box in results[0].boxes:
            x1, y1, x2, y2 = map(float, box.xyxy[0])
            conf = float(box.conf[0])
            cls = int(box.cls[0])
            class_name = model.names[cls]

            detections_data.append({
                "class_name": class_name,
                "confidence": conf,
                "box": {"x1": x1, "y1": y1, "x2": x2, "y2": y2}
            })

    annotated_img = results[0].plot()
    # Encode como JPEG com 70% de qualidade para economizar MUITO espaço
    encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 70]
    _, encoded_img = cv2.imencode('.jpg', annotated_img, encode_param)
    encoded_img_base64 = base64.b64encode(encoded_img.tobytes()).decode('utf-8')

    return JSONResponse(content={
        "processed_image_base64": encoded_img_base64,
        "detections": detections_data
    })

@app.post("/process-ortho/")
async def process_ortho(file: UploadFile = File(...)):
    """
    Recebe um GeoTIFF (ortomosaico), processa via fatiamento e retorna detecções georreferenciadas.
    Como ortofotos são grandes, salvamos temporariamente para o Rasterio ler.
    """
    temp_path = os.path.join(script_dir, f"temp_{file.filename}")
    with open(temp_path, "wb") as buffer:
        buffer.write(await file.read())
    
    try:
        detections = ortho_processor.process_ortho(temp_path)
        return JSONResponse(content={
            "filename": file.filename,
            "detections_count": len(detections),
            "detections": detections
        })
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.get("/switch-model/{model_name}")
async def switch_model(model_name: str):
    global model
    if model_name.lower() == 'best':
        model = model_best
        return {"message": f"Switched to 'best' model ({BEST_MODEL_PATH})."}
    elif model_name.lower() == 'last':
        model = model_last
        return {"message": "Switched to 'last' model."}
    else:
        return {"message": "Invalid model name."}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
