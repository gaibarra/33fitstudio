import Link from 'next/link';
import { fetchLinkButtons } from '../../lib/api';

export default async function Bio() {
  let buttons: any[] = [];
  try {
    buttons = await fetchLinkButtons();
  } catch (err) {
    buttons = [];
  }
  return (
    <main className="flex flex-col items-center gap-4">
      <div className="card w-full max-w-md text-center">
        <div className="h-14 w-14 mx-auto rounded-full bg-primary text-white font-bold grid place-items-center mb-3">33</div>
        <h1 className="text-xl font-semibold mb-4">33 F/T Studio</h1>
        <div className="space-y-2">
          {buttons.length === 0 && <p className="text-sm text-slate-700">Configura botones en Admin &gt; Bio-Link.</p>}
          {buttons.map((btn) => (
            <Link
              key={btn.id}
              href={btn.url}
              className="block w-full bg-primary text-white rounded-xl px-4 py-3 font-semibold hover:bg-primaryDark"
            >
              {btn.label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}