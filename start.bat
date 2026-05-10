@echo off
chcp 65001 >nul 2>&1
echo ===== MORA START =====

echo [0/5] Killing old processes...
taskkill /IM node.exe /F >nul 2>&1
taskkill /IM java.exe /F >nul 2>&1

echo [Preflight] Checking required commands...
set "PY_CMD="
set "MVN_CMD="

py -3 -c "print('ok')" >nul 2>&1
if %errorlevel% equ 0 (
    set "PY_CMD=py -3"
) else (
    python -c "print('ok')" >nul 2>&1
    if %errorlevel% equ 0 (
        set "PY_CMD=python"
    ) else (
        if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
        if not defined PY_CMD if exist "C:\Python314\python.exe" set "PY_CMD=C:\Python314\python.exe"
    )
)

where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] pnpm is not installed or not on PATH.
    echo Install pnpm, then run this script again.
    pause
    exit /b 1
)

where mvn >nul 2>&1
if %errorlevel% equ 0 (
    set "MVN_CMD=mvn"
) else (
    if exist "%~dp0backend\mvnw.cmd" (
        set "MVN_CMD=.\mvnw.cmd"
    ) else (
        echo [ERROR] Maven is not installed and backend\mvnw.cmd was not found.
        pause
        exit /b 1
    )
)

if not defined PY_CMD (
    echo [ERROR] Python 3 is not installed or not connected to py.exe.
    echo Install Python 3.11+ and make sure either `py -3` or `python` works.
    pause
    exit /b 1
)

echo [1/5] Starting DB...
docker start mora-db >nul 2>&1
if %errorlevel% neq 0 (
    echo DB container not found, creating new one with named volume...
    docker run -d --name mora-db -e POSTGRES_DB=mora -e POSTGRES_USER=mora -e POSTGRES_PASSWORD=mora1234 -p 5433:5432 -v mora-pgdata:/var/lib/postgresql/data --restart unless-stopped pgvector/pgvector:pg16
    timeout /t 5 /nobreak >nul
    echo [2/5] Database created. Spring Boot/Flyway will create the schema.
) else (
    echo DB container already running.
    timeout /t 2 /nobreak >nul
)

echo [3/5] Starting Python OCR (port 8000) with auto-reload...
start "MORA-OCR" cmd /k "cd /d %~dp0ocr && %PY_CMD% -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload"

echo [4/5] Starting Spring Boot (port 8080)...
start "MORA-Spring" cmd /k "cd /d %~dp0backend && %MVN_CMD% spring-boot:run"

echo [5/5] Starting Frontend (port 3000)...
start "MORA-Frontend" cmd /k "cd /d %~dp0frontend && pnpm dev"

echo.
echo ===== ALL STARTED =====
echo DB:       localhost:5433
echo OCR:      http://localhost:8000
echo Spring:   http://localhost:8080
echo Frontend: http://localhost:3000
echo.
pause
