// Telas do popover da extensão. Jogador: vê a mesa (PV, PD, condições, armas) que o mestre
// publica na sala e abre a ficha completa no hub. Mestre: conecta a chave, escolhe
// o chamado da sessão, mexe em PV/PD, vincula tokens e carimba o mapa da região.
import { useEffect, useState } from 'react'
import OBR from '@owlbear-rodeo/sdk'
import { PALETA, arteDaPeca, type PecaDaPaleta } from '../../src/data/mapa/paleta'
import {
  FERRAMENTA_ID,
  HUB,
  META_MAPA_LIGADO,
  guardado,
  mesa,
  type FerramentaDoMapa,
  type ResumoDaMesa,
  type ResumoDoHeroi,
} from './comum'
import { lerResumo, vincularSelecionado } from './fichas'

export const CSS = `
:root { color-scheme: dark; }
body { margin: 0; font: 13px/1.35 system-ui, sans-serif; background: #1d1a16; color: #ece0c4; }
.app { padding: 10px; display: grid; gap: 10px; }
.abas { display: flex; gap: 6px; }
.abas button, .chip { background: #2b2620; color: #ece0c4; border: 1px solid #4a4237; border-radius: 999px; padding: 4px 10px; cursor: pointer; font: inherit; }
.abas button.on, .chip.on { background: #7a2a1e; border-color: #e2664a; }
.card { background: #26221c; border: 1px solid #3b342a; border-radius: 10px; padding: 8px; display: grid; gap: 6px; }
.row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.spacer { flex: 1; }
.muted { color: #a99d86; }
.erro { color: #f0907c; }
input, select { background: #15130f; color: #ece0c4; border: 1px solid #4a4237; border-radius: 6px; padding: 5px 7px; font: inherit; min-width: 0; }
button.btn { background: #3a332a; color: #ece0c4; border: 1px solid #5a5043; border-radius: 6px; padding: 4px 9px; cursor: pointer; font: inherit; }
button.btn:disabled { opacity: .5; cursor: default; }
.barra { display: inline-flex; gap: 4px; align-items: center; background: #15130f; border-radius: 999px; padding: 2px 8px; }
.barra.zero { background: #4a1b14; }
.tag { background: #4a1b14; border-radius: 999px; padding: 1px 7px; font-size: 11px; }
.grade { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.peca { background: #ece0c4; color: #2a2219; border: 2px solid transparent; border-radius: 8px; padding: 3px; cursor: pointer; display: grid; justify-items: center; font-size: 10px; }
.peca.on { border-color: #e2664a; }
.peca img { width: 44px; height: 50px; object-fit: contain; }
a { color: #e2664a; }
`

function Barra({ rotulo, v, onMudar }: { rotulo: string; v: [number, number]; onMudar?: (d: number) => void }) {
  return (
    <span className={`barra ${v[0] <= 0 ? 'zero' : ''}`}>
      {onMudar && (
        <button className="btn" onClick={() => onMudar(-1)} disabled={v[0] <= 0} aria-label={`${rotulo} menos 1`}>
          −
        </button>
      )}
      <b>
        {rotulo} {v[0]}/{v[1]}
      </b>
      {onMudar && (
        <button className="btn" onClick={() => onMudar(1)} disabled={v[0] >= v[1]} aria-label={`${rotulo} mais 1`}>
          +
        </button>
      )}
    </span>
  )
}

function Heroi({ h, mestre, callId, onErro }: { h: ResumoDoHeroi; mestre: boolean; callId: string; onErro: (m: string) => void }) {
  const editar = mestre && h.editavel
  async function mudar(campo: 'pv' | 'pd', d: number) {
    try {
      // A diferença, não o valor: o resumo pode estar segundos atrás do hub.
      await mesa('pvpd', { callId, charId: h.id, [`d${campo}`]: d })
      guardado.pedirRecarga()
    } catch (e) {
      onErro(e instanceof Error ? e.message : 'Não deu.')
    }
  }
  return (
    <div className="card">
      <div className="row">
        <b>{h.nome}</b>
        <span className="spacer" />
        <a href={`${HUB}/personagens/${h.id}`} target="_blank" rel="noreferrer">
          ficha no hub ↗
        </a>
      </div>
      <div className="row">
        <Barra rotulo="PV" v={h.pv} onMudar={editar ? (d) => void mudar('pv', d) : undefined} />
        <Barra rotulo="PD" v={h.pd} onMudar={editar ? (d) => void mudar('pd', d) : undefined} />
        {h.marcas > 0 && <span className="muted">✦ {h.marcas}</span>}
      </div>
      {h.condicoes.length > 0 && (
        <div className="row">
          {h.condicoes.map((c) => (
            <span className="tag" key={c}>
              {c}
            </span>
          ))}
        </div>
      )}
      {(h.armas.length > 0 || h.armadura) && (
        <div className="muted">
          {h.armas.map((a) => `${a.nome}${a.dano ? ` (${a.dano})` : ''}`).join(' · ')}
          {h.armadura ? `${h.armas.length ? ' · ' : ''}🛡 ${h.armadura}` : ''}
        </div>
      )}
      {mestre && (
        <div className="row">
          <button
            className="btn"
            onClick={async () => {
              const n = await vincularSelecionado(h.id)
              await OBR.notification.show(n ? `${h.nome} vinculado ao token.` : 'Selecione o token no mapa antes.', n ? 'SUCCESS' : 'WARNING')
              guardado.pedirRecarga()
            }}
          >
            Vincular ao token selecionado
          </button>
        </div>
      )}
    </div>
  )
}

