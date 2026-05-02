@echo off
echo Starting NGO Accounting Backend on http://localhost:8000
echo.
uvicorn main:app --reload --port 8000
