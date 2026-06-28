import Foundation
import Combine

/// Persiste os destinos favoritos do usuário em `UserDefaults` (como JSON).
@MainActor
final class DestinationStore: ObservableObject {

    @Published var destinations: [Destination] {
        didSet { persist() }
    }

    private let key = "savedDestinations"

    init() {
        if let data = UserDefaults.standard.data(forKey: key),
           let decoded = try? JSONDecoder().decode([Destination].self, from: data) {
            destinations = decoded
        } else {
            destinations = []
        }
    }

    func add(_ destination: Destination) {
        destinations.append(destination)
    }

    func update(_ destination: Destination) {
        if let index = destinations.firstIndex(where: { $0.id == destination.id }) {
            destinations[index] = destination
        }
    }

    func remove(at offsets: IndexSet) {
        destinations.remove(atOffsets: offsets)
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(destinations) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }
}
