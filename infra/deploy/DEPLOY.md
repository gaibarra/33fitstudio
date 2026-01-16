# Despliegue 33fitstudio.online (Django + Next)

## 1) Variables
- Backend: copia `infra/deploy/backend.env.production.example` a `/home/gaibarra/33fitstudio/backend/.env` y ajusta secretos/domino/SMTP.
- Frontend: copia `infra/deploy/frontend.env.production.example` a `/home/gaibarra/33fitstudio/frontend/.env.local` y coloca `NEXT_PUBLIC_STUDIO_ID` del Studio creado (ej. a6e2e99d-b55a-4b2a-8fd0-bb3248984c13).

## 2) Backend
```bash
cd /home/gaibarra/33fitstudio/backend
source /home/gaibarra/33fitstudio/.venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py bootstrap_roles_admin
```

## 3) Gunicorn (systemd)
- Copia `infra/deploy/gunicorn.service` a `/etc/systemd/system/gunicorn-33fitstudio.service`.
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now gunicorn-33fitstudio
sudo systemctl status gunicorn-33fitstudio
```

## 4) Celery (supervisor)
- Copia `infra/deploy/supervisor.conf` a `/etc/supervisor/conf.d/33fitstudio.conf`.
```bash
sudo mkdir -p /var/log/celery
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl status
```

## 5) Nginx
- Copia `infra/deploy/nginx.conf` a `/etc/nginx/sites-available/33fitstudio.conf` y crea symlink en `sites-enabled`.
```bash
sudo ln -sf /etc/nginx/sites-available/33fitstudio.conf /etc/nginx/sites-enabled/33fitstudio.conf
sudo nginx -t && sudo systemctl reload nginx
```
- Webroot para ACME: `sudo mkdir -p /var/www/letsencrypt`.

## 6) Certbot
```bash
sudo certbot certonly --webroot -w /var/www/letsencrypt -d 33fitstudio.online -d www.33fitstudio.online
sudo systemctl reload nginx
```
Certbot ya añade renovación; verifica con `sudo certbot renew --dry-run`.

## 7) Frontend (Next.js)
- Construye y sirve con tu preferencia (pm2/systemd) o Vercel. Para host local:
```bash
cd /home/gaibarra/33fitstudio/frontend
npm install
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```
- Si sirves el frontend separado, ajusta `NEXT_PUBLIC_API_URL` al backend (https://33fitstudio.online).

## 8) Logs y paths
- Gunicorn socket: `/run/33fitstudio.sock` (propiedad user=gaibarra, group=www-data).
- Static: `/home/gaibarra/33fitstudio/backend/staticfiles/` (Nginx alias /static/).
- Celery logs: `/var/log/celery/*.log`.

## 9) Checklist rápido
- DNS apuntando a la VPS.
- `.env` backend/frontend con dominio correcto y secretos fuertes.
- Postgres/Redis corriendo local.
- `collectstatic` ejecutado.
- Certbot emitido y Nginx recargado.
- Gunicorn systemd activo y socket creado.
- Celery worker/beat corriendo via supervisor.

## 10) Notas
- Si usas Docker, apunta `POSTGRES_HOST=db` y ajusta Nginx upstream a contenedor.
- Seguridad: mantén `DEBUG=False`, rota secretos, limita puertos abiertos (solo 80/443/22).
