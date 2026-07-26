# SouCrum v6.1 — app ligado ao Supabase

App de **gestão de projetos, foco e rotinas**, construído em cima do modelo de
dados real do v6.1 (`njlnvcrcoebbednfrzhr`).

Não confundir com `../SouCrum/`, que é protótipo visual com dados fictícios.

## Publicar (eu não consegui daqui)

A integração Vercel desta sessão respondeu **403 — "You don't have permission to
create a project"**, então o deploy tem que sair da sua conta. Duas formas, as
duas criando projeto **novo**, sem tocar em `soucrum`:

**Pelo painel** (mais simples)

1. vercel.com → Add New → Project → importar `Prado1994/PradoERP`
2. Branch: `claude/scrum-update-fmrmf3`
3. **Root Directory: `soucrum-v61`** ← o passo que não pode faltar
4. Framework: Vite (detecta sozinho). Deploy.

**Pelo CLI** (o fluxo que você já usa)

```bash
git clone -b claude/scrum-update-fmrmf3 <repo> && cd PradoERP/soucrum-v61
npm install && vercel deploy --prod
```

Aceite criar um projeto novo quando ele perguntar — não reaproveite `soucrum`.

## Depois de publicar: dois passos no Supabase

Sem eles ninguém entra. São no painel, não dá para fazer por SQL.

1. **Authentication → URL Configuration**: pôr a URL da Vercel em *Site URL* e em
   *Redirect URLs*. A tela de login mostra a URL exata que ela precisa.
2. **Authentication → Providers → Google**: ligar com o **mesmo Client ID e
   Secret** do projeto antigo. Sem isso, 6 dos 9 usuários não têm como entrar —
   nenhuma senha foi migrada.
   No Google Cloud Console, incluir também
   `https://njlnvcrcoebbednfrzhr.supabase.co/auth/v1/callback` nas URIs de
   redirecionamento autorizadas.

O login por **link de e-mail** funciona sem o passo 2 e serve para testar antes,
inclusive para quem só tem identidade Google — o Supabase casa pelo e-mail.
O SMTP do plano gratuito é limitado a poucos envios por hora.

## Rodar local

```bash
npm install
npm run dev        # http://localhost:5173
npm run build
```

Para apontar em outro projeto Supabase, sem editar código:

```bash
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run dev
```

## Telas

| Tela | O que mostra |
|---|---|
| **Hoje** | Atrasadas, rotinas do dia, agenda e o que já fechou hoje |
| **Quadro** | Quatro colunas do fluxo real, com filtro por projeto |
| **Rotinas** | Agrupadas por recorrência, com “concluir hoje” |
| **Projetos** | Contagem, atrasados, workspace, prazo e progresso do checklist |
| **Páginas** | `pages`, com conteúdo |
| **Foco** | Pomodoro de 25 min que credita em `pom_done` ao terminar |

## Decisões que não devem ser desfeitas

**Não existe status `done`.** O fluxo é `jot → extracted → refined → scheduled`,
texto livre no banco. Conclusão de rotina se registra em `last_done`; progresso
de tarefa comum vive no checklist. Criar um status `done` sujaria os dados do app
real.

**`hoje()` usa data local, não UTC.** `toISOString()` daria o dia errado à noite
no Brasil (UTC−3) e marcaria tarefa de hoje como atrasada.

**Atrasada exige `last_done !== hoje`.** Sem essa metade, rotina diária com prazo
antigo ficaria atrasada para sempre, mesmo fechada hoje.

**Nenhuma query filtra por `owner_id`.** A RLS já entrega o próprio material mais
o dos workspaces que a pessoa integra; filtrar no cliente esconderia o trabalho
compartilhado.

As três primeiras estão em `src/domain.ts`, juntas, porque erram silenciosamente.

## Verificado

- `npm run build` limpo (`tsc -b` no estrito, sem variável nem parâmetro sobrando)
- Renderizado em Chromium headless: tela de login sobe sem erro de código
- Não testei o fluxo logado ponta a ponta: o proxy deste ambiente bloqueia
  `*.supabase.co`, então nenhuma chamada real de dados saiu daqui. As queries
  seguem o esquema conferido no banco, mas o primeiro login de verdade é o teste
  que falta.
