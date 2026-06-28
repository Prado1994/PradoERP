import SwiftUI

/// Tokens de design da Central Multimídia.
///
/// O foco é segurança ao dirigir: alto contraste, cantos arredondados no padrão
/// Apple, tipografia espessa e áreas de toque generosas. Centralizar esses
/// valores aqui mantém a interface consistente entre todas as telas.
enum DS {

    // MARK: - Raios de canto

    /// Raio dos grandes blocos (widgets) da tela inicial.
    static let widgetCornerRadius: CGFloat = 28
    /// Raio dos botões e elementos internos.
    static let controlCornerRadius: CGFloat = 20

    // MARK: - Espaçamentos

    static let screenPadding: CGFloat = 20
    static let widgetSpacing: CGFloat = 16
    static let contentSpacing: CGFloat = 18

    // MARK: - Tamanhos de toque (botões gigantes)

    /// Lado mínimo de um botão de controle principal (Play/Pause).
    static let primaryControlSize: CGFloat = 96
    /// Lado mínimo dos botões secundários (Anterior/Próxima).
    static let secondaryControlSize: CGFloat = 76

    // MARK: - Cores

    /// Fundo geral da tela. Adapta-se automaticamente ao tema claro/escuro.
    static var background: Color { Color(.systemBackground) }
    /// Fundo dos blocos/widgets, com leve elevação em relação ao fundo.
    static var widgetBackground: Color { Color(.secondarySystemBackground) }
    /// Cor de destaque usada em ícones e botões ativos.
    static let accent: Color = .orange
}

// MARK: - Estilos reutilizáveis

/// Container padrão de um widget da tela inicial: fundo elevado e cantos
/// arredondados no estilo Apple.
struct WidgetContainer<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(DS.widgetBackground)
            .clipShape(RoundedRectangle(cornerRadius: DS.widgetCornerRadius, style: .continuous))
    }
}

/// Estilo de botão circular gigante usado nos controles de mídia. Cresce ao ser
/// pressionado para dar feedback tátil sem exigir precisão visual.
struct CircularControlButtonStyle: ButtonStyle {
    var size: CGFloat
    var isProminent: Bool = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: size * 0.42, weight: .bold))
            .frame(width: size, height: size)
            .foregroundStyle(isProminent ? Color.white : Color.primary)
            .background(
                Circle()
                    .fill(isProminent ? DS.accent : Color(.tertiarySystemBackground))
            )
            .scaleEffect(configuration.isPressed ? 0.9 : 1.0)
            .animation(.spring(response: 0.25, dampingFraction: 0.6), value: configuration.isPressed)
    }
}
