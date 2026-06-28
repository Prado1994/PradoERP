import UIKit

/// Abre apps de navegação externos via URL Schemes nativos do iOS.
///
/// Para destinos favoritos, montamos a URL com as coordenadas para que a
/// navegação abra **já traçando a rota**. Sempre tentamos primeiro o scheme do
/// app instalado e, se indisponível, caímos para a versão web.
enum NavigationLauncher {

    /// Abre o app de navegação sem destino (apenas inicia o app).
    static func openNavigation(using app: NavApp) {
        open(urls: plainURLs(for: app))
    }

    /// Abre o app de navegação já traçando a rota até `destination`.
    static func route(to destination: Destination, using app: NavApp) {
        open(urls: routeURLs(to: destination, app: app))
    }

    // MARK: - Abertura com fallback

    private static func open(urls: [URL]) {
        for url in urls where UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url)
            return
        }
        // Último recurso: tenta abrir a alternativa web mesmo sem canOpenURL.
        if let fallback = urls.last {
            UIApplication.shared.open(fallback)
        }
    }

    // MARK: - Montagem de URLs

    private static func plainURLs(for app: NavApp) -> [URL] {
        switch app {
        case .waze:
            return urls("waze://", "https://waze.com/ul")
        case .googleMaps:
            return urls("comgooglemaps://", "https://maps.google.com")
        case .appleMaps:
            return urls("http://maps.apple.com/")
        }
    }

    private static func routeURLs(to d: Destination, app: NavApp) -> [URL] {
        let lat = d.latitude
        let lon = d.longitude
        switch app {
        case .waze:
            return urls(
                "waze://?ll=\(lat),\(lon)&navigate=yes",
                "https://waze.com/ul?ll=\(lat),\(lon)&navigate=yes"
            )
        case .googleMaps:
            return urls(
                "comgooglemaps://?daddr=\(lat),\(lon)&directionsmode=driving",
                "https://www.google.com/maps/dir/?api=1&destination=\(lat),\(lon)&travelmode=driving"
            )
        case .appleMaps:
            // O esquema http é tratado pelo sistema e abre o Apple Maps.
            return urls("http://maps.apple.com/?daddr=\(lat),\(lon)&dirflg=d")
        }
    }

    private static func urls(_ strings: String...) -> [URL] {
        strings.compactMap { URL(string: $0) }
    }
}
