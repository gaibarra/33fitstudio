"use client";
import Link from "next/link";

export default function CatalogoAdmin() {
  const cards = [
    { href: "/admin/catalogo/clases", title: "Tipos de clase", desc: "Crea, edita y borra clases." },
    { href: "/admin/catalogo/coaches", title: "Coaches", desc: "Gestiona instructores y estado activo." },
    { href: "/admin/catalogo/productos", title: "Productos", desc: "Drop-in, paquetes y membresías con metadatos." },
  ];

  return (
    <main className="card space-y-4">
      <h1 className="text-2xl font-semibold">Catálogos</h1>
      <p className="text-sm text-slate-700">Administra cada catálogo en su propia pantalla.</p>
      <div className="grid md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="card hover:shadow-md transition border border-primary/10 space-y-2">
            <div className="text-lg font-semibold">{c.title}</div>
            <div className="text-sm text-slate-700">{c.desc}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}