function Conexao({ onPronto }: { onPronto: () => void }) {
  const [chave, setChave] = useState(guardado.chave() ?? '')
  const [chamados, setChamados] = useState<{ id: string; titulo: string; meu: boolean }[] | null>(null)
  const [callId, setCallId] = useState(guardado.callId() ?? '')
  const [erro, setErro] = useState('')
  const [nome, setNome] = useState('')

  async function conectar(k = chave) {
    setErro('')
    try {
      const r = await mesa<{ mestre: { nome: string }; chamados: { id: string; titulo: string; meu: boolean }[] }>('quemSou', {}, k.trim())
      guardado.setChave(k.trim())
      setNome(r.mestre.nome)
      setChamados(r.chamados)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não conectou.')
    }
  }
  useEffect(() => {
    if (guardado.chave()) void conectar(guardado.chave()!)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="card">
      <b>Conexão com o hub</b>
      {nome ? (
        <span className="muted">Conectado como {nome}. A chave fica só neste navegador.</span>
      ) : (
        <span className="muted">
          Cole a sua chave de mestre (Perfil do hub → “Sua mesa no VTT”). Ela fica só neste navegador, os jogadores não a
          veem.
        </span>
      )}
      <div className="row">
        <input type="password" placeholder="wm_…" value={chave} onChange={(e) => setChave(e.target.value)} style={{ flex: 1 }} />
        <button className="btn" onClick={() => void conectar()}>
          Conectar
        </button>
      </div>
      {chamados && (
        <div className="row">
          <select
            value={callId}
            onChange={(e) => {
              setCallId(e.target.value)
              guardado.setCallId(e.target.value || null)
              guardado.pedirRecarga()
              onPronto()
            }}
            style={{ flex: 1 }}
          >
            <option value="">— escolha a missão desta sessão —</option>
            {chamados.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
                {c.meu ? '' : ' (de outro mestre)'}
              </option>
            ))}
          </select>
        </div>
      )}
      {chamados && !chamados.length && <span className="muted">Nenhuma missão confirmada sua agora.</span>}
      {erro && <span className="erro">{erro}</span>}
    </div>
  )
}

