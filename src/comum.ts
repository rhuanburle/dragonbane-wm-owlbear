// O que o popover e a página de fundo da extensão dividem: as chaves de
// metadata, o que fica guardado NESTE navegador e a conversa com o hub.
//
// A chave do mestre NUNCA vai para o metadata da sala (todos os jogadores leem
// o metadata). Ela mora só no localStorage do navegador do mestre — popover e
// fundo são da mesma origem e enxergam o mesmo localStorage.

import { PECA_POR_ID } from '../../src/data/mapa/paleta'

export const NS = 'br.dragonbane-wm'
/** Metadata da sala: o resumo da mesa que o fundo do mestre publica. */
export const META_MESA = `${NS}/mesa`
/** Metadata da CENA: esta cena é o mapa da região (o mestre liga no popover).
 *  Na cena e não na sala: as outras cenas (masmorra, cidade) ficam intactas. */
export const META_MAPA_LIGADO = `${NS}/mapa`
/** Metadata de item: carimbo do mapa do hub ({ id, assinatura }). */
export const META_CARIMBO = `${NS}/carimbo`
/** Metadata de token: o herói do hub que ele representa (id). */
export const META_HEROI = `${NS}/heroi`
/** Metadata do rótulo de PV preso ao token. */
export const META_ROTULO = `${NS}/rotulo`
export const FERRAMENTA_ID = `${NS}/carimbo`
export const MODO_ID = `${NS}/carimbar`

/** Hub: produção por padrão; em dev, VITE_HUB_URL / VITE_MESA_URL apontam para
 *  o Vite e o emulador. */
export const HUB = (import.meta.env.VITE_HUB_URL as string | undefined) ?? 'https://dragonbane-west-marches.web.app'
const MESA_URL = (import.meta.env.VITE_MESA_URL as string | undefined) ?? `${HUB}/api/mesa`

const LS = {
  chave: 'wm.chave',
  callId: 'wm.callId',
  ferramenta: 'wm.ferramenta',
  recarregar: 'wm.recarregar',
  mapaStatus: 'wm.mapaStatus',
}

const ler = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const gravar = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    /* sem storage (aba anônima bloqueada): a extensão segue sem lembrar */
  }
}

export const guardado = {
  chave: () => ler(LS.chave),
  setChave: (v: string | null) => gravar(LS.chave, v),
  callId: () => ler(LS.callId),
  setCallId: (v: string | null) => gravar(LS.callId, v),
  ferramenta: (): FerramentaDoMapa | null => {
    try {
      const f = JSON.parse(ler(LS.ferramenta) ?? 'null') as FerramentaDoMapa | null
      // peça que saiu da paleta (a arte mudou): o servidor recusaria cada clique
      return f?.tipo === 'peca' && !PECA_POR_ID[f.id] ? null : f
    } catch {
      return null
    }
  },
  setFerramenta: (f: FerramentaDoMapa | null) => gravar(LS.ferramenta, f ? JSON.stringify(f) : null),
  /** O popover pede ao fundo para buscar agora (sem esperar o próximo ciclo). */
  pedirRecarga: () => gravar(LS.recarregar, String(Date.now())),
  chaveRecarga: LS.recarregar,
  /** O que o fundo conseguiu desenhar do mapa (ou o erro), para o popover mostrar. */
  mapaStatus: () => ler(LS.mapaStatus),
  setMapaStatus: (v: string) => gravar(LS.mapaStatus, v),
  chaveMapaStatus: LS.mapaStatus,
}

export type FerramentaDoMapa =
  | { tipo: 'peca'; id: string; rot: number }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'borracha' }

/** Uma sincronização por vez. Os laços e as recargas pedidas pelo popover se
 *  cruzam: rodando juntas, as duas criariam o mesmo rótulo/carimbo duas vezes.
 *  Chamada durante outra espera ela acabar; várias nesse meio viram UMA (e
 *  `forcar` de qualquer uma delas vale para essa). */
export function umPorVez(fn: (forcar: boolean) => Promise<void>): (forcar?: boolean) => Promise<void> {
  let fila: Promise<void> = Promise.resolve()
  let esperando = false
  let forcar = false
  return (f = false) => {
    forcar ||= f
    if (esperando) return fila
    esperando = true
    fila = fila
      .catch(() => undefined)
      .then(() => {
        esperando = false
        const agora = forcar
        forcar = false
        return fn(agora)
      })
    return fila
  }
}

export class ErroDaMesa extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** Uma ação da API da mesa (functions: mesa). */
export async function mesa<T = Record<string, unknown>>(acao: string, corpo: Record<string, unknown> = {}, chave = guardado.chave()): Promise<T> {
  if (!chave) throw new ErroDaMesa('Cole a sua chave de mestre (Perfil do hub).', 401)
  const r = await fetch(MESA_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-wm-chave': chave },
    body: JSON.stringify({ acao, origem: 'owlbear', ...corpo }),
  })
  const b = (await r.json().catch(() => ({}))) as Record<string, unknown>
  if (!r.ok) throw new ErroDaMesa(String(b.error ?? `O hub respondeu ${r.status}.`), r.status)
  return b as T
}

// ---------------------------------------------------------------- tipos da API

export interface FichaDoHub {
  profession: string
  kin: string
  hp: { value: number; max: number }
  wp: { value: number; max: number }
  conditions?: string[]
  inventory?: { name: string; type: string; qty?: number; damage?: string; durability?: number; worn?: boolean; storage?: boolean }[]
  skills?: { name: string; value: number; marked?: boolean }[]
}

export interface HeroiDaMesa {
  id: string
  nome: string
  img: string | null
  estado: string
  fichaNoHub: boolean
  ficha: FichaDoHub | null
  versao: string
}

/** O que vai para o metadata da sala: o mínimo para a mesa (limite de 16 KB da
 *  sala inteira — nada de inventário completo aqui). */
export interface ResumoDoHeroi {
  id: string
  nome: string
  img: string | null
  pv: [number, number]
  pd: [number, number]
  condicoes: string[]
  armas: { nome: string; dano: string }[]
  armadura: string | null
  marcas: number
  editavel: boolean
}

export interface ResumoDaMesa {
  titulo: string
  callId: string
  herois: ResumoDoHeroi[]
}

export function resumir(h: HeroiDaMesa): ResumoDoHeroi {
  const f = h.ficha
  const inv = (f?.inventory ?? []).filter((i) => !i.storage)
  return {
    id: h.id,
    nome: h.nome,
    img: h.img && h.img.length < 300 ? h.img : null,
    pv: [f?.hp.value ?? 0, f?.hp.max ?? 0],
    pd: [f?.wp.value ?? 0, f?.wp.max ?? 0],
    condicoes: f?.conditions ?? [],
    armas: inv.filter((i) => i.type === 'weapon').slice(0, 4).map((i) => ({ nome: i.name, dano: i.damage ?? '' })),
    armadura: inv.find((i) => i.type === 'armor' && i.worn)?.name ?? null,
    marcas: (f?.skills ?? []).filter((s) => s.marked).length,
    editavel: h.fichaNoHub && h.estado === 'alive',
  }
}
