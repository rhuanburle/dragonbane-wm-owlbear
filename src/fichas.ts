// As fichas da mesa no Owlbear. O navegador do MESTRE busca no hub os heróis do
// chamado escolhido e publica um RESUMO no metadata da sala (todo mundo vê; a
// chave do mestre não vai junto). Token vinculado a um herói ganha um rótulo com
// PV e PD, que acompanha o hub.
//
// PV/PD mudam na ficha do hub (o jogador, durante o jogo) ou aqui pelo mestre
// (popover) — os dois caminhos gravam no hub, e o próximo ciclo traz de volta.
import OBR, { buildLabel, type Item } from '@owlbear-rodeo/sdk'
import { META_HEROI, META_MESA, META_ROTULO, guardado, mesa, resumir, umPorVez, type HeroiDaMesa, type ResumoDaMesa, type ResumoDoHeroi } from './comum'

let ultimo = ''

export const sincronizarFichas = umPorVez(sincronizarAgora)

async function sincronizarAgora(): Promise<void> {
  const callId = guardado.callId()
  if (!callId || !guardado.chave()) return
  const r = await mesa<{ chamado: { id: string; titulo: string }; herois: HeroiDaMesa[] }>('fichas', { callId })
  const resumo: ResumoDaMesa = { titulo: r.chamado.titulo, callId, herois: r.herois.map(resumir) }
  const texto = JSON.stringify(resumo)
  if (texto !== ultimo) {
    ultimo = texto
    await OBR.room.setMetadata({ [META_MESA]: resumo })
  }
  if (await OBR.scene.isReady()) await atualizarRotulos(resumo.herois)
}

/** Texto do rótulo do token: o que o mestre precisa ver de relance. */
function textoDoRotulo(h: ResumoDoHeroi): string {
  const cond = h.condicoes.length ? ` · ${h.condicoes.join(', ')}` : ''
  return `PV ${h.pv[0]}/${h.pv[1]} · PD ${h.pd[0]}/${h.pd[1]}${cond}`
}

async function atualizarRotulos(herois: ResumoDoHeroi[]): Promise<void> {
  const tokens = await OBR.scene.items.getItems((i) => typeof i.metadata[META_HEROI] === 'string')
  const rotulos = await OBR.scene.items.getItems((i) => META_ROTULO in i.metadata)
  const porToken = new Map(rotulos.map((r) => [(r.metadata[META_ROTULO] as { tokenId: string }).tokenId, r]))
  const novos: Item[] = []
  const mudar: { id: string; texto: string }[] = []
  for (const t of tokens) {
    const h = herois.find((x) => x.id === t.metadata[META_HEROI])
    if (!h) continue
    const texto = textoDoRotulo(h)
    const r = porToken.get(t.id)
    porToken.delete(t.id)
    if (!r)
      novos.push(
        buildLabel()
          .plainText(texto)
          .attachedTo(t.id)
          .position({ x: t.position.x, y: t.position.y + 70 })
          .layer('ATTACHMENT')
          .locked(true)
          .disableHit(true)
          .pointerHeight(0)
          .backgroundOpacity(0.75)
          .metadata({ [META_ROTULO]: { tokenId: t.id, texto } })
          .build(),
      )
    else if ((r.metadata[META_ROTULO] as { texto?: string }).texto !== texto) mudar.push({ id: r.id, texto })
  }
  // rótulo de token que foi desvinculado (ou apagado) sai junto
  const orfaos = [...porToken.values()].map((r) => r.id)
  if (orfaos.length) await OBR.scene.items.deleteItems(orfaos)
  if (novos.length) await OBR.scene.items.addItems(novos)
  if (mudar.length)
    await OBR.scene.items.updateItems(
      mudar.map((m) => m.id),
      (itens) => {
        for (const it of itens) {
          const m = mudar.find((x) => x.id === it.id)!
          ;(it as unknown as { text: { plainText: string } }).text.plainText = m.texto
          it.metadata[META_ROTULO] = { ...(it.metadata[META_ROTULO] as object), texto: m.texto }
        }
      },
    )
}

/** O mestre vincula o token selecionado a um herói do hub (ou desvincula). */
export async function vincularSelecionado(heroiId: string | null): Promise<number> {
  const sel = (await OBR.player.getSelection()) ?? []
  if (!sel.length) return 0
  await OBR.scene.items.updateItems(sel, (itens) => {
    for (const it of itens) {
      if (heroiId) it.metadata[META_HEROI] = heroiId
      else delete it.metadata[META_HEROI]
    }
  })
  return sel.length
}

export function lerResumo(md: Record<string, unknown>): ResumoDaMesa | null {
  const r = md[META_MESA] as ResumoDaMesa | undefined
  return r && Array.isArray(r.herois) ? r : null
}
