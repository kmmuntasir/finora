package subtitles

import (
	"encoding/binary"
	"fmt"
)

// HashChunk is how many bytes the OpenSubtitles hash reads from each end.
const HashChunk = 64 * 1024

// OpenSubtitlesHash computes the "moviehash": file size plus the uint64 sums
// of the first and last 64 KB. head and tail must be those chunks (shorter
// only for files under 64 KB).
func OpenSubtitlesHash(size int64, head, tail []byte) string {
	sum := uint64(size)
	for _, chunk := range [][]byte{head, tail} {
		for i := 0; i+8 <= len(chunk); i += 8 {
			sum += binary.LittleEndian.Uint64(chunk[i : i+8])
		}
	}
	return fmt.Sprintf("%016x", sum)
}
