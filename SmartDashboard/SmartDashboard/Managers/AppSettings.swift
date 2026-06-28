import Foundation
import Combine

/// App de navegação externo escolhido pelo usuário.
enum NavApp: String, CaseIterable, Identifiable {
    case waze
    case googleMaps
    case appleMaps

    var id: String { rawValue }

    var label: String {
        switch self {
        case .waze:       return "Waze"
        case .googleMaps: return "Google Maps"
        case .appleMaps:  return "Apple Maps"
        }
    }
}

/// Preferências gerais do app, persistidas em `UserDefaults`.
@MainActor
final class AppSettings: ObservableObject {

    @Published var preferredNavApp: NavApp {
        didSet { UserDefaults.standard.set(preferredNavApp.rawValue, forKey: navKey) }
    }

    private let navKey = "preferredNavApp"

    init() {
        let raw = UserDefaults.standard.string(forKey: navKey) ?? NavApp.waze.rawValue
        preferredNavApp = NavApp(rawValue: raw) ?? .waze
    }
}
