import SwiftUI
import WidgetKit

/* "Today at a glance": eaten, gym this week, anchors done, pouches. The app
   writes the numbers into the shared store whenever the home screen draws
   (see RestActivity.swift, WidgetSync); this widget only reads and shows them. */

struct GlanceEntry: TimelineEntry {
    let date: Date
    let snapshot: GlanceSnapshot
}

struct GlanceProvider: TimelineProvider {
    func placeholder(in context: Context) -> GlanceEntry {
        GlanceEntry(date: Date(), snapshot: .sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (GlanceEntry) -> Void) {
        completion(GlanceEntry(date: Date(), snapshot: SharedStore.read() ?? .sample))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<GlanceEntry>) -> Void) {
        let entry = GlanceEntry(date: Date(), snapshot: SharedStore.read() ?? .sample)
        // The app reloads this whenever it has new numbers; this is only a safety net.
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(30 * 60))))
    }
}

struct GlanceView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var scheme
    let entry: GlanceEntry

    var body: some View {
        switch family {
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                ForEach(Array(entry.snapshot.tiles.prefix(3).enumerated()), id: \.offset) { _, tile in
                    HStack {
                        Text(tile.label).font(.caption2)
                        Spacer()
                        Text(tile.value).font(.caption.weight(.semibold))
                    }
                }
            }
        case .systemSmall:
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 10) {
                ForEach(entry.snapshot.tiles, id: \.self) { TileView(tile: $0, compact: true) }
            }
        default:
            HStack(alignment: .top, spacing: 8) {
                ForEach(entry.snapshot.tiles, id: \.self) { TileView(tile: $0, compact: false) }
            }
        }
    }
}

private struct TileView: View {
    @Environment(\.colorScheme) private var scheme
    let tile: GlanceSnapshot.Tile
    let compact: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(tile.label.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Palette.ink(scheme).opacity(0.6))
            Text(tile.value)
                .font(.system(size: compact ? 22 : 26, weight: .semibold, design: .serif))
                .foregroundStyle(Palette.ink(scheme))
                .minimumScaleFactor(0.6)
                .lineLimit(1)
            Text(tile.sub)
                .font(.system(size: 11))
                .foregroundStyle(Palette.ink(scheme).opacity(0.6))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct GlanceWidget: Widget {
    let kind = "AlexHQGlance"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: GlanceProvider()) { entry in
            GlanceView(entry: entry)
                .containerBackground(for: .widget) { GlanceBackground() }
        }
        .configurationDisplayName("Today")
        .description("Food eaten, gym sessions, anchors and pouches at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}

private struct GlanceBackground: View {
    @Environment(\.colorScheme) private var scheme
    var body: some View { Palette.background(scheme) }
}
