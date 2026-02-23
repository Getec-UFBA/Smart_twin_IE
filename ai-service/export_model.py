from ultralytics import YOLO
import os

# Caminhos dos modelos
script_dir = os.path.dirname(os.path.realpath(__file__))
# Atualizado para o novo modelo padrão
BEST_MODEL_PT = os.path.join(script_dir, 'models/best (3).pt')
BEST_MODEL_ONNX = os.path.join(script_dir, 'models/best.onnx')

def export():
    print(f"--- Iniciando exportação do modelo {BEST_MODEL_PT} para ONNX ---")
    if os.path.exists(BEST_MODEL_PT):
        model = YOLO(BEST_MODEL_PT)
        # Exporta para ONNX otimizado para CPU (resolução 1024)
        # O YOLO gera o .onnx na mesma pasta do .pt original por padrão
        model.export(format='onnx', imgsz=1024, simplify=True)
        print(f"--- Exportação concluída com sucesso ---")
    else:
        print(f"--- Erro: O modelo {BEST_MODEL_PT} não foi encontrado. ---")

if __name__ == "__main__":
    export()
