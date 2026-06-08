@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo === Installing PyInstaller ===
pip install pyinstaller

echo.
echo === Building ===
python -m PyInstaller --noconfirm --onefile --windowed --name "MonthlySettlement" --add-data "src;src" --hidden-import openpyxl --hidden-import src --hidden-import src.config --hidden-import src.excel_handler --hidden-import src.fifo_engine -p . src\main.py

echo.
if exist "dist\MonthlySettlement.exe" (
    echo === Build SUCCESS ===
    echo Output: dist\MonthlySettlement.exe
) else (
    echo === Build FAILED ===
)
pause
