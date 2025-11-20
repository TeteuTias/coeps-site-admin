"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, FileText, ClipboardList, UserCheck, CreditCard } from 'lucide-react'
import './Header.css'

export default function Header() {
  const pathname = usePathname()

  // Hide header on print-specific pages
  if (
    pathname.startsWith('/gerarListaMinicurso/') ||
    pathname.startsWith('/gerarListaPalestras')
  ) {
    return null
  }

  const navigationItems = [
    { href: '/', label: 'Início', icon: Home },
    { href: '/usuarios', label: 'Usuários', icon: Users },
    { href: '/trabalhos', label: 'Trabalhos', icon: FileText },
    { href: '/listas', label: 'Listas', icon: ClipboardList },
    { href: '/presenca', label: 'Presença', icon: UserCheck },
    { href: '/financeiro', label: 'Financeiro', icon: CreditCard },
  ]

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(href)
  }

  return (
    <header className="admin-header">
      <div className="header-container">
        {/* Logo e Título */}
        <div className="header-brand">
          <Link href="/" className="header-logo">
            <Home size={24} />
            <span className="header-title">COEPS Admin</span>
          </Link>
        </div>

        {/* Navegação */}
        <nav className="header-nav">
          {navigationItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`header-nav-item ${
                  isActive(item.href) ? 'active' : ''
                }`}
              >
                <Icon size={18} />
                <span className="header-nav-text">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
