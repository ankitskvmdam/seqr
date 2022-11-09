#!/usr/bin/env bash

DIR=$(dirname "$BASH_SOURCE")

set -x -e

DEPLOYMENT_TARGET=prototype

POD_NAME=$("${DIR}"/utils/get_pod_name.sh "${DEPLOYMENT_TARGET}" seqr)

kubectl delete -f "${DIR}"/utils/seqr-prototype-full.yaml
kubectl apply -f "${DIR}"/utils/seqr-prototype-full.yaml