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

                // Barra de progresso com scrubbing por gesto.
                ScrubBar(music: music)
                    .frame(maxWidth: 560)
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

/// Barra de progresso com scrubbing por gesto.
///
/// Arrastar o dedo sobre a barra ajusta a posição da faixa. Enquanto o dedo
/// está pressionado, a barra mostra a posição "fantasma" para onde o usuário
/// está navegando; ao soltar, aplica o `seek`. Como ocupa sua própria área, o
/// gesto não conflita com o deslize de troca de faixa do restante da tela.
struct ScrubBar: View {

    @ObservedObject var music: MusicPlayerManager

    /// Posição sendo arrastada (0...1); `nil` quando não há arraste em curso.
    @State private var draggingFraction: Double?

    private let barHeight: CGFloat = 10
    private let knobSize: CGFloat = 26

    /// Fração exibida: a do arraste (se houver) ou a real do player.
    private var displayedFraction: Double {
        draggingFraction ?? music.progress
    }

    var body: some View {
        VStack(spacing: 8) {
            GeometryReader { geo in
                let width = geo.size.width
                let filledWidth = width * displayedFraction

                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.primary.opacity(0.2))
                        .frame(height: barHeight)

                    Capsule()
                        .fill(DS.accent)
                        .frame(width: filledWidth, height: barHeight)

                    Circle()
                        .fill(Color.white)
                        .frame(width: knobSize, height: knobSize)
                        .shadow(radius: 3)
                        .offset(x: filledWidth - knobSize / 2)
                        .scaleEffect(draggingFraction != nil ? 1.25 : 1.0)
                        .animation(.spring(response: 0.2, dampingFraction: 0.7),
                                   value: draggingFraction != nil)
                }
                .frame(maxHeight: .infinity)
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            let fraction = min(max(value.location.x / width, 0), 1)
                            draggingFraction = fraction
                        }
                        .onEnded { value in
                            let fraction = min(max(value.location.x / width, 0), 1)
                            music.seek(toFraction: fraction)
                            draggingFraction = nil
                        }
                )
            }
            .frame(height: max(knobSize, 32))

            // Tempo decorrido / restante.
            HStack {
                Text(Self.format(displayedFraction * music.duration))
                Spacer()
                Text("-" + Self.format(music.duration - displayedFraction * music.duration))
            }
            .font(.system(size: 15, weight: .semibold).monospacedDigit())
            .foregroundStyle(.secondary)
        }
    }

    /// Formata segundos como m:ss.
    private static func format(_ seconds: TimeInterval) -> String {
        guard seconds.isFinite, seconds >= 0 else { return "0:00" }
        let total = Int(seconds)
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}

#Preview(traits: .landscapeLeft) {
    ImmersivePlayerView(music: MusicPlayerManager())
}
