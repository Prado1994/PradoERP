import SwiftUI

/// Tela de Ajustes: tema, app de navegação preferido e destinos favoritos.
struct SettingsView: View {

    @ObservedObject var theme: ThemeManager
    @ObservedObject var settings: AppSettings
    @ObservedObject var destinations: DestinationStore

    @Environment(\.dismiss) private var dismiss
    @State private var showingAdd = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Tema") {
                    Picker("Aparência", selection: $theme.mode) {
                        ForEach(ThemeManager.Mode.allCases) { mode in
                            Text(mode.label).tag(mode)
                        }
                    }
                }

                Section("Navegação") {
                    Picker("App preferido", selection: $settings.preferredNavApp) {
                        ForEach(NavApp.allCases) { app in
                            Text(app.label).tag(app)
                        }
                    }
                }

                Section {
                    ForEach(destinations.destinations) { destination in
                        HStack(spacing: 12) {
                            Image(systemName: destination.systemImage)
                                .foregroundStyle(DS.accent)
                                .frame(width: 28)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(destination.name)
                                    .font(.body.weight(.semibold))
                                Text(String(format: "%.5f, %.5f",
                                            destination.latitude, destination.longitude))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .onDelete { destinations.remove(at: $0) }

                    Button {
                        showingAdd = true
                    } label: {
                        Label("Adicionar destino", systemImage: "plus")
                    }
                } header: {
                    Text("Destinos favoritos")
                } footer: {
                    Text("Os dois primeiros destinos viram atalhos no painel e abrem a navegação já traçando a rota.")
                }
            }
            .navigationTitle("Ajustes")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Concluir") { dismiss() }
                }
            }
            .sheet(isPresented: $showingAdd) {
                DestinationEditor { destinations.add($0) }
            }
        }
    }
}

/// Formulário para cadastrar um novo destino favorito.
struct DestinationEditor: View {

    var onSave: (Destination) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var systemImage = "mappin.circle.fill"
    @State private var latitude = ""
    @State private var longitude = ""

    private let icons = [
        "house.fill", "briefcase.fill", "cart.fill",
        "fork.knife", "figure.run", "mappin.circle.fill"
    ]

    private var parsedLatitude: Double? {
        Double(latitude.replacingOccurrences(of: ",", with: "."))
    }
    private var parsedLongitude: Double? {
        Double(longitude.replacingOccurrences(of: ",", with: "."))
    }
    private var isValid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
            && parsedLatitude != nil
            && parsedLongitude != nil
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Nome") {
                    TextField("Ex.: Casa", text: $name)
                }

                Section("Ícone") {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(icons, id: \.self) { icon in
                                Image(systemName: icon)
                                    .font(.title2)
                                    .frame(width: 44, height: 44)
                                    .background(
                                        systemImage == icon ? DS.accent.opacity(0.25) : Color.clear,
                                        in: Circle()
                                    )
                                    .onTapGesture { systemImage = icon }
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }

                Section {
                    TextField("Latitude", text: $latitude)
                        .keyboardType(.numbersAndPunctuation)
                    TextField("Longitude", text: $longitude)
                        .keyboardType(.numbersAndPunctuation)
                } header: {
                    Text("Coordenadas")
                } footer: {
                    Text("Dica: no app Mapas, toque e segure um local, depois copie a latitude e longitude.")
                }
            }
            .navigationTitle("Novo destino")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salvar") {
                        onSave(Destination(
                            name: name.trimmingCharacters(in: .whitespaces),
                            systemImage: systemImage,
                            latitude: parsedLatitude ?? 0,
                            longitude: parsedLongitude ?? 0
                        ))
                        dismiss()
                    }
                    .disabled(!isValid)
                }
            }
        }
    }
}
