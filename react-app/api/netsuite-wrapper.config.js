// @amerilux/netsuite-wrapper build configuration (read by webpack.config.js).
//
// telemetryBootstrap: where wrapped N/* calls and log lines report. `false` keeps the wrappers as
//   thin pass-throughs. Leaving the key out would silently default to performance-tracker.
//   scopeKey: the PerformanceTracker scope every script in this app runs under. Its row in the
//     PerformanceTracker app (Scopes) sets the mode without a redeploy: off, boundary (one root
//     span per run plus that run's log lines) or diagnostic (every wrapped N/* call too). No row
//     means boundary.
//   recordExport: write spans to customrecord_ptrk_exec_span, which the PerformanceTracker app
//     reads. That app must be installed in the account. Default true.
//   httpsExport: also POST each run's spans and log lines as one JSON document to an external log
//     system. Add it when one is chosen. The token is a NetSuite API secret (Setup > Company > API
//     Secrets) named by its id, never a literal here. Costs 10 governance units per run.
// instrumentation: the Babel pass that tags every function with its module, name and arguments so
//   log lines and spans say where they came from. Off unless telemetry is on.
{{#if performanceTracker}}
module.exports = {
    telemetryBootstrap: {
        integration: 'performance-tracker',
        scopeKey: 'app:{{appNameKebab}}',
        recordExport: true,
        // httpsExport: { url: 'https://logs.example.com/ingest', secretId: 'custsecret_{{prefix}}_telemetry' },
    },
    instrumentation: true,
    chunkLogging: 'group',
};
{{/if}}
{{#unless performanceTracker}}
module.exports = {
    telemetryBootstrap: false,
    instrumentation: false,
    chunkLogging: 'group',
};
{{/unless}}
