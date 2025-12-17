#!/bin/bash
# Railway deployment script for Thinkers Chat
# This script helps set up and deploy to Railway

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${GREEN}Thinkers Chat - Railway Deployment${NC}"
echo ""

# Check if we're in the project root
if [ ! -f "CLAUDE.md" ]; then
    echo -e "${RED}Error: Please run this script from the project root directory${NC}"
    exit 1
fi

# Check for Railway CLI
if ! command -v railway &> /dev/null; then
    echo -e "${RED}Error: Railway CLI not installed${NC}"
    echo ""
    echo "Install it with:"
    echo -e "  ${CYAN}npm install -g @railway/cli${NC}"
    echo "  or"
    echo -e "  ${CYAN}brew install railway${NC}"
    echo ""
    echo "Then login with:"
    echo -e "  ${CYAN}railway login${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Railway CLI found${NC}"

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo -e "${YELLOW}Not logged in to Railway. Running 'railway login'...${NC}"
    railway login
fi

echo -e "${GREEN}✓ Logged in to Railway${NC}"
echo ""

# Menu
echo -e "${YELLOW}What would you like to do?${NC}"
echo "1) Create new Railway project (first time setup)"
echo "2) Deploy backend"
echo "3) Deploy frontend"
echo "4) Deploy both"
echo "5) Show deployment status"
echo "6) Open Railway dashboard"
echo ""
read -p "Enter choice [1-6]: " choice

case $choice in
    1)
        echo ""
        echo -e "${GREEN}=== Creating New Railway Project ===${NC}"
        echo ""
        echo -e "${YELLOW}This will create a new Railway project with:${NC}"
        echo "  - PostgreSQL database"
        echo "  - Backend service (FastAPI)"
        echo "  - Frontend service (Next.js)"
        echo ""
        echo -e "${CYAN}Steps to complete in Railway dashboard:${NC}"
        echo ""
        echo "1. Go to https://railway.app/new"
        echo "2. Click 'Empty Project'"
        echo "3. Add PostgreSQL: Click '+ New' → 'Database' → 'Add PostgreSQL'"
        echo "4. Add Backend service:"
        echo "   - Click '+ New' → 'GitHub Repo' → Select this repo"
        echo "   - Set root directory to 'backend'"
        echo "   - Add variables:"
        echo "     - ANTHROPIC_API_KEY=<your-key>"
        echo "     - DATABASE_URL=\${{Postgres.DATABASE_URL}}"
        echo "     - CORS_ORIGINS=https://<your-frontend>.up.railway.app"
        echo "5. Add Frontend service:"
        echo "   - Click '+ New' → 'GitHub Repo' → Select this repo"
        echo "   - Set root directory to 'frontend'"
        echo "   - Add variables:"
        echo "     - NEXT_PUBLIC_API_URL=https://<your-backend>.up.railway.app"
        echo "     - NEXT_PUBLIC_WS_URL=wss://<your-backend>.up.railway.app"
        echo ""
        echo -e "${YELLOW}Opening Railway dashboard...${NC}"
        open "https://railway.app/new" 2>/dev/null || echo "Visit: https://railway.app/new"
        ;;
    2)
        echo ""
        echo -e "${GREEN}=== Deploying Backend ===${NC}"
        cd backend
        railway up
        cd ..
        echo -e "${GREEN}Backend deployed!${NC}"
        ;;
    3)
        echo ""
        echo -e "${GREEN}=== Deploying Frontend ===${NC}"
        cd frontend
        railway up
        cd ..
        echo -e "${GREEN}Frontend deployed!${NC}"
        ;;
    4)
        echo ""
        echo -e "${GREEN}=== Deploying Both Services ===${NC}"
        echo ""
        echo -e "${YELLOW}Deploying backend...${NC}"
        cd backend
        railway up
        cd ..
        echo ""
        echo -e "${YELLOW}Deploying frontend...${NC}"
        cd frontend
        railway up
        cd ..
        echo ""
        echo -e "${GREEN}Both services deployed!${NC}"
        ;;
    5)
        echo ""
        echo -e "${GREEN}=== Deployment Status ===${NC}"
        railway status
        ;;
    6)
        echo ""
        echo -e "${GREEN}Opening Railway dashboard...${NC}"
        railway open 2>/dev/null || echo "Run 'railway open' or visit https://railway.app/dashboard"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Done!${NC}"
