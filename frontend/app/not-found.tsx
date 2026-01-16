export default function NotFound() {
  return (
    <main className="card text-center space-y-2">
      <h1 className="text-2xl font-semibold">Página no encontrada</h1>
      <p className="text-sm text-slate-700">Vuelve al home.</p>
      <a className="btn inline-block" href="/">Ir al inicio</a>
    </main>
  );
}