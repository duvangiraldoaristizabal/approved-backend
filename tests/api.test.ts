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
  let headers: Record<string, string>;

  beforeEach(async () => {
    app = createApp(new ApprovalService(new InMemoryApprovalRepository()));
    const tokenResponse = await request(app).get("/api/v1/auth/token?user=juan.lead").expect(200);
    headers = { Authorization: `Bearer ${tokenResponse.body.token}` };
  });

  it("requiere un JWT valido para crear solicitudes", async () => {
    const response = await request(app).post("/api/v1/requests").send(validRequest).expect(401);
    expect(response.body.code).toBe("UNAUTHORIZED");
  });

  it("emite un JWT y lo usa para crear, consultar y decidir una solicitud", async () => {
    const created = await request(app).post("/api/v1/requests").set(headers).send(validRequest).expect(201);
    await request(app).get(`/api/v1/requests/${created.body.id}`).set(headers).expect(200);
    const decided = await request(app).patch(`/api/v1/requests/${created.body.id}/decision`)
      .set(headers)
      .send({ status: "APPROVED", user: "luis.lead", comment: "Acceso justificado" }).expect(200);
    expect(decided.body.status).toBe("APPROVED");
  });

  it("permite iniciar sesion con usuario y contraseña iguales", async () => {
    const login = await request(app).post("/api/v1/auth/login").send({ username: "juan.lead", password: "juan.lead" }).expect(200);
    expect(login.body.user).toBe("juan.lead");
    expect(login.body.token).toBeTypeOf("string");
  });

  it("no permite consultar la bandeja de otro usuario autenticado", async () => {
    const response = await request(app).get("/api/v1/requests?approver=luis.lead").set(headers).expect(401);
    expect(response.body.code).toBe("UNAUTHORIZED");
  });

  it("filtra pendientes y genera notificaciones simuladas", async () => {
    await request(app).post("/api/v1/requests").set(headers).send({ ...validRequest, approver: "juan.lead" }).expect(201);
    const list = await request(app).get("/api/v1/requests?approver=juan.lead&status=PENDING").set(headers).expect(200);
    expect(list.body).toHaveLength(1);
    const notifications = await request(app).get("/api/v1/notifications?approver=juan.lead").set(headers).expect(200);
    expect(notifications.body[0].message).toContain("Acceso al tablero");
  });

  it("rechaza datos invalidos", async () => {
    const response = await request(app).post("/api/v1/requests").set(headers).send({ title: "x" }).expect(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("devuelve 404 para una solicitud inexistente", async () => {
    await request(app).get("/api/v1/requests/no-existe").set(headers).expect(404);
  });
});
