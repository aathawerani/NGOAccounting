@echo off
echo ============================================
echo   NGO Accounting System - Starting...
echo ============================================
echo.
echo [1/2] Starting Backend  (http://localhost:8000)
start "NGO Backend" cmd /k "cd /d "%~dp0backend" && uvicorn main:app --reload --port 8000"

echo [2/2] Starting Frontend (http://localhost:5173)
start "NGO Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Both services are launching in separate windows.
echo   Backend API:  http://localhost:8000
echo   Frontend App: http://localhost:5173
echo   API Docs:     http://localhost:8000/docs
echo.
pause
