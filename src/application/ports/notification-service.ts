import type { ApprovalRequest } from "../../domain/approval-request.js";

export interface NotificationService {
  notifyRequestCreated(request: ApprovalRequest): Promise<void>;
}

export class NoopNotificationService implements NotificationService {
  async notifyRequestCreated(_request: ApprovalRequest): Promise<void> {}
}

export class MockNotificationService implements NotificationService {
  constructor(private readonly onNotify: (message: string) => void = () => undefined) {}

  async notifyRequestCreated(request: ApprovalRequest): Promise<void> {
    const message = `[MOCK_EMAIL] Solicitud creada para ${request.approver}: ${request.title}`;
    this.onNotify(message);
  }
}
