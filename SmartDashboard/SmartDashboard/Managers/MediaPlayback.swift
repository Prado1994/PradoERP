import SwiftUI

/// Fontes de mídia suportadas pela central.
enum MediaSourceKind: String, CaseIterable, Identifiable {
    case appleMusic
    case spotify

    var id: String { rawValue }

    var label: String {
        switch self {
        case .appleMusic: return "Apple Music"
        case .spotify:    return "Spotify"
        }
    }
}

/// Estado unificado de "tocando agora", independente da fonte. É o que a
/// interface consome — assim as telas não sabem (nem precisam saber) se a
/// música vem do Apple Music ou do Spotify.
struct NowPlayingState {
    var title: String = "Nada tocando"
    var artist: String = ""
    var artwork: UIImage?
    var isPlaying: Bool = false
    var elapsedTime: TimeInterval = 0
    var duration: TimeInterval = 0

    /// Fração de progresso (0...1), conveniente para a barra de progresso.
    var progress: Double {
        guard duration > 0 else { return 0 }
        return min(max(elapsedTime / duration, 0), 1)
    }
}

/// Contrato comum a qualquer fonte de mídia. Cada implementação (Apple Music,
/// Spotify, ...) reporta seu estado pelo callback `onStateChange` e responde
/// aos comandos de transporte.
@MainActor
protocol MediaSource: AnyObject {
    var kind: MediaSourceKind { get }

    /// Chamado pela fonte sempre que algo muda (faixa, play/pause, posição).
    var onStateChange: ((NowPlayingState) -> Void)? { get set }

    /// Começa a observar/conectar a fonte.
    func activate()
    /// Para de observar/desconecta a fonte.
    func deactivate()
    /// Solicita as permissões necessárias para a fonte.
    func requestAuthorization()

    func playPause()
    func next()
    func previous()
    func seek(toFraction fraction: Double)
}

/// Orquestra as fontes de mídia e expõe um único `NowPlayingState` observável
/// para a interface. Permite trocar de fonte (Apple Music ↔ Spotify) em tempo
/// de execução sem que as telas precisem mudar.
@MainActor
final class PlaybackCoordinator: ObservableObject {

    @Published private(set) var state = NowPlayingState()
    @Published private(set) var activeKind: MediaSourceKind

    private var sources: [MediaSourceKind: MediaSource]
    private var current: MediaSource

    init(default kind: MediaSourceKind = .appleMusic) {
        let apple = MusicPlayerManager()
        let spotify = SpotifyManager()
        sources = [.appleMusic: apple, .spotify: spotify]

        activeKind = kind
        current = sources[kind] ?? apple

        bind(current)
        current.activate()
        current.requestAuthorization()
    }

    /// Troca a fonte ativa, desligando a anterior e ligando a nova.
    func switchTo(_ kind: MediaSourceKind) {
        guard kind != activeKind, let next = sources[kind] else { return }

        current.deactivate()
        current.onStateChange = nil

        activeKind = kind
        current = next
        bind(current)
        current.activate()
        current.requestAuthorization()
    }

    private func bind(_ source: MediaSource) {
        source.onStateChange = { [weak self] newState in
            Task { @MainActor in self?.state = newState }
        }
    }

    // MARK: - Encaminhamento dos controles

    func playPause()                      { current.playPause() }
    func next()                           { current.next() }
    func previous()                       { current.previous() }
    func seek(toFraction fraction: Double) { current.seek(toFraction: fraction) }
}
