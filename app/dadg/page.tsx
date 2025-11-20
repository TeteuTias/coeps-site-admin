'use client'

import Link from "next/link";
import "./style.css"
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
      <h1 className="main-title">Área do Administrador - DADG</h1>
      <div className="cards-grid">
        <Link href="/coeps/" className="glass-card">
          <div className="card-icon">
            <BriefcaseBusiness size={48} />
          </div>
          <h2 className="card-title">Sala DA</h2>
        </Link>
        <Link href="/dadg/" className="glass-card">
          <div className="card-icon">
            <Users size={48} />
          </div>
          <h2 className="card-title">Câmera DA</h2>
        </Link>
      </div>
    </>
  )
}