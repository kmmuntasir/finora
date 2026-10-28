# Finora API: a single static binary with SQLite (pure Go, no cgo).
# Build from the api/ directory: docker build -t finora-api api
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/finora-api ./cmd/finora-api
# The data directory must belong to the non-root user, or a fresh volume is read-only for it.
RUN mkdir -p /out/data

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/finora-api /finora-api
COPY --from=build --chown=65532:65532 /out/data /data
ENV FINORA_DATA_DIR=/data FINORA_LISTEN=:8080
VOLUME /data
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/finora-api"]
