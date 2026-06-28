import SwiftUI

/// Tela de Reprodução Multimídia (Modo Imersivo).
///
/// Ocupa a tela inteira e prioriza Controles por Gestos, para que o motorista
/// não precise mirar em botões pequenos:
/// - Deslizar para a DIREITA  -> avança a faixa (próxima).
/// - Deslizar para a ESQUERDA -> volta a faixa (anterior).
/// - Toque simples no meio     -> pausa / retoma a reprodução.
struct ImmersivePlayerView: View {

    @ObservedObject var music: MusicPlayerManager
    @Environment(\.dismiss) private var dismiss

    /// Distância mínima para um deslize ser considerado uma troca de faixa.
    private let swipeThreshold: CGFloat = 60

    /// Feedback visual momentâneo para confirmar o gesto reconhecido.
    @State private var gestureHint: String?

    var body: some View {
        ZStack {
            // Fundo: capa borrada para um visual imersivo de alto contraste.
            backgroundLayer

            VStack(spacing: 28) {
                AlbumArtworkView(image: music.artwork)
                    .aspectRatio(1, contentMode: .fit)
                    .frame(maxHeight: 320)
                    .shadow(radius: 20)

                VStack(spacing: 8) {
                    Text(music.title)
                        .font(.system(size: 34, weight: .heavy))
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                        .minimumScaleFactor(0.7)

                    if !music.artist.isEmpty {
                        Text(music.artist)
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.horizontal, 40)

                Image(systemName: music.isPlaying ? "pause.circle.fill" : "play.circle.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(.secondary)
            }
            .padding(40)

            // Dica visual do gesto reconhecido.
            if let gestureHint {
                Text(gestureHint)
                    .font(.system(size: 26, weight: .bold))
                    .padding(.horizontal, 24)
                    .padding(.vertical, 14)
                    .background(.ultraThinMaterial, in: Capsule())
                    .transition(.opacity.combined(with: .scale))
            }

            // Botão discreto para fechar e voltar ao painel.
            VStack {
                HStack {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "chevron.down")
                            .font(.system(size: 22, weight: .bold))
                            .padding(16)
                            .background(.ultraThinMaterial, in: Circle())
                    }
                    .foregroundStyle(.primary)
                    Spacer()
                }
                Spacer()
            }
            .padding(24)
        }
        // A área inteira responde aos gestos.
        .contentShape(Rectangle())
        .gesture(dragGesture)
        .onTapGesture {
            music.playPause()
            flashHint(music.isPlaying ? "Pausar" : "Reproduzir")
        }
    }

    // MARK: - Camada de fundo

    @ViewBuilder
    private var backgroundLayer: some View {
        if let artwork = music.artwork {
            Image(uiImage: artwork)
                .resizable()
                .scaledToFill()
                .overlay(.black.opacity(0.45))
                .blur(radius: 40)
                .ignoresSafeArea()
        } else {
            DS.background.ignoresSafeArea()
        }
    }

    // MARK: - Gestos

    private var dragGesture: some Gesture {
        DragGesture(minimumDistance: swipeThreshold)
            .onEnded { value in
                let horizontal = value.translation.width
                let vertical = value.translation.height
                // Ignora gestos predominantemente verticais.
                guard abs(horizontal) > abs(vertical) else { return }

                if horizontal > swipeThreshold {
                    music.next()
                    flashHint("Próxima ⏭")
                } else if horizontal < -swipeThreshold {
                    music.previous()
                    flashHint("Anterior ⏮")
                }
            }
    }

    private func flashHint(_ text: String) {
        withAnimation(.easeOut(duration: 0.15)) { gestureHint = text }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            withAnimation(.easeIn(duration: 0.25)) { gestureHint = nil }
        }
    }
}

#Preview(traits: .landscapeLeft) {
    ImmersivePlayerView(music: MusicPlayerManager())
}
