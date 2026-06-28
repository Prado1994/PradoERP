import SwiftUI

/// Widget de Condução (lado esquerdo da tela inicial).
///
/// Exibe um velocímetro digital limpo (a partir do GPS), a hora atual, um botão
/// de Ajustes e atalhos gigantes para destinos favoritos — que abrem o app de
/// navegação preferido **já traçando a rota**.
struct DrivingWidget: View {

    @ObservedObject var location: LocationManager
    @ObservedObject var settings: AppSettings
    @ObservedObject var destinations: DestinationStore

    /// Abre a tela de Ajustes.
    var onOpenSettings: () -> Void

    @State private var now = Date()
    private let clock = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        WidgetContainer {
            VStack(spacing: DS.contentSpacing) {

                // Cabeçalho: relógio + botão de ajustes.
                HStack {
                    Text(now, format: .dateTime.hour().minute())
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .foregroundStyle(.secondary)

                    Spacer()

                    Button(action: onOpenSettings) {
                        Image(systemName: "gearshape.fill")
                            .font(.system(size: 24, weight: .bold))
                            .foregroundStyle(.secondary)
                            .padding(10)
                            .background(Color(.tertiarySystemBackground), in: Circle())
                    }
                    .accessibilityLabel("Ajustes")
                }

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

                navigationButtons
            }
            .padding(DS.contentSpacing)
        }
        .onReceive(clock) { now = $0 }
    }

    /// Mostra até dois destinos favoritos como botões gigantes. Sem destinos
    /// cadastrados, oferece um botão único que apenas abre o app de navegação.
    @ViewBuilder
    private var navigationButtons: some View {
        let favorites = Array(destinations.destinations.prefix(2))

        if favorites.isEmpty {
            NavigationShortcutButton(
                title: settings.preferredNavApp.label,
                systemImage: "location.north.fill",
                tint: DS.accent
            ) {
                NavigationLauncher.openNavigation(using: settings.preferredNavApp)
            }
        } else {
            HStack(spacing: DS.contentSpacing) {
                ForEach(favorites) { destination in
                    NavigationShortcutButton(
                        title: destination.name,
                        systemImage: destination.systemImage,
                        tint: DS.accent
                    ) {
                        NavigationLauncher.route(to: destination, using: settings.preferredNavApp)
                    }
                }
            }
        }
    }
}

/// Botão de atalho grande para abrir navegação.
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
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 96)
            .background(tint)
            .clipShape(RoundedRectangle(cornerRadius: DS.controlCornerRadius, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Navegar para \(title)")
    }
}
