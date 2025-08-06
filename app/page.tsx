'use client'

import Link from "next/link";
import { FileText, Users, Hand, CircleDollarSign, UserRound } from "lucide-react";

export default function Page() {
  return (
    <div className="main-container" style={{
      background: 'linear-gradient(135deg, var(--azul) 0%, var(--carmin) 100%) fixed',
      backgroundAttachment: 'fixed',
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat'
    }}>
      <div className="content-area">
        <PaginaAreaDoCliente />
      </div>
    </div>
  )
}

function PaginaAreaDoCliente() {
  return (
    <>
      <h1 className="main-title">Área do Administrador</h1>
      <div className="cards-grid">
        <Link href="/trabalhos" className="glass-card">
          <div className="card-icon">
            <FileText size={48} />
          </div>
          <h2 className="card-title">Lista de Trabalhos</h2>
        </Link>
        <Link href="/listas" className="glass-card">
          <div className="card-icon">
            <Users size={48} />
          </div>
          <h2 className="card-title">Lista de Participantes</h2>
        </Link>
        <Link href="/presenca" className="glass-card">
          <div className="card-icon">
            <Hand size={48} />
          </div>
          <h2 className="card-title">Lista de Presença</h2>
        </Link>
        <Link href="/financeiro" className="glass-card">
          <div className="card-icon">
            <CircleDollarSign size={48} />
          </div>
          <h2 className="card-title">Financeiro</h2>
        </Link>
        <Link href="/usuarios" className="glass-card">
          <div className="card-icon">
            <UserRound size={48} />
          </div>
          <h2 className="card-title">Usuários</h2>
        </Link>
      </div>
    </>
  )
}