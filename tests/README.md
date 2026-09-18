# Pruebas adicionales

La suite de integración se ejecuta con:

```powershell
.\venv\Scripts\python.exe -m unittest discover -s tests -v
```

Las pruebas E2E de la interfaz web usan respuestas simuladas para ser
deterministas y no requieren una API ni credenciales de IA:

```powershell
cd frontend
npx playwright install chromium
npm run test:e2e
```

El perfil de carga se ejecuta únicamente contra un entorno desechable con datos
de prueba; no apunta a producción por defecto:

```powershell
.\venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\venv\Scripts\locust.exe -f tests\load\locustfile.py --host http://127.0.0.1:5000
```
