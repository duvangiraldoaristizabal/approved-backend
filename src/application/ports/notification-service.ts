import type { ApprovalRequest } from "../../domain/approval-request.js";

export interface NotificationService {
  notifyRequestCreated(request: ApprovalRequest): Promise<void>;
}

export class NoopNotificationService implements NotificationService {
  async notifyRequestCreated(_request: ApprovalRequest): Promise<void> {}
}
