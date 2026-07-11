import "dotenv/config";
import { ApprovalService } from "./application/approval-service.js";
import { NodemailerNotificationService } from "./infrastructure/notifications/nodemailer-notification-service.js";
import { PostgresApprovalRepository } from "./infrastructure/repositories/postgres-approval-repository.js";
import { createApp } from "./interfaces/http/app.js";

const port = Number(process.env.PORT ?? 3000);
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://approved:approved@localhost:5432/approved";
const repository = await PostgresApprovalRepository.open(databaseUrl);
const notifications = new NodemailerNotificationService({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: process.env.SMTP_SECURE === "true",
  user: process.env.SMTP_USER,
  password: process.env.SMTP_PASSWORD,
  from: process.env.SMTP_FROM ?? "approved@localhost",
  emailDomain: process.env.SMTP_EMAIL_DOMAIN ?? "example.test",
});
const app = createApp(new ApprovalService(repository, undefined, undefined, notifications), process.env.CORS_ORIGIN);

app.listen(port, () => console.log(`Approval API running at http://localhost:${port}`));
