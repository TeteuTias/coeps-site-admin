'use client'

import { useEffect, useState } from 'react'
import '../print-list.css'

interface Usuario {
  informacoes_usuario: {
    email: string
    nome: string
  }
}

interface UsuariosResponse {
  data: Usuario[]
}

function formatarDataEmissao() {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
}

export default function ListaPalestrasPage() {
  const [participantes, setParticipantes] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    const carregarParticipantes = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await fetch('/api/get/listaInscritos', {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Não foi possível consultar a lista de congressistas.')
        }

        const result = (await response.json()) as UsuariosResponse
        setParticipantes(Array.isArray(result.data) ? result.data : [])
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') {
          return
        }

        setError(
          cause instanceof Error
            ? cause.message
            : 'Ocorreu um erro ao preparar a lista. Recarregue a página.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void carregarParticipantes()

    return () => controller.abort()
  }, [])

  if (loading) {
    return (
      <main className="print-list-page">
        <section className="print-list-state" role="status" aria-live="polite">
          <span className="print-list-state-mark" aria-hidden="true">
            C
          </span>
          <p className="print-list-eyebrow">CIEPS · Lista de presença</p>
          <h1>Preparando o documento</h1>
          <p>Estamos reunindo os congressistas com inscrição confirmada.</p>
          <span className="print-list-loader" aria-hidden="true" />
        </section>
      </main>
    )
  }

  if (error) {
    return (
      <main className="print-list-page">
        <section className="print-list-state print-list-state--error" role="alert">
          <span className="print-list-state-mark" aria-hidden="true">
            !
          </span>
          <p className="print-list-eyebrow">CIEPS · Lista de presença</p>
          <h1>Não foi possível gerar a lista</h1>
          <p>{error}</p>
          <button
            type="button"
            className="print-list-button"
            onClick={() => window.location.reload()}
          >
            Tentar novamente
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="print-list-page">
      <div className="print-list-actions" aria-label="Ações do documento">
        <p>Revise a lista antes de imprimir ou salvar em PDF.</p>
        <button
          type="button"
          className="print-list-button"
          onClick={() => window.print()}
        >
          Imprimir lista
        </button>
      </div>

      <article
        className="print-list-sheet"
        aria-labelledby="lista-palestras-title"
      >
        <header className="print-list-header">
          <div className="print-list-brand" aria-label="CIEPS">
            <span className="print-list-monogram" aria-hidden="true">
              C
            </span>
            <div>
              <strong>CIEPS</strong>
              <span>Painel administrativo</span>
            </div>
          </div>

          <div className="print-list-heading">
            <p className="print-list-eyebrow">Controle de participantes</p>
            <h1 id="lista-palestras-title">Lista de presença</h1>
            <p>Congressistas</p>
          </div>
        </header>

        <div className="print-list-accent" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <dl className="print-list-meta">
          <div>
            <dt>Atividade</dt>
            <dd>Programação de palestras</dd>
          </div>
          <div>
            <dt>Lista</dt>
            <dd>Congressistas confirmados</dd>
          </div>
          <div>
            <dt>Data de emissão</dt>
            <dd>{formatarDataEmissao()}</dd>
          </div>
          <div>
            <dt>Participantes</dt>
            <dd>{participantes.length}</dd>
          </div>
        </dl>

        {participantes.length === 0 ? (
          <section className="print-list-empty" role="status">
            <span aria-hidden="true">0</span>
            <div>
              <h2>Nenhum congressista encontrado</h2>
              <p>
                Ainda não existem inscrições confirmadas para incluir nesta
                lista.
              </p>
            </div>
          </section>
        ) : (
          <div
            className="print-list-table-wrap"
            role="region"
            aria-label="Congressistas inscritos"
            tabIndex={0}
          >
            <table className="print-list-table">
              <colgroup>
                <col className="print-list-col-number" />
                <col className="print-list-col-name" />
                <col className="print-list-col-email" />
                <col className="print-list-col-signature" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Nº</th>
                  <th scope="col">Nome</th>
                  <th scope="col">E-mail</th>
                  <th scope="col">Assinatura</th>
                </tr>
              </thead>
              <tbody>
                {participantes.map((participante, index) => (
                  <tr
                    key={`${participante.informacoes_usuario.email}-${index}`}
                  >
                    <td className="print-list-number">{index + 1}</td>
                    <td>{participante.informacoes_usuario.nome}</td>
                    <td>{participante.informacoes_usuario.email}</td>
                    <td className="print-list-signature">
                      <span aria-hidden="true" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="print-list-footer">
          <span>Documento administrativo CIEPS</span>
          <span>Lista de presença · Congressistas</span>
        </footer>
      </article>
    </main>
  )
}
