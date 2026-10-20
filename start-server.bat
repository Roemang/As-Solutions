@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is niet gevonden. Installeer het via https://nodejs.org en probeer opnieuw. & pause & exit /b)
echo.
echo  Website:  http://localhost:8080
echo  Beheer:   http://localhost:8080/beheer
echo  (sluit dit venster om de website te stoppen)
echo.
start "" http://localhost:8080
node server.js
pause
