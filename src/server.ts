import "dotenv/config";
import { ApprovalService } from "./application/approval-service.js";
import { MockNotificationService } from "./application/ports/notification-service.js";
import { PostgresApprovalRepository } from "./infrastructure/repositories/postgres-approval-repository.js";
import { createApp } from "./interfaces/http/app.js";

const port = Number(process.env.PORT ?? 3000);
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://approved:approved@localhost:5432/approved";
const repository = await PostgresApprovalRepository.open(databaseUrl);
const notifications = new MockNotificationService((message) => console.log(message));
const app = createApp(new ApprovalService(repository, undefined, undefined, notifications), process.env.CORS_ORIGIN);

app.listen(port, () => console.log(`Approval API running at http://localhost:${port}`));
