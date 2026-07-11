import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { ApprovalService } from "../src/application/approval-service.js";
import { InMemoryApprovalRepository } from "../src/infrastructure/repositories/in-memory-approval-repository.js";
import { createApp } from "../src/interfaces/http/app.js";

const validRequest = {
  title: "Acceso al tablero",
  description: "Se requiere acceso de lectura al tablero operativo",
  requester: "ana.dev",
  approver: "luis.lead",
  type: "ACCESS",
};

describe("Approval API", () => {
  let app: ReturnType<typeof createApp>;
  beforeEach(() => { app = createApp(new ApprovalService(new InMemoryApprovalRepository())); });

  it("crea, consulta y decide una solicitud", async () => {
    const created = await request(app).post("/api/v1/requests").send(validRequest).expect(201);
    await request(app).get(`/api/v1/requests/${created.body.id}`).expect(200);
    const decided = await request(app).patch(`/api/v1/requests/${created.body.id}/decision`)
      .send({ status: "APPROVED", user: "luis.lead", comment: "Acceso justificado" }).expect(200);
    expect(decided.body.status).toBe("APPROVED");
  });

  it("filtra pendientes y genera notificaciones simuladas", async () => {
    await request(app).post("/api/v1/requests").send(validRequest).expect(201);
    const list = await request(app).get("/api/v1/requests?approver=luis.lead&status=PENDING").expect(200);
    expect(list.body).toHaveLength(1);
    const notifications = await request(app).get("/api/v1/notifications?approver=luis.lead").expect(200);
    expect(notifications.body[0].message).toContain("Acceso al tablero");
  });

  it("rechaza datos invalidos", async () => {
    const response = await request(app).post("/api/v1/requests").send({ title: "x" }).expect(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("devuelve 404 para una solicitud inexistente", async () => {
    await request(app).get("/api/v1/requests/no-existe").expect(404);
  });
});
