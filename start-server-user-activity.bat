@echo off
echo Starting server for User Activity Testing...
cd server
echo Setting environment variables...
set NODE_ENV=development
set PORT=4000
set JWT_SECRET=smokeking_secret_key_ultra_secure_2024
echo Starting server...
npm start
pause 