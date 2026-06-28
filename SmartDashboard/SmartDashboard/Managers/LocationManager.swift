import Foundation
import CoreLocation
import Combine

/// Fornece a velocidade atual do veículo a partir do sinal de GPS do aparelho.
///
/// O `CLLocation.speed` é dado em metros por segundo (m/s) e vale -1 quando o
/// valor é inválido. Convertendo para km/h e tratando valores inválidos,
/// alimentamos o velocímetro digital do Widget de Condução.
final class LocationManager: NSObject, ObservableObject {

    private let manager = CLLocationManager()

    /// Velocidade em km/h, já tratada (nunca negativa).
    @Published var speedKmh: Double = 0
    @Published var authorizationStatus: CLAuthorizationStatus = .notDetermined

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        manager.activityType = .automotiveNavigation
        manager.distanceFilter = kCLDistanceFilterNone
        authorizationStatus = manager.authorizationStatus
    }

    /// Solicita a permissão de localização "Durante o uso do app".
    func requestAuthorization() {
        manager.requestWhenInUseAuthorization()
    }

    func start() {
        manager.startUpdatingLocation()
    }

    func stop() {
        manager.stopUpdatingLocation()
    }
}

extension LocationManager: CLLocationManagerDelegate {

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        // speed < 0 indica leitura inválida; tratamos como 0.
        let metersPerSecond = max(location.speed, 0)
        speedKmh = metersPerSecond * 3.6
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorizationStatus = manager.authorizationStatus
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            manager.startUpdatingLocation()
        default:
            break
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Em caso de falha momentânea de GPS mantemos o último valor exibido.
    }
}
