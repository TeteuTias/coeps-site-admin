"use client"

import Link from "next/link"
import {
  BriefcaseBusiness,
  CircleDollarSign,
  ClipboardList,
  Settings,
  UserRound,
  UserCheck,
} from "lucide-react"

const adminModules = [
  {
    href: "/trabalhos",
    title: "Trabalhos",
    description: "Acompanhe submissões, pareceres, arquivos e status de avaliação.",
    icon: BriefcaseBusiness,
  },
  {
    href: "/listas",
    title: "Listas",
    description: "Gere listas de participantes por atividade, minicurso ou palestra.",
    icon: ClipboardList,
  },
  {
    href: "/presenca",
    title: "Presença",
    description: "Controle listas de presença e rotinas de conferência do evento.",
    icon: UserCheck,
  },
  {
    href: "/financeiro",
    title: "Financeiro",
    description: "Revise pagamentos, parcelamentos e configurações de inscrição.",
    icon: CircleDollarSign,
  },
  {
    href: "/usuarios",
    title: "Usuários",
    description: "Consulte congressistas, perfis, status de cadastro e inscrições.",
    icon: UserRound,
  },
  {
    href: "/gerenciarMinicursos/",
    title: "Atividades",
    description: "Configure minicursos, vagas, cronogramas e visibilidade pública.",
    icon: Settings,
  },
]

export default function Page() {
  return (
    <div className="main-container">
      <div className="content-area">
        <PaginaAreaDoCliente />
      </div>
    </div>
  )
}

function PaginaAreaDoCliente() {
  return (
    <>
      <span className="main-eyebrow">CIEPS 2026 / Administração</span>
      <h1 className="main-title">Área do Administrador</h1>
      <p className="main-subtitle">
        Painel central para operar participantes, trabalhos, presenças,
        pagamentos e atividades do congresso com uma interface mais clara,
        densa e alinhada a identidade institucional do CIEPS.
      </p>

      <div className="cards-grid">
        {adminModules.map((module) => {
          const Icon = module.icon

          return (
            <Link href={module.href} className="glass-card" key={module.href}>
              <div>
                <div className="card-icon">
                  <Icon size={48} />
                </div>
                <h2 className="card-title">{module.title}</h2>
                <p className="card-description">{module.description}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}
