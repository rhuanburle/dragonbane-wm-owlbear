# Dragonbane West Marches — extensão do Owlbear Rodeo

Extensão para o mestre da campanha **Dragonbane West Marches** jogar no **Owlbear Rodeo**.

- A **mesa mostra os heróis da missão**, com PV, PD, condições, armas e armadura vindos do hub. Todo mundo na sala vê.
- O **mestre mexe em PV e PD** na mesa, e a mudança vale na ficha oficial do hub.
- Token vinculado a um herói ganha um **rótulo com PV e PD** que se atualiza sozinho.
- O **mapa da região** é o mesmo de todos os mestres. O que você carimbar aqui aparece no hub, no Foundry dos outros mestres e nas outras salas.

> Joga no Foundry? Veja o [módulo do Foundry](https://github.com/rhuanburle/dragonbane-wm-foundry).

---

## Antes de começar

| Você precisa de | Observação |
|---|---|
| Conta no [Owlbear Rodeo](https://www.owlbear.rodeo) | A sua; a sala é sua. |
| Conta de **mestre** no hub | <https://dragonbane-west-marches.web.app> |
| Uma **missão confirmada** sua no hub | É dela que vêm os heróis da mesa. |

Só o **mestre** instala e conecta. Os jogadores entram na sala e veem a mesa sem fazer nada.

---

## Instalação (uma vez)

1. No Owlbear, abra o seu **perfil** (canto superior direito) → **Extensions** → **Add Extension** (o **+**).
2. Cole o endereço:

   ```
   https://dragonbane-west-marches.web.app/owlbear/manifest.json
   ```

3. Confirme. A extensão **Dragonbane West Marches** aparece na sua lista.
4. Dentro da **sala** do jogo, abra o menu de extensões da sala e **ative** a Dragonbane West Marches. O ícone dela aparece no topo à esquerda.

---

## Conectar com o hub

1. No hub, abra o **Perfil** e procure o cartão **"Sua mesa no VTT"**.
2. Clique para **gerar a chave**. Ela aparece **uma vez só**; copie na hora. Se perder, gere outra (a antiga deixa de valer).
3. No Owlbear, clique no ícone da extensão → aba **Conexão**.
4. Cole a chave, conecte e escolha a **missão** da sessão.

A chave fica guardada **só no seu navegador**. Ela nunca vai para a sala, que os jogadores também leem. Em outro computador, cole de novo.

---

## Jogar uma missão

- **Aba Mesa:** os heróis da missão, com PV, PD, condições, armas e armadura. O mestre usa **−** e **+** para mudar PV e PD; isso grava no hub.
- **Vincular token:** selecione o token do herói no mapa e clique em **"Vincular ao token selecionado"** no cartão dele. O token ganha o rótulo de PV e PD.
- **Os jogadores** abrem a mesma extensão e veem a mesa, sem editar. Eles mexem na própria ficha **pelo hub**, que fica aberto durante o jogo (condições, itens, equipar). O que mudam lá aparece aqui em alguns segundos.
- **Testes e rolagens** ficam com os dados do Owlbear ou os físicos. A extensão não rola nada.

---

## Mapa da região

1. Crie (ou abra) uma **cena só para o mapa**.
2. No ícone da extensão → aba **Mapa** → **"Usar esta cena como mapa da região"**. A grade vira hex e os carimbos do hub aparecem.
3. Para carimbar: escolha uma peça (terreno, caminho, marco ou texto) na aba Mapa. Depois use a ferramenta **"Carimbo do West Marches"** na barra da esquerda (atalho **W**) e clique nos hexes.
   - **⟲ ⟳** giram a peça (estradas e rios).
   - **🧽 Borracha**: clique no carimbo para apagar.
   - Selecionar um carimbo e apertar **Delete** também apaga.
4. O que você carimbar ou apagar vale **para todos os mestres**, no hub e nos outros VTTs.

O mapa só é ligado na cena que você escolher; as outras cenas (masmorra, cidade…) ficam intactas. **"Desligar o mapa nesta cena"** desfaz. Apagar **muitos carimbos de uma vez** (limpar a cena) **não** apaga nada no hub. É uma proteção para o mapa de todos.

---

## Perguntas frequentes

**Os jogadores veem "O mestre ainda não abriu a mesa".**
O navegador do mestre é quem busca as fichas no hub. O mestre precisa estar na sala, com a extensão conectada e a missão escolhida.

**Os heróis não aparecem.**
Confira se a missão está **confirmada** no hub e se é a missão escolhida na aba Conexão.

**O + e o − não mexem no PV de um herói.**
Herói caído, ou cuja ficha ainda não passou para o hub, não aceita PV/PD pela mesa. Ajuste pelo hub.

**Perdi ou vazou a chave.**
Gere outra no Perfil do hub. A antiga para de funcionar na hora.

---

## Código

`src/` é o código-fonte da extensão (React + [Owlbear Rodeo SDK](https://docs.owlbear.rodeo/)). Ela é construída e hospedada junto com o hub, que reaproveita a paleta e a geometria do mapa. Problemas e sugestões: abra uma *issue* aqui.
