<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{ $notifTitle }}</title>
</head>
<body style="margin:0; padding:0; background-color:#f3f4f6; font-family:Arial, Helvetica, sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6; padding:24px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; max-width:480px; width:100%;">
        <tr>
          <td style="background-color:#194276; padding:20px 32px;">
            <span style="color:#ffffff; font-size:16px; font-weight:bold;">Sergestiona 2.0</span>
            <div style="color:#c7d2e0; font-size:12px; margin-top:2px;">Universidad Sergio Arboleda</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px; font-size:18px; color:#111827;">{{ $notifTitle }}</h1>
            <p style="margin:0 0 24px; font-size:14px; line-height:1.5; color:#374151;">{{ $notifBody }}</p>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background-color:#194276; border-radius:6px;">
                  <a href="{{ $actionUrl }}" style="display:inline-block; padding:10px 20px; font-size:14px; font-weight:bold; color:#ffffff; text-decoration:none;">Ver en Sergestiona</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px; background-color:#f9fafb; border-top:1px solid #e5e7eb;">
            <p style="margin:0; font-size:11px; color:#9ca3af;">
              Recibiste este correo porque tienes notificaciones activadas en Sergestiona 2.0.
              Puedes ajustar tus preferencias en Mi Perfil &rarr; Notificaciones por correo.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
