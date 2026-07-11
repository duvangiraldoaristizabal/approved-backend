import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import { ZodError } from "zod";
import type { ApprovalService } from "../../application/approval-service.js";
import { ConflictError, NotFoundError } from "../../domain/errors.js";
import { createRequestSchema, decisionSchema, filtersSchema } from "./schemas.js";

export function createApp(service: ApprovalService, corsOrigin = "http://localhost:4200") {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: "20kb" }));

  app.get("/health", (_request, response) => response.json({ status: "ok" }));
  app.post("/api/v1/requests", async (request, response, next) => {
    try {
      response.status(201).json(await service.create(createRequestSchema.parse(request.body)));
    } catch (error) { next(error); }
  });
  app.get("/api/v1/requests", async (request, response, next) => {
    try {
      response.json(await service.list(filtersSchema.parse(request.query)));
    } catch (error) { next(error); }
  });
  app.get("/api/v1/requests/:id", async (request, response, next) => {
    try {
      response.json(await service.getById(request.params.id));
    } catch (error) { next(error); }
  });
  app.patch("/api/v1/requests/:id/decision", async (request, response, next) => {
    try {
      const decision = decisionSchema.parse(request.body);
      response.json(await service.decide(request.params.id, decision.status, decision.user, decision.comment));
    } catch (error) { next(error); }
  });
  app.get("/api/v1/notifications", async (request, response, next) => {
    try {
      const { approver } = filtersSchema.pick({ approver: true }).required().parse(request.query);
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
