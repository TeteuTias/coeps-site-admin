'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  type AdminUserSummary,
  displayUserField,
  displayUserName,
  parseAdminUserListPayload,
} from '@/app/lib/users/admin-user-contract'
import { parseDataObjectPayload, parseStringArrayDataPayload } from '@/app/lib/api-data-contract'
import '../../print-list.css'

function formatarDataEmissao() {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
}

export default function ListaMinicursoPage() {
  const { _id } = useParams<{ _id: string }>()
  const [participantes, setParticipantes] = useState<AdminUserSummary[]>([])
  const [nomeMinicurso, setNomeMinicurso] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    const carregarParticipantes = async () => {
      setLoading(true)
      setError('')

      try {
        const [participantesResponse, minicursoResponse] = await Promise.all([
          fetch(`/api/get/participantesMinicursos/${_id}`, {
            signal: controller.signal,
          }),
          fetch(`/api/get/minicursoProps/${_id}`, {
            signal: controller.signal,
          }),
        ])

        if (!participantesResponse.ok || !minicursoResponse.ok) {
          throw new Error('Não foi possível consultar os dados do minicurso.')
        }

        const [participantesResult, minicursoResult] = await Promise.all([
          participantesResponse.json().catch(() => null) as Promise<unknown>,
          minicursoResponse.json().catch(() => null) as Promise<unknown>,
        ])
        const ids = parseStringArrayDataPayload(participantesResult)
        const minicurso = parseDataObjectPayload(minicursoResult)
        if (!ids || !minicurso || typeof minicurso.name !== 'string') {
          throw new Error('Os dados do minicurso estão em formato inválido.')
        }

        setNomeMinicurso(minicurso.name || 'Minicurso')

        const usuariosResponse = await fetch(
          '/api/post/informacoesVariosUsuarios',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(ids),
            signal: controller.signal,
          },
        )

        if (!usuariosResponse.ok) {
          throw new Error('Não foi possível carregar os dados dos participantes.')
        }

        const usuariosResult: unknown = await usuariosResponse.json().catch(() => null)
        const users = parseAdminUserListPayload(usuariosResult)
        if (!users) throw new Error('A lista de participantes está em formato inválido.')
        setParticipantes(users)
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
  }, [_id])

  if (loading) {
    return (
      <main className="print-list-page">
        <section className="print-list-state" role="status" aria-live="polite">
          <span className="print-list-state-mark" aria-hidden="true">
            C
          </span>
          <p className="print-list-eyebrow">CIEPS · Lista de presença</p>
          <h1>Preparando o documento</h1>
          <p>Estamos reunindo os participantes deste minicurso.</p>
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
        aria-labelledby="lista-minicurso-title"
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
            <h1 id="lista-minicurso-title">Lista de presença</h1>
            <p>{nomeMinicurso}</p>
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
            <dd>{nomeMinicurso}</dd>
          </div>
          <div>
            <dt>Referência</dt>
            <dd className="print-list-reference">{_id}</dd>
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
              <h2>Nenhum participante inscrito</h2>
              <p>
                Este minicurso ainda não possui participantes para incluir na
                lista.
              </p>
            </div>
          </section>
        ) : (
          <div
            className="print-list-table-wrap"
            role="region"
            aria-label="Participantes do minicurso"
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
                    key={participante._id}
                  >
                    <td className="print-list-number">{index + 1}</td>
                    <td>{displayUserName(participante)}</td>
                    <td>{displayUserField(participante.informacoes_usuario.email)}</td>
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
          <span>Lista de presença · Minicurso</span>
        </footer>
      </article>
    </main>
  )
}
