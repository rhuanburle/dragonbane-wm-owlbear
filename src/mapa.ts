// O mapa da região dentro da cena do Owlbear: o hub é a fonte; o navegador do
// MESTRE (página de fundo) baixa os carimbos quando a versão muda e desenha cada
// um como uma imagem travada na camada MAP. O mestre carimba pela ferramenta
// "Carimbo WM" e apaga selecionando o carimbo e apertando Delete — as duas coisas
// vão para o hub e valem para todos os mestres e VTTs.
import OBR, { buildImage, buildText, type Item, type Vector2 } from '@owlbear-rodeo/sdk'
import { hexGeom } from '../../src/lib/hexgrid'
import type { MapScene } from '../../src/data/types'
import { ORDEM_DA_CAMADA, encaixarNoHex } from '../../src/data/mapa/paleta'
import { META_CARIMBO, META_MAPA_LIGADO, guardado, mesa, umPorVez } from './comum'

interface GradeDoHub {
  type: number
  size: number
  ancora?: { cx: number; cy: number }
}

interface CenaDoHub {
  nome: string
  largura: number
  altura: number
  grade: GradeDoHub
  fundo: { src: string | null; cor: string | null }
  pecasDoFoundry: { src: string; x: number; y: number; w: number; h: number; rot: number; sort: number }[]
}

interface CarimboDoHub {
  id: string
  src: string | null
  texto: string | null
  camada: 'terreno' | 'caminho' | 'marco' | 'rotulo'
  x: number
  y: number
  w: number
  h: number
  rot: number
  fontSize: number | null
  color: string | null
  criadoEm: number
}

type RespostaDoMapa = { versao: number; igual?: true; cena?: CenaDoHub | null; carimbos?: CarimboDoHub[] }

// ---------------------------------------------------------------- coordenadas

/** Hub → Owlbear: o centro de um hex do hub vira o centro de um hex do Owlbear,
 *  e a escala é a razão entre as larguras de hex (o Owlbear mede a grade em
 *  "dpi" = largura da célula na grade hex vertical). Como as duas grades são
 *  pontudas em cima, casar UM centro com UM centro casa a grade inteira. */
export interface Conversao {
  k: number
  /** dpi da cena do Owlbear (para escalar as imagens pelo `k` medido). */
  dpiCena: number
  hub: Vector2
  obr: Vector2
  grade: GradeDoHub
  /** zIndex logo acima das imagens do próprio mestre na camada MAP: o Owlbear dá
   *  `Date.now()` de zIndex a quem não escolhe, então o fundo que o mestre subiu
   *  para criar a cena cobria os hexes do hub. */
  base: number
}

let conv: Conversao | null = null
let cenaAtual: CenaDoHub | null = null

async function montarConversao(cena: CenaDoHub, carimbos: CarimboDoHub[], base: number): Promise<Conversao | null> {
  const { type, size } = cena.grade
  if (!size || type < 2) return null
  let ancora = cena.grade.ancora
  if (!ancora) {
    // Antes da migração a grade do hub é deduzida das peças (a mesma conta do /mapa).
    const g = hexGeom({
      grid: { type, size },
      tiles: [...cena.pecasDoFoundry, ...carimbos.filter((c) => c.camada !== 'rotulo')],
    } as unknown as MapScene)
    if (!g) return null
    ancora = { cx: g.cx, cy: g.cy }
  }
  const m = await orientarGrade(type >= 4)
  if (!m) return null
  return { k: m.passo / size, dpiCena: await OBR.scene.grid.getDpi(), hub: { x: ancora.cx, y: ancora.cy }, obr: m.c0, grade: cena.grade, base }
}

/** Mede a grade hex do Owlbear em vez de confiar no nome do tipo: pede o centro
 *  de hex mais perto da origem e o do vizinho. Hex "em linhas" (ponta para cima,
 *  como o Ermos) tem o vizinho na MESMA altura; se não tiver, troca o tipo da
 *  grade e mede de novo. O passo medido entre os dois centros é a largura do hex
 *  — a mesma medida que `grid.size` é no hub —, então a escala sai dele, sem
 *  depender do que o "dpi" significa em cada tipo de grade. */
async function orientarGrade(colunas: boolean): Promise<{ c0: Vector2; passo: number } | null> {
  const medir = async () => {
    const dpi = await OBR.scene.grid.getDpi()
    const c0 = await OBR.scene.grid.snapPosition({ x: 0, y: 0 }, 1, false, true)
    const n = await OBR.scene.grid.snapPosition(colunas ? { x: c0.x, y: c0.y + dpi } : { x: c0.x + dpi, y: c0.y }, 1, false, true)
    const alinhado = colunas ? Math.abs(n.x - c0.x) < 1 : Math.abs(n.y - c0.y) < 1
    const passo = colunas ? n.y - c0.y : n.x - c0.x
    return alinhado && passo > 1 ? { c0, passo } : null
  }
  const atual = await OBR.scene.grid.getType()
  if (atual !== 'HEX_VERTICAL' && atual !== 'HEX_HORIZONTAL') await OBR.scene.grid.setType('HEX_VERTICAL')
  const m = await medir()
  if (m) return m
  const tipo = await OBR.scene.grid.getType()
  await OBR.scene.grid.setType(tipo === 'HEX_VERTICAL' ? 'HEX_HORIZONTAL' : 'HEX_VERTICAL')
  return medir()
}

