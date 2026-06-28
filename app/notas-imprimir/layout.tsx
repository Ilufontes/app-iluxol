import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Orden de trabajo - Iluxol',
}

export default function ImprimirLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: '#fff', minHeight: '100vh' }}>{children}</div>
}
