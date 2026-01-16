export default function Home() {
  return (
    <main className="space-y-8 sm:space-y-10">
      <section className="card grid gap-6 items-center md:grid-cols-2">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-primary sm:text-sm">33 F/T Studio</p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold leading-tight">
            Fortalece tu cuerpo, equilibra tu mente.
          </h1>
          <p className="text-sm sm:text-base text-slate-900">
            Agenda tus clases, gestiona membresías y lleva control de asistencia en un solo lugar.
          </p>
          <div className="flex gap-3 flex-wrap">
            <a className="btn w-full sm:w-auto text-center" href="/portal">Reservar</a>
            <a className="btn w-full sm:w-auto bg-accent text-slate-900 hover:bg-[#f7df5f] text-center" href="/precios">Comprar</a>
          </div>
        </div>
        <div className="card bg-primary text-white shadow-lg">
          <h2 className="text-xl font-semibold mb-2">Beneficios clave</h2>
          <ul className="space-y-2 text-sm">
            <li>• Compra paquetes y membresías para obtener créditos listos para reservar al instante.</li>
            <li>• Gana lugar en clases llenas con lista de espera automática para no perder tu sesión.</li>
            <li>• Mantén tus sesiones activas con renovaciones de membresía y recordatorios antes de vencer.</li>
            <li>• Reserva y paga desde el mismo portal, sin chats ni transferencias manuales.</li>
            <li>• Recibe notificaciones de cambios en clases y confirma tu asistencia con un clic.</li>
          </ul>
        </div>
      </section>
      <section className="card grid gap-4 md:grid-cols-3">
        <div>
          <h3 className="font-semibold text-lg">Método</h3>
          <p className="text-sm text-slate-700">Descripción pendiente, capturar en Admin.</p>
        </div>
        <div>
          <h3 className="font-semibold text-lg">Sedes</h3>
          <p className="text-sm text-slate-700">Agrega ubicaciones y husos horarios en Admin.</p>
        </div>
        <div>
          <h3 className="font-semibold text-lg">Contacto</h3>
          <p className="text-sm text-slate-700">Configura WhatsApp y redes en el bio-link.</p>
        </div>
      </section>
    </main>
  );
}
