// Command finora-api runs the optional Finora API: settings, announcements and
// Google sign-in for admins. It never serves the frontend or proxies media.
package main

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"log/slog"
	"math/big"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/kmmuntasir/finora/api/internal/config"
	"github.com/kmmuntasir/finora/api/internal/httpapi"
	"github.com/kmmuntasir/finora/api/internal/store"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo}))
	if err := run(logger); err != nil {
		logger.Error("fatal", "error", err)
		os.Exit(1)
	}
}

func env(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func setupCode() string {
	const digits = "0123456789"
	code := make([]byte, 8)
	for i := range code {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(digits))))
		if err != nil {
			panic(err)
		}
		code[i] = digits[n.Int64()]
	}
	return string(code)
}

func run(logger *slog.Logger) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	dataDir := env("FINORA_DATA_DIR", "./data")
	if err := os.MkdirAll(dataDir, 0o700); err != nil {
		return fmt.Errorf("create data directory: %w", err)
	}
	st, err := store.Open(ctx, filepath.Join(dataDir, "finora.db"))
	if err != nil {
		return err
	}
	defer st.Close()

	settings, err := config.Resolve(ctx, st)
	if err != nil {
		return err
	}
	code := ""
	if !settings.Configured() {
		code = setupCode()
		logger.Warn("Finora API is not configured yet. Open Finora Web and enter this one-time setup code.", "setupCode", code)
	}

	server := httpapi.New(httpapi.Options{Store: st, Logger: logger, SetupCode: code, DataDir: dataDir})
	go server.RunJanitor(ctx)

	httpServer := &http.Server{
		Addr:              env("FINORA_LISTEN", ":8080"),
		Handler:           server.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       2 * time.Minute,
	}
	errs := make(chan error, 1)
	go func() {
		logger.Info("listening", "addr", httpServer.Addr)
		errs <- httpServer.ListenAndServe()
	}()

	select {
	case err := <-errs:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
		logger.Info("shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return httpServer.Shutdown(shutdownCtx)
	}
	return nil
}
