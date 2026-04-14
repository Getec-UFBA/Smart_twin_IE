import os
import sys
from ultralytics import YOLO

def test_load():
    try:
        # Pega o diretório do script
        script_dir = os.path.dirname(os.path.realpath(__file__))
        
        # Define o caminho do modelo (exatamente como no main.py)
        # O nome do arquivo tem um espaço e parênteses: 'best (3).pt'
        model_path = os.path.join(script_dir, 'models', 'best (3).pt')
        
        print(f"--- Verificando modelo em: {model_path} ---")
        
        if not os.path.exists(model_path):
            print(f"❌ ERRO: O arquivo do modelo não foi encontrado em {model_path}")
            sys.exit(1)
            
        # Verifica se o arquivo é apenas um ponteiro LFS (menos de 1KB)
        file_size = os.path.getsize(model_path)
        if file_size < 1000:
            print(f"❌ ERRO: O arquivo do modelo parece ser um ponteiro do Git LFS (apenas {file_size} bytes).")
            print("Certifique-se de ter instalado o 'git-lfs' e rodado 'git lfs pull'.")
            sys.exit(1)
            
        # Tenta carregar o modelo YOLO
        model = YOLO(model_path)
        print("✅ SUCESSO: Modelo YOLO carregado corretamente!")
        
    except Exception as e:
        print(f"❌ ERRO ao carregar o modelo: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_load()
