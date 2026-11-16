# Minha Agenda 💗

App de agenda e lembretes feito para o iPhone. É um **PWA**: um site que se instala na Tela de Início e abre como um app de verdade, sem App Store.

## O que tem

- Calendário mensal (deslize para o lado para trocar de mês)
- Agenda do dia ao tocar em qualquer data
- Lembretes com hora, aviso antes e marcação de "feito"
- Repetição: todo dia, semana, mês ou ano
- Categorias coloridas (Pessoal, Trabalho, Saúde, Estudos, Casa, Outros)
- Funciona offline e respeita o modo escuro do iPhone
- Backup (exportar/importar) em Ajustes ⚙︎

Os dados ficam salvos **no próprio aparelho** (localStorage). Nada vai para servidor.

## Estrutura

```
agenda-lembretes/
├── index.html            tela principal
├── styles.css            visual
├── logic.js              regras (repetição, avisos, .ics), sem DOM
├── app.js                interface e eventos
├── sw.js                 service worker (offline)
├── manifest.webmanifest  dados de instalação do PWA
├── icons/                ícones do app
└── .vscode/              configuração do VS Code
```

## Rodar no VS Code (computador)

1. Abra a pasta `agenda-lembretes` no VS Code (**File → Open Folder**).
2. Instale a extensão **Live Server** (Ritwick Dey).
3. Clique com o botão direito em `index.html` → **Open with Live Server**.
4. Abre em `http://127.0.0.1:5500`. O service worker funciona em `localhost`.

Sem extensão, também dá pelo terminal do VS Code:

```bash
python3 -m http.server 5500
```

## Colocar no iPhone

O iPhone só instala PWA por **HTTPS**, então o app precisa estar publicado em algum lugar. O jeito mais simples e gratuito é o **GitHub Pages**:

1. Crie um repositório no GitHub e envie os arquivos desta pasta.
2. No repositório: **Settings → Pages → Deploy from a branch → main / (root)**.
3. Aguarde 1–2 minutos. O endereço será `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

Alternativas: Netlify Drop (arraste a pasta em app.netlify.com/drop) ou Cloudflare Pages.

Depois, **no iPhone, pelo Safari**:

1. Abra o endereço do app.
2. Toque em **Compartilhar** (quadrado com seta) → **Adicionar à Tela de Início**.
3. Abra pelo ícone novo. Pronto.

## Sobre as notificações (importante)

O iOS limita o que um PWA pode fazer:

| Situação | Funciona? |
|---|---|
| App aberto na tela | Sim, aparece um aviso rosa no topo e uma notificação do sistema (se ativada) |
| App em segundo plano ou fechado | **Não** pelo app, porque isso exigiria um servidor de push |

**Para ser avisada com o app fechado**, abra o compromisso e toque em **📅 Adicionar ao Calendário do iPhone**. Isso gera um arquivo `.ics` com alarme e repetição. Ao abrir, o Calendário nativo do iPhone assume e avisa no horário, com o app fechado. Se o download não funcionar dentro do app instalado, faça esse passo pelo Safari normal.

Para ativar as notificações do app: **Ajustes ⚙︎ → Ativar notificações** (só aparece depois de instalar na Tela de Início, iOS 16.4 ou mais novo).

## Atualizar o app depois de publicar

Ao mudar qualquer arquivo, aumente o número em `sw.js`:

```js
const CACHE = 'agenda-v2';
```

Sem isso, o iPhone pode continuar mostrando a versão antiga guardada em cache.

## Ideias para evoluir

- Notificações reais com app fechado (precisa de backend + Web Push)
- Sincronizar entre aparelhos (Firebase/Supabase)
- Compromissos com duração e cor personalizada
- Lista de tarefas separada da agenda
