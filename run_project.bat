@echo off
echo Starting Calendar System...

start "Calendar Server" cmd /k "set PORT=5000 && npm start"
start "Calendar Client" cmd /k "cd client && npm run dev"

echo Project started! Check the new windows.
