// Package subtitles searches external subtitle providers and prepares the
// result for Jellyfin. Provider behaviour was researched in the author's
// subtitle-fetcher project; see .knowledge/subtitles/providers.md.
package subtitles

import "strings"

// Language describes one subtitle language across providers.
type Language struct {
	Code  string // ISO 639-1, used by OpenSubtitles and SubDL
	Code3 string // ISO 639-2/B, used by Jellyfin
	Name  string // English name, used by Addic7ed and the UI
	Latin bool   // written in Latin script (enables the script sanity check)
}

var languages = []Language{
	{"en", "eng", "English", true},
	{"bn", "ben", "Bengali", false},
	{"hi", "hin", "Hindi", false},
	{"ar", "ara", "Arabic", false},
	{"es", "spa", "Spanish", true},
	{"fr", "fre", "French", true},
	{"de", "ger", "German", true},
	{"it", "ita", "Italian", true},
	{"pt", "por", "Portuguese", true},
	{"ru", "rus", "Russian", false},
	{"tr", "tur", "Turkish", true},
	{"id", "ind", "Indonesian", true},
	{"ms", "may", "Malay", true},
	{"nl", "dut", "Dutch", true},
	{"pl", "pol", "Polish", true},
	{"sv", "swe", "Swedish", true},
	{"da", "dan", "Danish", true},
	{"fi", "fin", "Finnish", true},
	{"no", "nor", "Norwegian", true},
	{"ro", "rum", "Romanian", true},
	{"cs", "cze", "Czech", true},
	{"hu", "hun", "Hungarian", true},
	{"el", "gre", "Greek", false},
	{"he", "heb", "Hebrew", false},
	{"fa", "per", "Persian", false},
	{"ur", "urd", "Urdu", false},
	{"ta", "tam", "Tamil", false},
	{"th", "tha", "Thai", false},
	{"vi", "vie", "Vietnamese", true},
	{"zh", "chi", "Chinese", false},
	{"ja", "jpn", "Japanese", false},
	{"ko", "kor", "Korean", false},
}

// Languages returns the supported languages.
func Languages() []Language { return append([]Language(nil), languages...) }

// LookupLanguage finds a language by ISO 639-1 or 639-2 code (case-insensitive).
func LookupLanguage(code string) (Language, bool) {
	code = strings.ToLower(strings.TrimSpace(code))
	for _, language := range languages {
		if language.Code == code || language.Code3 == code {
			return language, true
		}
	}
	// ISO 639-2/T variants Jellyfin sometimes reports.
	aliases := map[string]string{"fra": "fr", "deu": "de", "zho": "zh", "nld": "nl", "ron": "ro", "ces": "cs", "ell": "el", "fas": "fa", "msa": "ms"}
	if alias, ok := aliases[code]; ok {
		return LookupLanguage(alias)
	}
	return Language{}, false
}
