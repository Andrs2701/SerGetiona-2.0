#!/bin/bash
# Server Requirement and Security Checker for Sergestiona 2.0
# Designed by Antigravity

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}      SERGESTIONA 2.0 - SERVER CHECKER TOOL         ${NC}"
echo -e "${BLUE}====================================================${NC}"
echo ""

# 1. System Info
echo -e "${BLUE}[1/7] System Information:${NC}"
OS_NAME=$(lsb_release -ds 2>/dev/null || cat /etc/*release 2>/dev/null | head -n1 || uname -om)
KERNEL=$(uname -r)
echo -e "  - OS: ${GREEN}$OS_NAME${NC}"
echo -e "  - Kernel: ${GREEN}$KERNEL${NC}"
echo ""

# 2. PHP Requirements (Laravel 12)
echo -e "${BLUE}[2/7] Checking PHP & Extensions (Req: PHP >= 8.2):${NC}"
if command -v php >/dev/null 2>&1; then
    PHP_VER=$(php -r 'echo PHP_VERSION;')
    PHP_MAJOR=$(php -r 'echo PHP_MAJOR_VERSION;')
    PHP_MINOR=$(php -r 'echo PHP_MINOR_VERSION;')
    
    # Check if >= 8.2
    if [ "$PHP_MAJOR" -gt 8 ] || { [ "$PHP_MAJOR" -eq 8 ] && [ "$PHP_MINOR" -ge 2 ]; }; then
        echo -e "  - PHP Version: ${GREEN}$PHP_VER (OK)${NC}"
    else
        echo -e "  - PHP Version: ${RED}$PHP_VER (FAIL - Requires PHP >= 8.2)${NC}"
    fi
    
    # Required Extensions
    EXTENSIONS=("bcmath" "ctype" "curl" "dom" "fileinfo" "filter" "hash" "mbstring" "openssl" "pcre" "pdo" "session" "tokenizer" "xml" "xmlwriter" "zip" "gd" "pdo_sqlite" "pdo_pgsql")
    echo -e "  - PHP Extensions:"
    for ext in "${EXTENSIONS[@]}"; do
        if php -m | grep -ix "$ext" >/dev/null; then
            echo -e "    * $ext: ${GREEN}Installed${NC}"
        else
            if [[ "$ext" == "pdo_pgsql" || "$ext" == "pdo_sqlite" ]]; then
                echo -e "    * $ext: ${YELLOW}Not Installed (Optional depending on DB config)${NC}"
            else
                echo -e "    * $ext: ${RED}MISSING${NC}"
            fi
        fi
    done
else
    echo -e "  - PHP: ${RED}Not Installed${NC}"
fi
echo ""

# 3. Node.js & npm Requirements (Next.js 16)
echo -e "${BLUE}[3/7] Checking Node.js & npm (Req: Node >= 18.18):${NC}"
if command -v node >/dev/null 2>&1; then
    NODE_VER=$(node -v | sed 's/v//')
    NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
    NODE_MINOR=$(echo "$NODE_VER" | cut -d. -f2)
    
    if [ "$NODE_MAJOR" -gt 18 ] || { [ "$NODE_MAJOR" -eq 18 ] && [ "$NODE_MINOR" -ge 18 ]; }; then
        echo -e "  - Node.js Version: ${GREEN}v$NODE_VER (OK)${NC}"
    else
        echo -e "  - Node.js Version: ${RED}v$NODE_VER (FAIL - Requires Node >= 18.18)${NC}"
    fi
else
    echo -e "  - Node.js: ${RED}Not Installed${NC}"
fi

if command -v npm >/dev/null 2>&1; then
    NPM_VER=$(npm -v)
    echo -e "  - npm Version: ${GREEN}$NPM_VER (OK)${NC}"
else
    echo -e "  - npm: ${RED}Not Installed${NC}"
fi
echo ""

# 4. Composer
echo -e "${BLUE}[4/7] Checking Composer:${NC}"
if command -v composer >/dev/null 2>&1; then
    COMPOSER_VER=$(composer --version | cut -d' ' -f3)
    echo -e "  - Composer Version: ${GREEN}$COMPOSER_VER (OK)${NC}"
else
    echo -e "  - Composer: ${RED}Not Installed${NC}"
fi
echo ""

# 5. Database Services
echo -e "${BLUE}[5/7] Checking Database services (SQLite/PostgreSQL):${NC}"
if command -v sqlite3 >/dev/null 2>&1; then
    SQLITE_VER=$(sqlite3 --version | cut -d' ' -f1)
    echo -e "  - SQLite3: ${GREEN}Installed (v$SQLITE_VER)${NC}"
else
    echo -e "  - SQLite3: ${YELLOW}Not Installed (Required if running SQLite)${NC}"
fi

if command -v psql >/dev/null 2>&1; then
    PG_VER=$(psql --version | cut -d' ' -f3)
    echo -e "  - PostgreSQL Client: ${GREEN}Installed (v$PG_VER)${NC}"
else
    echo -e "  - PostgreSQL Client: ${YELLOW}Not Installed (Required if running PG)${NC}"
fi

# Check active PG service
if systemctl is-active postgresql >/dev/null 2>&1; then
    echo -e "  - PostgreSQL Service: ${GREEN}Running${NC}"
else
    echo -e "  - PostgreSQL Service: ${YELLOW}Not running locally (Ignore if DB is remote)${NC}"
fi
echo ""

# 6. Web Servers & Process Managers
echo -e "${BLUE}[6/7] Checking Web Servers & Process Managers:${NC}"
if command -v nginx >/dev/null 2>&1; then
    echo -e "  - Nginx: ${GREEN}Installed${NC}"
    if systemctl is-active nginx >/dev/null 2>&1; then
        echo -e "    * Nginx Service: ${GREEN}Running${NC}"
    else
        echo -e "    * Nginx Service: ${RED}Not Running${NC}"
    fi
else
    echo -e "  - Nginx: ${YELLOW}Not Installed${NC}"
fi

if command -v apache2 >/dev/null 2>&1 || command -v httpd >/dev/null 2>&1; then
    echo -e "  - Apache: ${GREEN}Installed${NC}"
else
    echo -e "  - Apache: ${YELLOW}Not Installed${NC}"
fi

if command -v pm2 >/dev/null 2>&1; then
    echo -e "  - PM2 (Process Manager): ${GREEN}Installed (Recommended for Next.js)${NC}"
else
    echo -e "  - PM2 (Process Manager): ${YELLOW}Not Installed (Recommended to run Next.js background process)${NC}"
fi
echo ""

# 7. Security Audit
echo -e "${BLUE}[7/7] Security Assessment:${NC}"

# Check Firewall (UFW)
if command -v ufw >/dev/null 2>&1; then
    UFW_STATUS=$(sudo ufw status | head -n1)
    if [[ "$UFW_STATUS" == *"active"* ]]; then
        echo -e "  - Firewall (UFW): ${GREEN}Active${NC}"
        # Check open ports
        echo -e "  - UFW Status / Open Ports:"
        sudo ufw status verbose | grep -E "(ALLOW|DENY|LIMIT)" || echo "No rules defined"
    else
        echo -e "  - Firewall (UFW): ${RED}Inactive/Disabled (CRITICAL SECURITY RISK)${NC}"
    fi
else
    echo -e "  - Firewall (UFW): ${YELLOW}ufw command not found (Check iptables/firewalld)${NC}"
fi

# Check SSH Configurations
echo -e "  - SSH Configuration Security:"
SSH_CONF="/etc/ssh/sshd_config"
if [ -f "$SSH_CONF" ]; then
    # Check PermitRootLogin
    PRL=$(grep -E "^PermitRootLogin" "$SSH_CONF" | awk '{print $2}')
    if [[ "$PRL" == "no" ]]; then
        echo -e "    * PermitRootLogin: ${GREEN}Disabled (Secure)${NC}"
    else
        echo -e "    * PermitRootLogin: ${RED}Enabled ($PRL) - High risk! Recommend disabling.${NC}"
    fi
    
    # Check PasswordAuthentication
    PWA=$(grep -E "^PasswordAuthentication" "$SSH_CONF" | awk '{print $2}')
    if [[ "$PWA" == "no" ]]; then
        echo -e "    * PasswordAuthentication: ${GREEN}Disabled (Secure - Key only)${NC}"
    else
        echo -e "    * PasswordAuthentication: ${YELLOW}Enabled - Moderate risk. Consider using SSH keys only.${NC}"
    fi
else
    echo -e "    * ${YELLOW}Could not read /etc/ssh/sshd_config (Permission denied or file not found)${NC}"
fi

# Check Fail2ban
if systemctl is-active fail2ban >/dev/null 2>&1; then
    echo -e "  - Fail2ban Service: ${GREEN}Active (Protects against brute force)${NC}"
else
    echo -e "  - Fail2ban Service: ${RED}Inactive/Not Installed (High Risk of SSH brute force)${NC}"
fi

# SSL Check (Certbot)
if command -v certbot >/dev/null 2>&1; then
    echo -e "  - Let's Encrypt (Certbot): ${GREEN}Installed (Ready for HTTPS)${NC}"
else
    echo -e "  - Let's Encrypt (Certbot): ${YELLOW}Not Installed (HTTPS required for production)${NC}"
fi

echo ""
echo -e "${BLUE}====================================================${NC}"
echo -e "                       DONE                         "
echo -e "${BLUE}====================================================${NC}"
