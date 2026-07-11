import { randomUUID } from "node:crypto";
import type { ApprovalRequestRepository } from "./ports/approval-request-repository.js";
import type { ApprovalRequest, CreateApprovalRequest, RequestFilters, RequestStatus } from "../domain/approval-request.js";
import { ConflictError, NotFoundError } from "../domain/errors.js";
import { NoopNotificationService, type NotificationService } from "./ports/notification-service.js";

export class ApprovalService {
  constructor(
    private readonly repository: ApprovalRequestRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly uuid: () => string = randomUUID,
    private readonly notifications: NotificationService = new NoopNotificationService(),
  ) {}

  async create(input: CreateApprovalRequest): Promise<ApprovalRequest> {
    const timestamp = this.now().toISOString();
    const request: ApprovalRequest = {
      ...input,
      id: this.uuid(),
      status: "PENDING",
      createdAt: timestamp,
      updatedAt: timestamp,
      history: [{
        id: this.uuid(),
        status: "PENDING",
        changedAt: timestamp,
        changedBy: input.requester,
        comment: "Solicitud creada",
      }],
    };
    const created = await this.repository.create(request);
    try {
      await this.notifications.notifyRequestCreated(created);
    } catch (error) {
      console.error("No fue posible notificar la solicitud creada", error);
    }
    return created;
  }

  list(filters: RequestFilters): Promise<ApprovalRequest[]> {
    return this.repository.findAll(filters);
  }

  async getById(id: string): Promise<ApprovalRequest> {
    const request = await this.repository.findById(id);
    if (!request) throw new NotFoundError("Solicitud no encontrada");
    return request;
  }

  async decide(id: string, status: Exclude<RequestStatus, "PENDING">, user: string, comment: string): Promise<ApprovalRequest> {
    const current = await this.getById(id);
    if (current.status !== "PENDING") throw new ConflictError("La solicitud ya fue procesada");
    if (current.approver !== user) throw new ConflictError("Solo el responsable asignado puede decidir");

    const timestamp = this.now().toISOString();
    return this.repository.update({
      ...current,
      status,
      updatedAt: timestamp,
      history: [...current.history, {
        id: this.uuid(),
        status,
        changedAt: timestamp,
        changedBy: user,
        comment,
      }],
    });
  }
}
