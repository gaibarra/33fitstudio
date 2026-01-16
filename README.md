# 33 F/T Studio

Stack: Django + DRF + SimpleJWT + Celery, PostgreSQL, Redis, Next.js (App Router) + Tailwind. Dev infra via Docker Compose.

## Estructura
- `backend/` API, Celery, migraciones, tests.
- `frontend/` Next.js App Router, Tailwind, páginas público/portal/admin/bio.
- `infra/` docker-compose y plantillas CSV.

## Prerrequisitos
- Docker + Docker Compose, o Python 3.11 + Node 18 para correr sin contenedores.

## Variables de entorno
Copia los samples y ajusta:
- Backend: `backend/.env.example`
- Frontend: `frontend/.env.example`

Claves importantes:
- `POSTGRES_*`, `DJANGO_SECRET_KEY`, `CORS_ALLOWED_ORIGINS`, `FRONTEND_URL`, `CELERY_BROKER_URL`, `INITIAL_ADMIN_EMAIL/PASSWORD/NAME`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_STUDIO_ID`.

## Levantar en Docker (dev)
```
cd infra
docker compose up --build
```
- Backend: http://localhost:8000
- Frontend: http://localhost:3000
- Postgres: localhost:5432 (fitness/fitness)

Luego, dentro del contenedor backend ejecuta migraciones y seed mínimo de roles/admin:
```
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py bootstrap_roles_admin
```

## Levantar sin Docker (opcional)
Backend:
```
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py bootstrap_roles_admin
python manage.py runserver 0.0.0.0:8000
```
Frontend:
```
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Tests
- Backend: `cd backend && python manage.py test`
- Frontend: `cd frontend && npm test`

## Módulos cubiertos
- Público: home, clases, coaches, horarios (dinámico), precios, políticas.
- Bio-link: botones configurables por admin, fetch público + tracking endpoint.
- Portal cliente: registro/login, reservar/cancelar, wallet/membresía (API), historial vía API.
- Admin/staff: CRUD sedes, coaches, tipos de clase, sesiones con capacidad/waitlist, productos, órdenes/pagos, plantillas de notificación, webhooks, reportes (placeholder), bio-link.
- Automatización: Celery listo; tareas stub para recordatorios y webhooks.

## Migraciones y DB
Migraciones incluidas por app (`*/migrations/0001_initial.py`). Usa PostgreSQL. Extensión `pgcrypto` opcional según instancia.

## Importación CSV
Plantillas vacías en `infra/csv_templates/` (coaches, class_types, products, sessions). No se incluye data inventada.

## Seguridad y buenas prácticas
- Auth JWT (SimpleJWT), roles admin/staff/customer.
- Rate limiting básica en auth vía DRF throttles.
- CORS configurable; valida cabecera `X-Studio-Id` para multi-sede.
- Validación de capacidad y waitlist en `scheduling/services.py` con transacciones.
- Auditoría simple en `core.utils.log_action`.

## API Docs
Swagger/OpenAPI en `http://localhost:8000/api/docs/` y schema en `/api/schema/`.

## Branding UI
Tailwind tokens: fondo `#D1DB92`, primario `#97A546` (dark `#9FAD4E`), acento `#F9E791`, botones grandes, tarjetas redondeadas, tipografía sans Montserrat/Inter.
# 33fitstudio
# 33fitstudio
# 33fitstudio
