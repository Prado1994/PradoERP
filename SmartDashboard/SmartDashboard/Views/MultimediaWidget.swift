import SwiftUI

/// Widget Multimídia — o foco principal da tela inicial.
///
/// Renderiza, em tamanho grande, a capa do álbum em reprodução, o nome da faixa
/// em tipografia espessa e botões gigantes de controle (Anterior, Play/Pause,
/// Próxima). Tocar na capa abre a Tela de Reprodução Imersiva. Um seletor
/// permite alternar entre as fontes (Apple Music / Spotify).
struct MultimediaWidget: View {

    @ObservedObject var coordinator: PlaybackCoordinator

    /// Acionado ao tocar na capa, para abrir o modo imersivo.
    var onOpenImmersive: () -> Void

    private var state: NowPlayingState { coordinator.state }

    var body: some View {
        WidgetContainer {
            HStack(spacing: DS.contentSpacing) {

                // Capa do álbum (área de toque para o modo imersivo).
                AlbumArtworkView(image: state.artwork)
                    .aspectRatio(1, contentMode: .fit)
                    .frame(maxHeight: .infinity)
                    .contentShape(Rectangle())
                    .onTapGesture(perform: onOpenImmersive)

                // Seletor de fonte + informações da faixa + controles gigantes.
                VStack(alignment: .leading, spacing: DS.contentSpacing) {

                    SourcePicker(coordinator: coordinator)

                    VStack(alignment: .leading, spacing: 6) {
                        Text(state.title)
                            .font(.system(size: 30, weight: .heavy))
                            .lineLimit(2)
                            .minimumScaleFactor(0.7)

                        if !state.artist.isEmpty {
                            Text(state.artist)
                                .font(.system(size: 20, weight: .semibold))
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }

                    Spacer(minLength: 0)

                    PlaybackControls(coordinator: coordinator)

                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(DS.contentSpacing)
        }
    }
}

/// Alternador compacto entre as fontes de mídia disponíveis.
struct SourcePicker: View {
    @ObservedObject var coordinator: PlaybackCoordinator

    var body: some View {
        Picker("Fonte", selection: Binding(
            get: { coordinator.activeKind },
            set: { coordinator.switchTo($0) }
        )) {
            ForEach(MediaSourceKind.allCases) { kind in
                Text(kind.label).tag(kind)
            }
        }
        .pickerStyle(.segmented)
    }
}

/// Capa do álbum com um espaço reservado de alto contraste quando não há arte.
struct AlbumArtworkView: View {
    let image: UIImage?

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                ZStack {
                    Rectangle().fill(Color(.tertiarySystemBackground))
                    Image(systemName: "music.note")
                        .font(.system(size: 64, weight: .bold))
                        .foregroundStyle(.secondary)
                }
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: DS.controlCornerRadius, style: .continuous))
    }
}

/// Linha de botões gigantes: Anterior, Play/Pause (proeminente) e Próxima.
struct PlaybackControls: View {
    @ObservedObject var coordinator: PlaybackCoordinator

    var body: some View {
        HStack(spacing: DS.contentSpacing) {
            Button {
                coordinator.previous()
            } label: {
                Image(systemName: "backward.fill")
            }
            .buttonStyle(CircularControlButtonStyle(size: DS.secondaryControlSize))
            .accessibilityLabel("Faixa anterior")

            Button {
                coordinator.playPause()
            } label: {
                Image(systemName: coordinator.state.isPlaying ? "pause.fill" : "play.fill")
            }
            .buttonStyle(CircularControlButtonStyle(size: DS.primaryControlSize, isProminent: true))
            .accessibilityLabel(coordinator.state.isPlaying ? "Pausar" : "Reproduzir")

            Button {
                coordinator.next()
            } label: {
                Image(systemName: "forward.fill")
            }
            .buttonStyle(CircularControlButtonStyle(size: DS.secondaryControlSize))
            .accessibilityLabel("Próxima faixa")
        }
        .frame(maxWidth: .infinity)
    }
}
