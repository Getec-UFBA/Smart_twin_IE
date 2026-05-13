from fastapi import FastAPI, File, UploadFile, BackgroundTasks, Form
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import cv2
import numpy as np
from ultralytics import YOLO
import io
import os
import base64
import uuid
import httpx
import asyncio
from ortho_processor import OrthoProcessor

app = FastAPI()

# --- caminhos ---
script_dir = os.path.dirname(os.path.realpath(__file__))
outputs_dir = os.path.join(script_dir, "public/outputs")
os.makedirs(outputs_dir, exist_ok=True)

app.mount("/outputs", StaticFiles(directory=outputs_dir), name="outputs")

BEST_MODEL_PATH = os.getenv("BEST_MODEL_PATH", os.path.join(script_dir, 'models/best.onnx' if os.path.exists(os.path.join(script_dir, 'models/best.onnx')) else 'models/best (3).pt'))
LAST_MODEL_PATH = os.getenv("LAST_MODEL_PATH", os.path.join(script_dir, 'models/last (2).pt'))

model_best = YOLO(BEST_MODEL_PATH)
model_last = YOLO(LAST_MODEL_PATH)
model = model_best
ortho_processor = OrthoProcessor(BEST_MODEL_PATH)

async def send_status_ping(callback_url: str, project_id: str, inspection_id: str, status: str):
    """
    Envia um ping de status para o backend para que o usuário veja o progresso.
    """
    if not callback_url: return
    # A URL de status é a mesma do callback mas com /status no final
    status_url = callback_url.replace("/ortho-callback", "/ortho-status")
    try:
        async with httpx.AsyncClient() as client:
            await client.post(status_url, json={
                "projectId": project_id,
                "inspectionId": inspection_id,
                "status": status
            }, timeout=5.0)
    except Exception as e:
        print(f"[IA] Falha ao enviar ping de status: {e}")

async def run_ortho_processing_task(temp_in: str, request_id: str, original_filename: str, project_id: str, inspection_id: str, callback_url: str):
    try:
        print(f"[IA] Início do processamento para o projeto {project_id}")
        await send_status_ping(callback_url, project_id, inspection_id, "Iniciando análise global...")
        
        # 1. Processamento e Detecção (Com varredura global integrada)
        # Passamos uma função de callback para o processador reportar progresso
        async def on_progress(msg):
            await send_status_ping(callback_url, project_id, inspection_id, msg)

        detections = await ortho_processor.process_ortho_async(temp_in, on_progress)
        
        # 2. Geração de Arquivo Anotado
        await send_status_ping(callback_url, project_id, inspection_id, "Gerando GeoTIFF com marcações...")
        annotated_filename = f"annotated_{request_id}_{original_filename}"
        annotated_path = os.path.join(outputs_dir, annotated_filename)
        ortho_processor.save_annotated_ortho(temp_in, annotated_path, detections)
        
        # 3. Geração de Pré-visualização
        await send_status_ping(callback_url, project_id, inspection_id, "Criando imagem de preview...")
        preview_filename = f"preview_{request_id}.jpg"
        preview_path = os.path.join(outputs_dir, preview_filename)
        ortho_processor.generate_preview(temp_in, preview_path, detections)
        
        print(f"[IA] Processamento concluído. Enviando callback final.")
        await send_status_ping(callback_url, project_id, inspection_id, "Finalizando e salvando no Storage...")

        # 4. Enviar resultado final
        if callback_url:
            payload = {
                "projectId": project_id,
                "inspectionId": inspection_id,
                "detections": detections,
                "annotated_ortho_url": f"/outputs/{annotated_filename}",
                "preview_url": f"/outputs/{preview_filename}",
                "filename": original_filename
            }
            async with httpx.AsyncClient() as client:
                for i in range(3):
                    try:
                        resp = await client.post(callback_url, json=payload, timeout=60.0)
                        print(f"[IA] Callback enviado. Status: {resp.status_code}")
                        break
                    except Exception as e:
                        print(f"[IA] Erro no callback (tentativa {i+1}): {e}")
                        await asyncio.sleep(5)
    except Exception as e:
        print(f"[IA] Erro crítico: {e}")
        await send_status_ping(callback_url, project_id, inspection_id, f"ERRO: {str(e)}")
    finally:
        if os.path.exists(temp_in):
            os.remove(temp_in)

@app.post("/process-image/")
async def process_image(file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    results = model(img)
    detections_data = []
    if results and results[0].boxes:
        for box in results[0].boxes:
            x1, y1, x2, y2 = map(float, box.xyxy[0])
            detections_data.append({
                "class_name": model.names[int(box.cls[0])],
                "confidence": float(box.conf[0]),
                "box": {"x1": x1, "y1": y1, "x2": x2, "y2": y2}
            })
    annotated_img = results[0].plot()
    _, encoded_img = cv2.imencode('.jpg', annotated_img, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
    return JSONResponse(content={"processed_image_base64": base64.b64encode(encoded_img.tobytes()).decode('utf-8'), "detections": detections_data})

@app.post("/process-ortho/")
async def process_ortho(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    projectId: str = Form(...),
    inspectionId: str = Form(...),
    callbackUrl: str = Form(None)
):
    request_id = str(uuid.uuid4())
    temp_in = os.path.join(script_dir, f"temp_in_{request_id}_{file.filename}")
    with open(temp_in, "wb") as buffer:
        buffer.write(await file.read())
    
    background_tasks.add_task(run_ortho_processing_task, temp_in, request_id, file.filename, projectId, inspectionId, callbackUrl)
    return JSONResponse(status_code=202, content={"message": "Processamento iniciado."})

@app.get("/switch-model/{model_name}")
async def switch_model(model_name: str):
    global model
    if model_name.lower() == 'best':
        model = model_best
        ortho_processor.model = model
        return {"message": "Switched to 'best'."}
    elif model_name.lower() == 'last':
        model = model_last
        ortho_processor.model = model
        return {"message": "Switched to 'last'."}
    return {"message": "Invalid model."}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