function Paleta() {
  const [cenaPronta, setCenaPronta] = useState(false)
  const [ligado, setLigado] = useState(false)
  const [aba, setAba] = useState<PecaDaPaleta['camada'] | 'texto'>('terreno')
  const [rot, setRot] = useState(0)
  const [texto, setTexto] = useState('')
  const [ferr, setFerr] = useState<FerramentaDoMapa | null>(guardado.ferramenta())

  useEffect(() => {
    let pararMeta = () => {}
    const ler = async (pronta: boolean) => {
      pararMeta()
      pararMeta = () => {}
      setCenaPronta(pronta)
      if (!pronta) return setLigado(false)
      setLigado((await OBR.scene.getMetadata())[META_MAPA_LIGADO] === true)
      pararMeta = OBR.scene.onMetadataChange((md) => setLigado(md[META_MAPA_LIGADO] === true))
    }
    void OBR.scene.isReady().then(ler)
    const parar = OBR.scene.onReadyChange((p) => void ler(p))
    return () => {
      parar()
      pararMeta()
    }
  }, [])

  async function escolher(f: FerramentaDoMapa | null) {
    setFerr(f)
    guardado.setFerramenta(f)
    if (f) await OBR.tool.activateTool(FERRAMENTA_ID)
  }

  if (!cenaPronta)
    return (
      <div className="card">
        <b>Mapa da região</b>
        <span className="muted">Abra uma cena para usar o mapa da região.</span>
      </div>
    )

  if (!ligado)
    return (
      <div className="card">
        <b>Mapa da região</b>
        <span className="muted">
          Use uma cena só para o mapa: ao ligar, a grade dela vira hex e os carimbos do hub aparecem. O que você carimbar
          aqui vale para todos os mestres.
        </span>
        <button className="btn" onClick={() => void OBR.scene.setMetadata({ [META_MAPA_LIGADO]: true })}>
          Usar esta cena como mapa da região
        </button>
      </div>
    )

  return (
    <div className="card">
      <div className="row">
        <b>Carimbar</b>
        <span className="spacer" />
        <button className={`chip ${ferr?.tipo === 'borracha' ? 'on' : ''}`} onClick={() => void escolher(ferr?.tipo === 'borracha' ? null : { tipo: 'borracha' })}>
          🧽 Borracha
        </button>
      </div>
      <div className="abas">
        {(['terreno', 'caminho', 'marco', 'texto'] as const).map((a) => (
          <button key={a} className={aba === a ? 'on' : ''} onClick={() => setAba(a)}>
            {{ terreno: 'Terreno', caminho: 'Estrada/rio', marco: 'Marcos', texto: 'Texto' }[a]}
          </button>
        ))}
      </div>
      {aba === 'texto' ? (
        <div className="row">
          <input placeholder="Nome no mapa" value={texto} maxLength={80} onChange={(e) => setTexto(e.target.value)} style={{ flex: 1 }} />
          <button className="btn" disabled={!texto.trim()} onClick={() => void escolher({ tipo: 'texto', texto: texto.trim() })}>
            Usar
          </button>
        </div>
      ) : (
        <div className="grade">
          {PALETA.filter((p) => p.camada === aba).map((p) => {
            const on = ferr?.tipo === 'peca' && ferr.id === p.id
            return (
              <button key={p.id} className={`peca ${on ? 'on' : ''}`} title={p.nome} onClick={() => void escolher(on ? null : { tipo: 'peca', id: p.id, rot })}>
                <img src={`${HUB}${arteDaPeca(p.id)}`} alt="" style={{ transform: rot ? `rotate(${rot}deg)` : undefined }} />
                {p.nome}
              </button>
            )
          })}
        </div>
      )}
      <div className="row">
        <span className="muted">Girar</span>
        {[-60, 60].map((d) => (
          <button
            key={d}
            className="btn"
            onClick={() => {
              const r = (rot + d + 360) % 360
              setRot(r)
              if (ferr?.tipo === 'peca') void escolher({ ...ferr, rot: r })
            }}
          >
            {d < 0 ? '⟲' : '⟳'}
          </button>
        ))}
        <span>{rot}°</span>
      </div>
      <span className="muted">
        {ferr
          ? 'Ferramenta “Carimbo do West Marches” ativa: clique nos hexes. Para apagar, use a borracha ou selecione o carimbo e aperte Delete.'
          : 'Escolha uma peça.'}
      </span>
      <button className="btn" onClick={() => void OBR.scene.setMetadata({ [META_MAPA_LIGADO]: false })}>
        Desligar o mapa nesta cena
      </button>
    </div>
  )
}

export default function App() {
  const [pronto, setPronto] = useState(false)
  const [mestre, setMestre] = useState(false)
  const [resumo, setResumo] = useState<ResumoDaMesa | null>(null)
  const [aba, setAba] = useState<'mesa' | 'mapa' | 'conexao'>('mesa')
  const [erro, setErro] = useState('')

  useEffect(() => {
    OBR.onReady(async () => {
      setMestre((await OBR.player.getRole()) === 'GM')
      setResumo(lerResumo(await OBR.room.getMetadata()))
      OBR.room.onMetadataChange((md) => setResumo(lerResumo(md)))
      OBR.player.onChange((p) => setMestre(p.role === 'GM'))
      setPronto(true)
      if ((await OBR.player.getRole()) === 'GM' && !guardado.chave()) setAba('conexao')
    })
  }, [])

  if (!pronto) return <div className="app muted">Carregando…</div>
  return (
    <div className="app">
      {mestre && (
        <div className="abas">
          {(['mesa', 'mapa', 'conexao'] as const).map((a) => (
            <button key={a} className={aba === a ? 'on' : ''} onClick={() => setAba(a)}>
              {{ mesa: 'Mesa', mapa: 'Mapa', conexao: 'Conexão' }[a]}
            </button>
          ))}
        </div>
      )}
      {mestre && aba === 'conexao' && <Conexao onPronto={() => setAba('mesa')} />}
      {mestre && aba === 'mapa' && <Paleta />}
      {aba === 'mesa' &&
        (resumo ? (
          <>
            <b>{resumo.titulo}</b>
            {erro && <span className="erro">{erro}</span>}
            {resumo.herois.map((h) => (
              <Heroi key={h.id} h={h} mestre={mestre} callId={resumo.callId} onErro={setErro} />
            ))}
            {!resumo.herois.length && <span className="muted">Nenhum herói confirmado nesta missão.</span>}
          </>
        ) : (
          <span className="muted">
            {mestre ? 'Conecte a chave e escolha a missão (aba Conexão).' : 'O mestre ainda não abriu a mesa do West Marches nesta sala.'}
          </span>
        ))}
    </div>
  )
}

