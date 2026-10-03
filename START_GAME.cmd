@echo off
cd /d "%~dp0"
echo RAREMASTERS DRIFT - http://localhost:8766
echo Keep this window open while playing.
start "" http://localhost:8766
python -m http.server 8766 --bind 0.0.0.0
pause
