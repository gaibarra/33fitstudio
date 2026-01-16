import Link from 'next/link';

const cards = [
  { href: '/admin/catalogo', title: 'Catálogo', desc: 'Clases, coaches, productos.' },
  { href: '/admin/agenda', title: 'Agenda', desc: 'Programar sesiones y revisar capacidad.' },
  { href: '/admin/bio', title: 'Bio-Link', desc: 'Botones y tracking de clics.' },
  { href: '/admin/reportes', title: 'Reportes', desc: 'Ocupación, ingresos, no-shows.' },
];

export default function AdminHome() {
  return (
    <main className="grid md:grid-cols-2 gap-4">
      {cards.map((card) => (
        <Link key={card.href} href={card.href} className="card hover:shadow-md transition border border-primary/10">
          <h2 className="text-xl font-semibold mb-2">{card.title}</h2>
          <p className="text-sm text-slate-700">{card.desc}</p>
        </Link>
      ))}
    </main>
  );
}