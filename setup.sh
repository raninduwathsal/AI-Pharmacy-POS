#!/bin/bash

# Define colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Setup for AI-Pharmacy-POS...${NC}"

# Setup Backend
echo -e "${BLUE}▶ Setting up Backend (Main POS)...${NC}"
cd backend
npm install
cat <<EOF > .env
DATABASE_URL=mysql://root:root@127.0.0.1:3306/pharmacy_pos
PORT=5000
EOF
cd ..

# Setup Frontend
echo -e "${BLUE}▶ Setting up Frontend (Main POS)...${NC}"
cd frontend
npm install
cd ..



echo -e "${GREEN}Setup Complete! All dependencies installed and .env files configured.${NC}"
