import { describe, expect, it } from "vitest";
import { ApprovalService } from "../src/application/approval-service.js";
import { ConflictError } from "../src/domain/errors.js";
import type { ApprovalRequest } from "../src/domain/approval-request.js";
import { InMemoryApprovalRepository } from "../src/infrastructure/repositories/in-memory-approval-repository.js";
import { MockNotificationService, type NotificationService } from "../src/application/ports/notification-service.js";

const input = {
  title: "Publicar pagos v2",
  description: "Publicar la version validada en produccion",
  requester: "maria.dev@bancobogota.com",
  approver: "juan.lead@bancobogota.com",
  type: "DEPLOYMENT" as const,
};

describe("ApprovalService", () => {
  it("crea una solicitud pendiente con historial", async () => {
    const service = new ApprovalService(new InMemoryApprovalRepository(), () => new Date("2026-07-10T12:00:00Z"), () => "fixed-id");
    const created = await service.create(input);
    expect(created).toMatchObject({ id: "fixed-id", status: "PENDING", createdAt: "2026-07-10T12:00:00.000Z" });
    expect(created.history).toHaveLength(1);
  });

  it("notifica al responsable despues de persistir la solicitud", async () => {
    const notified: string[] = [];
    const notifications: NotificationService = {
      async notifyRequestCreated(request) { notified.push(request.id); },
    };
    const service = new ApprovalService(new InMemoryApprovalRepository(), undefined, () => "notified-id", notifications);
    const created = await service.create(input);
    expect(notified).toEqual([created.id]);
  });

  it("simula el envio de un correo electronico de prueba", async () => {
    const messages: string[] = [];
    const notifications = new MockNotificationService((message) => messages.push(message));
    const request: ApprovalRequest = {
      ...input,
      id: "email-test-id",
      status: "PENDING",
      createdAt: "2026-07-10T12:00:00.000Z",
      updatedAt: "2026-07-10T12:00:00.000Z",
      history: [],
    };

    await notifications.notifyRequestCreated(request);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("[MOCK_EMAIL]");
    expect(messages[0]).toContain(request.approver);
  });

  it("conserva la solicitud cuando el servicio SMTP no esta disponible", async () => {
    const notifications: NotificationService = {
      async notifyRequestCreated() { throw new Error("SMTP unavailable"); },
    };
    const service = new ApprovalService(new InMemoryApprovalRepository(), undefined, undefined, notifications);
    const created = await service.create(input);
    expect(await service.getById(created.id)).toEqual(created);
  });

  it("solo permite decidir al responsable", async () => {
    const service = new ApprovalService(new InMemoryApprovalRepository());
    const created = await service.create(input);
    await expect(service.decide(created.id, "APPROVED", "otro.usuario@bancobogota.com", "Aprobado"))
      .rejects.toBeInstanceOf(ConflictError);
  });

  it("registra la decision y evita procesarla dos veces", async () => {
    const service = new ApprovalService(new InMemoryApprovalRepository());
    const created = await service.create(input);
    const approved = await service.decide(created.id, "APPROVED", input.approver, "Validaciones correctas");
    expect(approved.status).toBe("APPROVED");
    expect(approved.history).toHaveLength(2);
    await expect(service.decide(created.id, "REJECTED", input.approver, "Cambio de opinion"))
      .rejects.toBeInstanceOf(ConflictError);
  });
});
