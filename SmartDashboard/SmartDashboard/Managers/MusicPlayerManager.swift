import Foundation
import MediaPlayer

/// Fonte de mídia do Apple Music / biblioteca local, via
/// `MPMusicPlayerController.systemMusicPlayer`.
///
/// Conforma a `MediaSource`: em vez de ser observada diretamente pela
/// interface, ela reporta seu estado ao `PlaybackCoordinator` através do
/// callback `onStateChange`.
@MainActor
final class MusicPlayerManager: MediaSource {

    let kind: MediaSourceKind = .appleMusic
    var onStateChange: ((NowPlayingState) -> Void)?

    private let player = MPMusicPlayerController.systemMusicPlayer
    private var state = NowPlayingState()
    private var ticker: Timer?
    private var isActive = false

    // MARK: - Ciclo de vida da fonte

    func activate() {
        guard !isActive else { return }
        isActive = true

        player.beginGeneratingPlaybackNotifications()
        NotificationCenter.default.addObserver(
            self, selector: #selector(handleNowPlayingChanged),
            name: .MPMusicPlayerControllerNowPlayingItemDidChange, object: player
        )
        NotificationCenter.default.addObserver(
            self, selector: #selector(handlePlaybackStateChanged),
            name: .MPMusicPlayerControllerPlaybackStateDidChange, object: player
        )

        refreshNowPlaying()
        refreshPlaybackState()
    }

    func deactivate() {
        guard isActive else { return }
        isActive = false

        stopTicker()
        NotificationCenter.default.removeObserver(self)
        player.endGeneratingPlaybackNotifications()
    }

    func requestAuthorization() {
        MPMediaLibrary.requestAuthorization { [weak self] _ in
            Task { @MainActor in
                self?.refreshNowPlaying()
                self?.refreshPlaybackState()
            }
        }
    }

    // MARK: - Controles de reprodução

    func playPause() {
        state.isPlaying ? player.pause() : player.play()
    }

    func next() {
        player.skipToNextItem()
    }

    func previous() {
        // Comportamento "duplo": volta ao início da faixa; se já no início,
        // o sistema vai para a faixa anterior na próxima chamada.
        player.skipToPreviousItem()
    }

    func seek(toFraction fraction: Double) {
        guard state.duration > 0 else { return }
        let time = min(max(fraction, 0), 1) * state.duration
        player.currentPlaybackTime = time
        state.elapsedTime = time
        emit()
    }

    // MARK: - Notificações

    @objc private func handleNowPlayingChanged() {
        Task { @MainActor in refreshNowPlaying() }
    }

    @objc private func handlePlaybackStateChanged() {
        Task { @MainActor in refreshPlaybackState() }
    }

    // MARK: - Atualização de estado

    private func refreshNowPlaying() {
        if let item = player.nowPlayingItem {
            state.title = item.title ?? "Faixa desconhecida"
            state.artist = item.artist ?? ""
            state.duration = item.playbackDuration
            state.elapsedTime = player.currentPlaybackTime
            state.artwork = item.artwork?.image(at: CGSize(width: 600, height: 600))
        } else {
            state.title = "Nada tocando"
            state.artist = ""
            state.duration = 0
            state.elapsedTime = 0
            state.artwork = nil
        }
        emit()
    }

    private func refreshPlaybackState() {
        state.isPlaying = player.playbackState == .playing
        // Mantém o cronômetro rodando apenas enquanto há reprodução ativa.
        state.isPlaying ? startTicker() : stopTicker()
        state.elapsedTime = player.currentPlaybackTime
        emit()
    }

    // MARK: - Cronômetro de progresso

    private func startTicker() {
        guard ticker == nil else { return }
        ticker = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                self.state.elapsedTime = self.player.currentPlaybackTime
                self.emit()
            }
        }
    }

    private func stopTicker() {
        ticker?.invalidate()
        ticker = nil
    }

    private func emit() {
        onStateChange?(state)
    }

    deinit {
        ticker?.invalidate()
        NotificationCenter.default.removeObserver(self)
    }
}
