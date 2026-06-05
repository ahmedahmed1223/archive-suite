# PocketBase server, built from a PINNED official release binary (not `latest`).
# Override PB_VERSION with a real published version from
# https://github.com/pocketbase/pocketbase/releases
FROM alpine:3.22

ARG PB_VERSION=0.39.1
RUN apk add --no-cache ca-certificates unzip wget

RUN wget -O /tmp/pb.zip \
      "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
 && unzip /tmp/pb.zip -d /pb \
 && rm /tmp/pb.zip

EXPOSE 8090
# Data persists in /pb_data (mounted volume). Schema is imported by the operator
# (see README) — the server does not mutate its own schema at runtime.
ENTRYPOINT ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb_data"]
