'use client';

export function PrintButton() {
  return (
    <button className="btn" type="button" onClick={() => window.print()}>
      🖨 Cetak / simpan sebagai PDF
    </button>
  );
}
