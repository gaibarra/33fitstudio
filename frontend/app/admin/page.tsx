import Link from 'next/link';

const cards = [
  { href: '/admin/catalogo', title: 'Catálogo', desc: 'Clases, coaches, productos.' },
  { href: '/admin/agenda', title: 'Agenda', desc: 'Programar sesiones y revisar capacidad.' },
  { href: '/admin/asistencia', title: 'Asistencia', desc: 'Control de asistencia y check-in.' },
  { href: '/admin/clientes', title: 'Clientes', desc: 'Gestión de usuarios y roles.' },
  { href: '/admin/ordenes', title: 'Órdenes', desc: 'Pagos y transacciones.' },
  { href: '/admin/sedes', title: 'Sedes', desc: 'Ubicaciones y zonas horarias.' },
  { href: '/admin/reportes', title: 'Reportes', desc: 'Ocupación, ingresos, no-shows.' },
];

export default function AdminHome() {
  return (
    <main className="grid gap-4 sm:grid-cols-2">
      {cards.map((card) => (
        <Link key={card.href} href={card.href} className="card hover:shadow-md transition border border-primary/10">
          <h2 className="text-xl font-semibold mb-2">{card.title}</h2>
          <p className="text-sm text-slate-700">{card.desc}</p>
        </Link>
      ))}
    </main>
  );
}