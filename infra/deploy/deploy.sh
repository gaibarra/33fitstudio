#!/usr/bin/env bash
set -euo pipefail

# Simple deploy script for 33fitstudio.online
# Assumes Ubuntu with nginx, certbot, supervisor, systemd, Postgres, Redis, and python venv at /home/gaibarra/33fitstudio/.venv

PROJECT_ROOT="/home/gaibarra/33fitstudio"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
ENV_FILE="$BACKEND_DIR/.env"
NGINX_SITE="/etc/nginx/sites-available/33fitstudio.conf"
NGINX_HTTP_SRC="$PROJECT_ROOT/infra/deploy/nginx.http.conf"
NGINX_SSL_SRC="$PROJECT_ROOT/infra/deploy/nginx.conf"
SYSTEMD_UNIT="/etc/systemd/system/gunicorn-33fitstudio.service"
SUPERVISOR_CONF="/etc/supervisor/conf.d/33fitstudio.conf"
ACME_ROOT="/var/www/letsencrypt"
DOMAIN="33fitstudio.online"

if [[ $EUID -ne 0 ]]; then
  echo "[!] Ejecuta como root (sudo) para configurar nginx/systemd/supervisor." >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[!] Falta $ENV_FILE. Copia y ajusta backend.env.production.example." >&2
  exit 1
fi

# Export env vars for Django
set -a
source "$ENV_FILE"
set +a

# Backend setup
echo "[+] Instalando dependencias backend"
cd "$BACKEND_DIR"
"$PROJECT_ROOT/.venv/bin/pip" install -r requirements.txt
"$PROJECT_ROOT/.venv/bin/python" manage.py migrate
"$PROJECT_ROOT/.venv/bin/python" manage.py collectstatic --noinput
"$PROJECT_ROOT/.venv/bin/python" manage.py bootstrap_roles_admin

# Nginx
echo "[+] Configurando nginx"
mkdir -p "$ACME_ROOT"

if [[ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
  cp "$NGINX_SSL_SRC" "$NGINX_SITE"
else
  echo "[i] Certificado no existe aún, usando config HTTP para emitir con certbot"
  cp "$NGINX_HTTP_SRC" "$NGINX_SITE"
fi

ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/33fitstudio.conf
nginx -t
systemctl reload nginx

# Gunicorn (systemd)
echo "[+] Configurando gunicorn systemd"
cp "$PROJECT_ROOT/infra/deploy/gunicorn.service" "$SYSTEMD_UNIT"
systemctl daemon-reload
systemctl enable --now gunicorn-33fitstudio
systemctl restart gunicorn-33fitstudio

# Celery (supervisor)
echo "[+] Configurando supervisor para celery"
mkdir -p /var/log/celery
cp "$PROJECT_ROOT/infra/deploy/supervisor.conf" "$SUPERVISOR_CONF"
supervisorctl reread
supervisorctl update
supervisorctl restart celery
supervisorctl restart celery-beat

# Certbot
if ! [[ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
  echo "[+] Solicitando certificado SSL"
  certbot certonly --webroot -w "$ACME_ROOT" -d "$DOMAIN" -d "www.$DOMAIN"
  # Reemplazar config con SSL y recargar
  cp "$NGINX_SSL_SRC" "$NGINX_SITE"
  nginx -t
  systemctl reload nginx
else
  echo "[i] Certificado ya existe; puede renovarse con: certbot renew --dry-run"
fi

echo "[✓] Deploy completado. Revisa systemctl status gunicorn-33fitstudio y supervisorctl status."