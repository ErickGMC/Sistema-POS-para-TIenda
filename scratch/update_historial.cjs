const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'pos', 'HistorialVentas.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add import
if (!content.includes('useAuthStore')) {
  content = content.replace(
    /import React, \{ useState, useEffect \} from 'react';/,
    `import React, { useState, useEffect } from 'react';\nimport { useAuthStore } from '../../store/useAuthStore';\nimport ModalConfirmacion from '../ui/ModalConfirmacion';`
  );
}
// Add AlertCircle icon import if needed
if (!content.includes('AlertCircle')) {
    content = content.replace(
        /import \{ Calendar, Search, Filter, MessageCircle, ChevronDown, ChevronUp, Receipt, Phone, Printer \} from 'lucide-react';/,
        `import { Calendar, Search, Filter, MessageCircle, ChevronDown, ChevronUp, Receipt, Phone, Printer, AlertCircle } from 'lucide-react';`
    );
}


// 2. Add useAuthStore and modal states inside component
if (!content.includes('const { user } = useAuthStore();')) {
  content = content.replace(
    /export default function HistorialVentas\(\) \{/,
    `export default function HistorialVentas() {\n  const { user } = useAuthStore();\n  const [voidModal, setVoidModal] = useState<{isOpen: boolean, ventaId: string | null}>({isOpen: false, ventaId: null});`
  );
}

// 3. Add anular function
if (!content.includes('const handleAnularVenta = async')) {
  const anularFunc = `
  const canVoid = user?.role === 'admin' || (user?.permisos && user.permisos.includes('ventas:anular'));

  const handleAnularVenta = async () => {
    if (!voidModal.ventaId) return;
    setLoading(true);
    try {
      const res = await (window as any).electron.anularVenta(voidModal.ventaId);
      if (res.success) {
        setVoidModal({ isOpen: false, ventaId: null });
        fetchVentas(); // Recargar ventas
      } else {
        alert("Error al anular: " + res.error);
        setVoidModal({ isOpen: false, ventaId: null });
      }
    } catch (e) {
      console.error(e);
      setVoidModal({ isOpen: false, ventaId: null });
    }
    setLoading(false);
  };
`;
  content = content.replace(/(const enviarWhatsApp =[\s\S]*?setWaPromptId\(null\);\n  };)/, `$1\n${anularFunc}`);
}

// 4. Update rendering inside map
if (!content.includes('const isAnulado = venta.anulado === 1;')) {
  content = content.replace(
    /(<div key=\{venta\.id\} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">)/g,
    `$1\n                        {(() => {\n                          const isAnulado = venta.anulado === 1;\n                          return (\n                            <>\n`
  );

  content = content.replace(
    /(<div className="font-mono text-sm text-slate-600 mb-1">ID: \{venta\.id\.toUpperCase\(\)\}<\/div>)/,
    `$1\n                                {isAnulado && <span className="ml-3 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded border border-red-200 font-bold">ANULADO</span>}`
  );

  // Cross out the total if annulled
  content = content.replace(
    /<div className="text-2xl font-black text-emerald-600">S\/ \{venta\.total\.toFixed\(2\)\}<\/div>/,
    `<div className={\`text-2xl font-black \${isAnulado ? 'text-slate-400 line-through' : 'text-emerald-600'}\`}>S/ {venta.total.toFixed(2)}</div>`
  );

  // Add Anular button near the Print button
  content = content.replace(
    /(<button[^>]*>\s*<Printer size=\{16\} \/> Imprimir\s*<\/button>)/,
    `$1\n                                {canVoid && !isAnulado && (\n                                  <button \n                                    onClick={() => setVoidModal({ isOpen: true, ventaId: venta.id })} \n                                    className="bg-white border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm"\n                                  >\n                                    <AlertCircle size={16} /> Anular Venta\n                                  </button>\n                                )}`
  );

  // Close the IIFE
  content = content.replace(
    /(\{\/\* Detalle Expandible \*\/\}[\s\S]*?<\/div>\s*)<\/div>\s*<\/div>/g,
    `$1</div>\n                            </>\n                          );\n                        })()}`
  );
  
}

// 5. Render Modal at the end
if (!content.includes('ModalConfirmacion')) {
    content = content.replace(
        /(<\/div>\s*<\/div>\s*)$/,
        `
      <ModalConfirmacion 
        isOpen={voidModal.isOpen} 
        title="¿Estás seguro de anular esta venta?" 
        message="Esta acción marcará el ticket como anulado y devolverá todos los productos al inventario. No se puede deshacer."
        onConfirm={handleAnularVenta}
        onCancel={() => setVoidModal({ isOpen: false, ventaId: null })}
      />
    $1`
    );
}


fs.writeFileSync(filePath, content, 'utf8');
console.log('HistorialVentas.tsx updated successfully!');
