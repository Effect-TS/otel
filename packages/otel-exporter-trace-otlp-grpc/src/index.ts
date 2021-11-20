// ets_tracing: off

import * as T from "@effect-ts/core/Effect"
import * as L from "@effect-ts/core/Effect/Layer"
import * as M from "@effect-ts/core/Effect/Managed"
import { pipe } from "@effect-ts/core/Function"
import { BaseService, tag } from "@effect-ts/core/Has"
import { SimpleProcessor } from "@effect-ts/otel"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc"
import type { OTLPExporterConfigNode } from "@opentelemetry/exporter-trace-otlp-grpc/build/src/types"

export const GrpcTracingExporterConfigServiceId = Symbol()

export class GrpcTracingExporterConfig extends BaseService(
  GrpcTracingExporterConfigServiceId
) {
  constructor(readonly config: OTLPExporterConfigNode) {
    super()
  }
}

export const GrpcTracingExporterConfigTag = tag<GrpcTracingExporterConfig>(
  GrpcTracingExporterConfigServiceId
)

export function grpcConfig(config: OTLPExporterConfigNode) {
  return L.fromEffect(GrpcTracingExporterConfigTag)(
    T.succeedWith(() => new GrpcTracingExporterConfig(config))
  ).setKey(GrpcTracingExporterConfigTag.key)
}

export function grpcConfigM<R, E>(config: T.Effect<R, E, OTLPExporterConfigNode>) {
  return L.fromEffect(GrpcTracingExporterConfigTag)(
    T.map_(config, (_) => new GrpcTracingExporterConfig(_))
  ).setKey(GrpcTracingExporterConfigTag.key)
}

export const makeGRPCTracingSpanExporter = M.gen(function* (_) {
  const { config } = yield* _(GrpcTracingExporterConfigTag)

  const spanExporter = yield* _(
    pipe(
      T.succeedWith(() => new OTLPTraceExporter(config)),
      // NOTE Unfortunately this workaround/"hack" is currently needed since Otel doesn't yet provide a graceful
      // way to shutdown.
      //
      // Related issue: https://github.com/open-telemetry/opentelemetry-js/issues/987
      M.make((p) =>
        T.gen(function* (_) {
          while (1) {
            yield* _(T.sleep(0))
            const promises = p["_sendingPromises"] as any[]
            if (promises.length > 0) {
              yield* _(T.result(T.promise(() => Promise.all(promises))))
            } else {
              break
            }
          }
        })
      )
    )
  )

  return spanExporter
})

export const LiveGRPCSimple = SimpleProcessor(makeGRPCTracingSpanExporter)