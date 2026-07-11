# Approved Backend

API REST para el flujo generico de aprobaciones descrito en el reto. Incluye creacion, consulta, decisiones, trazabilidad, PostgreSQL y notificaciones SMTP con Nodemailer.

## Ejecutar

```bash
docker compose up -d # opcional si no tiene PostgreSQL y SMTP locales
cp .env.example .env
set -a && source .env && set +a
npm install
npm run dev
```

La API queda disponible en `http://localhost:3000`. PostgreSQL escucha en `localhost:5432`. Al usar Compose, Mailpit captura los correos SMTP en desarrollo y su interfaz queda en `http://localhost:8025`.

## Endpoints

| Metodo | Ruta | Proposito |
| --- | --- | --- |
| `POST` | `/api/v1/requests` | Crear una solicitud |
| `GET` | `/api/v1/requests` | Listar y filtrar por `approver`, `requester`, `status` o `type` |
| `GET` | `/api/v1/requests/:id` | Consultar detalle e historial |
| `PATCH` | `/api/v1/requests/:id/decision` | Aprobar o rechazar |
| `GET` | `/api/v1/notifications?approver=usuario` | Bandeja complementaria de pendientes |
| `GET` | `/health` | Estado del servicio |

### Crear

```json
{
  "title": "Publicar pagos v2",
  "description": "Publicar la version validada en produccion",
  "requester": "maria.dev",
  "approver": "juan.lead",
  "type": "DEPLOYMENT"
}
```

### Decidir

```json
{
  "status": "APPROVED",
  "user": "juan.lead",
  "comment": "Validaciones correctas"
}
```

## Diseno

- Dominio sin dependencias de Express.
- Casos de uso concentrados en `ApprovalService`.
- Patron Repository con PostgreSQL como adaptador de persistencia.
- Tablas normalizadas `approval_requests` y `approval_history` con indices y restricciones.
- Transacciones para crear solicitudes y registrar decisiones junto con su historial.
- Puerto `NotificationService` y adaptador `NodemailerNotificationService` para desacoplar SMTP del caso de uso.
- Validacion en el borde HTTP mediante Zod.
- Estados protegidos: solo el responsable decide y una solicitud finalizada no cambia nuevamente.

Ejecute `npm test` para las pruebas y `npm run build` para validar tipos y generar `dist/`.

## Notificacion por correo

El llamado ocurre en `ApprovalService.create`, inmediatamente despues de persistir la solicitud. El adaptador Nodemailer se configura en `src/server.ts`. Si el responsable es `juan.lead`, `SMTP_EMAIL_DOMAIN=example.test` genera el destinatario `juan.lead@example.test`; tambien puede enviarse un correo completo como responsable.

Un fallo temporal de SMTP se registra en el servidor, pero no revierte ni oculta una solicitud que PostgreSQL ya confirmo. Para entrega garantizada en produccion, el siguiente paso seria implementar un outbox persistente con reintentos.

Para un SMTP real, cambie `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` y `SMTP_FROM`. No almacene credenciales reales en el repositorio.
