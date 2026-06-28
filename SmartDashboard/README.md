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
  - Relógio atual.
  - Atalhos gigantes para **Waze** e **Google Maps** via URL Schemes
    (`waze://`, `comgooglemaps://`), com alternativa via web.

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
entre 18h e 6h para não ofuscar o condutor.

## Estrutura do projeto

```
SmartDashboard/
├── project.yml                     # Config do XcodeGen (gera o .xcodeproj)
└── SmartDashboard/
    ├── App/SmartDashboardApp.swift # @main + trava de orientação (AppDelegate)
    ├── ContentView.swift           # Painel unificado (grade landscape)
    ├── Managers/
    │   ├── MusicPlayerManager.swift
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

Requer macOS com Xcode 15+ e um iPhone (recomendado: iOS 16+).

O `.xcodeproj` não é versionado — gere-o com [XcodeGen](https://github.com/yonaskolb/XcodeGen):

```bash
brew install xcodegen
cd SmartDashboard
xcodegen generate
open SmartDashboard.xcodeproj
```

No Xcode, selecione seu *Team* de assinatura em **Signing & Capabilities** e
rode em um dispositivo físico (o velocímetro e o player do sistema dependem de
hardware real).

> Sem o XcodeGen, você pode criar um App iOS em branco no Xcode e arrastar a
> pasta `SmartDashboard/` para o projeto, garantindo o `Info.plist` indicado.

## Limitações conhecidas / próximos passos

- **Spotify:** o `MPMusicPlayerController` controla apenas o reprodutor do
  sistema (Apple Music / biblioteca local). Ler a faixa atual do Spotify exige
  o SDK próprio do Spotify e será avaliado em uma próxima iteração.
- Traçar rota automaticamente no Waze/Maps a partir de um destino fixo
  (parâmetros de coordenadas nas URLs).
- Tela de ajustes para escolher manualmente o tema e os destinos favoritos.

## Dica de uso no carro

Para travar o iPhone dentro do app enquanto dirige, use o **Acesso Guiado**
(Ajustes → Acessibilidade → Acesso Guiado). Com ele ativo, um clique triplo no
botão lateral impede sair do app, abrir notificações ou multitarefa por engano.
