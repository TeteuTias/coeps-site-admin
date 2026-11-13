"use client"

import Link from "next/link"
import { useUser } from "@/app/lib/auth0-client"
import {
  BriefcaseBusiness,
  CircleDollarSign,
  ClipboardList,
  History,
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

const logsModule = {
  href: "/logs",
  title: "Logs",
  description: "Quem fez o quê, quando e em quem: inscrições, remoções, pagamentos, edições e entradas.",
  icon: History,
}

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
  const ehAdmin = Boolean(useUser()?.user?.sub?.includes("6a8799078ecd649be9bdb061"))
  const modules = ehAdmin ? [...adminModules, logsModule] : adminModules
  return (
    <>
      <span className="main-eyebrow">CIEPS 2026 / Administração</span>
      <h1 className="main-title">Área do Administrador</h1>
      <p className="main-subtitle">
        Painel central para operar participantes, trabalhos, presenças,
        pagamentos e atividades do congresso com uma interface mais clara,
        densa e alinhada à identidade institucional do CIEPS.
      </p>

      <div className="cards-grid">
        {modules.map((module) => {
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
