import SwiftUI

/// Ponto de entrada do aplicativo.
///
/// A Central Multimídia foi pensada para rodar SEMPRE no modo Paisagem
/// (Landscape), com o iPhone fixado ao painel do carro. O bloqueio de
/// orientação é garantido de duas formas complementares:
///
/// 1. Nas configurações do alvo (Info.plist) liberamos apenas as orientações
///    de paisagem (`UIInterfaceOrientationLandscapeLeft/Right`).
/// 2. Através do `AppDelegate` abaixo, que devolve ao sistema a máscara de
///    orientações suportadas em tempo de execução.
@main
struct SmartDashboardApp: App {

    // Conecta o AppDelegate ao ciclo de vida do SwiftUI para travar a orientação.
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    // Gerencia o tema (claro/escuro) e o "Modo Noturno Inteligente".
    @StateObject private var theme = ThemeManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(theme)
                // Aplica o esquema de cores resolvido pelo ThemeManager.
                // Quando `nil`, o app segue a configuração do sistema.
                .preferredColorScheme(theme.colorScheme)
        }
    }
}

/// AppDelegate mínimo usado apenas para travar a orientação em Paisagem.
final class AppDelegate: NSObject, UIApplicationDelegate {

    /// Máscara de orientações permitidas. Mantida estática para que possa ser
    /// ajustada de qualquer ponto do app, caso no futuro alguma tela precise
    /// liberar temporariamente o retrato.
    static var orientationLock: UIInterfaceOrientationMask = .landscape

    func application(
        _ application: UIApplication,
        supportedInterfaceOrientationsFor window: UIWindow?
    ) -> UIInterfaceOrientationMask {
        AppDelegate.orientationLock
    }
}
