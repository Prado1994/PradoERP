import Foundation

/// Um destino favorito para navegação rápida (ex.: Casa, Trabalho).
///
/// Guardamos as coordenadas para conseguir abrir o app de navegação **já
/// traçando a rota**, sem o motorista precisar digitar nada.
struct Destination: Identifiable, Codable, Hashable {
    var id: UUID = UUID()
    var name: String
    /// Nome de um SF Symbol exibido no botão (ex.: "house.fill").
    var systemImage: String
    var latitude: Double
    var longitude: Double
}
