import Foundation
import MediaPlayer
import Combine

/// Conecta a interface ao reprodutor de mídia do sistema através do
/// `MPMusicPlayerController`.
///
/// Importante: o `systemMusicPlayer` controla o reprodutor do sistema (Apple
/// Music / biblioteca local). Aplicativos de terceiros como o Spotify NÃO
/// expõem sua faixa atual via APIs públicas — para esses casos a integração
/// futura precisaria de SDKs específicos. Esta primeira versão foca no Apple
/// Music, conforme o requisito principal.
@MainActor
final class MusicPlayerManager: ObservableObject {

    private let player = MPMusicPlayerController.systemMusicPlayer

    @Published var title: String = "Nada tocando"
    @Published var artist: String = ""
    @Published var artwork: UIImage?
    @Published var isPlaying: Bool = false
    /// Status de autorização para acessar a biblioteca de mídia.
    @Published var isAuthorized: Bool = false

    init() {
        configureObservers()
        refreshNowPlaying()
        refreshPlaybackState()
        // Reflete imediatamente um estado de autorização já concedido.
        isAuthorized = MPMediaLibrary.authorizationStatus() == .authorized
    }

    // MARK: - Autorização

    /// Solicita acesso à biblioteca de mídia. Deve ser chamado quando a tela
    /// principal aparece.
    func requestAuthorization() {
        MPMediaLibrary.requestAuthorization { [weak self] status in
            Task { @MainActor in
                guard let self else { return }
                self.isAuthorized = (status == .authorized)
                self.refreshNowPlaying()
                self.refreshPlaybackState()
            }
        }
    }

    // MARK: - Controles de reprodução

    func playPause() {
        if isPlaying {
            player.pause()
        } else {
            player.play()
        }
    }

    func next() {
        player.skipToNextItem()
    }

    func previous() {
        // Comportamento "duplo": volta ao início da faixa; se já no início,
        // o sistema avança para a faixa anterior na próxima chamada.
        player.skipToPreviousItem()
    }

    // MARK: - Observação de notificações

    private func configureObservers() {
        player.beginGeneratingPlaybackNotifications()

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleNowPlayingChanged),
            name: .MPMusicPlayerControllerNowPlayingItemDidChange,
            object: player
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handlePlaybackStateChanged),
            name: .MPMusicPlayerControllerPlaybackStateDidChange,
            object: player
        )
    }

    @objc private func handleNowPlayingChanged() {
        Task { @MainActor in refreshNowPlaying() }
    }

    @objc private func handlePlaybackStateChanged() {
        Task { @MainActor in refreshPlaybackState() }
    }

    // MARK: - Atualização de estado

    private func refreshNowPlaying() {
        guard let item = player.nowPlayingItem else {
            title = "Nada tocando"
            artist = ""
            artwork = nil
            return
        }

        title = item.title ?? "Faixa desconhecida"
        artist = item.artist ?? ""

        if let artworkRef = item.artwork {
            artwork = artworkRef.image(at: CGSize(width: 600, height: 600))
        } else {
            artwork = nil
        }
    }

    private func refreshPlaybackState() {
        isPlaying = player.playbackState == .playing
    }

    deinit {
        player.endGeneratingPlaybackNotifications()
        NotificationCenter.default.removeObserver(self)
    }
}
