import {
  Clapperboard,
  Film,
  Folder,
  ListMusic,
  Library as LibraryIcon,
  Music,
  Tv,
} from "lucide-react";

export const VIEW_ICONS: Record<string, typeof Film> = {
  movies: Film,
  tvshows: Tv,
  music: Music,
  homevideos: Clapperboard,
  boxsets: LibraryIcon,
  playlists: ListMusic,
};

export function viewIcon(collectionType: string | null | undefined): typeof Film {
  return VIEW_ICONS[collectionType ?? ""] ?? Folder;
}
