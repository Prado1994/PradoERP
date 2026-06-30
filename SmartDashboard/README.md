# SmartDashboard — Central Multimídia Automotiva

Aplicativo iOS nativo (Swift + SwiftUI) que transforma o iPhone, fixado ao
painel do carro em **modo Paisagem**, em uma central multimídia segura e
ultra intuitiva, inspirada na fluidez do Apple CarPlay.

## Foco de design

- Modo Paisagem (Landscape) obrigatório.
- Botões massivos, alto contraste e baixa carga cognitiva para o motorista.
- Tela sempre acesa enquanto o app está aberto.
- Modo Noturno Inteligente (tema escuro automático à noite).

## Telas e recursos implementados (v1)

### 1. Painel Unificado (`ContentView`)
Grade estática em paisagem com dois grandes blocos de cantos arredondados:

- **Widget de Condução** (`DrivingWidget`, ~40% da tela)
  - Velocímetro digital baseado no GPS (`LocationManager`).
  - Relógio atual e botão de **Ajustes**.
  - Atalhos gigantes para **destinos favoritos** que abrem o app de navegação
    preferido (Waze / Google Maps / Apple Maps) **já traçando a rota** (URLs com
    coordenadas), com alternativa via web. Sem destinos, vira um botão que só
    abre o app de navegação.

- **Widget Multimídia** (`MultimediaWidget`, foco principal, ~60% da tela)
  - Conecta-se ao reprodutor do sistema via `MPMusicPlayerController`
    (`MusicPlayerManager`).
  - Capa do álbum em tamanho grande, título em tipografia espessa.
  - Botões gigantes: Anterior, Play/Pause, Próxima.

### 2. Reprodução Imersiva (`ImmersivePlayerView`)
Tela cheia aberta ao tocar na capa, com **controles por gestos**:

- Deslizar para a **direita** → próxima faixa.
- Deslizar para a **esquerda** → faixa anterior.
- **Toque** no centro → pausar/retomar.
- **Barra de progresso** com tempo decorrido/restante e *scrubbing* por gesto
  (arrastar sobre a barra navega na faixa; `seek` via `currentPlaybackTime`).

### 3. Adaptação Dinâmica (`ThemeManager`)
Temas Claro/Escuro de alto contraste. No modo `automatic`, o fundo fica escuro
entre 18h e 6h para não ofuscar o condutor. A preferência é persistida.

### 4. Ajustes (`SettingsView`)
Aberta pelo botão de engrenagem no painel:
- Tema (Sistema / Automático / Claro / Escuro).
- App de navegação preferido (`AppSettings`, persistido).
- CRUD de **destinos favoritos** (`DestinationStore`, persistido em
  `UserDefaults`), com nome, ícone e coordenadas.

## Arquitetura de mídia

As telas não falam diretamente com Apple Music ou Spotify. Elas observam um
único `PlaybackCoordinator`, que expõe um `NowPlayingState` unificado e
encaminha os comandos para a **fonte ativa**:

```
        Views (MultimediaWidget, ImmersivePlayerView)
                        │  observa NowPlayingState
                        ▼
                PlaybackCoordinator  ──switchTo(.appleMusic/.spotify)
                        │ delega
        ┌───────────────┴───────────────┐
   MusicPlayerManager              SpotifyManager
   (MediaSource, real)             (MediaSource, scaffold)
```

Adicionar uma nova fonte = criar um tipo que conforme `MediaSource`. Nenhuma
view precisa mudar.

## Estrutura do projeto

```
SmartDashboard/
├── project.yml                     # Config do XcodeGen (gera o .xcodeproj)
└── SmartDashboard/
    ├── App/SmartDashboardApp.swift # @main + trava de orientação (AppDelegate)
    ├── ContentView.swift           # Painel unificado (grade landscape)
    ├── Managers/
    │   ├── MediaPlayback.swift      # Protocolo MediaSource + PlaybackCoordinator
    │   ├── MusicPlayerManager.swift # Fonte Apple Music (MPMusicPlayerController)
    │   ├── SpotifyManager.swift     # Fonte Spotify (scaffold com TODOs)
    │   └── LocationManager.swift
    ├── Views/
    │   ├── MultimediaWidget.swift
    │   ├── DrivingWidget.swift
    │   └── ImmersivePlayerView.swift
    ├── Theme/
    │   ├── ThemeManager.swift
    │   └── DesignSystem.swift
    ├── Assets.xcassets/
    └── Info.plist
```

## Como abrir e rodar

Requer macOS com **Xcode 16+**. O projeto já está pronto — basta abrir:

```bash
cd SmartDashboard
open SmartDashboard.xcodeproj
```

Depois, escolha o destino e dê **Run (⌘R)**:

- **Simulador de iPhone** (o mais simples para ver a v1): roda sem precisar de
  conta de desenvolvedor. O velocímetro fica em 0 e o player não tem música,
  mas toda a interface, navegação entre telas e gestos funcionam.
- **iPhone físico**: em **Signing & Capabilities**, selecione seu *Team* de
  assinatura. Só no aparelho real o velocímetro (GPS) e o Apple Music funcionam
  de fato.

> O projeto usa *file system synchronized groups* (Xcode 16+): novos arquivos
> `.swift` dentro de `SmartDashboard/` entram no build automaticamente, sem
> mexer no `.xcodeproj`.
>
> Alternativa: há também um `project.yml` para regenerar o projeto com
> [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`xcodegen generate`).

## Limitações conhecidas / próximos passos

- **Spotify:** a fonte já existe como *scaffold* (`SpotifyManager`) e o seletor
  de fonte já aparece na interface, mas os controles ainda são `TODO`. Para
  ativar de verdade:
  1. No [Spotify Developer Dashboard](https://developer.spotify.com/dashboard),
     crie um app, copie o **Client ID**, registre o Redirect URI
     `smartdashboard://spotify-callback` e o Bundle ID do app.
  2. Adicione o **Spotify iOS SDK** (`SpotifyiOS.xcframework`) ao alvo.
  3. Preencha `clientID` em `SpotifyManager.swift` e implemente os trechos
     `TODO` com `SPTSessionManager` (login) e `SPTAppRemote` (controle/estado).
  4. O `Info.plist` já traz o `spotify` em `LSApplicationQueriesSchemes` e o
     `CFBundleURLTypes` com o scheme `smartdashboard` para o callback.
- Selecionar destinos no mapa (em vez de digitar coordenadas) e usar o
  `MapKit`/busca por endereço.
- Ícone do app e identidade visual.

## Dica de uso no carro

Para travar o iPhone dentro do app enquanto dirige, use o **Acesso Guiado**
(Ajustes → Acessibilidade → Acesso Guiado). Com ele ativo, um clique triplo no
botão lateral impede sair do app, abrir notificações ou multitarefa por engano.
