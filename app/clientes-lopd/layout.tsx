import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tratamiento de datos - Iluxol',
}

export default function LopdLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: '#fff', minHeight: '100vh' }}>{children}</div>
}
