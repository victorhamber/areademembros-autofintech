/** Chaves de `Setting` usadas na aba E-mail do admin. */
export const EMAIL_SETTING_KEYS = [
  'resend_api_key',
  'sender_name',
  'sender_email',
  'welcome_template_pt',
  'reset_template_pt',
  'welcome_template_es',
  'reset_template_es',
] as const;

export type EmailSettingKey = (typeof EMAIL_SETTING_KEYS)[number];

/** Modelo HTML — recuperação de senha (PT). Placeholders: {{name}}, {{reset_link}} */
export const DEFAULT_RESET_TEMPLATE_PT = `<div style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:#0f172a;padding:28px 32px;text-align:center;">
              <p style="margin:0;font-size:20px;font-weight:600;color:#ffffff;letter-spacing:-0.02em;">Autofintech</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Recuperação de senha</p>
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#0f172a;line-height:1.35;">Olá, {{name}}</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#475569;">Recebemos uma solicitação para redefinir a senha da sua conta na área de membros. Use o botão abaixo para escolher uma nova senha. O link expira em <strong>1 hora</strong>.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 28px;">
                <tr>
                  <td style="border-radius:10px;background:#2563eb;">
                    <a href="{{reset_link}}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Redefinir minha senha</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px;font-size:13px;line-height:1.55;color:#94a3b8;">Se você não fez este pedido, ignore este e-mail — sua senha continua a mesma.</p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#cbd5e1;word-break:break-all;">Link alternativo: {{reset_link}}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">Autofintech · Mensagem automática, por favor não responda.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`;
