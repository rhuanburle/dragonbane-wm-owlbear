// Página de fundo da extensão: roda o tempo todo com a sala aberta. Só faz algo
// no navegador do MESTRE (é lá que está a chave): busca as fichas e o mapa no hub
// e registra a ferramenta "Carimbo WM". Jogador não fala com o hub — vê o que o
// mestre publica na sala.
import OBR from '@owlbear-rodeo/sdk'
import { FERRAMENTA_ID, META_CARIMBO, META_MAPA_LIGADO, MODO_ID, guardado, mesa } from './comum'
import { sincronizarFichas } from './fichas'
import { hexNoPonto, mapaLigado, sincronizarMapa, vigiarApagados } from './mapa'

const ICONE = `${location.origin}${import.meta.env.BASE_URL}icon.svg`
const FICHAS_MS = 5_000
const MAPA_MS = 10_000

async function souMestre(): Promise<boolean> {
  return (await OBR.player.getRole()) === 'GM'
}

/** Uma volta do laço: falha de rede não para o laço (o próximo ciclo tenta de
 *  novo), e o erro fica no console do mestre. */
async function ciclo(oque: 'fichas' | 'mapa', forcar = false) {
  if (!guardado.chave() || !(await souMestre())) return
  try {
    if (oque === 'fichas') await sincronizarFichas()
    else await sincronizarMapa(forcar)
  } catch (e) {
    console.warn(`[West Marches] ${oque}:`, e)
    if (oque === 'mapa') guardado.setMapaStatus(`Erro ao desenhar o mapa: ${e instanceof Error ? e.message : JSON.stringify(e)}`)
  }
}

async function registrarFerramenta() {
  await OBR.tool.create({
    id: FERRAMENTA_ID,
    icons: [{ icon: ICONE, label: 'Carimbo do West Marches', filter: { roles: ['GM'] } }],
    shortcut: 'W',
    defaultMode: MODO_ID,
  })
  await OBR.tool.createMode({
    id: MODO_ID,
    icons: [{ icon: ICONE, label: 'Carimbar (escolha a peça no popover)', filter: { activeTools: [FERRAMENTA_ID] } }],
    cursors: [{ cursor: 'crosshair' }],
    async onToolClick(_ctx, ev) {
      const f = guardado.ferramenta()
      if (!f || !(await mapaLigado())) {
        await OBR.notification.show('Abra o West Marches, ligue o mapa nesta cena e escolha uma peça.', 'WARNING')
        return
      }
      try {
        if (f.tipo === 'borracha') {
          const meta = ev.target?.metadata?.[META_CARIMBO] as { id?: string } | undefined
          if (!meta?.id || meta.id === 'fundo' || meta.id.startsWith('foundry:')) return
          await mesa('apagarCarimbo', { id: meta.id })
        } else {
          const hexKey = hexNoPonto(ev.pointerPosition)
          if (!hexKey) {
            await OBR.notification.show('Fora do mapa da região — ou o mapa ainda está carregando nesta cena.', 'WARNING')
            return
          }
          await mesa('carimbar', f.tipo === 'peca' ? { hexKey, peca: f.id, rot: f.rot } : { hexKey, texto: f.texto })
        }
        await sincronizarMapa(true)
      } catch (e) {
        await OBR.notification.show(e instanceof Error ? e.message : 'Não deu para carimbar.', 'ERROR')
      }
    },
  })
}

OBR.onReady(async () => {
  await registrarFerramenta()
  vigiarApagados()
  void ciclo('fichas')
  void ciclo('mapa', true)
  setInterval(() => void ciclo('fichas'), FICHAS_MS)
  setInterval(() => void ciclo('mapa'), MAPA_MS)
  // O popover (mesma origem) avisa pelo localStorage: chave nova, chamado
  // trocado, PV mexido — busca na hora em vez de esperar o ciclo.
  window.addEventListener('storage', (e) => {
    if (e.key !== guardado.chaveRecarga) return
    void ciclo('fichas')
    void ciclo('mapa', true)
  })
  // O mestre ligou o mapa nesta cena (popover): desenha já.
  let ligado: unknown
  OBR.scene.onMetadataChange((md) => {
    if (md[META_MAPA_LIGADO] === ligado) return
    ligado = md[META_MAPA_LIGADO]
    if (ligado === true) void ciclo('mapa', true)
  })
})
