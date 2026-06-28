import SwiftUI

/// Widget de Condução (lado esquerdo da tela inicial).
///
/// Exibe um velocímetro digital limpo (a partir do GPS), a hora atual e dois
/// botões de atalho gigantes para abrir Waze e Google Maps via URL Schemes
/// nativos do iOS.
struct DrivingWidget: View {

    @ObservedObject var location: LocationManager

    @State private var now = Date()
    private let clock = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        WidgetContainer {
            VStack(spacing: DS.contentSpacing) {

                // Relógio.
                Text(now, format: .dateTime.hour().minute())
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Spacer(minLength: 0)

                // Velocímetro digital.
                VStack(spacing: -4) {
                    Text("\(Int(location.speedKmh.rounded()))")
                        .font(.system(size: 110, weight: .heavy, design: .rounded))
                        .monospacedDigit()
                        .contentTransition(.numericText())
                        .animation(.easeOut(duration: 0.3), value: location.speedKmh)
                    Text("km/h")
                        .font(.system(size: 24, weight: .bold))
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: 0)

                // Atalhos de navegação.
                HStack(spacing: DS.contentSpacing) {
                    NavigationShortcutButton(
                        title: "Waze",
                        systemImage: "location.north.fill",
                        tint: Color(red: 0.18, green: 0.74, blue: 0.93),
                        action: NavigationLauncher.openWaze
                    )
                    NavigationShortcutButton(
                        title: "Maps",
                        systemImage: "map.fill",
                        tint: Color(red: 0.26, green: 0.52, blue: 0.96),
                        action: NavigationLauncher.openGoogleMaps
                    )
                }
            }
            .padding(DS.contentSpacing)
        }
        .onReceive(clock) { now = $0 }
    }
}

/// Botão de atalho grande para abrir um app de navegação externo.
struct NavigationShortcutButton: View {
    let title: String
    let systemImage: String
    let tint: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: systemImage)
                    .font(.system(size: 34, weight: .bold))
                Text(title)
                    .font(.system(size: 20, weight: .heavy))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 96)
            .background(tint)
            .clipShape(RoundedRectangle(cornerRadius: DS.controlCornerRadius, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Abrir \(title)")
    }
}

/// Centraliza a lógica de abrir apps de navegação por URL Scheme, com
/// alternativa via web quando o app não está instalado.
enum NavigationLauncher {

    /// Abre o Waze. Sem coordenadas, apenas inicia o app; com `waze://?ll=`
    /// seria possível já traçar uma rota para um destino específico.
    static func openWaze() {
        open(scheme: "waze://", fallback: "https://waze.com/ul")
    }

    /// Abre o Google Maps.
    static func openGoogleMaps() {
        open(scheme: "comgooglemaps://", fallback: "https://maps.google.com")
    }

    private static func open(scheme: String, fallback: String) {
        if let url = URL(string: scheme), UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url)
        } else if let web = URL(string: fallback) {
            UIApplication.shared.open(web)
        }
    }
}
