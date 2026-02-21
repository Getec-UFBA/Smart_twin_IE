from ultralytics import YOLO
import os

# Caminhos dos modelos
script_dir = os.path.dirname(os.path.realpath(__file__))
BEST_MODEL_PT = os.path.join(script_dir, 'models/best.pt')
BEST_MODEL_ONNX = os.path.join(script_dir, 'models/best.onnx')

def export():
    print(f"--- Iniciando exportação do modelo {BEST_MODEL_PT} para ONNX ---")
    if os.path.exists(BEST_MODEL_PT):
        model = YOLO(BEST_MODEL_PT)
        # Exporta para ONNX otimizado para CPU (resolução 1024)
        model.export(format='onnx', imgsz=1024, simplify=True)
        print(f"--- Exportação concluída com sucesso: {BEST_MODEL_ONNX} ---")
    else:
        print(f"--- Erro: O modelo {BEST_MODEL_PT} não foi encontrado. ---")

if __name__ == "__main__":
    export()
