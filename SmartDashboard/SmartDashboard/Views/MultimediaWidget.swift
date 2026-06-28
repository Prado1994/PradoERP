import SwiftUI

/// Widget Multimídia — o foco principal da tela inicial.
///
/// Renderiza, em tamanho grande, a capa do álbum em reprodução, o nome da faixa
/// em tipografia espessa e botões gigantes de controle (Anterior, Play/Pause,
/// Próxima). Tocar em qualquer área da capa abre a Tela de Reprodução Imersiva.
struct MultimediaWidget: View {

    @ObservedObject var music: MusicPlayerManager

    /// Acionado ao tocar na capa, para abrir o modo imersivo.
    var onOpenImmersive: () -> Void

    var body: some View {
        WidgetContainer {
            HStack(spacing: DS.contentSpacing) {

                // Capa do álbum (área de toque para o modo imersivo).
                AlbumArtworkView(image: music.artwork)
                    .aspectRatio(1, contentMode: .fit)
                    .frame(maxHeight: .infinity)
                    .contentShape(Rectangle())
                    .onTapGesture(perform: onOpenImmersive)

                // Informações da faixa + controles gigantes.
                VStack(alignment: .leading, spacing: DS.contentSpacing) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(music.title)
                            .font(.system(size: 30, weight: .heavy))
                            .lineLimit(2)
                            .minimumScaleFactor(0.7)

                        if !music.artist.isEmpty {
                            Text(music.artist)
                                .font(.system(size: 20, weight: .semibold))
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }

                    Spacer(minLength: 0)

                    PlaybackControls(music: music)

                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(DS.contentSpacing)
        }
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
    @ObservedObject var music: MusicPlayerManager

    var body: some View {
        HStack(spacing: DS.contentSpacing) {
            Button {
                music.previous()
            } label: {
                Image(systemName: "backward.fill")
            }
            .buttonStyle(CircularControlButtonStyle(size: DS.secondaryControlSize))
            .accessibilityLabel("Faixa anterior")

            Button {
                music.playPause()
            } label: {
                Image(systemName: music.isPlaying ? "pause.fill" : "play.fill")
            }
            .buttonStyle(CircularControlButtonStyle(size: DS.primaryControlSize, isProminent: true))
            .accessibilityLabel(music.isPlaying ? "Pausar" : "Reproduzir")

            Button {
                music.next()
            } label: {
                Image(systemName: "forward.fill")
            }
            .buttonStyle(CircularControlButtonStyle(size: DS.secondaryControlSize))
            .accessibilityLabel("Próxima faixa")
        }
        .frame(maxWidth: .infinity)
    }
}
