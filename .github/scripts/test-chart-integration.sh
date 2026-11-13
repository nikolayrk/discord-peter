#!/usr/bin/env bash
set -euo pipefail

docker build -t discord-peter:test .
kind load docker-image discord-peter:test --name chart-testing
helm dependency build ./charts/discord-peter

install_and_check() {
  local release="$1"
  local namespace="$2"
  shift 2
  kubectl create namespace "$namespace"
  kubectl -n "$namespace" create configmap test-harness --from-file=harness.js=tests/chart/harness.js
  if ! helm upgrade --install "$release" ./charts/discord-peter --namespace "$namespace" --wait --timeout 5m \
    --set image.repository=discord-peter --set image.tag=test --set image.pullPolicy=IfNotPresent \
    "$@" \
    --set-json 'command=["node"]' --set-json 'args=["/test-harness/harness.js"]' \
    --set-json 'extraVolumes=[{"name":"harness","configMap":{"name":"test-harness"}}]' \
    --set-json 'extraVolumeMounts=[{"name":"harness","mountPath":"/test-harness","readOnly":true}]'; then
    kubectl -n "$namespace" get pods -o wide
    kubectl -n "$namespace" logs "deployment/$release" --all-containers || true
    kubectl -n "$namespace" get events --sort-by=.lastTimestamp
    return 1
  fi

  for _ in $(seq 1 90); do
    if kubectl -n "$namespace" logs "deployment/$release" 2>/dev/null | grep -q CHART_HARNESS_SUCCESS; then return 0; fi
    sleep 2
  done
  kubectl -n "$namespace" get pods -o wide
  kubectl -n "$namespace" logs "deployment/$release" --all-containers || true
  kubectl -n "$namespace" get events --sort-by=.lastTimestamp
  return 1
}

install_and_check bundled bundled --set redis.master.persistence.enabled=false

kubectl create namespace external
kubectl -n external create deployment redis --image=redis:7-alpine
kubectl -n external expose deployment redis --port=6379
kubectl -n external rollout status deployment/redis --timeout=120s
install_and_check external external --set redis.enabled=false --set config.redisUrl=redis://redis:6379