const paraObr = (c: Conversao, p: Vector2): Vector2 => ({ x: (p.x - c.hub.x) * c.k + c.obr.x, y: (p.y - c.hub.y) * c.k + c.obr.y })
export const paraHub = (c: Conversao, p: Vector2): Vector2 => ({ x: (p.x - c.obr.x) / c.k + c.hub.x, y: (p.y - c.obr.y) / c.k + c.hub.y })
export const conversaoAtual = () => conv

// ---------------------------------------------------------------- itens

function mimeDe(url: string): string {
  const ext = url.split(/[?#]/)[0].split('.').pop()?.toLowerCase()
  return ext === 'svg' ? 'image/svg+xml' : ext === 'webp' ? 'image/webp' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
}

/** Uma imagem do hub posicionada por retângulo (coordenadas da cena do hub). A
 *  imagem "mede" w×h×10 pixels, e o dpi dela é escolhido para 10 px da imagem
 *  valerem 1 unidade do hub (= k unidades do Owlbear): ela ocupa no Owlbear
 *  exatamente o retângulo que ocupa no hub, qualquer que seja o arquivo. */
function imagem(c: Conversao, chave: string, assinatura: string, src: string, r: { x: number; y: number; w: number; h: number }, rot: number, z: number, travarClique = false): Item {
  const W = Math.max(1, Math.round(r.w * 10))
  const H = Math.max(1, Math.round(r.h * 10))
  return buildImage({ url: src, width: W, height: H, mime: mimeDe(src) }, { dpi: (10 * c.dpiCena) / c.k, offset: { x: W / 2, y: H / 2 } })
    .position(paraObr(c, { x: r.x + r.w / 2, y: r.y + r.h / 2 }))
    .rotation(rot)
    .layer('MAP')
    .locked(true)
    .disableHit(travarClique)
    .zIndex(c.base + z)
    .name('Mapa da região (hub)')
    .metadata({ [META_CARIMBO]: { id: chave, assinatura } })
    .build()
}

function desejados(c: Conversao, cena: CenaDoHub, carimbos: CarimboDoHub[]): Map<string, { assinatura: string; item: () => Item }> {
  const m = new Map<string, { assinatura: string; item: () => Item }>()
  if (cena.fundo.src) {
    const src = cena.fundo.src
    const r = { x: 0, y: 0, w: cena.largura, h: cena.altura }
    m.set('fundo', { assinatura: `${src}|${r.w}|${r.h}`, item: () => imagem(c, 'fundo', `${src}|${r.w}|${r.h}`, src, r, 0, 0, true) })
  }
  cena.pecasDoFoundry.forEach((t, i) => {
    const chave = `foundry:${i}`
    const ass = `${t.src}|${t.x}|${t.y}|${t.w}|${t.h}|${t.rot}`
    m.set(chave, { assinatura: ass, item: () => imagem(c, chave, ass, t.src, t, t.rot, 1 + (t.sort ?? 0)) })
  })
  const ordem = [...carimbos].sort((a, b) => ORDEM_DA_CAMADA[a.camada] - ORDEM_DA_CAMADA[b.camada] || a.criadoEm - b.criadoEm)
  ordem.forEach((s, i) => {
    const ass = `${s.src}|${s.texto}|${s.x}|${s.y}|${s.w}|${s.h}|${s.rot}`
    const z = 2000 + i
    if (s.camada === 'rotulo' && s.texto) {
      m.set(s.id, {
        assinatura: ass,
        item: () =>
          buildText()
            .plainText(s.texto!)
            .textType('PLAIN')
            .fontSize(Math.max(12, (s.fontSize ?? 8) * c.k))
            .fillColor(s.color ?? '#2a2219')
            .textAlign('CENTER')
            .textAlignVertical('MIDDLE')
            .width(s.w * c.k * 4)
            .height(s.h * c.k)
            .position(paraObr(c, { x: s.x + s.w / 2 - s.w * 2, y: s.y }))
            .layer('TEXT')
            .locked(true)
            .zIndex(z)
            .name(s.texto!)
            .metadata({ [META_CARIMBO]: { id: s.id, assinatura: ass } })
            .build(),
      })
    } else if (s.src) m.set(s.id, { assinatura: ass, item: () => imagem(c, s.id, ass, s.src!, s, s.rot, z) })
  })
  return m
}

// ---------------------------------------------------------------- sincronia

let versaoAtual: number | undefined
/** Itens que NÓS apagamos (para o onChange não achar que foi o mestre). */
const apagandoNos = new Set<string>()
/** item do Owlbear → id do carimbo no hub, do último estado visto. */
let conhecidos = new Map<string, string>()

export async function mapaLigado(): Promise<boolean> {
  return (await OBR.scene.isReady()) && (await OBR.scene.getMetadata())[META_MAPA_LIGADO] === true
}

/** Busca o mapa no hub (só se a versão mudou, a não ser com `forcar`) e deixa a
 *  cena do Owlbear igual: apaga o que saiu ou mudou, cria o que falta. */
export const sincronizarMapa = umPorVez(sincronizarAgora)

async function sincronizarAgora(forcar: boolean): Promise<void> {
  if (!(await OBR.scene.isReady()) || !(await mapaLigado())) return
  const r = await mesa<RespostaDoMapa>('mapa', forcar || !conv ? {} : { versao: versaoAtual })
  if (r.igual || !r.cena) return
  const cena = r.cena
  const carimbos = r.carimbos ?? []
  const doMestre = await OBR.scene.items.getItems((i) => i.layer === 'MAP' && !(META_CARIMBO in i.metadata))
  const c = await montarConversao(cena, carimbos, doMestre.reduce((m, i) => Math.max(m, i.zIndex + 1), 0))
  if (!c) return
  // Escala ou âncora mudaram (o mestre trocou o dpi da cena), ou o mestre pôs
  // outra imagem de mapa por cima: redesenha tudo.
  const redesenhar = !conv || conv.k !== c.k || conv.obr.x !== c.obr.x || conv.obr.y !== c.obr.y || conv.base !== c.base
  conv = c
  cenaAtual = cena

  const quero = desejados(c, cena, carimbos)
  const existentes = await OBR.scene.items.getItems((i) => META_CARIMBO in i.metadata)
  const tem = new Map<string, string>()
  const sair: string[] = []
  for (const it of existentes) {
    const meta = it.metadata[META_CARIMBO] as { id?: string; assinatura?: string }
    const alvo = meta.id ? quero.get(meta.id) : undefined
    if (redesenhar || !alvo || alvo.assinatura !== meta.assinatura || tem.has(meta.id!)) sair.push(it.id)
    else tem.set(meta.id!, it.id)
  }
  const entrar = [...quero.entries()].filter(([id]) => !tem.has(id)).map(([, d]) => d.item())
  sair.forEach((id) => apagandoNos.add(id))
  if (sair.length) await OBR.scene.items.deleteItems(sair)
  if (entrar.length) await OBR.scene.items.addItems(entrar)
  versaoAtual = r.versao
}

/** O mestre apagou um carimbo no Owlbear (Delete): apaga no hub também. Troca de
 *  cena ou limpeza em massa (muitos somem juntos) NÃO apaga nada no hub — seria
 *  fácil demais um "limpar cena" acabar com o mapa de todos os mestres. */
export function vigiarApagados(): () => void {
  let cena = 0
  const parar = OBR.scene.items.onChange(async (items) => {
    const atuais = new Map<string, string>()
    for (const i of items) {
      const meta = i.metadata[META_CARIMBO] as { id?: string } | undefined
      if (meta?.id) atuais.set(i.id, meta.id)
    }
    const sumiram = [...conhecidos.entries()].filter(([itemId]) => !atuais.has(itemId) && !apagandoNos.delete(itemId))
    conhecidos = atuais
    const doHub = sumiram.filter(([, id]) => id !== 'fundo' && !id.startsWith('foundry:'))
    if (!doHub.length || doHub.length > 3 || !guardado.chave() || !(await mapaLigado())) return
    // Carimbo girado ou trocado no hub some e volta redesenhado — e quem
    // redesenha pode ser OUTRO navegador de mestre na mesma sala, então o
    // `apagandoNos` daqui não sabe. Espera um instante e só apaga no hub o que
    // não voltou.
    const nesta = cena
    await new Promise((r) => setTimeout(r, 1500))
    if (nesta !== cena || !(await OBR.scene.isReady())) return
    const voltaram = new Set(
      (await OBR.scene.items.getItems((i) => META_CARIMBO in i.metadata)).map((i) => (i.metadata[META_CARIMBO] as { id?: string }).id),
    )
    for (const [, id] of doHub) if (!voltaram.has(id)) await mesa('apagarCarimbo', { id }).catch(() => undefined)
  })
  const pararCena = OBR.scene.onReadyChange(async (pronta) => {
    // cena trocada: o que "sumiu" foi a cena, não o carimbo
    cena++
    conhecidos = new Map()
    if (!pronta || !guardado.chave() || (await OBR.player.getRole()) !== 'GM') return
    await sincronizarMapa(true).catch((e) => console.warn('[West Marches] mapa:', e))
  })
  return () => {
    parar()
    pararCena()
  }
}

/** Ponto clicado no Owlbear → chave do hex do hub em que ele cai. Encaixa aqui
 *  mesmo (o servidor também encaixa quando o hub tem a grade fixada). */
export function hexNoPonto(p: Vector2): string | null {
  if (!conv || !cenaAtual) return null
  const h = paraHub(conv, p)
  if (h.x < 0 || h.y < 0 || h.x > cenaAtual.largura || h.y > cenaAtual.altura) return null
  return encaixarNoHex(conv.grade.type, conv.grade.size, { cx: conv.hub.x, cy: conv.hub.y }, h.x, h.y)
}
