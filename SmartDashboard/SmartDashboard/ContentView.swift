import SwiftUI

/// Tela inicial: o Painel Unificado (Smart Dashboard).
///
/// Layout em grade estática no modo Paisagem, dividido em dois grandes blocos:
/// - Esquerda: Widget de Condução (velocímetro, hora, atalhos de mapa).
/// - Direita (foco principal, ~60% da largura): Widget Multimídia.
///
/// Ao tocar no Widget Multimídia, abrimos a Tela de Reprodução Imersiva em
/// tela cheia, com controles por gestos.
struct ContentView: View {

    @EnvironmentObject private var theme: ThemeManager

    @StateObject private var coordinator = PlaybackCoordinator()
    @StateObject private var location = LocationManager()
    @StateObject private var settings = AppSettings()
    @StateObject private var destinations = DestinationStore()

    @State private var showImmersivePlayer = false
    @State private var showSettings = false

    var body: some View {
        GeometryReader { proxy in
            HStack(spacing: DS.widgetSpacing) {

                // Widget de Condução — ocupa ~40% da largura.
                DrivingWidget(
                    location: location,
                    settings: settings,
                    destinations: destinations,
                    onOpenSettings: { showSettings = true }
                )
                .frame(width: proxy.size.width * 0.4 - DS.widgetSpacing)

                // Widget Multimídia — foco principal, ocupa o restante (~60%).
                MultimediaWidget(coordinator: coordinator) {
                    showImmersivePlayer = true
                }
            }
            .padding(DS.screenPadding)
            .frame(width: proxy.size.width, height: proxy.size.height)
            .background(DS.background.ignoresSafeArea())
        }
        .fullScreenCover(isPresented: $showImmersivePlayer) {
            ImmersivePlayerView(coordinator: coordinator)
        }
        .sheet(isPresented: $showSettings) {
            SettingsView(theme: theme, settings: settings, destinations: destinations)
        }
        .onAppear {
            // Impede que a tela do iPhone desligue enquanto o app está aberto.
            UIApplication.shared.isIdleTimerDisabled = true

            // O coordenador já ativa a fonte e pede autorização de mídia na sua
            // inicialização; aqui cuidamos apenas da localização.
            location.requestAuthorization()
            location.start()
        }
        .onDisappear {
            UIApplication.shared.isIdleTimerDisabled = false
            location.stop()
        }
    }
}

#Preview(traits: .landscapeLeft) {
    ContentView()
        .environmentObject(ThemeManager())
}
