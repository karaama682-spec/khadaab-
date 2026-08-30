import React, { useEffect, useRef, useState } from 'react';
import { Download, Printer, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import api from '../services/api';

// Neither the Student nor the User record stores a photo, so the photo slot
// falls back to the person's initials rather than a broken image.
const initialsOf = (name) => String(name || '')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(part => part[0].toUpperCase())
  .join('');

const ACCENT = { student: '#059669', teacher: '#4f46e5' };

/**
 * Print-friendly identity card shown in a modal.
 *
 * `kind` selects the accent and heading; `rows` are the already-resolved
 * label/value pairs to print, so this component never guesses at a data shape.
 */
const IdCard = ({ open, onClose, kind = 'student', name, idNumber, rows = [] }) => {
  const [instituteName, setInstituteName] = useState('Institute Management');
  const cardRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    api.get('/settings')
      .then(({ data }) => {
        if (cancelled) return;
        const resolved = data?.businessInfo?.name || data?.name;
        if (resolved) setInstituteName(resolved);
      })
      .catch(() => { /* the card is still valid with the default heading */ });
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;

  const accent = ACCENT[kind] || ACCENT.student;
  const heading = kind === 'teacher' ? 'Teacher Identity Card' : 'Student Identity Card';

  const downloadPdf = () => {
    // Standard ID-1 card size, so a print lines up with a badge holder.
    const doc = new jsPDF({ unit: 'mm', format: [85.6, 54], orientation: 'landscape' });

    doc.setFillColor(accent);
    doc.rect(0, 0, 85.6, 13, 'F');
    doc.setTextColor('#ffffff');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(String(instituteName).toUpperCase().slice(0, 34), 4, 6);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(heading.toUpperCase(), 4, 10);

    // Initials disc in place of a photo.
    doc.setFillColor('#e2e8f0');
    doc.circle(13, 30, 8, 'F');
    doc.setTextColor('#475569');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(initialsOf(name) || '?', 13, 32, { align: 'center' });

    doc.setTextColor('#0f172a');
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(String(name || '-'), 55)[0], 25, 22);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(accent);
    doc.text(String(idNumber || 'NOT ISSUED'), 25, 27.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor('#475569');
    let y = 33;
    rows.filter(row => row.value).slice(0, 4).forEach(row => {
      doc.text(`${row.label}: ${doc.splitTextToSize(String(row.value), 52)[0]}`, 25, y);
      y += 4;
    });

    doc.setDrawColor('#cbd5e1');
    doc.line(4, 48, 81.6, 48);
    doc.setFontSize(5);
    doc.setTextColor('#94a3b8');
    doc.text('This card remains the property of the institute.', 4, 51);

    const safeName = String(name || 'card').replace(/\s+/g, '_');
    doc.save(`${kind === 'teacher' ? 'Teacher' : 'Student'}_ID_${safeName}.pdf`);
  };

  const printCard = () => window.print();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm print:bg-white print:p-0">
      <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl dark:bg-slate-900 print:max-w-none print:shadow-none">
        <div className="mb-5 flex items-center justify-between print:hidden">
          <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">{heading}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        {/* The printed area. Sized to the ID-1 aspect ratio. */}
        {/* The card always prints on a light surface, so its inner colours are
            fixed rather than theme-dependent — a dark-mode override here would
            render white text on the white card. */}
        <div ref={cardRef} id="id-card-printable" className="mx-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="px-4 py-3 text-white" style={{ backgroundColor: accent }}>
            <p className="text-[11px] font-black uppercase leading-tight tracking-wide">{instituteName}</p>
            <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.18em] opacity-80">{heading}</p>
          </div>

          <div className="flex gap-4 p-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-black text-slate-500">
              {initialsOf(name) || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-black text-slate-900">{name || '-'}</p>
              <p className="mt-0.5 font-mono text-sm font-black" style={{ color: accent }}>
                {idNumber || 'NOT ISSUED'}
              </p>
              <dl className="mt-2 space-y-0.5">
                {rows.filter(row => row.value).map(row => (
                  <div key={row.label} className="flex gap-2 text-[11px]">
                    <dt className="font-bold uppercase tracking-wide text-slate-400">{row.label}</dt>
                    <dd className="min-w-0 flex-1 truncate font-semibold text-slate-700">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <p className="border-t border-slate-100 px-4 py-2 text-[8px] font-semibold uppercase tracking-wider text-slate-400">
            This card remains the property of the institute.
          </p>
        </div>

        {!idNumber && (
          <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 print:hidden">
            No ID has been issued for this record yet. Identifiers are issued automatically on registration.
          </p>
        )}

        <div className="mt-6 flex gap-3 print:hidden">
          <button type="button" onClick={printCard} className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            <Printer size={15} strokeWidth={3} /> Print
          </button>
          <button type="button" onClick={downloadPdf} className="flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-wider text-white shadow-lg transition-opacity hover:opacity-90" style={{ backgroundColor: accent }}>
            <Download size={15} strokeWidth={3} /> Download PDF
          </button>
        </div>
      </div>

      {/* Printing shows only the card, leaving the rest of the app off the page. */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #id-card-printable, #id-card-printable * { visibility: visible; }
          #id-card-printable { position: absolute; left: 0; top: 0; width: 85.6mm; }
          @page { size: auto; margin: 8mm; }
        }
      `}</style>
    </div>
  );
};

export default IdCard;
