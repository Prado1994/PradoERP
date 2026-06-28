import SwiftUI
import Combine

/// Responsável pela "Adaptação Dinâmica" descrita no projeto:
///
/// - Suporta perfeitamente os temas Claro e Escuro.
/// - Implementa o "Modo Noturno Inteligente": entre o anoitecer e o amanhecer
///   o fundo é forçado para tons escuros, evitando ofuscar o condutor.
///
/// O modo pode ser:
/// - `.system`     -> segue o tema do iPhone.
/// - `.automatic`  -> claro de dia, escuro à noite (padrão).
/// - `.light`      -> sempre claro.
/// - `.dark`       -> sempre escuro.
final class ThemeManager: ObservableObject {

    enum Mode: String, CaseIterable, Identifiable {
        case system
        case automatic
        case light
        case dark

        var id: String { rawValue }

        var label: String {
            switch self {
            case .system:    return "Sistema"
            case .automatic: return "Automático"
            case .light:     return "Claro"
            case .dark:      return "Escuro"
            }
        }
    }

    @Published var mode: Mode = .automatic {
        didSet {
            UserDefaults.standard.set(mode.rawValue, forKey: Self.storageKey)
            recompute()
        }
    }

    private static let storageKey = "themeMode"

    /// Esquema de cores resolvido e aplicado na cena principal.
    @Published private(set) var colorScheme: ColorScheme?

    /// Hora (0–23) a partir da qual consideramos "noite" no modo automático.
    private let nightStartHour = 18
    /// Hora (0–23) a partir da qual consideramos "dia" no modo automático.
    private let dayStartHour = 6

    private var timer: AnyCancellable?

    init() {
        // Restaura a preferência salva (sem disparar didSet durante o init).
        if let raw = UserDefaults.standard.string(forKey: Self.storageKey),
           let saved = Mode(rawValue: raw) {
            mode = saved
        }
        recompute()
        // Reavalia periodicamente para alternar o tema sozinho na virada do dia.
        timer = Timer.publish(every: 60, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in self?.recompute() }
    }

    private func recompute() {
        switch mode {
        case .system:
            colorScheme = nil
        case .light:
            colorScheme = .light
        case .dark:
            colorScheme = .dark
        case .automatic:
            colorScheme = isNight() ? .dark : .light
        }
    }

    private func isNight(reference: Date = Date()) -> Bool {
        let hour = Calendar.current.component(.hour, from: reference)
        return hour >= nightStartHour || hour < dayStartHour
    }
}
