'use client'

import Link from "next/link";
import { Settings, Users, Hand, CircleDollarSign, UserRound, BriefcaseBusiness } from "lucide-react";

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
        <Link href="/coeps/trabalhos" className="glass-card">
          <div className="card-icon">
            <BriefcaseBusiness size={48} />
          </div>
          <h2 className="card-title">Trabalhos</h2>
        </Link>
        <Link href="/coeps/listas" className="glass-card">
          <div className="card-icon">
            <Users size={48} />
          </div>
          <h2 className="card-title">Gerar Lista de Participantes</h2>
        </Link>
        <Link href="/coeps/presenca" className="glass-card">
          <div className="card-icon">
            <Hand size={48} />
          </div>
          <h2 className="card-title">Lista de Presença</h2>
        </Link>
        <Link href="/coeps/financeiro" className="glass-card">
          <div className="card-icon">
            <CircleDollarSign size={48} />
          </div>
          <h2 className="card-title">Financeiro</h2>
        </Link>
        <Link href="/coeps/usuarios" className="glass-card">
          <div className="card-icon">
            <UserRound size={48} />
          </div>
          <h2 className="card-title">Usuários</h2>
        </Link>
        <Link href="/coeps/gerenciarMinicursos/" className="glass-card">
          <div className="card-icon">
            <Settings size={48} />
          </div>
          <h2 className="card-title">Gerenciar Atividades</h2>
        </Link>
      </div>
    </>
  )
}