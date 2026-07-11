import nodemailer, { type Transporter } from "nodemailer";
import type { NotificationService } from "../../application/ports/notification-service.js";
import type { ApprovalRequest } from "../../domain/approval-request.js";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
  emailDomain?: string;
}

export class NodemailerNotificationService implements NotificationService {
  private readonly transporter: Transporter;

  constructor(private readonly config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user && config.password ? { user: config.user, pass: config.password } : undefined,
    });
  }

  async notifyRequestCreated(request: ApprovalRequest): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.from,
      to: this.resolveRecipient(request.approver),
      subject: `Nueva solicitud pendiente: ${request.title}`,
      text: [
        `Hola ${request.approver},`,
        "",
        `${request.requester} creo una solicitud que requiere tu decision.`,
        `Titulo: ${request.title}`,
        `Tipo: ${request.type}`,
        `ID: ${request.id}`,
      ].join("\n"),
    });
  }

  private resolveRecipient(approver: string): string {
    if (approver.includes("@")) return approver;
    if (!this.config.emailDomain) {
      throw new Error("SMTP_EMAIL_DOMAIN es requerido cuando el responsable no es un correo");
    }
    return `${approver}@${this.config.emailDomain}`;
  }
}
