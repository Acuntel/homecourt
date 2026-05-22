# syntax=docker/dockerfile:1.7
# Multi-stage build: alpine golang for build, distroless static for runtime.
#
# Note: BUILD.md §10 / §1 originally specified golang:1.22-alpine. The
# pinned dependency versions (pgx/v5 v5.9, nats.go v1.52) require Go ≥1.23,
# so we use 1.23-alpine here. The Go-1.22-only feature surface used in the
# engine is small (mainly net/http path-pattern routing) and is covered by
# the newer toolchain.
FROM golang:1.23-alpine AS build
WORKDIR /src
# Cache deps first.
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# CGO off for static binary.
ENV CGO_ENABLED=0 GOOS=linux GOARCH=amd64
RUN go build -trimpath -ldflags="-s -w" -o /out/engine ./cmd/engine

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/engine /engine
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/engine"]
