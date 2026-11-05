import HealthKit

/* Apple Health, kept deliberately small:
   - read last night's sleep and the latest bodyweight, so Day and Food do not
     need typing into;
   - write a finished gym session as a strength workout.
   Nothing is sent anywhere; it only moves between Health and this app. */
final class HealthBridge {
    static let shared = HealthBridge()
    private let store = HKHealthStore()
    private init() {}

    var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    private var readTypes: Set<HKObjectType> {
        [HKCategoryType(.sleepAnalysis), HKQuantityType(.bodyMass)]
    }

    private var writeTypes: Set<HKSampleType> {
        [HKObjectType.workoutType()]
    }

    func requestAccess() async throws {
        guard isAvailable else { throw BridgeError.unavailable("Apple Health is not available on this device") }
        try await store.requestAuthorization(toShare: writeTypes, read: readTypes)
    }

    /* Hours asleep for the night that ended this morning, counted from 6pm
       yesterday. An iPhone and an Apple Watch can both record the same night,
       so overlapping stretches are merged rather than added twice. */
    func lastNight() async throws -> [String: Any] {
        guard isAvailable else { throw BridgeError.unavailable("Apple Health is not available on this device") }
        let calendar = Calendar.current
        let now = Date()
        let noon = calendar.date(bySettingHour: 12, minute: 0, second: 0, of: now) ?? now
        let end = min(now, noon)
        let dayBefore = calendar.date(byAdding: .day, value: -1, to: noon) ?? now
        let start = calendar.date(bySettingHour: 18, minute: 0, second: 0, of: dayBefore) ?? dayBefore

        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let descriptor = HKSampleQueryDescriptor(
            predicates: [.categorySample(type: HKCategoryType(.sleepAnalysis), predicate: predicate)],
            sortDescriptors: [SortDescriptor(\HKCategorySample.startDate)])
        let samples = try await descriptor.result(for: store)

        let asleep: Set<Int> = [
            HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue,
            HKCategoryValueSleepAnalysis.asleepCore.rawValue,
            HKCategoryValueSleepAnalysis.asleepDeep.rawValue,
            HKCategoryValueSleepAnalysis.asleepREM.rawValue,
        ]
        let spans = samples
            .filter { asleep.contains($0.value) }
            .map { (from: $0.startDate, to: $0.endDate) }
            .sorted { $0.from < $1.from }

        var merged: [(from: Date, to: Date)] = []
        for span in spans {
            if let last = merged.last, span.from <= last.to {
                merged[merged.count - 1].to = max(last.to, span.to)
            } else {
                merged.append(span)
            }
        }

        let seconds = merged.reduce(0.0) { $0 + $1.to.timeIntervalSince($1.from) }
        var result: [String: Any] = ["hours": (seconds / 3600 * 10).rounded() / 10]
        if let first = merged.first { result["from"] = first.from.timeIntervalSince1970 * 1000 }
        if let last = merged.last { result["to"] = last.to.timeIntervalSince1970 * 1000 }
        return result
    }

    /* The most recent bodyweight entry, in kg. Empty if there is none. */
    func latestWeight() async throws -> [String: Any] {
        guard isAvailable else { throw BridgeError.unavailable("Apple Health is not available on this device") }
        let descriptor = HKSampleQueryDescriptor(
            predicates: [.quantitySample(type: HKQuantityType(.bodyMass))],
            sortDescriptors: [SortDescriptor(\HKQuantitySample.endDate, order: .reverse)],
            limit: 1)
        let samples = try await descriptor.result(for: store)
        guard let latest = samples.first else { return [:] }
        let kg = latest.quantity.doubleValue(for: .gramUnit(with: .kilo))
        return ["kg": (kg * 10).rounded() / 10, "at": latest.endDate.timeIntervalSince1970 * 1000]
    }

    /* Saves a finished session as a strength workout. */
    func saveWorkout(start: Date, end: Date) async throws {
        guard isAvailable else { throw BridgeError.unavailable("Apple Health is not available on this device") }
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .traditionalStrengthTraining
        configuration.locationType = .indoor
        let builder = HKWorkoutBuilder(healthStore: store, configuration: configuration, device: .local())
        try await builder.beginCollection(withStart: start)
        try await builder.endCollection(withEnd: end)
        _ = try await builder.finishWorkout()
    }
}
