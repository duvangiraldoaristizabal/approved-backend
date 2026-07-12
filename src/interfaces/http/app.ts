import cors from "cors";
import express, { type ErrorRequestHandler, type Request } from "express";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import { ZodError, z } from "zod";
import type { ApprovalService } from "../../application/approval-service.js";
import { ConflictError, NotFoundError } from "../../domain/errors.js";
import { createRequestSchema, decisionSchema, filtersSchema } from "./schemas.js";

interface AuthenticatedRequest extends Request {
  user?: string;
}

const networkUserSchema = z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._@-]+$/, "Usuario de red invalido");
const jwtSecret = process.env.JWT_SECRET ?? "approved-dev-secret";
const jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? "1h" as const;
const allowedUsers = new Set(["juan.lead", "maria.dev", "ana.dev", "luis.lead"]);
const loginSchema = z.object({
  username: networkUserSchema,
  password: networkUserSchema,
});

const issueToken = (user: string) => jwt.sign({ sub: user, user }, jwtSecret, { expiresIn: jwtExpiresIn as jwt.SignOptions["expiresIn"] });

class UnauthorizedError extends Error {
  constructor(message = "No autorizado") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export function createApp(service: ApprovalService, corsOrigin = "http://localhost:4200") {
  const app = express();
  app.use(helmet());
  app.use(cors({
    origin: corsOrigin,
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }));
  app.use(express.json({ limit: "20kb" }));

  app.get("/health", (_request, response) => response.json({ status: "ok" }));

  app.get("/api/v1/auth/token", async (request, response, next) => {
    try {
      const { user } = z.object({ user: networkUserSchema }).parse(request.query);
      response.json({ token: issueToken(user), user });
    } catch (error) { next(error); }
  });

  app.post("/api/v1/auth/login", async (request, response, next) => {
    try {
      const { username, password } = loginSchema.parse(request.body);
      if (username !== password || !allowedUsers.has(username)) {
        next(new UnauthorizedError("Credenciales invalidas"));
        return;
      }

      response.json({ token: issueToken(username), user: username });
    } catch (error) {
      next(error);
    }
  });

  const authMiddleware = (request: AuthenticatedRequest, _response: express.Response, next: express.NextFunction) => {
    const authHeader = request.header("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      next(new UnauthorizedError("Token JWT requerido"));
      return;
    }

    try {
      const token = authHeader.slice(7).trim();
      const payload = jwt.verify(token, jwtSecret) as jwt.JwtPayload & { user?: string };
      if (typeof payload.user !== "string" || payload.user.trim().length === 0) {
        throw new UnauthorizedError("Token JWT invalido");
      }
      request.user = payload.user;
      next();
    } catch {
      next(new UnauthorizedError("Token JWT invalido o expirado"));
    }
  };

  app.use("/api/v1/requests", authMiddleware);
  app.use("/api/v1/notifications", authMiddleware);

  app.post("/api/v1/requests", async (request, response, next) => {
    try {
      response.status(201).json(await service.create(createRequestSchema.parse(request.body)));
    } catch (error) { next(error); }
  });
  app.get("/api/v1/requests", async (request: AuthenticatedRequest, response, next) => {
    try {
      const currentUser = request.user;
      if (!currentUser) {
        next(new UnauthorizedError("Token JWT requerido"));
        return;
      }

      const filters = filtersSchema.parse(request.query);
      if (filters.approver && filters.approver !== currentUser) {
        next(new UnauthorizedError("No autorizado para consultar la bandeja de otro usuario"));
        return;
      }

      response.json(await service.list({ ...filters, approver: filters.approver ?? currentUser }));
    } catch (error) { next(error); }
  });
  app.get("/api/v1/requests/:id", async (request: AuthenticatedRequest, response, next) => {
    try {
      const id = String(request.params.id);
      const currentRequest = await service.getById(id);
      response.json(currentRequest);
    } catch (error) { next(error); }
  });
  app.patch("/api/v1/requests/:id/decision", async (request, response, next) => {
    try {
      const decision = decisionSchema.parse(request.body);
      response.json(await service.decide(request.params.id, decision.status, decision.user, decision.comment));
    } catch (error) { next(error); }
  });
  app.get("/api/v1/notifications", async (request: AuthenticatedRequest, response, next) => {
    try {
      const currentUser = request.user;
      if (!currentUser) {
        next(new UnauthorizedError("Token JWT requerido"));
        return;
      }

      const { approver } = filtersSchema.pick({ approver: true }).required().parse(request.query);
      if (approver !== currentUser) {
        next(new UnauthorizedError("No autorizado para consultar notificaciones de otro usuario"));
        return;
      }

      const pending = await service.list({ approver, status: "PENDING" });
      response.json(pending.map((item) => ({
        id: item.id,
        requestId: item.id,
        recipient: item.approver,
        message: `Tienes una solicitud pendiente: ${item.title}`,
        createdAt: item.createdAt,
      })));
    } catch (error) { next(error); }
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof ZodError) {
      response.status(400).json({ code: "VALIDATION_ERROR", message: "Datos invalidos", details: error.flatten() });
      return;
    }
    if (error instanceof UnauthorizedError) {
      response.status(401).json({ code: "UNAUTHORIZED", message: error.message });
      return;
    }
    if (error instanceof NotFoundError) {
      response.status(404).json({ code: "NOT_FOUND", message: error.message });
      return;
    }
    if (error instanceof ConflictError) {
      response.status(409).json({ code: "CONFLICT", message: error.message });
      return;
    }
    console.error(error);
    response.status(500).json({ code: "INTERNAL_ERROR", message: "Error interno" });
  };
  app.use(errorHandler);
  return app;
}
