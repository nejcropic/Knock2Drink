@echo off

cd /d %~dp0

call npm install

call npx expo prebuild

call npx expo run:android

pause
