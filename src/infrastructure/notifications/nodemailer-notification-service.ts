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
  authType?: "basic" | "oauth2";
  oauth2?: {
    user?: string;
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    accessToken?: string;
    expires?: number;
  };
}

export class NodemailerNotificationService implements NotificationService {
  private readonly transporter: Transporter;

  constructor(private readonly config: SmtpConfig) {
    const auth = this.buildAuth();
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth,
    });
  }

  async notifyRequestCreated(request: ApprovalRequest): Promise<void> {
    const recipient = this.resolveRecipient(request.approver);

    await this.transporter.sendMail({
      from: this.config.from.trim().toLowerCase(),
      to: recipient,
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

  private buildAuth() {
    if (this.config.authType === "oauth2") {
      const oauth2 = this.config.oauth2;
      if (!oauth2?.clientId || !oauth2.clientSecret || !oauth2.refreshToken) {
        console.warn("SMTP OAuth2 requiere clientId, clientSecret y refreshToken; se usara autenticacion basica si existe.");
        if (this.config.user && this.config.password) {
          return { user: this.config.user, pass: this.config.password };
        }
        return undefined;
      }

      return {
        type: "OAuth2" as const,
        user: oauth2.user ?? this.config.user,
        clientId: oauth2.clientId,
        clientSecret: oauth2.clientSecret,
        refreshToken: oauth2.refreshToken,
        accessToken: oauth2.accessToken,
        expires: oauth2.expires,
      };
    }

    if (this.config.user && this.config.password) {
      return { user: this.config.user, pass: this.config.password };
    }

    return undefined;
  }

  private resolveRecipient(approver: string): string {
    const normalizedApprover = approver.trim().toLowerCase();
    if (normalizedApprover.includes("@")) return normalizedApprover;

    const emailDomain = this.config.emailDomain ?? this.config.from.split("@")[1];
    if (!emailDomain) {
      throw new Error("SMTP_EMAIL_DOMAIN es requerido cuando el responsable no es un correo");
    }

    return `${normalizedApprover}@${emailDomain.toLowerCase()}`;
  }
}
