package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/kmmuntasir/finora/api/internal/config"
	"github.com/kmmuntasir/finora/api/internal/fetcherstate"
	"github.com/kmmuntasir/finora/api/internal/jellyfin"
	"github.com/kmmuntasir/finora/api/internal/store"
	"github.com/kmmuntasir/finora/api/internal/subtitles"
)

// importSubtitleFetcher copies the misses from subtitle-fetcher's state.json
// into the automatic job's attempts, so titles it gave up on are not searched
// again and the others keep their count. Run it with the service stopped:
//
//	finora-api import-subtitle-fetcher [-language en] state.json
func importSubtitleFetcher(args []string) error {
	flags := flag.NewFlagSet("import-subtitle-fetcher", flag.ContinueOnError)
	code := flags.String("language", "en", "the language subtitle-fetcher fetched (its config.json \"language\")")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if flags.NArg() != 1 {
		return errors.New("usage: finora-api import-subtitle-fetcher [-language en] state.json")
	}
	language, ok := subtitles.LookupLanguage(*code)
	if !ok {
		return fmt.Errorf("unknown language %q", *code)
	}
	file, err := os.Open(flags.Arg(0))
	if err != nil {
		return err
	}
	defer file.Close()
	misses, err := fetcherstate.Misses(file)
	if err != nil {
		return err
	}

	ctx := context.Background()
	st, err := store.Open(ctx, filepath.Join(env("FINORA_DATA_DIR", "./data"), "finora.db"))
	if err != nil {
		return err
	}
	defer st.Close()
	settings, err := config.Resolve(ctx, st)
	if err != nil {
		return err
	}
	if !settings.Configured() {
		return errors.New("the Finora API is not connected to Jellyfin yet")
	}
	client := jellyfin.New(settings.JellyfinURL, settings.JellyfinAPIKey)

	matched := 0
	for start := 0; ; start += 500 {
		items, total, err := client.VideosNewestFirst(ctx, start, 500)
		if err != nil {
			return fmt.Errorf("list Jellyfin videos: %w", err)
		}
		for _, item := range items {
			miss, ok := misses[fetcherstate.PathKey(item.Path)]
			if !ok {
				continue
			}
			if err := st.ImportAutoAttempt(ctx, item.ID, language.Code, miss.Attempts, miss.LastTried, "subtitle-fetcher: "+miss.LastError); err != nil {
				return err
			}
			matched++
		}
		if start+500 >= total {
			break
		}
	}
	fmt.Printf("subtitle-fetcher misses: %d, matched to Jellyfin items and imported: %d\n", len(misses), matched)
	return nil
}
