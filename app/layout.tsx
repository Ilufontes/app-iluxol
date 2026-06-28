import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Iluxol - Gestión',
  description: 'Gestión de clientes, domicilios y notas de Aluminios Iluxol',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f4f5f7' }}>
        {children}
      </body>
    </html>
  )
}
