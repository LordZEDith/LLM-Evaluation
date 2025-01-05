import os
import sys
import site
import json

venv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'llm_evaluation', '.venv')
site_packages = os.path.join(venv_path, 'Lib', 'site-packages')
sys.path.insert(0, site_packages)

from models import get_models_config

def main():
    try:
        configs = get_models_config()
        
        print(json.dumps(configs))
        
        sys.exit(0)
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main() 