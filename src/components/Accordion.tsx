'use client';
import { useMemo, useState } from 'react';

type Item = { id: string; question: string; answer: string };

export default function Accordion({ items }: { items: Item[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) => (i.question + ' ' + i.answer).toLowerCase().includes(needle));
  }, [items, q]);

  if (items.length === 0) {
    return <p className="panel p-6 text-steel-700">No study material has been added to this level yet.</p>;
  }

  return (
    <div>
      <input
        className="field mb-4"
        type="search"
        placeholder="Search questions and answers"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search study material"
      />
      {filtered.length === 0 && (
        <p className="panel p-6 text-steel-700">Nothing matches “{q}”. Try a shorter search.</p>
      )}
      <ul className="panel divide-y divide-steel-200">
        {filtered.map((item) => {
          const isOpen = open === item.id;
          return (
            <li key={item.id}>
              <h3>
                <button
                  className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left hover:bg-steel-50"
                  aria-expanded={isOpen}
                  aria-controls={`panel-${item.id}`}
                  onClick={() => setOpen(isOpen ? null : item.id)}
                >
                  <span className="font-sans text-base font-semibold">{item.question}</span>
                  <span aria-hidden className={`mt-1 text-steel-500 transition-transform ${isOpen ? 'rotate-90' : ''}`}>▸</span>
                </button>
              </h3>
              <div
                id={`panel-${item.id}`}
                role="region"
                className={`grid transition-[grid-template-rows] duration-200 ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
              >
                <div className="overflow-hidden">
                  <p className="whitespace-pre-line border-l-4 border-tint-2 bg-steel-50 px-5 py-4 leading-relaxed text-steel-700">
                    {item.answer}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
