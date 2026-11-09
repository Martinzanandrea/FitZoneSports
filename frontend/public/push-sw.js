// Manejadores de notificaciones push. Lo carga sw.js con importScripts.
// No cachea ni consulta ninguna respuesta de la API.

self.addEventListener("push", (event) => {
  let datos = {};
  if (event.data) {
    try {
      const json = event.data.json();
      if (json && typeof json === "object") datos = json;
    } catch {
      // Texto plano o payload inválido: se muestra un aviso genérico.
    }
  }

  const titulo =
    typeof datos.titulo === "string" && datos.titulo
      ? datos.titulo
      : "FitZone Sports";
  const cuerpo = typeof datos.cuerpo === "string" ? datos.cuerpo : "";
  const url = urlRelativa(datos.url);

  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: cuerpo,
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = urlRelativa(
    event.notification.data && event.notification.data.url,
  );

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((ventanas) => {
        const propia = ventanas.find(
          (v) => new URL(v.url).origin === self.location.origin,
        );
        if (propia) {
          return propia
            .focus()
            .then((v) => (v && "navigate" in v ? v.navigate(url) : undefined));
        }
        return self.clients.openWindow(url);
      }),
  );
});

// Solo rutas del propio sitio: empiezan con "/" pero no con "//" ni "/\".
function urlRelativa(valor) {
  if (typeof valor !== "string") return "/";
  if (
    !valor.startsWith("/") ||
    valor.startsWith("//") ||
    valor.startsWith("/\\")
  )
    return "/";
  return valor;
}
