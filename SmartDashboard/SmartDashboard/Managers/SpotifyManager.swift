import Foundation
import UIKit

/// SCAFFOLD da integração com o Spotify.
///
/// ⚠️ Ainda NÃO funcional: este arquivo define os pontos de integração para
/// quando o Spotify iOS SDK e suas credenciais estiverem disponíveis. Hoje ele
/// apenas reporta um estado "não conectado", permitindo que a interface já
/// ofereça a troca de fonte sem quebrar.
///
/// COMO TORNAR REAL (passo a passo):
///
/// 1. Spotify Developer Dashboard (https://developer.spotify.com/dashboard):
///    - Crie um app e copie o **Client ID**.
///    - Em *Redirect URIs*, registre `smartdashboard://spotify-callback`.
///    - Em *Bundle IDs*, adicione `com.pradocalcados.smartdashboard`.
///
/// 2. Adicione o **Spotify iOS SDK** (`SpotifyiOS.xcframework`) ao alvo, via
///    Swift Package Manager ou arrastando o framework para o projeto.
///
/// 3. No `Info.plist`:
///    - Já incluímos `spotify` em `LSApplicationQueriesSchemes` e o
///      `CFBundleURLTypes` com o scheme `smartdashboard`.
///    - Trate a abertura do callback (`onOpenURL`) chamando
///      `sessionManager.application(_:open:options:)`.
///
/// 4. Implemente os trechos marcados com `TODO` usando `SPTSessionManager`
///    (autorização) e `SPTAppRemote` (controle + estado do player).
@MainActor
final class SpotifyManager: MediaSource {

    let kind: MediaSourceKind = .spotify
    var onStateChange: ((NowPlayingState) -> Void)?

    /// Substitua pelo seu Client ID do Spotify Developer Dashboard.
    private let clientID = "<SEU_SPOTIFY_CLIENT_ID>"
    /// Deve coincidir com o Redirect URI cadastrado no dashboard e no Info.plist.
    private let redirectURI = URL(string: "smartdashboard://spotify-callback")!

    private var state = NowPlayingState(title: "Spotify não conectado")

    // MARK: - MediaSource

    func activate() {
        // TODO: Configurar SPTConfiguration(clientID:redirectURL:) e conectar o
        // SPTAppRemote; assinar as atualizações do player (delegate) e mapear
        // SPTAppRemotePlayerState -> NowPlayingState chamando `emit()`.
        emit()
    }

    func deactivate() {
        // TODO: appRemote.disconnect()
    }

    func requestAuthorization() {
        // TODO: sessionManager.initiateSession(with: scopes, options: .default)
        // O retorno chega via Redirect URI tratado em onOpenURL.
    }

    func playPause() {
        // TODO: appRemote.playerAPI?.getPlayerState { state in
        //   state.isPaused ? resume() : pause() }
    }

    func next() {
        // TODO: appRemote.playerAPI?.skip(toNext:)
    }

    func previous() {
        // TODO: appRemote.playerAPI?.skip(toPrevious:)
    }

    func seek(toFraction fraction: Double) {
        // TODO: appRemote.playerAPI?.seek(toPosition: Int(fraction * duration_ms))
    }

    // MARK: - Helpers

    private func emit() {
        onStateChange?(state)
    }
}
