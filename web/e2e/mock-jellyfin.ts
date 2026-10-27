import type { Page, Route } from "@playwright/test";

export const JELLYFIN = "http://jellyfin.test";
const USER_ID = "user1";
const TOKEN = "test-token";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const user = {
  Id: USER_ID,
  Name: "Alex",
  Policy: { IsAdministrator: false, EnableAllFolders: true },
  Configuration: { SubtitleLanguagePreference: "eng", EnableNextEpisodeAutoPlay: true },
};

const movies = Array.from({ length: 30 }, (_, index) => ({
  Id: `movie${index}`,
  Name: index === 0 ? "অতিথী Otithi" : `Movie ${String(index).padStart(2, "0")}`,
  Type: "Movie",
  MediaType: "Video",
  ProductionYear: 2000 + index,
  RunTimeTicks: 60 * 60 * 10_000_000,
  ImageTags: { Primary: `tag${index}` },
  BackdropImageTags: index === 1 ? ["b1"] : [],
  Overview: `Overview of movie ${index}.`,
  UserData: { Played: false, PlaybackPositionTicks: 0 },
}));

const views = [
  { Id: "view-movies", Name: "Movies", CollectionType: "movies", ImageTags: { Primary: "v1" } },
  { Id: "view-tv", Name: "TV Series", CollectionType: "tvshows", ImageTags: {} },
];

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

/** Installs the fake Jellyfin and runtime config on a page. */
export async function mockJellyfin(page: Page, options: { publicUsers?: boolean } = {}) {
  await page.route("**/config.json", (route) =>
    json(route, { jellyfinUrl: JELLYFIN, apiUrl: null }),
  );

  await page.route(`${JELLYFIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const authorized = (request.headers()["authorization"] ?? "").includes(`Token="${TOKEN}"`);

    if (path.includes("/Images/"))
      return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    if (path === "/System/Info/Public")
      return json(route, { ServerName: "Test Server", Version: "10.11.11", Id: "srv" });
    if (path === "/QuickConnect/Enabled") return json(route, true);
    if (path === "/Branding/Configuration")
      return json(route, { LoginDisclaimer: "Family server — be kind." });
    if (path === "/Users/Public")
      return json(
        route,
        options.publicUsers
          ? [
              { Id: USER_ID, Name: "Alex", HasPassword: true },
              { Id: "user2", Name: "Kid", HasPassword: false },
            ]
          : [],
      );
    if (path === "/Users/ForgotPassword")
      return json(route, { Action: "PinCode", PinFile: "/config/passwordreset123.json" });
    if (path === "/Users/ForgotPassword/Pin") {
      const body = request.postDataJSON() as { Pin: string };
      return body.Pin === "1A-2B-3C-4D"
        ? json(route, { Success: true, UsersReset: ["alex"] })
        : route.fulfill({ status: 404, body: "" });
    }
    if (path === "/Users/AuthenticateByName") {
      const body = request.postDataJSON() as { Username: string; Pw: string };
      if (body.Username.toLowerCase() === "alex" && body.Pw === "secret")
        return json(route, { AccessToken: TOKEN, User: user });
      if (body.Username === "Kid" && body.Pw === "")
        return json(route, { AccessToken: TOKEN, User: { ...user, Name: "Kid" } });
      return route.fulfill({ status: 401, body: "" });
    }
    if (!authorized) return route.fulfill({ status: 401, body: "" });

    if (path === "/Users/Me") return json(route, user);
    if (path === "/Sessions/Logout") return route.fulfill({ status: 204 });
    if (path.startsWith("/DisplayPreferences/")) return json(route, { CustomPrefs: {} });
    if (path === "/UserViews") return json(route, { Items: views, TotalRecordCount: views.length });
    if (path === "/UserItems/Resume")
      return json(route, {
        Items: [
          {
            ...movies[1],
            UserData: { PlayedPercentage: 40, PlaybackPositionTicks: 24 * 60 * 10_000_000 },
          },
        ],
        TotalRecordCount: 1,
      });
    if (path === "/Shows/NextUp") return json(route, { Items: [], TotalRecordCount: 0 });
    if (path === "/Items/Latest")
      return json(
        route,
        url.searchParams.get("parentId") === "view-movies" ? movies.slice(0, 8) : [],
      );
    if (path === "/Genres") return json(route, { Items: [{ Name: "Drama" }, { Name: "Comedy" }] });
    if (path === "/Items/Filters")
      return json(route, { Years: [2001, 2002], OfficialRatings: ["PG"] });
    if (path === "/Persons") return json(route, { Items: [] });
    if (path === "/Items") {
      const term = url.searchParams.get("searchTerm")?.toLowerCase();
      if (term) {
        const types = url.searchParams.getAll("includeItemTypes");
        const found = types.includes("Movie")
          ? movies.filter((movie) => movie.Name.toLowerCase().includes(term))
          : [];
        return json(route, { Items: found, TotalRecordCount: found.length });
      }
      const start = Number(url.searchParams.get("startIndex") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 100);
      return json(route, {
        Items: movies.slice(start, start + limit),
        TotalRecordCount: movies.length,
      });
    }
    const itemMatch =
      path.match(/^\/Users\/[^/]+\/Items\/([^/]+)$/) ?? path.match(/^\/Items\/([^/]+)$/);
    if (itemMatch) {
      const movie = movies.find((candidate) => candidate.Id === itemMatch[1]);
      if (!movie) return route.fulfill({ status: 404, body: "" });
      return json(route, {
        ...movie,
        Genres: ["Drama"],
        GenreItems: [{ Name: "Drama", Id: "g1" }],
        People: [{ Id: "p1", Name: "Jane Actor", Role: "Lead", Type: "Actor" }],
        MediaSources: [
          {
            Id: movie.Id,
            Container: "mp4",
            MediaStreams: [{ Type: "Video", Index: 0, Codec: "h264" }],
          },
        ],
      });
    }
    if (/\/Similar$/.test(path)) return json(route, { Items: movies.slice(5, 9) });
    return json(route, { Items: [], TotalRecordCount: 0 });
  });
}

/** Signs in through the real login form. */
export async function signIn(page: Page) {
  await mockJellyfin(page);
  await page.goto("/login");
  await page.getByLabel("Username").fill("alex");
  await page.getByRole("textbox", { name: "Password" }).fill("secret");
  await page.getByRole("button", { name: "Sign in" }).click();
}
